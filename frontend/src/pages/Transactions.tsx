import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Transaction,
  TransactionDetail,
  getTransactionDetail,
  getTransactions,
  promoteToCaseApi,
} from "../api/client";

export default function TransactionsPage() {
  const navigate = useNavigate();

  // Data state
  const [data, setData] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    transactions: Transaction[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [riskLevel, setRiskLevel] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");

  // Inspection Drawer & Case Modal state
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [promotingTxn, setPromotingTxn] = useState<Transaction | TransactionDetail | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [casePriority, setCasePriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [caseNotes, setCaseNotes] = useState("");
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Load transactions
  const loadTransactions = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });

    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (riskLevel) params.set("riskLevel", riskLevel);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);

    getTransactions(params)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || "Failed to load transactions");
        setLoading(false);
      });
  }, [page, pageSize, search, statusFilter, riskLevel, minAmount, maxAmount, sortBy, sortDir]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Open transaction inspection drawer
  const openDetail = async (id: number) => {
    setDrawerLoading(true);
    try {
      const detail = await getTransactionDetail(id);
      setSelectedTxn(detail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load transaction detail");
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Promote to Case modal
  const openPromoteModal = (txn: Transaction | TransactionDetail) => {
    setPromotingTxn(txn);
    setCaseTitle(`Investigation: Mule Infiltration Alert on ${txn.accountId}`);
    const prio = txn.riskScore >= 90 ? "CRITICAL" : txn.riskScore >= 70 ? "HIGH" : "MEDIUM";
    setCasePriority(prio);
    setCaseNotes(
      `Transaction #${txn.transactionId} flagged with status ${txn.status || "SUSPICIOUS"}. ` +
      `Amount: $${txn.amount.toLocaleString()}, Channel: ${txn.transactionType}, Risk: ${txn.riskScore}/100. ` +
      `Triggered indicators: ${(txn.riskIndicators || []).join(", ") || "ML high probability anomaly"}.`
    );
  };

  // Submit case promotion
  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingTxn) return;
    setIsSubmittingCase(true);
    try {
      const res = await promoteToCaseApi({
        accountId: promotingTxn.accountId,
        rawAccountId: promotingTxn.rawAccountId,
        title: caseTitle,
        riskScore: promotingTxn.riskScore,
        priority: casePriority,
        alertTrigger: (promotingTxn.riskIndicators || []).join(" | ") || `Risk score ${promotingTxn.riskScore}/100 anomaly`,
        notes: caseNotes,
      });
      showToast(`Case ${res.caseNumber} successfully initiated and logged to audit trail.`);
      setPromotingTxn(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create investigation case");
    } finally {
      setIsSubmittingCase(false);
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRiskLevel("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("risk_score");
    setSortDir("desc");
    setPage(1);
  };

  // Copy transaction payload to clipboard
  const copyTxnJson = (detail: TransactionDetail) => {
    navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
    showToast(`Transaction #${detail.transactionId} JSON copied to clipboard`);
  };

  return (
    <>
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className="toast-notice">
          <svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Subtitle */}
      <div className="page-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h1 className="page-title">Real-Time Transaction Monitoring</h1>
          <p className="page-subtitle">
            Forensic transaction ledger, counterparty routing analysis, and automated AML rule matching across 9,082 scored records
          </p>
        </div>
        <button
          className="btn"
          onClick={loadTransactions}
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
          {loading ? "Refreshing…" : "Refresh Feed"}
        </button>
      </div>

      {/* Interactive Metric Strip */}
      <div className="txn-metrics-strip">
        <div
          className={`txn-metric-pill ${statusFilter === "" ? "active" : ""}`}
          onClick={() => { setStatusFilter(""); setPage(1); }}
          title="Click to show all transactions"
        >
          <span className="txn-metric-label">
            All Monitored
            <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>9,082 TOTAL</span>
          </span>
          <span className="txn-metric-val">9,082</span>
        </div>

        <div
          className={`txn-metric-pill pill-blocked ${statusFilter === "BLOCKED" ? "active" : ""}`}
          onClick={() => { setStatusFilter("BLOCKED"); setPage(1); }}
          title="Click to filter Blocked transactions (Score >= 90)"
        >
          <span className="txn-metric-label">
            Blocked (Risk ≥ 90)
            <span style={{ color: "#f87171" }}>CRITICAL</span>
          </span>
          <span className="txn-metric-val">108</span>
        </div>

        <div
          className={`txn-metric-pill pill-flagged ${statusFilter === "FLAGGED" ? "active" : ""}`}
          onClick={() => { setStatusFilter("FLAGGED"); setPage(1); }}
          title="Click to filter Flagged transactions (Score 70-89)"
        >
          <span className="txn-metric-label">
            Flagged (Score 70–89)
            <span style={{ color: "#fbbf24" }}>SUSPICIOUS</span>
          </span>
          <span className="txn-metric-val">245</span>
        </div>

        <div
          className={`txn-metric-pill pill-review ${statusFilter === "UNDER_REVIEW" ? "active" : ""}`}
          onClick={() => { setStatusFilter("UNDER_REVIEW"); setPage(1); }}
          title="Click to filter Under Review transactions (Score 40-69)"
        >
          <span className="txn-metric-label">
            Under Review (40–69)
            <span style={{ color: "#38bdf8" }}>ELEVATED</span>
          </span>
          <span className="txn-metric-val">812</span>
        </div>

        <div
          className={`txn-metric-pill pill-settled ${statusFilter === "SETTLED" ? "active" : ""}`}
          onClick={() => { setStatusFilter("SETTLED"); setPage(1); }}
          title="Click to filter Settled normal transactions (Score < 40)"
        >
          <span className="txn-metric-label">
            Settled (Normal)
            <span style={{ color: "#4ade80" }}>CLEARED</span>
          </span>
          <span className="txn-metric-val">7,917</span>
        </div>
      </div>

      {/* Forensic Filter Toolbar */}
      <div className="txn-toolbar">
        <input
          placeholder="Search ID, Account, Sender, Receiver…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: "1 1 240px", minWidth: 200 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 140 }}
        >
          <option value="">Status: All Statuses</option>
          <option value="BLOCKED">Status: BLOCKED</option>
          <option value="FLAGGED">Status: FLAGGED</option>
          <option value="UNDER_REVIEW">Status: UNDER REVIEW</option>
          <option value="SETTLED">Status: SETTLED</option>
        </select>

        <select
          value={riskLevel}
          onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }}
          style={{ minWidth: 130 }}
        >
          <option value="">Risk: All Tiers</option>
          <option value="critical">Critical (90–100)</option>
          <option value="high">High (70–89)</option>
          <option value="medium">Medium (40–69)</option>
          <option value="low">Low (0–39)</option>
        </select>

        <input
          type="number"
          placeholder="Min $"
          value={minAmount}
          onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
          style={{ width: 100 }}
        />

        <input
          type="number"
          placeholder="Max $"
          value={maxAmount}
          onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
          style={{ width: 100 }}
        />

        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [b, d] = e.target.value.split(":");
            setSortBy(b);
            setSortDir(d);
            setPage(1);
          }}
          style={{ minWidth: 150 }}
        >
          <option value="risk_score:desc">Sort: Risk Score (High → Low)</option>
          <option value="risk_score:asc">Sort: Risk Score (Low → High)</option>
          <option value="amount:desc">Sort: Amount (High → Low)</option>
          <option value="amount:asc">Sort: Amount (Low → High)</option>
          <option value="id:desc">Sort: ID (Newest)</option>
          <option value="id:asc">Sort: ID (Oldest)</option>
        </select>

        <button className="btn" onClick={resetFilters} title="Clear all search queries and active filters">
          Reset
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="error" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={loadTransactions}>Retry</button>
        </div>
      )}

      {/* Transactions Data Table */}
      {loading && !data ? (
        <div className="loading" style={{ padding: "4rem 0" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
          <span>Analyzing forensic transaction records from intelligence parquet…</span>
        </div>
      ) : !data || data.transactions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
          <svg width="48" height="48" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ margin: "0 auto 1rem auto" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No Transactions Found</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            No records matched your search query or filter parameters. Try clearing your filters or broadening your search.
          </p>
          <button className="btn" onClick={resetFilters}>Reset All Filters</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>TXN ID</th>
                  <th style={{ width: 140 }}>Timestamp</th>
                  <th style={{ width: 120 }}>Account</th>
                  <th style={{ width: 200 }}>Counterparty Route</th>
                  <th style={{ width: 160 }}>Channel Type</th>
                  <th style={{ width: 110, textAlign: "right" }}>Amount</th>
                  <th style={{ width: 90, textAlign: "center" }}>Risk</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th>Indicators</th>
                  <th style={{ width: 130, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => {
                  const statusClass =
                    t.status === "BLOCKED"
                      ? "badge-status-blocked"
                      : t.status === "FLAGGED"
                      ? "badge-status-flagged"
                      : t.status === "UNDER_REVIEW"
                      ? "badge-status-review"
                      : "badge-status-settled";

                  return (
                    <tr
                      key={t.transactionId}
                      className="clickable"
                      onClick={() => openDetail(t.transactionId)}
                    >
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#38bdf8" }}>
                        #{t.transactionId}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {t.timestamp || t.date}
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "0.8rem",
                            color: "#93c5fd",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/accounts?search=${t.accountId}`);
                          }}
                          title="Click to view Account Risk Dossier"
                        >
                          {t.accountId}
                        </span>
                      </td>
                      <td>
                        <div className="counterparty-route">
                          <span className="route-sender">{t.senderId || `SND-${t.rawAccountId}`}</span>
                          <span className="route-arrow">→</span>
                          <span className="route-receiver">{t.receiverId || `RCV-${t.rawAccountId}`}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "#f1f5f9" }}>
                        {t.transactionType}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "#f8fafc" }}>
                        ${t.amount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${
                            t.riskScore >= 90
                              ? "badge-fraud"
                              : t.riskScore >= 70
                              ? "badge-review"
                              : t.riskScore >= 40
                              ? "badge-review"
                              : "badge-legit"
                          }`}
                          style={{ fontWeight: 800 }}
                        >
                          {t.riskScore}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${statusClass}`}>
                          {t.status || (t.riskScore >= 70 ? "FLAGGED" : "SETTLED")}
                        </span>
                      </td>
                      <td>
                        <div className="indicator-chips-wrap">
                          {t.riskIndicators && t.riskIndicators.length > 0 ? (
                            t.riskIndicators.slice(0, 2).map((ind, i) => (
                              <span key={i} className="indicator-mini-chip">
                                {ind}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Clean Flow</span>
                          )}
                          {t.riskIndicators && t.riskIndicators.length > 2 && (
                            <span className="indicator-mini-chip" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                              +{t.riskIndicators.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="txn-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-inspect-sm"
                            onClick={() => openDetail(t.transactionId)}
                            title="Inspect full transaction dossier"
                          >
                            Inspect
                          </button>
                          {t.riskScore >= 40 && (
                            <button
                              className="btn-promote-sm"
                              onClick={() => openPromoteModal(t)}
                              title="Promote this suspicious transaction to an Investigation Case"
                            >
                              Case +
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="pagination" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ background: "var(--surface2)", color: "#fff", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem 0.4rem" }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page (Total {data.total.toLocaleString()} transactions)</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Page {data.page} of {data.totalPages}
              </span>
              <button
                className="btn"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Slide-Out Transaction Detail Drawer */}
      {selectedTxn && (
        <>
          <div className="txn-drawer-overlay" onClick={() => setSelectedTxn(null)} />
          <div className="txn-drawer">
            <div className="drawer-header">
              <div>
                <h3 className="drawer-title">Transaction #{selectedTxn.transactionId}</h3>
                <span className="drawer-subtitle">
                  {selectedTxn.timestamp || selectedTxn.date} • {selectedTxn.transactionType}
                </span>
              </div>
              <button className="drawer-close-btn" onClick={() => setSelectedTxn(null)}>
                ✕
              </button>
            </div>

            {/* Risk Assessment Banner */}
            <div
              style={{
                background: selectedTxn.riskScore >= 70 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                border: `1px solid ${selectedTxn.riskScore >= 70 ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                borderRadius: 8,
                padding: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Risk Score Evaluation
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: selectedTxn.riskScore >= 70 ? "#f87171" : "#4ade80" }}>
                  {selectedTxn.riskScore} <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>/ 100</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Model Confidence: {((selectedTxn.confidence ?? 0) * 100).toFixed(1)}% ({selectedTxn.prediction.toUpperCase()})
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className={`badge-status ${
                    selectedTxn.status === "BLOCKED"
                      ? "badge-status-blocked"
                      : selectedTxn.status === "FLAGGED"
                      ? "badge-status-flagged"
                      : selectedTxn.status === "UNDER_REVIEW"
                      ? "badge-status-review"
                      : "badge-status-settled"
                  }`}
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                >
                  {selectedTxn.status || "SETTLED"}
                </span>
              </div>
            </div>

            {/* Forensic Counterparty Route */}
            <div>
              <div className="drawer-section-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Counterparty Flow
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.85rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>SENDER IDENTITY</div>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#93c5fd" }}>
                    {selectedTxn.senderId || `SND-${selectedTxn.rawAccountId}`}
                  </div>
                </div>
                <div style={{ color: "var(--muted)", fontWeight: 700 }}>➔➔➔</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>RECEIVER IDENTITY</div>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#c4b5fd" }}>
                    {selectedTxn.receiverId || `RCV-${selectedTxn.rawAccountId}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Metadata Grid */}
            <div className="drawer-meta-grid">
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Account ID</span>
                <span
                  className="drawer-meta-val"
                  style={{ color: "#38bdf8", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => navigate(`/accounts?search=${selectedTxn.accountId}`)}
                  title="Open Account Risk Dossier"
                >
                  {selectedTxn.accountId}
                </span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Amount</span>
                <span className="drawer-meta-val">${selectedTxn.amount.toLocaleString()}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Account Type</span>
                <span className="drawer-meta-val">{selectedTxn.accountType}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Customer Occupation</span>
                <span className="drawer-meta-val">{selectedTxn.occupation}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Account Vintage</span>
                <span className="drawer-meta-val">{selectedTxn.vintageBucket || "G365D"}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Reported Balance</span>
                <span className="drawer-meta-val">${(selectedTxn.balanceAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Triggered AML Risk Indicators */}
            <div>
              <div className="drawer-section-title">
                <svg width="16" height="16" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Triggered AML & Mule Rules ({selectedTxn.detailedIndicators?.length || 0})
              </div>

              {selectedTxn.detailedIndicators && selectedTxn.detailedIndicators.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedTxn.detailedIndicators.map((ind, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "0.65rem 0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fca5a5" }}>
                          {ind.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: ind.severity === "CRITICAL" ? "#f87171" : "#fbbf24",
                            background: "rgba(255,255,255,0.05)",
                            padding: "0.1rem 0.35rem",
                            borderRadius: 4,
                          }}
                        >
                          {ind.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                        {ind.description}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.75rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                  No automated rule breaches triggered on this transaction.
                </div>
              )}
            </div>

            {/* Model Decision Attribution */}
            {selectedTxn.reasons && selectedTxn.reasons.length > 0 && (
              <div>
                <div className="drawer-section-title">
                  <svg width="16" height="16" fill="none" stroke="#60a5fa" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  LightGBM Feature Attribution
                </div>
                <ul className="reasons-list" style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {selectedTxn.reasons.map((r, i) => (
                    <li key={i} style={{ marginBottom: "0.35rem" }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Bar inside Drawer */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              <button
                className="btn btn-primary"
                onClick={() => openPromoteModal(selectedTxn)}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Promote to Investigation Case
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  className="btn"
                  onClick={() => navigate(`/accounts?search=${selectedTxn.accountId}`)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  View Account
                </button>
                <button
                  className="btn"
                  onClick={() => copyTxnJson(selectedTxn)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  Copy JSON
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Case Promotion Modal Window */}
      {promotingTxn && (
        <div className="modal-backdrop" onClick={() => !isSubmittingCase && setPromotingTxn(null)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Promote to Investigation Case</h3>
                <p className="modal-subtitle">
                  Create a formal investigation record in FinCEN/SAR workflow for {promotingTxn.accountId}
                </p>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => !isSubmittingCase && setPromotingTxn(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePromoteSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                  <label className="form-label">Target Account</label>
                  <input
                    className="form-input"
                    disabled
                    value={promotingTxn.accountId}
                    style={{ opacity: 0.8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-select"
                    value={casePriority}
                    onChange={(e) => setCasePriority(e.target.value as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW")}
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Freeze)</option>
                    <option value="HIGH">HIGH (24hr Review)</option>
                    <option value="MEDIUM">MEDIUM (Standard Queue)</option>
                    <option value="LOW">LOW (Informational)</option>
                  </select>
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
                  placeholder="Detail the anomalous indicators, suspected mule syndicate connection, and recommended triage actions..."
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={isSubmittingCase}
                  onClick={() => setPromotingTxn(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCase}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
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
