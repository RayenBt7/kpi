"""
Binary Classification Strategies for Risk Model
===============================================
Module pour entraîner et comparer les stratégies d'équilibrage 
sur la classification binaire du risque (0/1).

Utilisé dans train_risk.py pour améliorer les performances 
avec des données déséquilibrées.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict, Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import f1_score, classification_report
from imblearn.over_sampling import SMOTE


class BinaryRiskStrategies:
    """Gère les stratégies d'entraînement pour la classification binaire du risque."""

    def __init__(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        random_state: int = 42,
    ):
        """
        Args:
            X: DataFrame des features (peut être scalé ou non)
            y: Série des labels binaires (0 ou 1)
            random_state: Seed pour reproducibilité
        """
        self.X = X
        self.y = y
        self.random_state = random_state

        # Pré-traitement si nécessaire
        if isinstance(X, pd.DataFrame):
            self.X_scaled = X.copy()
        else:
            scaler = StandardScaler()
            self.X_scaled = pd.DataFrame(
                scaler.fit_transform(X), columns=X.columns
            )

        # Stratified K-Fold
        self.cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)

    def train_with_balanced_weight(self) -> Dict[str, Any]:
        """
        Entraîne avec class_weight='balanced'.
        
        Returns:
            Dict contenant le modèle, les résultats CV et les métriques
        """
        print("\n  [Strategy A] Random Forest + class_weight='balanced'")

        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=self.random_state,
            n_jobs=-1,
        )

        scoring = {
            'f1': 'f1',
            'precision': 'precision',
            'recall': 'recall',
            'roc_auc': 'roc_auc',
        }

        cv_results = cross_validate(
            rf, self.X_scaled, self.y,
            cv=self.cv, scoring=scoring, return_train_score=True
        )

        f1_mean = cv_results['test_f1'].mean()
        f1_std = cv_results['test_f1'].std()

        print(f"    F1 (test)     : {f1_mean:.3f} ± {f1_std:.3f}")
        print(f"    Precision     : {cv_results['test_precision'].mean():.3f}")
        print(f"    Recall        : {cv_results['test_recall'].mean():.3f}")
        print(f"    ROC AUC       : {cv_results['test_roc_auc'].mean():.3f}")

        return {
            'name': 'balanced',
            'model': rf,
            'cv_results': cv_results,
            'f1_mean': f1_mean,
            'f1_std': f1_std,
        }

    def train_with_smote(self) -> Dict[str, Any]:
        """
        Entraîne avec SMOTE (sur-échantillonnage des cas positifs).
        
        Returns:
            Dict contenant le modèle, les scores F1 par fold et les métriques
        """
        print("\n  [Strategy B] Random Forest + SMOTE")

        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=2,
            random_state=self.random_state,
            n_jobs=-1,
        )

        f1_scores = []
        precision_scores = []
        recall_scores = []
        roc_auc_scores = []

        for fold, (train_idx, val_idx) in enumerate(self.cv.split(self.X_scaled, self.y)):
            X_tr, X_val = self.X_scaled.iloc[train_idx], self.X_scaled.iloc[val_idx]
            y_tr, y_val = self.y.iloc[train_idx], self.y.iloc[val_idx]

            # Appliquer SMOTE
            min_count = y_tr.value_counts().min()
            k = max(1, min(5, min_count - 1))

            smote = SMOTE(random_state=self.random_state, k_neighbors=k)
            X_res, y_res = smote.fit_resample(X_tr, y_tr)

            # Entraîner et évaluer
            rf.fit(X_res, y_res)
            y_pred = rf.predict(X_val)
            y_proba = rf.predict_proba(X_val)[:, 1]

            f1 = f1_score(y_val, y_pred, zero_division=0)
            from sklearn.metrics import precision_score, recall_score, roc_auc_score
            precision = precision_score(y_val, y_pred, zero_division=0)
            recall = recall_score(y_val, y_pred, zero_division=0)
            roc_auc = roc_auc_score(y_val, y_proba) if len(y_val.unique()) > 1 else 0.0

            f1_scores.append(f1)
            precision_scores.append(precision)
            recall_scores.append(recall)
            roc_auc_scores.append(roc_auc)

        f1_mean = np.mean(f1_scores)
        f1_std = np.std(f1_scores)

        print(f"    F1 (test)     : {f1_mean:.3f} ± {f1_std:.3f}")
        print(f"    Precision     : {np.mean(precision_scores):.3f}")
        print(f"    Recall        : {np.mean(recall_scores):.3f}")
        print(f"    ROC AUC       : {np.mean(roc_auc_scores):.3f}")

        return {
            'name': 'smote',
            'model': rf,
            'f1_scores': f1_scores,
            'precision_scores': precision_scores,
            'recall_scores': recall_scores,
            'roc_auc_scores': roc_auc_scores,
            'f1_mean': f1_mean,
            'f1_std': f1_std,
        }

    def select_best_strategy(
        self,
        result_balanced: Dict[str, Any],
        result_smote: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Sélectionne la meilleure stratégie basée sur F1 score.
        
        Args:
            result_balanced: Résultats de la stratégie balanced
            result_smote: Résultats de la stratégie SMOTE
            
        Returns:
            Le meilleur résultat avec sa stratégie nommée
        """
        f1_balanced = result_balanced['f1_mean']
        f1_smote = result_smote['f1_mean']

        if f1_smote >= f1_balanced:
            result_smote['selected'] = True
            return result_smote
        else:
            result_balanced['selected'] = True
            return result_balanced

    def evaluate_on_full_data(self, model) -> Dict[str, Any]:
        """
        Évalue le modèle sur l'ensemble des données d'entraînement.
        
        Args:
            model: Modèle entraîné
            
        Returns:
            Dict avec prédictions et rapport de classification
        """
        # Appliquer SMOTE sur l'ensemble complet pour cohérence
        min_count = self.y.value_counts().min()
        k = max(1, min(5, min_count - 1))

        smote = SMOTE(random_state=self.random_state, k_neighbors=k)
        X_res, y_res = smote.fit_resample(self.X_scaled, self.y)

        model.fit(X_res, y_res)
        y_pred = model.predict(self.X_scaled)

        report = classification_report(
            self.y, y_pred,
            target_names=['No Risk', 'Risk'],
            output_dict=True,
            zero_division=0
        )

        return {
            'model': model,
            'y_pred': y_pred,
            'report': report,
        }
