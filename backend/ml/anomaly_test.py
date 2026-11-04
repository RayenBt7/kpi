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


def to_number(value, default=None):
    if value is None or value == "":
        return default
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return default


def normalize_sign(value):
    raw = str(value or "").strip()
    compact = raw.replace(" ", "").lower()
    if compact in {">=", "=>", "≥", "â‰¥", "supp"}:
        return ">="
    if compact in {"<=", "=<", "≤", "â‰¤", "inf"}:
        return "<="
    if compact in {"!=", "<>", "≠", "â‰ "}:
        return "!="
    if compact in {">", "<", "="}:
        return compact
    return raw


def is_conforme(realisation, objectif, signe):
    sign = normalize_sign(signe)
    if sign == ">=":
        return realisation >= objectif
    if sign == ">":
        return realisation > objectif
    if sign == "<=":
        return realisation <= objectif
    if sign == "<":
        return realisation < objectif
    if sign == "=":
        return abs(realisation - objectif) <= 0.0001
    if sign == "!=":
        return abs(realisation - objectif) > 0.0001
    return realisation >= objectif


def build_interpretation(realisation, objectif, signe, conforms):
    sign = normalize_sign(signe)
    direction = "conforme" if conforms else "non conforme"
    if sign in {">=", ">"}:
        relation = "superieure" if realisation >= objectif else "inferieure"
        return f"Realisation {relation} a l'objectif pour un indicateur attendu {sign} objectif: {direction}."
    if sign in {"<=", "<"}:
        relation = "inferieure" if realisation <= objectif else "superieure"
        return f"Realisation {relation} a l'objectif pour un indicateur attendu {sign} objectif: {direction}."
    if sign == "=":
        return f"Realisation comparee a l'objectif avec une contrainte d'egalite: {direction}."
    if sign == "!=":
        return f"Realisation comparee a l'objectif avec une contrainte de difference: {direction}."
    return f"Realisation interpretee avec le signe '{signe}': {direction}."


def encode_value(df, source_column, value):
    if source_column not in df.columns:
        return 0
    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {item: index for index, item in enumerate(sorted(values.unique()))}
    return int(codes.get(str(value or "").strip(), 0))


def latest_text_value(rows, column, fallback=""):
    if rows.empty or column not in rows.columns:
        return fallback
    values = rows[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    return values.iloc[-1] if not values.empty else fallback


def main():
    if len(sys.argv) < 2:
        raise ValueError("Payload JSON manquant.")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset introuvable: {DATASET_PATH}")
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Modele anomalies introuvable: {MODEL_PATH}")

    payload = json.loads(sys.argv[1])
    indicateur = str(payload.get("indicateur") or "").strip()
    objectif = to_number(payload.get("objectif"))
    realisation = to_number(payload.get("realisation"))
    signe = str(payload.get("signe") or "").strip()
    unite = str(payload.get("unite") or "").strip()

    if not indicateur:
        raise ValueError("indicateur est obligatoire.")
    if objectif is None or realisation is None:
        raise ValueError("objectif et realisation doivent etre numeriques.")
    if not signe:
        raise ValueError("signe est obligatoire.")
    if not unite:
        raise ValueError("unite est obligatoire.")

    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]
    df["Indicateur"] = df["Indicateur"].fillna("").astype(str).str.strip()
    if "Realisation" in df.columns:
        df["Realisation"] = pd.to_numeric(df["Realisation"], errors="coerce")

    hist = df[df["Indicateur"].str.lower() == indicateur.lower()].copy()
    if not hist.empty:
        hist["Annee"] = pd.to_numeric(hist.get("Annee"), errors="coerce")
        hist["Mois"] = pd.to_numeric(hist.get("Mois"), errors="coerce")
        hist = hist.sort_values(["Annee", "Mois"])

    processus = str(payload.get("processus") or "").strip() or latest_text_value(hist, "Processus")
    recent_realisation = []
    if not hist.empty and "Realisation" in hist.columns:
        recent_realisation = hist["Realisation"].dropna().astype(float).tolist()

    lag_1 = to_number(payload.get("lag_1"), recent_realisation[-1] if recent_realisation else realisation)
    lag_2 = to_number(payload.get("lag_2"), recent_realisation[-2] if len(recent_realisation) >= 2 else lag_1)
    lag_3 = to_number(payload.get("lag_3"), recent_realisation[-3] if len(recent_realisation) >= 3 else lag_2)
    rolling_values = [lag_3, lag_2, lag_1]
    rolling_mean = float(np.mean(rolling_values))
    rolling_std = float(np.std(rolling_values))
    tendance = lag_1 - lag_2
    ecart = realisation - objectif
    taux_realisation = (realisation / objectif) * 100 if objectif else 0
    conforms = is_conforme(realisation, objectif, signe)

    X = pd.DataFrame([{
        "processus_enc": encode_value(df, "Processus", processus),
        "signe_enc": encode_value(df, "Signe", signe),
        "unite_enc": encode_value(df, "Unite", unite),
        "Objectif": objectif,
        "Realisation": realisation,
        "Ecart": ecart,
        "taux_realisation": taux_realisation,
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_3": lag_3,
        "rolling_mean": rolling_mean,
        "rolling_std": rolling_std,
        "tendance": tendance,
        "plan_action_open_count": to_number(payload.get("plan_action_open_count"), 0),
        "plan_action_late_count": to_number(payload.get("plan_action_late_count"), 0),
    }], columns=ANOMALY_FEATURES)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    with open(MODEL_PATH, "rb") as file:
        model = pickle.load(file)

    prediction = int(model.predict(X)[0] == -1)
    score = float(-model.decision_function(X)[0])

    print(json.dumps({
        "indicateur": indicateur,
        "annee": payload.get("annee"),
        "mois": payload.get("mois"),
        "objectif": objectif,
        "realisation": realisation,
        "signe": signe,
        "unite": unite,
        "processus": processus,
        "ecart": ecart,
        "taux_realisation": taux_realisation,
        "is_conforme": bool(conforms),
        "is_anomaly": prediction,
        "anomaly_score": score,
        "interpretation": build_interpretation(realisation, objectif, signe, conforms),
        "model_name": "anomaly_isolation_forest",
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
