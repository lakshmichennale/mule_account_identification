import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CaseListResponse,
  InvestigationItem,
  SarReportResponse,
  getCaseDetailApi,
  getCaseSarReportApi,
  getCasesApi,
  getStoredUser,
  promoteToCaseApi,
  updateCaseApi,
} from "../api/client";

export default function CasesPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Data state
  const [data, setData] = useState<CaseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");

  // Slide-Out Case Dossier
  const [selectedCase, setSelectedCase] = useState<InvestigationItem | null>(null);
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerStatus, setDrawerStatus] = useState("");
  const [drawerPriority, setDrawerPriority] = useState("");
  const [drawerAnalyst, setDrawerAnalyst] = useState("");
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // FinCEN SAR Report Modal
  const [sarReport, setSarReport] = useState<SarReportResponse | null>(null);
  const [loadingSar, setLoadingSar] = useState(false);

  // Create New Case Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [newRiskScore, setNewRiskScore] = useState(85);
  const [newNotes, setNewNotes] = useState("");
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Fetch Cases
  const loadCases = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });

    if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter && priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (search.trim()) params.set("search", search.trim());

    getCasesApi(params)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || "Failed to load cases");
        setLoading(false);
      });
  }, [page, pageSize, statusFilter, priorityFilter, search, sortBy, sortDir]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Open Case Inspection Drawer
  const openCaseDetail = async (caseNumber: string) => {
    try {
      const detail = await getCaseDetailApi(caseNumber);
      setSelectedCase(detail);
      setDrawerNotes(detail.notes || "");
      setDrawerStatus(detail.status);
      setDrawerPriority(detail.priority);
      setDrawerAnalyst(detail.assignedAnalyst || currentUser?.fullName || "Lead Fraud Analyst");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to load case detail");
    }
  };

  // Save changes from drawer
  const handleSaveDrawer = async () => {
    if (!selectedCase) return;
    setIsSavingDrawer(true);
    try {
      const updated = await updateCaseApi(selectedCase.caseNumber, {
        status: drawerStatus,
        priority: drawerPriority,
        assignedAnalyst: drawerAnalyst,
        notes: drawerNotes,
      });
      setSelectedCase(updated);
      showToast(`Case ${updated.caseNumber} updated successfully.`);
      loadCases();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save case updates");
    } finally {
      setIsSavingDrawer(false);
    }
  };

  // Quick Status change
  const handleQuickStatusChange = async (caseNumber: string, newStatus: string) => {
    try {
      const updated = await updateCaseApi(caseNumber, {
        status: newStatus,
        assignedAnalyst: currentUser?.fullName || currentUser?.email || "Lead Fraud Analyst",
      });
      showToast(`Case ${caseNumber} marked as ${newStatus}.`);
      loadCases();
      if (selectedCase && selectedCase.caseNumber === caseNumber) {
        setSelectedCase(updated);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update case status");
    }
  };

  // Open SAR Report
  const openSarReport = async (caseNumber: string) => {
    setLoadingSar(true);
    try {
      const report = await getCaseSarReportApi(caseNumber);
      setSarReport(report);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to generate SAR report");
    } finally {
      setLoadingSar(false);
    }
  };

  // Copy SAR Report
  const copySarText = () => {
    if (!sarReport) return;
    navigator.clipboard.writeText(sarReport.reportText);
    showToast("FinCEN SAR Report narrative copied to clipboard!");
  };

  // Download SAR Report as text file
  const downloadSarTxt = () => {
    if (!sarReport) return;
    const blob = new Blob([sarReport.reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sarReport.sarReference}_Narrative.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${sarReport.sarReference}_Narrative.txt`);
  };

  // Create new case submit
  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingCase(true);
    try {
      const created = await promoteToCaseApi({
        accountId: newAccountId.trim().toUpperCase(),
        title: newTitle.trim(),
        riskScore: Number(newRiskScore),
        priority: newPriority,
        alertTrigger: "Manual Officer Docket Initiation",
        notes: newNotes.trim(),
      });
      showToast(`Case ${created.caseNumber} created successfully!`);
      setShowCreateModal(false);
      setNewAccountId("");
      setNewTitle("");
      setNewNotes("");
      loadCases();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setIsCreatingCase(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSortBy("risk_score");
    setSortDir("desc");
    setPage(1);
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
          <h1 className="page-title">Investigation & FinCEN Case Management</h1>
          <p className="page-subtitle">
            Formal investigative docket repository, FinCEN SAR narrative generation, and regulatory compliance lifecycle
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>+</span>
            <span>New Case Docket</span>
          </button>
          <button
            className="btn"
            onClick={loadCases}
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
            {loading ? "Refreshing…" : "Refresh Dockets"}
          </button>
        </div>
      </div>

      {/* Interactive Metric Strip */}
      {data && (
        <div className="alert-metrics-strip">
          <div
            className={`alert-metric-pill ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ALL"); setPage(1); }}
            title="Click to show all cases"
          >
            <span className="txn-metric-label">All Dockets</span>
            <span className="txn-metric-val">{data.summary.grandTotal}</span>
          </div>

          <div
            className={`alert-metric-pill ${statusFilter === "OPEN" ? "active" : ""}`}
            onClick={() => { setStatusFilter("OPEN"); setPage(1); }}
            title="Click to filter Open cases"
          >
            <span className="txn-metric-label">
              Open Queue
              <span style={{ color: "#38bdf8" }}>OPEN</span>
            </span>
            <span className="txn-metric-val">{data.summary.open}</span>
          </div>

          <div
            className={`alert-metric-pill ${statusFilter === "UNDER_INVESTIGATION" ? "active" : ""}`}
            onClick={() => { setStatusFilter("UNDER_INVESTIGATION"); setPage(1); }}
            title="Click to filter Under Investigation cases"
          >
            <span className="txn-metric-label">
              Active Forensic
              <span style={{ color: "#fbbf24" }}>REVIEW</span>
            </span>
            <span className="txn-metric-val">{data.summary.underInvestigation}</span>
          </div>

          <div
            className={`alert-metric-pill ${statusFilter === "SAR_READY" ? "active" : ""}`}
            onClick={() => { setStatusFilter("SAR_READY"); setPage(1); }}
            title="Click to filter SAR Ready cases"
          >
            <span className="txn-metric-label">
              SAR Ready
              <span style={{ color: "#c084fc" }}>SUBMIT</span>
            </span>
            <span className="txn-metric-val">{data.summary.sarReady}</span>
          </div>

          <div
            className={`alert-metric-pill ${statusFilter === "ESCALATED" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ESCALATED"); setPage(1); }}
            title="Click to filter Escalated cases"
          >
            <span className="txn-metric-label">
              Escalated
              <span style={{ color: "#f87171" }}>FIU</span>
            </span>
            <span className="txn-metric-val">{data.summary.escalated}</span>
          </div>

          <div
            className={`alert-metric-pill ${statusFilter === "CLOSED_RESOLVED" ? "active" : ""}`}
            onClick={() => { setStatusFilter("CLOSED_RESOLVED"); setPage(1); }}
            title="Click to filter Closed cases"
          >
            <span className="txn-metric-label">
              Resolved
              <span style={{ color: "#4ade80" }}>CLEARED</span>
            </span>
            <span className="txn-metric-val">{data.summary.closedResolved}</span>
          </div>
        </div>
      )}

      {/* Forensic Triage Toolbar */}
      <div className="txn-toolbar">
        <input
          placeholder="Search Case #, Account, Title, Officer, Trigger…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: "1 1 240px", minWidth: 200 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 160 }}
        >
          <option value="ALL">Status: All Statuses</option>
          <option value="OPEN">Status: OPEN</option>
          <option value="UNDER_INVESTIGATION">Status: UNDER INVESTIGATION</option>
          <option value="SAR_READY">Status: SAR READY</option>
          <option value="ESCALATED">Status: ESCALATED</option>
          <option value="CLOSED_RESOLVED">Status: CLOSED / RESOLVED</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 140 }}
        >
          <option value="ALL">Priority: All Tiers</option>
          <option value="CRITICAL">Priority: CRITICAL</option>
          <option value="HIGH">Priority: HIGH</option>
          <option value="MEDIUM">Priority: MEDIUM</option>
          <option value="LOW">Priority: LOW</option>
        </select>

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
          <option value="created_at:desc">Sort: Docket Date (Newest)</option>
          <option value="case_number:desc">Sort: Case Number</option>
        </select>

        <button className="btn" onClick={resetFilters} title="Clear filters">
          Reset
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="error" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={loadCases}>Retry</button>
        </div>
      )}

      {/* Cases Data Table */}
      {loading && !data ? (
        <div className="loading" style={{ padding: "4rem 0" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
          <span>Accessing FinCEN investigation cases from encrypted intelligence store…</span>
        </div>
      ) : !data || data.cases.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
          <svg width="48" height="48" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ margin: "0 auto 1rem auto" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No Cases Found</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            No investigation cases match the active filter criteria. Try clearing your filters or create a new case docket.
          </p>
          <button className="btn" onClick={resetFilters}>Reset Filters</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Case Docket #</th>
                  <th style={{ width: 95 }}>Priority</th>
                  <th style={{ width: 120 }}>Account Target</th>
                  <th>Case Title & Modus Operandi</th>
                  <th style={{ width: 80, textAlign: "center" }}>Risk</th>
                  <th style={{ width: 150 }}>Investigation Status</th>
                  <th style={{ width: 140 }}>Assigned Officer</th>
                  <th style={{ width: 150, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.map((c) => {
                  const prioClass =
                    c.priority === "CRITICAL"
                      ? "badge-sev-critical"
                      : c.priority === "HIGH"
                      ? "badge-sev-high"
                      : c.priority === "MEDIUM"
                      ? "badge-sev-medium"
                      : "badge-sev-low";

                  const statusClass =
                    c.status === "OPEN"
                      ? "badge-status-open"
                      : c.status === "UNDER_INVESTIGATION"
                      ? "badge-status-under_investigation"
                      : c.status === "SAR_READY"
                      ? "badge-status-sar_ready"
                      : c.status === "ESCALATED"
                      ? "badge-status-escalated"
                      : "badge-status-closed_resolved";

                  return (
                    <tr
                      key={c.caseNumber}
                      className="clickable"
                      onClick={() => openCaseDetail(c.caseNumber)}
                    >
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#38bdf8" }}>
                        {c.caseNumber}
                      </td>
                      <td>
                        <span className={prioClass}>{c.priority}</span>
                      </td>
                      <td>
                        <span
                          style={{ fontFamily: "var(--mono)", color: "#93c5fd", textDecoration: "underline", cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/accounts?search=${c.accountId}`);
                          }}
                          title="Click to view Account Risk Dossier"
                        >
                          {c.accountId}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.82rem" }}>
                          {c.title}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
                          {c.alertTrigger}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${c.riskScore >= 90 ? "badge-fraud" : "badge-review"}`}
                          style={{ fontWeight: 800 }}
                        >
                          {c.riskScore}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${statusClass}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#e2e8f0" }}>
                        {c.assignedAnalyst}
                      </td>
                      <td>
                        <div className="txn-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-inspect-sm"
                            onClick={() => openCaseDetail(c.caseNumber)}
                            title="Inspect case evidence & timeline"
                          >
                            Inspect
                          </button>
                          <button
                            className="btn-promote-sm"
                            onClick={() => openSarReport(c.caseNumber)}
                            title="Generate and view FinCEN SAR narrative"
                            style={{ background: "rgba(168, 85, 247, 0.2)", borderColor: "rgba(168, 85, 247, 0.4)", color: "#c084fc" }}
                          >
                            SAR Form
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ background: "var(--surface2)", color: "#fff", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem 0.4rem" }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>cases per page (Total {data.total} dockets)</span>
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

      {/* Slide-Out Case Dossier Drawer */}
      {selectedCase && (
        <>
          <div className="txn-drawer-overlay" onClick={() => setSelectedCase(null)} />
          <div className="txn-drawer">
            <div className="drawer-header">
              <div>
                <h3 className="drawer-title">{selectedCase.caseNumber}</h3>
                <span className="drawer-subtitle">
                  Opened: {selectedCase.createdAt?.split("T")[0] || "2026-11-04"} • Docket Priority: {selectedCase.priority}
                </span>
              </div>
              <button className="drawer-close-btn" onClick={() => setSelectedCase(null)}>
                ✕
              </button>
            </div>

            {/* Case Title & Incident Trigger */}
            <div
              style={{
                background: selectedCase.riskScore >= 90 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${selectedCase.riskScore >= 90 ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.35)"}`,
                borderRadius: 8,
                padding: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Active Investigation
                </span>
                <span className={selectedCase.priority === "CRITICAL" ? "badge-sev-critical" : "badge-sev-high"}>
                  {selectedCase.priority}
                </span>
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
                {selectedCase.title}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {selectedCase.alertTrigger}
              </div>
            </div>

            {/* Target Account Overview Grid */}
            <div className="drawer-meta-grid">
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Target Account</span>
                <span
                  className="drawer-meta-val"
                  style={{ color: "#38bdf8", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => navigate(`/accounts?search=${selectedCase.accountId}`)}
                  title="Open Account Risk Dossier"
                >
                  {selectedCase.accountId}
                </span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Composite Risk</span>
                <span className="drawer-meta-val" style={{ color: selectedCase.riskScore >= 90 ? "#f87171" : "#fbbf24" }}>
                  {selectedCase.riskScore}/100
                </span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Lead Officer</span>
                <span className="drawer-meta-val">{selectedCase.assignedAnalyst}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Current Status</span>
                <span className="drawer-meta-val">{selectedCase.status.replace("_", " ")}</span>
              </div>
            </div>

            {/* Case Management Controls */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="drawer-section-title" style={{ margin: 0 }}>
                Case Docket Controls
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Lifecycle Status</label>
                  <select
                    className="form-select"
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value)}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
                    <option value="SAR_READY">SAR READY</option>
                    <option value="ESCALATED">ESCALATED</option>
                    <option value="CLOSED_RESOLVED">CLOSED / RESOLVED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-select"
                    value={drawerPriority}
                    onChange={(e) => setDrawerPriority(e.target.value)}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Officer</label>
                <input
                  className="form-input"
                  value={drawerAnalyst}
                  onChange={(e) => setDrawerAnalyst(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Investigator Case Notes & Findings</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                  placeholder="Record customer contact notes, subpoena requests, IP log correlations..."
                />
              </div>

              <button
                className="btn btn-sm"
                disabled={isSavingDrawer}
                onClick={handleSaveDrawer}
                style={{ alignSelf: "flex-end" }}
              >
                {isSavingDrawer ? "Saving…" : "Save Case Updates"}
              </button>
            </div>

            {/* Deep Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              <button
                className="btn btn-primary"
                onClick={() => openSarReport(selectedCase.caseNumber)}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate FinCEN SAR Filing Narrative
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  className="btn"
                  onClick={() => navigate(`/accounts?search=${selectedCase.accountId}`)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  Account Dossier
                </button>
                <button
                  className="btn"
                  onClick={() => navigate(`/transactions?search=${selectedCase.accountId}`)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  Transactions
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* FinCEN SAR Report Preview Modal */}
      {sarReport && (
        <div className="modal-backdrop" onClick={() => setSarReport(null)}>
          <div className="modal-window" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">FinCEN Suspicious Activity Report (SAR)</h3>
                <p className="modal-subtitle">
                  {sarReport.sarReference} • Target: {sarReport.accountId} • Officer: {sarReport.assignedAnalyst}
                </p>
              </div>
              <button className="drawer-close-btn" onClick={() => setSarReport(null)}>
                ✕
              </button>
            </div>

            <div className="sar-report-container">
              {sarReport.reportText}
            </div>

            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Regulatory Form 111 Standard Narrative
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn" onClick={downloadSarTxt}>
                  Download .txt
                </button>
                <button className="btn btn-primary" onClick={copySarText}>
                  Copy Filing Narrative
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Case Creation Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !isCreatingCase && setShowCreateModal(false)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Initialize New Case Docket</h3>
                <p className="modal-subtitle">
                  Create a manual investigation docket for suspicious account activity
                </p>
              </div>
              <button className="drawer-close-btn" onClick={() => !isCreatingCase && setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Case Title</label>
                <input
                  className="form-input"
                  required
                  placeholder="e.g. Mule Syndicate Infiltration on Account..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Target Account ID</label>
                  <input
                    className="form-input"
                    required
                    placeholder="ACC-***XXXX"
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-select"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW")}
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Freeze)</option>
                    <option value="HIGH">HIGH (24hr Review)</option>
                    <option value="MEDIUM">MEDIUM (Standard Queue)</option>
                    <option value="LOW">LOW (Informational)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assessed Risk Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-input"
                  required
                  value={newRiskScore}
                  onChange={(e) => setNewRiskScore(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Evidence Findings & Narrative</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  required
                  placeholder="Detail the suspicious transaction sequence, unusual turnover, or AML indicators triggering this docket..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={isCreatingCase}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreatingCase}
                >
                  {isCreatingCase ? "Initializing…" : "Create Case Docket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
