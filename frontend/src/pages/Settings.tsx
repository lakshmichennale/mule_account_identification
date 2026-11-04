import React, { useEffect, useState } from "react";
import {
  AuditLogItem,
  changeUserPassword,
  getAuditLogs,
  getSystemDiagnostics,
  getSystemSettings,
  getUserProfile,
  SystemDiagnostics,
  SystemSettings,
  updateSystemSettings,
  updateUserProfile,
  UserProfile,
} from "../api/client";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "profile" | "thresholds" | "preferences" | "audit" | "diagnostics"
  >("profile");

  // User Profile State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // AML Risk Thresholds State
  const [thresholds, setThresholds] = useState<SystemSettings | null>(null);
  const [thresholdMsg, setThresholdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // SOC Preferences State (Stored in localStorage)
  const [autoRefresh, setAutoRefresh] = useState<number>(() => {
    return parseInt(localStorage.getItem("sentinel_auto_refresh") || "30", 10);
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("sentinel_notifications") === "true";
  });
  const [defaultExport, setDefaultExport] = useState<string>(() => {
    return localStorage.getItem("sentinel_export_format") || "CSV";
  });
  const [prefSavedMsg, setPrefSavedMsg] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

  // Loading indicator for tabs
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [profData, threshData, diagData] = await Promise.all([
        getUserProfile(),
        getSystemSettings(),
        getSystemDiagnostics(),
      ]);
      setProfile(profData);
      setEditFullName(profData.fullName);
      setThresholds(threshData);
      setDiagnostics(diagData);
    } catch (err: any) {
      console.error("Failed to load platform settings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load audit logs when switching to audit tab or changing page/filter
  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, auditPage, auditActionFilter]);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        pageSize: "15",
      });
      if (auditActionFilter) {
        params.append("action", auditActionFilter);
      }
      const res = await getAuditLogs(params);
      setAuditLogs(res.logs);
      setAuditTotal(res.total);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await updateUserProfile({ fullName: editFullName });
      setProfile((prev) => (prev ? { ...prev, fullName: res.fullName } : null));
      setProfileMsg({ type: "success", text: res.message });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters in length." });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeUserPassword({
        currentPassword,
        newPassword,
      });
      setPasswordMsg({ type: "success", text: res.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 3500);
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err?.message || "Password change rejected." });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholds) return;
    setSavingThresholds(true);
    setThresholdMsg(null);
    try {
      const updated = await updateSystemSettings(thresholds);
      setThresholds(updated);
      setThresholdMsg({ type: "success", text: "Operational risk thresholds saved and audited." });
      setTimeout(() => setThresholdMsg(null), 3000);
    } catch (err: any) {
      setThresholdMsg({ type: "error", text: err?.message || "Failed to save threshold policies." });
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem("sentinel_auto_refresh", autoRefresh.toString());
    localStorage.setItem("sentinel_notifications", notificationsEnabled.toString());
    localStorage.setItem("sentinel_export_format", defaultExport);
    setPrefSavedMsg(true);
    setTimeout(() => setPrefSavedMsg(false), 2500);
  };

  if (loading && !profile) {
    return (
      <div className="page-container loading-state">
        <div className="spinner"></div>
        <p className="loading-text">Loading Platform Settings & Governance Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="page-container settings-page">
      {/* Header Banner */}
      <header className="page-header settings-header">
        <div className="header-titles">
          <div className="title-row">
            <h1>Platform Settings & Security Center</h1>
            <span className="badge-prod-arch">100% SOFTWARE-ONLY</span>
            <span className="badge-build-ver">v2.0.0 ENTERPRISE</span>
          </div>
          <p className="subtitle">
            Manage investigator authentication credentials, calibrated AML risk thresholds, SOC workspace preferences, and security audit telemetry.
          </p>
        </div>
      </header>

      {/* Settings Navigation Tabs */}
      <div className="settings-nav-tabs">
        <button
          className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <span className="tab-icon">👤</span>
          <span>Profile & Security</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "thresholds" ? "active" : ""}`}
          onClick={() => setActiveTab("thresholds")}
        >
          <span className="tab-icon">⚙️</span>
          <span>AML Risk Thresholds</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <span className="tab-icon">🖥️</span>
          <span>Workspace Preferences</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <span className="tab-icon">📜</span>
          <span>Security Audit Logs</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "diagnostics" ? "active" : ""}`}
          onClick={() => setActiveTab("diagnostics")}
        >
          <span className="tab-icon">🩺</span>
          <span>System Diagnostics</span>
        </button>
      </div>

      {/* TAB 1: Profile & Password Security */}
      {activeTab === "profile" && profile && (
        <div className="settings-tab-content grid-2col">
          {/* Identity & Profile Details */}
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Analyst Identity & Credentials</h3>
                <p className="card-subtitle">Active session user details and departmental affiliation</p>
              </div>
              <span className={`user-role-pill role-${profile.role.toLowerCase()}`}>
                {profile.role}
              </span>
            </div>

            <form onSubmit={handleUpdateProfile} className="settings-form">
              <div className="profile-hero">
                <div className="profile-large-avatar">
                  {profile.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="profile-hero-meta">
                  <h4>{profile.fullName}</h4>
                  <p>{profile.email}</p>
                  <span className="badge-active-tag">Active Authenticated Analyst</span>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  className="input-text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label">Authorized Work Email</label>
                <input type="text" className="input-text text-muted" value={profile.email} disabled />
                <small className="field-hint">Email address is managed by the organization directory and immutable.</small>
              </div>

              <div className="form-group">
                <label className="input-label">Department / Unit</label>
                <input type="text" className="input-text text-muted" value={profile.department} disabled />
              </div>

              <div className="form-group">
                <label className="input-label">Role-Based Access Level</label>
                <input
                  type="text"
                  className="input-text text-muted"
                  value={`${profile.role} (Supervisory Authorization & FinCEN Reporting Access)`}
                  disabled
                />
              </div>

              {profileMsg && (
                <div className={`alert-banner ${profileMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                  {profileMsg.text}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Update Profile"}
                </button>
              </div>
            </form>
          </section>

          {/* Change Password Card */}
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Security & Password Management</h3>
                <p className="card-subtitle">
                  Enforces PBKDF2-HMAC-SHA256 (600,000 iterations) with salted key stretching
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="settings-form">
              <div className="form-group">
                <label className="input-label">Current Password</label>
                <input
                  type="password"
                  className="input-text"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label">New Secure Password</label>
                <input
                  type="password"
                  className="input-text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label">Confirm New Password</label>
                <input
                  type="password"
                  className="input-text"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                />
              </div>

              <div className="security-notice">
                <div className="sec-icon">🔒</div>
                <div className="sec-text">
                  <strong>Password Requirements:</strong> Minimum 8 characters. Must contain an uppercase letter, a number, and a special symbol. Passwords are never stored in plaintext.
                </div>
              </div>

              {passwordMsg && (
                <div className={`alert-banner ${passwordMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                  {passwordMsg.text}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={changingPassword}>
                  {changingPassword ? "Updating Password..." : "Change Password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: AML Risk Thresholds */}
      {activeTab === "thresholds" && thresholds && (
        <div className="settings-tab-content">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>AML Risk Stratification & Scoring Cutoffs</h3>
                <p className="card-subtitle">
                  Configure composite score boundaries (0–100 scale) calibrated against LightGBM inferences and AML rule breaches
                </p>
              </div>
              <span className="badge-calibrated">Calibrated for 0.9% Fraud Prevalence</span>
            </div>

            <form onSubmit={handleSaveThresholds} className="thresholds-form">
              {/* Visual Spectrum Bar */}
              <div className="risk-spectrum-container">
                <div className="spectrum-label-row">
                  <span>LOW RISK (&lt; {thresholds.lowMax})</span>
                  <span>MEDIUM RISK ({thresholds.lowMax}–{thresholds.medMax})</span>
                  <span>HIGH RISK ({thresholds.medMax}–{thresholds.highMax})</span>
                  <span>CRITICAL RISK (&ge; {thresholds.criticalMin})</span>
                </div>
                <div className="spectrum-bar">
                  <div className="spectrum-seg seg-low" style={{ flex: thresholds.lowMax }}></div>
                  <div className="spectrum-seg seg-med" style={{ flex: thresholds.medMax - thresholds.lowMax }}></div>
                  <div className="spectrum-seg seg-high" style={{ flex: thresholds.highMax - thresholds.medMax }}></div>
                  <div className="spectrum-seg seg-crit" style={{ flex: 100 - thresholds.highMax }}></div>
                </div>
              </div>

              <div className="thresholds-grid">
                <div className="thresh-box border-emerald">
                  <div className="tb-title text-emerald">Low Risk Upper Bound</div>
                  <div className="tb-input-wrap">
                    <input
                      type="number"
                      min={10}
                      max={50}
                      className="input-num"
                      value={thresholds.lowMax}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, lowMax: parseInt(e.target.value, 10) || 40 })
                      }
                    />
                    <span className="tb-unit">/ 100</span>
                  </div>
                  <p className="tb-desc">Accounts below this score are classified as standard banking activity.</p>
                </div>

                <div className="thresh-box border-amber">
                  <div className="tb-title text-amber">Medium Risk Upper Bound</div>
                  <div className="tb-input-wrap">
                    <input
                      type="number"
                      min={40}
                      max={80}
                      className="input-num"
                      value={thresholds.medMax}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, medMax: parseInt(e.target.value, 10) || 70 })
                      }
                    />
                    <span className="tb-unit">/ 100</span>
                  </div>
                  <p className="tb-desc">Accounts with minor behavioral departures flagged for routine monitoring.</p>
                </div>

                <div className="thresh-box border-orange">
                  <div className="tb-title text-orange">High Risk Cutoff</div>
                  <div className="tb-input-wrap">
                    <input
                      type="number"
                      min={65}
                      max={95}
                      className="input-num"
                      value={thresholds.highMax}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, highMax: parseInt(e.target.value, 10) || 90 })
                      }
                    />
                    <span className="tb-unit">/ 100</span>
                  </div>
                  <p className="tb-desc">High-priority triage queue requiring mandatory analyst disposition.</p>
                </div>

                <div className="thresh-box border-danger">
                  <div className="tb-title text-danger">Autonomous Payment Freeze Cutoff</div>
                  <div className="tb-input-wrap">
                    <input
                      type="number"
                      min={85}
                      max={99}
                      className="input-num"
                      value={thresholds.autoHoldThreshold}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, autoHoldThreshold: parseInt(e.target.value, 10) || 90 })
                      }
                    />
                    <span className="tb-unit">/ 100</span>
                  </div>
                  <p className="tb-desc">Accounts exceeding this score trigger automated debit holds and FinCEN SAR alerts.</p>
                </div>
              </div>

              {thresholdMsg && (
                <div className={`alert-banner ${thresholdMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                  {thresholdMsg.text}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={savingThresholds}>
                  {savingThresholds ? "Saving Policies..." : "Save Risk Scoring Policies"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* TAB 3: Workspace Preferences */}
      {activeTab === "preferences" && (
        <div className="settings-tab-content">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Analyst Workspace & SOC Preferences</h3>
                <p className="card-subtitle">Personalize your live fraud console behavior and telemetry intervals</p>
              </div>
            </div>

            <div className="preferences-list">
              <div className="pref-row">
                <div className="pref-info">
                  <span className="pref-title">Live Triage Console Auto-Refresh</span>
                  <p className="pref-desc">Frequency of automatic polling for incoming transactions and threat alerts.</p>
                </div>
                <div className="pref-ctrl">
                  <select
                    className="select-styled"
                    value={autoRefresh}
                    onChange={(e) => setAutoRefresh(parseInt(e.target.value, 10))}
                  >
                    <option value={15}>Every 15 seconds</option>
                    <option value={30}>Every 30 seconds (Recommended)</option>
                    <option value={60}>Every 60 seconds</option>
                    <option value={0}>Disabled (Manual Refresh)</option>
                  </select>
                </div>
              </div>

              <div className="pref-row">
                <div className="pref-info">
                  <span className="pref-title">Desktop Threat Notifications</span>
                  <p className="pref-desc">Receive browser desktop push alerts for newly surfaced Critical Risk accounts.</p>
                </div>
                <div className="pref-ctrl">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className="pref-row">
                <div className="pref-info">
                  <span className="pref-title">Default Forensic Ledger Export Format</span>
                  <p className="pref-desc">File format applied when exporting transaction tables or SAR dossiers.</p>
                </div>
                <div className="pref-ctrl">
                  <select
                    className="select-styled"
                    value={defaultExport}
                    onChange={(e) => setDefaultExport(e.target.value)}
                  >
                    <option value="CSV">CSV Spreadsheet (.csv)</option>
                    <option value="JSON">Structured JSON (.json)</option>
                    <option value="PARQUET">Apache Parquet (.parquet)</option>
                  </select>
                </div>
              </div>

              <div className="pref-row">
                <div className="pref-info">
                  <span className="pref-title">Theme Environment</span>
                  <p className="pref-desc">Console interface styling and visual hierarchy.</p>
                </div>
                <div className="pref-ctrl">
                  <span className="badge-theme-active">Dark Financial Cybersecurity (SOC)</span>
                </div>
              </div>
            </div>

            {prefSavedMsg && (
              <div className="alert-banner alert-success">
                Workspace preferences saved to local profile.
              </div>
            )}

            <div className="form-actions">
              <button className="btn-primary" onClick={handleSavePreferences}>
                Save Preferences
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: Security Audit Logs */}
      {activeTab === "audit" && (
        <div className="settings-tab-content">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Immutable Compliance Audit Trail</h3>
                <p className="card-subtitle">Cryptographic log of analyst actions, case creations, and regulatory events</p>
              </div>
              <div className="audit-filters">
                <select
                  className="select-styled"
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">All Audit Actions ({auditTotal})</option>
                  <option value="LOGIN">User Logins</option>
                  <option value="ALERT">Alert Modifications</option>
                  <option value="CASE">Case Operations</option>
                  <option value="COPILOT">Copilot Inquiries</option>
                  <option value="SETTINGS">Settings Updates</option>
                  <option value="PASSWORD">Password Changes</option>
                </select>
              </div>
            </div>

            {loadingAudit ? (
              <div className="table-loading">Loading immutable audit logs...</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>EVENT TIMESTAMP</th>
                      <th>ACTOR</th>
                      <th>ACTION</th>
                      <th>RESOURCE</th>
                      <th>FORENSIC DETAILS</th>
                      <th>IP ADDRESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          No audit records found matching selected filter.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="font-mono text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <strong>{log.userEmail}</strong>
                          </td>
                          <td>
                            <span className="audit-action-badge">{log.action}</span>
                          </td>
                          <td className="font-mono text-xs">{log.resource}</td>
                          <td className="audit-details-cell">
                            <small>{log.details}</small>
                          </td>
                          <td className="font-mono text-xs text-muted">{log.ipAddress}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="pagination-bar">
              <span className="text-muted text-xs">
                Showing Page {auditPage} (Total {auditTotal} logged events)
              </span>
              <div className="page-btns">
                <button
                  className="btn-tiny"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn-tiny"
                  disabled={auditPage * 15 >= auditTotal}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: System Diagnostics */}
      {activeTab === "diagnostics" && diagnostics && (
        <div className="settings-tab-content grid-2col">
          {/* Architecture & Hardware-Free Verification */}
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Architecture & Environment Health</h3>
                <p className="card-subtitle">Hardware-free software verification and platform telemetry</p>
              </div>
              <span className="badge-system-ok">{diagnostics.status}</span>
            </div>

            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-k">Architecture Type</span>
                <strong className="diag-v text-emerald">{diagnostics.architecture.type}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Hardware Dependencies</span>
                <strong className="diag-v text-cyan">{diagnostics.architecture.hardwareDependencies}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Backend Framework</span>
                <strong className="diag-v">{diagnostics.architecture.apiFramework}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Persistence Storage</span>
                <strong className="diag-v">{diagnostics.architecture.database}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Host Operating System</span>
                <strong className="diag-v">{diagnostics.architecture.operatingSystem}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Platform Build Version</span>
                <strong className="diag-v">{diagnostics.version}</strong>
              </div>
            </div>
          </section>

          {/* Dataset & Machine Learning Health */}
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Dataset & ML Inference Metrics</h3>
                <p className="card-subtitle">Real dataset storage footprint and production model health</p>
              </div>
              <span className="badge-audit">PR-AUC 96.07%</span>
            </div>

            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-k">Raw Dataset (compressed_data.csv)</span>
                <strong className="diag-v text-cyan">{diagnostics.telemetry.rawDatasetSizeMB} MB (9,082 records)</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Scored Feature Parquet Cache</span>
                <strong className="diag-v text-emerald">{diagnostics.telemetry.cachedParquetSizeKB} KB (Sub-second query)</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Monitored Enterprise Accounts</span>
                <strong className="diag-v">{diagnostics.telemetry.monitoredAccounts.toLocaleString()} accounts</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Production Champion Model</span>
                <strong className="diag-v text-cyan">{diagnostics.models.productionChampion}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Leakage Audit Guarantee</span>
                <strong className="diag-v text-emerald">{diagnostics.models.leakageStatus}</strong>
              </div>
              <div className="diag-item">
                <span className="diag-k">Model Inference Latency</span>
                <strong className="diag-v text-emerald">{diagnostics.models.inferenceSpeed}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
