"""POST /refresh: local runner proxy or asynchronous AWS Lambda invocation."""
import json
import os

import boto3
import requests


ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _response(204, {})
    try:
        runner = os.environ.get("LOCAL_REFRESH_URL")
        if runner or os.environ.get("AWS_SAM_LOCAL") == "true":
            runner = runner or "http://host.docker.internal:3001/refresh"
            result = requests.post(runner, timeout=115)
            payload = result.json() if result.content else {}
            return _response(result.status_code, payload)

        function_name = os.environ.get("FORECAST_FUNCTION_NAME")
        if not function_name:
            raise RuntimeError("FORECAST_FUNCTION_NAME is not configured")
        client = boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
        result = client.invoke(
            FunctionName=function_name,
            InvocationType="Event",
            Payload=json.dumps({"source": "dashboard-refresh"}).encode("utf-8"),
        )
        if result.get("StatusCode") != 202:
            raise RuntimeError(f"Forecast invocation returned HTTP {result.get('StatusCode')}")
        return _response(202, {"status": "queued", "message": "Forecast refresh queued."})
    except requests.RequestException as exc:
        print(f"Local forecast runner request failed: {exc}")
        return _response(502, {"error": "local_forecast_runner_unavailable"})
    except Exception as exc:
        print(f"Could not queue forecast refresh: {exc}")
        return _response(500, {"error": "forecast_refresh_failed"})


def _response(status, payload):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(payload),
    }
