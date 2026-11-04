import sys
from pathlib import Path

ROOT = Path(r"C:\Users\laksh\OneDrive\Attachments\Desktop\project")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.network_service import build_account_network

def test_network():
    net = build_account_network()
    print(f"Nodes generated: {len(net['nodes'])}")
    print(f"Edges generated: {len(net['edges'])}")
    print(f"Syndicate Rings: {len(net['syndicateRings'])}")
    for s in net["syndicateRings"]:
        print(f"  {s['id']}: {s['name']} | Anchor: {s['anchorAccountId']} | Members: {s['memberCount']} | Vol: ${s['totalVolume']:,} | AvgRisk: {s['avgRiskScore']}")
    print(f"Stats: {net['stats']['nodeCount']} nodes, {net['stats']['edgeCount']} edges, max degree {net['stats']['centralHubDegree']}")

if __name__ == "__main__":
    test_network()
