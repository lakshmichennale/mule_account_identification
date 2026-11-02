"""Inference utilities: fraud probability, risk score, reasons."""

from __future__ import annotations

from typing import Any

import joblib
import numpy as np
import pandas as pd

from ml.preprocessing.config import ARTIFACTS_DIR, MODELS_DIR, RISK_THRESHOLDS, TARGET_COLUMN
from ml.preprocessing.preprocess import (
    engineer_features,
    fit_preprocess,
    load_preprocessor,
    load_raw_dataset,
    transform_with_artifact,
)

FEATURE_LABELS = {
    "F3895": "Transaction amount",
    "F3898": "Transaction frequency pattern",
    "F3899": "Behavioral activity count",
    "F3923": "Suspicious activity indicator",
    "F3920": "Account activity level",
    "F3921": "Cross-channel activity",
    "F3919": "Historical transaction count",
    "F3890": "Transaction type",
    "F3889": "Activity window deviation",
    "F3894": "Customer age profile",
    "derived_account_txn_count": "Account transaction velocity",
    "derived_amount_vs_account_avg": "Amount vs account average",
    "derived_behavior_sum": "Combined behavioral activity",
    "derived_amount_balance_ratio": "Amount-to-balance ratio",
}


def risk_level_from_score(score: float) -> str:
    for level, (lo, hi) in RISK_THRESHOLDS.items():
        if lo <= score < hi:
            return level
    return "critical"


def load_model_bundle():
    model = joblib.load(MODELS_DIR / "best_model.joblib")
    feature_names = joblib.load(MODELS_DIR / "feature_names.joblib")
    preprocessor = load_preprocessor()
    importance_path = MODELS_DIR / "feature_importance.csv"
    importances = pd.read_csv(importance_path) if importance_path.exists() else None
    return model, feature_names, preprocessor, importances


def _predict_proba(model, X: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        return float(model.predict_proba(X)[0, 1])
    raw_scores = -model.decision_function(X)
    return float((raw_scores[0] - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-9))


def _reasons_from_features(
    row: pd.Series,
    importances: pd.DataFrame | None,
    prob: float,
    top_n: int = 4,
) -> list[str]:
    if importances is None or importances.empty:
        return ["Elevated model fraud probability based on transaction feature profile"]

    reasons = []
    ranked = importances.head(25)["feature"].tolist()
    for feat in ranked:
        if feat not in row.index:
            continue
        label = FEATURE_LABELS.get(feat, feat.replace("derived_", "").replace("_", " "))
        val = row[feat]
        if pd.isna(val):
            continue
        try:
            fval = float(val)
        except (TypeError, ValueError):
            continue
        if feat.startswith("derived_") and abs(fval) > 1.5:
            reasons.append(f"Unusual {label.lower()} (value: {round(fval, 2)})")
        elif feat in {"F3895", "F3898", "F3899", "F3923", "F3920"} and fval > 0:
            reasons.append(f"Elevated {label.lower()} (value: {round(fval, 2)})")
        elif feat.startswith("F39") and fval != 0:
            reasons.append(f"Unusual {label.lower()}")
        if len(reasons) >= top_n:
            break

    if prob >= 0.7 and len(reasons) < top_n:
        reasons.append("High-confidence fraud pattern detected by ensemble model")
    return reasons or ["Anomalous combination of transaction features detected by model"]


def predict_transaction(payload: dict[str, Any] | None = None, row_index: int | None = None) -> dict:
    model, _, preprocessor, importances = load_model_bundle()

    if row_index is not None:
        raw = load_raw_dataset()
        row_raw = raw.iloc[row_index : row_index + 1]
        prepared = transform_with_artifact(row_raw, preprocessor)
        meta_row = row_raw.iloc[0]
    elif payload:
        raw = load_raw_dataset()
        template = raw.iloc[0:1].copy()
        for key, value in payload.items():
            if key in template.columns:
                template[key] = value
        prepared = transform_with_artifact(template, preprocessor)
        meta_row = None
    else:
        raise ValueError("Provide payload or row_index")

    X = prepared.X
    prob = _predict_proba(model, X)
    risk_score = int(round(prob * 100))
    level = risk_level_from_score(risk_score)
    prediction = "fraud" if prob >= 0.5 else "legitimate"
    reasons = _reasons_from_features(X.iloc[0], importances, prob)

    result = {
        "prediction": prediction,
        "riskScore": risk_score,
        "riskLevel": level,
        "confidence": round(prob, 4),
        "reasons": reasons,
    }

    if meta_row is not None:
        tid = meta_row.get("transaction_id", row_index)
        result["transactionId"] = int(tid) if pd.notna(tid) else row_index
        result["actualLabel"] = int(meta_row.get(TARGET_COLUMN, 0))

    return result


def batch_predict_scores(limit: int | None = None) -> pd.DataFrame:
    """Score entire dataset for dashboard serving."""
    model, _, preprocessor, _ = load_model_bundle()
    raw = load_raw_dataset()
    if limit:
        raw = raw.head(limit)

    prepared = transform_with_artifact(raw, preprocessor)
    X = prepared.X

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[:, 1]
    else:
        raw_scores = -model.decision_function(X)
        probs = (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-9)

    meta = prepared.metadata.copy()
    meta["fraud_probability"] = probs
    meta["risk_score"] = (probs * 100).astype(int)
    meta["risk_level"] = meta["risk_score"].apply(risk_level_from_score)
    meta["prediction"] = np.where(probs >= 0.5, "fraud", "legitimate")
    meta["actual_label"] = prepared.y.values
    return meta


def export_scored_dataset() -> pd.DataFrame:
    scored = batch_predict_scores()
    out_path = ARTIFACTS_DIR / "scored_transactions.parquet"
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    scored.to_parquet(out_path, index=False)
    return scored


if __name__ == "__main__":
    print(predict_transaction(row_index=0))
