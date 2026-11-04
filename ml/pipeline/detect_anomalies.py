from __future__ import annotations

import pandas as pd


def run_anomaly_detection(canonicalized_tables: dict) -> dict:
    monthly = canonicalized_tables.get("monthly", pd.DataFrame()).copy()
    if monthly.empty:
        anomalies = pd.DataFrame(
            columns=[
                "canonical_indicateur",
                "year_value",
                "month",
                "objectif",
                "realise",
                "ecart_absolu",
                "ecart_pourcent",
                "is_anomaly",
            ]
        )
        return {"anomalies": anomalies, "summary": {"rows": 0, "anomalies": 0}}

    monthly["ecart_pourcent"] = pd.to_numeric(monthly["ecart_pourcent"], errors="coerce")
    monthly["tendance"] = pd.to_numeric(monthly.get("tendance"), errors="coerce").fillna(0)
    monthly["rolling_std"] = pd.to_numeric(monthly.get("rolling_std"), errors="coerce").fillna(0)

    gap_anomaly = monthly["ecart_pourcent"].abs().fillna(0) >= 30
    variation_anomaly = (monthly["rolling_std"] > 0) & (monthly["tendance"].abs() > monthly["rolling_std"] * 2.5)
    monthly["is_anomaly"] = gap_anomaly | variation_anomaly

    anomalies = monthly[
        [
            "canonical_indicateur",
            "year_value",
            "month",
            "objectif",
            "realise",
            "ecart_absolu",
            "ecart_pourcent",
            "is_anomaly",
        ]
    ].copy()

    summary = {
        "rows": int(len(anomalies)),
        "anomalies": int(anomalies["is_anomaly"].sum()),
        "anomaly_rate": float(anomalies["is_anomaly"].mean()) if len(anomalies) else 0.0,
    }
    return {"anomalies": anomalies, "summary": summary}


def print_anomaly_report(report: dict) -> None:
    print("\n=== ANOMALY DETECTION ===")
    for key, value in report.get("summary", {}).items():
        print(f"{key}: {value}")
    anomalies = report.get("anomalies", pd.DataFrame())
    flagged = anomalies[anomalies.get("is_anomaly", False) == True] if not anomalies.empty else anomalies
    if not flagged.empty:
        print(flagged.head(10).to_string(index=False))
