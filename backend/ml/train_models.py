import json
import os
import pickle
from datetime import datetime

import numpy as np

try:
    import pandas as pd
except ModuleNotFoundError as e:
    # Make the failure mode explicit for the Node parent process.
    import sys
    msg = (
        "Failed to import pandas. "
        f"python_executable={sys.executable}. "
        f"error={e}. "
        "Fix: ensure the training runs with the correct .venv Python and reinstall pandas/pyarrow."
    )
    raise ModuleNotFoundError(msg) from e

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.ensemble import IsolationForest
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")),
)
DATASET_PATH = os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv")
REG_PATH = os.path.join(BASE_MODELS, "random_forest_regressor.pkl")
CLF_PATH = os.path.join(BASE_MODELS, "random_forest_classifier.pkl")
ANOMALY_PATH = os.path.join(BASE_MODELS, "anomaly_isolation_forest.pkl")
METADATA_PATH = os.path.join(BASE_MODELS, "model_metadata.json")

FEATURES = [
    "indicateur_enc",
    "signe_enc",
    "unite_enc",
    "Annee",
    "Mois",
    "Objectif",
    "lag_1",
    "lag_2",
    "lag_3",
    "rolling_mean",
    "rolling_std",
    "tendance",
]

ANOMALY_FEATURES = [
    "processus_enc",
    "signe_enc",
    "unite_enc",
    "Objectif",
    "Realisation",
    "Ecart",
    "taux_realisation",
    "lag_1",
    "lag_2",
    "lag_3",
    "rolling_mean",
    "rolling_std",
    "tendance",
    "plan_action_open_count",
    "plan_action_late_count",
]


def to_numeric(df, columns):
    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def main():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset introuvable: {DATASET_PATH}. Lancez d'abord le job ETL."
        )

    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]

    if "Indicateur" not in df.columns or "Realisation" not in df.columns:
        raise ValueError("Dataset ML invalide: colonnes Indicateur/Realisation manquantes.")

    df["Indicateur"] = df["Indicateur"].astype(str).str.strip()
    df = to_numeric(df, FEATURES + ["Realisation", "is_conforme"])
    df = df.dropna(subset=["Indicateur", "Realisation", "Objectif"])

    if "indicateur_enc" not in df.columns or df["indicateur_enc"].isna().all():
        codes = {code: index for index, code in enumerate(sorted(df["Indicateur"].dropna().unique()))}
        df["indicateur_enc"] = df["Indicateur"].map(codes)

    for source_column, encoded_column in [("Signe", "signe_enc"), ("Unite", "unite_enc")]:
        if source_column in df.columns:
            values = df[source_column].fillna("").astype(str).str.strip()
            codes = {value: index for index, value in enumerate(sorted(values.unique()))}
            df[encoded_column] = values.map(codes).fillna(0)
        else:
            df[encoded_column] = 0

    if "Processus" in df.columns:
        values = df["Processus"].fillna("").astype(str).str.strip()
        codes = {value: index for index, value in enumerate(sorted(values.unique()))}
        df["processus_enc"] = values.map(codes).fillna(0)
    else:
        df["processus_enc"] = 0

    for feature in FEATURES:
        if feature not in df.columns:
            df[feature] = 0

    for feature in ANOMALY_FEATURES:
        if feature not in df.columns:
            df[feature] = 0

    df[FEATURES] = df[FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)
    df[ANOMALY_FEATURES] = df[ANOMALY_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)
    y_reg = df["Realisation"].astype(float)

    if "is_conforme" in df.columns and not df["is_conforme"].isna().all():
        y_clf = df["is_conforme"].fillna(0).astype(int)
    else:
        y_clf = (df["Realisation"].astype(float) >= df["Objectif"].astype(float)).astype(int)

    if len(df) < 4:
        raise ValueError("Dataset ML insuffisant pour entrainer les modeles.")

    stratify = y_clf if y_clf.nunique() > 1 and y_clf.value_counts().min() >= 2 else None
    X_train, X_test, y_reg_train, y_reg_test, y_clf_train, y_clf_test = train_test_split(
        df[FEATURES],
        y_reg,
        y_clf,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    reg = RandomForestRegressor(n_estimators=180, random_state=42, min_samples_leaf=2)
    reg.fit(X_train, y_reg_train)

    clf = RandomForestClassifier(n_estimators=180, random_state=42, min_samples_leaf=2)
    clf.fit(X_train, y_clf_train)

    anomaly_model = Pipeline([
        ("scaler", StandardScaler()),
        ("model", IsolationForest(n_estimators=200, contamination=0.05, random_state=42)),
    ])
    anomaly_model.fit(df[ANOMALY_FEATURES])

    os.makedirs(BASE_MODELS, exist_ok=True)
    with open(REG_PATH, "wb") as file:
        pickle.dump(reg, file)
    with open(CLF_PATH, "wb") as file:
        pickle.dump(clf, file)
    with open(ANOMALY_PATH, "wb") as file:
        pickle.dump(anomaly_model, file)

    reg_pred = reg.predict(X_test)
    clf_pred = clf.predict(X_test)
    version = datetime.now().strftime("%Y%m%d%H%M")
    metrics = {
        "regression_mae": float(mean_absolute_error(y_reg_test, reg_pred)),
        "regression_r2": float(r2_score(y_reg_test, reg_pred)) if len(y_reg_test) > 1 else None,
        "classification_accuracy": float(accuracy_score(y_clf_test, clf_pred)),
    }
    metadata = {
        "version": version,
        "version_path": BASE_MODELS,
        "rows_processed": int(len(df)),
        "features": FEATURES,
        "anomaly_features": ANOMALY_FEATURES,
        "metrics": metrics,
        "models": {
            "random_forest_regressor": REG_PATH,
            "random_forest_classifier": CLF_PATH,
            "anomaly_isolation_forest": ANOMALY_PATH,
        },
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)

    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
