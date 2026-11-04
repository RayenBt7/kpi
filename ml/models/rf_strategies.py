"""
Random Forest Strategies for Risk Classification
================================================
Module centralisant les stratégies d'équilibrage des données et d'entraînement.
- Strategy 1: class_weight='balanced'
- Strategy 2: SMOTE (sur-échantillonnage)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_validate, GridSearchCV
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    accuracy_score,
    precision_score,
    recall_score,
)
from imblearn.over_sampling import SMOTE

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.metrics import ConfusionMatrixDisplay


class RandomForestStrategies:
    """Gère les stratégies d'entraînement et d'optimisation du Random Forest."""

    def __init__(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        features: list,
        label_names: list = None,
        random_state: int = 42,
    ):
        """
        Args:
            X: DataFrame des features (non-scalées)
            y: Série des labels encodés numériquement
            features: Liste des noms de features
            label_names: Noms des labels (ex: ['Low', 'Medium', 'High'])
            random_state: Seed pour reproducibilité
        """
        self.X = X
        self.y = y
        self.features = features
        self.label_names = label_names or [str(i) for i in sorted(y.unique())]
        self.random_state = random_state

        # Pré-traitement
        self.scaler = StandardScaler()
        self.X_scaled = pd.DataFrame(
            self.scaler.fit_transform(X), columns=features
        )

        # Stratified K-Fold
        self.cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)

    def train_balanced(self) -> Dict[str, Any]:
        """Entraîne avec class_weight='balanced'."""
        print("\n" + "-" * 60)
        print("  Strategie A : Random Forest + class_weight='balanced'")
        print("-" * 60)

        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=self.random_state,
            n_jobs=-1,
        )

        scoring = {
            'f1_macro': 'f1_macro',
            'f1_weighted': 'f1_weighted',
            'accuracy': 'accuracy',
        }

        cv_results = cross_validate(
            rf, self.X_scaled, self.y,
            cv=self.cv, scoring=scoring, return_train_score=True
        )

        print(f"\n  Cross-validation (5 folds) :")
        print(f"    F1 macro (test)     : {cv_results['test_f1_macro'].mean():.3f} "
              f"± {cv_results['test_f1_macro'].std():.3f}")
        print(f"    F1 weighted (test)  : {cv_results['test_f1_weighted'].mean():.3f} "
              f"± {cv_results['test_f1_weighted'].std():.3f}")
        print(f"    Accuracy (test)     : {cv_results['test_accuracy'].mean():.3f} "
              f"± {cv_results['test_accuracy'].std():.3f}")

        return {
            'name': 'balanced',
            'model': rf,
            'cv_results': cv_results,
            'f1_macro_mean': cv_results['test_f1_macro'].mean(),
            'f1_macro_std': cv_results['test_f1_macro'].std(),
        }

    def train_smote(self) -> Dict[str, Any]:
        """Entraîne avec SMOTE (sur-échantillonnage)."""
        print("\n" + "-" * 60)
        print("  Strategie B : Random Forest + SMOTE (sur-echantillonnage)")
        print("-" * 60)

        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            min_samples_leaf=2,
            random_state=self.random_state,
            n_jobs=-1,
        )

        f1_smote_scores = []
        for fold, (train_idx, val_idx) in enumerate(self.cv.split(self.X_scaled, self.y)):
            X_tr, X_val = self.X_scaled.iloc[train_idx], self.X_scaled.iloc[val_idx]
            y_tr, y_val = self.y.iloc[train_idx], self.y.iloc[val_idx]

            # k_neighbors adaptatif
            min_count = y_tr.value_counts().min()
            k = max(1, min(5, min_count - 1))

            smote = SMOTE(random_state=self.random_state, k_neighbors=k)
            X_res, y_res = smote.fit_resample(X_tr, y_tr)

            rf.fit(X_res, y_res)
            y_pred = rf.predict(X_val)
            score = f1_score(y_val, y_pred, average='macro', zero_division=0)
            f1_smote_scores.append(score)

        print(f"\n  Cross-validation (5 folds) :")
        print(f"    F1 macro (test)     : {np.mean(f1_smote_scores):.3f} "
              f"± {np.std(f1_smote_scores):.3f}")

        return {
            'name': 'smote',
            'model': rf,
            'f1_scores': f1_smote_scores,
            'f1_macro_mean': np.mean(f1_smote_scores),
            'f1_macro_std': np.std(f1_smote_scores),
        }

    def optimize_hyperparameters(self) -> Dict[str, Any]:
        """Optimise les hyperparamètres avec GridSearchCV."""
        print("\n" + "-" * 60)
        print("  GridSearchCV - Optimisation des hyperparametres")
        print("-" * 60)

        param_grid = {
            'n_estimators': [100, 200, 300],
            'max_depth': [None, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'max_features': ['sqrt', 'log2'],
        }

        rf_grid = GridSearchCV(
            RandomForestClassifier(
                class_weight='balanced',
                random_state=self.random_state,
                n_jobs=-1,
            ),
            param_grid,
            cv=self.cv,
            scoring='f1_macro',
            n_jobs=-1,
            verbose=0,
        )

        rf_grid.fit(self.X_scaled, self.y)

        print(f"\n  Meilleurs paramètres : {rf_grid.best_params_}")
        print(f"  Meilleur F1 macro    : {rf_grid.best_score_:.3f}")

        return {
            'name': 'optimized',
            'model': rf_grid.best_estimator_,
            'best_params': rf_grid.best_params_,
            'best_score': rf_grid.best_score_,
            'cv_results': rf_grid.cv_results_,
        }

    def evaluate_best_model(self, best_model) -> Dict[str, Any]:
        """Évalue le meilleur modèle sur tout le dataset."""
        print("\n" + "-" * 60)
        print("  Rapport detaille (meilleur modele - entrainement complet)")
        print("-" * 60)

        best_model.fit(self.X_scaled, self.y)
        y_pred = best_model.predict(self.X_scaled)

        print("\n" + classification_report(
            self.y, y_pred,
            target_names=self.label_names,
            zero_division=0
        ))

        importances = pd.Series(
            best_model.feature_importances_, index=self.features
        ).sort_values(ascending=False)

        print("  Importance des features :")
        for feat, imp in importances.items():
            bar = "█" * int(imp * 50)
            print(f"    {feat:22s} {bar} {imp:.4f}")

        return {
            'model': best_model,
            'y_pred': y_pred,
            'importances': importances,
            'confusion_matrix': confusion_matrix(self.y, y_pred),
        }

    def generate_visualizations(
        self,
        cv_results_balanced: Dict,
        f1_smote_scores: list,
        best_model,
        best_params: Dict,
        output_path: Path | str = "risk_rf_analysis.png",
    ) -> None:
        """Génère les 5 graphiques d'analyse."""
        print("\n" + "-" * 60)
        print("  Generation des visualisations")
        print("-" * 60)

        best_model.fit(self.X_scaled, self.y)
        y_pred_all = best_model.predict(self.X_scaled)
        importances = pd.Series(
            best_model.feature_importances_, index=self.features
        ).sort_values(ascending=False)

        fig = plt.figure(figsize=(16, 12))
        fig.patch.set_facecolor('#f8f8f6')
        gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.42, wspace=0.38)

        palette = {'Low': '#3B8BD4', 'Medium': '#EF9F27', 'High': '#E24B4A'}
        colors_feat = ['#534AB7', '#3B8BD4', '#1D9E75', '#D85A30',
                       '#D4537E', '#639922', '#BA7517', '#A32D2D',
                       '#888780', '#0F6E56']

        # 1. Distribution des classes
        ax0 = fig.add_subplot(gs[0, 0])
        y_unique = self.y.unique()
        counts = pd.Series(self.y).value_counts().reindex(y_unique)
        label_list = [self.label_names[int(i)] for i in y_unique]
        colors = [palette.get(l, '#999999') for l in label_list]
        bars = ax0.bar(label_list, counts.values, color=colors,
                       width=0.55, edgecolor='white', linewidth=1.2)
        for bar, val in zip(bars, counts.values):
            ax0.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                     str(val), ha='center', va='bottom', fontsize=11, fontweight='500')
        ax0.set_title('Distribution des classes', fontsize=12, fontweight='500', pad=10)
        ax0.set_ylabel('Nombre d\'indicateurs', fontsize=10)
        ax0.set_facecolor('#f8f8f6')
        ax0.spines[['top', 'right']].set_visible(False)
        ax0.set_ylim(0, counts.max() + 10)

        # 2. Importance des features
        ax1 = fig.add_subplot(gs[0, 1:])
        y_pos = range(len(importances))
        hbars = ax1.barh(list(y_pos), importances.values,
                         color=colors_feat[:len(importances)], alpha=0.88, edgecolor='white')
        ax1.set_yticks(list(y_pos))
        ax1.set_yticklabels(importances.index, fontsize=10)
        ax1.invert_yaxis()
        for bar, val in zip(hbars, importances.values):
            ax1.text(val + 0.002, bar.get_y() + bar.get_height()/2,
                     f'{val:.3f}', va='center', fontsize=9)
        ax1.set_title('Importance des features (Random Forest)', fontsize=12, fontweight='500', pad=10)
        ax1.set_xlabel('Importance (Gini)', fontsize=10)
        ax1.set_facecolor('#f8f8f6')
        ax1.spines[['top', 'right']].set_visible(False)

        # 3. Matrice de confusion
        ax2 = fig.add_subplot(gs[1, 0])
        cm = confusion_matrix(self.y, y_pred_all)
        disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=self.label_names)
        disp.plot(ax=ax2, colorbar=False, cmap='Blues')
        ax2.set_title('Matrice de confusion\n(entraînement complet)', fontsize=12, fontweight='500', pad=10)
        ax2.set_facecolor('#f8f8f6')

        # 4. F1 scores par fold
        ax3 = fig.add_subplot(gs[1, 1])
        folds = [f'Fold {i+1}' for i in range(5)]
        f1_balanced_folds = cv_results_balanced['test_f1_macro']
        x = np.arange(5)
        w = 0.35
        ax3.bar(x - w/2, f1_balanced_folds, width=w, label='class_weight balanced',
                color='#534AB7', alpha=0.85, edgecolor='white')
        ax3.bar(x + w/2, f1_smote_scores, width=w, label='SMOTE',
                color='#1D9E75', alpha=0.85, edgecolor='white')
        ax3.set_xticks(x)
        ax3.set_xticklabels(folds, fontsize=9)
        ax3.set_ylabel('F1 macro', fontsize=10)
        ax3.set_title('F1 macro par fold\nBalanced vs SMOTE', fontsize=12, fontweight='500', pad=10)
        ax3.legend(fontsize=9)
        ax3.set_ylim(0, 1)
        ax3.set_facecolor('#f8f8f6')
        ax3.spines[['top', 'right']].set_visible(False)
        ax3.axhline(np.mean(f1_balanced_folds), color='#534AB7', linestyle='--', alpha=0.5, linewidth=1)
        ax3.axhline(np.mean(f1_smote_scores), color='#1D9E75', linestyle='--', alpha=0.5, linewidth=1)

        # 5. Résumé des métriques
        ax4 = fig.add_subplot(gs[1, 2])
        ax4.axis('off')
        metrics_data = [
            ['Métrique', 'Balanced', 'SMOTE'],
            ['F1 macro (moy)', f"{cv_results_balanced['test_f1_macro'].mean():.3f}",
             f"{np.mean(f1_smote_scores):.3f}"],
            ['F1 macro (std)', f"±{cv_results_balanced['test_f1_macro'].std():.3f}",
             f"±{np.std(f1_smote_scores):.3f}"],
            ['F1 weighted', f"{cv_results_balanced['test_f1_weighted'].mean():.3f}", '—'],
            ['Accuracy', f"{cv_results_balanced['test_accuracy'].mean():.3f}", '—'],
            ['Meilleur n_est.', str(best_params['n_estimators']), '—'],
            ['Meilleur depth', str(best_params['max_depth']), '—'],
        ]
        tbl = ax4.table(cellText=metrics_data[1:], colLabels=metrics_data[0],
                        loc='center', cellLoc='center')
        tbl.auto_set_font_size(False)
        tbl.set_fontsize(10)
        tbl.scale(1.2, 1.7)
        for (row, col), cell in tbl.get_celld().items():
            cell.set_edgecolor('#cccccc')
            if row == 0:
                cell.set_facecolor('#534AB7')
                cell.set_text_props(color='white', fontweight='bold')
            elif row % 2 == 0:
                cell.set_facecolor('#f0eff8')
            else:
                cell.set_facecolor('white')
        ax4.set_title('Récapitulatif des métriques', fontsize=12, fontweight='500', pad=10)

        fig.suptitle('Random Forest — Classification du Risque', fontsize=15, fontweight='500', y=1.01)
        plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#f8f8f6')
        plt.close()
        print(f"\n[OK] Graphique sauvegarde : {output_path}")
