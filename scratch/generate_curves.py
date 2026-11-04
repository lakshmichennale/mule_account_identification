"""Compute genuine ROC and PR curve points for the evaluated models and save to ml/models/curves_data.json."""

from __future__ import annotations

import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.metrics import roc_curve, precision_recall_curve
from sklearn.model_selection import train_test_split

from ml.preprocessing.config import MODELS_DIR
from ml.preprocessing.preprocess import load_raw_dataset, prepare_features

RANDOM_STATE = 42

def generate_curves():
    print("Preparing features...")
    prepared = prepare_features(load_raw_dataset())
    X = prepared.X
    y = prepared.y.values

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    curves = {}
    
    # Evaluate LightGBM
    lgb_model = joblib.load(MODELS_DIR / "lightgbm.joblib")
    y_prob_lgb = lgb_model.predict_proba(X_test)[:, 1]

    fpr, tpr, roc_thresh = roc_curve(y_test, y_prob_lgb)
    prec, rec, pr_thresh = precision_recall_curve(y_test, y_prob_lgb)

    # Sample points for fast frontend rendering (e.g., ~50-80 points)
    def sample_curve(x_arr, y_arr, thresh_arr=None, max_pts=60):
        n = len(x_arr)
        if n <= max_pts:
            indices = np.arange(n)
        else:
            indices = np.linspace(0, n - 1, max_pts, dtype=int)
            # Ensure index 0 and index n-1 are included
            indices = np.unique(indices)
        
        points = []
        for idx in indices:
            pt = {
                "x": round(float(x_arr[idx]), 4),
                "y": round(float(y_arr[idx]), 4)
            }
            if thresh_arr is not None and idx < len(thresh_arr):
                pt["threshold"] = round(float(thresh_arr[idx]), 4)
            points.append(pt)
        return points

    roc_pts = sample_curve(fpr, tpr, roc_thresh)
    # PR curve: recall is x-axis (0 to 1), precision is y-axis
    pr_pts = sample_curve(rec, prec, pr_thresh)

    curves["lightgbm"] = {
        "roc_curve": roc_pts,
        "pr_curve": pr_pts
    }

    # Evaluate XGBoost for multi-model comparison
    xgb_model = joblib.load(MODELS_DIR / "xgboost.joblib")
    y_prob_xgb = xgb_model.predict_proba(X_test)[:, 1]
    fpr_xgb, tpr_xgb, _ = roc_curve(y_test, y_prob_xgb)
    prec_xgb, rec_xgb, _ = precision_recall_curve(y_test, y_prob_xgb)

    curves["xgboost"] = {
        "roc_curve": sample_curve(fpr_xgb, tpr_xgb),
        "pr_curve": sample_curve(rec_xgb, prec_xgb)
    }

    # Evaluate Random Forest
    rf_model = joblib.load(MODELS_DIR / "random_forest.joblib")
    y_prob_rf = rf_model.predict_proba(X_test)[:, 1]
    fpr_rf, tpr_rf, _ = roc_curve(y_test, y_prob_rf)
    prec_rf, rec_rf, _ = precision_recall_curve(y_test, y_prob_rf)

    curves["random_forest"] = {
        "roc_curve": sample_curve(fpr_rf, tpr_rf),
        "pr_curve": sample_curve(rec_rf, prec_rf)
    }

    out_file = MODELS_DIR / "curves_data.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(curves, f, indent=2)

    print(f"Successfully generated curves data with {len(roc_pts)} ROC points and {len(pr_pts)} PR points -> {out_file}")

if __name__ == "__main__":
    generate_curves()
