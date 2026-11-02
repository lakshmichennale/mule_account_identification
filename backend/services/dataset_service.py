"""Dataset statistics and transaction queries from real scored data."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from ml.preprocessing.config import (
    ARTIFACTS_DIR,
    DATASET_LIMITATIONS,
    METADATA_COLUMNS,
    MODELS_DIR,
    TARGET_COLUMN,
)
from ml.preprocessing.preprocess import load_raw_dataset

COLUMN_LABELS = {
    "F3887": "accountId",
    "F3888": "transactionDate",
    "F3895": "amount",
    "F3890": "transactionType",
    "F3886": "accountType",
    "F3891": "occupation",
    "F3893": "merchantCategory",
    "F3894": "customerAge",
    "F2230": "reportingMonth",
    "F3889": "activityWindow",
    TARGET_COLUMN: "actualFraudLabel",
}


def _mask_account_id(account_id: int | str) -> str:
    s = str(account_id)
    if len(s) <= 2:
        return f"ACC-***{s}"
    return f"ACC-***{s[-3:]}"


@lru_cache(maxsize=1)
def load_scored_transactions() -> pd.DataFrame:
    scored_path = ARTIFACTS_DIR / "scored_transactions.parquet"
    if scored_path.exists():
        df = pd.read_parquet(scored_path)
    else:
        from ml.inference.predict import export_scored_dataset

        df = export_scored_dataset()

    if "transaction_id" not in df.columns and df.index.name != "transaction_id":
        df = df.reset_index(drop=True)
        df["transaction_id"] = df.index

    return df


def get_dataset_info() -> dict[str, Any]:
    report_path = ARTIFACTS_DIR / "dataset_report.json"
    info = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    training_path = MODELS_DIR / "training_summary.json"
    training = json.loads(training_path.read_text(encoding="utf-8")) if training_path.exists() else {}
    return {
        "mode": "real_data",
        "dataset": info,
        "model": training,
        "limitations": DATASET_LIMITATIONS,
        "metadataColumns": METADATA_COLUMNS,
    }


def get_dashboard_stats() -> dict[str, Any]:
    df = load_scored_transactions()
    total = len(df)
    fraud_col = "actual_label" if "actual_label" in df.columns else TARGET_COLUMN
    fraud_count = int((df[fraud_col] == 1).sum())
    legit_count = total - fraud_count

    risk_dist = df["risk_level"].value_counts().to_dict() if "risk_level" in df.columns else {}
    monthly = (
        df.groupby("F2230")
        .agg(transactions=("transaction_id", "count"), fraud=(fraud_col, "sum"))
        .reset_index()
        .rename(columns={"F2230": "month"})
    )
    monthly["fraudRate"] = (monthly["fraud"] / monthly["transactions"] * 100).round(2)

    top_risk = df.nlargest(10, "risk_score")
    high_risk_accounts = (
        df.groupby("F3887")
        .agg(
            txn_count=("transaction_id", "count"),
            avg_risk=("risk_score", "mean"),
            max_risk=("risk_score", "max"),
            fraud_count=(fraud_col, "sum"),
            total_amount=("F3895", "sum"),
        )
        .reset_index()
        .nlargest(10, "avg_risk")
    )

    return {
        "totalTransactions": total,
        "fraudulentTransactions": fraud_count,
        "legitimateTransactions": legit_count,
        "fraudPercentage": round(fraud_count / total * 100, 4) if total else 0,
        "averageTransactionAmount": round(float(df["F3895"].mean()), 2),
        "uniqueAccounts": int(df["F3887"].nunique()),
        "riskDistribution": risk_dist,
        "fraudTrends": monthly.to_dict(orient="records"),
        "highestRiskTransactions": [_serialize_txn_row(r) for _, r in top_risk.iterrows()],
        "highRiskAccounts": [
            {
                "accountId": _mask_account_id(r["F3887"]),
                "rawAccountId": int(r["F3887"]),
                "transactionCount": int(r["txn_count"]),
                "avgRiskScore": round(float(r["avg_risk"]), 1),
                "maxRiskScore": int(r["max_risk"]),
                "fraudCount": int(r["fraud_count"]),
                "totalAmount": int(r["total_amount"]),
            }
            for _, r in high_risk_accounts.iterrows()
        ],
    }


def _serialize_txn_row(row: pd.Series) -> dict[str, Any]:
    fraud_col = "actual_label" if "actual_label" in row.index else TARGET_COLUMN
    return {
        "transactionId": int(row.get("transaction_id", 0)),
        "accountId": _mask_account_id(row.get("F3887", 0)),
        "rawAccountId": int(row.get("F3887", 0)),
        "date": str(row.get("F3888", "")),
        "amount": int(row.get("F3895", 0)),
        "transactionType": str(row.get("F3890", "")),
        "accountType": str(row.get("F3886", "")),
        "occupation": str(row.get("F3891", "")),
        "merchantCategory": str(row.get("F3893", "")),
        "riskScore": int(row.get("risk_score", 0)),
        "riskLevel": str(row.get("risk_level", "low")),
        "prediction": str(row.get("prediction", "legitimate")),
        "actualLabel": int(row.get(fraud_col, 0)),
        "reportingMonth": str(row.get("F2230", "")),
    }


def query_transactions(
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    fraud_only: bool | None = None,
    risk_level: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort_by: str = "risk_score",
    sort_dir: str = "desc",
) -> dict[str, Any]:
    df = load_scored_transactions().copy()
    fraud_col = "actual_label" if "actual_label" in df.columns else TARGET_COLUMN

    if search:
        s = search.lower()
        mask = (
            df["F3887"].astype(str).str.contains(s, na=False)
            | df["F3890"].astype(str).str.lower().str.contains(s, na=False)
            | df["F3891"].astype(str).str.lower().str.contains(s, na=False)
            | df["F3893"].astype(str).str.lower().str.contains(s, na=False)
            | df["transaction_id"].astype(str).str.contains(s, na=False)
        )
        df = df[mask]

    if fraud_only is True:
        df = df[df[fraud_col] == 1]
    elif fraud_only is False:
        df = df[df[fraud_col] == 0]

    if risk_level:
        df = df[df["risk_level"].str.lower() == risk_level.lower()]

    if min_amount is not None:
        df = df[df["F3895"] >= min_amount]
    if max_amount is not None:
        df = df[df["F3895"] <= max_amount]

    if date_from:
        df = df[df["F3888"] >= date_from]
    if date_to:
        df = df[df["F3888"] <= date_to]

    sort_col = {
        "risk_score": "risk_score",
        "amount": "F3895",
        "date": "F3888",
        "account": "F3887",
    }.get(sort_by, "risk_score")

    ascending = sort_dir.lower() == "asc"
    df = df.sort_values(sort_col, ascending=ascending)

    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start : start + page_size]

    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, (total + page_size - 1) // page_size),
        "transactions": [_serialize_txn_row(r) for _, r in page_df.iterrows()],
    }


def get_transaction_detail(transaction_id: int) -> dict[str, Any] | None:
    df = load_scored_transactions()
    match = df[df["transaction_id"] == transaction_id]
    if match.empty:
        return None

    row = match.iloc[0]
    detail = _serialize_txn_row(row)
    detail["customerAge"] = float(row.get("F3894", 0)) if pd.notna(row.get("F3894")) else None
    detail["activityWindow"] = str(row.get("F3889", ""))
    detail["balanceAmount"] = int(row.get("F3896", 0))
    detail["behaviorCounts"] = {
        "count1": int(row.get("F3897", 0)),
        "count2": int(row.get("F3898", 0)),
        "count3": int(row.get("F3899", 0)),
    }
    detail["confidence"] = round(float(row.get("fraud_probability", 0)), 4)

    from ml.inference.predict import predict_transaction

    row_idx = int(match.index[0])
    ml_result = predict_transaction(row_index=row_idx)
    detail["reasons"] = ml_result.get("reasons", [])
    return detail
