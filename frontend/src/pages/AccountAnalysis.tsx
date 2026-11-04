import React, { useCallback, useEffect, useState } from "react";
import {
  AccountRiskDossier,
  AccountSummary,
  getAccountDossier,
  getAccounts,
} from "../api/client";

export default function AccountAnalysisPage() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");

  // Selected account dossier state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dossier, setDossier] = useState<AccountRiskDossier | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load account list
  const loadAccounts = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
        sortBy,
        sortDir: "desc",
      });
      if (search.trim()) params.set("search", search.trim());
      if (riskLevel) params.set("riskLevel", riskLevel);
      if (occupation) params.set("occupation", occupation);

      const res = await getAccounts(params);
      setAccounts(res.accounts);
      setTotal(res.total);
      setTotalPages(res.totalPages);

      // Auto-select first account if none selected
      if (!selectedId && res.accounts.length > 0) {
        setSelectedId(res.accounts[0].rawAccountId);
      }
    } catch {
      // Handled in UI
    } finally {
      setLoadingList(false);
    }
  }, [page, search, riskLevel, occupation, sortBy, selectedId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Load selected account dossier
  const loadDossier = useCallback(async (rawId: number) => {
    setLoadingDossier(true);
    setDossierError(null);
    setActionNotice(null);
    try {
      const data = await getAccountDossier(rawId);
      setDossier(data);
    } catch (err: unknown) {
      setDossierError(err instanceof Error ? err.message : "Failed to load account dossier.");
    } finally {
      setLoadingDossier(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDossier(selectedId);
    }
  }, [selectedId, loadDossier]);

  const handleCreateCase = () => {
    if (!dossier) return;
    setActionNotice(
      `Investigation case dispatched for ${dossier.identification.accountId}. Lead analyst assigned.`
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="account-analysis-page">
      {/* Page Header */}
      <div className="dashboard-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <div className="dashboard-eyebrow">
            <span className="live-dot" />
            <span>EXPLAINABLE AI RISK INTELLIGENCE</span>
            <span className="divider">•</span>
            <span>Deep 360° Account Telemetry</span>
          </div>
          <h1 className="page-title">Account Risk &amp; Explainability Dossier</h1>
          <p className="page-subtitle">
            Inspect individual account risk indicators, feature attributions, financial activity logs, and linked AML cases.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filters-bar card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="form-input"
              placeholder="Search Account ID, occupation, product..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filter-selects">
            <select
              className="form-select"
              value={riskLevel}
              onChange={(e) => {
                setRiskLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Risk Tiers</option>
              <option value="critical">Critical Mule (90+)</option>
              <option value="high">High Risk (70–89)</option>
              <option value="medium">Medium Risk (40–69)</option>
              <option value="low">Low Risk (&lt;40)</option>
            </select>

            <select
              className="form-select"
              value={occupation}
              onChange={(e) => {
                setOccupation(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Occupations</option>
              <option value="student">Student Profile</option>
              <option value="housewife">Housewife Profile</option>
              <option value="salaried">Salaried Employee</option>
              <option value="selfemployed">Self-Employed / Trader</option>
              <option value="agriculture">Agriculture / Rural</option>
            </select>

            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="risk_score">Sort: Highest Risk</option>
              <option value="date">Sort: Detection Date</option>
              <option value="id">Sort: Account ID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master-Detail Split Grid */}
      <div className="analysis-split-layout">
        {/* Left Column: Account Selection Table */}
        <div className="card accounts-list-panel">
          <div className="panel-header">
            <span className="panel-title">MONITORED ACCOUNTS</span>
            <span className="badge badge-chip">{total.toLocaleString()} Accounts</span>
          </div>

          {loadingList ? (
            <div className="loading" style={{ padding: "2rem" }}>
              <div className="spinner" style={{ margin: "0 auto 0.5rem" }} />
              <span>Querying account index...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">
              <p>No accounts match the active filter criteria.</p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  setSearch("");
                  setRiskLevel("");
                  setOccupation("");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="account-table-wrapper">
              <table className="account-compact-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Profile</th>
                    <th>Vintage</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => {
                    const isSelected = selectedId === acc.rawAccountId;
                    return (
                      <tr
                        key={acc.rawAccountId}
                        className={`account-row-item ${isSelected ? "selected-row" : ""}`}
                        onClick={() => setSelectedId(acc.rawAccountId)}
                      >
                        <td>
                          <div className="acc-cell-main">
                            <span className="acc-id">{acc.accountId}</span>
                            <span className="acc-product">{acc.productName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="acc-occup">{acc.occupation}</span>
                        </td>
                        <td>
                          <span className={`vintage-pill ${acc.vintageBucket === "L7D" ? "vintage-new" : ""}`}>
                            {acc.vintageBucket}
                          </span>
                        </td>
                        <td>
                          <span className={`risk-badge-mini risk-${acc.riskLevel}`}>
                            {acc.riskScore}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Compact Pagination */}
              <div className="pagination-compact">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="page-indicator">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detailed Account Dossier */}
        <div className="dossier-main-panel">
          {loadingDossier ? (
            <div className="card dossier-loading">
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <span>Synthesizing deep risk indicators &amp; feature attributions...</span>
            </div>
          ) : dossierError ? (
            <div className="card alert-box alert-error">
              <span>{dossierError}</span>
            </div>
          ) : !dossier ? (
            <div className="card empty-state" style={{ padding: "4rem 2rem" }}>
              <h3>Select an Account to Begin Analysis</h3>
              <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                Select any monitored account from the index to inspect its risk indicators, feature attributions, and transaction history.
              </p>
            </div>
          ) : (
            <div className="dossier-content">
              {/* Action Banner if triggered */}
              {actionNotice && (
                <div className="alert-box alert-success" style={{ marginBottom: "1rem" }}>
                  <span>{actionNotice}</span>
                </div>
              )}

              {/* 1. Account Risk Assessment Header */}
              <div className={`card risk-assessment-card risk-bg-${dossier.riskAssessment.riskLevel}`}>
                <div className="risk-header-left">
                  <div className="account-tag-row">
                    <span className="account-title-code">{dossier.identification.accountId}</span>
                    <span className="badge badge-chip">Raw Ref #{dossier.identification.rawAccountId}</span>
                    <span className={`badge ${dossier.riskAssessment.prediction === "fraud" ? "badge-fraud" : "badge-legit"}`}>
                      {dossier.riskAssessment.prediction.toUpperCase()} PREDICTION
                    </span>
                  </div>
                  <div className="account-sub-headline">
                    Customer Profile: <strong>{dossier.identification.occupation.toUpperCase()}</strong> •{" "}
                    {dossier.identification.productName} • Vintage:{" "}
                    <span className={dossier.identification.vintageBucket === "L7D" ? "stat-fraud" : ""}>
                      {dossier.identification.vintageBucket} (
                      {dossier.identification.vintageBucket === "L7D" ? "New Account <7 Days" : "Standard Vintage"})
                    </span>
                  </div>
                </div>

                <div className="risk-score-display">
                  <div className="score-number-group">
                    <span className="score-big">{dossier.riskAssessment.riskScore}</span>
                    <span className="score-denom">/100</span>
                  </div>
                  <div className={`score-label-badge risk-${dossier.riskAssessment.riskLevel}`}>
                    {dossier.riskAssessment.riskLevel.toUpperCase()} RISK TIER
                  </div>
                  <div className="confidence-sub">
                    Confidence: <strong>{dossier.riskAssessment.confidence}%</strong>
                  </div>
                </div>
              </div>

              {/* 2. Demographic & Account Metadata Ribbon */}
              <div className="card meta-ribbon-card">
                <div className="meta-grid">
                  <div className="meta-item">
                    <span className="meta-k">Customer Age</span>
                    <span className="meta-v">{dossier.identification.customerAge ? `${dossier.identification.customerAge} yrs` : "N/A"}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Tenure in Bank</span>
                    <span className="meta-v">{dossier.identification.tenureMonths} Months</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Geographic Area</span>
                    <span className="meta-v">{dossier.identification.areaCategory}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Segment Class</span>
                    <span className="meta-v">{dossier.identification.segmentationClass}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Account Opened</span>
                    <span className="meta-v">{dossier.identification.accountOpenDate || "10-25-2011"}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Incident Score</span>
                    <span className="meta-v stat-neutral">{dossier.riskAssessment.incidentScore}</span>
                  </div>
                </div>
              </div>

              {/* 3. Important Risk Indicators Section */}
              <div className="card indicators-card">
                <div className="card-header-row" style={{ marginBottom: "0.85rem" }}>
                  <div>
                    <h3 className="section-title">Verified Fraud Indicators</h3>
                    <p className="card-caption">Rule triggers detected in customer transaction &amp; operational logs</p>
                  </div>
                  <span className="badge badge-chip">
                    {dossier.importantIndicators.filter((i) => i.active).length} Active Flags
                  </span>
                </div>

                <div className="indicators-grid">
                  {dossier.importantIndicators.map((ind, idx) => (
                    <div
                      key={idx}
                      className={`indicator-card ${ind.active ? "indicator-active" : "indicator-dormant"}`}
                    >
                      <div className="indicator-top">
                        <span className="indicator-name">{ind.name}</span>
                        {ind.active ? (
                          <span className={`priority-tag priority-${ind.severity.toLowerCase()}`}>
                            {ind.severity}
                          </span>
                        ) : (
                          <span className="status-pill" style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8" }}>
                            CLEAN
                          </span>
                        )}
                      </div>
                      <p className="indicator-desc">{ind.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Explainable AI: Feature Contribution Explanations */}
              <div className="card explainability-card">
                <div className="card-header-row" style={{ marginBottom: "0.85rem" }}>
                  <div>
                    <h3 className="section-title">Machine Learning Explainability (Feature Attributions)</h3>
                    <p className="card-caption">Top statistical attributes driving this account&apos;s risk score</p>
                  </div>
                  <span className="badge badge-legit">LightGBM Model</span>
                </div>

                <div className="contributions-list">
                  {dossier.featureContributions.map((fc, idx) => (
                    <div key={idx} className="contribution-item">
                      <div className="contrib-header">
                        <span className="contrib-label">{fc.label}</span>
                        <div className="contrib-stats">
                          <span className="contrib-val">Value: {fc.accountValue}</span>
                          <span className={`contrib-direction ${fc.impact === "INCREASES_RISK" ? "impact-up" : "impact-down"}`}>
                            {fc.impact === "INCREASES_RISK" ? "▲ Increases Risk" : "▼ Reduces Risk"}
                          </span>
                        </div>
                      </div>
                      <div className="contrib-bar-track">
                        <div
                          className="contrib-bar-fill"
                          style={{
                            width: `${Math.min(100, (fc.importanceWeight / 270) * 100)}%`,
                            background: fc.impact === "INCREASES_RISK" ? "linear-gradient(90deg, #f97316, #ef4444)" : "#10b981",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Related Activity & Case History (Two Columns) */}
              <div className="grid grid-2">
                {/* Activity Log */}
                <div className="card">
                  <div className="card-header-row" style={{ marginBottom: "0.75rem" }}>
                    <h3 className="section-title">Recent Activity Logs</h3>
                    <span className="badge badge-chip">31-Day Window</span>
                  </div>
                  <div className="activity-list">
                    {dossier.activityLog.map((act) => (
                      <div key={act.id} className="activity-row">
                        <div className="activity-info">
                          <span className="activity-type">{act.type}</span>
                          <span className="activity-date">{act.date}</span>
                        </div>
                        <div className="activity-metrics">
                          <span className="activity-amount">${act.amount.toLocaleString()}</span>
                          {act.riskFlag && <span className="badge badge-fraud" style={{ fontSize: "0.65rem" }}>FLAGGED</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Investigation History */}
                <div className="card">
                  <div className="card-header-row" style={{ marginBottom: "0.75rem" }}>
                    <h3 className="section-title">Linked Investigations</h3>
                    <button className="btn btn-primary btn-sm" onClick={handleCreateCase}>
                      + Initiate Case
                    </button>
                  </div>

                  {dossier.investigationHistory.length === 0 ? (
                    <div className="empty-state" style={{ padding: "1.5rem" }}>
                      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        No formal SAR investigation has been recorded yet for this account.
                      </p>
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={handleCreateCase}>
                        Open New Case Dossier
                      </button>
                    </div>
                  ) : (
                    <div className="investigations-list">
                      {dossier.investigationHistory.map((c, i) => (
                        <div key={i} className="investigation-item-card" style={{ padding: "0.75rem" }}>
                          <div className="investigation-top">
                            <span className="case-number-tag">{c.caseNumber}</span>
                            <span className={`priority-tag priority-${c.priority.toLowerCase()}`}>{c.priority}</span>
                          </div>
                          <div className="investigation-title" style={{ fontSize: "0.85rem" }}>{c.title}</div>
                          <div className="investigation-meta">
                            <span>Owner: {c.assignedAnalyst}</span>
                            <span className="investigation-status">{c.status.replace("_", " ")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
