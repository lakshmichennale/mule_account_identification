import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPasswordApi, getStoredToken, loginApi } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();

  // If already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (getStoredToken()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validations
    if (!email.trim()) {
      setError("Please enter your enterprise email address.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid work email address (e.g. analyst@sentinel.bank).");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters in length.");
      return;
    }

    setLoading(true);
    try {
      const session = await loginApi(email.trim(), password);
      setSuccess(`Authentication verified. Welcome back, ${session.user.fullName} (${session.user.role}).`);
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 750);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !validateEmail(forgotEmail)) {
      setForgotMessage("Please provide a valid registered email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await forgotPasswordApi(forgotEmail.trim());
      setForgotMessage(res.message);
    } catch (err: unknown) {
      setForgotMessage(err instanceof Error ? err.message : "Unable to process password reset.");
    } finally {
      setForgotLoading(false);
    }
  };

  const fillCredentials = (type: "admin" | "analyst") => {
    setError(null);
    if (type === "admin") {
      setEmail("admin@sentinel.bank");
      setPassword("Admin@Sentinel2026!");
    } else {
      setEmail("analyst@sentinel.bank");
      setPassword("Analyst@Sentinel2026!");
    }
  };

  return (
    <div className="login-container">
      <div className="login-grid-bg" />

      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-badge">
            <span className="badge-pulse" />
            <span>SECURE FRAUD OPERATIONS CENTER</span>
          </div>
          <h1 className="login-title">SENTINEL</h1>
          <p className="login-subtitle">
            AI-Powered Mule Account Detection &amp; Fraud Intelligence Platform
          </p>
        </div>

        {/* Quick Fill Testing Credentials */}
        <div className="credential-helpers">
          <span className="helper-label">One-click test accounts:</span>
          <div className="helper-buttons">
            <button
              type="button"
              className="badge-chip chip-admin"
              onClick={() => fillCredentials("admin")}
              title="Click to populate Admin credentials"
            >
              Admin Role
            </button>
            <button
              type="button"
              className="badge-chip chip-analyst"
              onClick={() => fillCredentials("analyst")}
              title="Click to populate Fraud Analyst credentials"
            >
              Analyst Role
            </button>
          </div>
        </div>

        {/* Feedback States */}
        {error && (
          <div className="alert-box alert-error" role="alert">
            <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-box alert-success" role="alert">
            <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} noValidate className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Enterprise Email
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@sentinel.bank"
                className="form-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="password" className="form-label">
                Security Password
              </label>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotMessage(null);
                  setForgotEmail(email);
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="form-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-loading-content">
                <span className="spinner" />
                Verifying Session...
              </span>
            ) : (
              "Sign In to Intelligence Console"
            )}
          </button>
        </form>

        {/* Footer Security Badges */}
        <div className="login-footer">
          <div className="security-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Authorized Financial Personnel Only • 256-Bit Encrypted Audit Session</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Self-Service Password Recovery</h3>
              <button
                className="modal-close"
                onClick={() => setShowForgotModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="modal-desc">
              Enter your enterprise email address. A cryptographically signed password reset link will be dispatched to your security inbox.
            </p>
            {forgotMessage && (
              <div className="alert-box alert-info" style={{ marginBottom: "1rem" }}>
                <span>{forgotMessage}</span>
              </div>
            )}
            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label className="form-label">Enterprise Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="analyst@sentinel.bank"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Dispatching..." : "Send Reset Instructions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
