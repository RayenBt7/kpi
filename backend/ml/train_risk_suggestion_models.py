import json
import os
import pickle
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")),
)
DATASET_PATH = os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv")
RISK_MODEL_PATH = os.path.join(BASE_MODELS, "risk_level_classifier.pkl")
SUGGESTION_MODEL_PATH = os.path.join(BASE_MODELS, "suggestion_classifier.pkl")
METADATA_PATH = os.path.join(BASE_MODELS, "risk_suggestion_model_metadata.json")

FEATURES = [
    "processus_enc",
    "indicateur_enc",
    "signe_enc",
    "unite_enc",
    "Annee",
    "Mois",
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
    "performance_gap",
    "volatility_signal",
    "anomaly_signal",
]


def to_numeric(df, columns):
    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def encode_text_column(df, source_column, encoded_column):
    if source_column not in df.columns:
        df[encoded_column] = 0
        return df

    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {value: index for index, value in enumerate(sorted(values.unique()))}
    df[encoded_column] = values.map(codes).fillna(0).astype(int)
    return df


def compute_risk_score(row):
    performance_gap = max(0.0, -float(row.get("performance_gap") or 0))
    volatility = min(1.0, abs(float(row.get("volatility_signal") or 0)))
    anomaly = min(1.0, abs(float(row.get("anomaly_signal") or 0)))
    open_actions = min(1.0, float(row.get("plan_action_open_count") or 0) * 0.03)
    late_actions = min(1.0, float(row.get("plan_action_late_count") or 0) * 0.05)
    return min(1.0, max(0.0, performance_gap + (volatility * 0.35) + (anomaly * 0.25) + open_actions + late_actions))


def risk_label(score):
    if score >= 0.7:
        return "High"
    if score >= 0.4:
        return "Medium"
    return "Low"


def suggestion_category(row):
    if float(row.get("plan_action_late_count") or 0) > 0:
        return "late_actions"
    if float(row.get("anomaly_signal") or 0) >= 1:
        return "anomaly_detected"
    if abs(float(row.get("volatility_signal") or 0)) >= 0.25:
        return "high_volatility"
    if float(row.get("performance_gap") or 0) <= -0.15:
        return "performance_gap"
    if pd.isna(row.get("Realisation")):
        return "missing_realisation"
    return "normal_followup"


def prepare_dataset():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset introuvable: {DATASET_PATH}. Lancez d'abord le job ETL.")

    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]

    required = ["Indicateur", "Objectif", "Realisation"]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Dataset ML invalide: colonnes manquantes: {', '.join(missing)}")

    numeric_columns = [
        "Annee",
        "Mois",
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
        "indicateur_enc",
    ]
    df = to_numeric(df, numeric_columns)
    df["Indicateur"] = df["Indicateur"].fillna("").astype(str).str.strip()
    df = df[df["Indicateur"] != ""].copy()

    if "indicateur_enc" not in df.columns or df["indicateur_enc"].isna().all():
        codes = {value: index for index, value in enumerate(sorted(df["Indicateur"].unique()))}
        df["indicateur_enc"] = df["Indicateur"].map(codes).fillna(0).astype(int)

    df = encode_text_column(df, "Processus", "processus_enc")
    df = encode_text_column(df, "Signe", "signe_enc")
    df = encode_text_column(df, "Unite", "unite_enc")

    if "Ecart" not in df.columns:
        df["Ecart"] = df["Realisation"] - df["Objectif"]

    df["performance_gap"] = np.where(
        df["Objectif"].replace(0, np.nan).notna(),
        df["Ecart"] / df["Objectif"].abs().replace(0, np.nan),
        0,
    )
    df["performance_gap"] = pd.to_numeric(df["performance_gap"], errors="coerce").fillna(0)
    df["volatility_signal"] = (
        pd.to_numeric(df.get("rolling_std", 0), errors="coerce").fillna(0)
        / pd.to_numeric(df.get("rolling_mean", 0), errors="coerce").abs().replace(0, np.nan)
    ).replace([np.inf, -np.inf], np.nan).fillna(0)
    df["anomaly_signal"] = (df["performance_gap"].abs() >= 0.3).astype(int)

    for feature in FEATURES:
        if feature not in df.columns:
            df[feature] = 0

    df[FEATURES] = df[FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)
    df["risk_score_label"] = df.apply(compute_risk_score, axis=1)
    df["risk_level_label"] = df["risk_score_label"].map(risk_label)
    df["suggestion_category_label"] = df.apply(suggestion_category, axis=1)
    return df


def fit_classifier(df, target_column):
    y = df[target_column].astype(str)
    stratify = y if y.nunique() > 1 and y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        df[FEATURES],
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )
    model = RandomForestClassifier(n_estimators=220, random_state=42, min_samples_leaf=2)
    model.fit(X_train, y_train)
    accuracy = accuracy_score(y_test, model.predict(X_test)) if len(y_test) else None
    return model, accuracy


def main():
    df = prepare_dataset()
    if len(df) < 8:
        raise ValueError("Dataset ML insuffisant pour entrainer les modeles risk/suggestion.")

    risk_model, risk_accuracy = fit_classifier(df, "risk_level_label")
    suggestion_model, suggestion_accuracy = fit_classifier(df, "suggestion_category_label")

    version = datetime.now().strftime("%Y%m%d%H%M")
    os.makedirs(BASE_MODELS, exist_ok=True)
    with open(RISK_MODEL_PATH, "wb") as file:
        pickle.dump(risk_model, file)
    with open(SUGGESTION_MODEL_PATH, "wb") as file:
        pickle.dump(suggestion_model, file)

    metadata = {
        "version": version,
        "version_path": BASE_MODELS,
        "rows_processed": int(len(df)),
        "features": FEATURES,
        "metrics": {
            "risk_level_accuracy": None if risk_accuracy is None else float(risk_accuracy),
            "suggestion_accuracy": None if suggestion_accuracy is None else float(suggestion_accuracy),
        },
        "labels": {
            "risk_level": sorted(df["risk_level_label"].unique().tolist()),
            "suggestion_category": sorted(df["suggestion_category_label"].unique().tolist()),
        },
        "models": {
            "risk_level_classifier": RISK_MODEL_PATH,
            "suggestion_classifier": SUGGESTION_MODEL_PATH,
        },
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)

    print(json.dumps(metadata))


if __name__ == "__main__":
    main()
