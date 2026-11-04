# SENTINEL: AI-Powered Mule Account Detection & Fraud Intelligence Platform

[![Architecture](https://img.shields.io/badge/Architecture-100%25%20Software%20Based-06b6d4.svg)]()
[![ML Model](https://img.shields.io/badge/Champion%20Model-LightGBM%20v2.4.0-10b981.svg)]()
[![Validation](https://img.shields.io/badge/PR--AUC-96.07%25-3b82f6.svg)]()
[![Compliance](https://img.shields.io/badge/Regulatory-FinCEN%20SAR%20Form%20111-a855f7.svg)]()
[![Security](https://img.shields.io/badge/Auth-PBKDF2--SHA256%20%7C%20RBAC-f59e0b.svg)]()

SENTINEL is an enterprise-grade, 100% software-based Mule Account Detection and Financial Intelligence Platform designed for bank compliance teams, Anti-Money Laundering (AML) investigators, and financial crime intelligence units.

Grounded entirely in a real 116.5 MB enterprise transaction dataset (**9,082 accounts across 3,925 features**) and official data dictionaries (`Description.xlsx`), SENTINEL combines calibrated gradient boosted decision trees with deterministic AML rules, interactive force-directed network topology, an LLM-powered forensic investigation copilot, and automated FinCEN Suspicious Activity Report (SAR Form 111) filing.

---

## 🏛️ System Architecture

SENTINEL operates on a modern, 100% software architecture with **zero physical or hardware dependencies**:
- **All legacy physical simulation bridges, Arduino serial links, ESP32 connections, LEDs, and buzzers have been completely removed.**
- **Backend**: Python 3.14 + FastAPI asynchronous REST API with PyJWT bearer session management and SQLite 3 (`sentinel.db`) persistence.
- **Frontend**: Single Page Application (SPA) built with React 18, TypeScript, React Router 6, and Recharts, styled with an enterprise Dark Cyber-SOC aesthetic.
- **ML Engine**: Scikit-Learn + LightGBM v2.4.0 with automated Parquet caching for sub-5ms risk inference.
- **LLM Intelligence Layer**: Dual-mode AI Copilot supporting Google Gemini Interactions API (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), and a deterministic Local Grounded Forensic Engine for offline/air-gapped operations.

```
                      +-------------------------------------------------+
                      |              SENTINEL React SPA                 |
                      |   11 Production Pages | Cyber-SOC Dark Theme   |
                      +-----------------------+-------------------------+
                                              | HTTPS / JSON (JWT Auth)
                                              v
                      +-------------------------------------------------+
                      |          FastAPI Enterprise REST API            |
                      |   Authentication | RBAC | Triage | Governance   |
                      +---+--------------------+--------------------+---+
                          |                    |                    |
        +-----------------+                    |                    +------------------+
        v                                      v                                       v
+-----------------------+            +-----------------------+               +-------------------+
|  ML Risk Engine       |            | SQLite 3 Repository   |               | LLM Copilot       |
|  LightGBM v2.4.0      |            | (sentinel.db)         |               | Google Gemini /   |
|  96.07% PR-AUC        |            | Users | Cases | Alerts|               | OpenAI / Local    |
|  Scored Parquet Cache |            | Settings | Audit Logs |               | Grounded Engine   |
+-----------------------+            +-----------------------+               +-------------------+
        |                                                                              |
        +-----------------------------> [ Real Dataset ] <-----------------------------+
                                     compressed_data.csv
                                    9,082 rows x 3,925 cols
```

---

## 📊 Grounded Real Dataset Profile

| Metric | Grounded Specification | Forensic Context |
|---|---|---|
| **Primary Dataset** | `compressed_data.csv` (116.5 MB) | Raw bank transaction telemetry |
| **Total Rows** | 9,082 accounts | Real customer cohort with full history |
| **Total Columns** | 3,925 engineered features | Feature lookbacks across 7, 14, and 31 days |
| **Target Variable** | `F3924` (Mule Account Indicator) | `0` = Legitimate (99.11%), `1` = Mule (0.89%) |
| **Prevalence Baseline** | 0.89% (81 positive mule accounts) | Highly imbalanced financial crime distribution |
| **Parquet Acceleration** | `ml/artifacts/scored_transactions.parquet` | 42 metadata columns pre-scored (<600 KB) |
| **Data Dictionary** | `Description.xlsx` | Full semantic mapping of banking ratios & indicators |

---

## 🔬 Machine Learning Overhaul & Leakage Elimination

### 1. Data Leakage Elimination Audit
Prior legacy implementations suffered from severe artificial leakage that rendered predictions unviable in real-world deployment. The ML pipeline was rebuilt from scratch to permanently purge:
* **`F2230` (Reporting Batch Month - `MNTH`)**: Pure temporal extraction artifact (all 9,001 negative cases were extracted in Oct 2025; positive mules were extracted in Sep/Nov/Dec 2025). Tree algorithms achieved 99.8% artificial split gain on calendar month alone without learning actual laundering behaviors.
* **`F3912` (`FRAUD_SUSPECTED`)**: Direct target leakage representing a post-investigation human investigator disposition.
* **`F3913` (`OTHER_RESOLUTION`)**: Secondary post-triage disposition outcome.
* **`F3914` (`FALSE_POSITIVE`)**: Post-investigation compliance closure label.
* **`F3915` (`UNATTENDED`)**: Operational triage backlog queue marker.

### 2. Algorithmic Benchmarking Suite
Evaluated on identical 20% stratified holdout test sets (1,817 accounts: 1,801 legitimate, 16 actual mules):

| Model Algorithm | Role / Status | PR-AUC | ROC-AUC | Precision | Recall | F1-Score | False Positives | False Negatives |
|---|---|---|---|---|---|---|---|---|
| **LightGBM v2.4.0** | **Champion (Active Engine)** | **96.07%** | **99.96%** | **92.86%** | **81.25%** | **86.67%** | **1** | **3** |
| **XGBoost Classifier** | Challenger | 95.17% | 99.95% | 92.31% | 75.00% | 82.76% | 1 | 4 |
| **Random Forest** | Baseline | 78.11% | 99.08% | 64.71% | 68.75% | 66.67% | 6 | 5 |
| **Logistic Regression** | Baseline | 4.33% | 88.87% | 5.58% | 93.75% | 10.53% | 254 | 1 |
| **Isolation Forest** | Deprecated | 0.54% | 20.43% | 0.00% | 0.00% | 0.00% | 19 | 16 |

### 3. Production LightGBM Confusion Matrix
* **True Negatives (TN)**: 1,800 accounts (99.94% Specificity)
* **False Positives (FP)**: 1 account (**0.055% False Positive Rate** — minimal analyst alert fatigue)
* **False Negatives (FN)**: 3 accounts (18.75% False Negative Rate)
* **True Positives (TP)**: 13 accounts (**81.25% Recall** at default 0.50 threshold)
* **Overall Test Accuracy**: **99.78%**

---

## 🤖 AI Fraud Investigation Copilot

SENTINEL features an integrated, RAG-grounded natural-language investigation assistant:
* **Retrieval-Augmented Grounding (RAG)**: Extracts account IDs (`ACC-***XXXX`), syndicate identifiers (`SYND-01`), and case docket numbers from inquiries, retrieving real account dossiers, AML indicators, and network links.
* **Data Minimization**: Automatically masks sensitive account numbers and customer identifiers before reasoning.
* **FinCEN SAR Narrative Co-Pilot**: One-click generation of **FinCEN Form 111 Section V** narrative reports ready for law enforcement submission.
* **Syndicate & Topology Analysis**: Deconstructs criminal laundering networks, funnel accounts, and cash-out nodes.
* **Dual Operation**:
  - **Cloud LLM**: Configurable via `GEMINI_API_KEY` (Google Gemini 1.5 Flash) or `OPENAI_API_KEY` (GPT-4o Mini).
  - **Local Grounded Engine**: Instant, deterministic forensic reasoning when no external API key is provided.
* **Case Docket Promotion**: Allows analysts to attach Copilot findings directly to persistent case files.

---

## 🖥️ Platform Tour: 11 Integrated Application Pages

| # | Route | Page Title | Core Capabilities |
|---|---|---|---|
| **1** | `/login` | **Authentication & Access** | PBKDF2-HMAC-SHA256 password hashing (600,000 iterations), JWT sessions, show/hide password, forgot-password modal, credential helper chips. |
| **2** | `/` | **Executive Main Dashboard** | 5 KPI metrics, Recharts risk tier donut, monthly volume area trends, LightGBM confusion matrix card, real-time alert feed, active cases, modal dossiers. |
| **3** | `/accounts` | **Account Risk Analysis** | Master-Detail layout, instant account search, risk tier filters, 8 AML indicator breach cards, XAI feature attribution bars, transaction activity logs, linked case dockets. |
| **4** | `/transactions` | **Transaction Monitoring** | 5 interactive KPI pills (Blocked, Flagged, Under Review, Settled), counterparty routing tags (`SND-***XXXX` → `RCV-***XXXX`), forensic ledger table, slide-out drawer, case promotion modal. |
| **5** | `/network` | **Fraud Network Visualization** | High-performance 60fps HTML5 force-directed canvas (105 nodes, 111 links), mouse wheel zoom, pan, node dragging/pinning, search spotlighting, syndicate selector (`SYND-01` to `SYND-05`), case escalation modal. |
| **6** | `/alerts` | **Alert Management & SOC Triage** | 6 KPI pills, forensic triage toolbar, floating batch actions bar ("Acknowledge Selected", "Assign & Review", "Dismiss"), slide-out drawer, FinCEN SAR escalation modal. |
| **7** | `/cases` | **Investigation & FinCEN Case Management** | Case docket search, 6 KPI pills, cases data table, slide-out drawer, FinCEN SAR Form 111 regulatory report modal with 1-click Copy and Download `.txt`, manual case docket creation modal. |
| **8** | `/model-analytics` | **Model Analytics & ML Governance** | PR & ROC curves with cutoff score tooltips, holdout confusion matrix, algorithm benchmark comparison table, top 20 global feature importances with domain descriptions, 5-point data leakage audit card. |
| **9** | `/copilot` | **AI Investigation Copilot** | RAG-grounded conversational investigator, markdown renderer, suggested follow-up chips, pinned subject inspector bar, "Copy Response" and "Promote to Case Docket" actions, provider config modal. |
| **10** | `/settings` | **Platform Settings & Security Center** | 5-tab console: Profile & identity, cryptographic password change, AML risk threshold sliders & visual spectrum, workspace preferences, immutable security audit logs table, system diagnostics. |
| **11** | `/users` | **User Directory & RBAC Administration** | Supervisory user management (restricted to `ADMIN`), user provisioning modal, role assignment (`ADMIN` vs `FRAUD_ANALYST`), account activation toggles, administrative password reset modal. |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: Version 3.10 to 3.14
- **Node.js**: Version 18 or higher (with `npm`)

### 2. Environment Setup & Model Artifacts

```bash
# Clone or navigate to the repository
cd C:\Users\laksh\OneDrive\Attachments\Desktop\project

# Create and activate Python virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows

# Install Python dependencies
pip install -r backend/requirements.txt
pip install -r ml/requirements.txt
```

*(Optional)* Retrain and evaluate ML models from raw dataset:
```bash
python -m ml.training.train
python -m ml.evaluation.evaluate
```

*(Optional)* Configure LLM Provider in `.env`:
```bash
cp .env.example .env
# Edit .env to add your GEMINI_API_KEY or OPENAI_API_KEY
```

### 3. Launch Backend API

```bash
# Start FastAPI backend server on port 8000
python -m uvicorn backend.main:app --reload --port 8000
```
*API Swagger Documentation is available at: [http://localhost:8000/docs](http://localhost:8000/docs)*

### 4. Launch Frontend SPA

```bash
cd frontend
npm install
npm run dev
```
*Open your browser and navigate to: **[http://localhost:5173](http://localhost:5173)***

---

## 🔑 Default Authorized Credentials

| User Account | Email | Password | Role / Authority |
|---|---|---|---|
| **System Administrator** | `admin@sentinel.bank` | `Admin@Sentinel2026!` | `ADMIN` (Full System, RBAC, Settings & Governance) |
| **Lead Fraud Analyst** | `analyst@sentinel.bank` | `Analyst@Sentinel2026!` | `FRAUD_ANALYST` (Triage, Alerts, Cases, FinCEN SARs) |

---

## 🧪 Comprehensive Regression Testing

SENTINEL includes an end-to-end regression test suite verifying all 11 pages, authentication, RBAC boundaries, and data pipelines:

```bash
# Run comprehensive test suite across Pages 1-11
python scratch/test_regression.py
```

Expected output:
```
[PASS] Page 1: Auth OK
[PASS] Page 2: Dashboard stats OK (Total 9082, Critical 79, High 1009)
[PASS] Page 3: Account Analysis OK (Found ACC-***9481, Score 99)
[PASS] Page 4: Transaction Monitoring OK (Found #9061, Amount $978,386, Status BLOCKED)
[PASS] Page 5: Fraud Network OK (Nodes 105, Edges 111, Rings 5)
[PASS] Page 6: Alert Management OK (Total 45, First ALT-2026-1025, Status UNDER_REVIEW)
[PASS] Page 7: Cases & SAR OK (Total 9, First CASE-2026-0898, SAR Generated SAR-FINCEN-2026-0898)
[PASS] Page 8: Model Analytics OK (Champion v2.4.0 — Leakage-Free Calibration, PR-AUC 96.07%, Benchmarks 5, Top Features 20)
[PASS] Page 9: AI Copilot OK (Provider local_grounded, Account Grounded ACC-***9481 Score 99, Promoted to CASE-2026-0898)
[PASS] Page 10: Settings & Security OK (User admin@sentinel.bank, Thresholds Critical>=90, Audit Logs Total 50, Diagnostics HEALTHY)
[PASS] Page 11: User Management & RBAC OK (Total Users 3, Active Admins 1, Non-Admin RBAC Block Status 403)

=======================================================
>>> ALL REGRESSION CHECKS PASSED FOR ALL 11 PAGES! <<<
=======================================================
```

---

## 🛡️ Data Privacy & Compliance Guarantee

* **No Plaintext Passwords**: Passwords hashed with PBKDF2-HMAC-SHA256 (600,000 iterations).
* **Zero PII Exposure**: All bank account numbers, names, and phone numbers are masked (`ACC-***XXXX`).
* **Cryptographic Session Control**: HMAC-SHA256 signed JWT tokens with 12-hour expiration.
* **Audit Logging**: Every authentication event, alert triage, case promotion, threshold adjustment, and credential change is recorded with an immutable timestamp, user email, and IP address.
* **FinCEN Regulatory Readiness**: Automated Section V SAR narratives aligned with BSA/AML federal compliance reporting standards.

---

## 📄 License & Attribution

Designed and transformed for enterprise anti-money laundering and mule account detection.
Built 100% software-based with Google DeepMind Antigravity engineering standards.
