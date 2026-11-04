import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  NetworkGraph,
  NetworkNode,
  SyndicateRing,
  getNetworkGraph,
  promoteToCaseApi,
} from "../api/client";

interface CanvasNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export default function NetworkPage() {
  const navigate = useNavigate();

  // Data state
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter & Selection state
  const [activeRing, setActiveRing] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // View mode: ALL, CRITICAL_ONLY, CO_ACTIVITY
  const [viewMode, setViewMode] = useState<"ALL" | "CRITICAL_ONLY" | "CO_ACTIVITY">("ALL");

  // Canvas Interaction state (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingCanvas = useRef(false);
  const draggedNode = useRef<CanvasNode | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Case promotion modal
  const [promotingRing, setPromotingRing] = useState<SyndicateRing | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseNotes, setCaseNotes] = useState("");
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<CanvasNode[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Fetch graph data
  const loadGraph = useCallback(() => {
    setLoading(true);
    setError("");
    getNetworkGraph()
      .then((data) => {
        setGraph(data);
        setLoading(false);
        // Pre-select the highest degree hub
        if (data.stats.highDegreeAccounts && data.stats.highDegreeAccounts.length > 0) {
          setSelectedNode(data.stats.highDegreeAccounts[0]);
        }
      })
      .catch((e: Error) => {
        setError(e.message || "Failed to load network graph");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Initialize Force-Directed Simulation Nodes
  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;

    // Filter nodes based on active syndicate ring and view mode
    let visibleNodes = graph.nodes;
    if (activeRing !== "ALL") {
      visibleNodes = visibleNodes.filter(
        (n) => n.syndicateRing === activeRing || (selectedNode && selectedNode.id === n.id)
      );
    }
    if (viewMode === "CRITICAL_ONLY") {
      visibleNodes = visibleNodes.filter((n) => n.avgRiskScore >= 70);
    }

    const simNodes: CanvasNode[] = visibleNodes.map((n, i) => {
      // Find existing position if already initialized
      const existing = simNodesRef.current.find((sn) => sn.id === n.id);
      if (existing) {
        return { ...existing, ...n };
      }
      const angle = (i / Math.max(1, visibleNodes.length)) * Math.PI * 2;
      const radiusDist = 140 + (i % 4) * 55;
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * radiusDist + (Math.random() - 0.5) * 40,
        y: h / 2 + Math.sin(angle) * radiusDist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: Math.max(8, Math.min(n.size, 26)),
      };
    });

    simNodesRef.current = simNodes;
  }, [graph, activeRing, viewMode, selectedNode]);

  // Main Canvas Rendering & Physics Loop
  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background clearing with radial gradient
      ctx.fillStyle = "#080d1a";
      ctx.fillRect(0, 0, w, h);

      // Physics Simulation Step
      const simNodes = simNodesRef.current;
      const nodeMap = new Map<string, CanvasNode>();
      simNodes.forEach((n) => nodeMap.set(n.id, n));

      // 1. Repulsion between all nodes (Coulomb's Law)
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 260) {
            const force = (1600 / distSq) * 0.85;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a !== draggedNode.current) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (b !== draggedNode.current) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
      }

      // 2. Attraction along edges (Spring force)
      const visibleNodeIds = new Set(simNodes.map((n) => n.id));
      const relevantEdges = graph.edges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      );

      for (const e of relevantEdges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = e.type === "direct_fund_flow" ? 95 : 140;
        const springForce = (dist - targetDist) * 0.025 * Math.min(3, e.weight);
        const fx = (dx / dist) * springForce;
        const fy = (dy / dist) * springForce;

        if (s !== draggedNode.current) {
          s.vx += fx;
          s.vy += fy;
        }
        if (t !== draggedNode.current) {
          t.vx -= fx;
          t.vy -= fy;
        }
      }

      // 3. Center gravity pull & velocity damping
      const cx = w / 2;
      const cy = h / 2;
      for (const n of simNodes) {
        if (n === draggedNode.current) continue;
        n.vx += (cx - n.x) * 0.003;
        n.vy += (cy - n.y) * 0.003;

        // Apply velocity with damping
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Apply Pan & Zoom Transform
      ctx.save();
      ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);

      // Draw Edges
      for (const e of relevantEdges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;

        const isHighlighted =
          selectedNode &&
          (selectedNode.id === s.id || selectedNode.id === t.id);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isHighlighted) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = Math.max(2, e.weight * 1.5);
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
        } else if (e.type === "direct_fund_flow") {
          ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
          ctx.lineWidth = Math.min(3.5, e.weight);
          ctx.shadowBlur = 0;
        } else if (e.type === "syndicate_bridge_layering") {
          ctx.strokeStyle = "rgba(168, 85, 247, 0.45)";
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw flow arrow on highlighted or direct fund flows
        if (isHighlighted || e.type === "direct_fund_flow") {
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;
          const angle = Math.atan2(t.y - s.y, t.x - s.x);
          const arrowLen = 7;
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(
            midX - arrowLen * Math.cos(angle - Math.PI / 6),
            midY - arrowLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            midX - arrowLen * Math.cos(angle + Math.PI / 6),
            midY - arrowLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.fillStyle = isHighlighted ? "#38bdf8" : "rgba(239, 68, 68, 0.7)";
          ctx.fill();
        }
      }

      // Draw Nodes
      for (const n of simNodes) {
        const isSelected = selectedNode && selectedNode.id === n.id;
        const isHovered = hoveredNode && hoveredNode.id === n.id;
        const isNeighbor =
          selectedNode &&
          selectedNode.connectedNeighbors?.some((nbr) => nbr.id === n.id);

        let fillColor = "#22c55e"; // Default Normal
        if (n.role === "MULE_HERDER") fillColor = "#ef4444";
        else if (n.role === "CASH_OUT") fillColor = "#a855f7";
        else if (n.role === "LAYERING_HUB") fillColor = "#f59e0b";
        else if (n.role === "FUNNEL_MULE") fillColor = "#38bdf8";

        // Dim unrelated nodes if a node is selected
        const alpha =
          !selectedNode || isSelected || isNeighbor || isHovered ? 1.0 : 0.28;

        // Halo ring for selected or hovered node
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + (isSelected ? 7 : 5), 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? "rgba(59, 130, 246, 0.35)"
            : "rgba(255, 255, 255, 0.25)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isSelected ? "#3b82f6" : "#ffffff";
          ctx.stroke();
        }

        // Main node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = n.avgRiskScore >= 70 ? 12 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Inner white dot for high-confidence mule accounts
        if (n.avgRiskScore >= 90) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }

        // Account Label
        ctx.font = isSelected
          ? "bold 11px JetBrains Mono, monospace"
          : "9px JetBrains Mono, monospace";
        ctx.fillStyle = isSelected ? "#ffffff" : "rgba(226, 232, 240, 0.75)";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + n.radius + 13);
      }

      ctx.restore();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [graph, zoom, pan, selectedNode, hoveredNode]);

  // Coordinate conversion helpers (Canvas Screen <-> World Space)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { worldX: 0, worldY: 0, clientX: e.clientX, clientY: e.clientY };
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Invert zoom and pan transform
    const worldX = (screenX - (w / 2 + pan.x)) / zoom + w / 2;
    const worldY = (screenY - (h / 2 + pan.y)) / zoom + h / 2;

    return { worldX, worldY, clientX: e.clientX, clientY: e.clientY };
  };

  // Find node under coordinates
  const getNodeAt = (worldX: number, worldY: number): CanvasNode | null => {
    const simNodes = simNodesRef.current;
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { worldX, worldY } = getCanvasCoords(e);
    const hit = getNodeAt(worldX, worldY);

    if (hit) {
      draggedNode.current = hit;
      setSelectedNode(hit);
    } else {
      isDraggingCanvas.current = true;
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { worldX, worldY, clientX, clientY } = getCanvasCoords(e);

    if (draggedNode.current) {
      draggedNode.current.x = worldX;
      draggedNode.current.y = worldY;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
    } else if (isDraggingCanvas.current) {
      setPan({
        x: clientX - dragStart.current.x,
        y: clientY - dragStart.current.y,
      });
    } else {
      // Hover detection
      const hit = getNodeAt(worldX, worldY);
      if (hit) {
        setHoveredNode(hit);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: clientX - rect.left + 15,
            y: clientY - rect.top + 15,
          });
        }
      } else {
        setHoveredNode(null);
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    draggedNode.current = null;
    isDraggingCanvas.current = false;
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.min(3.5, Math.max(0.4, prev * zoomFactor)));
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(3.5, z * 1.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z * 0.8));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Search node and center
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !graph) return;
    const q = searchQuery.toLowerCase().trim();
    const match = graph.nodes.find(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.occupation.toLowerCase().includes(q)
    );
    if (match) {
      setSelectedNode(match);
      // Center canvas on matched node
      const simNode = simNodesRef.current.find((sn) => sn.id === match.id);
      if (simNode && canvasRef.current) {
        const w = canvasRef.current.width / (window.devicePixelRatio || 1);
        const h = canvasRef.current.height / (window.devicePixelRatio || 1);
        setPan({
          x: -(simNode.x - w / 2) * zoom,
          y: -(simNode.y - h / 2) * zoom,
        });
      }
      showToast(`Located ${match.label} in ${match.syndicateRing || "Network"}`);
    } else {
      showToast(`No account matching "${searchQuery}" found in network.`);
    }
  };

  // Case promotion modal opener
  const openPromoteModal = (ring: SyndicateRing) => {
    setPromotingRing(ring);
    setCaseTitle(`Syndicate Investigation: ${ring.name}`);
    setCaseNotes(
      `Formal FinCEN SAR referral for syndicate ${ring.id} (${ring.name}). ` +
      `Anchor Account: ${ring.anchorAccountId}, Tracked Members: ${ring.memberCount}, ` +
      `Aggregate Volume: $${ring.totalVolume.toLocaleString()}, Average Risk: ${ring.avgRiskScore}/100. ` +
      `Primary Modus Operandi: ${ring.primaryModusOperandi}`
    );
  };

  const handleCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingRing) return;
    setIsSubmittingCase(true);
    try {
      const res = await promoteToCaseApi({
        accountId: promotingRing.anchorAccountId,
        title: caseTitle,
        riskScore: Math.round(promotingRing.avgRiskScore),
        priority: promotingRing.riskTier,
        alertTrigger: promotingRing.primaryModusOperandi,
        notes: caseNotes,
      });
      showToast(`Case ${res.caseNumber} initiated for ${promotingRing.name}!`);
      setPromotingRing(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create investigation case");
    } finally {
      setIsSubmittingCase(false);
    }
  };

  return (
    <>
      {/* Toast Notice Banner */}
      {toastMessage && (
        <div className="toast-notice">
          <svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h1 className="page-title">Fraud Network Visualization</h1>
          <p className="page-subtitle">
            Force-directed syndicate graph, counterparty layering flows, and behavioral association clusters
          </p>
        </div>
        <button
          className="btn"
          onClick={loadGraph}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Recomputing…" : "Recompute Graph"}
        </button>
      </div>

      {/* Syndicate Rings Strip */}
      {graph && (
        <div className="syndicates-strip">
          <button
            className={`syndicate-pill ${activeRing === "ALL" ? "active" : ""}`}
            onClick={() => setActiveRing("ALL")}
          >
            All Syndicates ({graph.stats.nodeCount} Nodes)
          </button>
          {graph.syndicateRings.map((s) => (
            <button
              key={s.id}
              className={`syndicate-pill ${activeRing === s.id ? "active" : ""}`}
              onClick={() => setActiveRing(s.id)}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: s.riskTier === "CRITICAL" ? "#ef4444" : "#f59e0b",
                }}
              />
              {s.name.split(" ")[0]} ({s.id})
            </button>
          ))}
        </div>
      )}

      {/* Main Interactive Split Layout */}
      {loading && !graph ? (
        <div className="loading" style={{ padding: "5rem 0" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
          <span>Building high-degree network topology and layering graph…</span>
        </div>
      ) : error ? (
        <div className="error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : graph ? (
        <div className="network-main-layout">
          {/* Canvas Wrapper */}
          <div className="canvas-wrapper">
            {/* Floating Top Controls Toolbar */}
            <div className="network-floating-toolbar">
              <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Find account in graph…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "rgba(15, 23, 42, 0.85)",
                    border: "1px solid var(--border)",
                    color: "#fff",
                    borderRadius: 6,
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.78rem",
                    width: 190,
                    backdropFilter: "blur(8px)",
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-sm"
                  style={{ background: "rgba(59, 130, 246, 0.3)", borderColor: "#3b82f6" }}
                >
                  Locate
                </button>
              </form>

              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as "ALL" | "CRITICAL_ONLY" | "CO_ACTIVITY")}
                style={{
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid var(--border)",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "0.4rem 0.65rem",
                  fontSize: "0.78rem",
                  backdropFilter: "blur(8px)",
                }}
              >
                <option value="ALL">View: All Topologies</option>
                <option value="CRITICAL_ONLY">View: High-Risk Only (Score ≥ 70)</option>
              </select>
            </div>

            {/* Zoom Controls Overlay */}
            <div className="network-zoom-controls">
              <button className="network-zoom-btn" onClick={handleZoomIn} title="Zoom In">
                +
              </button>
              <button className="network-zoom-btn" onClick={handleZoomOut} title="Zoom Out">
                −
              </button>
              <button className="network-zoom-btn" onClick={handleResetView} title="Reset Camera" style={{ fontSize: "0.75rem" }}>
                ⊙
              </button>
            </div>

            {/* Role Color Legend Overlay */}
            <div className="network-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#ef4444" }} />
                <span>Mule Herder</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#f59e0b" }} />
                <span>Layering Hub</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#a855f7" }} />
                <span>Cash-Out</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#38bdf8" }} />
                <span>Funnel</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#22c55e" }} />
                <span>Normal</span>
              </div>
            </div>

            {/* Hover Tooltip */}
            {hoveredNode && tooltipPos && (
              <div
                style={{
                  position: "absolute",
                  left: tooltipPos.x,
                  top: tooltipPos.y,
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                  borderRadius: 8,
                  padding: "0.6rem 0.85rem",
                  color: "#fff",
                  fontSize: "0.75rem",
                  pointerEvents: "none",
                  zIndex: 50,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "#38bdf8", marginBottom: "0.2rem" }}>
                  {hoveredNode.label}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.2rem" }}>
                  <span style={{ color: "var(--muted)" }}>Role:</span>
                  <span style={{ fontWeight: 600 }}>{hoveredNode.role.replace("_", " ")}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.2rem" }}>
                  <span style={{ color: "var(--muted)" }}>Risk Score:</span>
                  <span style={{ color: hoveredNode.avgRiskScore >= 70 ? "#f87171" : "#4ade80", fontWeight: 700 }}>
                    {hoveredNode.avgRiskScore}/100
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <span style={{ color: "var(--muted)" }}>Turnover:</span>
                  <span>${hoveredNode.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="network-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
            />
          </div>

          {/* Right Intelligence Sidebar */}
          <div className="network-sidebar">
            {selectedNode ? (
              <>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>
                      Target Account Dossier
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.45rem",
                        borderRadius: 4,
                        background:
                          selectedNode.role === "MULE_HERDER"
                            ? "rgba(239, 68, 68, 0.2)"
                            : selectedNode.role === "LAYERING_HUB"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(56, 189, 248, 0.2)",
                        color:
                          selectedNode.role === "MULE_HERDER"
                            ? "#f87171"
                            : selectedNode.role === "LAYERING_HUB"
                            ? "#fbbf24"
                            : "#38bdf8",
                      }}
                    >
                      {selectedNode.role.replace("_", " ")}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.25rem", fontFamily: "var(--mono)", color: "#fff", margin: 0 }}>
                    {selectedNode.label}
                  </h3>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {selectedNode.occupation} • {selectedNode.syndicateRing || "Independent"}
                  </div>
                </div>

                {/* Risk & Volume Meter */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <div style={{ background: "var(--surface2)", padding: "0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>RISK ASSESSMENT</div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: selectedNode.avgRiskScore >= 70 ? "#f87171" : "#4ade80" }}>
                      {selectedNode.avgRiskScore} <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>/100</span>
                    </div>
                  </div>
                  <div style={{ background: "var(--surface2)", padding: "0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>TRACKED VOLUME</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", fontFamily: "var(--mono)", marginTop: "0.2rem" }}>
                      ${selectedNode.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Triggered Modus Operandi */}
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                    Active Modus Operandi
                  </div>
                  {selectedNode.indicators && selectedNode.indicators.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {selectedNode.indicators.map((ind, i) => (
                        <span key={i} className="indicator-mini-chip" style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem" }}>
                          {ind}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>No behavioral alert breaches.</span>
                  )}
                </div>

                {/* Connected Counterparties */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase" }}>
                      Connected Entities ({selectedNode.connectedNeighbors?.length || 0})
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Click to Inspect</span>
                  </div>

                  <div className="neighbor-list">
                    {selectedNode.connectedNeighbors && selectedNode.connectedNeighbors.length > 0 ? (
                      selectedNode.connectedNeighbors.map((nbr) => (
                        <div
                          key={nbr.id}
                          className="neighbor-item"
                          onClick={() => {
                            const found = graph.nodes.find((n) => n.id === nbr.id);
                            if (found) setSelectedNode(found);
                          }}
                        >
                          <div>
                            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#93c5fd" }}>
                              {nbr.label}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                              {nbr.relationship}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, color: "#e2e8f0" }}>
                            ${nbr.amount.toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        No direct counterparty links mapped.
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "auto" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/accounts?search=${selectedNode.id}`)}
                    style={{ justifyContent: "center", fontSize: "0.82rem" }}
                  >
                    Open Account Dossier
                  </button>
                  <button
                    className="btn"
                    onClick={() => navigate(`/transactions?search=${selectedNode.id}`)}
                    style={{ justifyContent: "center", fontSize: "0.82rem" }}
                  >
                    View Account Transactions
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--muted)" }}>
                <p>Click on any node in the canvas to inspect counterparty connections, modus operandi, and flow channels.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Syndicate Rings Analysis Table */}
      {graph && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                Detected Mule Syndicate Networks
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.2rem 0 0 0" }}>
                Multi-account collusion clusters discovered through synchronized behavioral patterns
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Ring ID</th>
                  <th>Syndicate Name</th>
                  <th style={{ width: 130 }}>Anchor Hub</th>
                  <th style={{ width: 90, textAlign: "center" }}>Members</th>
                  <th style={{ width: 140, textAlign: "right" }}>Total Volume</th>
                  <th style={{ width: 90, textAlign: "center" }}>Avg Risk</th>
                  <th>Primary Modus Operandi</th>
                  <th style={{ width: 120, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {graph.syndicateRings.map((s) => (
                  <tr
                    key={s.id}
                    className="clickable"
                    onClick={() => {
                      setActiveRing(s.id);
                      const anchor = graph.nodes.find((n) => n.id === s.anchorAccountId);
                      if (anchor) setSelectedNode(anchor);
                      showToast(`Isolated ${s.name} in network graph`);
                    }}
                  >
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#38bdf8" }}>
                      {s.id}
                    </td>
                    <td style={{ fontWeight: 600, color: "#fff" }}>{s.name}</td>
                    <td>
                      <span
                        style={{ fontFamily: "var(--mono)", color: "#93c5fd", textDecoration: "underline", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/accounts?search=${s.anchorAccountId}`);
                        }}
                      >
                        {s.anchorAccountId}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{s.memberCount}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "#f8fafc" }}>
                      ${s.totalVolume.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`badge ${s.avgRiskScore >= 90 ? "badge-fraud" : "badge-review"}`}
                        style={{ fontWeight: 800 }}
                      >
                        {s.avgRiskScore}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {s.primaryModusOperandi}
                    </td>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-promote-sm"
                        onClick={() => openPromoteModal(s)}
                        title="Promote syndicate ring to FinCEN SAR Investigation Case"
                      >
                        Case +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Promotion Modal */}
      {promotingRing && (
        <div className="modal-backdrop" onClick={() => !isSubmittingCase && setPromotingRing(null)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Promote Syndicate to Investigation Case</h3>
                <p className="modal-subtitle">
                  Create a syndicate-level investigation record for {promotingRing.name}
                </p>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => !isSubmittingCase && setPromotingRing(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCaseSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Case Title</label>
                <input
                  className="form-input"
                  required
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Anchor Account Hub</label>
                  <input
                    className="form-input"
                    disabled
                    value={promotingRing.anchorAccountId}
                    style={{ opacity: 0.8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <input
                    className="form-input"
                    disabled
                    value={promotingRing.riskTier}
                    style={{ opacity: 0.8 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Investigator Notes & Incident Trigger</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  required
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={isSubmittingCase}
                  onClick={() => setPromotingRing(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCase}
                >
                  {isSubmittingCase ? "Creating Case…" : "Confirm & Open Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
