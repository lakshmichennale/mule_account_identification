const API = "/api";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export interface DashboardStats {
  mode: string;
  totalTransactions: number;
  fraudulentTransactions: number;
  legitimateTransactions: number;
  fraudPercentage: number;
  averageTransactionAmount: number;
  uniqueAccounts: number;
  riskDistribution: Record<string, number>;
  fraudTrends: { month: string; transactions: number; fraud: number; fraudRate: number }[];
  highestRiskTransactions: Transaction[];
  highRiskAccounts: HighRiskAccount[];
}

export interface Transaction {
  transactionId: number;
  accountId: string;
  rawAccountId: number;
  date: string;
  amount: number;
  transactionType: string;
  accountType: string;
  occupation: string;
  merchantCategory: string;
  riskScore: number;
  riskLevel: string;
  prediction: string;
  actualLabel: number;
  reportingMonth: string;
}

export interface HighRiskAccount {
  accountId: string;
  rawAccountId: number;
  transactionCount: number;
  avgRiskScore: number;
  maxRiskScore: number;
  fraudCount: number;
  totalAmount: number;
}

export interface TransactionDetail extends Transaction {
  customerAge?: number;
  activityWindow?: string;
  balanceAmount?: number;
  behaviorCounts?: { count1: number; count2: number; count3: number };
  confidence?: number;
  reasons?: string[];
}

export interface PredictResult {
  mode: string;
  prediction: string;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  reasons: string[];
}

export interface NetworkGraph {
  mode: string;
  nodes: NetworkNode[];
  edges: { source: string; target: string; weight: number; type: string }[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    note: string;
    highDegreeAccounts: NetworkNode[];
    suspiciousClusters: NetworkNode[];
  };
}

export interface NetworkNode {
  id: string;
  label: string;
  transactionCount: number;
  totalAmount: number;
  avgRiskScore: number;
  fraudCount: number;
  suspicious: boolean;
  size: number;
}

export const getDashboardStats = () => fetchJson<DashboardStats>("/dashboard/stats");
export const getTransactions = (params: URLSearchParams) =>
  fetchJson<{ total: number; page: number; pageSize: number; totalPages: number; transactions: Transaction[] }>(
    `/transactions?${params}`
  );
export const getTransactionDetail = (id: number) => fetchJson<TransactionDetail>(`/transactions/${id}`);
export const getNetworkGraph = () => fetchJson<NetworkGraph>("/network/graph");
export const getMode = () => fetchJson<{ mode: string; dataset: Record<string, unknown>; limitations: string[] }>("/mode");
export const predictTransaction = (rowIndex: number) =>
  fetchJson<PredictResult>("/ml/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowIndex }),
  });
export const getDemoStatus = () => fetchJson<{ mode: string; scenarios: { id: string; title: string; description: string }[] }>("/demo/status");
export const runDemoScenario = (id: string) =>
  fetchJson<PredictResult & { hardwareResponse: Record<string, unknown> }>(`/demo/scenario/${id}`, { method: "POST" });
