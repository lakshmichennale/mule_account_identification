"""Simulated hardware demo mode — separate from real ML pipeline."""

from __future__ import annotations

import random
import time
from typing import Any

DEMO_SCENARIOS = [
    {
        "id": "card-skimming",
        "title": "Card Skimming Attempt",
        "description": "Simulated POS terminal tamper detection",
        "riskScore": 88,
        "riskLevel": "high",
        "prediction": "fraud",
        "reasons": [
            "Magnetic stripe read anomaly detected",
            "Terminal ID mismatch with registered device",
            "Transaction velocity spike in 30-second window",
        ],
    },
    {
        "id": "atm-shimmer",
        "title": "ATM Shimmer Alert",
        "description": "Simulated ATM card reader interference",
        "riskScore": 95,
        "riskLevel": "critical",
        "prediction": "fraud",
        "reasons": [
            "Unusual card insertion pattern",
            "Hardware vibration sensor triggered",
            "Multiple failed PIN attempts before success",
        ],
    },
    {
        "id": "legitimate-chip",
        "title": "Normal Chip Transaction",
        "description": "Simulated EMV chip read — expected behavior",
        "riskScore": 12,
        "riskLevel": "low",
        "prediction": "legitimate",
        "reasons": [
            "EMV chip cryptogram verified",
            "Device fingerprint matches registered terminal",
            "Transaction within normal velocity limits",
        ],
    },
]


def get_demo_status() -> dict[str, Any]:
    return {
        "mode": "demo",
        "hardwareConnected": True,
        "deviceId": "SENTINEL-DEMO-001",
        "firmwareVersion": "2.4.1-sim",
        "scenarios": DEMO_SCENARIOS,
    }


def run_demo_scenario(scenario_id: str) -> dict[str, Any]:
    scenario = next((s for s in DEMO_SCENARIOS if s["id"] == scenario_id), None)
    if not scenario:
        return {"error": "Unknown scenario", "available": [s["id"] for s in DEMO_SCENARIOS]}

    time.sleep(0.3)
    return {
        "mode": "demo",
        "scenario": scenario,
        "hardwareResponse": {
            "status": "alert" if scenario["prediction"] == "fraud" else "ok",
            "ledColor": "red" if scenario["prediction"] == "fraud" else "green",
            "buzzer": scenario["prediction"] == "fraud",
            "timestamp": time.time(),
            "sensorReadings": {
                "temperature": round(random.uniform(22, 28), 1),
                "vibration": round(random.uniform(0.01, 0.9 if scenario["prediction"] == "fraud" else 0.1), 3),
                "signalStrength": round(random.uniform(0.7, 1.0), 2),
            },
        },
        "prediction": scenario["prediction"],
        "riskScore": scenario["riskScore"],
        "riskLevel": scenario["riskLevel"],
        "confidence": scenario["riskScore"] / 100,
        "reasons": scenario["reasons"],
    }
