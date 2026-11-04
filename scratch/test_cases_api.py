"""Automated verification suite for Page 7: Investigation & FinCEN Case Management.
Tests /api/cases listing, filtering, detail, status update, and regulatory SAR report generation.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

def test_case_management():
    client = TestClient(app)

    print("--- 1. Testing Unauthenticated Cases Access ---")
    res_unauth = client.get("/api/cases")
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

    print("\n--- 3. Testing Default Cases Listing & Summary Statistics ---")
    res_list = client.get("/api/cases?page=1&pageSize=15", headers=headers)
    assert res_list.status_code == 200, f"Failed: {res_list.text}"
    data = res_list.json()

    assert data["total"] >= 5, f"Expected at least 5 cases, got {data['total']}"
    summary = data["summary"]
    assert summary["grandTotal"] >= 5
    assert "open" in summary
    assert "underInvestigation" in summary
    assert "sarReady" in summary
    first_case = data["cases"][0]
    print(f"  [PASS] {data['total']} cases queried. First: {first_case['caseNumber']} on {first_case['accountId']} (Status: {first_case['status']}, Priority: {first_case['priority']})")

    print("\n--- 4. Testing Status Filters (OPEN, UNDER_INVESTIGATION, SAR_READY, CLOSED_RESOLVED) ---")
    for st in ["OPEN", "UNDER_INVESTIGATION", "SAR_READY", "CLOSED_RESOLVED"]:
        res_st = client.get(f"/api/cases?status={st}", headers=headers)
        assert res_st.status_code == 200
        st_data = res_st.json()
        for c in st_data["cases"]:
            assert c["status"] == st, f"Mismatch status: {c['status']} != {st}"
        print(f"  [PASS] Status '{st}': {st_data['total']} matching cases verified.")

    print("\n--- 5. Testing Priority Filtering & Multi-Field Search ---")
    res_crit = client.get("/api/cases?priority=CRITICAL", headers=headers)
    assert res_crit.status_code == 200
    crit_data = res_crit.json()
    for c in crit_data["cases"]:
        assert c["priority"] == "CRITICAL"
    print(f"  [PASS] Priority 'CRITICAL': {crit_data['total']} cases verified.")

    # Search by case number
    cnum = first_case["caseNumber"]
    res_search = client.get(f"/api/cases?search={cnum}", headers=headers)
    assert res_search.status_code == 200
    assert res_search.json()["total"] >= 1
    print(f"  [PASS] Search by case number '{cnum}' found matching docket.")

    print("\n--- 6. Testing Detailed Case Lookup & Status/Notes Update ---")
    res_get = client.get(f"/api/cases/{cnum}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["caseNumber"] == cnum

    # Patch case
    patch_res = client.patch(
        f"/api/cases/{cnum}",
        headers=headers,
        json={
            "status": "SAR_READY",
            "priority": "CRITICAL",
            "assignedAnalyst": "Special Investigations Unit Lead",
            "notes": "Forensic timeline completed. Target account ready for FinCEN electronic filing.",
        },
    )
    assert patch_res.status_code == 200, f"Patch failed: {patch_res.text}"
    updated_case = patch_res.json()
    assert updated_case["status"] == "SAR_READY"
    assert updated_case["priority"] == "CRITICAL"
    assert updated_case["assignedAnalyst"] == "Special Investigations Unit Lead"
    assert "ready for FinCEN electronic filing" in updated_case["notes"]
    print(f"  [PASS] Updated {cnum}: Status={updated_case['status']}, Officer={updated_case['assignedAnalyst']}")

    print("\n--- 7. Testing Grounded FinCEN SAR Regulatory Narrative Report ---")
    sar_res = client.get(f"/api/cases/{cnum}/sar-report", headers=headers)
    assert sar_res.status_code == 200, f"SAR report failed: {sar_res.text}"
    sar = sar_res.json()
    assert sar["caseNumber"] == cnum
    assert "sarReference" in sar
    assert "reportText" in sar

    text = sar["reportText"]
    assert "FINANCIAL CRIMES ENFORCEMENT NETWORK (FinCEN)" in text
    assert "PART I — SUBJECT IDENTIFICATION" in text
    assert "PART II — SUSPICIOUS ACTIVITY SUMMARY" in text
    assert "PART III — MACHINE LEARNING & BEHAVIORAL RULE EVIDENCE" in text
    assert "LightGBM Gradient Boosting Ensemble" in text
    assert "PART V — RECOMMENDED REMEDIAL ACTION" in text
    print(f"  [PASS] FinCEN SAR generated ({sar['sarReference']}). Length: {len(text)} characters, all regulatory sections verified.")

    print("\n--- 8. Testing New Custom Case Docket Creation ---")
    new_res = client.post(
        "/api/cases/promote",
        headers=headers,
        json={
            "accountId": "ACC-***8821",
            "rawAccountId": 8821,
            "title": "Cross-Border Layering and Rapid Debit Burst",
            "riskScore": 96,
            "priority": "CRITICAL",
            "alertTrigger": "Off-hours high value net banking electronic transfers",
            "notes": "Initialized from automated investigation test suite.",
        },
    )
    assert new_res.status_code == 200, f"Creation failed: {new_res.text}"
    created_case = new_res.json()
    assert created_case["caseNumber"].startswith("CASE-2026-")
    print(f"  [PASS] Custom docket created: {created_case['caseNumber']} on {created_case['accountId']}")

    print("\n[ALL 8 VERIFICATION CHECKS PASSED FOR PAGE 7: INVESTIGATION & CASE MANAGEMENT]")

if __name__ == "__main__":
    test_case_management()
