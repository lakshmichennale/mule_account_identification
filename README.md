# SENTINEL — Fraud Detection Platform

Real ML pipeline on `compressed_data.csv` with FastAPI backend and React dashboard.

## Dataset Summary

| Property | Value |
|----------|-------|
| Format | CSV (`compressed_data.csv`) |
| Rows | 9,082 transactions |
| Columns | 3,925 (anonymized F1–F3924) |
| Target | `F3924` (0=legitimate, 1=fraud) |
| Fraud rate | 0.89% (81 fraud / 9,001 legit) |
| Accounts | 472 unique (`F3887`) |
| Duplicates | 0 full-row duplicates |

**Limitations:** No sender/receiver pairs; network graph uses account co-activity. Device telemetry absent (demo mode simulates hardware).

## Quick Start

### 1. Train models (first time)

```bash
pip install -r ml/requirements.txt
python -m ml.training.train
```

### 2. Start backend

```bash
pip install -r backend/requirements.txt
cd project
uvicorn backend.main:app --reload --port 8000
```

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## ML Pipeline

```
compressed_data.csv
  → preprocess.py (cleaning, feature engineering)
  → train.py (XGBoost, LightGBM, RF, LR, Isolation Forest)
  → predict.py (risk score 0–100, reasons)
  → Backend API → Dashboard
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Real dataset statistics |
| GET | `/api/transactions` | Paginated, filterable transaction table |
| GET | `/api/transactions/{id}` | Transaction detail + ML reasons |
| POST | `/api/ml/predict` | Fraud prediction |
| GET | `/api/network/graph` | Account co-activity network |
| GET | `/api/demo/status` | Demo hardware mode |
| POST | `/api/demo/scenario/{id}` | Run simulated scenario |

## Modes

- **Real Data Mode** — Uses actual dataset, trained XGBoost model, real predictions
- **Demo Mode** — Simulated hardware scenarios (card skimming, ATM shimmer, etc.)
