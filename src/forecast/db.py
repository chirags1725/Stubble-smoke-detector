"""DynamoDB access shared by local development and the deployed Lambda worker."""
from datetime import datetime, timezone
from decimal import Decimal
import math
import os

import boto3

TABLE_NAME = os.environ.get("TABLE", "StubbleForecasts")
CITY = os.environ.get("CITY", "DEL")


def _table():
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-2")
    options = {"region_name": region}
    endpoint = os.environ.get("DDB_ENDPOINT")
    if endpoint:
        options.update(
            endpoint_url=endpoint,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "local"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "local"),
        )
    return boto3.resource("dynamodb", **options).Table(TABLE_NAME)


def convert_floats(value):
    """Convert Python floats to DynamoDB-compatible Decimal values."""
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: convert_floats(item) for key, item in value.items()}
    if isinstance(value, list):
        return [convert_floats(item) for item in value]
    return value


def save_latest_forecast(forecast):
    """Save the current snapshot and a timestamp-keyed history record."""
    table = _table()
    item = convert_floats(dict(forecast))
    generated_at = item.get("generated_at")
    if not generated_at:
        generated_at = datetime.now(timezone.utc).isoformat()
        item["generated_at"] = generated_at

    latest_item = dict(item, pk=f"LATEST#{CITY}", sk=0)
    table.put_item(Item=latest_item)

    history_item = dict(item, pk=f"HISTORY#{CITY}")
    history_item["sk"] = int(
        datetime.fromisoformat(generated_at.replace("Z", "+00:00")).timestamp() * 1000
    )
    table.put_item(Item=history_item)
    return latest_item


def get_latest_forecast():
    response = _table().get_item(Key={"pk": f"LATEST#{CITY}", "sk": 0})
    return response.get("Item")


def get_forecast_history(limit=30):
    key = boto3.dynamodb.conditions.Key
    response = _table().query(
        KeyConditionExpression=key("pk").eq(f"HISTORY#{CITY}"),
        ScanIndexForward=False,
        Limit=max(1, min(int(limit), 100)),
    )
    return response.get("Items", [])


def claim_high_alert(now, lease_until):
    """Claim one high-pollution alert on a safe→high transition.

    A short lease permits recovery if the worker dies after claiming. This avoids
    sending an email on every manual refresh while allowing later recovery.
    """
    table = _table()
    try:
        table.update_item(
            Key={"pk": f"ALERT#{CITY}", "sk": 0},
            UpdateExpression="SET high_state = :true, #status = :pending, updated_at = :now, lease_until = :lease",
            ConditionExpression=(
                "attribute_not_exists(high_state) OR high_state = :false OR "
                "(#status = :pending AND lease_until < :now)"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":true": True,
                ":false": False,
                ":pending": "PENDING",
                ":now": int(now),
                ":lease": int(lease_until),
            },
        )
        return True
    except Exception as exc:
        if exc.__class__.__name__ == "ConditionalCheckFailedException":
            return False
        raise


def record_alert_result(status, now):
    _table().update_item(
        Key={"pk": f"ALERT#{CITY}", "sk": 0},
        UpdateExpression="SET #status = :status, updated_at = :now REMOVE lease_until",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":status": status, ":now": int(now)},
    )


def reset_high_alert(now):
    _table().update_item(
        Key={"pk": f"ALERT#{CITY}", "sk": 0},
        UpdateExpression="SET high_state = :false, #status = :clear, updated_at = :now REMOVE lease_until",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":false": False, ":clear": "CLEAR", ":now": int(now)},
    )


def _dynamodb_endpoint():
    # LOCAL TESTING ONLY. Do not use this hardcoded Mac address in AWS.
    return "http://host.docker.internal:8000"
