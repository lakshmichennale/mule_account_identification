import React, { useEffect, useState } from "react";
import {
  adminResetPassword,
  createUser,
  getStoredUser,
  getUsers,
  ManagedUser,
  updateUser,
  UserManagementStats,
} from "../api/client";

export default function UsersPage() {
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<UserManagementStats>({
    totalUsers: 0,
    activeAdmins: 0,
    activeAnalysts: 0,
    deactivatedUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Selected User for Edit / Reset
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Create Form State
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("FRAUD_ANALYST");
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit Form State
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("FRAUD_ANALYST");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [page, roleFilter, statusFilter, isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "15",
      });
      if (search.trim()) params.append("search", search.trim());
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      const res = await getUsers(params);
      setUsers(res.users);
      setStats(res.stats);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err?.message || "Failed to load user directory.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleResetFilters = () => {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  // Open Edit Modal
  const openEditModal = (u: ManagedUser) => {
    setSelectedUser(u);
    setEditFullName(u.fullName);
    setEditRole(u.role);
    setEditIsActive(u.isActive);
    setEditMsg(null);
    setEditModalOpen(true);
  };

  // Open Reset Password Modal
  const openResetModal = (u: ManagedUser) => {
    setSelectedUser(u);
    setNewPassword("");
    setConfirmPassword("");
    setResetMsg(null);
    setResetModalOpen(true);
  };

  // Execute Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    if (!createEmail || !createFullName || !createPassword) return;

    if (createPassword.length < 8) {
      setCreateMsg({ type: "error", text: "Initial password must be at least 8 characters in length." });
      return;
    }

    setCreating(true);
    try {
      const res = await createUser({
        email: createEmail,
        fullName: createFullName,
        password: createPassword,
        role: createRole,
      });
      setCreateMsg({ type: "success", text: res.message });
      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateEmail("");
        setCreateFullName("");
        setCreatePassword("");
        setCreateMsg(null);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setCreateMsg({ type: "error", text: err?.message || "Failed to create user." });
    } finally {
      setCreating(false);
    }
  };

  // Execute Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditMsg(null);
    setUpdating(true);

    try {
      const res = await updateUser(selectedUser.id, {
        fullName: editFullName,
        role: editRole,
        isActive: editIsActive,
      });
      setEditMsg({ type: "success", text: res.message });
      setTimeout(() => {
        setEditModalOpen(false);
        setEditMsg(null);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setEditMsg({ type: "error", text: err?.message || "Failed to update user." });
    } finally {
      setUpdating(false);
    }
  };

  // Execute Admin Password Reset
  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetMsg(null);

    if (newPassword !== confirmPassword) {
      setResetMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setResetMsg({ type: "error", text: "New password must be at least 8 characters in length." });
      return;
    }

    setResetting(true);
    try {
      const res = await adminResetPassword(selectedUser.id, { newPassword });
      setResetMsg({ type: "success", text: res.message });
      setTimeout(() => {
        setResetModalOpen(false);
        setResetMsg(null);
      }, 1500);
    } catch (err: any) {
      setResetMsg({ type: "error", text: err?.message || "Failed to reset password." });
    } finally {
      setResetting(false);
    }
  };

  // Toggle user activation directly from row
  const handleToggleActive = async (u: ManagedUser) => {
    const actionText = u.isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionText} user account ${u.email}?`)) return;

    try {
      await updateUser(u.id, { isActive: !u.isActive });
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || `Failed to ${actionText} user.`);
    }
  };

  // Access Denied for Non-Admin
  if (!isAdmin) {
    return (
      <div className="page-container error-state">
        <div className="error-card">
          <div className="error-icon">🛡️</div>
          <h3>Supervisory Clearance Required</h3>
          <p>
            The User Administration Directory is restricted to authorized <strong>ADMIN</strong> roles. Your current role is <strong>{currentUser?.role || "FRAUD_ANALYST"}</strong>.
          </p>
          <p className="text-muted text-xs">
            To manage personnel, contact the system administrator or switch to an administrator session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container users-page">
      {/* Header Banner */}
      <header className="page-header users-header">
        <div className="header-titles">
          <div className="title-row">
            <h1>User Directory & Access Control</h1>
            <span className="badge-admin-rbac">ADMIN RBAC ACTIVE</span>
            <span className="badge-total-users">{stats.totalUsers} Personnel</span>
          </div>
          <p className="subtitle">
            Manage authenticated investigators, role assignments (ADMIN vs FRAUD_ANALYST), credentials, and account lifecycle states.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Provision New User
          </button>
        </div>
      </header>

      {/* KPI Stats Strip */}
      <section className="kpi-grid">
        <div className="kpi-card highlight-cyan">
          <div className="kpi-label">Total Registered Users</div>
          <div className="kpi-value">{stats.totalUsers}</div>
          <div className="kpi-footer">
            <span>Enterprise Authorized Roster</span>
          </div>
        </div>

        <div className="kpi-card highlight-purple">
          <div className="kpi-label">Active Administrators</div>
          <div className="kpi-value">{stats.activeAdmins}</div>
          <div className="kpi-footer text-success">
            <span>Full System & RBAC Authority</span>
          </div>
        </div>

        <div className="kpi-card highlight-emerald">
          <div className="kpi-label">Active Fraud Analysts</div>
          <div className="kpi-value">{stats.activeAnalysts}</div>
          <div className="kpi-footer">
            <span>Case & Alert Triage Investigators</span>
          </div>
        </div>

        <div className="kpi-card highlight-amber">
          <div className="kpi-label">Deactivated Accounts</div>
          <div className="kpi-value">{stats.deactivatedUsers}</div>
          <div className="kpi-footer">
            <span>Login Access Revoked</span>
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="card user-toolbar-card">
        <form onSubmit={handleSearchSubmit} className="user-toolbar-form">
          <div className="search-wrap">
            <input
              type="text"
              className="input-text"
              placeholder="Search by full name or email address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-select-wrap">
            <select
              className="select-styled"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="FRAUD_ANALYST">FRAUD_ANALYST</option>
            </select>
          </div>

          <div className="filter-select-wrap">
            <select
              className="select-styled"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="deactivated">Deactivated Only</option>
            </select>
          </div>

          <button type="submit" className="btn-secondary">
            Filter
          </button>
          {(search || roleFilter || statusFilter) && (
            <button type="button" className="btn-tiny" onClick={handleResetFilters}>
              Clear Filters
            </button>
          )}
        </form>
      </section>

      {/* Users Data Table */}
      <section className="card users-table-card">
        {loading ? (
          <div className="table-loading">Loading authorized personnel roster...</div>
        ) : error ? (
          <div className="alert-banner alert-danger">{error}</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>INVESTIGATOR / EMAIL</th>
                  <th>ROLE</th>
                  <th>ACCOUNT STATUS</th>
                  <th>PROVISIONED DATE</th>
                  <th>LAST LOGIN</th>
                  <th>ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No user accounts found matching selected criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-identity-cell">
                          <div className="user-mini-avatar">
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-text-meta">
                            <strong>{u.fullName}</strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`user-role-pill role-${u.role.toLowerCase()}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="badge-status-active">ACTIVE</span>
                        ) : (
                          <span className="badge-status-deactivated">DEACTIVATED</span>
                        )}
                      </td>
                      <td className="font-mono text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td>
                        <div className="row-action-btns">
                          <button
                            className="btn-tiny"
                            onClick={() => openEditModal(u)}
                            title="Edit user details and role"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-tiny"
                            onClick={() => openResetModal(u)}
                            title="Reset user credentials"
                          >
                            🔑 Reset Password
                          </button>
                          <button
                            className={`btn-tiny ${u.isActive ? "btn-deact" : "btn-act"}`}
                            onClick={() => handleToggleActive(u)}
                            title={u.isActive ? "Deactivate account" : "Re-activate account"}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="pagination-bar">
          <span className="text-muted text-xs">
            Showing Page {page} of {totalPages} (Total {totalCount} users)
          </span>
          <div className="page-btns">
            <button
              className="btn-tiny"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn-tiny"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Modal: Create New User */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Provision New Investigator Account</h3>
              <button className="btn-close" onClick={() => setCreateModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="input-label">Work Email Address</label>
                  <input
                    type="email"
                    className="input-text"
                    placeholder="analyst.name@sentinel.bank"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label">Full Name</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. Eleanor Vance"
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label">Initial Password</label>
                  <input
                    type="password"
                    className="input-text"
                    placeholder="At least 8 characters"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label">Role Assignment</label>
                  <select
                    className="select-styled full-width"
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value)}
                  >
                    <option value="FRAUD_ANALYST">FRAUD_ANALYST (Triage & SAR Operations)</option>
                    <option value="ADMIN">ADMIN (Supervisory Authority & RBAC)</option>
                  </select>
                </div>

                {createMsg && (
                  <div className={`alert-banner ${createMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                    {createMsg.text}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Provisioning..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {editModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit User: {selectedUser.email}</h3>
              <button className="btn-close" onClick={() => setEditModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="input-label">Email (Immutable)</label>
                  <input type="text" className="input-text text-muted" value={selectedUser.email} disabled />
                </div>

                <div className="form-group">
                  <label className="input-label">Full Name</label>
                  <input
                    type="text"
                    className="input-text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label">Assigned Role</label>
                  <select
                    className="select-styled full-width"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="FRAUD_ANALYST">FRAUD_ANALYST</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label">Account Lifecycle Status</label>
                  <div className="status-toggle-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      <span>Account is Active (Can sign in)</span>
                    </label>
                  </div>
                </div>

                {editMsg && (
                  <div className={`alert-banner ${editMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                    {editMsg.text}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={updating}>
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Password Reset */}
      {resetModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Reset Password for {selectedUser.email}</h3>
              <button className="btn-close" onClick={() => setResetModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAdminResetPassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="input-label">New Password</label>
                  <input
                    type="password"
                    className="input-text"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input-text"
                    placeholder="Re-type password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <small className="field-hint">
                  The password will be hashed with PBKDF2-HMAC-SHA256 (600,000 iterations). The user will be required to change it upon next login.
                </small>

                {resetMsg && (
                  <div className={`alert-banner ${resetMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                    {resetMsg.text}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setResetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={resetting}>
                  {resetting ? "Resetting..." : "Apply New Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
