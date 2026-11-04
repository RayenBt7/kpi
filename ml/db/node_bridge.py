from __future__ import annotations

from datetime import date, datetime
import json
from pathlib import Path
import subprocess

import pandas as pd


BRIDGE_SCRIPT = Path(__file__).resolve().with_name("sql_bridge.js")
PROJECT_ROOT = BRIDGE_SCRIPT.parents[2]


def _run_bridge(payload: dict) -> dict:
    completed = subprocess.run(
        ["node", str(BRIDGE_SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=120,
    )

    if completed.returncode != 0:
        stderr = completed.stderr.strip()
        stdout = completed.stdout.strip()
        detail = stderr or stdout or "unknown SQL bridge failure"
        raise RuntimeError(detail)

    return json.loads(completed.stdout or "{}")


def query_rows(query: str) -> list[dict]:
    result = _run_bridge({"mode": "query", "query": query})
    return result.get("rows") or []


def query_df(query: str) -> pd.DataFrame:
    return pd.DataFrame(query_rows(query))


def execute_batch(sql_text: str) -> None:
    _run_bridge({"mode": "batch", "sql": sql_text})


def sql_literal(value) -> str:
    if value is None or pd.isna(value):
        return "NULL"

    if isinstance(value, bool):
        return "1" if value else "0"

    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)

    if isinstance(value, float):
        if pd.isna(value):
            return "NULL"
        return repr(float(value))

    if isinstance(value, pd.Timestamp):
        value = value.to_pydatetime()

    if isinstance(value, datetime):
        clean = value.replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")
        return f"CAST(N'{clean}' AS DATETIME2)"

    if isinstance(value, date):
        clean = value.strftime("%Y-%m-%d")
        return f"CAST(N'{clean}' AS DATE)"

    text = str(value).replace("'", "''")
    return f"N'{text}'"
