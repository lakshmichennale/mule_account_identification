import { useEffect, useRef, useState } from "react";
import { NetworkGraph, getNetworkGraph } from "../api/client";

export default function NetworkPage() {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    getNetworkGraph()
      .then(setGraph)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const nodes = graph.nodes.slice(0, 80);
    const nodeIds = new Set(nodes.map((n) => n.id));

    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(w, h) * 0.35;
      positions[n.id] = {
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 30,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 30,
      };
    });

    ctx.fillStyle = "#1a2234";
    ctx.fillRect(0, 0, w, h);

    graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .slice(0, 200)
      .forEach((e) => {
        const s = positions[e.source];
        const t = positions[e.target];
        if (!s || !t) return;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
        ctx.lineWidth = Math.min(3, e.weight);
        ctx.stroke();
      });

    nodes.forEach((n) => {
      const p = positions[n.id];
      const radius = Math.max(6, Math.min(n.size, 24));
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = n.suspicious ? "#ef4444" : n.avgRiskScore >= 50 ? "#f59e0b" : "#22c55e";
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e8edf5";
      ctx.font = "10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(n.label.replace("ACC-", ""), p.x, p.y + radius + 12);
    });
  }, [graph]);

  if (error) return <div className="error">{error}</div>;
  if (!graph) return <div className="loading">Building account network from real data…</div>;

  return (
    <>
      <h1 className="page-title">Fraud Network Graph</h1>
      <p className="page-subtitle">{graph.stats.note}</p>

      <div className="grid grid-4" style={{ marginBottom: "1rem" }}>
        <div className="card">
          <div className="card-title">Accounts (Nodes)</div>
          <div className="card-value stat-neutral">{graph.stats.nodeCount}</div>
        </div>
        <div className="card">
          <div className="card-title">Co-Activity Edges</div>
          <div className="card-value stat-neutral">{graph.stats.edgeCount}</div>
        </div>
        <div className="card">
          <div className="card-title">Suspicious Clusters</div>
          <div className="card-value stat-fraud">{graph.stats.suspiciousClusters.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Activity Groups</div>
          <div className="card-value stat-neutral">{graph.stats.connectedComponentsEstimate}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem", padding: "0.5rem" }}>
        <canvas ref={canvasRef} className="network-canvas" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">High-Degree Accounts (Fan-in / Fan-out proxy)</div>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Transactions</th>
                <th>Total Amount</th>
                <th>Avg Risk</th>
              </tr>
            </thead>
            <tbody>
              {graph.stats.highDegreeAccounts.map((n) => (
                <tr key={n.id}>
                  <td>{n.label}</td>
                  <td>{n.transactionCount}</td>
                  <td>${n.totalAmount.toLocaleString()}</td>
                  <td className={n.avgRiskScore >= 70 ? "risk-high" : ""}>{n.avgRiskScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title">Suspicious Account Clusters</div>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Fraud Count</th>
                <th>Occupation</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {graph.stats.suspiciousClusters.slice(0, 10).map((n) => (
                <tr key={n.id}>
                  <td>{n.label}</td>
                  <td>{n.fraudCount}</td>
                  <td>{(n as NetworkGraph["nodes"][0] & { occupation?: string }).occupation ?? "—"}</td>
                  <td className="risk-high">{n.avgRiskScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
