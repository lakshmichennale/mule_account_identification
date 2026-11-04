import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import App from "./App";
import { getStoredToken } from "./api/client";
import Dashboard from "./pages/Dashboard";
import AccountAnalysisPage from "./pages/AccountAnalysis";
import AlertsPage from "./pages/Alerts";
import CasesPage from "./pages/Cases";
import CopilotPage from "./pages/Copilot";
import LoginPage from "./pages/Login";
import ModelAnalyticsPage from "./pages/ModelAnalytics";
import Network from "./pages/Network";
import SettingsPage from "./pages/Settings";
import Transactions from "./pages/Transactions";
import UsersPage from "./pages/Users";

function ProtectedRoute() {
  const token = getStoredToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function Router() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Enterprise Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<AccountAnalysisPage />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="network" element={<Network />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="model-analytics" element={<ModelAnalyticsPage />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Route>

      {/* Fallback to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
