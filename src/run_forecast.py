"""Generate a Delhi forecast with the bundled LightGBM models."""
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parent
ROOT = SOURCE_ROOT.parent if SOURCE_ROOT.name == "src" else SOURCE_ROOT
sys.path.insert(0, str(SOURCE_ROOT))
sys.path.insert(0, str(SOURCE_ROOT / "forecast"))

from fetch_data import fetch_firms, fetch_weather_live, fetch_cams_pm25
from features import FEATURES, build_feature_table
from forecast.predict import predict_quantiles
from forecast.db import save_latest_forecast
from forecast.alert import maybe_publish_high_pollution_alert


def load_local_env():
    """Read .env for local runs; deployed Lambda settings always take precedence."""
    path = ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

def risk_level(pm25):
    if pm25 <= 30:
        return "Good"
    if pm25 <= 60:
        return "Satisfactory"
    if pm25 <= 90:
        return "Moderate"
    if pm25 <= 120:
        return "Poor"
    if pm25 <= 250:
        return "Very Poor"
    return "Severe"

def main():
    firms_key = '6c41fe135bbbdeb3b225781b921921e2'
    if not firms_key:
        raise RuntimeError(
            "FIRMS_KEY is missing. Set it in your local environment before running."
        )

    print("Fetching recent fire detections...")
    # Use the current sensors and the latest five-day NRT window. Suomi-NPP
    # product delivery is scheduled to cease in Nov 2026, so do not depend on it.
    fire_frames = [
        fetch_firms(firms_key, start=None, days=5, source=source)
        for source in ("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT")
    ]
    fires = pd.concat(fire_frames, ignore_index=True).drop_duplicates() if fire_frames else pd.DataFrame()


    print("Fetching weather and PM2.5...")
    wx = fetch_weather_live(past_days=3, forecast_days=3)
    pm = fetch_cams_pm25(past_days=3, forecast_days=3)

    # Use regular 3-hourly UTC timestamps for the model.
    times = wx.index.floor("3h").unique().sort_values()
    times = times[(times >= wx.index.min()) & (times <= wx.index.max())]

    features = build_feature_table(
        fires=fires,
        wx=wx,
        pm=pm,
        times=times,
        with_targets=False,
    )

    # Require all inputs except model-tolerated NaNs to be present.
    usable = features.dropna(subset=FEATURES)
    if usable.empty:
        raise RuntimeError(
            "No complete feature row is available. Check weather/PM2.5 coverage."
        )

    latest_time = usable.index[-1]
    row = usable.loc[latest_time, FEATURES].to_dict()

    print(f"Running models for feature time {latest_time}...")
    predictions = predict_quantiles(row)

    forecast = {
        "city": "Delhi",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "feature_time": latest_time.isoformat(),
        "pm25_now": float(row["pm_now"]),
        "level_24h": risk_level(predictions["24h_q50"]),
        "level_48h": risk_level(predictions["48h_q50"]),
        "forecast_source": "LightGBM quantile models; CAMS PM2.5 baseline",
    }

    # Preserve the predictor's six quantile outputs in the saved record.
    for name, value in predictions.items():
        forecast[name] = float(value)

    saved = save_latest_forecast(forecast)
    print("Forecast saved to DynamoDB.")
    print({k: v for k, v in saved.items() if k not in ("pk", "sk")})
    try:
        outcome = maybe_publish_high_pollution_alert(saved)
        print(f"Pollution alert status: {outcome}")
    except Exception as exc:
        # Keep the forecast available even if the secondary notification service
        # is temporarily unavailable. CloudWatch/local runner logs record details.
        print(f"SNS alert publish failed: {exc}")


if __name__ == "__main__":
    load_local_env()
    main()



def lambda_handler(event, context):
    """AWS Lambda entry point for scheduled forecast generation."""
    import json
    import os
    import boto3

    secret_arn = os.environ.get("FIRMS_KEY_SECRET_ARN")

    if secret_arn:
        secrets = boto3.client("secretsmanager")
        secret = secrets.get_secret_value(SecretId=secret_arn)
        os.environ["FIRMS_KEY"] = secret["SecretString"]

    try:
        main()
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Forecast generated and saved successfully."
            }),
        }
    except Exception as exc:
        print(f"Forecast generation failed: {exc}")
        raise
