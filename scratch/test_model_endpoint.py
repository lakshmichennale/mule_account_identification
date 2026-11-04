"""Test GET /api/model/analytics endpoint."""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_model_analytics_endpoint():
    res = client.post("/api/auth/login", json={"email": "admin@sentinel.bank", "password": "Admin@Sentinel2026!"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["accessToken"]

    # 1. Test unauthenticated access should return 401
    resp_unauth = client.get("/api/model/analytics")
    print(f"Unauth status: {resp_unauth.status_code}")
    assert resp_unauth.status_code == 401, f"Expected 401 unauth, got {resp_unauth.status_code}"

    # 2. Test authenticated access
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/model/analytics", headers=headers)
    print(f"Auth status: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

    data = resp.json()
    print("Keys in response:", list(data.keys()))

    # Check modelInfo
    assert "modelInfo" in data
    assert data["modelInfo"]["name"].startswith("LightGBM")
    print("Model name:", data["modelInfo"]["name"])
    print("Version:", data["modelInfo"]["version"])

    # Check championMetrics
    assert "championMetrics" in data
    metrics = data["championMetrics"]
    print("PR-AUC:", metrics["prAuc"])
    print("ROC-AUC:", metrics["rocAuc"])
    print("Precision:", metrics["precision"])
    print("Recall:", metrics["recall"])
    assert metrics["prAuc"] > 0.90
    assert metrics["rocAuc"] > 0.99

    # Check confusionMatrix
    assert "confusionMatrix" in data
    cm = data["confusionMatrix"]
    print("Confusion Matrix:", cm)
    assert cm["trueNegatives"] == 1800
    assert cm["falsePositives"] == 1
    assert cm["falseNegatives"] == 3
    assert cm["truePositives"] == 13

    # Check benchmarks
    assert "benchmarks" in data
    print(f"Algorithm benchmarks count: {len(data['benchmarks'])}")
    for bm in data["benchmarks"]:
        print(f" - {bm['name']}: PR-AUC={bm['prAuc']}, Status={bm['status']}")

    # Check topFeatures
    assert "topFeatures" in data
    print(f"Top features count: {len(data['topFeatures'])}")
    print(f"Top 1 feature: {data['topFeatures'][0]}")

    # Check curves
    assert "curves" in data
    assert "lightgbm" in data["curves"]
    print(f"LightGBM ROC curve points: {len(data['curves']['lightgbm']['roc_curve'])}")
    print(f"LightGBM PR curve points: {len(data['curves']['lightgbm']['pr_curve'])}")

    # Check leakage audit
    assert "leakagePurgeAudit" in data
    print(f"Leakage audit entries: {len(data['leakagePurgeAudit'])}")

    # Check operatingThresholds
    assert "operatingThresholds" in data
    print(f"Operating thresholds count: {len(data['operatingThresholds'])}")

    print("\nALL BACKEND MODEL ANALYTICS VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_model_analytics_endpoint()
