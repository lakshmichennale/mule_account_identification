import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMode } from "./api/client";

export default function App() {
  const [mode, setMode] = useState<"real_data" | "demo">("real_data");

  useEffect(() => {
    getMode().then((m) => setMode(m.mode as "real_data" | "demo")).catch(() => {});
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          SENTINEL
          <span>Fraud Detection Platform</span>
        </div>
        <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end>
          Dashboard
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Transactions
        </NavLink>
        <NavLink to="/network" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Fraud Network
        </NavLink>
        <NavLink to="/demo" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Hardware Demo
        </NavLink>
        <div className={`mode-badge ${mode === "real_data" ? "real" : "demo"}`}>
          {mode === "real_data" ? "● Real Data Mode" : "● Demo Mode"}
        </div>
      </aside>
      <main className="main">
        <Outlet context={{ mode }} />
      </main>
    </div>
  );
}
