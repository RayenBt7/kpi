import pandas as pd
from ml.config import SETTINGS
from ml.db.sqlserver import get_connection

INDICATEURS_QUERY = """
SELECT
    LTRIM(RTRIM(Indicateur)) AS indicateur,
    LTRIM(RTRIM(Processus)) AS processus,
    LTRIM(RTRIM(Designation)) AS designation,
    LTRIM(RTRIM(Signe)) AS signe,
    LTRIM(RTRIM(Unite)) AS unite,
    Nordre
FROM dbo.Indicateur
"""

OBJECTIFS_QUERY = """
SELECT
    LTRIM(RTRIM(indicateur)) AS indicateur,
    YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) AS year_value,
    date1,
    datenow,
    janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem
FROM dbo.objectiv
"""
REALISES_QUERY = """
SELECT
    LTRIM(RTRIM(indicateur)) AS indicateur,
    YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) AS year_value,
    date1,
    datenow,
    janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem
FROM dbo.realise
"""

ACTIONS_QUERY = """
SELECT
    LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))) AS indicateur,
    TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(annee AS NVARCHAR(50)))), '')) AS year_value,
    TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(mois AS NVARCHAR(50)))), '')) AS month_value,
    LTRIM(RTRIM(CAST(rootCause AS NVARCHAR(MAX)))) AS root_cause,
    LTRIM(RTRIM(CAST(action AS NVARCHAR(MAX)))) AS action_text,
    LTRIM(RTRIM(CAST(responsable AS NVARCHAR(255)))) AS responsable,
    datecreation,
    dateclotprevu,
    dateclot,
    PROGRESS
FROM dbo.Plan_action
"""

RISK_LABELS_QUERY = """
IF OBJECT_ID('dbo.ml_risk_labels', 'U') IS NULL
BEGIN
    SELECT
        CAST(NULL AS NVARCHAR(255)) AS canonical_indicateur,
        CAST(NULL AS INT) AS risk_label,
        CAST(NULL AS NVARCHAR(50)) AS risk_level
    WHERE 1 = 0
END
ELSE
BEGIN
    SELECT *
    FROM dbo.ml_risk_labels
END
"""

def _read_sql(query: str) -> pd.DataFrame:
    with get_connection(SETTINGS.db_name) as conn:
        return pd.read_sql_query(query, conn)

	
def extract_all_sources() -> dict[str, pd.DataFrame]:
    return {
        "indicateurs": _read_sql(INDICATEURS_QUERY),
        "objectifs": _read_sql(OBJECTIFS_QUERY),
        "realises": _read_sql(REALISES_QUERY),
        "actions": _read_sql(ACTIONS_QUERY),
        "risk_labels": _read_sql(RISK_LABELS_QUERY),
    }
