"""Test Copilot endpoints: /api/copilot/config, /api/copilot/chat, /api/copilot/promote-to-case."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_copilot():
    # 1. Login
    res = client.post("/api/auth/login", json={"email": "admin@sentinel.bank", "password": "Admin@Sentinel2026!"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Config Endpoint
    res_unauth = client.get("/api/copilot/config")
    assert res_unauth.status_code == 401, f"Expected 401 unauth, got {res_unauth.status_code}"

    res_cfg = client.get("/api/copilot/config", headers=headers)
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    print("[PASS] Copilot Config:", cfg["provider"], cfg["modelName"])
    assert "provider" in cfg
    assert "features" in cfg

    # 3. Chat Endpoint: Single Account
    res_chat1 = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Why is ACC-***9481 classified as critical risk?", "accountId": "ACC-***9481"},
    )
    assert res_chat1.status_code == 200
    d1 = res_chat1.json()
    print("\n[PASS] Account Chat Response snippet:")
    print(d1["response"][:200] + "...")
    assert "ACC-***9481" in d1["response"]
    assert d1["groundedContext"] is not None
    assert d1["groundedContext"]["riskScore"] == 99
    assert len(d1["suggestedFollowUps"]) > 0

    # 4. Chat Endpoint: SAR Narrative
    res_chat2 = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Draft a FinCEN SAR narrative for ACC-***9481"},
    )
    assert res_chat2.status_code == 200
    d2 = res_chat2.json()
    print("\n[PASS] SAR Narrative snippet:")
    print(d2["response"][:200] + "...")
    assert "FinCEN Form 111" in d2["response"]

    # 5. Chat Endpoint: Syndicate
    res_chat3 = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Explain syndicate SYND-01"},
    )
    assert res_chat3.status_code == 200
    d3 = res_chat3.json()
    print("\n[PASS] Syndicate snippet:")
    print(d3["response"][:200] + "...")
    assert "SYND-01" in d3["response"]

    # 6. Chat Endpoint: Top Risk Accounts
    res_chat4 = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Which accounts have the highest risk scores?"},
    )
    assert res_chat4.status_code == 200
    d4 = res_chat4.json()
    print("\n[PASS] Top Risk Accounts snippet:")
    print(d4["response"][:200] + "...")
    assert "High-Risk Mule Accounts" in d4["response"]

    # 7. Promote to Case
    res_cases = client.get("/api/cases?pageSize=1", headers=headers)
    assert res_cases.status_code == 200
    case_num = res_cases.json()["cases"][0]["caseNumber"]

    res_promote = client.post(
        "/api/copilot/promote-to-case",
        headers=headers,
        json={
            "caseNumber": case_num,
            "content": "AI Copilot validated critical pass-through velocity and recommended debit freeze.",
        },
    )
    assert res_promote.status_code == 200
    print(f"\n[PASS] Promoted finding to {case_num}: {res_promote.json()['message']}")

    print("\n>>> ALL COPILOT BACKEND CHECKS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_copilot()
