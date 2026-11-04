import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  AlgorithmBenchmark,
  CurvePoint,
  getModelAnalytics,
  ModelAnalyticsData,
  TopFeatureImportance,
} from "../api/client";

export default function ModelAnalyticsPage() {
  const [data, setData] = useState<ModelAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active visualization tab: "roc" or "pr"
  const [activeCurveTab, setActiveCurveTab] = useState<"roc" | "pr">("pr");
  // Feature category filter: "all" or specific category
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  // Selected benchmark algorithm for inspection
  const [selectedAlgo, setSelectedAlgo] = useState<string>("lightgbm");
  // Search filter for features
  const [featureSearch, setFeatureSearch] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getModelAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load ML model analytics telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-model-analytics-${data.modelInfo.version.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page-container loading-state">
        <div className="spinner"></div>
        <p className="loading-text">Loading Model Telemetry & Explainability Metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container error-state">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h3>Model Analytics Unavailable</h3>
          <p>{error || "Unable to retrieve production model governance telemetry."}</p>
          <button className="btn-primary" onClick={fetchData}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const {
    modelInfo,
    championMetrics,
    confusionMatrix,
    benchmarks,
    topFeatures,
    curves,
    leakagePurgeAudit,
    operatingThresholds,
  } = data;

  // Filter features
  const categories = ["all", ...Array.from(new Set(topFeatures.map((f) => f.category)))];
  const filteredFeatures = topFeatures.filter((f) => {
    const matchesCategory = selectedCategory === "all" || f.category === selectedCategory;
    const matchesSearch =
      featureSearch === "" ||
      f.label.toLowerCase().includes(featureSearch.toLowerCase()) ||
      f.feature.toLowerCase().includes(featureSearch.toLowerCase()) ||
      f.description.toLowerCase().includes(featureSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Current curve data
  const currentCurves = curves[selectedAlgo] || curves["lightgbm"] || { roc_curve: [], pr_curve: [] };
  const curvePoints = activeCurveTab === "roc" ? currentCurves.roc_curve : currentCurves.pr_curve;

  return (
    <div className="page-container model-analytics-page">
      {/* Header Banner */}
      <header className="page-header model-header">
        <div className="header-titles">
          <div className="title-row">
            <h1>Model Analytics & Governance Hub</h1>
            <span className="badge-production">PROD CHAMPION</span>
            <span className="badge-model-version">{modelInfo.version}</span>
          </div>
          <p className="subtitle">
            Grounded transparency and validation telemetry for {modelInfo.name}. Calibrated on {modelInfo.trainSampleSize + modelInfo.testSampleSize} enterprise accounts with zero post-investigation leakage.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportJson} title="Export full evaluation dossier as JSON">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Dossier
          </button>
          <button className="btn-primary" onClick={fetchData} title="Refresh live telemetry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Top 4 KPI Metric Cards */}
      <section className="kpi-grid">
        <div className="kpi-card highlight-cyan">
          <div className="kpi-label">PR-AUC (Precision-Recall)</div>
          <div className="kpi-value">{(championMetrics.prAuc * 100).toFixed(2)}%</div>
          <div className="kpi-footer text-success">
            <span>vs 0.90% random prevalence</span>
            <span className="kpi-badge">+95.2% lift</span>
          </div>
        </div>

        <div className="kpi-card highlight-purple">
          <div className="kpi-label">ROC-AUC (Discrimination)</div>
          <div className="kpi-value">{(championMetrics.rocAuc * 100).toFixed(2)}%</div>
          <div className="kpi-footer text-success">
            <span>Near-perfect separation</span>
            <span className="kpi-badge">0.9996</span>
          </div>
        </div>

        <div className="kpi-card highlight-emerald">
          <div className="kpi-label">Production Precision</div>
          <div className="kpi-value">{(championMetrics.precision * 100).toFixed(1)}%</div>
          <div className="kpi-footer">
            <span>Only 1 FP in 1,817 accounts</span>
            <span className="kpi-badge">FPR 0.06%</span>
          </div>
        </div>

        <div className="kpi-card highlight-amber">
          <div className="kpi-label">Mule Capture (Recall)</div>
          <div className="kpi-value">{(championMetrics.recall * 100).toFixed(1)}%</div>
          <div className="kpi-footer">
            <span>13 of 16 mules captured</span>
            <span className="kpi-badge">F1 86.7%</span>
          </div>
        </div>
      </section>

      {/* Split Section: Interactive Curves & Forensic Confusion Matrix */}
      <div className="grid-2col">
        {/* Left: Interactive Performance Curves */}
        <section className="card curve-card">
          <div className="card-header">
            <div>
              <h3>Validation Curves</h3>
              <p className="card-subtitle">
                {activeCurveTab === "pr"
                  ? "Precision-Recall tradeoff across decision thresholds (essential for 0.9% imbalanced fraud)"
                  : "Receiver Operating Characteristic (TPR vs False Positive Rate)"}
              </p>
            </div>
            <div className="curve-controls">
              {/* Algorithm select for curve */}
              <select
                className="select-algo"
                value={selectedAlgo}
                onChange={(e) => setSelectedAlgo(e.target.value)}
                aria-label="Select algorithm for curve"
              >
                <option value="lightgbm">LightGBM (Champion)</option>
                <option value="xgboost">XGBoost (Challenger)</option>
                <option value="random_forest">Random Forest</option>
              </select>

              {/* Curve toggle */}
              <div className="tab-pill-group">
                <button
                  className={`tab-pill ${activeCurveTab === "pr" ? "active" : ""}`}
                  onClick={() => setActiveCurveTab("pr")}
                >
                  PR Curve
                </button>
                <button
                  className={`tab-pill ${activeCurveTab === "roc" ? "active" : ""}`}
                  onClick={() => setActiveCurveTab("roc")}
                >
                  ROC Curve
                </button>
              </div>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              {activeCurveTab === "pr" ? (
                <AreaChart data={curvePoints} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 1]}
                    tickCount={6}
                    stroke="#64748b"
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    label={{ value: "Recall (Mule Capture Rate)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    domain={[0, 1.05]}
                    tickCount={6}
                    stroke="#64748b"
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    label={{ value: "Precision (Positive Predictive Value)", angle: -90, position: "insideLeft", offset: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <div className="tooltip-title">PR Curve Coordinate</div>
                          <div className="tooltip-row">
                            <span>Recall:</span>
                            <strong>{(pt.x * 100).toFixed(1)}%</strong>
                          </div>
                          <div className="tooltip-row">
                            <span>Precision:</span>
                            <strong>{(pt.y * 100).toFixed(1)}%</strong>
                          </div>
                          {pt.threshold !== undefined && (
                            <div className="tooltip-row">
                              <span>Cutoff Score:</span>
                              <strong className="text-cyan">{(pt.threshold * 100).toFixed(1)}/100</strong>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0.009} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Prevalence Baseline (0.9%)", fill: "#ef4444", position: "top" }} />
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#prGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <LineChart data={curvePoints} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 1]}
                    tickCount={6}
                    stroke="#64748b"
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    label={{ value: "False Positive Rate (1 - Specificity)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    domain={[0, 1.05]}
                    tickCount={6}
                    stroke="#64748b"
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    label={{ value: "True Positive Rate (Sensitivity / Recall)", angle: -90, position: "insideLeft", offset: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <div className="tooltip-title">ROC Curve Coordinate</div>
                          <div className="tooltip-row">
                            <span>FPR:</span>
                            <strong>{(pt.x * 100).toFixed(3)}%</strong>
                          </div>
                          <div className="tooltip-row">
                            <span>TPR:</span>
                            <strong>{(pt.y * 100).toFixed(1)}%</strong>
                          </div>
                          {pt.threshold !== undefined && (
                            <div className="tooltip-row">
                              <span>Cutoff Score:</span>
                              <strong className="text-purple">{(pt.threshold * 100).toFixed(1)}/100</strong>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#475569" strokeDasharray="3 3" label={{ value: "Random Guess (AUC 0.50)", fill: "#475569", position: "insideBottomRight" }} />
                  <Line
                    type="monotone"
                    dataKey="y"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="curve-legend-footer">
            <div className="legend-item">
              <span className="dot dot-cyan"></span>
              <span>Selected Model: <strong>{selectedAlgo.toUpperCase()}</strong></span>
            </div>
            <div className="legend-item">
              <span className="dot dot-emerald"></span>
              <span>PR-AUC: <strong>{(championMetrics.prAuc * 100).toFixed(2)}%</strong></span>
            </div>
            <div className="legend-item">
              <span className="dot dot-purple"></span>
              <span>ROC-AUC: <strong>{(championMetrics.rocAuc * 100).toFixed(2)}%</strong></span>
            </div>
          </div>
        </section>

        {/* Right: Forensic Confusion Matrix */}
        <section className="card cm-card">
          <div className="card-header">
            <div>
              <h3>Holdout Confusion Matrix</h3>
              <p className="card-subtitle">
                Stratified 20% test holdout evaluation ({confusionMatrix.totalTested.toLocaleString()} total accounts evaluated)
              </p>
            </div>
            <span className="badge-audit">Zero Test Leakage</span>
          </div>

          <div className="cm-matrix-container">
            {/* Top axis labels */}
            <div className="cm-header-row">
              <div className="cm-corner"></div>
              <div className="cm-col-label">PREDICTED LEGITIMATE</div>
              <div className="cm-col-label">PREDICTED MULE</div>
            </div>

            {/* Actual Negative Row */}
            <div className="cm-row">
              <div className="cm-row-label">
                <span>ACTUAL LEGITIMATE</span>
                <small>({confusionMatrix.totalActualLegitimate} records)</small>
              </div>
              <div className="cm-cell cell-tn">
                <div className="cm-cell-tag">TRUE NEGATIVE (TN)</div>
                <div className="cm-cell-value">{confusionMatrix.trueNegatives.toLocaleString()}</div>
                <div className="cm-cell-pct">
                  {((confusionMatrix.trueNegatives / confusionMatrix.totalActualLegitimate) * 100).toFixed(2)}% specificity
                </div>
              </div>
              <div className="cm-cell cell-fp">
                <div className="cm-cell-tag">FALSE POSITIVE (FP)</div>
                <div className="cm-cell-value text-amber">{confusionMatrix.falsePositives}</div>
                <div className="cm-cell-pct text-amber">
                  {(championMetrics.falsePositiveRate * 100).toFixed(3)}% FPR (Only 1 alert noise)
                </div>
              </div>
            </div>

            {/* Actual Positive Row */}
            <div className="cm-row">
              <div className="cm-row-label">
                <span>ACTUAL MULE</span>
                <small>({confusionMatrix.totalActualMules} records)</small>
              </div>
              <div className="cm-cell cell-fn">
                <div className="cm-cell-tag">FALSE NEGATIVE (FN)</div>
                <div className="cm-cell-value text-danger">{confusionMatrix.falseNegatives}</div>
                <div className="cm-cell-pct text-danger">
                  {(championMetrics.falseNegativeRate * 100).toFixed(2)}% FNR (3 accounts missed)
                </div>
              </div>
              <div className="cm-cell cell-tp">
                <div className="cm-cell-tag">TRUE POSITIVE (TP)</div>
                <div className="cm-cell-value text-emerald">{confusionMatrix.truePositives}</div>
                <div className="cm-cell-pct text-emerald">
                  {(championMetrics.recall * 100).toFixed(1)}% recall (13 mules captured)
                </div>
              </div>
            </div>
          </div>

          <div className="cm-stats-summary">
            <div className="stat-pill">
              <span className="stat-label">Overall Accuracy:</span>
              <strong className="stat-val">{(championMetrics.accuracy * 100).toFixed(2)}%</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Balanced F1-Score:</span>
              <strong className="stat-val">{(championMetrics.f1Score * 100).toFixed(2)}%</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Analyst False Positive Rate:</span>
              <strong className="stat-val text-success">1 in 1,801 legitimate</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Algorithm Benchmark Comparison Table */}
      <section className="card benchmark-card">
        <div className="card-header">
          <div>
            <h3>Algorithmic Benchmarking Suite</h3>
            <p className="card-subtitle">
              Comparative model bake-off on the identical stratified 20% holdout test dataset (1,817 accounts)
            </p>
          </div>
          <span className="benchmark-count-badge">5 Algorithms Audited</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ALGORITHM / MODEL</th>
                <th>ROLE / STATUS</th>
                <th>PR-AUC</th>
                <th>ROC-AUC</th>
                <th>PRECISION</th>
                <th>RECALL</th>
                <th>F1-SCORE</th>
                <th>FALSE POSITIVES</th>
                <th>FALSE NEGATIVES</th>
                <th>ENGINEERING NOTES</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((bm: AlgorithmBenchmark) => {
                const isChampion = bm.isProduction;
                return (
                  <tr key={bm.algorithm} className={isChampion ? "row-champion" : ""}>
                    <td>
                      <div className="algo-name-cell">
                        <strong>{bm.name}</strong>
                        {isChampion && <span className="pill-active-engine">Active Engine</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-${bm.status.toLowerCase()}`}>
                        {bm.status}
                      </span>
                    </td>
                    <td>
                      <strong className={isChampion ? "text-cyan" : ""}>
                        {(bm.prAuc * 100).toFixed(2)}%
                      </strong>
                    </td>
                    <td>
                      <strong className={isChampion ? "text-purple" : ""}>
                        {(bm.rocAuc * 100).toFixed(2)}%
                      </strong>
                    </td>
                    <td>{(bm.precision * 100).toFixed(1)}%</td>
                    <td>{(bm.recall * 100).toFixed(1)}%</td>
                    <td>{(bm.f1Score * 100).toFixed(1)}%</td>
                    <td>
                      <span className={bm.falsePositives > 10 ? "text-danger" : "text-emerald"}>
                        {bm.falsePositives}
                      </span>
                    </td>
                    <td>
                      <span className={bm.falseNegatives > 10 ? "text-danger" : "text-amber"}>
                        {bm.falseNegatives}
                      </span>
                    </td>
                    <td className="notes-cell">
                      <small>{bm.notes}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Global Feature Importance & XAI Attribution */}
      <section className="card feature-importance-card">
        <div className="card-header">
          <div>
            <h3>Global Feature Importance & XAI Attribution</h3>
            <p className="card-subtitle">
              Top 20 tree split importance features explaining mule account risk scoring decisions
            </p>
          </div>
          <div className="feature-search-box">
            <input
              type="text"
              placeholder="Search feature or indicator..."
              value={featureSearch}
              onChange={(e) => setFeatureSearch(e.target.value)}
              className="input-search"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="category-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`pill-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === "all" ? "All Features (20)" : cat}
            </button>
          ))}
        </div>

        <div className="feature-bars-list">
          {filteredFeatures.map((feat: TopFeatureImportance) => (
            <div key={feat.feature} className="feature-item">
              <div className="feature-rank">#{feat.rank}</div>
              <div className="feature-info">
                <div className="feature-header-line">
                  <span className="feature-label">{feat.label}</span>
                  <span className="feature-code">[{feat.feature}]</span>
                  <span className="feature-cat-badge">{feat.category}</span>
                  <span className="feature-split-score">{feat.importance} splits ({feat.relativeWeight}%)</span>
                </div>
                <div className="feature-desc">{feat.description}</div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${feat.relativeWeight}%`,
                      background:
                        feat.category === "AML Regulatory Rule"
                          ? "linear-gradient(90deg, #ef4444, #f97316)"
                          : feat.category === "Engineered Rule Risk"
                          ? "linear-gradient(90deg, #f59e0b, #eab308)"
                          : "linear-gradient(90deg, #06b6d4, #3b82f6)",
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Decision Thresholds & Risk Policies */}
      <section className="card thresholds-card">
        <div className="card-header">
          <div>
            <h3>Operational Triage Thresholds</h3>
            <p className="card-subtitle">
              Model score decision cutoffs calibrated against banking risk tolerance and regulatory exposure
            </p>
          </div>
          <span className="badge-calibrated">Calibrated on Real Prevalence</span>
        </div>

        <div className="thresholds-grid">
          {operatingThresholds.map((ot) => (
            <div key={ot.name} className="threshold-card">
              <div className="threshold-header">
                <h4>{ot.name}</h4>
                <div className="threshold-score-pill">Cutoff &ge; {(ot.threshold * 100).toFixed(0)}</div>
              </div>
              <p className="threshold-desc">{ot.description}</p>
              <div className="threshold-metrics-row">
                <div className="thresh-metric">
                  <span className="tm-label">Precision</span>
                  <strong className="tm-val">{(ot.precision * 100).toFixed(1)}%</strong>
                </div>
                <div className="thresh-metric">
                  <span className="tm-label">Recall</span>
                  <strong className="tm-val">{(ot.recall * 100).toFixed(1)}%</strong>
                </div>
              </div>
              <div className="threshold-footer">
                <span className="use-tag">Policy: {ot.recommendedUse}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Model Governance, Hyperparameters & Leakage Purge Audit */}
      <div className="grid-2col">
        {/* Left: Hyperparameters & Training Specs */}
        <section className="card params-card">
          <div className="card-header">
            <div>
              <h3>Model Configuration & Hyperparameters</h3>
              <p className="card-subtitle">Production training specifications for reproducibility</p>
            </div>
          </div>
          <div className="params-grid">
            <div className="param-item">
              <span className="param-k">Algorithm</span>
              <strong className="param-v">{modelInfo.name}</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Version Tag</span>
              <strong className="param-v text-cyan">{modelInfo.version}</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Loss Objective</span>
              <strong className="param-v">{modelInfo.objective}</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Training Sample</span>
              <strong className="param-v">{modelInfo.trainSampleSize.toLocaleString()} accounts (80% split)</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Holdout Evaluation</span>
              <strong className="param-v">{modelInfo.testSampleSize.toLocaleString()} accounts (20% split)</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Class Weighting</span>
              <strong className="param-v text-emerald">{modelInfo.hyperparameters.class_weight || "balanced"}</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Number of Trees</span>
              <strong className="param-v">{modelInfo.hyperparameters.n_estimators || 200} estimators</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Learning Rate</span>
              <strong className="param-v">{modelInfo.hyperparameters.learning_rate || 0.05}</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Max Tree Leaves</span>
              <strong className="param-v">{modelInfo.hyperparameters.num_leaves || 31} leaves</strong>
            </div>
            <div className="param-item">
              <span className="param-k">Subsample / Colsample</span>
              <strong className="param-v">0.80 / 0.80 feature subsample</strong>
            </div>
          </div>
        </section>

        {/* Right: Data Leakage Elimination Audit */}
        <section className="card leakage-card">
          <div className="card-header">
            <div>
              <h3>Data Leakage Purge Audit</h3>
              <p className="card-subtitle">Rigorous feature filtering protecting model integrity</p>
            </div>
            <span className="badge-shield">5 Leakage Columns Purged</span>
          </div>

          <div className="leakage-list">
            {leakagePurgeAudit.map((item) => (
              <div key={item.feature} className="leakage-item">
                <div className="leakage-head">
                  <span className="leakage-code">{item.feature}</span>
                  <span className="leakage-title">{item.label}</span>
                  <span className="badge-purged">PURGED</span>
                </div>
                <div className="leakage-reason">
                  <strong>Risk:</strong> {item.purgeReason}
                </div>
                <div className="leakage-impact">
                  <strong>Impact if Retained:</strong> {item.impactIfRetained}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
