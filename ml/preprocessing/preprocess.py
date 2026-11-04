"""
Preprocessing pipeline for compressed_data.csv

Decisions documented:
- Drop constant columns (no information gain)
- Drop columns with >95% missing values (too sparse to impute reliably)
- Median imputation for numeric features (robust to outliers)
- Label encoding for categoricals fitted on training data only
- Do NOT drop duplicate rows (full-row duplicates = 0; preserve all 9082 records)
- Class imbalance handled at training via class weights / scale_pos_weight
- Derived features from existing columns only (account velocity, amount ratios)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from ml.preprocessing.config import (
    ARTIFACTS_DIR,
    CATEGORICAL_COLUMNS,
    DATASET_PATH,
    EXCLUDE_FROM_FEATURES,
    ID_COLUMN,
    METADATA_COLUMNS,
    PROCESSED_DIR,
    TARGET_COLUMN,
)


@dataclass
class PreprocessResult:
    X: pd.DataFrame
    y: pd.Series
    feature_names: list[str]
    metadata: pd.DataFrame
    report: dict[str, Any]


def load_raw_dataset(path: Path | None = None) -> pd.DataFrame:
    path = path or DATASET_PATH
    df = pd.read_csv(path, low_memory=False)
    if ID_COLUMN in df.columns:
        df = df.rename(columns={ID_COLUMN: "transaction_id"})
    return df


def inspect_dataset(df: pd.DataFrame) -> dict[str, Any]:
    target = df[TARGET_COLUMN]
    null_pct = (df.isna().sum() / len(df) * 100).sort_values(ascending=False)
    constant_cols = [c for c in df.columns if df[c].nunique(dropna=False) <= 1]

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "duplicates": int(df.duplicated().sum()),
        "target_column": TARGET_COLUMN,
        "fraud_count": int((target == 1).sum()),
        "legitimate_count": int((target == 0).sum()),
        "fraud_percentage": round(float((target == 1).mean() * 100), 4),
        "columns_with_missing": int((null_pct > 0).sum()),
        "columns_over_50pct_missing": int((null_pct > 50).sum()),
        "columns_over_95pct_missing": int((null_pct > 95).sum()),
        "constant_columns": constant_cols,
        "unique_accounts": int(df["F3887"].nunique()) if "F3887" in df.columns else None,
        "avg_transaction_amount": float(df["F3895"].mean()) if "F3895" in df.columns else None,
        "metadata_columns": METADATA_COLUMNS,
        "limitations": [
            "No sender/receiver pairs — network graph uses account co-activity.",
            "Feature names F1–F3923 are anonymized engineered attributes.",
            "Device/hardware telemetry absent — demo mode simulates hardware.",
        ],
    }


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Derive fraud-related features from columns that exist in the dataset."""
    out = df.copy()

    if "F3895" in out.columns and "F3896" in out.columns:
        out["derived_amount_balance_ratio"] = out["F3895"] / (out["F3896"].replace(0, np.nan) + 1e-6)

    if "F3898" in out.columns and "F3899" in out.columns:
        out["derived_behavior_sum"] = out["F3898"].fillna(0) + out["F3899"].fillna(0)
        out["derived_behavior_ratio"] = out["F3898"] / (out["F3899"].replace(0, np.nan) + 1e-6)

    if "F3887" in out.columns:
        acct_counts = out.groupby("F3887")["F3887"].transform("count")
        out["derived_account_txn_count"] = acct_counts

        if "F3895" in out.columns:
            acct_amount_sum = out.groupby("F3887")["F3895"].transform("sum")
            out["derived_account_total_amount"] = acct_amount_sum
            out["derived_amount_vs_account_avg"] = out["F3895"] / (acct_amount_sum / acct_counts + 1e-6)

    if "F3888" in out.columns:
        parsed = pd.to_datetime(out["F3888"], format="%m-%d-%Y", errors="coerce")
        out["derived_txn_month"] = parsed.dt.month.fillna(0).astype(int)
        out["derived_txn_day"] = parsed.dt.day.fillna(0).astype(int)

    if "F3894" in out.columns and "F3895" in out.columns:
        out["derived_amount_per_age"] = out["F3895"] / (out["F3894"].replace(0, np.nan) + 1e-6)

    return out


def _fit_encoders(df: pd.DataFrame, cat_cols: list[str]) -> dict[str, LabelEncoder]:
    encoders: dict[str, LabelEncoder] = {}
    for col in cat_cols:
        if col not in df.columns:
            continue
        le = LabelEncoder()
        filled = df[col].astype(str).replace("nan", "MISSING")
        le.fit(filled)
        encoders[col] = le
    return encoders


def _apply_encoders(df: pd.DataFrame, encoders: dict[str, LabelEncoder]) -> pd.DataFrame:
    out = df.copy()
    for col, le in encoders.items():
        if col not in out.columns:
            continue
        filled = out[col].astype(str).replace("nan", "MISSING")
        known = set(le.classes_)
        filled = filled.apply(lambda x: x if x in known else "MISSING")
        if "MISSING" not in known:
            filled = filled.apply(lambda x: le.classes_[0] if x not in known else x)
        out[col] = le.transform(filled)
    return out


def _select_feature_columns(df: pd.DataFrame, drop_cols: list[str]) -> pd.DataFrame:
    feature_df = df.drop(columns=[c for c in drop_cols if c in df.columns])
    if "transaction_id" in feature_df.columns:
        feature_df = feature_df.drop(columns=["transaction_id"])
    return feature_df


def fit_preprocess(df: pd.DataFrame, save_artifact: bool = True) -> tuple[PreprocessResult, dict]:
    report = inspect_dataset(df)
    df = engineer_features(df)
    y = df[TARGET_COLUMN].astype(int)

    metadata_cols = [
        "transaction_id",
        "F2230",
        "F3886",
        "F3887",
        "F3888",
        "F3889",
        "F3890",
        "F3891",
        "F3892",
        "F3893",
        "F3894",
        "F3895",
        "F3896",
        "F3897",
        "F3898",
        "F3899",
        "F3900",
        "F3901",
        "F3902",
        "F3903",
        "F3904",
        "F3905",
        "F3906",
        "F3907",
        "F3908",
        "F3909",
        "F3910",
        "F3919",
        "F3920",
        "F3921",
        "F3922",
        "F3923",
        "F3799",
        "F3800",
        "F3811",
        "F3836",
        TARGET_COLUMN,
    ]
    metadata_cols = [c for c in metadata_cols if c in df.columns]
    metadata = df[metadata_cols].copy()

    feature_df = df.drop(columns=[TARGET_COLUMN])
    null_pct = feature_df.isna().mean()
    drop_missing = null_pct[null_pct > 0.95].index.tolist()
    constant_cols = [c for c in feature_df.columns if feature_df[c].nunique(dropna=False) <= 1]
    drop_cols = list(set(drop_missing + constant_cols + list(EXCLUDE_FROM_FEATURES)))
    drop_cols = [c for c in drop_cols if c in feature_df.columns and c != "transaction_id"]

    trimmed = feature_df.drop(columns=drop_cols)
    cat_present = [c for c in CATEGORICAL_COLUMNS if c in trimmed.columns]
    encoders = _fit_encoders(trimmed, cat_present)
    encoded = _apply_encoders(trimmed, encoders)

    numeric_cols = [c for c in encoded.columns if c not in cat_present and c != "transaction_id"]
    medians = {col: encoded[col].median() for col in numeric_cols}
    for col in numeric_cols:
        encoded[col] = encoded[col].fillna(medians[col])

    X = _select_feature_columns(encoded, [])

    report["preprocessing"] = {
        "dropped_high_missing": len(drop_missing),
        "dropped_constant": len(constant_cols),
        "categorical_encoded": cat_present,
        "numeric_median_imputed": len(numeric_cols),
        "derived_features_added": [c for c in X.columns if c.startswith("derived_")],
        "final_feature_count": X.shape[1],
    }

    artifact = {
        "encoders": encoders,
        "dropped_columns": drop_cols,
        "feature_names": list(X.columns),
        "medians": medians,
        "cat_columns": cat_present,
        "report": report,
    }

    if save_artifact:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(artifact, ARTIFACTS_DIR / "preprocessor.joblib")
        with open(ARTIFACTS_DIR / "dataset_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

    result = PreprocessResult(
        X=X,
        y=y,
        feature_names=list(X.columns),
        metadata=metadata,
        report=report,
    )
    return result, artifact


def transform_with_artifact(df: pd.DataFrame, artifact: dict) -> PreprocessResult:
    """Apply saved preprocessing to new/batch data without refitting."""
    df = engineer_features(df)
    y = df[TARGET_COLUMN].astype(int) if TARGET_COLUMN in df.columns else pd.Series([0] * len(df))

    metadata_cols = [
        "transaction_id",
        "F2230",
        "F3886",
        "F3887",
        "F3888",
        "F3889",
        "F3890",
        "F3891",
        "F3892",
        "F3893",
        "F3894",
        "F3895",
        "F3896",
        "F3897",
        "F3898",
        "F3899",
        "F3900",
        "F3901",
        "F3902",
        "F3903",
        "F3904",
        "F3905",
        "F3906",
        "F3907",
        "F3908",
        "F3909",
        "F3910",
        "F3919",
        "F3920",
        "F3921",
        "F3922",
        "F3923",
        "F3799",
        "F3800",
        "F3811",
        "F3836",
        TARGET_COLUMN,
    ]
    metadata_cols = [c for c in metadata_cols if c in df.columns]
    metadata = df[metadata_cols].copy()

    feature_df = df.drop(columns=[c for c in [TARGET_COLUMN] if c in df.columns])
    drop_cols = artifact["dropped_columns"]
    trimmed = feature_df.drop(columns=[c for c in drop_cols if c in feature_df.columns])

    encoded = _apply_encoders(trimmed, artifact["encoders"])
    for col, median in artifact["medians"].items():
        if col in encoded.columns:
            encoded[col] = encoded[col].fillna(median)

    X = _select_feature_columns(encoded, [])
    for col in artifact["feature_names"]:
        if col not in X.columns:
            X[col] = artifact["medians"].get(col, 0)
    X = X[artifact["feature_names"]]

    return PreprocessResult(
        X=X,
        y=y,
        feature_names=artifact["feature_names"],
        metadata=metadata,
        report=artifact["report"],
    )


def prepare_features(df: pd.DataFrame) -> PreprocessResult:
    """Fit preprocessing on provided dataframe (training path)."""
    result, _ = fit_preprocess(df)
    return result


def load_preprocessor() -> dict:
    return joblib.load(ARTIFACTS_DIR / "preprocessor.joblib")


def save_processed_dataset(result: PreprocessResult) -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out = result.metadata.copy()
    out["risk_label"] = result.y
    path = PROCESSED_DIR / "processed_transactions.parquet"
    out.to_parquet(path, index=False)
    return path


if __name__ == "__main__":
    raw = load_raw_dataset()
    result = prepare_features(raw)
    path = save_processed_dataset(result)
    print(json.dumps(result.report, indent=2))
    print(f"Processed dataset saved to {path}")
