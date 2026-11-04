import argparse
import html
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
DEFAULT_OUTPUT_PATH = os.path.join(BASE_MODELS, "anomaly_visualization.html")

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


def encode_column(df, source_column, encoded_column):
    if source_column not in df.columns:
        df[encoded_column] = 0
        return

    values = df[source_column].fillna("").astype(str).str.strip()
    codes = {value: index for index, value in enumerate(sorted(values.unique()))}
    df[encoded_column] = values.map(codes).fillna(0)


def load_scored_dataset():
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

    X = df[ANOMALY_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0)
    with open(MODEL_PATH, "rb") as file:
        model = pickle.load(file)

    df["anomaly_score"] = -model.decision_function(X)
    df["is_anomaly"] = (model.predict(X) == -1).astype(int)
    df["Annee"] = pd.to_numeric(df.get("Annee"), errors="coerce").fillna(0).astype(int)
    df["Mois"] = pd.to_numeric(df.get("Mois"), errors="coerce").fillna(0).astype(int)
    df["period"] = df["Annee"].astype(str) + "-" + df["Mois"].astype(str).str.zfill(2)
    return df


def scale(value, min_value, max_value, out_min, out_max):
    if max_value == min_value:
        return (out_min + out_max) / 2
    ratio = (value - min_value) / (max_value - min_value)
    return out_min + ratio * (out_max - out_min)


def build_svg(rows):
    width = 1100
    height = 420
    left = 70
    right = 30
    top = 30
    bottom = 70
    plot_w = width - left - right
    plot_h = height - top - bottom

    values = pd.to_numeric(rows["Realisation"], errors="coerce").fillna(0).tolist()
    if not values:
        values = [0]
    y_min = min(values)
    y_max = max(values)
    padding = (y_max - y_min) * 0.1 or 1
    y_min -= padding
    y_max += padding

    points = []
    line_points = []
    total = len(rows)
    for index, row in enumerate(rows.to_dict("records")):
        x = left + (plot_w * index / max(total - 1, 1))
        y = top + plot_h - scale(float(row.get("Realisation") or 0), y_min, y_max, 0, plot_h)
        line_points.append(f"{x:.2f},{y:.2f}")
        color = "#dc2626" if int(row.get("is_anomaly") or 0) else "#2563eb"
        radius = 7 if int(row.get("is_anomaly") or 0) else 4
        title = html.escape(
            f"{row.get('period')} | Realisation={row.get('Realisation')} | "
            f"Score={float(row.get('anomaly_score') or 0):.4f}"
        )
        points.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{radius}" fill="{color}">'
            f"<title>{title}</title></circle>"
        )

    x_labels = []
    label_step = max(total // 12, 1)
    for index, row in enumerate(rows.to_dict("records")):
        if index % label_step != 0 and index != total - 1:
            continue
        x = left + (plot_w * index / max(total - 1, 1))
        x_labels.append(
            f'<text x="{x:.2f}" y="{height - 28}" text-anchor="middle" '
            f'font-size="11" fill="#475569">{html.escape(str(row.get("period")))}</text>'
        )

    return f"""
<svg viewBox="0 0 {width} {height}" role="img" aria-label="Graphique anomalies">
  <rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff"/>
  <line x1="{left}" y1="{top}" x2="{left}" y2="{height - bottom}" stroke="#94a3b8"/>
  <line x1="{left}" y1="{height - bottom}" x2="{width - right}" y2="{height - bottom}" stroke="#94a3b8"/>
  <text x="12" y="28" font-size="13" fill="#475569">Realisation</text>
  <text x="{left}" y="{top + 5}" text-anchor="end" font-size="11" fill="#64748b">{y_max:.2f}</text>
  <text x="{left}" y="{height - bottom}" text-anchor="end" font-size="11" fill="#64748b">{y_min:.2f}</text>
  <polyline fill="none" stroke="#2563eb" stroke-width="2" points="{" ".join(line_points)}"/>
  {"".join(points)}
  {"".join(x_labels)}
</svg>
"""


def build_table(rows):
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
    header = "".join(f"<th>{html.escape(column)}</th>" for column in columns)
    body = []
    for row in rows[columns].to_dict("records"):
        cells = []
        for column in columns:
            value = row.get(column)
            if column == "anomaly_score":
                value = f"{float(value):.6f}"
            cells.append(f"<td>{html.escape(str(value))}</td>")
        class_name = " class=\"anomaly\"" if int(row.get("is_anomaly") or 0) else ""
        body.append(f"<tr{class_name}>{''.join(cells)}</tr>")
    return f"<table><thead><tr>{header}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def build_html(rows, title):
    total = len(rows)
    anomalies = int(rows["is_anomaly"].sum())
    max_score = float(rows["anomaly_score"].max()) if total else 0
    min_score = float(rows["anomaly_score"].min()) if total else 0
    svg = build_svg(rows)
    table = build_table(rows)

    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    body {{
      margin: 0;
      font-family: Arial, sans-serif;
      color: #111827;
      background: #f8fafc;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px;
    }}
    h1 {{
      margin: 0 0 16px;
      font-size: 24px;
    }}
    .stats {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }}
    .stat {{
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
    }}
    .label {{
      color: #64748b;
      font-size: 12px;
      margin-bottom: 6px;
    }}
    .value {{
      font-size: 20px;
      font-weight: 700;
    }}
    .panel {{
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin-bottom: 18px;
      overflow: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    th, td {{
      padding: 9px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      white-space: nowrap;
    }}
    th {{
      background: #f1f5f9;
      color: #334155;
      position: sticky;
      top: 0;
    }}
    tr.anomaly td {{
      background: #fef2f2;
      color: #991b1b;
      font-weight: 700;
    }}
    .legend {{
      display: flex;
      gap: 18px;
      margin: 0 0 10px;
      color: #475569;
      font-size: 13px;
    }}
    .dot {{
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }}
    @media (max-width: 760px) {{
      main {{ padding: 16px; }}
      .stats {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>{html.escape(title)}</h1>
    <section class="stats">
      <div class="stat"><div class="label">Lignes</div><div class="value">{total}</div></div>
      <div class="stat"><div class="label">Anomalies</div><div class="value">{anomalies}</div></div>
      <div class="stat"><div class="label">Score min</div><div class="value">{min_score:.4f}</div></div>
      <div class="stat"><div class="label">Score max</div><div class="value">{max_score:.4f}</div></div>
    </section>
    <section class="panel">
      <div style="padding: 14px 14px 0">
        <div class="legend">
          <span><span class="dot" style="background:#2563eb"></span>Normal</span>
          <span><span class="dot" style="background:#dc2626"></span>Anomalie</span>
        </div>
      </div>
      {svg}
    </section>
    <section class="panel">
      {table}
    </section>
  </main>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Generer une visualisation HTML des anomalies.")
    parser.add_argument("--indicator", help="Filtrer un indicateur, exemple: c10_kunden")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_PATH, help="Chemin du fichier HTML genere")
    args = parser.parse_args()

    df = load_scored_dataset()
    if args.indicator:
        indicator_values = df["Indicateur"].fillna("").astype(str).str.strip()
        df = df[indicator_values.str.lower() == args.indicator.strip().lower()].copy()
        if df.empty:
            raise ValueError(f"Aucune ligne trouvee pour l'indicateur: {args.indicator}")
        title = f"Anomalies - {args.indicator}"
    else:
        title = "Anomalies - Tous les indicateurs"

    df = df.sort_values(["Indicateur", "Annee", "Mois"])
    html_content = build_html(df, title)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as file:
        file.write(html_content)

    print(args.output)


if __name__ == "__main__":
    main()
