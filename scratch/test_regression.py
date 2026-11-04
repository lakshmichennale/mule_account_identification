"""Comprehensive regression test suite for Pages 1 through 11."""

import sys
from pathlib import Path

ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from starlette.testclient import TestClient
from backend.main import app

def run_regression():
    client = TestClient(app)

    # 1. Login
    res = client.post("/api/auth/login", json={"email": "admin@sentinel.bank", "password": "Admin@Sentinel2026!"})
    assert res.status_code == 200, "Admin login failed"
    token = res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Page 1: Auth OK")

    # 2. Dashboard Stats
    res = client.get("/api/dashboard/stats", headers=headers)
    assert res.status_code == 200, f"Dashboard stats failed: {res.text}"
    stats = res.json()
    assert stats["totalAccounts"] == 9082
    assert "riskDistribution" in stats
    assert "fraudTrends" in stats
    print(f"[PASS] Page 2: Dashboard stats OK (Total {stats['totalAccounts']}, Critical {stats['criticalRiskAccounts']}, High {stats['highRiskAccounts']})")

    # 3. Account Analysis
    res = client.get("/api/accounts?pageSize=10", headers=headers)
    assert res.status_code == 200
    acc_data = res.json()
    assert acc_data["total"] == 9082
    sample_acc = acc_data["accounts"][0]["accountId"]
    res_dossier = client.get(f"/api/accounts/{sample_acc}", headers=headers)
    assert res_dossier.status_code == 200
    dossier = res_dossier.json()
    assert dossier["identification"]["accountId"] == sample_acc
    print(f"[PASS] Page 3: Account Analysis OK (Found {sample_acc}, Score {dossier['riskAssessment']['riskScore']})")

    # 4. Transaction Monitoring
    res = client.get("/api/transactions?pageSize=10", headers=headers)
    assert res.status_code == 200
    txn_data = res.json()
    assert txn_data["total"] == 9082
    sample_tid = txn_data["transactions"][0]["transactionId"]
    res_tdetail = client.get(f"/api/transactions/{sample_tid}", headers=headers)
    assert res_tdetail.status_code == 200
    tdetail = res_tdetail.json()
    assert tdetail["transactionId"] == sample_tid
    print(f"[PASS] Page 4: Transaction Monitoring OK (Found #{sample_tid}, Amount ${tdetail['amount']:,}, Status {tdetail['status']})")

    # 5. Fraud Network Visualization
    res_net = client.get("/api/network/graph", headers=headers)
    assert res_net.status_code == 200
    net_data = res_net.json()
    assert len(net_data["nodes"]) == 105
    assert len(net_data["syndicateRings"]) == 5
    print(f"[PASS] Page 5: Fraud Network OK (Nodes {len(net_data['nodes'])}, Edges {len(net_data['edges'])}, Rings {len(net_data['syndicateRings'])})")

    # 6. Alert Management
    res_alerts = client.get("/api/alerts?pageSize=10", headers=headers)
    assert res_alerts.status_code == 200
    alerts_data = res_alerts.json()
    assert alerts_data["total"] > 0
    assert "summary" in alerts_data
    sample_alert = alerts_data["alerts"][0]
    print(f"[PASS] Page 6: Alert Management OK (Total {alerts_data['total']}, First {sample_alert['alertId']}, Status {sample_alert['status']})")

    # 7. Investigation & Case Management
    res_cases = client.get("/api/cases?pageSize=10", headers=headers)
    assert res_cases.status_code == 200
    cases_data = res_cases.json()
    assert cases_data["total"] > 0
    assert "summary" in cases_data
    sample_case = cases_data["cases"][0]
    res_sar = client.get(f"/api/cases/{sample_case['caseNumber']}/sar-report", headers=headers)
    assert res_sar.status_code == 200
    sar_data = res_sar.json()
    assert "FINANCIAL CRIMES ENFORCEMENT NETWORK" in sar_data["reportText"]
    print(f"[PASS] Page 7: Cases & SAR OK (Total {cases_data['total']}, First {sample_case['caseNumber']}, SAR Generated {sar_data['sarReference']})")

    # 8. Model Analytics & ML Governance
    res_model = client.get("/api/model/analytics", headers=headers)
    assert res_model.status_code == 200
    model_data = res_model.json()
    assert model_data["modelInfo"]["name"].startswith("LightGBM")
    assert model_data["championMetrics"]["prAuc"] > 0.90
    assert model_data["confusionMatrix"]["trueNegatives"] == 1800
    assert len(model_data["benchmarks"]) == 5
    assert len(model_data["topFeatures"]) == 20
    assert len(model_data["leakagePurgeAudit"]) == 5
    print(f"[PASS] Page 8: Model Analytics OK (Champion {model_data['modelInfo']['version']}, PR-AUC {model_data['championMetrics']['prAuc']*100:.2f}%, Benchmarks {len(model_data['benchmarks'])}, Top Features {len(model_data['topFeatures'])})")

    # 9. AI Investigation Copilot
    res_copilot_cfg = client.get("/api/copilot/config", headers=headers)
    assert res_copilot_cfg.status_code == 200
    copilot_cfg = res_copilot_cfg.json()
    assert "provider" in copilot_cfg
    assert "features" in copilot_cfg

    res_copilot_chat = client.post(
        "/api/copilot/chat",
        headers=headers,
        json={"message": "Why was ACC-***9481 classified as critical risk?", "accountId": "ACC-***9481"},
    )
    assert res_copilot_chat.status_code == 200
    chat_data = res_copilot_chat.json()
    assert "ACC-***9481" in chat_data["response"]
    assert chat_data["groundedContext"]["riskScore"] == 99
    assert len(chat_data["suggestedFollowUps"]) > 0

    res_copilot_promote = client.post(
        "/api/copilot/promote-to-case",
        headers=headers,
        json={
            "caseNumber": sample_case["caseNumber"],
            "content": "Copilot validated critical pass-through velocity and multi-UPI breach triggers.",
        },
    )
    assert res_copilot_promote.status_code == 200
    print(f"[PASS] Page 9: AI Copilot OK (Provider {copilot_cfg['provider']}, Account Grounded ACC-***9481 Score {chat_data['groundedContext']['riskScore']}, Promoted to {sample_case['caseNumber']})")

    # 10. Platform Settings & Security Center
    res_profile = client.get("/api/settings/profile", headers=headers)
    assert res_profile.status_code == 200
    prof = res_profile.json()
    assert prof["email"] == "admin@sentinel.bank"
    assert prof["role"] == "ADMIN"

    res_thresh = client.get("/api/settings/thresholds", headers=headers)
    assert res_thresh.status_code == 200
    thresh = res_thresh.json()
    assert thresh["criticalMin"] == 90

    res_audit = client.get("/api/settings/audit-logs?pageSize=5", headers=headers)
    assert res_audit.status_code == 200
    audit = res_audit.json()
    assert audit["total"] > 0

    res_diag = client.get("/api/settings/system-diagnostics", headers=headers)
    assert res_diag.status_code == 200
    diag = res_diag.json()
    assert diag["status"] == "HEALTHY"
    print(f"[PASS] Page 10: Settings & Security OK (User {prof['email']}, Thresholds Critical>={thresh['criticalMin']}, Audit Logs Total {audit['total']}, Diagnostics {diag['status']})")

    # 11. Admin User Management & RBAC
    res_users = client.get("/api/users", headers=headers)
    assert res_users.status_code == 200
    users_data = res_users.json()
    assert users_data["total"] >= 2
    assert "stats" in users_data
    assert users_data["stats"]["activeAdmins"] >= 1

    # Verify RBAC for non-admin
    res_analyst_login = client.post("/api/auth/login", json={"email": "analyst@sentinel.bank", "password": "Analyst@Sentinel2026!"})
    analyst_token = res_analyst_login.json()["accessToken"]
    res_rb_check = client.get("/api/users", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_rb_check.status_code == 403
    print(f"[PASS] Page 11: User Management & RBAC OK (Total Users {users_data['total']}, Active Admins {users_data['stats']['activeAdmins']}, Non-Admin RBAC Block Status {res_rb_check.status_code})")

    print("\n=======================================================")
    print(">>> ALL REGRESSION CHECKS PASSED FOR ALL 11 PAGES! <<<")
    print("=======================================================")

if __name__ == "__main__":
    run_regression()
