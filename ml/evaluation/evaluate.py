"""Evaluate saved models and print comparison report."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from ml.preprocessing.config import MODELS_DIR
from ml.preprocessing.preprocess import load_raw_dataset, prepare_features

RANDOM_STATE = 42


def evaluate_saved_models() -> dict:
    prepared = prepare_features(load_raw_dataset())
    X = prepared.X
    y = prepared.y.values
    feature_names = joblib.load(MODELS_DIR / "feature_names.joblib")

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    report = {}
    for model_path in MODELS_DIR.glob("*.joblib"):
        name = model_path.stem
        if name in {"best_model", "feature_names", "preprocessor"}:
            continue
        model = joblib.load(model_path)
        if name == "isolation_forest":
            raw_scores = -model.decision_function(X_test)
            y_prob = (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-9)
            y_pred = (y_prob >= np.percentile(y_prob, 99)).astype(int)
        elif hasattr(model, "predict_proba"):
            y_prob = model.predict_proba(X_test)[:, 1]
            y_pred = model.predict(X_test)
        else:
            continue

        report[name] = {
            "roc_auc": float(roc_auc_score(y_test, y_prob)),
            "pr_auc": float(average_precision_score(y_test, y_prob)),
            "classification_report": classification_report(y_test, y_pred, output_dict=True),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        }

    out_path = MODELS_DIR / "evaluation_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    evaluate_saved_models()
