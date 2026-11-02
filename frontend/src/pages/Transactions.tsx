import { useCallback, useEffect, useState } from "react";
import {
  Transaction,
  TransactionDetail,
  getTransactionDetail,
  getTransactions,
} from "../api/client";

export default function TransactionsPage() {
  const [data, setData] = useState<{ total: number; page: number; totalPages: number; transactions: Transaction[] } | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [fraudOnly, setFraudOnly] = useState<string>("");
  const [riskLevel, setRiskLevel] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");
  const [selected, setSelected] = useState<TransactionDetail | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25", sortBy, sortDir: "desc" });
    if (search) params.set("search", search);
    if (fraudOnly === "true") params.set("fraudOnly", "true");
    if (fraudOnly === "false") params.set("fraudOnly", "false");
    if (riskLevel) params.set("riskLevel", riskLevel);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);

    getTransactions(params)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page, search, fraudOnly, riskLevel, minAmount, maxAmount, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: number) => {
    try {
      const detail = await getTransactionDetail(id);
      setSelected(detail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    }
  };

  if (error && !data) return <div className="error">{error}</div>;

  return (
    <>
      <h1 className="page-title">Transaction Monitoring</h1>
      <p className="page-subtitle">Real dataset records with ML risk scores — account IDs masked for privacy</p>

      <div className="filters">
        <input placeholder="Search ID, account, type…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={fraudOnly} onChange={(e) => { setFraudOnly(e.target.value); setPage(1); }}>
          <option value="">All labels</option>
          <option value="true">Fraud only</option>
          <option value="false">Legitimate only</option>
        </select>
        <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }}>
          <option value="">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input type="number" placeholder="Min $" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1); }} style={{ width: 100 }} />
        <input type="number" placeholder="Max $" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }} style={{ width: 100 }} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="risk_score">Sort: Risk</option>
          <option value="amount">Sort: Amount</option>
          <option value="date">Sort: Date</option>
          <option value="account">Sort: Account</option>
        </select>
        <button className="btn" onClick={load}>Apply</button>
      </div>

      {!data ? (
        <div className="loading">Loading transactions…</div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Prediction</th>
                  <th>Actual</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.transactionId} className="clickable" onClick={() => openDetail(t.transactionId)}>
                    <td>{t.transactionId}</td>
                    <td>{t.date}</td>
                    <td>{t.accountId}</td>
                    <td>{t.transactionType}</td>
                    <td>${t.amount}</td>
                    <td className={`risk-${t.riskLevel}`}>{t.riskScore}</td>
                    <td>
                      <span className={`badge ${t.prediction === "fraud" ? "badge-fraud" : "badge-legit"}`}>
                        {t.prediction}
                      </span>
                    </td>
                    <td>{t.actualLabel ? "Fraud" : "Legit"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {data.page} of {data.totalPages} ({data.total.toLocaleString()} total)</span>
            <button className="btn" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}

      {selected && (
        <>
          <div className="overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <button className="btn" style={{ marginBottom: "1rem" }} onClick={() => setSelected(null)}>Close</button>
            <h3>Transaction #{selected.transactionId}</h3>
            <div className="detail-row"><span>Account</span><span>{selected.accountId}</span></div>
            <div className="detail-row"><span>Date</span><span>{selected.date}</span></div>
            <div className="detail-row"><span>Amount</span><span>${selected.amount}</span></div>
            <div className="detail-row"><span>Balance</span><span>${selected.balanceAmount ?? "—"}</span></div>
            <div className="detail-row"><span>Type</span><span>{selected.transactionType}</span></div>
            <div className="detail-row"><span>Occupation</span><span>{selected.occupation}</span></div>
            <div className="detail-row"><span>Merchant</span><span>{selected.merchantCategory}</span></div>
            <div className="detail-row"><span>Risk Score</span><span className={`risk-${selected.riskLevel}`}>{selected.riskScore}/100</span></div>
            <div className="detail-row"><span>Prediction</span><span>{selected.prediction.toUpperCase()}</span></div>
            <div className="detail-row"><span>Actual Label</span><span>{selected.actualLabel ? "FRAUD" : "LEGITIMATE"}</span></div>
            <div className="detail-row"><span>Confidence</span><span>{((selected.confidence ?? 0) * 100).toFixed(1)}%</span></div>
            {selected.reasons && selected.reasons.length > 0 && (
              <>
                <h4 style={{ marginTop: "1rem" }}>Risk Reasons</h4>
                <ul className="reasons-list">
                  {selected.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
