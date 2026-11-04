from __future__ import annotations

import pandas as pd


def run_build_suggestions(canonicalized_tables: dict, anomalies_df: pd.DataFrame, risk_scores_df: pd.DataFrame) -> dict:
    if risk_scores_df is None or risk_scores_df.empty:
        return {"suggestions": pd.DataFrame(), "summary": {"rows": 0}}

    anomaly_counts = pd.DataFrame(columns=["canonical_indicateur", "anomaly_count", "avg_ecart_pourcent"])
    if anomalies_df is not None and not anomalies_df.empty:
        anomaly_counts = (
            anomalies_df.groupby("canonical_indicateur", as_index=False)
            .agg(
                anomaly_count=("is_anomaly", "sum"),
                avg_ecart_pourcent=("ecart_pourcent", "mean"),
            )
        )

    work = risk_scores_df.merge(anomaly_counts, on="canonical_indicateur", how="left")
    work["anomaly_count"] = work["anomaly_count"].fillna(0).astype(int)
    work["avg_ecart_pourcent"] = pd.to_numeric(work["avg_ecart_pourcent"], errors="coerce").fillna(0)

    rows = []
    for _, row in work.iterrows():
        risk_level = row.get("risk_level", "Low")
        priority = "Critical" if risk_level == "High" else "High" if risk_level == "Medium" else "Normal"
        rows.append(
            {
                "canonical_indicateur": row.get("canonical_indicateur"),
                "priority": priority,
                "risk_level": risk_level,
                "anomaly_count": int(row.get("anomaly_count", 0)),
                "avg_ecart_pourcent": float(row.get("avg_ecart_pourcent", 0)),
                "suggestion": _suggestion_text(risk_level, int(row.get("anomaly_count", 0))),
                "suggested_actions": _suggested_actions(risk_level),
            }
        )

    suggestions = pd.DataFrame(rows)
    return {"suggestions": suggestions, "summary": {"rows": int(len(suggestions)), "critical": int((suggestions["priority"] == "Critical").sum())}}


def _suggestion_text(risk_level: str, anomaly_count: int) -> str:
    if risk_level == "High":
        return "Prioriser une analyse des causes et verifier les plans d action ouverts."
    if risk_level == "Medium" or anomaly_count > 0:
        return "Surveiller la tendance et confirmer les actions correctives."
    return "Maintenir le suivi standard."


def _suggested_actions(risk_level: str) -> str:
    if risk_level == "High":
        return "Verifier les ecarts recents, analyser les causes racines, mettre a jour le plan d action."
    if risk_level == "Medium":
        return "Controler les prochains resultats, documenter les ecarts, ajuster le responsable si necessaire."
    return "Continuer le suivi mensuel et conserver les preuves de conformite."


def print_suggestions_report(report: dict) -> None:
    print("\n=== ACTION SUGGESTIONS ===")
    for key, value in report.get("summary", {}).items():
        print(f"{key}: {value}")
    suggestions = report.get("suggestions", pd.DataFrame())
    if not suggestions.empty:
        print(suggestions.head(10).to_string(index=False))
