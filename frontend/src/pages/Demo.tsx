import { useEffect, useState } from "react";
import { getDemoStatus, runDemoScenario } from "../api/client";

interface DemoResult {
  mode: string;
  prediction: string;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  reasons: string[];
  hardwareResponse?: {
    status: string;
    ledColor: string;
    buzzer: boolean;
    sensorReadings: Record<string, number>;
  };
  scenario?: { title: string; description: string };
}

export default function DemoPage() {
  const [scenarios, setScenarios] = useState<{ id: string; title: string; description: string }[]>([]);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [loading, setLoading] = useState("");

  useEffect(() => {
    getDemoStatus().then((d) => setScenarios(d.scenarios)).catch(() => {});
  }, []);

  const run = async (id: string) => {
    setLoading(id);
    try {
      const res = await runDemoScenario(id);
      setResult(res as DemoResult);
    } finally {
      setLoading("");
    }
  };

  return (
    <>
      <h1 className="page-title">Hardware Demo Mode</h1>
      <p className="page-subtitle">
        Simulated SENTINEL hardware responses — separate from the real ML pipeline on compressed_data.csv
      </p>

      <div className="mode-badge demo" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
        ● Demo Mode — Simulated Hardware
      </div>

      <div className="demo-grid">
        {scenarios.map((s) => (
          <div key={s.id} className="card demo-card" onClick={() => run(s.id)}>
            <div className="card-title">{s.title}</div>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.5rem 0" }}>{s.description}</p>
            <button className="btn btn-primary" disabled={loading === s.id}>
              {loading === s.id ? "Running…" : "Run Scenario"}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h3>{result.scenario?.title ?? "Demo Result"}</h3>
          <div className="grid grid-4" style={{ margin: "1rem 0" }}>
            <div>
              <div className="card-title">Prediction</div>
              <div className={`card-value ${result.prediction === "fraud" ? "stat-fraud" : "stat-legit"}`}>
                {result.prediction.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="card-title">Risk Score</div>
              <div className={`card-value risk-${result.riskLevel}`}>{result.riskScore}/100</div>
            </div>
            <div>
              <div className="card-title">Risk Level</div>
              <div className={`card-value risk-${result.riskLevel}`}>{result.riskLevel.toUpperCase()}</div>
            </div>
            <div>
              <div className="card-title">Confidence</div>
              <div className="card-value">{(result.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          <h4>Risk Reasons</h4>
          <ul className="reasons-list">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          {result.hardwareResponse && (
            <div className="hardware-panel">
              <div>LED: {result.hardwareResponse.ledColor.toUpperCase()}</div>
              <div>Buzzer: {result.hardwareResponse.buzzer ? "ACTIVE" : "OFF"}</div>
              <div>Status: {result.hardwareResponse.status.toUpperCase()}</div>
              <div style={{ marginTop: "0.5rem" }}>
                Sensors: temp={result.hardwareResponse.sensorReadings.temperature}°C, vibration=
                {result.hardwareResponse.sensorReadings.vibration}, signal=
                {result.hardwareResponse.sensorReadings.signalStrength}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
