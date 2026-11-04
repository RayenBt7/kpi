import pandas as pd

def _norm(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().str.lower()

def _summary(df: pd.DataFrame, indicator_col: str = "indicateur", year_col: str | None = "year_value") -> dict:
    years = (
        pd.to_numeric(df[year_col], errors="coerce")
        if year_col and year_col in df.columns
        else pd.Series(dtype="float64")
    )
    indicators = _norm(df[indicator_col]) if indicator_col in df.columns else pd.Series(dtype="object")

    return {
        "rows": int(len(df)),
        "distinct_indicateurs": int(indicators[indicators != ""].nunique()) if len(indicators) else 0,
        "min_year": int(years.dropna().min()) if not years.dropna().empty else None,
        "max_year": int(years.dropna().max()) if not years.dropna().empty else None,
        "missing_indicator_rows": int((indicators == "").sum()) if len(indicators) else 0,
        "missing_year_rows": int(years.isna().sum()) if len(years) else 0,
    }

def _unmatched(reference_df: pd.DataFrame, candidate_df: pd.DataFrame, source_name: str) -> pd.DataFrame:
    ref = set(_norm(reference_df["indicateur"]))
    cand = _norm(candidate_df["indicateur"])
    unmatched = sorted({value for value in cand if value and value not in ref})
    return pd.DataFrame({"source_table": source_name, "indicateur": unmatched})

def _duplicates(df: pd.DataFrame, source_name: str) -> pd.DataFrame:
    work = df.copy()
    work["indicateur_norm"] = _norm(work["indicateur"])
    work["year_value"] = pd.to_numeric(work["year_value"], errors="coerce")

    group_cols = ["indicateur_norm", "year_value"]

    if source_name == "actions" and "month_value" in work.columns:
        work["month_value"] = pd.to_numeric(work["month_value"], errors="coerce")
        group_cols = ["indicateur_norm", "year_value", "month_value"]

    dup = (
        work[(work["indicateur_norm"] != "") & work["year_value"].notna()]
        .groupby(group_cols, as_index=False)
        .size()
    )

    dup = dup[dup["size"] > 1].sort_values(["size", "indicateur_norm"], ascending=[False, True])
    dup["source_table"] = source_name
    return dup

def run_quality_checks(data: dict[str, pd.DataFrame]) -> dict:
    indicateurs = data["indicateurs"]
    objectifs = data["objectifs"]
    realises = data["realises"]
    actions = data["actions"]

    return {
        "summary": {
            "indicateurs": _summary(indicateurs, "indicateur", None),
            "objectifs": _summary(objectifs),
            "realises": _summary(realises),
            "actions": _summary(actions),
        },
        "unmatched": {
            "objectifs": _unmatched(indicateurs, objectifs, "objectifs"),
            "realises": _unmatched(indicateurs, realises, "realises"),
            "actions": _unmatched(indicateurs, actions, "actions"),
        },
        "duplicates": {
            "objectifs": _duplicates(objectifs, "objectifs"),
            "realises": _duplicates(realises, "realises"),
            "actions": _duplicates(actions, "actions"),
        },
    }

def print_quality_report(report: dict) -> None:
    print("\n=== SUMMARY ===")
    for name, values in report["summary"].items():
        print(f"{name}: {values}")

    print("\n=== UNMATCHED INDICATEURS ===")
    for name, df in report["unmatched"].items():
        print(f"{name}: {len(df)}")
        if not df.empty:
            print(df.head(10).to_string(index=False))

    print("\n=== DUPLICATES ===")
    for name, df in report["duplicates"].items():
        print(f"{name}: {len(df)}")
        if not df.empty:
            print(df.head(10).to_string(index=False))
