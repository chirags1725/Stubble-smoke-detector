"""FIRMS and narrative API unit tests; no external services are called."""
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "api"))
import fires
import summary


class FireApiTests(unittest.TestCase):
    def test_missing_key_is_reported_without_requesting_nasa(self):
        with patch.dict(os.environ, {"FIRMS_KEY": ""}, clear=False):
            result = fires.handler({"httpMethod": "GET", "queryStringParameters": {"date": "2026-10-11"}}, None)
        self.assertEqual(result["statusCode"], 503)
        self.assertIn("FIRMS_KEY", json.loads(result["body"])["error"])

    def test_rejects_live_data_older_than_five_days_without_external_request(self):
        with patch.dict(os.environ, {"FIRMS_KEY": "test-key"}, clear=False), patch.object(fires, "_fetch") as fetch:
            result = fires.handler({"httpMethod": "GET", "queryStringParameters": {"date": "2026-01-01"}}, None)
        self.assertEqual(result["statusCode"], 400)
        fetch.assert_not_called()

    def test_live_handler_combines_current_sensor_results_and_computes_counts(self):
        records = [
            {"latitude": 30.1, "longitude": 76.2, "frp_mw": 22.4, "confidence": "h", "acq_datetime_utc": "2026-10-11T06:30:00+00:00", "satellite": "N"},
            {"latitude": 29.9, "longitude": 77.1, "frp_mw": 2.1, "confidence": "l", "acq_datetime_utc": "2026-10-11T04:30:00+00:00", "satellite": "J"},
        ]
        today = datetime.now(timezone.utc).date().isoformat()
        with patch.dict(os.environ, {"FIRMS_KEY": "test-key"}, clear=False), patch.object(fires, "_fetch", side_effect=[records[:1], records[1:]]) as fetch:
            result = fires.handler({"httpMethod": "GET", "queryStringParameters": {"date": today}}, None)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(body["detections_total"], 2)
        self.assertEqual(body["high_confidence_count"], 1)
        self.assertEqual(body["frp_sum_mw"], 24.5)
        self.assertEqual(fetch.call_count, 2)
        self.assertIn("not proof", body["attribution_note"])


class SummaryTests(unittest.TestCase):
    def test_fallback_summary_distinguishes_model_baseline_and_fire_cause(self):
        context = {
            "forecast": {"pm25_now": 75.0, "24h_q10": 60, "24h_q50": 80, "24h_q90": 130, "48h_q10": 75, "48h_q50": 95, "48h_q90": 160},
            "generated_at": "2026-10-11T04:00:00+00:00", "history": [72, 80], "threshold_pm25": 150,
            "fire": {"date": "2026-10-11", "detections": 45, "high_confidence": 31, "frp_sum_mw": 344.5, "fire_source": "NASA FIRMS NRT"},
            "season": {"year": 2025, "detections": 1200, "peak_date": "2025-11-06", "peak_count": 95},
        }
        english = summary._fallback(context, "en")
        hindi = summary._fallback(context, "hi")
        punjabi = summary._fallback(context, "pa")
        self.assertIn("not a sensor observation", english)
        self.assertIn("do not establish cause", english)
        self.assertIn("75.0", english)
        self.assertIn("rose by 8.0", english)
        self.assertIn("1200 detections", english)
        self.assertTrue(hindi and punjabi)
        self.assertIn("150.0", english)

    def test_invalid_language_is_not_accepted(self):
        with patch("summary.get_table") as get_table:
            result = summary.handler({"httpMethod": "POST", "body": json.dumps({"lang": "xx"})}, None)
        self.assertEqual(result["statusCode"], 400)
        get_table.assert_not_called()


if __name__ == "__main__":
    unittest.main()
