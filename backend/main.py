"""SENTINEL AI-Powered Mule Account Detection & Fraud Intelligence API."""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.alert_service import (
    batch_update_alerts,
    get_alert_by_id,
    init_alerts_db,
    query_alerts,
    update_alert,
)
from backend.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    init_auth_db,
    log_audit_event,
    require_role,
)
from backend.services.case_service import (
    create_case,
    generate_sar_report,
    get_case_by_number,
    init_cases_db,
    query_cases,
    update_case,
)
from backend.services.dataset_service import (
    get_account_risk_dossier,
    get_dashboard_stats,
    get_dataset_info,
    get_transaction_detail,
    query_accounts,
    query_transactions,
)
from backend.services.network_service import build_account_network
from backend.services.model_service import get_model_analytics_data
from backend.services.llm_service import (
    get_llm_configuration,
    process_copilot_chat,
    promote_copilot_to_case,
)
from backend.services.settings_service import (
    init_settings_db,
    get_system_settings,
    update_system_settings,
    update_user_profile,
    change_user_password,
    query_audit_logs,
    get_system_diagnostics,
)
from backend.services.user_service import (
    create_new_user,
    query_users,
    update_existing_user,
    admin_reset_user_password,
)
from ml.inference.predict import predict_transaction


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize authentication database & default accounts
    init_auth_db()
    # Initialize cases database & default records
    init_cases_db()
    # Initialize alerts database & seed real alert records
    init_alerts_db()
    # Initialize system settings & thresholds
    init_settings_db()
    yield


app = FastAPI(
    title="SENTINEL Mule Account Detection & Fraud Intelligence API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------
class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6)


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "Bearer"
    expiresInSeconds: int
    user: dict[str, Any]


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)


class UpdateAlertRequest(BaseModel):
    status: str | None = None
    assignedAnalyst: str | None = None
    notes: str | None = None


class BatchUpdateAlertsRequest(BaseModel):
    alertIds: list[str] = Field(min_length=1)
    status: str


class PromoteCaseRequest(BaseModel):
    accountId: str
    rawAccountId: int | None = None
    title: str = Field(min_length=3, max_length=200)
    riskScore: int = Field(ge=0, le=100)
    priority: str = Field(default="HIGH")
    alertTrigger: str | None = None
    notes: str | None = None


class UpdateCaseRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    assignedAnalyst: str | None = None
    notes: str | None = None


class PredictRequest(BaseModel):
    transactionData: dict[str, Any] = Field(default_factory=dict)
    rowIndex: int | None = None


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1)
    accountId: str | None = None
    caseNumber: str | None = None
    history: list[dict[str, Any]] | None = None


class PromoteToCaseRequest(BaseModel):
    caseNumber: str = Field(min_length=3)
    content: str = Field(min_length=1)


class UpdateProfileRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=120)


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=6)
    newPassword: str = Field(min_length=8)


class UpdateThresholdsRequest(BaseModel):
    lowMax: int | None = None
    medMax: int | None = None
    highMax: int | None = None
    criticalMin: int | None = None
    autoHoldThreshold: int | None = None
    autoRefreshSeconds: int | None = None
    defaultExportFormat: str | None = None


class CreateUserRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    fullName: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8)
    role: str = Field(default="FRAUD_ANALYST")


class UpdateUserAdminRequest(BaseModel):
    fullName: str | None = None
    role: str | None = None
    isActive: bool | None = None


class AdminResetPasswordRequest(BaseModel):
    newPassword: str = Field(min_length=8)





# ---------------------------------------------------------
# Public Endpoints
# ---------------------------------------------------------
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "sentinel-fraud-intelligence-api",
        "version": "2.0.0",
        "architecture": "100% Software-based Enterprise Architecture",
    }


# ---------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------
@app.post("/api/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request):
    user = authenticate_user(body.email, body.password)
    if not user:
        log_audit_event(body.email, "LOGIN_FAILED", "auth", "Invalid credentials", request.client.host if request.client else "")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
        )

    token = create_access_token({"sub": str(user["id"]), "role": user["role"], "email": user["email"]})
    log_audit_event(user["email"], "LOGIN_SUCCESS", "auth", f"User logged in with role {user['role']}", request.client.host if request.client else "")

    return LoginResponse(
        accessToken=token,
        tokenType="Bearer",
        expiresInSeconds=60 * 60 * 12,
        user=user,
    )


@app.get("/api/auth/me")
def get_me(current_user: dict[str, Any] = Depends(get_current_user)):
    return {"user": current_user}


@app.post("/api/auth/logout")
def logout(current_user: dict[str, Any] = Depends(get_current_user), request: Request = None):
    log_audit_event(
        current_user["email"],
        "LOGOUT",
        "auth",
        "User logged out",
        request.client.host if request and request.client else "",
    )
    return {"status": "ok", "message": "Successfully logged out"}


@app.post("/api/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    # In a production banking environment, send an out-of-band email reset link.
    # We return an informative response confirming receipt without leaking user existence.
    return {
        "status": "ok",
        "message": f"If an account exists for {body.email}, password reset instructions have been dispatched to the designated security channel.",
    }


# ---------------------------------------------------------
# Protected Analytics & Transaction Endpoints
# ---------------------------------------------------------
@app.get("/api/mode")
def get_mode(current_user: dict[str, Any] = Depends(get_current_user)):
    return get_dataset_info()


@app.get("/api/dashboard/stats")
def dashboard_stats(current_user: dict[str, Any] = Depends(get_current_user)):
    return {"mode": "real_data", **get_dashboard_stats()}


@app.get("/api/accounts")
def list_accounts(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=200),
    search: str | None = None,
    riskLevel: str | None = None,
    occupation: str | None = None,
    sortBy: str = "risk_score",
    sortDir: str = "desc",
    current_user: dict[str, Any] = Depends(get_current_user),
):
    return query_accounts(
        page=page,
        page_size=pageSize,
        search=search,
        risk_level=riskLevel,
        occupation=occupation,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@app.get("/api/accounts/{account_id}")
def account_dossier(
    account_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    dossier = get_account_risk_dossier(account_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="Account not found in intelligence database")
    return dossier


@app.get("/api/transactions")
def list_transactions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=200),
    search: str | None = None,
    fraudOnly: bool | None = None,
    riskLevel: str | None = None,
    status: str | None = None,
    minAmount: float | None = None,
    maxAmount: float | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    sortBy: str = "risk_score",
    sortDir: str = "desc",
    current_user: dict[str, Any] = Depends(get_current_user),
):
    return query_transactions(
        page=page,
        page_size=pageSize,
        search=search,
        fraud_only=fraudOnly,
        risk_level=riskLevel,
        txn_status=status,
        min_amount=minAmount,
        max_amount=maxAmount,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@app.get("/api/transactions/{transaction_id}")
def transaction_detail(
    transaction_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    detail = get_transaction_detail(transaction_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return detail


@app.post("/api/cases/promote")
def promote_to_case(
    body: PromoteCaseRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    analyst_name = current_user.get("fullName") or current_user.get("email", "Fraud Analyst")
    case = create_case(
        account_id=body.accountId,
        raw_account_id=body.rawAccountId,
        title=body.title,
        risk_score=body.riskScore,
        priority=body.priority,
        assigned_analyst=analyst_name,
        alert_trigger=body.alertTrigger,
        notes=body.notes,
    )
    log_audit_event(
        current_user["email"],
        "CASE_CREATED",
        "case_management",
        f"Promoted account {body.accountId} to case {case['caseNumber']}",
        request.client.host if request.client else "",
    )
    return case


# ---------------------------------------------------------
# FinCEN SAR & Case Management Endpoints
# ---------------------------------------------------------
@app.get("/api/cases")
def list_cases(
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=100),
    sortBy: str = "risk_score",
    sortDir: str = "desc",
    current_user: dict[str, Any] = Depends(get_current_user),
):
    return query_cases(
        status=status,
        priority=priority,
        search=search,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@app.get("/api/cases/{case_number}")
def get_case(case_number: str, current_user: dict[str, Any] = Depends(get_current_user)):
    item = get_case_by_number(case_number)
    if not item:
        raise HTTPException(status_code=404, detail="Case record not found in investigation registry")
    return item


@app.patch("/api/cases/{case_number}")
def patch_case(
    case_number: str,
    body: UpdateCaseRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    updated = update_case(
        case_number=case_number,
        status=body.status,
        priority=body.priority,
        assigned_analyst=body.assignedAnalyst,
        notes=body.notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Case record not found")
    log_audit_event(
        current_user["email"],
        "CASE_UPDATED",
        "case_management",
        f"Updated case {case_number} (Status: {body.status or 'unchanged'})",
        request.client.host if request.client else "",
    )
    return updated


@app.get("/api/cases/{case_number}/sar-report")
def case_sar_report(case_number: str, current_user: dict[str, Any] = Depends(get_current_user)):
    sar = generate_sar_report(case_number)
    if not sar:
        raise HTTPException(status_code=404, detail="Case not found for SAR generation")
    return sar


@app.get("/api/network/graph")
def network_graph(current_user: dict[str, Any] = Depends(get_current_user)):
    return {"mode": "real_data", **build_account_network()}


# ---------------------------------------------------------
# Alert Management & SOC Incident Triage Endpoints
# ---------------------------------------------------------
@app.get("/api/alerts")
def list_alerts(
    status: str | None = None,
    severity: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=100),
    sortBy: str = "risk_score",
    sortDir: str = "desc",
    current_user: dict[str, Any] = Depends(get_current_user),
):
    return query_alerts(
        status=status,
        severity=severity,
        search=search,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str, current_user: dict[str, Any] = Depends(get_current_user)):
    item = get_alert_by_id(alert_id)
    if not item:
        raise HTTPException(status_code=404, detail="Alert not found in incident intelligence repository")
    return item


@app.patch("/api/alerts/{alert_id}")
def patch_alert(
    alert_id: str,
    body: UpdateAlertRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    updated = update_alert(
        alert_id=alert_id,
        status=body.status,
        assigned_analyst=body.assignedAnalyst,
        notes=body.notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")
    log_audit_event(
        current_user["email"],
        "ALERT_UPDATED",
        "alert_triage",
        f"Updated alert {alert_id} (Status: {body.status or 'unchanged'})",
        request.client.host if request.client else "",
    )
    return updated


@app.post("/api/alerts/batch")
def batch_patch_alerts(
    body: BatchUpdateAlertsRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    analyst_name = current_user.get("fullName") or current_user.get("email")
    count = batch_update_alerts(
        alert_ids=body.alertIds,
        status=body.status,
        assigned_analyst=analyst_name,
    )
    log_audit_event(
        current_user["email"],
        "ALERT_BATCH_UPDATE",
        "alert_triage",
        f"Batch updated {count} alerts to status {body.status}",
        request.client.host if request.client else "",
    )
    return {"status": "ok", "updatedCount": count}


@app.post("/api/ml/predict")
def ml_predict(
    body: PredictRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    try:
        if body.rowIndex is not None:
            result = predict_transaction(row_index=body.rowIndex)
        elif body.transactionData:
            result = predict_transaction(payload=body.transactionData)
        else:
            raise HTTPException(status_code=400, detail="Provide transactionData or rowIndex")
        return {"mode": "real_data", **result}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Model not trained. Run python -m ml.training.train")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------
# ML Model Governance & Analytics Endpoints
# ---------------------------------------------------------
@app.get("/api/model/analytics")
def model_analytics(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Retrieve comprehensive ML model analytics, ROC/PR curves, confusion matrix, benchmarks, and leakage audits."""
    return get_model_analytics_data()


# ---------------------------------------------------------
# LLM Investigation Assistant (Copilot) Endpoints
# ---------------------------------------------------------
@app.get("/api/copilot/config")
def copilot_config(current_user: dict[str, Any] = Depends(get_current_user)):
    """Return LLM provider status, active model, and configuration guidelines."""
    return get_llm_configuration()


@app.post("/api/copilot/chat")
def copilot_chat(
    body: CopilotChatRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Execute grounded LLM or Forensic Rule Copilot investigation inquiry."""
    return process_copilot_chat(
        message=body.message,
        account_id=body.accountId,
        case_number=body.caseNumber,
        history=body.history,
    )


@app.post("/api/copilot/promote-to-case")
def copilot_promote_to_case(
    body: PromoteToCaseRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Attach Copilot forensic reasoning to an active case investigation docket."""
    analyst_name = current_user.get("fullName") or current_user.get("email")
    result = promote_copilot_to_case(
        case_number=body.caseNumber,
        content=body.content,
        analyst_name=analyst_name,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message"))
    log_audit_event(
        current_user["email"],
        "COPILOT_PROMOTED_TO_CASE",
        "investigation_copilot",
        f"Attached Copilot intelligence note to {body.caseNumber}",
        request.client.host if request.client else "",
    )
    return result


# ---------------------------------------------------------
# Profile, Settings, Thresholds & Audit Endpoints (Page 10)
# ---------------------------------------------------------
@app.get("/api/settings/profile")
def get_user_profile_endpoint(current_user: dict[str, Any] = Depends(get_current_user)):
    """Retrieve full profile of the currently authenticated analyst."""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "fullName": current_user["fullName"],
        "role": current_user["role"],
        "department": "Special Investigations Unit & Financial Intelligence Unit (FIU)",
        "organization": "SENTINEL AML Division",
        "isActive": current_user["isActive"],
        "mfaEnabled": False,
        "sessionExpiresInHours": 12,
    }


@app.put("/api/settings/profile")
def update_profile_endpoint(
    body: UpdateProfileRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Update profile attributes for currently authenticated user."""
    return update_user_profile(
        user_id=current_user["id"],
        full_name=body.fullName,
        user_email=current_user["email"],
    )


@app.post("/api/settings/change-password")
def change_password_endpoint(
    body: ChangePasswordRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Change user password using PBKDF2-HMAC-SHA256 verification and hashing."""
    try:
        return change_user_password(
            user_id=current_user["id"],
            current_password=body.currentPassword,
            new_password=body.newPassword,
            user_email=current_user["email"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/settings/thresholds")
def get_thresholds_endpoint(current_user: dict[str, Any] = Depends(get_current_user)):
    """Retrieve active AML risk thresholds and operational settings."""
    return get_system_settings()


@app.put("/api/settings/thresholds")
def update_thresholds_endpoint(
    body: UpdateThresholdsRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Update operational risk scoring thresholds and preferences."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return update_system_settings(updates=updates, user_email=current_user["email"])


@app.get("/api/settings/audit-logs")
def get_audit_logs_endpoint(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    action: str | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Query paginated security and compliance audit event logs."""
    return query_audit_logs(page=page, page_size=pageSize, action=action)


@app.get("/api/settings/system-diagnostics")
def get_diagnostics_endpoint(current_user: dict[str, Any] = Depends(get_current_user)):
    """Retrieve platform health, memory footprint, dataset size, and model health."""
    return get_system_diagnostics()


# ---------------------------------------------------------
# Admin User Management & RBAC Endpoints (Page 11)
# ---------------------------------------------------------
@app.get("/api/users")
def list_users_endpoint(
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    current_admin: dict[str, Any] = Depends(require_role(["ADMIN"])),
):
    """List and filter users in the authentication repository. Restricted to ADMIN."""
    return query_users(
        search=search,
        role=role,
        status_filter=status,
        page=page,
        page_size=pageSize,
    )


@app.post("/api/users")
def create_user_endpoint(
    body: CreateUserRequest,
    current_admin: dict[str, Any] = Depends(require_role(["ADMIN"])),
):
    """Provision a new user account with role assignment. Restricted to ADMIN."""
    return create_new_user(
        email=body.email,
        password=body.password,
        full_name=body.fullName,
        role=body.role,
        actor_email=current_admin["email"],
    )


@app.put("/api/users/{user_id}")
def update_user_endpoint(
    user_id: int,
    body: UpdateUserAdminRequest,
    current_admin: dict[str, Any] = Depends(require_role(["ADMIN"])),
):
    """Update user attributes, role, or active status. Restricted to ADMIN."""
    return update_existing_user(
        user_id=user_id,
        full_name=body.fullName,
        role=body.role,
        is_active=body.isActive,
        actor_email=current_admin["email"],
    )


@app.post("/api/users/{user_id}/reset-password")
def admin_reset_password_endpoint(
    user_id: int,
    body: AdminResetPasswordRequest,
    current_admin: dict[str, Any] = Depends(require_role(["ADMIN"])),
):
    """Administratively reset user credentials. Restricted to ADMIN."""
    return admin_reset_user_password(
        user_id=user_id,
        new_password=body.newPassword,
        actor_email=current_admin["email"],
    )




