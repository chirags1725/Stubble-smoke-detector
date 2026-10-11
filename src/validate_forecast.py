"""Validate the latest saved forecast in DynamoDB Local."""
import json
import math
import os
import sys
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src", "forecast"))

from db import get_latest_forecast

QUANTILES = {
    "24h": ("24h_q10", "24h_q50", "24h_q90"),
    "48h": ("48h_q10", "48h_q50", "48h_q90"),
}


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def main():
    forecast = get_latest_forecast()
    if not forecast:
        print("FAIL: no latest forecast found in DynamoDB Local.")
        sys.exit(1)

    errors = []
    print("Latest saved forecast")
    print(json.dumps(forecast, indent=2, default=str))

    for horizon, keys in QUANTILES.items():
        values = [number(forecast.get(key)) for key in keys]
        if any(value is None for value in values):
            errors.append(f"{horizon}: missing or invalid quantile: {keys}")
        elif not values[0] <= values[1] <= values[2]:
            errors.append(f"{horizon}: quantiles are not ordered: {values}")

    for field in ("generated_at", "feature_time", "forecast_source"):
        if not forecast.get(field):
            errors.append(f"missing metadata: {field}")

    if errors:
        print("\nVALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        sys.exit(1)

    print("\nPASS: six finite quantile outputs are present and ordered.")
    print("PASS: forecast metadata is present.")


if __name__ == "__main__":
    main()
