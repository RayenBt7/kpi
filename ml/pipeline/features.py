from __future__ import annotations

import pandas as pd

FEATURE_COLUMNS = [
    "performance_gap",
    "anomaly_rate",
    "volatility",
    "data_completeness",
    "action_density",
    "negative_gap_ratio",
    "abs_gap_mean",
    "gap_std",
    "monthly_observations",
    "actions_count",
]


def build_risk_feature_frame(canonicalized_tables: dict, anomalies_df: pd.DataFrame) -> pd.DataFrame:
    monthly = canonicalized_tables.get("monthly", pd.DataFrame()).copy()
    actions = canonicalized_tables.get("actions", pd.DataFrame()).copy()

    if monthly.empty:
        return pd.DataFrame(columns=["canonical_indicateur", *FEATURE_COLUMNS])

    monthly["ecart_pourcent"] = pd.to_numeric(monthly["ecart_pourcent"], errors="coerce")
    monthly["realise"] = pd.to_numeric(monthly["realise"], errors="coerce")
    monthly["objectif"] = pd.to_numeric(monthly["objectif"], errors="coerce")

    anomaly_rates = pd.DataFrame(columns=["canonical_indicateur", "anomaly_rate"])
    if anomalies_df is not None and not anomalies_df.empty:
        anomaly_rates = (
            anomalies_df.groupby("canonical_indicateur", as_index=False)["is_anomaly"]
            .mean()
            .rename(columns={"is_anomaly": "anomaly_rate"})
        )

    action_counts = pd.DataFrame(columns=["canonical_indicateur", "actions_count"])
    if not actions.empty and "canonical_indicateur" in actions.columns:
        action_counts = actions.groupby("canonical_indicateur", as_index=False).size().rename(columns={"size": "actions_count"})

    grouped = monthly.groupby("canonical_indicateur")
    features = grouped.agg(
        performance_gap=("ecart_pourcent", lambda s: float(s.dropna().tail(12).mean() / 100) if not s.dropna().empty else 0.0),
        volatility=("realise", lambda s: _safe_cv(s.dropna().tail(12))),
        data_completeness=("realise", lambda s: float(s.notna().mean()) if len(s) else 0.0),
        negative_gap_ratio=("ecart_pourcent", lambda s: float((s.dropna() < 0).mean()) if len(s.dropna()) else 0.0),
        abs_gap_mean=("ecart_pourcent", lambda s: float(s.dropna().abs().mean() / 100) if not s.dropna().empty else 0.0),
        gap_std=("ecart_pourcent", lambda s: float(s.dropna().std(ddof=0) / 100) if len(s.dropna()) else 0.0),
        monthly_observations=("realise", "count"),
    ).reset_index()

    features = features.merge(anomaly_rates, on="canonical_indicateur", how="left")
    features = features.merge(action_counts, on="canonical_indicateur", how="left")
    features["anomaly_rate"] = features["anomaly_rate"].fillna(0.0)
    features["actions_count"] = pd.to_numeric(features["actions_count"], errors="coerce").fillna(0).astype(int)
    features["action_density"] = features["actions_count"] / features["monthly_observations"].replace(0, 1)

    for column in FEATURE_COLUMNS:
        features[column] = pd.to_numeric(features[column], errors="coerce").replace([float("inf"), float("-inf")], 0).fillna(0)
    return features[["canonical_indicateur", *FEATURE_COLUMNS]]


def get_model_input_frame(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    for column in FEATURE_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0
    return frame[FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0)


def _safe_cv(values: pd.Series) -> float:
    if values.empty:
        return 0.0
    mean = float(values.mean())
    if abs(mean) < 1e-9:
        return 0.0
    return float(values.std(ddof=0) / abs(mean))
