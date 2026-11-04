"""Dataset column mapping discovered from compressed_data.csv and Description.xlsx."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "compressed_data.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"
PROCESSED_DIR = PROJECT_ROOT / "ml" / "datasets"

TARGET_COLUMN = "F3924"
ID_COLUMN = "Unnamed: 0"

# Semantic metadata columns from Description.xlsx
METADATA_COLUMNS = {
    "F2230": "reporting_month",
    "F3886": "product_name",
    "F3887": "tenure_months",
    "F3888": "account_open_date",
    "F3889": "vintage_bucket",
    "F3890": "area_category",
    "F3891": "occupation",
    "F3892": "gender",
    "F3893": "segmentation_class",
    "F3894": "customer_age",
    "F3895": "min_incident_score",
    "F3896": "max_incident_score",
    "F3897": "count_incident_gt650",
    "F3898": "min_resolve_days",
    "F3899": "max_resolve_days",
    "F3799": "total_amount_31d",
    "F1813": "digital_amount_31d",
}

# Alert description flags
ALERT_FLAG_COLUMNS = {
    "F3900": "high_val_upi",
    "F3901": "multi_debits",
    "F3902": "multi_pg_txns",
    "F3903": "pwd_changed_large_xfers",
    "F3904": "funds_from_multi_users",
    "F3905": "risky_country_txns",
    "F3906": "status_change_after_wd",
    "F3907": "unusual_time_txns",
    "F3908": "multi_upi_debits",
    "F3909": "failed_upi_txns",
    "F3910": "one_to_many_upi",
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
BINARY_FLAG_COLUMNS = [f"F{i}" for i in range(3900, 3912)]

# Columns to exclude from model features
# CRITICAL DISCOVERIES:
# 1. F2230 (MNTH) is pure temporal extraction leakage (all 9001 legit are Oct25, all 81 fraud are Sep/Nov/Dec25)!
# 2. F3912 (FRAUD_SUSPECTED), F3913 (OTHER_RESOLUTION), F3914 (FALSE_POSITIVE), F3915 (UNATTENDED)
#    are post-investigation outcome leakage!
EXCLUDE_FROM_FEATURES = {
    ID_COLUMN,
    TARGET_COLUMN,
    "F2230",  # Temporal batch leakage
    "F3911",  # constant zero column
    "F3912",  # FRAUD_SUSPECTED (Target leakage)
    "F3913",  # OTHER_RESOLUTION (Outcome leakage)
    "F3914",  # FALSE_POSITIVE (Outcome leakage)
    "F3915",  # UNATTENDED (Outcome leakage)
}

# Platform operational notes
DATASET_LIMITATIONS = [
    "Account-level AML alert telemetry spanning 9,082 enterprise accounts.",
    "Feature names F1–F3885 represent financial ratios across 7, 14, and 31-day lookback windows.",
    "Post-investigation resolution flags (F3912–F3915) strictly excluded to maintain 100% data integrity.",
]

RISK_THRESHOLDS = {
    "low": (0, 40),
    "medium": (40, 70),
    "high": (70, 90),
    "critical": (90, 101),
}
