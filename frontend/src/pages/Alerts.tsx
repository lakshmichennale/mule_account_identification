import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertItem,
  AlertListResponse,
  batchUpdateAlertsApi,
  getAlertDetailApi,
  getAlertsApi,
  getStoredUser,
  promoteToCaseApi,
  updateAlertApi,
} from "../api/client";

export default function AlertsPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Data state
  const [data, setData] = useState<AlertListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");

  // Selection & Batch Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Slide-Out Alert Dossier
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerStatus, setDrawerStatus] = useState("");
  const [drawerAnalyst, setDrawerAnalyst] = useState("");
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Case Escalation Modal
  const [escalatingAlert, setEscalatingAlert] = useState<AlertItem | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseNotes, setCaseNotes] = useState("");
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Fetch Alerts
  const loadAlerts = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });

    if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
    if (severityFilter && severityFilter !== "ALL") params.set("severity", severityFilter);
    if (search.trim()) params.set("search", search.trim());

    getAlertsApi(params)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || "Failed to load alerts");
        setLoading(false);
      });
  }, [page, pageSize, statusFilter, severityFilter, search, sortBy, sortDir]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Open Alert Inspection Drawer
  const openAlertDetail = async (alertId: string) => {
    try {
      const detail = await getAlertDetailApi(alertId);
      setSelectedAlert(detail);
      setDrawerNotes(detail.notes || "");
      setDrawerStatus(detail.status);
      setDrawerAnalyst(detail.assignedAnalyst || currentUser?.fullName || "Lead Fraud Analyst");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to load alert detail");
    }
  };

  // Save changes from drawer
  const handleSaveDrawer = async () => {
    if (!selectedAlert) return;
    setIsSavingDrawer(true);
    try {
      const updated = await updateAlertApi(selectedAlert.alertId, {
        status: drawerStatus,
        assignedAnalyst: drawerAnalyst,
        notes: drawerNotes,
      });
      setSelectedAlert(updated);
      showToast(`Alert ${updated.alertId} successfully updated.`);
      loadAlerts();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save alert updates");
    } finally {
      setIsSavingDrawer(false);
    }
  };

  // Quick single alert status change
  const handleQuickStatusChange = async (alertId: string, newStatus: string) => {
    try {
      const updated = await updateAlertApi(alertId, {
        status: newStatus,
        assignedAnalyst: currentUser?.fullName || currentUser?.email || "Lead Fraud Analyst",
      });
      showToast(`Alert ${alertId} marked as ${newStatus}.`);
      loadAlerts();
      if (selectedAlert && selectedAlert.alertId === alertId) {
        setSelectedAlert(updated);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update alert status");
    }
  };

  // Batch action handlers
  const handleBatchUpdate = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await batchUpdateAlertsApi(selectedIds, newStatus);
      showToast(`Batch updated ${res.updatedCount} alerts to ${newStatus}.`);
      setSelectedIds([]);
      loadAlerts();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to perform batch update");
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Select / Deselect All
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return;
    if (e.target.checked) {
      setSelectedIds(data.alerts.map((a) => a.alertId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (alertId: string) => {
    setSelectedIds((prev) =>
      prev.includes(alertId) ? prev.filter((id) => id !== alertId) : [...prev, alertId]
    );
  };

  // Escalate Alert to FinCEN Case modal
  const openEscalateModal = (alertItem: AlertItem) => {
    setEscalatingAlert(alertItem);
    setCaseTitle(`SAR Case: ${alertItem.category} on ${alertItem.accountId}`);
    setCaseNotes(
      `Triggered from Alert ${alertItem.alertId}. Category: ${alertItem.category}. ` +
      `Target: ${alertItem.accountId} (${alertItem.occupation}, ${alertItem.productName}). ` +
      `Risk Score: ${alertItem.riskScore}/100 (${alertItem.severity}). ` +
      `Trigger Reason: ${alertItem.triggerReason}`
    );
  };

  const handleCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalatingAlert) return;
    setIsSubmittingCase(true);
    try {
      const caseRes = await promoteToCaseApi({
        accountId: escalatingAlert.accountId,
        rawAccountId: escalatingAlert.rawAccountId,
        title: caseTitle,
        riskScore: escalatingAlert.riskScore,
        priority: escalatingAlert.severity,
        alertTrigger: `${escalatingAlert.category} - ${escalatingAlert.triggerReason}`,
        notes: caseNotes,
      });

      // Mark alert as ESCALATED
      await updateAlertApi(escalatingAlert.alertId, {
        status: "ESCALATED",
        assignedAnalyst: currentUser?.fullName || "Lead Fraud Analyst",
        notes: `Promoted to investigation case ${caseRes.caseNumber}.`,
      });

      showToast(`Alert ${escalatingAlert.alertId} escalated to Case ${caseRes.caseNumber}!`);
      setEscalatingAlert(null);
      loadAlerts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to escalate alert to case");
    } finally {
      setIsSubmittingCase(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setSeverityFilter("ALL");
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
          <h1 className="page-title">Alert Management & SOC Incident Triage</h1>
          <p className="page-subtitle">
            Surfaced AML regulatory rule breaches, machine learning anomaly triggers, and analyst triage operations
          </p>
        </div>
        <button
          className="btn"
          onClick={loadAlerts}
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
          {loading ? "Refreshing…" : "Refresh Queue"}
        </button>
      </div>

      {/* Interactive Metric Strip */}
      {data && (
        <div className="alert-metrics-strip">
          <div
            className={`alert-metric-pill ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ALL"); setPage(1); }}
            title="Click to show all alerts"
          >
            <span className="txn-metric-label">All Active</span>
            <span className="txn-metric-val">{data.summary.grandTotal}</span>
          </div>

          <div
            className={`alert-metric-pill pill-new ${statusFilter === "NEW" ? "active" : ""}`}
            onClick={() => { setStatusFilter("NEW"); setPage(1); }}
            title="Click to filter Unreviewed New alerts"
          >
            <span className="txn-metric-label">
              New Unreviewed
              <span style={{ color: "#60a5fa" }}>NEW</span>
            </span>
            <span className="txn-metric-val">{data.summary.new}</span>
          </div>

          <div
            className={`alert-metric-pill pill-ack ${statusFilter === "ACKNOWLEDGED" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ACKNOWLEDGED"); setPage(1); }}
            title="Click to filter Acknowledged alerts"
          >
            <span className="txn-metric-label">
              Acknowledged
              <span style={{ color: "#c4b5fd" }}>TRIAGE</span>
            </span>
            <span className="txn-metric-val">{data.summary.acknowledged}</span>
          </div>

          <div
            className={`alert-metric-pill pill-review ${statusFilter === "UNDER_REVIEW" ? "active" : ""}`}
            onClick={() => { setStatusFilter("UNDER_REVIEW"); setPage(1); }}
            title="Click to filter Under Review alerts"
          >
            <span className="txn-metric-label">
              Under Review
              <span style={{ color: "#fbbf24" }}>INVESTIGATING</span>
            </span>
            <span className="txn-metric-val">{data.summary.underReview}</span>
          </div>

          <div
            className={`alert-metric-pill pill-escalated ${statusFilter === "ESCALATED" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ESCALATED"); setPage(1); }}
            title="Click to filter Escalated SAR alerts"
          >
            <span className="txn-metric-label">
              Escalated SAR
              <span style={{ color: "#f87171" }}>CASE</span>
            </span>
            <span className="txn-metric-val">{data.summary.escalated}</span>
          </div>

          <div
            className={`alert-metric-pill ${severityFilter === "CRITICAL" ? "active" : ""}`}
            onClick={() => { setSeverityFilter(severityFilter === "CRITICAL" ? "ALL" : "CRITICAL"); setPage(1); }}
            title="Click to filter Critical Severity alerts (Risk >= 90)"
          >
            <span className="txn-metric-label">
              Critical Severity
              <span style={{ color: "#f87171" }}>≥ 90</span>
            </span>
            <span className="txn-metric-val">{data.summary.critical}</span>
          </div>
        </div>
      )}

      {/* Forensic Triage Toolbar */}
      <div className="txn-toolbar">
        <input
          placeholder="Search Alert ID, Account ID, Category, Analyst…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: "1 1 240px", minWidth: 200 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 150 }}
        >
          <option value="ALL">Status: All Statuses</option>
          <option value="NEW">Status: NEW (Unreviewed)</option>
          <option value="ACKNOWLEDGED">Status: ACKNOWLEDGED</option>
          <option value="UNDER_REVIEW">Status: UNDER REVIEW</option>
          <option value="ESCALATED">Status: ESCALATED</option>
          <option value="DISMISSED">Status: DISMISSED</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 140 }}
        >
          <option value="ALL">Severity: All Tiers</option>
          <option value="CRITICAL">Severity: CRITICAL</option>
          <option value="HIGH">Severity: HIGH</option>
          <option value="MEDIUM">Severity: MEDIUM</option>
          <option value="LOW">Severity: LOW</option>
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
          <option value="created_at:desc">Sort: Date Detected (Newest)</option>
          <option value="alert_id:desc">Sort: Alert ID</option>
        </select>

        <button className="btn" onClick={resetFilters} title="Clear active filters and search query">
          Reset
        </button>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="batch-action-bar">
          <div className="batch-action-count">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>{selectedIds.length} Alerts Selected for Bulk Triage</span>
          </div>

          <div className="batch-buttons-group">
            <button
              className="btn btn-sm"
              disabled={isBatchUpdating}
              onClick={() => handleBatchUpdate("ACKNOWLEDGED")}
            >
              Mark Acknowledged
            </button>
            <button
              className="btn btn-sm"
              disabled={isBatchUpdating}
              onClick={() => handleBatchUpdate("UNDER_REVIEW")}
            >
              Assign & Review
            </button>
            <button
              className="btn btn-sm"
              disabled={isBatchUpdating}
              onClick={() => handleBatchUpdate("DISMISSED")}
            >
              Dismiss Selected
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setSelectedIds([])}
              style={{ background: "transparent", borderColor: "var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={loadAlerts}>Retry</button>
        </div>
      )}

      {/* Alerts Data Table */}
      {loading && !data ? (
        <div className="loading" style={{ padding: "4rem 0" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
          <span>Loading operational alert queue from SQLite intelligence ledger…</span>
        </div>
      ) : !data || data.alerts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
          <svg width="48" height="48" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ margin: "0 auto 1rem auto" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No Alerts Matching Filter</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            All alerts in this category have been triaged or no alerts matched your search query.
          </p>
          <button className="btn" onClick={resetFilters}>Reset Queue Filters</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === data.alerts.length && data.alerts.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ width: 110 }}>Alert ID</th>
                  <th style={{ width: 95 }}>Severity</th>
                  <th style={{ width: 120 }}>Account ID</th>
                  <th style={{ width: 220 }}>Incident Category</th>
                  <th style={{ width: 80, textAlign: "center" }}>Risk</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 140 }}>Assigned Analyst</th>
                  <th style={{ width: 130, textAlign: "center" }}>Triage Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((a) => {
                  const isChecked = selectedIds.includes(a.alertId);
                  const sevClass =
                    a.severity === "CRITICAL"
                      ? "badge-sev-critical"
                      : a.severity === "HIGH"
                      ? "badge-sev-high"
                      : a.severity === "MEDIUM"
                      ? "badge-sev-medium"
                      : "badge-sev-low";

                  const statusClass =
                    a.status === "NEW"
                      ? "badge-status-new"
                      : a.status === "ACKNOWLEDGED"
                      ? "badge-status-ack"
                      : a.status === "UNDER_REVIEW"
                      ? "badge-status-under_review"
                      : a.status === "ESCALATED"
                      ? "badge-status-escalated"
                      : "badge-status-dismissed";

                  return (
                    <tr
                      key={a.alertId}
                      className="clickable"
                      onClick={() => openAlertDetail(a.alertId)}
                      style={{ background: isChecked ? "rgba(59, 130, 246, 0.08)" : undefined }}
                    >
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(a.alertId)}
                        />
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#38bdf8" }}>
                        {a.alertId}
                      </td>
                      <td>
                        <span className={sevClass}>{a.severity}</span>
                      </td>
                      <td>
                        <span
                          style={{ fontFamily: "var(--mono)", color: "#93c5fd", textDecoration: "underline", cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/accounts?search=${a.accountId}`);
                          }}
                          title="Click to view Account Risk Dossier"
                        >
                          {a.accountId}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.82rem" }}>
                          {a.category}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                          {a.triggerReason}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${a.riskScore >= 90 ? "badge-fraud" : "badge-review"}`}
                          style={{ fontWeight: 800 }}
                        >
                          {a.riskScore}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${statusClass}`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: a.assignedAnalyst === "Unassigned" ? "var(--muted)" : "#e2e8f0" }}>
                        {a.assignedAnalyst || "Unassigned"}
                      </td>
                      <td>
                        <div className="txn-actions-cell" onClick={(e) => e.stopPropagation()}>
                          {a.status === "NEW" ? (
                            <button
                              className="btn-inspect-sm"
                              onClick={() => handleQuickStatusChange(a.alertId, "ACKNOWLEDGED")}
                              title="Acknowledge this alert into active triage"
                            >
                              Ack
                            </button>
                          ) : (
                            <button
                              className="btn-inspect-sm"
                              onClick={() => openAlertDetail(a.alertId)}
                              title="Inspect full alert dossier and notes"
                            >
                              Inspect
                            </button>
                          )}

                          {a.status !== "ESCALATED" && (
                            <button
                              className="btn-promote-sm"
                              onClick={() => openEscalateModal(a)}
                              title="Escalate to FinCEN SAR Investigation Case"
                            >
                              Escalate
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
              <span>alerts per page (Total {data.total} filtered)</span>
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

      {/* Slide-Out Alert Dossier Drawer */}
      {selectedAlert && (
        <>
          <div className="txn-drawer-overlay" onClick={() => setSelectedAlert(null)} />
          <div className="txn-drawer">
            <div className="drawer-header">
              <div>
                <h3 className="drawer-title">{selectedAlert.alertId}</h3>
                <span className="drawer-subtitle">
                  Detected: {selectedAlert.createdAt?.split("T")[0] || "10-25-2025"} • Severity: {selectedAlert.severity}
                </span>
              </div>
              <button className="drawer-close-btn" onClick={() => setSelectedAlert(null)}>
                ✕
              </button>
            </div>

            {/* Alert Category & Risk Meter */}
            <div
              style={{
                background: selectedAlert.riskScore >= 90 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${selectedAlert.riskScore >= 90 ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.35)"}`,
                borderRadius: 8,
                padding: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Incident Rule Trigger
                </span>
                <span className={selectedAlert.severity === "CRITICAL" ? "badge-sev-critical" : "badge-sev-high"}>
                  {selectedAlert.severity} SEVERITY
                </span>
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
                {selectedAlert.category}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {selectedAlert.triggerReason}
              </div>
            </div>

            {/* Target Account Overview */}
            <div className="drawer-meta-grid">
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Account Target</span>
                <span
                  className="drawer-meta-val"
                  style={{ color: "#38bdf8", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => navigate(`/accounts?search=${selectedAlert.accountId}`)}
                  title="Open Account Risk Dossier"
                >
                  {selectedAlert.accountId}
                </span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Risk Score</span>
                <span className="drawer-meta-val" style={{ color: selectedAlert.riskScore >= 90 ? "#f87171" : "#fbbf24" }}>
                  {selectedAlert.riskScore}/100
                </span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Product / Type</span>
                <span className="drawer-meta-val">{selectedAlert.productName}</span>
              </div>
              <div className="drawer-meta-item">
                <span className="drawer-meta-label">Customer Profile</span>
                <span className="drawer-meta-val">{selectedAlert.occupation}</span>
              </div>
            </div>

            {/* Triage Status & Analyst Assignment */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="drawer-section-title" style={{ margin: 0 }}>
                Incident Resolution & Assignment
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Triage Status</label>
                  <select
                    className="form-select"
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value)}
                  >
                    <option value="NEW">NEW (Unreviewed)</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="ESCALATED">ESCALATED</option>
                    <option value="DISMISSED">DISMISSED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Analyst</label>
                  <input
                    className="form-input"
                    value={drawerAnalyst}
                    onChange={(e) => setDrawerAnalyst(e.target.value)}
                    placeholder="Analyst Name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Investigator Audit Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                  placeholder="Record forensic review findings, customer KYC verification results, or false-positive rationale..."
                />
              </div>

              <button
                className="btn btn-sm"
                disabled={isSavingDrawer}
                onClick={handleSaveDrawer}
                style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {isSavingDrawer ? "Saving…" : "Save Triage Updates"}
              </button>
            </div>

            {/* Deep Links & Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              {selectedAlert.status !== "ESCALATED" && (
                <button
                  className="btn btn-primary"
                  onClick={() => openEscalateModal(selectedAlert)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Escalate to FinCEN SAR Case
                </button>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  className="btn"
                  onClick={() => navigate(`/accounts?search=${selectedAlert.accountId}`)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  Account Dossier
                </button>
                <button
                  className="btn"
                  onClick={() => navigate(`/transactions?search=${selectedAlert.accountId}`)}
                  style={{ fontSize: "0.8rem", textAlign: "center" }}
                >
                  Transactions
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Case Escalation Modal */}
      {escalatingAlert && (
        <div className="modal-backdrop" onClick={() => !isSubmittingCase && setEscalatingAlert(null)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Escalate to FinCEN SAR Investigation</h3>
                <p className="modal-subtitle">
                  Promote Alert {escalatingAlert.alertId} into formal case investigation workflow
                </p>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => !isSubmittingCase && setEscalatingAlert(null)}
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
                  <label className="form-label">Target Account</label>
                  <input
                    className="form-input"
                    disabled
                    value={escalatingAlert.accountId}
                    style={{ opacity: 0.8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <input
                    className="form-input"
                    disabled
                    value={escalatingAlert.severity}
                    style={{ opacity: 0.8 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Investigator Case Narrative & Evidence Trigger</label>
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
                  onClick={() => setEscalatingAlert(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCase}
                >
                  {isSubmittingCase ? "Escalating…" : "Confirm & Escalate Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
