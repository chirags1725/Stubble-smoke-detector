"""Evaluate saved LightGBM models on the 2024–2025 holdout seasons."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from features import FEATURES, build_feature_table
from forecast.model_loader import load_models

TEST_YEARS = (2024, 2025)


def load_year(year):
    fires = pd.read_csv(ROOT / "data" / f"fires_{year}.csv")
    wx = pd.read_csv(ROOT / "data" / f"wx_{year}.csv", index_col=0)
    wx.index = pd.to_datetime(wx.index, utc=True)
    pm = pd.read_csv(ROOT / "data" / f"pm_{year}.csv", index_col=0).iloc[:, 0]
    pm.index = pd.to_datetime(pm.index, utc=True)

    times = pd.date_range(
        f"{year}-10-08", f"{year}-11-28", freq="3h", tz="UTC"
    )
    return build_feature_table(fires, wx, pm, times)


def main():
    tables = [load_year(y) for y in TEST_YEARS]
    test = pd.concat(tables).sort_index()
    models = load_models()

    for horizon in (24, 48):
        target = f"y{horizon}"
        needed = FEATURES + [target]
        subset = test.dropna(subset=needed)
        if subset.empty:
            print(f"+{horizon}h: no complete holdout rows; cannot evaluate")
            continue

        x = subset[FEATURES]
        actual = subset[target].to_numpy(dtype=float)
        pred = {
            q: models[f"{horizon}h_q{q}"].predict(x)
            for q in (10, 50, 90)
        }
        p10, p50, p90 = (pred[10], pred[50], pred[90])

        persistence = subset["pm_now"].to_numpy(dtype=float)
        valid = np.isfinite(persistence) & np.isfinite(actual)
        mae = np.mean(np.abs(p50 - actual))
        rmse = np.sqrt(np.mean((p50 - actual) ** 2))
        baseline_mae = np.mean(np.abs(persistence[valid] - actual[valid]))
        coverage = np.mean((actual >= p10) & (actual <= p90))

        print(f"\n=== Saved model +{horizon}h ===")
        print(f"Rows evaluated: {len(actual)}")
        print(f"Median MAE: {mae:.2f} µg/m³")
        print(f"Median RMSE: {rmse:.2f} µg/m³")
        print(f"Persistence baseline MAE: {baseline_mae:.2f} µg/m³")
        print(f"q10–q90 coverage: {coverage:.1%} (nominal target ~80%)")

        if mae < baseline_mae:
            print("Result: median model beats the persistence baseline on MAE.")
        else:
            print("Result: median model does not beat the persistence baseline on MAE.")

if __name__ == "__main__":
    main()
