"""
Random Forest - Classification du Risque (Multi-classe)
======================================================
Dataset: risk_label_candidates.csv (83 lignes)
Cible  : suggested_risk_level.1 (Low / Medium / High) - ANALYSE MULTI-CLASSE

Ce script entraîne et compare plusieurs stratégies d'équilibrage:
- Stratégie A: class_weight='balanced'
- Stratégie B: SMOTE (sur-échantillonnage)
- Optimisation des hyperparamètres
"""

from __future__ import annotations

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from pathlib import Path
from ml.models.rf_strategies import RandomForestStrategies

# =========================================================================
# 1. CHARGEMENT & NETTOYAGE
# =========================================================================
print("=" * 60)
print("  PIPELINE RANDOM FOREST - CLASSIFICATION DU RISQUE")
print("=" * 60)

# Chemin portable
ARTIFACT_DIR = Path(__file__).parent.parent / "artifacts"
CSV_PATH = ARTIFACT_DIR / "risk_label_candidates.csv"

if not CSV_PATH.exists():
    raise FileNotFoundError(
        f"Dataset non trouvé : {CSV_PATH}\n"
        "Véifiez que ml/artifacts/risk_label_candidates.csv existe."
    )

df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip()

FEATURES = [
    'performance_gap', 'anomaly_rate', 'volatility', 'data_completeness',
    'action_density', 'negative_gap_ratio', 'abs_gap_mean', 'gap_std',
    'monthly_observations', 'actions_count'
]

TARGET_MULTI  = 'suggested_risk_level.1'  # Low / Medium / High
TARGET_BINARY = 'suggested_risk_label.1'  # 0 / 1

df[TARGET_MULTI] = df[TARGET_MULTI].str.strip()

X = df[FEATURES].copy()
y_multi  = df[TARGET_MULTI].copy()
y_binary = df[TARGET_BINARY].copy()

print(f"\n[OK] Dataset : {X.shape[0]} lignes x {X.shape[1]} features")
print(f"   Distribution multi-classe :")
for cls, cnt in y_multi.value_counts().items():
    print(f"     {cls:8s}: {cnt:3d} ({cnt/len(y_multi)*100:.0f}%)")

# =========================================================================
# 2. ENCODAGE & PREPARATION
# =========================================================================

# Encodage ordinal pour conserver l'ordre Low < Medium < High
label_order = {'Low': 0, 'Medium': 1, 'High': 2}
y_encoded = y_multi.map(label_order)
label_names = ['Low', 'Medium', 'High']

# =========================================================================
# 3. STRATEGIES D'ENTRAINEMENT
# =========================================================================

# Initialiser le gestionnaire de stratégies
strategies = RandomForestStrategies(
    X=X,
    y=y_encoded,
    features=FEATURES,
    label_names=label_names,
    random_state=42
)

# Entraîner les deux stratégies
result_balanced = strategies.train_balanced()
result_smote = strategies.train_smote()

# Optimiser les hyperparamètres
result_optimized = strategies.optimize_hyperparameters()

# Évaluer le meilleur modèle
best_model = result_optimized['model']
eval_results = strategies.evaluate_best_model(best_model)

# =========================================================================
# 4. VISUALISATIONS
# =========================================================================

output_path = ARTIFACT_DIR / "risk_rf_analysis.png"

strategies.generate_visualizations(
    cv_results_balanced=result_balanced['cv_results'],
    f1_smote_scores=result_smote['f1_scores'],
    best_model=best_model,
    best_params=result_optimized['best_params'],
    output_path=output_path
)

# =========================================================================
# 5. RESUME FINAL
# =========================================================================

print("\n" + "=" * 60)
print("  RÉSUMÉ DE L'ANALYSE COMPARATIVE")
print("=" * 60)

f1_balanced = result_balanced['f1_macro_mean']
f1_smote = result_smote['f1_macro_mean']
winner = "BALANCED" if f1_balanced >= f1_smote else "SMOTE"

print(f"\n  Balanced: F1 = {f1_balanced:.3f} ± {result_balanced['f1_macro_std']:.3f}")
print(f"  SMOTE    : F1 = {f1_smote:.3f} ± {result_smote['f1_macro_std']:.3f}")
print(f"\n  [BEST] Meilleure strategie: {winner}")
print(f"  [BEST] Hyperparametres optimises: {result_optimized['best_params']}")
print(f"  [BEST] Visualisations: {output_path}")

print("\n" + "=" * 60)
print("  Pipeline termine avec succes [OK]")
print("=" * 60)


