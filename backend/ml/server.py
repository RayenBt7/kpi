from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd, numpy as np, pickle, os
from sklearn.preprocessing import LabelEncoder

app = FastAPI()

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Chargement UNE SEULE FOIS au démarrage ──
BASE = r"C:\Users\77ray\OneDrive\Documents\Bureau\AAF\backend\models"

print("Chargement des modèles...")
with open(f"{BASE}/random_forest_regressor.pkl",    "rb") as f: model_reg = pickle.load(f)
with open(f"{BASE}/random_forest_classifier.pkl","rb") as f: model_clf = pickle.load(f)

df = pd.read_csv(f"{BASE}/kpi_dataset_dw_ml_clean.csv", sep=";", on_bad_lines="skip", engine="python")
df.columns = [c.strip() for c in df.columns]
df["Indicateur"] = df["Indicateur"].str.strip()

cols_num = ["Annee","Mois","Objectif","Realisation","lag_1","lag_2",
            "lag_3","rolling_mean","rolling_std","tendance","indicateur_enc"]
for col in cols_num:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

le = LabelEncoder()
le.fit(df["Indicateur"])
print(f"✓ Prêt — {df['Indicateur'].nunique()} indicateurs chargés")

def encode_from_dataset(source_column, value):
    if source_column not in df.columns:
        return 0
    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {item: index for index, item in enumerate(sorted(values.unique()))}
    return codes.get(str(value or "").strip(), 0)

FEATURES = ["indicateur_enc","signe_enc","unite_enc","Annee","Mois","Objectif",
            "lag_1","lag_2","lag_3","rolling_mean","rolling_std","tendance"]

# ── Routes ──
class PredictIn(BaseModel):
    indicateur: str
    annee     : int
    mois      : int
    objectif  : float

@app.get("/health")
def health():
    return {"status": "ok", "indicateurs": int(df["Indicateur"].nunique())}

@app.post("/predict")
def predict(req: PredictIn):
    hist = df[df["Indicateur"] == req.indicateur].sort_values(["Annee","Mois"])
    if hist.empty:
        return {"error": f"Indicateur {req.indicateur} introuvable"}

    lag1 = float(hist.iloc[-1]["Realisation"])
    lag2 = float(hist.iloc[-2]["Realisation"]) if len(hist) >= 2 else lag1
    lag3 = float(hist.iloc[-3]["Realisation"]) if len(hist) >= 3 else lag1

    X = pd.DataFrame([{
        "indicateur_enc": int(le.transform([req.indicateur])[0]),
        "signe_enc"     : encode_from_dataset("Signe", hist.iloc[-1].get("Signe", "")),
        "unite_enc"     : encode_from_dataset("Unite", hist.iloc[-1].get("Unite", "")),
        "Annee"         : req.annee,
        "Mois"          : req.mois,
        "Objectif"      : req.objectif,
        "lag_1"         : lag1,
        "lag_2"         : lag2,
        "lag_3"         : lag3,
        "rolling_mean"  : float(hist["Realisation"].tail(3).mean()),
        "rolling_std"   : float(hist["Realisation"].tail(3).std(ddof=0)),
        "tendance"      : lag1 - lag2,
    }])

    realisation = float(max(0, model_reg.predict(X[FEATURES])[0]))
    taux        = round(realisation / req.objectif * 100, 1)
    atteint     = bool(model_clf.predict(X[FEATURES])[0])
    proba       = float(model_clf.predict_proba(X[FEATURES])[0][1])
    statut      = ("critique"  if taux < 70  else
                   "attention" if taux < 90  else
                   "ok"        if taux <= 100 else "depasse")

    return {
        "indicateur"         : req.indicateur,
        "realisation_predite": round(realisation, 2),
        "taux_predit"        : taux,
        "atteint"            : atteint,
        "probabilite"        : round(proba, 3),
        "statut"             : statut,
    }

@app.get("/dashboard")
def dashboard():
    df_pred = pd.read_csv(f"{BASE}/predictions_finales.csv", sep=";", on_bad_lines="skip", engine="python")
    records = df_pred.to_dict(orient="records")
    summary = {
        "total"    : len(records),
        "critique" : sum(1 for r in records if "Critique"  in str(r.get("Statut",""))),
        "attention": sum(1 for r in records if "Attention" in str(r.get("Statut",""))),
        "ok"       : sum(1 for r in records if "OK"        in str(r.get("Statut",""))),
        "depasse"  : sum(1 for r in records if "Dépassé"   in str(r.get("Statut",""))),
    }
    return {"summary": summary, "predictions": records}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
