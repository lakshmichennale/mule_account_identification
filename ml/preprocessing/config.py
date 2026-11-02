"""Dataset column mapping discovered from compressed_data.csv inspection."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "compressed_data.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"
PROCESSED_DIR = PROJECT_ROOT / "ml" / "datasets"

TARGET_COLUMN = "F3924"
ID_COLUMN = "Unnamed: 0"

# Semantic metadata columns (identified from dataset inspection)
METADATA_COLUMNS = {
    "F2230": "reporting_month",
    "F3886": "account_type",
    "F3887": "account_id",
    "F3888": "transaction_date",
    "F3889": "activity_window",
    "F3890": "transaction_type",
    "F3891": "occupation",
    "F3892": "gender",
    "F3893": "merchant_category",
    "F3894": "customer_age",
    "F3895": "transaction_amount",
    "F3896": "balance_amount",
    "F3897": "behavior_count_1",
    "F3898": "behavior_count_2",
    "F3899": "behavior_count_3",
}

CATEGORICAL_COLUMNS = [
    "F2230",
    "F3886",
    "F3888",
    "F3889",
    "F3890",
    "F3891",
    "F3892",
    "F3893",
]

COUNT_FEATURE_COLUMNS = ["F3919", "F3920", "F3921", "F3922", "F3923"]
BINARY_FLAG_COLUMNS = [f"F{i}" for i in range(3900, 3919)]

# Columns to exclude from model features
EXCLUDE_FROM_FEATURES = {
    ID_COLUMN,
    TARGET_COLUMN,
    "F3911",  # constant zero column
}

# Dataset limitations documented for UI
DATASET_LIMITATIONS = [
    "No explicit sender/receiver account pairs — network graph uses account activity clusters only.",
    "Feature names F1–F3923 are anonymized engineered attributes from the source financial logs.",
    "Device/hardware telemetry is not present — hardware demo mode uses simulated responses.",
]

RISK_THRESHOLDS = {
    "low": (0, 40),
    "medium": (40, 70),
    "high": (70, 90),
    "critical": (90, 101),
}
