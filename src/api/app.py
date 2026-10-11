"""GET /latest API handler."""
import json
import os

from db import get_table, json_default

CITY = os.environ.get("CITY", "DEL")
THRESHOLD = float(os.environ.get("ALERT_THRESHOLD_PM25", "150"))
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "").strip()


def handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}
    try:
        item = get_table().get_item(Key={"pk": f"LATEST#{CITY}", "sk": 0}).get("Item")
        if not item:
            return response(404, {"error": "no_forecast_yet"})
        q24 = _number(item.get("24h_q90"))
        q48 = _number(item.get("48h_q90"))
        item["alert"] = {
            "enabled": bool(SNS_TOPIC_ARN),
            "threshold_pm25": THRESHOLD,
            "basis": "24-hour and 48-hour q90",
            "predicted_high": any(v is not None and v >= THRESHOLD for v in (q24, q48)),
        }
        return response(200, item)
    except Exception as exc:
        print(f"Could not read latest forecast: {exc}")
        return response(500, {"error": "forecast_read_failed"})


def _number(value):
    try:
        return float(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def cors_headers():
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Cache-Control": "no-store",
    }


def response(status, payload):
    return {"statusCode": status, "headers": cors_headers(), "body": json.dumps(payload, default=json_default, ensure_ascii=False)}
