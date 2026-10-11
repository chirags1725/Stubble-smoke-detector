"""Publish one SNS email alert when the forecast crosses the configured threshold."""
from datetime import datetime, timezone
import os
import time

import boto3

from forecast.db import CITY, claim_high_alert, record_alert_result, reset_high_alert


def _number(value):
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else None
    except (TypeError, ValueError):
        return None


def maybe_publish_high_pollution_alert(forecast):
    """Alert on q90 high pollution; subsequent high refreshes do not spam email."""
    topic_arn = os.environ.get("SNS_TOPIC_ARN", "").strip()
    threshold = float(os.environ.get("ALERT_THRESHOLD_PM25", "150"))
    q24 = _number(forecast.get("24h_q90"))
    q48 = _number(forecast.get("48h_q90"))
    candidates = [("24-hour q90", q24), ("48-hour q90", q48)]
    high = [(label, value) for label, value in candidates if value is not None and value >= threshold]
    now = int(time.time())

    if not high:
        reset_high_alert(now)
        return {"enabled": bool(topic_arn), "sent": False, "reason": "below threshold", "threshold": threshold}

    if not topic_arn:
        return {"enabled": False, "sent": False, "reason": "SNS_TOPIC_ARN not configured", "threshold": threshold}

    if not claim_high_alert(now, now + 300):
        return {"enabled": True, "sent": False, "reason": "already alerted for this high episode", "threshold": threshold}

    evidence = ", ".join(f"{label}: {value:.1f} µg/m³" for label, value in high)
    city = forecast.get("city", CITY)
    generated = forecast.get("generated_at") or datetime.now(timezone.utc).isoformat()
    subject = f"High pollution forecast — {city}"
    message = (
        f"High PM2.5 pollution is forecast for {city}.\n\n"
        f"Configured alert threshold: {threshold:.1f} µg/m³\n"
        f"Forecast: {evidence}\n"
        f"Forecast generated: {generated}\n\n"
        "This is a model forecast, not an official air-quality reading or medical advice. "
        "Quantile outputs are not guaranteed confidence intervals."
    )
    try:
        region = os.environ.get("SNS_REGION") or os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-2")
        response = boto3.client("sns", region_name=region).publish(
            TopicArn=topic_arn,
            Subject=subject[:100],
            Message=message,
            MessageAttributes={
                "event_type": {"DataType": "String", "StringValue": "high-pollution-forecast"},
                "city": {"DataType": "String", "StringValue": str(city)},
            },
        )
        record_alert_result("SENT", now)
        message_id = response.get("MessageId")
        print(f"SNS high-pollution alert published; message_id={message_id}")
        return {"enabled": True, "sent": True, "message_id": message_id, "threshold": threshold}
    except Exception:
        # Let a later run retry instead of leaving a failed delivery permanently claimed.
        try:
            record_alert_result("FAILED", now)
            reset_high_alert(now)
        except Exception as state_error:
            print(f"Could not release SNS alert claim: {state_error}")
        raise
