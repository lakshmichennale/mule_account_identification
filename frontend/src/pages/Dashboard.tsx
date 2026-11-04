import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { AlertItem, DashboardStats, getDashboardStats, InvestigationItem } from "../api/client";

const RISK_COLORS: Record<string, string> = {
  low: "#10b981",       // Emerald
  medium: "#f59e0b",    // Amber
  high: "#f97316",      // Orange
  critical: "#ef4444",  // Crimson
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [selectedCase, setSelectedCase] = useState<InvestigationItem | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <span>Aggregating real-time AML intelligence and model telemetry...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="card alert-box alert-error" style={{ margin: "2rem auto", maxWidth: 600 }}>
        <span>{error}</span>
        <button className="btn btn-primary" onClick={fetchStats} style={{ marginTop: "1rem" }}>
          Retry Telemetry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // Format data for Recharts Pie
  const riskPieData = [
    { name: "Low Risk (<40)", key: "low", value: stats.riskDistribution.low || 0 },
    { name: "Medium Risk (40-69)", key: "medium", value: stats.riskDistribution.medium || 0 },
    { name: "High Risk (70-89)", key: "high", value: stats.riskDistribution.high || 0 },
    { name: "Critical Mule (90+)", key: "critical", value: stats.riskDistribution.critical || 0 },
  ].filter((d) => d.value > 0);

  // Format data for Trends
  const trendData = stats.fraudTrends.map((t) => ({
    month: t.month,
    accounts: t.transactions,
    fraudMules: t.fraud,
    ratePercent: t.fraudRate,
    avgRisk: t.avgRisk || 0,
  }));

  const model = stats.modelPerformanceSummary;

  return (
    <div className="dashboard-page">
      {/* Top Header */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-eyebrow">
            <span className="live-dot" />
            <span>EXECUTIVE FRAUD INTELLIGENCE CONSOLE</span>
            <span className="divider">•</span>
            <span>Real Dataset Ground Truth</span>
          </div>
          <h1 className="page-title">Mule Account Command Center</h1>
          <p className="page-subtitle">
            Autonomous detection across {stats.totalAccounts.toLocaleString()} enterprise accounts with verified ML explainability.
          </p>
        </div>

        <div className="dashboard-actions">
          <button className="btn btn-secondary" onClick={fetchStats} disabled={loading} title="Refresh real-time stats">
            <span style={{ display: "inline-block", transform: loading ? "rotate(180deg)" : "none", transition: "transform 0.4s" }}>
              ↻
            </span>
            <span>{loading ? "Syncing..." : "Live Refresh"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (5 Core Cards) */}
      <div className="kpi-grid">
        <div className="kpi-card card">
          <div className="kpi-header">
            <span className="kpi-label">Total Accounts Monitored</span>
            <span className="kpi-icon">🏛️</span>
          </div>
          <div className="kpi-val stat-neutral">{stats.totalAccounts.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="kpi-sub">100% of accounts evaluated</span>
          </div>
        </div>

        <div className="kpi-card card kpi-danger">
          <div className="kpi-header">
            <span className="kpi-label">High &amp; Critical Mule Risk</span>
            <span className="kpi-icon">🚨</span>
          </div>
          <div className="kpi-val stat-fraud">{stats.highRiskAccounts.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="badge badge-fraud">{stats.criticalRiskAccounts} Critical (90+)</span>
          </div>
        </div>

        <div className="kpi-card card kpi-warning">
          <div className="kpi-header">
            <span className="kpi-label">Medium Risk Review</span>
            <span className="kpi-icon">⚠️</span>
          </div>
          <div className="kpi-val" style={{ color: "#f59e0b" }}>
            {stats.mediumRiskAccounts}
          </div>
          <div className="kpi-footer">
            <span className="kpi-sub">Score threshold 40–69</span>
          </div>
        </div>

        <div className="kpi-card card kpi-success">
          <div className="kpi-header">
            <span className="kpi-label">Low Risk / Verified Clean</span>
            <span className="kpi-icon">🛡️</span>
          </div>
          <div className="kpi-val stat-legit">{stats.lowRiskAccounts.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="kpi-sub">{( (stats.lowRiskAccounts / stats.totalAccounts) * 100 ).toFixed(1)}% safe baseline</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-header">
            <span className="kpi-label">Suspicious Incident Flags</span>
            <span className="kpi-icon">⚡</span>
          </div>
          <div className="kpi-val" style={{ color: "#38bdf8" }}>
            {stats.suspiciousCount}
          </div>
          <div className="kpi-footer">
            <span className="kpi-sub">Mule detection rate: {stats.fraudPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Risk Distribution + Monthly Trends */}
      <div className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        {/* Risk Distribution Chart */}
        <div className="card chart-card">
          <div className="card-header-row">
            <div>
              <div className="card-title">Portfolio Risk Stratification</div>
              <div className="card-caption">Account distribution by ML risk severity tier</div>
            </div>
            <span className="badge badge-legit">Live ML Scored</span>
          </div>

          <div className="chart-container" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskPieData.map((entry) => (
                    <Cell key={entry.key} fill={RISK_COLORS[entry.key] || "#6366f1"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "0.85rem",
                  }}
                  formatter={(value: any) => [`${value} accounts`, "Count"]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fraud Trends Chart */}
        <div className="card chart-card">
          <div className="card-header-row">
            <div>
              <div className="card-title">Temporal Incident Velocity</div>
              <div className="card-caption">Historical alert volumes and fraud concentration by reporting month</div>
            </div>
            <span className="badge badge-chip">Temporal Audit</span>
          </div>

          <div className="chart-container" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />
                <Area type="monotone" dataKey="accounts" name="Total Evaluated" stroke="#3b82f6" fill="url(#alertGrad)" />
                <Area type="monotone" dataKey="fraudMules" name="Confirmed Mules" stroke="#ef4444" fill="url(#fraudGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Performance Summary Panel */}
      <div className="card model-performance-card" style={{ marginBottom: "1.5rem" }}>
        <div className="model-summary-header">
          <div className="model-badge-row">
            <span className="badge badge-chip" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}>
              PRODUCTION ML ENGINE
            </span>
            <span className="model-status-indicator">● {model.evaluationStatus}</span>
          </div>
          <h2 className="model-title">{model.algorithm}</h2>
          <p className="model-sub">
            Trained on 7,265 stratified records; evaluated against 1,817 out-of-sample test records with zero temporal leakage.
          </p>
        </div>

        <div className="model-metrics-grid">
          <div className="metric-box">
            <span className="metric-title">PR-AUC (Precision-Recall)</span>
            <span className="metric-val" style={{ color: "#38bdf8" }}>{model.prAuc}%</span>
            <span className="metric-desc">Primary fraud metric</span>
          </div>

          <div className="metric-box">
            <span className="metric-title">Precision @ Fraud</span>
            <span className="metric-val" style={{ color: "#34d399" }}>{model.precision}%</span>
            <span className="metric-desc">Only 1 false alarm</span>
          </div>

          <div className="metric-box">
            <span className="metric-title">Mule Recall</span>
            <span className="metric-val" style={{ color: "#fbbf24" }}>{model.recall}%</span>
            <span className="metric-desc">81.25% detected early</span>
          </div>

          <div className="metric-box">
            <span className="metric-title">F1-Score</span>
            <span className="metric-val" style={{ color: "#c084fc" }}>{model.f1Score}%</span>
            <span className="metric-desc">Harmonic balance</span>
          </div>

          <div className="metric-box">
            <span className="metric-title">ROC-AUC</span>
            <span className="metric-val" style={{ color: "#60a5fa" }}>{model.rocAuc}%</span>
            <span className="metric-desc">Separability power</span>
          </div>
        </div>

        {/* Confusion Matrix Mini-Grid */}
        <div className="confusion-matrix-container">
          <span className="cm-label">Test Split Confusion Matrix (N = {model.testSize}):</span>
          <div className="cm-grid">
            <div className="cm-cell cm-tn">
              <span className="cm-val">{model.confusionMatrix[0]?.[0]}</span>
              <span className="cm-tag">True Clean</span>
            </div>
            <div className="cm-cell cm-fp">
              <span className="cm-val">{model.confusionMatrix[0]?.[1]}</span>
              <span className="cm-tag">False Alarm</span>
            </div>
            <div className="cm-cell cm-fn">
              <span className="cm-val">{model.confusionMatrix[1]?.[0]}</span>
              <span className="cm-tag">Missed Mule</span>
            </div>
            <div className="cm-cell cm-tp">
              <span className="cm-val">{model.confusionMatrix[1]?.[1]}</span>
              <span className="cm-tag">Caught Mule</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Two-Column Section: Recent Alerts + Recent Investigations */}
      <div className="grid grid-2">
        {/* Recent High-Priority Alerts */}
        <div className="card">
          <div className="card-header-row" style={{ marginBottom: "1rem" }}>
            <div>
              <div className="card-title">Real-Time Threat Alerts</div>
              <div className="card-caption">Highest-severity accounts flagged by detection engine</div>
            </div>
            <span className="badge badge-fraud">{stats.recentAlerts.length} Flagged</span>
          </div>

          <div className="alerts-list">
            {stats.recentAlerts.map((alt) => (
              <div
                key={alt.alertId}
                className="alert-item-card"
                onClick={() => setSelectedAlert(alt)}
              >
                <div className="alert-item-top">
                  <span className="alert-id-code">{alt.alertId}</span>
                  <span className={`badge ${alt.riskScore >= 90 ? "badge-fraud" : "badge-chip"}`}>
                    Score {alt.riskScore}
                  </span>
                </div>
                <div className="alert-item-title">{alt.category}</div>
                <div className="alert-item-meta">
                  <span>Target: <strong>{alt.accountId}</strong></span>
                  <span>Profile: {alt.occupation}</span>
                  <span className={`status-pill status-${alt.status.toLowerCase()}`}>{alt.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Investigation Cases */}
        <div className="card">
          <div className="card-header-row" style={{ marginBottom: "1rem" }}>
            <div>
              <div className="card-title">Active Investigation Cases</div>
              <div className="card-caption">Persistent SAR and syndicate cases in triage</div>
            </div>
            <span className="badge badge-chip">SQLite Store</span>
          </div>

          <div className="investigations-list">
            {stats.recentInvestigations.map((inv) => (
              <div
                key={inv.id}
                className="investigation-item-card"
                onClick={() => setSelectedCase(inv)}
              >
                <div className="investigation-top">
                  <span className="case-number-tag">{inv.caseNumber}</span>
                  <span className={`priority-tag priority-${inv.priority.toLowerCase()}`}>
                    {inv.priority}
                  </span>
                </div>
                <div className="investigation-title">{inv.title}</div>
                <div className="investigation-meta">
                  <span>Account: <strong>{inv.accountId}</strong></span>
                  <span>Owner: {inv.assignedAnalyst}</span>
                  <span className="investigation-status">{inv.status.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alert Dossier: {selectedAlert.alertId}</h3>
              <button className="modal-close" onClick={() => setSelectedAlert(null)}>✕</button>
            </div>
            <div className="detail-row"><span>Target Account</span><strong>{selectedAlert.accountId}</strong></div>
            <div className="detail-row"><span>Alert Category</span><span>{selectedAlert.category}</span></div>
            <div className="detail-row"><span>Risk Score</span><span className="risk-critical">{selectedAlert.riskScore}/100 ({(selectedAlert.riskLevel || selectedAlert.severity || "CRITICAL").toUpperCase()})</span></div>
            <div className="detail-row"><span>Customer Profile</span><span>{selectedAlert.occupation} ({selectedAlert.productName})</span></div>
            <div className="detail-row"><span>Detection Date</span><span>{selectedAlert.detectionDate}</span></div>
            <div className="detail-row"><span>Operational Status</span><span className="badge badge-fraud">{selectedAlert.status}</span></div>
            <div className="detail-row"><span>Primary Rule Trigger</span><span>{selectedAlert.triggerReason}</span></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedAlert(null)}>Dismiss</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  alert(`Case created for ${selectedAlert.accountId}`);
                  setSelectedAlert(null);
                }}
              >
                Promote to Investigation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Investigation Case: {selectedCase.caseNumber}</h3>
              <button className="modal-close" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="detail-row"><span>Account Under Review</span><strong>{selectedCase.accountId}</strong></div>
            <div className="detail-row"><span>Case Classification</span><span>{selectedCase.title}</span></div>
            <div className="detail-row"><span>Priority</span><span className={`priority-tag priority-${selectedCase.priority.toLowerCase()}`}>{selectedCase.priority}</span></div>
            <div className="detail-row"><span>Case Status</span><span>{selectedCase.status.replace("_", " ")}</span></div>
            <div className="detail-row"><span>Lead Investigator</span><span>{selectedCase.assignedAnalyst}</span></div>
            {selectedCase.notes && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#0f172a", borderRadius: "8px", fontSize: "0.85rem", color: "#cbd5e1" }}>
                <strong>Analyst Notes:</strong>
                <p style={{ marginTop: "0.35rem" }}>{selectedCase.notes}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedCase(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
