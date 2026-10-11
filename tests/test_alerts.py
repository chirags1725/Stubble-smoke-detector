"""Unit tests for the SNS transition guard; no AWS calls are made."""
import json
import os
import sys
import unittest
from unittest.mock import Mock, patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "api"))

from forecast import alert
import app as latest_api


class AlertTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SNS_TOPIC_ARN": "arn:aws:sns:ap-southeast-2:123456789012:test",
            "SNS_REGION": "ap-southeast-2",
            "ALERT_THRESHOLD_PM25": "150",
        }, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)

    @patch.object(alert, "reset_high_alert")
    @patch.object(alert.boto3, "client")
    def test_low_forecast_clears_episode_without_sending(self, sns_client, reset):
        result = alert.maybe_publish_high_pollution_alert({"24h_q90": 149.9, "48h_q90": 100})
        self.assertFalse(result["sent"])
        self.assertEqual(result["reason"], "below threshold")
        reset.assert_called_once()
        sns_client.assert_not_called()

    @patch.object(alert, "record_alert_result")
    @patch.object(alert, "claim_high_alert", return_value=True)
    @patch.object(alert.boto3, "client")
    def test_high_forecast_sends_once_and_records_success(self, sns_client, claim, record):
        publish = Mock(return_value={"MessageId": "message-1"})
        sns_client.return_value.publish = publish
        forecast = {"city": "Delhi", "generated_at": "2026-10-11T01:00:00+00:00", "24h_q90": 160, "48h_q90": 170}
        result = alert.maybe_publish_high_pollution_alert(forecast)
        self.assertTrue(result["sent"])
        self.assertEqual(result["message_id"], "message-1")
        self.assertEqual(publish.call_args.kwargs["TopicArn"], os.environ["SNS_TOPIC_ARN"])
        self.assertIn("48-hour q90", publish.call_args.kwargs["Message"])
        claim.assert_called_once()
        record.assert_called_once_with("SENT", unittest.mock.ANY)

    @patch.object(alert, "record_alert_result")
    @patch.object(alert, "claim_high_alert", side_effect=[True, False])
    @patch.object(alert.boto3, "client")
    def test_persistently_high_forecasts_do_not_repeat_email(self, sns_client, claim, record):
        sns_client.return_value.publish.return_value = {"MessageId": "one"}
        forecast = {"24h_q90": 155, "48h_q90": 160}
        first = alert.maybe_publish_high_pollution_alert(forecast)
        second = alert.maybe_publish_high_pollution_alert(forecast)
        self.assertTrue(first["sent"])
        self.assertFalse(second["sent"])
        self.assertEqual(sns_client.return_value.publish.call_count, 1)
        self.assertEqual(claim.call_count, 2)

    @patch.object(alert.boto3, "client")
    def test_missing_topic_disables_email(self, sns_client):
        with patch.dict(os.environ, {"SNS_TOPIC_ARN": ""}):
            result = alert.maybe_publish_high_pollution_alert({"24h_q90": 999})
        self.assertFalse(result["enabled"])
        sns_client.assert_not_called()

    @patch.object(latest_api, "get_table")
    def test_latest_endpoint_includes_server_alert_configuration(self, get_table):
        get_table.return_value.get_item.return_value = {"Item": {"pk": "LATEST#DEL", "sk": 0, "24h_q90": 155, "48h_q90": 90}}
        with patch.object(latest_api, "SNS_TOPIC_ARN", "arn:topic"), patch.object(latest_api, "THRESHOLD", 150):
            result = latest_api.handler({"httpMethod": "GET"}, None)
        body = json.loads(result["body"])
        self.assertTrue(body["alert"]["enabled"])
        self.assertTrue(body["alert"]["predicted_high"])
        self.assertEqual(body["alert"]["threshold_pm25"], 150)


if __name__ == "__main__":
    unittest.main()
