"""
Train and compare fraud detection models on the real dataset.
Uses stratified split and class-weight / scale_pos_weight for imbalance.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split

from ml.preprocessing.config import MODELS_DIR
from ml.preprocessing.preprocess import load_raw_dataset, prepare_features, save_processed_dataset

try:
    from ml.inference.predict import export_scored_dataset
except ImportError:
    export_scored_dataset = None

try:
    from xgboost import XGBClassifier
except ImportError:
    XGBClassifier = None

try:
    from lightgbm import LGBMClassifier
except ImportError:
    LGBMClassifier = None


RANDOM_STATE = 42


def evaluate_model(y_true: np.ndarray, y_prob: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }


def get_models(scale_weight: float) -> dict:
    models = {
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        "isolation_forest": IsolationForest(
            n_estimators=200,
            contamination=0.01,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    }
    if XGBClassifier is not None:
        models["xgboost"] = XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            scale_pos_weight=scale_weight,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    if LGBMClassifier is not None:
        models["lightgbm"] = LGBMClassifier(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbose=-1,
        )
    return models


def train_all() -> dict:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    raw = load_raw_dataset()
    prepared = prepare_features(raw)
    save_processed_dataset(prepared)

    X = prepared.X
    y = prepared.y.values
    feature_names = prepared.feature_names

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    fraud_ratio = max(y_train.sum(), 1) / max(len(y_train) - y_train.sum(), 1)
    scale_weight = (len(y_train) - y_train.sum()) / max(y_train.sum(), 1)

    results = {}
    best_name = None
    best_pr_auc = -1.0
    trained = {}

    for name, model in get_models(scale_weight).items():
        print(f"Training {name}...")
        if name == "isolation_forest":
            model.fit(X_train)
            raw_scores = -model.decision_function(X_test)
            y_prob = (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-9)
            y_pred = (y_prob >= np.percentile(y_prob, 99)).astype(int)
        else:
            model.fit(X_train, y_train)
            y_prob = model.predict_proba(X_test)[:, 1]
            y_pred = model.predict(X_test)

        metrics = evaluate_model(y_test, y_prob, y_pred)
        results[name] = metrics
        trained[name] = model

        if metrics["pr_auc"] > best_pr_auc:
            best_pr_auc = metrics["pr_auc"]
            best_name = name

        joblib.dump(model, MODELS_DIR / f"{name}.joblib")

    best_model = trained[best_name]
    joblib.dump(best_model, MODELS_DIR / "best_model.joblib")
    joblib.dump(feature_names, MODELS_DIR / "feature_names.joblib")

    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_[0])
    else:
        importances = np.zeros(len(feature_names))

    importance_df = pd.DataFrame({"feature": feature_names, "importance": importances})
    importance_df = importance_df.sort_values("importance", ascending=False)
    importance_df.to_csv(MODELS_DIR / "feature_importance.csv", index=False)

    summary = {
        "best_model": best_name,
        "metrics": results,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "fraud_ratio": round(float(fraud_ratio), 6),
    }

    with open(MODELS_DIR / "training_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    if export_scored_dataset is not None:
        print("Exporting scored transactions for dashboard...")
        export_scored_dataset()

    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    train_all()
