from __future__ import annotations

import json
from datetime import datetime

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.config import RISK_MODEL_ARTIFACT, RISK_MODEL_METADATA, SETTINGS
from ml.pipeline.features import FEATURE_COLUMNS, get_model_input_frame


def train_risk_model(training_df: pd.DataFrame, model_name: str | None = None, label_source: str = "business_table", extra_metadata: dict | None = None) -> dict:
    if training_df.empty:
        raise ValueError("training_df is empty")

    X = get_model_input_frame(training_df)
    y = pd.to_numeric(training_df["risk_label"], errors="coerce").fillna(0).astype(int)
    if y.nunique() < 2:
        raise ValueError("risk_label must contain both classes 0 and 1")

    selected_model = model_name or SETTINGS.risk_model_name
    if selected_model == "random_forest":
        estimator = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, class_weight="balanced", random_state=SETTINGS.random_state)
    else:
        estimator = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("model", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=SETTINGS.random_state)),
            ]
        )

    stratify = y if y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=SETTINGS.random_state,
        stratify=stratify,
    )
    estimator.fit(X_train, y_train)

    y_pred = estimator.predict(X_test)
    y_proba = estimator.predict_proba(X_test)[:, 1] if hasattr(estimator, "predict_proba") else y_pred
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_proba)) if y_test.nunique() > 1 else None,
    }

    version = datetime.now().strftime("%Y%m%d%H%M")
    metadata = {
        "version": version,
        "model_name": selected_model,
        "label_source": label_source,
        "training_rows": int(len(training_df)),
        "positive_labels": int(y.sum()),
        "features": FEATURE_COLUMNS,
        "metrics": metrics,
        **(extra_metadata or {}),
    }

    RISK_MODEL_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": estimator, "metadata": metadata}, RISK_MODEL_ARTIFACT)
    RISK_MODEL_METADATA.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "artifact_path": str(RISK_MODEL_ARTIFACT),
        "metadata_path": str(RISK_MODEL_METADATA),
        "metadata": metadata,
    }
