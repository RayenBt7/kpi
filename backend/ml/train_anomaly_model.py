import json
import os
import pickle
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")),
)
DATASET_PATH = os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv")
MODEL_PATH = os.path.join(BASE_MODELS, "anomaly_isolation_forest.pkl")
METADATA_PATH = os.path.join(BASE_MODELS, "anomaly_model_metadata.json")

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


def encode_column(df, source_column, encoded_column):
    if source_column not in df.columns:
        df[encoded_column] = 0
        return df
    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {value: index for index, value in enumerate(sorted(values.unique()))}
    df[encoded_column] = values.map(codes).fillna(0)
    return df


def main():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset introuvable: {DATASET_PATH}. Lancez d'abord le job ETL."
        )

    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]

    df = encode_column(df, "Processus", "processus_enc")
    df = encode_column(df, "Signe", "signe_enc")
    df = encode_column(df, "Unite", "unite_enc")

    for feature in ANOMALY_FEATURES:
        if feature not in df.columns:
            df[feature] = 0
        df[feature] = pd.to_numeric(df[feature], errors="coerce")

    X = df[ANOMALY_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)
    if len(X) < 10:
        raise ValueError("Dataset ML insuffisant pour entrainer le modele anomalies.")

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("model", IsolationForest(n_estimators=200, contamination=0.05, random_state=42)),
    ])
    model.fit(X)

    os.makedirs(BASE_MODELS, exist_ok=True)
    with open(MODEL_PATH, "wb") as file:
        pickle.dump(model, file)

    scores = -model.decision_function(X)
    predictions = model.predict(X)
    metadata = {
        "version": datetime.now().strftime("%Y%m%d%H%M"),
        "model_name": "anomaly_isolation_forest",
        "model_path": MODEL_PATH,
        "rows_processed": int(len(X)),
        "features": ANOMALY_FEATURES,
        "contamination": 0.05,
        "anomalies_detected": int((predictions == -1).sum()),
        "score_min": float(scores.min()),
        "score_max": float(scores.max()),
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)

    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
