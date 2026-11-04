from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.pipeline.extract import extract_all_sources
from ml.pipeline.quality_checks import run_quality_checks, print_quality_report
from ml.pipeline.canonicalize import canonicalize_all, print_canonicalization_report
from ml.pipeline.detect_anomalies import run_anomaly_detection, print_anomaly_report
from ml.pipeline.score_risk import run_risk_scoring, print_risk_report
from ml.pipeline.build_suggestions import run_build_suggestions, print_suggestions_report
from ml.pipeline.train_risk import run_train_risk_with_strategy_evaluation, print_training_report
from ml.db.repository import insert_anomalies, insert_risk_scores, insert_suggestions, clear_previous_results

def main():
    print("AAF KPI ML - data quality audit")

    data = extract_all_sources()
    quality_report = run_quality_checks(data)
    canonical_report = canonicalize_all(data)

    print_quality_report(quality_report)
    print_canonicalization_report(canonical_report)
    print("\nStep 3 OK: quality audit + canonicalization ready")

    # Étape 4: Détection d'anomalies
    anomaly_report = run_anomaly_detection(canonical_report["tables"])
    print_anomaly_report(anomaly_report)
    insert_anomalies(anomaly_report["anomalies"])
    print("\nStep 4 OK: anomaly detection complete")

    # Étape 5: Scoring de risque
    risk_report = run_risk_scoring(
        canonical_report["tables"],
        anomaly_report["anomalies"],
        data.get("risk_labels"),
    )
    print_risk_report(risk_report)
    insert_risk_scores(risk_report["risk_scores"])
    print("\nStep 5 OK: risk scoring complete")

    # Etape 6: Generation de suggestions d'actions
    suggestions_report = run_build_suggestions(canonical_report["tables"], anomaly_report["anomalies"], risk_report["risk_scores"])
    print_suggestions_report(suggestions_report)
    insert_suggestions(suggestions_report["suggestions"])
    print("\nStep 6 OK: action suggestions complete")
    
    # Etape 7: Re-entrainement du modele de risque avec evaluation de strategies
    print("\n" + "=" * 60)
    print("  STEP 7: Risk Model Training with Strategy Evaluation")
    print("=" * 60)
    try:
        training_report = run_train_risk_with_strategy_evaluation(model_name="random_forest")
        print_training_report(training_report)
        print("\nStep 7 OK: risk model training complete with strategy evaluation")
    except Exception as e:
        print(f"[WARN] Risk model training skipped: {str(e)}")
        print("       Using existing model or bootstrap strategy")

if __name__ == "__main__":
    main()
