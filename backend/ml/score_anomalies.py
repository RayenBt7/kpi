import json
import os
import pickle
import sys

import numpy as np
import pandas as pd


BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")),
)
DATASET_PATH = os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv")
MODEL_PATH = os.path.join(BASE_MODELS, "anomaly_isolation_forest.pkl")

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
        raise FileNotFoundError(f"Dataset introuvable: {DATASET_PATH}")
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Modele anomalies introuvable: {MODEL_PATH}")

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

    with open(MODEL_PATH, "rb") as file:
        model = pickle.load(file)

    predictions = model.predict(X)
    scores = -model.decision_function(X)
    result = [
        {
            "row_index": int(index),
            "is_anomaly": int(prediction == -1),
            "anomaly_score": float(score),
        }
        for index, (prediction, score) in enumerate(zip(predictions, scores))
    ]
    print(json.dumps({"rows": result}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
