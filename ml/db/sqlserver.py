import pyodbc

from ml.config import SETTINGS


def _candidate_drivers() -> list[str]:
    installed = set(pyodbc.drivers())
    preferred = [
        SETTINGS.db_driver,
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "SQL Server",
    ]

    candidates: list[str] = []
    for driver in preferred:
        if driver in installed and driver not in candidates:
            candidates.append(driver)
    return candidates


def _build_connection_string(driver: str, database: str) -> str:
    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={SETTINGS.db_server}",
        f"DATABASE={database}",
        f"UID={SETTINGS.db_user}",
        f"PWD={SETTINGS.db_password}",
        "TrustServerCertificate=yes",
        "LoginTimeout=5",
    ]

    if driver == "ODBC Driver 18 for SQL Server":
        parts.append("Encrypt=yes")
    else:
        parts.append("Encrypt=no")

    return ";".join(parts) + ";"


def get_connection(database: str):
    errors = []

    for driver in _candidate_drivers():
        try:
            return pyodbc.connect(_build_connection_string(driver, database))
        except pyodbc.Error as exc:
            errors.append(f"{driver}: {exc}")

    raise pyodbc.OperationalError(
        "Unable to connect to SQL Server. Tried: " + " | ".join(errors)
    )