from __future__ import annotations

import pandas as pd


def prepare_business_risk_labels(risk_labels_df: pd.DataFrame | None) -> pd.DataFrame:
    if risk_labels_df is None or risk_labels_df.empty:
        return pd.DataFrame(columns=["canonical_indicateur", "risk_label"])

    df = risk_labels_df.copy()
    if "canonical_indicateur" not in df.columns and "indicateur" in df.columns:
        df["canonical_indicateur"] = df["indicateur"]

    if "risk_label" not in df.columns:
        if "suggested_risk_label" in df.columns:
            df["risk_label"] = df["suggested_risk_label"]
        elif "risk_level" in df.columns:
            df["risk_label"] = df["risk_level"].astype(str).str.lower().isin(["high", "critical", "1", "true"]).astype(int)
        else:
            df["risk_label"] = pd.NA

    df["canonical_indicateur"] = df["canonical_indicateur"].fillna("").astype(str).str.strip()
    df["risk_label"] = pd.to_numeric(df["risk_label"], errors="coerce")
    df = df[df["canonical_indicateur"].ne("") & df["risk_label"].isin([0, 1])]
    return df[["canonical_indicateur", "risk_label"]].drop_duplicates("canonical_indicateur", keep="last")


def attach_business_risk_labels(features_df: pd.DataFrame, risk_labels_df: pd.DataFrame | None) -> pd.DataFrame:
    labels = prepare_business_risk_labels(risk_labels_df)
    result = features_df.copy()
    if labels.empty:
        result["risk_label"] = pd.NA
        return result

    result["_key"] = result["canonical_indicateur"].fillna("").astype(str).str.strip().str.lower()
    labels["_key"] = labels["canonical_indicateur"].fillna("").astype(str).str.strip().str.lower()
    result = result.merge(labels[["_key", "risk_label"]], on="_key", how="left").drop(columns=["_key"])
    return result
