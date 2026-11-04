import sys, json, pickle, numpy as np, pandas as pd, os
from sklearn.preprocessing import LabelEncoder

input_data = json.loads(sys.argv[1])

BASE_MODELS = os.environ.get(
    "ML_MODELS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
)

with open(os.path.join(BASE_MODELS, "random_forest_regressor.pkl"),    "rb") as f: model_reg = pickle.load(f)
with open(os.path.join(BASE_MODELS, "random_forest_classifier.pkl"),"rb") as f: model_clf = pickle.load(f)

df = pd.read_csv(os.path.join(BASE_MODELS, "kpi_dataset_dw_ml_clean.csv"),
                 sep=";", on_bad_lines="skip", engine="python")

# Nettoyer colonnes
df.columns = [c.strip().strip('"').strip("'") for c in df.columns]
df["Indicateur"] = df["Indicateur"].str.strip()

# Convertir numériques
cols_num = ["Annee","Mois","Objectif","Realisation","Ecart",
            "taux_realisation","lag_1","lag_2","lag_3",
            "rolling_mean","rolling_std","tendance","indicateur_enc"]
for col in cols_num:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

le = LabelEncoder()
le.fit(df["Indicateur"])

def encode_from_dataset(source_column, value):
    if source_column not in df.columns:
        return 0
    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {item: index for index, item in enumerate(sorted(values.unique()))}
    return codes.get(str(value or "").strip(), 0)

FEATURES = ["indicateur_enc","signe_enc","unite_enc","Annee","Mois","Objectif",
            "lag_1","lag_2","lag_3","rolling_mean","rolling_std","tendance"]

ind  = input_data["indicateur"]
hist = df[df["Indicateur"] == ind].sort_values(["Annee","Mois"])

if hist.empty:
    print(json.dumps({"error": f"Indicateur {ind} introuvable"}))
    sys.exit()

lag1 = float(hist.iloc[-1]["Realisation"])
lag2 = float(hist.iloc[-2]["Realisation"]) if len(hist) >= 2 else lag1
lag3 = float(hist.iloc[-3]["Realisation"]) if len(hist) >= 3 else lag1

X = pd.DataFrame([{
    "indicateur_enc": int(le.transform([ind])[0]),
    "signe_enc"     : encode_from_dataset("Signe", hist.iloc[-1].get("Signe", "")),
    "unite_enc"     : encode_from_dataset("Unite", hist.iloc[-1].get("Unite", "")),
    "Annee"         : input_data["annee"],
    "Mois"          : input_data["mois"],
    "Objectif"      : input_data["objectif"],
    "lag_1"         : lag1,
    "lag_2"         : lag2,
    "lag_3"         : lag3,
    "rolling_mean"  : float(hist["Realisation"].tail(3).mean()),
    "rolling_std"   : float(hist["Realisation"].tail(3).std(ddof=0)),
    "tendance"      : lag1 - lag2,
}])

realisation = float(max(0, model_reg.predict(X[FEATURES])[0]))
taux        = round(realisation / input_data["objectif"] * 100, 1)
atteint     = bool(model_clf.predict(X[FEATURES])[0])
proba       = float(model_clf.predict_proba(X[FEATURES])[0][1])
statut      = ("critique"  if taux < 70  else
               "attention" if taux < 90  else
               "ok"        if taux <= 100 else "depasse")

print(json.dumps({
    "realisation_predite": round(realisation, 2),
    "taux_predit"        : taux,
    "atteint"            : atteint,
    "probabilite"        : round(proba, 3),
    "statut"             : statut,
}))
