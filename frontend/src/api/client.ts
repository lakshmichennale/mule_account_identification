const API = "/api";

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "FRAUD_ANALYST";
  isActive: boolean;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

// Token storage helpers
const TOKEN_KEY = "sentinel_auth_token";
const USER_KEY = "sentinel_user_profile";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});

  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    clearAuthSession();
    // Dispatch custom event for reactive route protection
    window.dispatchEvent(new CustomEvent("sentinel:unauthorized"));
    const err = await res.json().catch(() => ({ detail: "Session expired" }));
    throw new Error(err.detail || "Authentication required");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

// Authentication API calls
export async function loginApi(email: string, password: string): Promise<AuthSession> {
  const session = await fetchJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthSession(session);
  return session;
}

export async function getMeApi(): Promise<{ user: User }> {
  return fetchJson<{ user: User }>("/auth/me");
}

export async function logoutApi(): Promise<{ status: string }> {
  try {
    await fetchJson("/auth/logout", { method: "POST" });
  } finally {
    clearAuthSession();
  }
  return { status: "ok" };
}

export async function forgotPasswordApi(email: string): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// -------------------------------------------------------------
// Analytics & Transaction Interfaces
// -------------------------------------------------------------
export interface AlertItem {
  id?: number;
  alertId: string;
  accountId: string;
  rawAccountId: number;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  riskScore: number;
  riskLevel?: string;
  occupation: string;
  productName: string;
  detectionDate?: string;
  status: "NEW" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "ESCALATED" | "DISMISSED";
  assignedAnalyst: string;
  triggerReason: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertSummaryStats {
  grandTotal: number;
  new: number;
  acknowledged: number;
  underReview: number;
  escalated: number;
  dismissed: number;
  critical: number;
  high: number;
}

export interface AlertListResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  alerts: AlertItem[];
  summary: AlertSummaryStats;
}

export interface CaseSummaryStats {
  grandTotal: number;
  open: number;
  underInvestigation: number;
  sarReady: number;
  escalated: number;
  closedResolved: number;
  critical: number;
  high: number;
}

export interface CaseListResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  cases: InvestigationItem[];
  summary: CaseSummaryStats;
}

export interface SarReportResponse {
  caseNumber: string;
  sarReference: string;
  accountId: string;
  filingDate: string;
  riskScore: number;
  priority: string;
  assignedAnalyst: string;
  reportText: string;
}

export interface InvestigationItem {
  id: number;
  caseNumber: string;
  accountId: string;
  rawAccountId: number;
  title: string;
  riskScore: number;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "UNDER_INVESTIGATION" | "SAR_READY" | "ESCALATED" | "CLOSED_RESOLVED";
  assignedAnalyst: string;
  alertTrigger?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPerformanceSummary {
  algorithm: string;
  bestModelKey: string;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  prAuc: number;
  confusionMatrix: number[][];
  trainSize: number;
  testSize: number;
  evaluationStatus: string;
}

export interface DashboardStats {
  mode: string;
  totalAccounts: number;
  highRiskAccounts: number;
  criticalRiskAccounts: number;
  mediumRiskAccounts: number;
  lowRiskAccounts: number;
  suspiciousCount: number;
  fraudulentAccounts: number;
  legitimateAccounts: number;
  fraudPercentage: number;
  riskDistribution: Record<string, number>;
  fraudTrends: { month: string; transactions: number; fraud: number; fraudRate: number; avgRisk?: number }[];
  recentAlerts: AlertItem[];
  recentInvestigations: InvestigationItem[];
  modelPerformanceSummary: ModelPerformanceSummary;
  highestRiskAccounts: Transaction[];
}

export interface Transaction {
  transactionId: number;
  accountId: string;
  rawAccountId: number;
  senderId?: string;
  receiverId?: string;
  date: string;
  timestamp?: string;
  amount: number;
  transactionType: string;
  accountType: string;
  occupation: string;
  merchantCategory?: string;
  status?: "BLOCKED" | "FLAGGED" | "UNDER_REVIEW" | "SETTLED" | string;
  riskScore: number;
  riskLevel: string;
  prediction: string;
  actualLabel: number;
  reportingMonth?: string;
  riskIndicators?: string[];
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

export interface DetailedIndicator {
  name: string;
  active: boolean;
  severity: string;
  description: string;
}

export interface TransactionDetail extends Transaction {
  customerAge?: number;
  activityWindow?: string;
  balanceAmount?: number;
  behaviorCounts?: { count1: number; count2: number; count3: number };
  confidence?: number;
  vintageBucket?: string;
  detailedIndicators?: DetailedIndicator[];
  reasons?: string[];
}

export interface PromoteCasePayload {
  accountId: string;
  rawAccountId?: number;
  title: string;
  riskScore: number;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  alertTrigger?: string;
  notes?: string;
}

export async function promoteToCaseApi(payload: PromoteCasePayload): Promise<InvestigationItem> {
  return fetchJson<InvestigationItem>("/cases/promote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PredictResult {
  mode: string;
  prediction: string;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  reasons: string[];
}

export interface SyndicateRing {
  id: string;
  name: string;
  anchorAccountId: string;
  memberCount: number;
  totalVolume: number;
  avgRiskScore: number;
  primaryModusOperandi: string;
  riskTier: "CRITICAL" | "HIGH" | "MEDIUM";
  nodeIds: string[];
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
  amount?: number;
  flowDirection?: string;
}

export interface NetworkNeighbor {
  id: string;
  label: string;
  relationship: string;
  amount: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  rawAccountId?: number;
  role: "MULE_HERDER" | "LAYERING_HUB" | "CASH_OUT" | "FUNNEL_MULE" | "NORMAL_PEER";
  transactionCount: number;
  totalAmount: number;
  avgRiskScore: number;
  fraudCount: number;
  suspicious: boolean;
  size: number;
  occupation: string;
  syndicateRing?: string;
  indicators?: string[];
  connectedNeighbors?: NetworkNeighbor[];
}

export interface NetworkGraph {
  mode: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  syndicateRings: SyndicateRing[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    connectedComponentsEstimate: number;
    suspiciousClusterCount?: number;
    centralHubDegree?: number;
    note: string;
    highDegreeAccounts: NetworkNode[];
    suspiciousClusters: NetworkNode[];
  };
}

export const getDashboardStats = () => fetchJson<DashboardStats>("/dashboard/stats");
export const getAlertsApi = (params: URLSearchParams) =>
  fetchJson<AlertListResponse>(`/alerts?${params}`);
export const getAlertDetailApi = (alertId: string) =>
  fetchJson<AlertItem>(`/alerts/${alertId}`);
export const updateAlertApi = (
  alertId: string,
  payload: { status?: string; assignedAnalyst?: string; notes?: string }
) =>
  fetchJson<AlertItem>(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const batchUpdateAlertsApi = (alertIds: string[], status: string) =>
  fetchJson<{ status: string; updatedCount: number }>("/alerts/batch", {
    method: "POST",
    body: JSON.stringify({ alertIds, status }),
  });
export const getCasesApi = (params: URLSearchParams) =>
  fetchJson<CaseListResponse>(`/cases?${params}`);
export const getCaseDetailApi = (caseNumber: string) =>
  fetchJson<InvestigationItem>(`/cases/${caseNumber}`);
export const updateCaseApi = (
  caseNumber: string,
  payload: { status?: string; priority?: string; assignedAnalyst?: string; notes?: string }
) =>
  fetchJson<InvestigationItem>(`/cases/${caseNumber}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const getCaseSarReportApi = (caseNumber: string) =>
  fetchJson<SarReportResponse>(`/cases/${caseNumber}/sar-report`);
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
    body: JSON.stringify({ rowIndex }),
  });


// -------------------------------------------------------------
// Account Risk Analysis Interfaces
// -------------------------------------------------------------
export interface AccountSummary {
  accountId: string;
  rawAccountId: number;
  productName: string;
  occupation: string;
  areaCategory: string;
  customerAge?: number;
  vintageBucket: string;
  riskScore: number;
  riskLevel: string;
  prediction: string;
  actualLabel: number;
  detectionDate: string;
}

export interface RiskIndicator {
  name: string;
  active: boolean;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  importanceWeight: number;
  accountValue: number;
  impact: "INCREASES_RISK" | "DECREASES_RISK";
}

export interface AccountRiskDossier {
  identification: {
    accountId: string;
    rawAccountId: number;
    productName: string;
    occupation: string;
    areaCategory: string;
    customerAge?: number;
    vintageBucket: string;
    tenureMonths: number;
    accountOpenDate: string;
    gender: string;
    segmentationClass: string;
  };
  riskAssessment: {
    riskScore: number;
    riskLevel: string;
    prediction: string;
    fraudProbability: number;
    confidence: number;
    actualLabel: number;
    incidentScore: number;
  };
  importantIndicators: RiskIndicator[];
  featureContributions: FeatureContribution[];
  financialSummary: {
    total31dAmount: number;
    credit31dAmount: number;
    totalDebitCount: number;
    average14dBalance: number;
  };
  activityLog: {
    id: string;
    type: string;
    amount: number;
    date: string;
    status: string;
    riskFlag: boolean;
  }[];
  investigationHistory: {
    caseNumber: string;
    title: string;
    riskScore: number;
    priority: string;
    status: string;
    assignedAnalyst: string;
    alertTrigger?: string;
    createdAt: string;
    notes?: string;
  }[];
}

export const getAccounts = (params: URLSearchParams) =>
  fetchJson<{ total: number; page: number; pageSize: number; totalPages: number; accounts: AccountSummary[] }>(
    `/accounts?${params}`
  );

export const getAccountDossier = (accountId: string | number) =>
  fetchJson<AccountRiskDossier>(`/accounts/${accountId}`);

// ---------------------------------------------------------
// ML Model Governance & Analytics Interfaces
// ---------------------------------------------------------
export interface ModelInfo {
  name: string;
  version: string;
  status: string;
  lastTrained: string;
  framework: string;
  numFeatures: number;
  trainSampleSize: number;
  testSampleSize: number;
  fraudRatio: number;
  objective: string;
  hyperparameters: Record<string, any>;
  dataLeakageAudited: boolean;
}

export interface ModelMetrics {
  rocAuc: number;
  prAuc: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
}

export interface ConfusionMatrixData {
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  totalTested: number;
  totalActualMules: number;
  totalActualLegitimate: number;
}

export interface AlgorithmBenchmark {
  algorithm: string;
  name: string;
  prAuc: number;
  rocAuc: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositives: number;
  falseNegatives: number;
  status: "Champion" | "Challenger" | "Baseline" | "Deprecated";
  isProduction: boolean;
  notes: string;
}

export interface TopFeatureImportance {
  rank: number;
  feature: string;
  importance: number;
  relativeWeight: number;
  label: string;
  category: string;
  description: string;
}

export interface CurvePoint {
  x: number;
  y: number;
  threshold?: number;
}

export interface ModelCurves {
  roc_curve: CurvePoint[];
  pr_curve: CurvePoint[];
}

export interface LeakagePurgeItem {
  feature: string;
  label: string;
  purgeReason: string;
  impactIfRetained: string;
}

export interface OperatingThreshold {
  name: string;
  threshold: number;
  description: string;
  precision: number;
  recall: number;
  recommendedUse: string;
}

export interface ModelAnalyticsData {
  modelInfo: ModelInfo;
  championMetrics: ModelMetrics;
  confusionMatrix: ConfusionMatrixData;
  benchmarks: AlgorithmBenchmark[];
  topFeatures: TopFeatureImportance[];
  curves: Record<string, ModelCurves>;
  leakagePurgeAudit: LeakagePurgeItem[];
  operatingThresholds: OperatingThreshold[];
}

export const getModelAnalytics = () => fetchJson<ModelAnalyticsData>("/model/analytics");

// ---------------------------------------------------------
// LLM Investigation Assistant (Copilot) Interfaces
// ---------------------------------------------------------
export interface CopilotConfig {
  provider: string;
  modelName: string;
  hasApiKey: boolean;
  status: string;
  features: string[];
  instructions: string;
}

export interface GroundedContextSummary {
  entityType: "account" | "syndicate" | "case";
  entityId: string;
  riskScore?: number;
  riskLevel?: string;
  mlConfidence?: number;
  activeRules?: string[];
  flowExposure?: number;
  name?: string;
  nodeCount?: number;
  totalExposure?: number;
}

export interface CopilotChatResponse {
  response: string;
  groundedContext: GroundedContextSummary | null;
  suggestedFollowUps: string[];
  provider: string;
  configured: boolean;
  providerNote: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  groundedContext?: GroundedContextSummary | null;
  suggestedFollowUps?: string[];
  provider?: string;
  timestamp: string;
}

export const getCopilotConfig = () => fetchJson<CopilotConfig>("/copilot/config");

export const sendCopilotMessage = (payload: {
  message: string;
  accountId?: string;
  caseNumber?: string;
  history?: { role: string; content: string }[];
}) =>
  fetchJson<CopilotChatResponse>("/copilot/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const promoteCopilotToCase = (payload: { caseNumber: string; content: string }) =>
  fetchJson<{ status: string; caseNumber: string; message: string }>("/copilot/promote-to-case", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------
// Profile, Settings, Thresholds & Audit Interfaces (Page 10)
// ---------------------------------------------------------
export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  role: string;
  department: string;
  organization: string;
  isActive: boolean;
  mfaEnabled: boolean;
  sessionExpiresInHours: number;
}

export interface SystemSettings {
  lowMax: number;
  medMax: number;
  highMax: number;
  criticalMin: number;
  autoHoldThreshold: number;
  autoRefreshSeconds: number;
  defaultExportFormat: string;
  requireMfaForSar: boolean;
  complianceAlertsEnabled: boolean;
}

export interface AuditLogItem {
  id: number;
  userEmail: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface AuditLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  logs: AuditLogItem[];
}

export interface SystemDiagnostics {
  status: string;
  service: string;
  version: string;
  environment: string;
  architecture: {
    type: string;
    hardwareDependencies: string;
    apiFramework: string;
    database: string;
    operatingSystem: string;
  };
  telemetry: {
    registeredUsers: number;
    auditEventsLogged: number;
    monitoredAccounts: number;
    totalTransactionsEvaluated: number;
    rawDatasetSizeMB: number;
    cachedParquetSizeKB: number;
  };
  models: {
    productionChampion: string;
    evaluationRocAuc: number;
    evaluationPrAuc: number;
    leakageStatus: string;
    inferenceSpeed: string;
  };
}

export const getUserProfile = () => fetchJson<UserProfile>("/settings/profile");

export const updateUserProfile = (payload: { fullName: string }) =>
  fetchJson<{ status: string; message: string; fullName: string }>("/settings/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const changeUserPassword = (payload: { currentPassword: string; newPassword: string }) =>
  fetchJson<{ status: string; message: string }>("/settings/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getSystemSettings = () => fetchJson<SystemSettings>("/settings/thresholds");

export const updateSystemSettings = (payload: Partial<SystemSettings>) =>
  fetchJson<SystemSettings>("/settings/thresholds", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getAuditLogs = (params: URLSearchParams) =>
  fetchJson<AuditLogsResponse>(`/settings/audit-logs?${params}`);

export const getSystemDiagnostics = () => fetchJson<SystemDiagnostics>("/settings/system-diagnostics");

// ---------------------------------------------------------
// User Management & RBAC Interfaces (Page 11)
// ---------------------------------------------------------
export interface ManagedUser {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "FRAUD_ANALYST";
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface UserManagementStats {
  totalUsers: number;
  activeAdmins: number;
  activeAnalysts: number;
  deactivatedUsers: number;
}

export interface UserManagementResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  users: ManagedUser[];
  stats: UserManagementStats;
}

export const getUsers = (params: URLSearchParams) =>
  fetchJson<UserManagementResponse>(`/users?${params}`);

export const createUser = (payload: {
  email: string;
  fullName: string;
  password: string;
  role: string;
}) =>
  fetchJson<{ status: string; message: string; user: ManagedUser }>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateUser = (
  userId: number,
  payload: { fullName?: string; role?: string; isActive?: boolean }
) =>
  fetchJson<{ status: string; message: string; user: Partial<ManagedUser> }>(
    `/users/${userId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const adminResetPassword = (userId: number, payload: { newPassword: string }) =>
  fetchJson<{ status: string; message: string }>(`/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });




