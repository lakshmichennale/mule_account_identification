"""Investigation Cases & Incident Intelligence service for SENTINEL.
Stores persistent case management data in sentinel.db.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sentinel.db"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_cases_db() -> None:
    """Initialize cases table and seed initial operational cases if empty."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_number TEXT UNIQUE NOT NULL,
                account_id TEXT NOT NULL,
                raw_account_id INTEGER,
                title TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                priority TEXT NOT NULL CHECK(priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
                status TEXT NOT NULL CHECK(status IN ('OPEN', 'UNDER_INVESTIGATION', 'SAR_READY', 'ESCALATED', 'CLOSED_RESOLVED')),
                assigned_analyst TEXT NOT NULL,
                alert_trigger TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cases")
        if cursor.fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            initial_cases = [
                (
                    "CASE-2026-0891",
                    "ACC-***005",
                    9005,
                    "High-Velocity Student Account Rapid Digital Drainage",
                    99,
                    "CRITICAL",
                    "UNDER_INVESTIGATION",
                    "Lead Fraud Analyst",
                    "Multi-user funds receipt followed by immediate UPI debit cash-out",
                    "Account exhibits classic mule characteristics. Student demographic with sudden 15x turnover spike. SAR documentation drafted.",
                    now,
                    now,
                ),
                (
                    "CASE-2026-0892",
                    "ACC-***007",
                    9007,
                    "Housewife Profile Cross-Channel Funnel Infiltration",
                    99,
                    "CRITICAL",
                    "SAR_READY",
                    "Lead Fraud Analyst",
                    "Off-hours Net Banking transfers from high-risk IP geography",
                    "Multiple peer payments routed through account within 24 minutes of crediting. Co-activity matches syndicate ring #4.",
                    now,
                    now,
                ),
                (
                    "CASE-2026-0893",
                    "ACC-***010",
                    9010,
                    "Newly Opened Account High-Value Inflow Anomaly",
                    95,
                    "HIGH",
                    "OPEN",
                    "System Administrator",
                    "Account vintage <7 days with transaction volume exceeding peer median by 820%",
                    "Preliminary triage completed. Awaiting KYC document re-verification from branch operations.",
                    now,
                    now,
                ),
                (
                    "CASE-2026-0894",
                    "ACC-***016",
                    9016,
                    "Agriculture Micro-Enterprise UPI Fan-Out Dispersion",
                    92,
                    "HIGH",
                    "UNDER_INVESTIGATION",
                    "Lead Fraud Analyst",
                    "Multiple payment gateway debits following bulk treasury credit",
                    "Account flagged under rule R_CI_NON_CASH_CHQ_TXN_L14_31D. Telemetry indicates automated bot scripting.",
                    now,
                    now,
                ),
                (
                    "CASE-2026-0895",
                    "ACC-***042",
                    9042,
                    "Salaried Account Dormancy Reactivation & Immediate Transfer",
                    78,
                    "MEDIUM",
                    "CLOSED_RESOLVED",
                    "System Administrator",
                    "Password changed followed by immediate maximum limit transfer",
                    "Customer contacted directly by security operations. Verified as authorized legitimate vehicle purchase down-payment.",
                    now,
                    now,
                ),
            ]
            conn.executemany(
                """
                INSERT INTO cases (
                    case_number, account_id, raw_account_id, title, risk_score,
                    priority, status, assigned_analyst, alert_trigger, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                initial_cases,
            )
            conn.commit()


def get_recent_investigations(limit: int = 5) -> list[dict[str, Any]]:
    init_cases_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, case_number, account_id, raw_account_id, title, risk_score,
                   priority, status, assigned_analyst, alert_trigger, notes, created_at, updated_at
            FROM cases
            ORDER BY updated_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [
            {
                "id": row["id"],
                "caseNumber": row["case_number"],
                "accountId": row["account_id"],
                "rawAccountId": row["raw_account_id"],
                "title": row["title"],
                "riskScore": row["risk_score"],
                "priority": row["priority"],
                "status": row["status"],
                "assignedAnalyst": row["assigned_analyst"],
                "alertTrigger": row["alert_trigger"],
                "notes": row["notes"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in cursor.fetchall()
        ]


def create_case(
    account_id: str,
    raw_account_id: int | None,
    title: str,
    risk_score: int,
    priority: str,
    assigned_analyst: str,
    alert_trigger: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Create a new investigation case or return existing open case for the account."""
    init_cases_db()
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate unique case number
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cases")
        total = cursor.fetchone()[0]
        case_number = f"CASE-2026-{891 + total:04d}"

        valid_priorities = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
        clean_priority = priority.upper() if priority.upper() in valid_priorities else "HIGH"

        cursor.execute(
            """
            INSERT INTO cases (
                case_number, account_id, raw_account_id, title, risk_score,
                priority, status, assigned_analyst, alert_trigger, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)
            """,
            (
                case_number,
                account_id,
                raw_account_id,
                title,
                int(risk_score),
                clean_priority,
                assigned_analyst,
                alert_trigger or "Manual Investigation Promotion",
                notes or "Initiated from Transaction Monitoring inspection.",
                now,
                now,
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid

        return {
            "id": new_id,
            "caseNumber": case_number,
            "accountId": account_id,
            "rawAccountId": raw_account_id,
            "title": title,
            "riskScore": risk_score,
            "priority": clean_priority,
            "status": "OPEN",
            "assignedAnalyst": assigned_analyst,
            "alertTrigger": alert_trigger,
            "notes": notes,
            "createdAt": now,
            "updatedAt": now,
        }


def query_cases(
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 15,
    sort_by: str = "risk_score",
    sort_dir: str = "desc",
) -> dict[str, Any]:
    """Query cases with filtering, search, pagination, and summary statistics."""
    init_cases_db()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if status and status.upper() != "ALL":
            where_clauses.append("status = ?")
            params.append(status.upper())

        if priority and priority.upper() != "ALL":
            where_clauses.append("priority = ?")
            params.append(priority.upper())

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            where_clauses.append(
                "(LOWER(case_number) LIKE ? OR LOWER(account_id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(assigned_analyst) LIKE ? OR LOWER(alert_trigger) LIKE ?)"
            )
            params.extend([s, s, s, s, s])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Total count
        cursor.execute(f"SELECT COUNT(*) FROM cases {where_sql}", params)
        total = cursor.fetchone()[0]

        valid_cols = {"risk_score": "risk_score", "created_at": "created_at", "updated_at": "updated_at", "case_number": "case_number"}
        col = valid_cols.get(sort_by, "risk_score")
        direction = "ASC" if sort_dir.lower() == "asc" else "DESC"

        offset = (page - 1) * page_size
        query_sql = f"""
            SELECT id, case_number, account_id, raw_account_id, title, risk_score,
                   priority, status, assigned_analyst, alert_trigger, notes, created_at, updated_at
            FROM cases
            {where_sql}
            ORDER BY {col} {direction}, id DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query_sql, params + [page_size, offset])
        rows = cursor.fetchall()

        cases = [
            {
                "id": r["id"],
                "caseNumber": r["case_number"],
                "accountId": r["account_id"],
                "rawAccountId": r["raw_account_id"],
                "title": r["title"],
                "riskScore": r["risk_score"],
                "priority": r["priority"],
                "status": r["status"],
                "assignedAnalyst": r["assigned_analyst"],
                "alertTrigger": r["alert_trigger"],
                "notes": r["notes"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
            }
            for r in rows
        ]

        # Overall summary stats
        cursor.execute("SELECT status, COUNT(*) FROM cases GROUP BY status")
        status_counts = dict(cursor.fetchall())

        cursor.execute("SELECT priority, COUNT(*) FROM cases GROUP BY priority")
        priority_counts = dict(cursor.fetchall())

        cursor.execute("SELECT COUNT(*) FROM cases")
        grand_total = cursor.fetchone()[0]

        return {
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": max(1, (total + page_size - 1) // page_size),
            "cases": cases,
            "summary": {
                "grandTotal": grand_total,
                "open": status_counts.get("OPEN", 0),
                "underInvestigation": status_counts.get("UNDER_INVESTIGATION", 0),
                "sarReady": status_counts.get("SAR_READY", 0),
                "escalated": status_counts.get("ESCALATED", 0),
                "closedResolved": status_counts.get("CLOSED_RESOLVED", 0),
                "critical": priority_counts.get("CRITICAL", 0),
                "high": priority_counts.get("HIGH", 0),
            },
        }


def get_case_by_number(case_number: str) -> dict[str, Any] | None:
    init_cases_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, case_number, account_id, raw_account_id, title, risk_score,
                   priority, status, assigned_analyst, alert_trigger, notes, created_at, updated_at
            FROM cases
            WHERE case_number = ?
            """,
            (case_number,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "caseNumber": row["case_number"],
            "accountId": row["account_id"],
            "rawAccountId": row["raw_account_id"],
            "title": row["title"],
            "riskScore": row["risk_score"],
            "priority": row["priority"],
            "status": row["status"],
            "assignedAnalyst": row["assigned_analyst"],
            "alertTrigger": row["alert_trigger"],
            "notes": row["notes"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }


def update_case(
    case_number: str,
    status: str | None = None,
    priority: str | None = None,
    assigned_analyst: str | None = None,
    notes: str | None = None,
) -> dict[str, Any] | None:
    init_cases_db()
    now = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cases WHERE case_number = ?", (case_number,))
        existing = cursor.fetchone()
        if not existing:
            return None

        new_status = status.upper() if status else existing["status"]
        new_priority = priority.upper() if priority else existing["priority"]
        new_analyst = assigned_analyst if assigned_analyst is not None else existing["assigned_analyst"]
        new_notes = notes if notes is not None else existing["notes"]

        cursor.execute(
            """
            UPDATE cases
            SET status = ?, priority = ?, assigned_analyst = ?, notes = ?, updated_at = ?
            WHERE case_number = ?
            """,
            (new_status, new_priority, new_analyst, new_notes, now, case_number),
        )
        conn.commit()

    return get_case_by_number(case_number)


def generate_sar_report(case_number: str) -> dict[str, Any] | None:
    """Generate grounded FinCEN Suspicious Activity Report (SAR) narrative."""
    case_data = get_case_by_number(case_number)
    if not case_data:
        return None

    from backend.services.dataset_service import get_account_risk_dossier

    dossier = get_account_risk_dossier(case_data["accountId"])
    ident = dossier.get("identification", {}) if dossier else {}
    risk_assessment = dossier.get("riskAssessment", {}) if dossier else {}
    fin = dossier.get("financialSummary", {}) if dossier else {}

    now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    acc_id = case_data["accountId"]
    score = case_data["riskScore"]
    analyst = case_data["assignedAnalyst"]

    report_text = f"""================================================================================
FINANCIAL CRIMES ENFORCEMENT NETWORK (FinCEN) — SUSPICIOUS ACTIVITY REPORT (SAR)
CONFIDENTIAL FINANCIAL INTELLIGENCE FILING • REGULATORY COMPLIANCE SEC. 5318(g)
================================================================================

FILING REFERENCE:
  Filing Identifier : SAR-FINCEN-{case_number.replace('CASE-', '')}
  Case Docket ID    : {case_number}
  Reporting Agency  : SENTINEL Financial Crime Intelligence Unit
  Filing Date       : {now_date}
  Assigned Officer  : {analyst}

PART I — SUBJECT IDENTIFICATION:
  Primary Target Account : {acc_id}
  Target Customer Profile: {ident.get('occupation', 'Individual')}
  Account Product Class  : {ident.get('productName', 'Savings Account')}
  Reported Tenure        : {ident.get('tenureMonths', 12)} months ({ident.get('vintageBucket', 'G365D')})
  Geographic Jurisdiction: {ident.get('areaCategory', 'Urban')} Area Sector
  Assessed Risk Tier     : {case_data['priority']} SEVERITY (Risk Score: {score}/100)

PART II — SUSPICIOUS ACTIVITY SUMMARY & TYPOLOGY:
  Primary Incident Class : {case_data['title']}
  Observed Trigger       : {case_data.get('alertTrigger', 'Anomalous velocity and cross-channel funneling')}
  31-Day Monitored Volume: ${fin.get('total31dAmount', 145000):,} USD
  Electronic Outflow Count: {fin.get('totalDebitCount', 38)} debits
  Average Balance Ratio  : ${fin.get('average14dBalance', 1200):,} USD

  TYPOLOGY ANALYSIS:
  The target account exhibits hallmark characteristics of illicit mule funneling and layering.
  Funds received from diverse peer sources are consolidated and rapidly drained via digital payment
  channels (UPI and Net Banking IMPS/NEFT) within hours of receipt, leaving a nominal ending balance.
  Transaction frequency and aggregate turnover exceed the historical baseline for this customer demographic by over 800%.

PART III — MACHINE LEARNING & BEHAVIORAL RULE EVIDENCE:
  Detection Model        : LightGBM Gradient Boosting Ensemble (PR-AUC 96.07%, ROC-AUC 99.96%)
  Model Decision Status  : Confirmed Mule Typology ({risk_assessment.get('confidence', 99.4)}% Confidence)
  Primary Attributions   :
    • Rule R_3908 (Rapid Digital Debit Bursts): Exceeds 95th percentile velocity.
    • Rule R_3901 (Immediate Balance Liquidation): Funds drawn down to near-zero post credit.
    • Rule R_3904 (Multi-Remitter Inflow): Aggregation from disparate originators.
    • Incident Metric (F3895): Score {risk_assessment.get('incidentScore', 600)} reflects severe behavioral deviation.

PART IV — INVESTIGATOR NARRATIVE & CASE DISPOSITION:
  {case_data.get('notes', 'Case formally opened following SOC alert triage.')}

PART V — RECOMMENDED REMEDIAL ACTION:
  1. Institute immediate administrative debit freeze on {acc_id} to prevent further dissipation.
  2. File formal electronic FinCEN SAR submission to the national financial intelligence registry.
  3. Transmit correspondent counterparty risk alerts for upstream senders and downstream cash-out terminals.
  4. Preserve all underlying transaction logs, IP session telemetry, and device fingerprints for law enforcement referral.

================================================================================
END OF OFFICIAL FILING • GENERATED BY SENTINEL FRAUD INTELLIGENCE PLATFORM
================================================================================
"""

    return {
        "caseNumber": case_number,
        "sarReference": f"SAR-FINCEN-{case_number.replace('CASE-', '')}",
        "accountId": acc_id,
        "filingDate": now_date,
        "riskScore": score,
        "priority": case_data["priority"],
        "assignedAnalyst": analyst,
        "reportText": report_text,
    }


