"""Automated verification suite for Page 6: Alert Management & SOC Incident Triage.
Tests /api/alerts listing, filtering, detail, status update, batch triage, and escalation.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

def test_alert_management():
    client = TestClient(app)

    print("--- 1. Testing Unauthenticated Alerts Access ---")
    res_unauth = client.get("/api/alerts")
    assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
    print("  [PASS] Unauthenticated access blocked (HTTP 401)")

    print("\n--- 2. Authenticating as Fraud Analyst ---")
    login_res = client.post("/api/auth/login", json={
        "email": "analyst@sentinel.bank",
        "password": "Analyst@Sentinel2026!",
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  [PASS] Logged in as analyst@sentinel.bank")

    print("\n--- 3. Testing Default Alerts Listing & Summary Statistics ---")
    res_list = client.get("/api/alerts?page=1&pageSize=15", headers=headers)
    assert res_list.status_code == 200, f"Failed: {res_list.text}"
    data = res_list.json()

    assert data["total"] == 45, f"Expected 45 seeded alerts, got {data['total']}"
    assert len(data["alerts"]) == 15
    summary = data["summary"]
    assert summary["grandTotal"] == 45
    assert summary["critical"] > 0
    assert summary["high"] > 0
    first_alert = data["alerts"][0]
    print(f"  [PASS] 45 alerts loaded. Summary: {summary['new']} New, {summary['acknowledged']} Ack, {summary['escalated']} Escalated. First: {first_alert['alertId']} ({first_alert['category']})")

    print("\n--- 4. Testing Status Filters (NEW, ACKNOWLEDGED, UNDER_REVIEW, ESCALATED) ---")
    for st in ["NEW", "ACKNOWLEDGED", "UNDER_REVIEW", "ESCALATED"]:
        res_st = client.get(f"/api/alerts?status={st}", headers=headers)
        assert res_st.status_code == 200
        st_data = res_st.json()
        assert st_data["total"] > 0, f"Status {st} returned 0"
        for a in st_data["alerts"]:
            assert a["status"] == st, f"Mismatch status: {a['status']} != {st}"
        print(f"  [PASS] Status '{st}': {st_data['total']} alerts, all verified.")

    print("\n--- 5. Testing Severity Filtering & Search ---")
    res_crit = client.get("/api/alerts?severity=CRITICAL", headers=headers)
    assert res_crit.status_code == 200
    crit_data = res_crit.json()
    assert crit_data["total"] > 0
    for a in crit_data["alerts"]:
        assert a["severity"] == "CRITICAL"
    print(f"  [PASS] Severity 'CRITICAL': {crit_data['total']} alerts verified.")

    # Search by category keyword
    res_search = client.get("/api/alerts?search=UPI", headers=headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert search_data["total"] > 0
    print(f"  [PASS] Search 'UPI' returned {search_data['total']} matching alerts.")

    print("\n--- 6. Testing Detailed Alert Lookup & Triage Update ---")
    aid = first_alert["alertId"]
    res_get = client.get(f"/api/alerts/{aid}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["alertId"] == aid

    # Patch status & notes
    patch_res = client.patch(
        f"/api/alerts/{aid}",
        headers=headers,
        json={
            "status": "UNDER_REVIEW",
            "assignedAnalyst": "Senior SOC Lead",
            "notes": "Forensic audit initiated. Confirmed peer debit velocity spike.",
        },
    )
    assert patch_res.status_code == 200, f"Patch failed: {patch_res.text}"
    updated_alert = patch_res.json()
    assert updated_alert["status"] == "UNDER_REVIEW"
    assert updated_alert["assignedAnalyst"] == "Senior SOC Lead"
    assert "Forensic audit initiated" in updated_alert["notes"]
    print(f"  [PASS] Updated {aid}: Status={updated_alert['status']}, Analyst={updated_alert['assignedAnalyst']}")

    print("\n--- 7. Testing Bulk/Batch Triage Operations ---")
    batch_targets = [data["alerts"][1]["alertId"], data["alerts"][2]["alertId"]]
    batch_res = client.post(
        "/api/alerts/batch",
        headers=headers,
        json={
            "alertIds": batch_targets,
            "status": "ACKNOWLEDGED",
        },
    )
    assert batch_res.status_code == 200, f"Batch failed: {batch_res.text}"
    batch_json = batch_res.json()
    assert batch_json["updatedCount"] == 2
    print(f"  [PASS] Batch operation succeeded: updated {batch_json['updatedCount']} alerts to ACKNOWLEDGED.")

    print("\n--- 8. Testing Alert Escalation to FinCEN SAR Case ---")
    esc_res = client.post(
        "/api/cases/promote",
        headers=headers,
        json={
            "accountId": first_alert["accountId"],
            "rawAccountId": first_alert["rawAccountId"],
            "title": f"Escalated SAR: {first_alert['category']}",
            "riskScore": first_alert["riskScore"],
            "priority": first_alert["severity"],
            "alertTrigger": first_alert["triggerReason"],
            "notes": "Escalated from SOC Alert Management queue.",
        },
    )
    assert esc_res.status_code == 200, f"Case promotion failed: {esc_res.text}"
    case = esc_res.json()
    assert case["caseNumber"].startswith("CASE-2026-")
    print(f"  [PASS] Escalated {first_alert['alertId']} to Case {case['caseNumber']} for {case['accountId']}")

    print("\n[ALL 8 VERIFICATION CHECKS PASSED FOR PAGE 6: ALERT MANAGEMENT]")

if __name__ == "__main__":
    test_alert_management()
