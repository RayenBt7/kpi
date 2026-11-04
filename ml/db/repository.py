from ml.db.node_bridge import execute_batch, query_rows, sql_literal
import pandas as pd


def fetch_source_counts():
    queries = {
        "indicateurs": "SELECT COUNT(*) FROM dbo.Indicateur",
        "objectifs": "SELECT COUNT(*) FROM dbo.objectiv",
        "realises": "SELECT COUNT(*) FROM dbo.realise",
        "actions": "SELECT COUNT(*) FROM dbo.Plan_action",
    }

    results = {}
    for name, query in queries.items():
        rows = query_rows(query)
        value = rows[0].get("") if rows and "" in rows[0] else None
        if value is None and rows:
            value = next(iter(rows[0].values()), 0)
        results[name] = int(value or 0)
    return results


def _chunked(rows: list[dict], chunk_size: int = 200):
    for start in range(0, len(rows), chunk_size):
        yield rows[start:start + chunk_size]


def _insert_rows(table_name: str, columns: list[str], rows: list[dict]) -> None:
    if not rows:
        return

    for chunk in _chunked(rows):
        values_sql = []
        for row in chunk:
            values_sql.append(
                "(" + ", ".join(sql_literal(row.get(column)) for column in columns) + ")"
            )

        sql = (
            f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES\n"
            + ",\n".join(values_sql)
            + ";"
        )
        execute_batch(sql)


def insert_anomalies(anomalies_df: pd.DataFrame):
    """
    Insère les anomalies détectées dans la table ml_anomalies.
    """
    if anomalies_df.empty:
        return

    rows = []
    for _, row in anomalies_df.iterrows():
        rows.append({
            "canonical_indicateur": row.get("canonical_indicateur"),
            "year_value": int(row.get("year_value")) if pd.notna(row.get("year_value")) else None,
            "month": row.get("month"),
            "objectif": float(row.get("objectif")) if pd.notna(row.get("objectif")) else None,
            "realise": float(row.get("realise")) if pd.notna(row.get("realise")) else None,
            "ecart_absolu": float(row.get("ecart_absolu")) if pd.notna(row.get("ecart_absolu")) else None,
            "ecart_pourcent": float(row.get("ecart_pourcent")) if pd.notna(row.get("ecart_pourcent")) else None,
            "is_anomaly": bool(row.get("is_anomaly")),
        })

    _insert_rows(
        "dbo.ml_anomalies",
        [
            "canonical_indicateur",
            "year_value",
            "month",
            "objectif",
            "realise",
            "ecart_absolu",
            "ecart_pourcent",
            "is_anomaly",
        ],
        rows,
    )
    print(f"Inserted {len(rows)} anomalies into ml_anomalies")


def insert_risk_scores(risk_scores_df: pd.DataFrame):
    """
    Insère les scores de risque dans la table ml_risk_scores.
    """
    if risk_scores_df.empty:
        return

    def safe_float(value):
        if pd.isna(value) or (isinstance(value, float) and (value == float('inf') or value == float('-inf'))):
            return None
        return float(value)

    rows = []
    for _, row in risk_scores_df.iterrows():
        ar = row.get("anomaly_rate")
        if pd.isna(ar) or (isinstance(ar, float) and (ar == float('inf') or ar == float('-inf') or str(ar) == 'nan')):
            ar = None
        elif isinstance(ar, str) and ar.strip() == "":
            ar = None
        else:
            ar = float(ar)
        rows.append({
            "canonical_indicateur": row.get("canonical_indicateur"),
            "risk_score": safe_float(row.get("risk_score")),
            "risk_level": row.get("risk_level"),
            "volatility": safe_float(row.get("volatility")),
            "performance_gap": safe_float(row.get("performance_gap")),
            "anomaly_rate": ar,
            "model_name": row.get("model_name"),
            "model_version": row.get("model_version"),
            "prediction_source": row.get("prediction_source"),
        })

    _insert_rows(
        "dbo.ml_risk_scores",
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
        ],
        rows,
    )
    print(f"Inserted {len(rows)} risk scores into ml_risk_scores")


def insert_suggestions(suggestions_df: pd.DataFrame):
    """
    Insère les suggestions d'actions dans la table ml_suggestions.
    """
    if suggestions_df.empty:
        return

    rows = []
    for _, row in suggestions_df.iterrows():
        rows.append({
            "canonical_indicateur": row.get("canonical_indicateur"),
            "priority": row.get("priority"),
            "risk_level": row.get("risk_level"),
            "anomaly_count": int(row.get("anomaly_count")) if pd.notna(row.get("anomaly_count")) else None,
            "avg_ecart_pourcent": float(row.get("avg_ecart_pourcent")) if pd.notna(row.get("avg_ecart_pourcent")) else None,
            "suggestion": row.get("suggestion"),
            "suggested_actions": str(row.get("suggested_actions")) if row.get("suggested_actions") else None,
        })

    _insert_rows(
        "dbo.ml_suggestions",
        [
            "canonical_indicateur",
            "priority",
            "risk_level",
            "anomaly_count",
            "avg_ecart_pourcent",
            "suggestion",
            "suggested_actions",
        ],
        rows,
    )
    print(f"Inserted {len(rows)} suggestions into ml_suggestions")


def clear_previous_results():
    """
    Supprime les résultats précédents avant insertion (optionnel, pour éviter duplication).
    """
    execute_batch("""
    DELETE FROM dbo.ml_anomalies;
    DELETE FROM dbo.ml_risk_scores;
    DELETE FROM dbo.ml_suggestions;
    """)
    print("Cleared previous ML snapshot results")
