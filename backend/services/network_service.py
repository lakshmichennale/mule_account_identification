"""
Account co-activity network from real dataset.

No sender/receiver columns exist. Edges connect accounts that share
occupation + merchant category + reporting month (co-activity pattern).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import pandas as pd

from backend.services.dataset_service import load_scored_transactions


@lru_cache(maxsize=1)
def build_account_network() -> dict[str, Any]:
    df = load_scored_transactions()
    fraud_col = "actual_label" if "actual_label" in df.columns else "F3924"

    account_stats = (
        df.groupby("F3887")
        .agg(
            txn_count=("transaction_id", "count"),
            total_amount=("F3895", "sum"),
            avg_risk=("risk_score", "mean"),
            fraud_count=(fraud_col, "sum"),
            occupation=("F3891", "first"),
            merchant=("F3893", "first"),
        )
        .reset_index()
    )

    nodes = []
    for _, row in account_stats.iterrows():
        aid = int(row["F3887"])
        fraud_rate = row["fraud_count"] / row["txn_count"] if row["txn_count"] else 0
        nodes.append(
            {
                "id": str(aid),
                "label": f"ACC-{aid}",
                "transactionCount": int(row["txn_count"]),
                "totalAmount": int(row["total_amount"]),
                "avgRiskScore": round(float(row["avg_risk"]), 1),
                "fraudCount": int(row["fraud_count"]),
                "fraudRate": round(float(fraud_rate), 4),
                "occupation": str(row["occupation"]),
                "merchantCategory": str(row["merchant"]),
                "size": min(40, 8 + int(row["txn_count"]) // 2),
                "suspicious": bool(row["fraud_count"] > 0 or row["avg_risk"] >= 70),
            }
        )

    # Co-activity edges: accounts sharing occupation+merchant+month
    groups = df.groupby(["F3891", "F3893", "F2230"])["F3887"].apply(lambda x: list(set(x)))
    edge_weights: dict[tuple[str, str], int] = {}

    for accounts in groups:
        if len(accounts) < 2:
            continue
        for i in range(len(accounts)):
            for j in range(i + 1, len(accounts)):
                a, b = sorted([str(accounts[i]), str(accounts[j])])
                edge_weights[(a, b)] = edge_weights.get((a, b), 0) + 1

    edges = [
        {"source": a, "target": b, "weight": w, "type": "co_activity"}
        for (a, b), w in edge_weights.items()
        if w >= 1
    ]

    high_degree = sorted(nodes, key=lambda n: n["transactionCount"], reverse=True)[:10]
    suspicious_clusters = [n for n in nodes if n["suspicious"] and n["transactionCount"] >= 3]

    return {
        "nodes": nodes,
        "edges": edges[:500],
        "stats": {
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "connectedComponentsEstimate": len(groups),
            "highDegreeAccounts": high_degree,
            "suspiciousClusters": suspicious_clusters[:20],
            "note": "No sender/receiver in dataset — graph shows account co-activity by shared occupation, merchant, and month.",
        },
    }
