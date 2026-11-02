"""SENTINEL Fraud Detection API — real dataset + demo mode."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.dataset_service import (
    get_dashboard_stats,
    get_dataset_info,
    get_transaction_detail,
    query_transactions,
)
from backend.services.demo_service import get_demo_status, run_demo_scenario
from backend.services.network_service import build_account_network
from ml.inference.predict import predict_transaction

app = FastAPI(title="SENTINEL Fraud Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    transactionData: dict[str, Any] = Field(default_factory=dict)
    rowIndex: int | None = None


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sentinel-fraud-api"}


@app.get("/api/mode")
def get_mode():
    return get_dataset_info()


@app.get("/api/dashboard/stats")
def dashboard_stats():
    return {"mode": "real_data", **get_dashboard_stats()}


@app.get("/api/transactions")
def list_transactions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=200),
    search: str | None = None,
    fraudOnly: bool | None = None,
    riskLevel: str | None = None,
    minAmount: float | None = None,
    maxAmount: float | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    sortBy: str = "risk_score",
    sortDir: str = "desc",
):
    return query_transactions(
        page=page,
        page_size=pageSize,
        search=search,
        fraud_only=fraudOnly,
        risk_level=riskLevel,
        min_amount=minAmount,
        max_amount=maxAmount,
        date_from=dateFrom,
        date_to=dateTo,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@app.get("/api/transactions/{transaction_id}")
def transaction_detail(transaction_id: int):
    detail = get_transaction_detail(transaction_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return detail


@app.get("/api/network/graph")
def network_graph():
    return {"mode": "real_data", **build_account_network()}


@app.post("/api/ml/predict")
def ml_predict(body: PredictRequest):
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


@app.get("/api/demo/status")
def demo_status():
    return get_demo_status()


@app.post("/api/demo/scenario/{scenario_id}")
def demo_scenario(scenario_id: str):
    return run_demo_scenario(scenario_id)
