import { Routes, Route } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Network from "./pages/Network";
import Demo from "./pages/Demo";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="network" element={<Network />} />
        <Route path="demo" element={<Demo />} />
      </Route>
    </Routes>
  );
}
