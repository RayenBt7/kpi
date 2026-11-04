from __future__ import annotations

from ml.models.risk_model import train_risk_model
from ml.models.binary_rf_strategies import BinaryRiskStrategies
from ml.pipeline.canonicalize import canonicalize_all
from ml.pipeline.detect_anomalies import run_anomaly_detection
from ml.pipeline.extract import extract_all_sources
from ml.pipeline.features import build_risk_feature_frame, get_model_input_frame
from ml.pipeline.risk_labels import attach_business_risk_labels, prepare_business_risk_labels

import pandas as pd


def build_training_dataset(canonicalized_tables: dict, anomalies_df, risk_labels_df) -> tuple:
    features_df = build_risk_feature_frame(canonicalized_tables, anomalies_df)
    labeled_df = attach_business_risk_labels(features_df, risk_labels_df)
    available_labels = prepare_business_risk_labels(risk_labels_df)
    training_df = labeled_df[labeled_df["risk_label"].isin([0, 1])].copy()

    label_metadata = {
        "label_source": "business_table",
        "available_labels": int(len(available_labels)),
        "training_rows": int(len(training_df)),
        "positive_rate": float(training_df["risk_label"].mean()) if not training_df.empty else 0.0,
    }
    return training_df, label_metadata


def run_train_risk(model_name: str | None = None) -> dict:
    raw_data = extract_all_sources()
    canonical_report = canonicalize_all(raw_data)
    anomaly_report = run_anomaly_detection(canonical_report["tables"])

    training_df, label_metadata = build_training_dataset(
        canonical_report["tables"],
        anomaly_report["anomalies"],
        raw_data.get("risk_labels"),
    )
    if training_df.empty:
        raise ValueError(
            "Aucun label metier valide trouve dans dbo.ml_risk_labels. "
            "Flux recommande: "
            "1) python -m ml.scripts.export_risk_label_candidates "
            "2) renseigner risk_label/risk_level dans le CSV "
            "3) python -m ml.scripts.import_risk_labels "
            "4) relancer python -m ml.pipeline.train_risk."
        )

    training_result = train_risk_model(
        training_df,
        model_name=model_name,
        label_source=label_metadata["label_source"],
        extra_metadata={
            "available_business_labels": label_metadata["available_labels"],
            "training_business_rows": label_metadata["training_rows"],
            "business_positive_rate": label_metadata["positive_rate"],
        },
    )

    return {
        "training_df": training_df,
        "anomaly_summary": anomaly_report["summary"],
        "model": training_result["metadata"],
        "artifact_path": training_result["artifact_path"],
        "metadata_path": training_result["metadata_path"],
    }


def print_training_report(report: dict) -> None:
    model = report["model"]
    metrics = model.get("metrics", {})

    print("\n=== RISK MODEL TRAINING SUMMARY ===")
    print(f"Version: {model.get('version')}")
    print(f"Model: {model.get('model_name')}")
    print(f"Label source: {model.get('label_source')}")
    print(f"Training rows: {model.get('training_rows')}")
    print(f"Positive labels: {model.get('positive_labels')}")
    print(f"Accuracy: {metrics.get('accuracy'):.3f}" if metrics.get("accuracy") is not None else "Accuracy: n/a")
    print(f"Precision: {metrics.get('precision'):.3f}" if metrics.get("precision") is not None else "Precision: n/a")
    print(f"Recall: {metrics.get('recall'):.3f}" if metrics.get("recall") is not None else "Recall: n/a")
    if metrics.get("roc_auc") is not None:
        print(f"ROC AUC: {metrics.get('roc_auc'):.3f}")
    print(f"Artifact: {report['artifact_path']}")
    print(f"Metadata: {report['metadata_path']}")


def main() -> None:
    report = run_train_risk()
    print_training_report(report)


def run_train_risk_with_strategy_evaluation(model_name: str | None = None) -> dict:
    """
    Entraîne le modèle de risque en évaluant les stratégies d'équilibrage
    (balanced vs SMOTE) et en sélectionnant la meilleure.
    
    Args:
        model_name: Nom du modèle (ex: 'random_forest')
        
    Returns:
        Dict avec résultats d'entraînement et comparaison de stratégies
    """
    print("\n" + "=" * 60)
    print("  TRAINING RISK MODEL WITH STRATEGY EVALUATION")
    print("=" * 60)
    
    # Extraire et préparer les données
    raw_data = extract_all_sources()
    canonical_report = canonicalize_all(raw_data)
    anomaly_report = run_anomaly_detection(canonical_report["tables"])

    training_df, label_metadata = build_training_dataset(
        canonical_report["tables"],
        anomaly_report["anomalies"],
        raw_data.get("risk_labels"),
    )
    
    if training_df.empty:
        raise ValueError(
            "Aucun label metier valide trouve dans dbo.ml_risk_labels. "
            "Flux recommande: "
            "1) python -m ml.scripts.export_risk_label_candidates "
            "2) renseigner risk_label/risk_level dans le CSV "
            "3) python -m ml.scripts.import_risk_labels "
            "4) relancer python -m ml.pipeline.train_risk."
        )
    
    # Préparer les features
    X = get_model_input_frame(training_df)
    y = pd.to_numeric(training_df["risk_label"], errors="coerce").fillna(0).astype(int)
    
    print(f"\n[OK] Training data: {len(X)} samples")
    print(f"    Positive rate: {y.mean():.1%}")
    print(f"    Class distribution: {dict(y.value_counts())}")
    
    # Évaluer les stratégies
    if y.nunique() < 2:
        print("\n[WARN] Insufficient class diversity - using bootstrap labels")
        training_result = train_risk_model(
            training_df,
            model_name=model_name,
            label_source=label_metadata["label_source"],
            extra_metadata={
                "available_business_labels": label_metadata["available_labels"],
                "training_business_rows": label_metadata["training_rows"],
                "business_positive_rate": label_metadata["positive_rate"],
            },
        )
    else:
        print("\n" + "-" * 60)
        print("  Comparing equilibration strategies...")
        print("-" * 60)
        
        strategies = BinaryRiskStrategies(X, y, random_state=42)
        
        result_balanced = strategies.train_with_balanced_weight()
        result_smote = strategies.train_with_smote()
        
        best_result = strategies.select_best_strategy(result_balanced, result_smote)
        strategy_name = best_result['name'].upper()
        
        print(f"\n[BEST] Selected strategy: {strategy_name}")
        print(f"    F1 score: {best_result['f1_mean']:.3f} +/- {best_result['f1_std']:.3f}")
        
        # Entraîner le modèle final avec la meilleure stratégie
        training_result = train_risk_model(
            training_df,
            model_name=model_name,
            label_source=label_metadata["label_source"],
            extra_metadata={
                "available_business_labels": label_metadata["available_labels"],
                "training_business_rows": label_metadata["training_rows"],
                "business_positive_rate": label_metadata["positive_rate"],
                "strategy_evaluation": {
                    "selected": strategy_name,
                    "f1_balanced": result_balanced['f1_mean'],
                    "f1_smote": result_smote['f1_mean'],
                },
            },
        )
    
    return {
        "training_df": training_df,
        "anomaly_summary": anomaly_report["summary"],
        "model": training_result["metadata"],
        "artifact_path": training_result["artifact_path"],
        "metadata_path": training_result["metadata_path"],
    }


if __name__ == "__main__":
    main()
