"""GET /history?limit=30 API handler."""
import json
import os

from boto3.dynamodb.conditions import Key
from db import get_table, json_default

CITY = os.environ.get("CITY", "DEL")


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    try:
        limit = int(params.get("limit", "30"))
        if not 1 <= limit <= 100:
            raise ValueError
    except (TypeError, ValueError):
        return _response(400, {"error": "limit must be an integer from 1 to 100"})
    try:
        result = get_table().query(
            KeyConditionExpression=Key("pk").eq(f"HISTORY#{CITY}"),
            ScanIndexForward=False,
            Limit=limit,
        )
        return _response(200, result.get("Items", []))
    except Exception as exc:
        print(f"Could not read forecast history: {exc}")
        return _response(500, {"error": "forecast_history_failed"})


def _response(status, payload):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(payload, default=json_default, ensure_ascii=False),
    }
