"""Automated verification suite for Page 5: Fraud Network Visualization.
Tests /api/network/graph endpoint, topology structure, syndicate rings, and case promotion.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.main import app

def test_network_intelligence():
    client = TestClient(app)

    print("--- 1. Testing Unauthenticated Network Graph Access ---")
    res_unauth = client.get("/api/network/graph")
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

    print("\n--- 3. Testing Network Graph Payload Structure ---")
    res_graph = client.get("/api/network/graph", headers=headers)
    assert res_graph.status_code == 200, f"Failed: {res_graph.text}"
    graph = res_graph.json()

    assert graph["mode"] == "real_data"
    assert "nodes" in graph and len(graph["nodes"]) > 0
    assert "edges" in graph and len(graph["edges"]) > 0
    assert "syndicateRings" in graph and len(graph["syndicateRings"]) == 5
    assert "stats" in graph
    print(f"  [PASS] Graph topology retrieved: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, {len(graph['syndicateRings'])} syndicate rings.")

    print("\n--- 4. Validating Node Integrity & Forensic Roles ---")
    node_ids = set()
    roles_found = set()
    for n in graph["nodes"]:
        node_ids.add(n["id"])
        roles_found.add(n["role"])
        assert n["id"].startswith("ACC-***"), f"Invalid node ID format: {n['id']}"
        assert 0 <= n["avgRiskScore"] <= 100, f"Invalid risk score: {n['avgRiskScore']}"
        assert "connectedNeighbors" in n
        assert "totalAmount" in n and n["totalAmount"] > 0
        assert "occupation" in n

    valid_roles = {"MULE_HERDER", "LAYERING_HUB", "CASH_OUT", "FUNNEL_MULE", "NORMAL_PEER"}
    assert roles_found.issubset(valid_roles), f"Unexpected roles: {roles_found}"
    print(f"  [PASS] All {len(graph['nodes'])} nodes validated. Roles identified: {', '.join(roles_found)}")

    print("\n--- 5. Validating Edges & Counterparty Flow Directions ---")
    for e in graph["edges"]:
        assert e["source"] in node_ids, f"Edge source not in nodes: {e['source']}"
        assert e["target"] in node_ids, f"Edge target not in nodes: {e['target']}"
        assert e["weight"] >= 1
        assert "flowDirection" in e
        assert "amount" in e
    print(f"  [PASS] All {len(graph['edges'])} edges strictly connect valid nodes with flow directions and volumes.")

    print("\n--- 6. Validating Syndicate Rings ---")
    for s in graph["syndicateRings"]:
        assert s["id"].startswith("SYND-")
        assert s["memberCount"] >= 5
        assert s["totalVolume"] > 0
        assert s["anchorAccountId"] in node_ids
        print(f"  [PASS] {s['id']}: {s['name']} (Anchor: {s['anchorAccountId']}, Vol: ${s['totalVolume']:,}, Risk: {s['avgRiskScore']})")

    print("\n--- 7. Promoting Entire Syndicate Ring to Case ---")
    first_ring = graph["syndicateRings"][0]
    promote_res = client.post(
        "/api/cases/promote",
        headers=headers,
        json={
            "accountId": first_ring["anchorAccountId"],
            "title": f"Syndicate Ring Crackdown: {first_ring['name']}",
            "riskScore": int(round(first_ring["avgRiskScore"])),
            "priority": first_ring["riskTier"],
            "alertTrigger": first_ring["primaryModusOperandi"],
            "notes": f"Syndicate {first_ring['id']} with {first_ring['memberCount']} tracked accounts and ${first_ring['totalVolume']:,} aggregate volume.",
        },
    )
    assert promote_res.status_code == 200, f"Case promotion failed: {promote_res.text}"
    case_data = promote_res.json()
    assert case_data["caseNumber"].startswith("CASE-2026-")
    assert case_data["accountId"] == first_ring["anchorAccountId"]
    print(f"  [PASS] Promoted syndicate ring to case: {case_data['caseNumber']} (Anchor: {case_data['accountId']})")

    print("\n[ALL 7 VERIFICATION CHECKS PASSED FOR PAGE 5: FRAUD NETWORK VISUALIZATION]")

if __name__ == "__main__":
    test_network_intelligence()
