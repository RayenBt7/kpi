from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
RISK_MODEL_ARTIFACT = ARTIFACTS_DIR / "risk_model.joblib"
RISK_MODEL_METADATA = ARTIFACTS_DIR / "risk_model_metadata.json"

load_dotenv(Path(__file__).resolve().parents[2] / "backend" / ".env")


@dataclass(frozen=True)
class Settings:
    db_driver: str = os.getenv("ML_DB_DRIVER", "ODBC Driver 17 for SQL Server")
    db_server: str = os.getenv("ML_DB_SERVER", r"(local)\SQLEXPRESS02")
    db_name: str = os.getenv("ML_DB_NAME", "kpi")
    dw_name: str = os.getenv("ML_DW_NAME", "KPI_DataWarehouse")
    db_user: str = os.getenv("ML_DB_USER", "sa")
    db_password: str = os.getenv("ML_DB_PASSWORD", "rayen123")
    risk_model_name: str = os.getenv("ML_RISK_MODEL_NAME", "logistic_regression")
    risk_model_version: str = os.getenv("ML_RISK_MODEL_VERSION", "risk-model-v2")
    risk_score_medium_threshold: float = float(os.getenv("ML_RISK_SCORE_MEDIUM_THRESHOLD", "0.35"))
    risk_score_high_threshold: float = float(os.getenv("ML_RISK_SCORE_HIGH_THRESHOLD", "0.70"))
    risk_model_min_training_rows: int = int(os.getenv("ML_RISK_MODEL_MIN_TRAINING_ROWS", "50"))
    risk_model_min_positive_labels: int = int(os.getenv("ML_RISK_MODEL_MIN_POSITIVE_LABELS", "8"))
    risk_model_min_precision: float = float(os.getenv("ML_RISK_MODEL_MIN_PRECISION", "0.05"))
    risk_model_min_recall: float = float(os.getenv("ML_RISK_MODEL_MIN_RECALL", "0.05"))
    risk_model_min_f1: float = float(os.getenv("ML_RISK_MODEL_MIN_F1", "0.10"))
    random_state: int = int(os.getenv("ML_RANDOM_STATE", "42"))


def get_connection_string(db_name: str):
    return (
        f"DRIVER={{{SETTINGS.db_driver}}};"
        f"SERVER={SETTINGS.db_server};"
        f"DATABASE={db_name};"
        f"UID={SETTINGS.db_user};"
        f"PWD={SETTINGS.db_password};"
    )

SETTINGS = Settings()
