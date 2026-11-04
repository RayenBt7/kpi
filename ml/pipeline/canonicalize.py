from __future__ import annotations

import pandas as pd

MONTHS = [
    (1, "janv"),
    (2, "fev"),
    (3, "mars"),
    (4, "avril"),
    (5, "mai"),
    (6, "juin"),
    (7, "juil"),
    (8, "aout"),
    (9, "sept"),
    (10, "oct"),
    (11, "nov"),
    (12, "decem"),
]


def normalize_text(value) -> str:
    return str(value if value is not None else "").strip()


def normalize_key(value) -> str:
    return normalize_text(value).lower()


def to_number(value):
    if value is None or value == "":
        return None
    numeric = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    return None if pd.isna(numeric) else float(numeric)


def _sign_passes(realise, objectif, signe) -> bool | None:
    r = to_number(realise)
    o = to_number(objectif)
    if r is None or o is None:
        return None

    sign = normalize_text(signe)
    if "<" in sign or "≤" in sign:
        return r <= o
    if ">" in sign or "≥" in sign:
        return r >= o
    if "=" in sign and "!" not in sign:
        return abs(r - o) <= 0.0001
    return r >= o


def _melt_monthly(df: pd.DataFrame, value_name: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame(columns=["canonical_indicateur", "year_value", "month_value", "month", value_name])

    rows = []
    for _, row in df.iterrows():
        indicator = normalize_text(row.get("indicateur"))
        year = pd.to_numeric(row.get("year_value"), errors="coerce")
        if not indicator or pd.isna(year):
            continue

        for month_value, month_key in MONTHS:
            value = to_number(row.get(month_key))
            if value is None:
                continue
            rows.append(
                {
                    "canonical_indicateur": indicator,
                    "year_value": int(year),
                    "month_value": month_value,
                    "month": month_key,
                    value_name: value,
                }
            )
    return pd.DataFrame(rows)


def canonicalize_all(data: dict[str, pd.DataFrame]) -> dict:
    indicateurs = data.get("indicateurs", pd.DataFrame()).copy()
    objectifs = _melt_monthly(data.get("objectifs", pd.DataFrame()), "objectif")
    realises = _melt_monthly(data.get("realises", pd.DataFrame()), "realise")
    actions = data.get("actions", pd.DataFrame()).copy()

    if not indicateurs.empty:
        indicateurs["canonical_indicateur"] = indicateurs["indicateur"].map(normalize_text)
        indicateurs["indicator_key"] = indicateurs["canonical_indicateur"].map(normalize_key)

    monthly = pd.merge(
        objectifs,
        realises,
        on=["canonical_indicateur", "year_value", "month_value", "month"],
        how="outer",
    )

    if not indicateurs.empty and not monthly.empty:
        monthly["indicator_key"] = monthly["canonical_indicateur"].map(normalize_key)
        meta_cols = ["indicator_key", "processus", "designation", "signe", "unite"]
        monthly = monthly.merge(indicateurs[meta_cols].drop_duplicates("indicator_key"), on="indicator_key", how="left")
        monthly = monthly.drop(columns=["indicator_key"])
    else:
        for column in ["processus", "designation", "signe", "unite"]:
            monthly[column] = ""

    if actions.empty:
        actions = pd.DataFrame(
            columns=[
                "canonical_indicateur",
                "year_value",
                "month_value",
                "is_closed",
                "is_late",
            ]
        )
    else:
        actions["canonical_indicateur"] = actions["indicateur"].map(normalize_text)
        actions["year_value"] = pd.to_numeric(actions["year_value"], errors="coerce")
        actions["month_value"] = pd.to_numeric(actions["month_value"], errors="coerce")
        actions["progress_num"] = pd.to_numeric(actions.get("PROGRESS"), errors="coerce")
        actions["is_closed"] = actions["dateclot"].fillna("").astype(str).str.strip().ne("") | (actions["progress_num"] >= 100)
        actions["dateclotprevu_dt"] = pd.to_datetime(actions.get("dateclotprevu"), errors="coerce")
        actions["is_late"] = (~actions["is_closed"]) & actions["dateclotprevu_dt"].notna() & (actions["dateclotprevu_dt"] < pd.Timestamp.today())

    if not monthly.empty:
        monthly = monthly.sort_values(["canonical_indicateur", "year_value", "month_value"]).reset_index(drop=True)
        monthly["objectif"] = pd.to_numeric(monthly["objectif"], errors="coerce")
        monthly["realise"] = pd.to_numeric(monthly["realise"], errors="coerce")
        monthly["ecart_absolu"] = monthly["realise"] - monthly["objectif"]
        monthly["ecart_pourcent"] = monthly["ecart_absolu"] / monthly["objectif"].replace(0, pd.NA) * 100
        monthly["taux_realisation"] = monthly["realise"] / monthly["objectif"].replace(0, pd.NA) * 100
        monthly["is_conforme"] = monthly.apply(
            lambda row: _sign_passes(row.get("realise"), row.get("objectif"), row.get("signe")),
            axis=1,
        )

        history = monthly.groupby("canonical_indicateur")["realise"]
        monthly["lag_1"] = history.shift(1).fillna(monthly["realise"])
        monthly["lag_2"] = history.shift(2).fillna(monthly["lag_1"])
        monthly["lag_3"] = history.shift(3).fillna(monthly["lag_2"])
        monthly["rolling_mean"] = history.transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean()).fillna(monthly["realise"])
        monthly["rolling_std"] = history.transform(lambda s: s.shift(1).rolling(3, min_periods=1).std(ddof=0)).fillna(0)
        monthly["tendance"] = monthly["lag_1"] - monthly["lag_2"]

        action_counts = (
            actions.dropna(subset=["year_value", "month_value"])
            .groupby(["canonical_indicateur", "year_value", "month_value"], as_index=False)
            .agg(
                plan_action_open_count=("is_closed", lambda s: int((~s).sum())),
                plan_action_late_count=("is_late", "sum"),
            )
        )
        monthly = monthly.merge(action_counts, on=["canonical_indicateur", "year_value", "month_value"], how="left")
        monthly["plan_action_open_count"] = pd.to_numeric(monthly["plan_action_open_count"], errors="coerce").fillna(0).astype(int)
        monthly["plan_action_late_count"] = pd.to_numeric(monthly["plan_action_late_count"], errors="coerce").fillna(0).astype(int)
    else:
        monthly = pd.DataFrame()

    summary = {
        "indicateurs": int(len(indicateurs)),
        "monthly_rows": int(len(monthly)),
        "actions": int(len(actions)),
        "distinct_indicateurs": int(monthly["canonical_indicateur"].nunique()) if not monthly.empty else 0,
    }

    return {
        "tables": {
            "indicateurs": indicateurs,
            "monthly": monthly,
            "actions": actions,
        },
        "summary": summary,
    }


def print_canonicalization_report(report: dict) -> None:
    print("\n=== CANONICALIZATION ===")
    for key, value in report.get("summary", {}).items():
        print(f"{key}: {value}")
