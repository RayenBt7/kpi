import json
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

SUGGESTION_TEMPLATES = {
    "performance_gap": {
        "priority": "High",
        "text": "La realisation reste sous l'objectif. Une analyse des ecarts recents est recommandee.",
        "actions": [
            "Verifier les mois avec les plus grands ecarts.",
            "Identifier la cause racine avec le responsable du processus.",
            "Definir une action corrective datee.",
        ],
    },
    "high_volatility": {
        "priority": "High",
        "text": "Les resultats varient fortement. Le processus doit etre stabilise avant cloture.",
        "actions": [
            "Comparer les variations mensuelles.",
            "Controler les changements de methode ou de charge.",
            "Suivre un plan de stabilisation sur les prochaines periodes.",
        ],
    },
    "anomaly_detected": {
        "priority": "Critical",
        "text": "Un signal d'anomalie est detecte sur le comportement de l'indicateur.",
        "actions": [
            "Verifier la qualite de la saisie.",
            "Comparer objectif, realise et historique recent.",
            "Documenter la cause avant validation du plan d'action.",
        ],
    },
    "late_actions": {
        "priority": "Critical",
        "text": "Des actions en retard augmentent le risque de non-maitrise.",
        "actions": [
            "Relancer les responsables d'action.",
            "Replanifier les dates de cloture realistes.",
            "Escalader les actions critiques non cloturees.",
        ],
    },
    "missing_realisation": {
        "priority": "Normal",
        "text": "La realisation est incomplete. Le suivi AI demande une saisie a jour.",
        "actions": [
            "Completer les realisations manquantes.",
            "Verifier l'objectif de la periode.",
            "Relancer l'analyse apres mise a jour.",
        ],
    },
    "normal_followup": {
        "priority": "Normal",
        "text": "Aucun signal critique dominant. Continuer le suivi periodique.",
        "actions": [
            "Maintenir le suivi mensuel.",
            "Surveiller les prochains ecarts.",
            "Actualiser le plan d'action si la tendance change.",
        ],
    },
}


def to_number(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        numeric = float(str(value).replace(",", "."))
        return numeric if np.isfinite(numeric) else default
    except (TypeError, ValueError):
        return default


def encode_value(df, source_column, value):
    if df is None or source_column not in df.columns:
        return 0
    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {item: index for index, item in enumerate(sorted(values.unique()))}
    return int(codes.get(str(value or "").strip(), 0))


def pick_value(source, *keys, default=None):
    for key in keys:
        if key in source and source.get(key) not in (None, ""):
            return source.get(key)
    return default


def load_metadata():
    if not os.path.exists(METADATA_PATH):
        return {}
    with open(METADATA_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def load_dataset_if_available():
    if not os.path.exists(DATASET_PATH):
        return None
    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]
    if "Indicateur" in df.columns:
        df["Indicateur"] = df["Indicateur"].fillna("").astype(str).str.strip()
    return df


def normalize_sign(value):
    sign = str(value or "").strip().lower()
    if any(token in sign for token in ["<=", "≤", "inferieur", "inférieur", "max"]):
        return "lower_is_better"
    if any(token in sign for token in [">=", "≥", "superieur", "supérieur", "min"]):
        return "higher_is_better"
    if "<" in sign:
        return "lower_is_better"
    return "higher_is_better"


def compute_oriented_gap(realisation, objectif, signe):
    if normalize_sign(signe) == "lower_is_better":
        return objectif - realisation
    return realisation - objectif


def compute_fallback_risk(features):
    performance_gap = max(0.0, -features["performance_gap"])
    volatility = min(1.0, abs(features["volatility_signal"]))
    anomaly = min(1.0, abs(features["anomaly_signal"]))
    open_actions = min(1.0, features["plan_action_open_count"] * 0.03)
    late_actions = min(1.0, features["plan_action_late_count"] * 0.05)
    score = min(1.0, max(0.0, performance_gap + (volatility * 0.35) + (anomaly * 0.25) + open_actions + late_actions))
    level = "High" if score >= 0.7 else "Medium" if score >= 0.4 else "Low"
    return level, score


def fallback_category(features):
    if features["plan_action_late_count"] > 0:
        return "late_actions"
    if features["anomaly_signal"] >= 1:
        return "anomaly_detected"
    if abs(features["volatility_signal"]) >= 0.25:
        return "high_volatility"
    if features["performance_gap"] <= -0.15:
        return "performance_gap"
    if features["Realisation"] == 0 and features["Objectif"] > 0:
        return "missing_realisation"
    return "normal_followup"


def pick_row(df, indicator, year=None, month=None):
    rows = df[df["Indicateur"].str.lower() == indicator.lower()].copy()
    if rows.empty:
        raise ValueError(f"Indicateur {indicator} introuvable dans le dataset ML.")

    rows["Annee"] = pd.to_numeric(rows.get("Annee"), errors="coerce")
    rows["Mois"] = pd.to_numeric(rows.get("Mois"), errors="coerce")
    filtered = rows
    if year is not None:
        filtered = filtered[filtered["Annee"] == year]
    if month is not None:
        filtered = filtered[filtered["Mois"] == month]
    if filtered.empty:
        filtered = rows
    return filtered.sort_values(["Annee", "Mois"]).iloc[-1], rows.sort_values(["Annee", "Mois"])


def build_features(df, selected_row, history):
    objectif = to_number(selected_row.get("Objectif"))
    realisation = to_number(selected_row.get("Realisation"))
    ecart = to_number(selected_row.get("Ecart"), realisation - objectif)
    taux = to_number(selected_row.get("taux_realisation"), (realisation / objectif) * 100 if objectif else 0)
    rolling_mean = to_number(selected_row.get("rolling_mean"))
    rolling_std = to_number(selected_row.get("rolling_std"))
    performance_gap = ecart / abs(objectif) if objectif else 0
    volatility_signal = rolling_std / abs(rolling_mean) if rolling_mean else 0
    anomaly_signal = 1 if abs(performance_gap) >= 0.3 else 0

    features = {
        "processus_enc": encode_value(df, "Processus", selected_row.get("Processus")),
        "indicateur_enc": to_number(selected_row.get("indicateur_enc")),
        "signe_enc": encode_value(df, "Signe", selected_row.get("Signe")),
        "unite_enc": encode_value(df, "Unite", selected_row.get("Unite")),
        "Annee": to_number(selected_row.get("Annee")),
        "Mois": to_number(selected_row.get("Mois")),
        "Objectif": objectif,
        "Realisation": realisation,
        "Ecart": ecart,
        "taux_realisation": taux,
        "lag_1": to_number(selected_row.get("lag_1")),
        "lag_2": to_number(selected_row.get("lag_2")),
        "lag_3": to_number(selected_row.get("lag_3")),
        "rolling_mean": rolling_mean,
        "rolling_std": rolling_std,
        "tendance": to_number(selected_row.get("tendance")),
        "plan_action_open_count": to_number(selected_row.get("plan_action_open_count")),
        "plan_action_late_count": to_number(selected_row.get("plan_action_late_count")),
        "performance_gap": performance_gap,
        "volatility_signal": volatility_signal,
        "anomaly_signal": anomaly_signal,
    }
    return features


def build_direct_features(payload, df=None):
    source = payload.get("features") if isinstance(payload.get("features"), dict) else payload

    signe = pick_value(source, "Signe", "signe", "sign", default=">=")
    unite = pick_value(source, "Unite", "unite", "unit", default="")
    processus = pick_value(source, "Processus", "processus", "process", default="")
    objectif = to_number(pick_value(source, "Objectif", "objectif"))
    realisation = to_number(pick_value(source, "Realisation", "realisation", "realise"))
    oriented_ecart = compute_oriented_gap(realisation, objectif, signe)
    ecart = to_number(
        pick_value(source, "Ecart", "ecart"),
        oriented_ecart,
    )
    taux = to_number(
        pick_value(source, "taux_realisation", "tauxRealisation"),
        (realisation / objectif) * 100 if objectif else 0,
    )
    rolling_mean = to_number(pick_value(source, "rolling_mean", "rollingMean"))
    rolling_std = to_number(pick_value(source, "rolling_std", "rollingStd"))
    performance_gap = to_number(
        pick_value(source, "performance_gap", "performanceGap"),
        ecart / abs(objectif) if objectif else 0,
    )
    volatility_signal = to_number(
        pick_value(source, "volatility_signal", "volatility"),
        rolling_std / abs(rolling_mean) if rolling_mean else 0,
    )
    anomaly_signal = to_number(
        pick_value(source, "anomaly_signal", "anomalySignal"),
        1 if abs(performance_gap) >= 0.3 else 0,
    )
    signe_enc = pick_value(source, "signe_enc", "signeEnc")
    unite_enc = pick_value(source, "unite_enc", "uniteEnc")
    processus_enc = pick_value(source, "processus_enc", "processusEnc")

    features = {
        "processus_enc": to_number(processus_enc, encode_value(df, "Processus", processus)),
        "indicateur_enc": to_number(pick_value(source, "indicateur_enc", "indicateurEnc")),
        "signe_enc": to_number(signe_enc, encode_value(df, "Signe", signe)),
        "unite_enc": to_number(unite_enc, encode_value(df, "Unite", unite)),
        "Annee": to_number(pick_value(source, "Annee", "annee", "year")),
        "Mois": to_number(pick_value(source, "Mois", "mois", "month")),
        "Objectif": objectif,
        "Realisation": realisation,
        "Ecart": ecart,
        "taux_realisation": taux,
        "lag_1": to_number(pick_value(source, "lag_1", "lag1")),
        "lag_2": to_number(pick_value(source, "lag_2", "lag2")),
        "lag_3": to_number(pick_value(source, "lag_3", "lag3")),
        "rolling_mean": rolling_mean,
        "rolling_std": rolling_std,
        "tendance": to_number(pick_value(source, "tendance", "trend")),
        "plan_action_open_count": to_number(pick_value(source, "plan_action_open_count", "openActions")),
        "plan_action_late_count": to_number(pick_value(source, "plan_action_late_count", "lateActions")),
        "performance_gap": performance_gap,
        "volatility_signal": volatility_signal,
        "anomaly_signal": anomaly_signal,
    }

    for feature in FEATURES:
        features[feature] = to_number(features.get(feature))

    return features, {
        "signe": str(signe),
        "unite": str(unite),
        "processus": str(processus),
        "sens": normalize_sign(signe),
    }


def predict_with_probability(model, X):
    label = str(model.predict(X)[0])
    probability = None
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(X)[0]
        classes = [str(item) for item in model.classes_]
        if label in classes:
            probability = float(probabilities[classes.index(label)])
    return label, probability


def main():
    if len(sys.argv) < 2:
        raise ValueError("Payload JSON manquant.")

    payload = json.loads(sys.argv[1])
    indicator = str(payload.get("indicateur") or payload.get("indicator") or "").strip()
    year = payload.get("year") or payload.get("annee")
    month = payload.get("month") or payload.get("mois")
    year = int(year) if str(year or "").strip().isdigit() else None
    month = int(month) if str(month or "").strip().isdigit() else None
    has_direct_features = isinstance(payload.get("features"), dict) or any(key in payload for key in FEATURES)

    context = {}
    if has_direct_features:
        df = load_dataset_if_available()
        features, context = build_direct_features(payload, df)
        indicator = indicator or str(
            pick_value(
                payload.get("features", {}) if isinstance(payload.get("features"), dict) else payload,
                "Indicateur",
                "indicateur",
                "indicator",
                default="direct_features",
            )
        ).strip()
        prediction_source = "trained_model_direct_features"
    else:
        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(f"Dataset introuvable: {DATASET_PATH}")
        if not indicator:
            raise ValueError("indicateur est obligatoire, sauf si features est fourni.")

        df = load_dataset_if_available()
        selected_row, history = pick_row(df, indicator, year, month)
        features = build_features(df, selected_row, history)
        context = {
            "signe": str(selected_row.get("Signe") or ""),
            "unite": str(selected_row.get("Unite") or ""),
            "processus": str(selected_row.get("Processus") or ""),
            "sens": normalize_sign(selected_row.get("Signe")),
        }
        prediction_source = "trained_model"

    X = pd.DataFrame([{name: features.get(name, 0) for name in FEATURES}], columns=FEATURES)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    metadata = load_metadata()
    model_version = metadata.get("version")

    if os.path.exists(RISK_MODEL_PATH):
        with open(RISK_MODEL_PATH, "rb") as file:
            risk_model = pickle.load(file)
        risk_level, risk_probability = predict_with_probability(risk_model, X)
        fallback_level, risk_score = compute_fallback_risk(features)
        if risk_level not in {"Low", "Medium", "High"}:
            risk_level = fallback_level
    else:
        risk_level, risk_score = compute_fallback_risk(features)
        risk_probability = None
        prediction_source = "fallback_missing_model"

    if os.path.exists(SUGGESTION_MODEL_PATH):
        with open(SUGGESTION_MODEL_PATH, "rb") as file:
            suggestion_model = pickle.load(file)
        suggestion_category, suggestion_probability = predict_with_probability(suggestion_model, X)
        if suggestion_category not in SUGGESTION_TEMPLATES:
            suggestion_category = fallback_category(features)
    else:
        suggestion_category = fallback_category(features)
        suggestion_probability = None
        prediction_source = "fallback_missing_model"

    risk_score = compute_fallback_risk(features)[1]
    template = SUGGESTION_TEMPLATES.get(suggestion_category, SUGGESTION_TEMPLATES["normal_followup"])

    print(json.dumps({
        "indicator": indicator,
        "risk": {
            "level": risk_level,
            "score": float(risk_score),
            "probability": risk_probability,
            "model_name": "risk_level_classifier",
            "model_version": model_version,
        },
        "suggestion": {
            "category": suggestion_category,
            "priority": template["priority"],
            "text": template["text"],
            "actions": template["actions"],
            "probability": suggestion_probability,
            "model_name": "suggestion_classifier",
            "model_version": model_version,
        },
        "signals": {
            "anomaly_count": int(features["anomaly_signal"]),
            "performance_gap": float(features["performance_gap"]),
            "volatility": float(features["volatility_signal"]),
            "plan_action_open_count": int(features["plan_action_open_count"]),
            "plan_action_late_count": int(features["plan_action_late_count"]),
        },
        "feature_context": context,
        "prediction_source": prediction_source,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
