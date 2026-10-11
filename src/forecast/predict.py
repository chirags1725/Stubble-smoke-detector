import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from features import FEATURES
from forecast.model_loader import load_models


def predict_quantiles(feature_values):
    """Predict 24h/48h quantiles from one row of model features."""
    row = pd.DataFrame([feature_values], columns=FEATURES)
    models = load_models()

    predictions = {}
    for name, model in models.items():
        expected = model.feature_name()
        if expected != FEATURES:
            raise ValueError(
                f"{name} feature mismatch.\n"
                f"Model expects: {expected}\n"
                f"Code provides: {FEATURES}"
            )
        predictions[name] = float(model.predict(row)[0])

    # Prevent quantile crossing: p10 <= p50 <= p90.
    for horizon in ("24h", "48h"):
        keys = [f"{horizon}_q{q}" for q in (10, 50, 90)]
        ordered = sorted(predictions[k] for k in keys)
        for key, value in zip(keys, ordered):
            predictions[key] = value

    return predictions


if __name__ == "__main__":
    # Dummy values solely to verify model loading and prediction.
    dummy = {
        "upwind_now": 0.0,
        "upwind_24h": 0.0,
        "upwind_48h": 0.0,
        "wind_speed": 10.0,
        "wind_sin": 0.0,
        "wind_cos": 1.0,
        "blh": 500.0,
        "rh": 60.0,
        "rain_24h": 0.0,
        "pm_now": 85.0,
        "pm_trend_24h": 0.0,
        "hour": 12,
        "day_of_season": 10,
    }

    result = predict_quantiles([dummy[name] for name in FEATURES])

    print("TEST ONLY — dummy inputs, not a real forecast")
    print("24-hour PM2.5 quantiles:", {
        "p10": result["24h_q10"],
        "p50": result["24h_q50"],
        "p90": result["24h_q90"],
    })
    print("48-hour PM2.5 quantiles:", {
        "p10": result["48h_q10"],
        "p50": result["48h_q50"],
        "p90": result["48h_q90"],
    })
