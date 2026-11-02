import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { DashboardStats, getDashboardStats } from "../api/client";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#dc2626",
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">Failed to load dashboard: {error}</div>;
  if (!stats) return <div className="loading">Loading real dataset statistics…</div>;

  const riskData = Object.entries(stats.riskDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <>
      <h1 className="page-title">Fraud Detection Dashboard</h1>
      <p className="page-subtitle">
        Live statistics from compressed_data.csv — {stats.totalTransactions.toLocaleString()} transactions,{" "}
        {stats.fraudPercentage}% fraud rate
      </p>

      <div className="grid grid-4" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <div className="card-title">Total Transactions</div>
          <div className="card-value stat-neutral">{stats.totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-title">Fraudulent</div>
          <div className="card-value stat-fraud">{stats.fraudulentTransactions}</div>
        </div>
        <div className="card">
          <div className="card-title">Legitimate</div>
          <div className="card-value stat-legit">{stats.legitimateTransactions.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-title">Avg Amount</div>
          <div className="card-value stat-neutral">${stats.averageTransactionAmount}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <div className="card-title">Risk Distribution</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {riskData.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#6366f1"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Fraud Trends by Month</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.fraudTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243049" />
                <XAxis dataKey="month" stroke="#8b9cb8" fontSize={12} />
                <YAxis stroke="#8b9cb8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #243049" }} />
                <Line type="monotone" dataKey="fraud" stroke="#ef4444" strokeWidth={2} name="Fraud cases" />
                <Line type="monotone" dataKey="fraudRate" stroke="#3b82f6" strokeWidth={2} name="Fraud rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Highest-Risk Transactions</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {stats.highestRiskTransactions.map((t) => (
                <tr key={t.transactionId}>
                  <td>{t.transactionId}</td>
                  <td>{t.accountId}</td>
                  <td>${t.amount}</td>
                  <td className={`risk-${t.riskLevel}`}>{t.riskScore}</td>
                  <td>
                    <span className={`badge ${t.actualLabel ? "badge-fraud" : "badge-legit"}`}>
                      {t.actualLabel ? "Fraud" : "Legit"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title">High-Risk Accounts ({stats.uniqueAccounts} total)</div>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Txns</th>
                <th>Avg Risk</th>
                <th>Fraud</th>
              </tr>
            </thead>
            <tbody>
              {stats.highRiskAccounts.map((a) => (
                <tr key={a.rawAccountId}>
                  <td>{a.accountId}</td>
                  <td>{a.transactionCount}</td>
                  <td className={a.avgRiskScore >= 70 ? "risk-high" : ""}>{a.avgRiskScore}</td>
                  <td>{a.fraudCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
