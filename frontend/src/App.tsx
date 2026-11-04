import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, logoutApi, User } from "./api/client";

export default function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser());

  useEffect(() => {
    const handleUnauthorized = () => {
      navigate("/login", { replace: true });
    };

    window.addEventListener("sentinel:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("sentinel:unauthorized", handleUnauthorized);
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore error and redirect
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Brand */}
        <div className="logo">
          <div className="logo-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="logo-text">
            <span>SENTINEL</span>
            <span className="logo-sub">Fraud Intelligence Platform</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="nav-group">
          <div className="nav-section-title">OPERATIONS</div>
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            end
          >
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/accounts"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">🔍</span>
            <span>Account Analysis</span>
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">💳</span>
            <span>Transactions</span>
          </NavLink>
          <NavLink
            to="/network"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">🕸️</span>
            <span>Fraud Network</span>
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">🚨</span>
            <span>Alerts</span>
          </NavLink>
          <NavLink
            to="/cases"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">📁</span>
            <span>Cases & SAR</span>
          </NavLink>

          <div className="nav-section-title" style={{ marginTop: "16px" }}>INTELLIGENCE & ML</div>
          <NavLink
            to="/model-analytics"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">📈</span>
            <span>Model Analytics</span>
          </NavLink>
          <NavLink
            to="/copilot"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">🤖</span>
            <span>AI Copilot</span>
          </NavLink>

          <div className="nav-section-title" style={{ marginTop: "16px" }}>GOVERNANCE & SYSTEM</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">⚙️</span>
            <span>Settings & Security</span>
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">👥</span>
            <span>User Directory (RBAC)</span>
          </NavLink>
        </nav>

        {/* User Profile & Session Controls */}
        <div className="user-profile-panel">
          <div className="user-info">
            <div className="user-avatar">
              {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser?.fullName || "Active Analyst"}</span>
              <span className="user-role-badge">{currentUser?.role || "ANALYST"}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-logout"
            title="Secure Sign Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
