import pyodbc
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import SVC
from sklearn.metrics import (mean_squared_error, mean_absolute_error, r2_score,
                             classification_report, roc_auc_score, f1_score)
from xgboost import XGBRegressor, XGBClassifier
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# CHARGEMENT
# ============================================================

# Connexion SQL Server
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=127.0.0.1\\SQLEXPRESS02;"
    "DATABASE=KPI_DataWarehouse;"
    "UID=sa;"
    "PWD=rayen123;"
)

# Query
query = """
SELECT 
    DI.IndicateurNom AS Indicateur,
    DT.Annee,
    DT.Mois AS MoisNum,
    FA.ValeurRealisee,
    FA.ValeurObjectif,
    FA.Ecart
FROM [KPI_DataWarehouse].[dbo].[FACT_Realisation] FA

LEFT JOIN [KPI_DataWarehouse].[dbo].[DIM_Indicateur] DI
    ON FA.IndicateurKey = DI.IndicateurKey

LEFT JOIN [KPI_DataWarehouse].[dbo].[DIM_Temps] DT
    ON FA.DateKey = DT.DateKey;
"""

# Lire résultats
df = pd.read_sql(query, conn)
"""
df['Indicateur'] = df['Indicateur'].str.strip()
print(f"Dataset : {df.shape}")

# ============================================================
# FEATURE ENGINEERING (commun aux 4 pipelines)
# ============================================================
df = df.sort_values(['Indicateur', 'Annee', 'Mois']).reset_index(drop=True)

# Taux de réalisation
df['taux_realisation'] = (df['Realisation'] / df['Objectif'].replace(0, np.nan) * 100).round(2)

# Features temporelles lag par indicateur
df['lag_1']        = df.groupby('Indicateur')['Realisation'].shift(1)
df['lag_2']        = df.groupby('Indicateur')['Realisation'].shift(2)
df['lag_3']        = df.groupby('Indicateur')['Realisation'].shift(3)
df['rolling_mean'] = df.groupby('Indicateur')['Realisation'].transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
df['rolling_std']  = df.groupby('Indicateur')['Realisation'].transform(lambda x: x.shift(1).rolling(3, min_periods=1).std().fillna(0))
df['tendance']     = df['lag_1'] - df['lag_2']  # direction du mois précédent

# Encoder Indicateur
le = LabelEncoder()
df['indicateur_enc'] = le.fit_transform(df['Indicateur'])

# Supprimer les lignes sans lag
df_ml = df.dropna(subset=['lag_1', 'lag_2', 'lag_3']).copy()
print(f"Dataset ML (après lags) : {df_ml.shape}")

FEATURES = ['indicateur_enc', 'Annee', 'Mois', 'Objectif',
            'lag_1', 'lag_2', 'lag_3', 'rolling_mean', 'rolling_std', 'tendance']

# ============================================================
# PIPELINE 1 — RÉGRESSION : prédire Realisation mois suivant
# ============================================================
print("\n" + "="*60)
print("PIPELINE 1 — RÉGRESSION")
print("="*60)

X_reg = df_ml[FEATURES]
y_reg = df_ml['Realisation']

X_tr, X_te, y_tr, y_te = train_test_split(X_reg, y_reg, test_size=0.2, random_state=42)

modeles_reg = {
    'LinearRegression' : LinearRegression(),
    'RandomForest'     : RandomForestRegressor(n_estimators=100, random_state=42),
    'XGBoost'          : XGBRegressor(n_estimators=100, random_state=42, verbosity=0),
}

resultats_reg = {}
for nom, modele in modeles_reg.items():
    modele.fit(X_tr, y_tr)
    pred = modele.predict(X_te)
    resultats_reg[nom] = {
        'RMSE' : round(np.sqrt(mean_squared_error(y_te, pred)), 2),
        'MAE'  : round(mean_absolute_error(y_te, pred), 2),
        'R²'   : round(r2_score(y_te, pred), 3),
    }

df_reg = pd.DataFrame(resultats_reg).T.sort_values('RMSE')
print(df_reg)
meilleur_reg = df_reg.index[0]
print(f"\nMeilleur modèle régression : {meilleur_reg}")

# ============================================================
# PIPELINE 2 — CLASSIFICATION : atteint / non atteint
# ============================================================
print("\n" + "="*60)
print("PIPELINE 2 — CLASSIFICATION")
print("="*60)

df_ml['atteint'] = (df_ml['Realisation'] >= df_ml['Objectif']).astype(int)
print(f"Répartition : {df_ml['atteint'].value_counts().to_dict()}")

X_clf = df_ml[FEATURES]
y_clf = df_ml['atteint']

X_tr, X_te, y_tr, y_te = train_test_split(X_clf, y_clf, test_size=0.2,
                                            random_state=42, stratify=y_clf)
scaler = StandardScaler()
X_tr_sc = scaler.fit_transform(X_tr)
X_te_sc = scaler.transform(X_te)

modeles_clf = {
    'LogisticRegression' : LogisticRegression(max_iter=1000, random_state=42),
    'RandomForest'       : RandomForestClassifier(n_estimators=100, random_state=42),
    'XGBoost'            : XGBClassifier(n_estimators=100, random_state=42, verbosity=0),
    'SVM'                : SVC(probability=True, random_state=42),
}

resultats_clf = {}
for nom, modele in modeles_clf.items():
    X_fit = X_tr_sc if nom in ['LogisticRegression', 'SVM'] else X_tr
    X_eval = X_te_sc if nom in ['LogisticRegression', 'SVM'] else X_te
    modele.fit(X_fit, y_tr)
    pred      = modele.predict(X_eval)
    pred_prob = modele.predict_proba(X_eval)[:, 1]
    resultats_clf[nom] = {
        'F1'     : round(f1_score(y_te, pred), 3),
        'AUC'    : round(roc_auc_score(y_te, pred_prob), 3),
        'Recall' : round(f1_score(y_te, pred, average='weighted'), 3),
    }

df_clf = pd.DataFrame(resultats_clf).T.sort_values('AUC', ascending=False)
print(df_clf)
meilleur_clf = df_clf.index[0]
print(f"\nMeilleur modèle classification : {meilleur_clf}")

# ============================================================
# PIPELINE 3 — RISQUE : KPI en danger le mois prochain
# ============================================================
print("\n" + "="*60)
print("PIPELINE 3 — DÉTECTION DE RISQUE")
print("="*60)

# KPI "à risque" = taux_realisation < 80% sur les 3 derniers mois
df_ml['risque'] = (df_ml['taux_realisation'] < 80).astype(int)
print(f"KPIs à risque : {df_ml['risque'].value_counts().to_dict()}")

X_risk = df_ml[FEATURES]
y_risk = df_ml['risque']

X_tr, X_te, y_tr, y_te = train_test_split(X_risk, y_risk, test_size=0.2,
                                            random_state=42, stratify=y_risk)

modele_risk = XGBClassifier(n_estimators=100, random_state=42, verbosity=0,
                             scale_pos_weight=(y_tr==0).sum()/(y_tr==1).sum())
modele_risk.fit(X_tr, y_tr)

pred_risk = modele_risk.predict(X_te)
prob_risk = modele_risk.predict_proba(X_te)[:, 1]

print(classification_report(y_te, pred_risk, target_names=['OK', 'Risque']))
print(f"AUC Risque : {roc_auc_score(y_te, prob_risk):.3f}")

# Top KPIs les plus à risque
df_ml['score_risque'] = modele_risk.predict_proba(X_risk)[:, 1]
top_risque = (df_ml[df_ml['Annee'] == df_ml['Annee'].max()]
              .groupby('Indicateur')['score_risque'].mean()
              .sort_values(ascending=False).head(10))
print("\nTop 10 indicateurs les plus à risque :")
print(top_risque.round(3))

# ============================================================
# PIPELINE 4 — ANOMALIES : détection non supervisée
# ============================================================
print("\n" + "="*60)
print("PIPELINE 4 — DÉTECTION D'ANOMALIES")
print("="*60)

X_ano = df_ml[['Objectif', 'Realisation', 'Ecart', 'taux_realisation',
                'lag_1', 'rolling_mean', 'rolling_std']].fillna(0)

scaler_ano = StandardScaler()
X_ano_sc = scaler_ano.fit_transform(X_ano)

# Isolation Forest
iso = IsolationForest(contamination=0.05, random_state=42)
df_ml['anomalie_iso'] = iso.fit_predict(X_ano_sc)
df_ml['anomalie_iso'] = (df_ml['anomalie_iso'] == -1).astype(int)

# Local Outlier Factor
lof = LocalOutlierFactor(n_neighbors=20, contamination=0.05)
df_ml['anomalie_lof'] = lof.fit_predict(X_ano_sc)
df_ml['anomalie_lof'] = (df_ml['anomalie_lof'] == -1).astype(int)

# Vote majoritaire
df_ml['anomalie_finale'] = ((df_ml['anomalie_iso'] + df_ml['anomalie_lof']) >= 1).astype(int)

print(f"Anomalies IsolationForest : {df_ml['anomalie_iso'].sum()}")
print(f"Anomalies LOF             : {df_ml['anomalie_lof'].sum()}")
print(f"Anomalies consensus       : {df_ml['anomalie_finale'].sum()}")

anomalies = df_ml[df_ml['anomalie_finale'] == 1][
    ['Indicateur', 'Annee', 'Mois', 'Objectif', 'Realisation', 'Ecart']
].sort_values('Ecart')
print("\nÉchantillon anomalies détectées :")
print(anomalies.head(10))

# ============================================================
# RAPPORT FINAL
# ============================================================
print("\n" + "="*60)
print("RAPPORT COMPARATIF FINAL")
print("="*60)

print("\n[1] Régression — meilleur modèle :", meilleur_clf)
print(df_reg)
print("\n[2] Classification — meilleur modèle :", meilleur_clf)
print(df_clf)
print("\n[3] Score risque moyen top 10 indicateurs :")
print(top_risque)
print(f"\n[4] Anomalies détectées : {df_ml['anomalie_finale'].sum()} lignes sur {len(df_ml)}")

# Sauvegarder résultats
df_ml.to_csv("kpi_dataset_ml.csv", index=False)
print("\n✓ Résultats sauvegardés : kpi_dataset_ml.csv")

"""
#affichage 
print(df.head(10))
print(df.describe())
print(df.info())
# Fermer connexion
conn.close()