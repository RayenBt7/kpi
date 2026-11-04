from __future__ import annotations

import joblib
import pandas as pd

from ml.config import RISK_MODEL_ARTIFACT, SETTINGS
from ml.pipeline.features import build_risk_feature_frame, get_model_input_frame


def run_risk_scoring(canonicalized_tables: dict, anomalies_df: pd.DataFrame, risk_labels_df: pd.DataFrame | None = None) -> dict:
    features = build_risk_feature_frame(canonicalized_tables, anomalies_df)
    if features.empty:
        return {"risk_scores": pd.DataFrame(), "summary": {"rows": 0}}

    scores = features.copy()
    model_name = "heuristic_risk_score"
    model_version = "v1"
    prediction_source = "etl_heuristic"

    if RISK_MODEL_ARTIFACT.exists():
        try:
            bundle = joblib.load(RISK_MODEL_ARTIFACT)
            model = bundle["model"] if isinstance(bundle, dict) and "model" in bundle else bundle
            probabilities = model.predict_proba(get_model_input_frame(features))[:, 1]
            scores["risk_score"] = probabilities
            metadata = bundle.get("metadata", {}) if isinstance(bundle, dict) else {}
            model_name = metadata.get("model_name") or SETTINGS.risk_model_name
            model_version = metadata.get("version") or SETTINGS.risk_model_version
            prediction_source = "trained_model"
        except Exception as error:
            print(f"[WARN] trained risk model ignored: {error}")
            scores["risk_score"] = _heuristic_score(scores)
            prediction_source = "fallback_heuristic"
    else:
        scores["risk_score"] = _heuristic_score(scores)

    scores["risk_score"] = scores["risk_score"].clip(0, 1)
    scores["risk_level"] = scores["risk_score"].map(_risk_level)
    scores["model_name"] = model_name
    scores["model_version"] = model_version
    scores["prediction_source"] = prediction_source

    result = scores[
        [
            "canonical_indicateur",
            "risk_score",
            "risk_level",
            "volatility",
            "performance_gap",
            "anomaly_rate",
            "model_name",
            "model_version",
            "prediction_source",
        ]
    ].copy()

    summary = {
        "rows": int(len(result)),
        "high": int((result["risk_level"] == "High").sum()),
        "medium": int((result["risk_level"] == "Medium").sum()),
        "low": int((result["risk_level"] == "Low").sum()),
        "source": prediction_source,
    }
    return {"risk_scores": result, "summary": summary}


def _heuristic_score(df: pd.DataFrame) -> pd.Series:
    return (
        df["performance_gap"].clip(upper=0).abs() * 0.35
        + df["volatility"].clip(0, 1) * 0.2
        + df["anomaly_rate"].clip(0, 1) * 0.25
        + df["action_density"].clip(0, 1) * 0.1
        + df["negative_gap_ratio"].clip(0, 1) * 0.1
    )


def _risk_level(score: float) -> str:
    if score >= SETTINGS.risk_score_high_threshold:
        return "High"
    if score >= SETTINGS.risk_score_medium_threshold:
        return "Medium"
    return "Low"


def print_risk_report(report: dict) -> None:
    print("\n=== RISK SCORING ===")
    for key, value in report.get("summary", {}).items():
        print(f"{key}: {value}")
    scores = report.get("risk_scores", pd.DataFrame())
    if not scores.empty:
        print(scores.sort_values("risk_score", ascending=False).head(10).to_string(index=False))
