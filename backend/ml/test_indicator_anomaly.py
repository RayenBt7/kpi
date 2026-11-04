import argparse
import os
import pickle

import numpy as np
import pandas as pd


BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")),
)
DATASET_PATH = os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv")
MODEL_PATH = os.path.join(BASE_MODELS, "anomaly_isolation_forest.pkl")

ANOMALY_FEATURES = [
    "processus_enc",
    "signe_enc",
    "unite_enc",
    "Objectif",
    "Realisation",
    "Ecart",
    "taux_realisation",
    "lag_1",
    "lag_2",
    "lag_3",
    "rolling_mean",
    "rolling_std",
    "tendance",
    "plan_action_open_count",
    "plan_action_late_count",
]


def to_number(value, default=0):
    if value is None or value == "":
        return default
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return default


def encode_column(df, source_column, encoded_column):
    if source_column not in df.columns:
        df[encoded_column] = 0
        return

    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {value: index for index, value in enumerate(sorted(values.unique()))}
    df[encoded_column] = values.map(codes).fillna(0)


def prepare_dataset():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset introuvable: {DATASET_PATH}")
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Modele anomalies introuvable: {MODEL_PATH}")

    df = pd.read_csv(DATASET_PATH, sep=";", on_bad_lines="skip", engine="python")
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]

    encode_column(df, "Processus", "processus_enc")
    encode_column(df, "Signe", "signe_enc")
    encode_column(df, "Unite", "unite_enc")

    for feature in ANOMALY_FEATURES:
        if feature not in df.columns:
            df[feature] = 0
        df[feature] = pd.to_numeric(df[feature], errors="coerce")

    return df


def build_code_maps(df):
    maps = {}
    for source_column in ["Processus", "Signe", "Unite"]:
        if source_column not in df.columns:
            maps[source_column] = {"": 0}
            continue

        values = df[source_column].fillna("").astype(str).str.strip()
        maps[source_column] = {
            value: index for index, value in enumerate(sorted(values.unique()))
        }
    return maps


def most_recent_indicator_rows(df, indicator):
    indicator_values = df["Indicateur"].fillna("").astype(str).str.strip()
    rows = df[indicator_values.str.lower() == indicator.strip().lower()].copy()
    if rows.empty:
        return rows

    rows["Annee"] = pd.to_numeric(rows["Annee"], errors="coerce")
    rows["Mois"] = pd.to_numeric(rows["Mois"], errors="coerce")
    return rows.sort_values(["Annee", "Mois"])


def latest_text_value(rows, column, fallback=""):
    if rows.empty or column not in rows.columns:
        return fallback

    values = rows[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    return values.iloc[-1] if not values.empty else fallback


def build_custom_row(df, args):
    rows = most_recent_indicator_rows(df, args.indicator)
    code_maps = build_code_maps(df)

    processus = args.processus or latest_text_value(rows, "Processus")
    signe = args.signe or latest_text_value(rows, "Signe")
    unite = args.unite or latest_text_value(rows, "Unite")

    objectif = to_number(args.objectif)
    realisation = to_number(args.realisation)
    ecart = realisation - objectif
    taux_realisation = (realisation / objectif) * 100 if objectif else 0

    recent_realisation = []
    if not rows.empty and "Realisation" in rows.columns:
        recent_realisation = (
            pd.to_numeric(rows["Realisation"], errors="coerce")
            .dropna()
            .astype(float)
            .tolist()
        )

    lag_1 = to_number(args.lag_1, recent_realisation[-1] if recent_realisation else realisation)
    lag_2 = to_number(args.lag_2, recent_realisation[-2] if len(recent_realisation) >= 2 else lag_1)
    lag_3 = to_number(args.lag_3, recent_realisation[-3] if len(recent_realisation) >= 3 else lag_2)
    rolling_values = [lag_3, lag_2, lag_1]
    rolling_mean = sum(rolling_values) / len(rolling_values)
    rolling_std = float(np.std(rolling_values))
    tendance = lag_1 - lag_2

    row = {
        "processus_enc": code_maps["Processus"].get(processus, 0),
        "signe_enc": code_maps["Signe"].get(signe, 0),
        "unite_enc": code_maps["Unite"].get(unite, 0),
        "Objectif": objectif,
        "Realisation": realisation,
        "Ecart": ecart,
        "taux_realisation": taux_realisation,
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_3": lag_3,
        "rolling_mean": rolling_mean,
        "rolling_std": rolling_std,
        "tendance": tendance,
        "plan_action_open_count": to_number(args.plan_action_open_count),
        "plan_action_late_count": to_number(args.plan_action_late_count),
    }

    display = {
        "Indicateur": args.indicator,
        "Processus": processus,
        "Signe": signe,
        "Unite": unite,
        "Objectif": objectif,
        "Realisation": realisation,
        "Ecart": ecart,
        "taux_realisation": taux_realisation,
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_3": lag_3,
        "rolling_mean": rolling_mean,
        "rolling_std": rolling_std,
        "tendance": tendance,
        "plan_action_open_count": int(row["plan_action_open_count"]),
        "plan_action_late_count": int(row["plan_action_late_count"]),
    }

    return pd.DataFrame([row], columns=ANOMALY_FEATURES), display


def main():
    parser = argparse.ArgumentParser(
        description="Tester si un indicateur est detecte comme anomalie par IsolationForest."
    )
    parser.add_argument("indicator", help="Code indicateur, exemple: c10_kunden")
    parser.add_argument("--year", type=int, help="Filtrer par annee, exemple: 2024")
    parser.add_argument("--month", type=int, help="Filtrer par mois, exemple: 5")
    parser.add_argument("--objectif", help="Objectif a tester, exemple: 100")
    parser.add_argument("--realisation", help="Realisation a tester, exemple: 40")
    parser.add_argument("--processus", help="Processus si l'indicateur n'existe pas dans le CSV")
    parser.add_argument("--signe", help="Signe si besoin, exemple: >=, <= ou =")
    parser.add_argument("--unite", help="Unite si besoin, exemple: %")
    parser.add_argument("--lag-1", dest="lag_1", help="Valeur precedente optionnelle")
    parser.add_argument("--lag-2", dest="lag_2", help="Deuxieme valeur precedente optionnelle")
    parser.add_argument("--lag-3", dest="lag_3", help="Troisieme valeur precedente optionnelle")
    parser.add_argument("--plan-action-open-count", default=0, help="Nombre de plans d'action ouverts")
    parser.add_argument("--plan-action-late-count", default=0, help="Nombre de plans d'action en retard")
    args = parser.parse_args()

    df = prepare_dataset()

    with open(MODEL_PATH, "rb") as file:
        model = pickle.load(file)

    if args.objectif is not None or args.realisation is not None:
        if args.objectif is None or args.realisation is None:
            raise ValueError("Pour une simulation, donnez --objectif et --realisation.")

        custom_X, display = build_custom_row(df, args)
        custom_X = custom_X.replace([np.inf, -np.inf], np.nan).fillna(0)
        prediction = int(model.predict(custom_X)[0] == -1)
        score = float(-model.decision_function(custom_X)[0])

        print("Test personnalise")
        for key, value in display.items():
            print(f"{key}: {value}")
        print(f"is_anomaly: {prediction}")
        print(f"anomaly_score: {score}")
        return

    X = df[ANOMALY_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)

    df["anomaly_score"] = -model.decision_function(X)
    df["is_anomaly"] = (model.predict(X) == -1).astype(int)

    indicator_values = df["Indicateur"].fillna("").astype(str).str.strip()
    result = df[indicator_values.str.lower() == args.indicator.strip().lower()].copy()

    if args.year is not None:
        result = result[pd.to_numeric(result["Annee"], errors="coerce") == args.year]
    if args.month is not None:
        result = result[pd.to_numeric(result["Mois"], errors="coerce") == args.month]

    if result.empty:
        print(f"Aucune ligne trouvee pour l'indicateur: {args.indicator}")
        return

    columns = [
        "Indicateur",
        "Annee",
        "Mois",
        "Objectif",
        "Realisation",
        "Ecart",
        "taux_realisation",
        "is_anomaly",
        "anomaly_score",
    ]
    result = result[columns].sort_values(["Annee", "Mois"])

    print(result.to_string(index=False))
    print()
    print(f"Total lignes: {len(result)}")
    print(f"Anomalies detectees: {int(result['is_anomaly'].sum())}")


if __name__ == "__main__":
    main()
