"""Test User Management endpoints and RBAC."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_user_management():
    # 1. Login as Analyst (Non-admin)
    res_analyst = client.post("/api/auth/login", json={"email": "analyst@sentinel.bank", "password": "Analyst@Sentinel2026!"})
    assert res_analyst.status_code == 200
    analyst_token = res_analyst.json()["accessToken"]

    # Test RBAC protection: Analyst should be forbidden (403) from /api/users
    res_forbidden = client.get("/api/users", headers={"Authorization": f"Bearer {analyst_token}"})
    print(f"[PASS] Non-admin access to /api/users rejected with status {res_forbidden.status_code} ({res_forbidden.json()['detail']})")
    assert res_forbidden.status_code == 403

    # 2. Login as Admin
    res_admin = client.post("/api/auth/login", json={"email": "admin@sentinel.bank", "password": "Admin@Sentinel2026!"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Test Admin access
    res_users = client.get("/api/users", headers=admin_headers)
    assert res_users.status_code == 200
    data = res_users.json()
    print(f"[PASS] Admin listed users: Total {data['total']}, Active Admins {data['stats']['activeAdmins']}")
    assert data["total"] >= 2

    # 3. Create New User
    test_email = "test.investigator@sentinel.bank"
    res_create = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "email": test_email,
            "fullName": "Test Junior Investigator",
            "password": "InvestigatorSecure2026!",
            "role": "FRAUD_ANALYST",
        },
    )
    if res_create.status_code == 400 and "already exists" in res_create.text:
        # Already created in prior run, continue
        pass
    else:
        assert res_create.status_code == 200
        new_user = res_create.json()["user"]
        print(f"[PASS] Created new user: {new_user['email']} (ID {new_user['id']})")

    # 4. Filter users by search
    res_search = client.get(f"/api/users?search=test.investigator", headers=admin_headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert len(search_data["users"]) == 1
    target_user_id = search_data["users"][0]["id"]
    print(f"[PASS] Search matched user ID {target_user_id}")

    # 5. Update User
    res_upd = client.put(
        f"/api/users/{target_user_id}",
        headers=admin_headers,
        json={"fullName": "Senior Investigator Promoted", "isActive": True},
    )
    assert res_upd.status_code == 200
    print(f"[PASS] Updated user: {res_upd.json()['user']['fullName']}")

    # 6. Admin Password Reset
    res_reset = client.post(
        f"/api/users/{target_user_id}/reset-password",
        headers=admin_headers,
        json={"newPassword": "ResetPasswordSuccess2026!"},
    )
    assert res_reset.status_code == 200
    print(f"[PASS] Admin reset password: {res_reset.json()['message']}")

    # Verify login with newly reset password works
    res_new_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": "ResetPasswordSuccess2026!"},
    )
    assert res_new_login.status_code == 200
    print(f"[PASS] Login with newly reset password confirmed for {test_email}")

    # 7. Safety Check: Attempt to deactivate last admin (ID 1)
    res_deact_admin = client.put(
        "/api/users/1",
        headers=admin_headers,
        json={"isActive": False},
    )
    assert res_deact_admin.status_code == 400
    print("[PASS] Safety check: Deactivating last active admin correctly prevented (HTTP 400)")

    print("\n>>> ALL USER MANAGEMENT & RBAC ENDPOINT CHECKS PASSED! <<<")

if __name__ == "__main__":
    test_user_management()
