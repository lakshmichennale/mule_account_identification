"""Test Profile & Settings endpoints."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_settings():
    # 1. Login
    res = client.post("/api/auth/login", json={"email": "admin@sentinel.bank", "password": "Admin@Sentinel2026!"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Profile
    res_prof = client.get("/api/settings/profile", headers=headers)
    assert res_prof.status_code == 200
    prof = res_prof.json()
    print("[PASS] Profile:", prof["email"], prof["role"], prof["department"])
    assert prof["email"] == "admin@sentinel.bank"

    # 3. Update Profile
    res_upd = client.put("/api/settings/profile", headers=headers, json={"fullName": "Chief Compliance Officer"})
    assert res_upd.status_code == 200
    print("[PASS] Profile Updated:", res_upd.json()["message"])

    # Restore name
    client.put("/api/settings/profile", headers=headers, json={"fullName": "System Administrator"})

    # 4. Get Thresholds
    res_thresh = client.get("/api/settings/thresholds", headers=headers)
    assert res_thresh.status_code == 200
    thresh = res_thresh.json()
    print("[PASS] Current Thresholds: Low<", thresh["lowMax"], "Med<", thresh["medMax"], "Critical>=", thresh["criticalMin"])
    assert thresh["criticalMin"] == 90

    # 5. Update Thresholds
    res_thresh_upd = client.put("/api/settings/thresholds", headers=headers, json={"autoHoldThreshold": 92})
    assert res_thresh_upd.status_code == 200
    assert res_thresh_upd.json()["autoHoldThreshold"] == 92
    print("[PASS] Updated autoHoldThreshold to 92")

    # Restore
    client.put("/api/settings/thresholds", headers=headers, json={"autoHoldThreshold": 90})

    # 6. Change Password (test bad current password -> 400)
    res_bad_pw = client.post(
        "/api/settings/change-password",
        headers=headers,
        json={"currentPassword": "WrongPassword123!", "newPassword": "NewSecurePassword2026!"},
    )
    assert res_bad_pw.status_code == 400
    print("[PASS] Bad password correctly rejected with 400")

    # 7. Audit Logs
    res_logs = client.get("/api/settings/audit-logs?pageSize=5", headers=headers)
    assert res_logs.status_code == 200
    logs_data = res_logs.json()
    print(f"[PASS] Audit Logs: Total {logs_data['total']} events, Top event: {logs_data['logs'][0]['action']}")
    assert logs_data["total"] > 0

    # 8. System Diagnostics
    res_diag = client.get("/api/settings/system-diagnostics", headers=headers)
    assert res_diag.status_code == 200
    diag = res_diag.json()
    print("[PASS] System Diagnostics:", diag["status"], diag["architecture"]["type"], "Dataset:", diag["telemetry"]["rawDatasetSizeMB"], "MB")
    assert diag["status"] == "HEALTHY"
    assert "None" in diag["architecture"]["hardwareDependencies"]

    print("\n>>> ALL SETTINGS & PROFILE BACKEND CHECKS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_settings()
