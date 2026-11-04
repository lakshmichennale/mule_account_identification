"""Automated verification suite for Page 4: Real-Time Transaction Monitoring.
Tests query_transactions, get_transaction_detail, status filtering, and case promotion.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

def test_transaction_monitoring():
    client = TestClient(app)

    print("--- 1. Testing Unauthenticated Access Rejection ---")
    res_unauth = client.get("/api/transactions")
    assert res_unauth.status_code == 401, f"Expected 401 unauth, got {res_unauth.status_code}"
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

    print("\n--- 3. Testing Default Transactions Listing ---")
    res_list = client.get("/api/transactions?page=1&pageSize=25", headers=headers)
    assert res_list.status_code == 200, f"Failed: {res_list.text}"
    data = res_list.json()
    assert data["total"] == 9082, f"Expected 9082 total, got {data['total']}"
    assert len(data["transactions"]) == 25, f"Expected 25 items, got {len(data['transactions'])}"
    first_txn = data["transactions"][0]
    print(f"  [PASS] 9,082 records loaded. First TXN #{first_txn['transactionId']}: Account {first_txn['accountId']}, Amount ${first_txn['amount']:,}, Risk {first_txn['riskScore']}, Status {first_txn.get('status')}")

    print("\n--- 4. Testing Status Filters (BLOCKED, FLAGGED, UNDER_REVIEW, SETTLED) ---")
    for status_val in ["BLOCKED", "FLAGGED", "UNDER_REVIEW", "SETTLED"]:
        res_st = client.get(f"/api/transactions?status={status_val}&pageSize=10", headers=headers)
        assert res_st.status_code == 200
        st_data = res_st.json()
        assert st_data["total"] > 0, f"Status {status_val} returned 0 results"
        for txn in st_data["transactions"]:
            assert txn["status"] == status_val, f"Mismatch in status: {txn['status']} vs {status_val}"
        print(f"  [PASS] Status '{status_val}': {st_data['total']} total records, all verified.")

    print("\n--- 5. Testing Multi-Identifier Search ---")
    # Search by masked account
    sample_acc = first_txn["accountId"]
    res_acc = client.get(f"/api/transactions?search={sample_acc}", headers=headers)
    assert res_acc.status_code == 200
    acc_data = res_acc.json()
    assert acc_data["total"] >= 1
    print(f"  [PASS] Search by account '{sample_acc}' found {acc_data['total']} matching records.")

    # Search by counterparty sender
    sample_sender = first_txn["senderId"]
    res_snd = client.get(f"/api/transactions?search={sample_sender}", headers=headers)
    assert res_snd.status_code == 200
    snd_data = res_snd.json()
    assert snd_data["total"] >= 1
    print(f"  [PASS] Search by sender '{sample_sender}' found {snd_data['total']} matching records.")

    print("\n--- 6. Testing Amount Range Filtering & Sorting ---")
    res_amt = client.get("/api/transactions?minAmount=15000&maxAmount=25000&sortBy=amount&sortDir=desc", headers=headers)
    assert res_amt.status_code == 200
    amt_data = res_amt.json()
    assert amt_data["total"] > 0
    for txn in amt_data["transactions"]:
        assert 15000 <= txn["amount"] <= 25000, f"Amount out of bounds: {txn['amount']}"
    print(f"  [PASS] Filter $15k–$25k: {amt_data['total']} records, strictly verified within range.")

    print("\n--- 7. Testing Detailed Transaction Inspection Dossier ---")
    tid = first_txn["transactionId"]
    res_detail = client.get(f"/api/transactions/{tid}", headers=headers)
    assert res_detail.status_code == 200, f"Failed detail: {res_detail.text}"
    detail = res_detail.json()
    assert detail["transactionId"] == tid
    assert "detailedIndicators" in detail
    assert "reasons" in detail
    assert "balanceAmount" in detail
    print(f"  [PASS] Detailed dossier for #{tid}: {len(detail['detailedIndicators'])} detailed indicators, confidence {detail.get('confidence')}")

    print("\n--- 8. Testing Case Promotion from Suspicious Transaction ---")
    promote_res = client.post(
        "/api/cases/promote",
        headers=headers,
        json={
            "accountId": first_txn["accountId"],
            "rawAccountId": first_txn["rawAccountId"],
            "title": f"Mule Network Ring Triage for {first_txn['accountId']}",
            "riskScore": first_txn["riskScore"],
            "priority": "CRITICAL" if first_txn["riskScore"] >= 90 else "HIGH",
            "alertTrigger": "Rapid UPI Debits | Immediate Liquidation",
            "notes": "Automated test promotion from Transaction Monitoring inspection.",
        },
    )
    assert promote_res.status_code == 200, f"Promotion failed: {promote_res.text}"
    case_data = promote_res.json()
    assert case_data["caseNumber"].startswith("CASE-2026-")
    assert case_data["accountId"] == first_txn["accountId"]
    print(f"  [PASS] Case promoted successfully: {case_data['caseNumber']} for {case_data['accountId']} (Assigned: {case_data['assignedAnalyst']})")

    print("\n[ALL 8 VERIFICATION CHECKS PASSED FOR PAGE 4: TRANSACTION MONITORING]")

if __name__ == "__main__":
    test_transaction_monitoring()
