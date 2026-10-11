"""Optional integration test against DynamoDB Local; never contacts AWS."""
from datetime import datetime, timezone
import os
import unittest

import boto3
from botocore.exceptions import BotoCoreError, ClientError

os.environ.setdefault("DDB_ENDPOINT", "http://localhost:8000")
os.environ.setdefault("TABLE", "StubbleForecasts")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-2")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "local")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "local")

from forecast.db import get_latest_forecast, get_forecast_history, save_latest_forecast


class LocalDynamoDBTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = boto3.client(
            "dynamodb",
            endpoint_url=os.environ["DDB_ENDPOINT"],
            region_name=os.environ["AWS_DEFAULT_REGION"],
            aws_access_key_id="local",
            aws_secret_access_key="local",
        )
        try:
            cls.client.describe_table(TableName=os.environ["TABLE"])
        except cls.client.exceptions.ResourceNotFoundException:
            cls.client.create_table(
                TableName=os.environ["TABLE"],
                KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
                AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}, {"AttributeName": "sk", "AttributeType": "N"}],
                BillingMode="PAY_PER_REQUEST",
            )
            cls.client.get_waiter("table_exists").wait(TableName=os.environ["TABLE"])
        except (BotoCoreError, ClientError) as exc:
            raise unittest.SkipTest(f"DynamoDB Local is not available at {os.environ['DDB_ENDPOINT']}: {exc}")

    def test_save_and_read_latest_and_history(self):
        sample = {
            "city": "Delhi",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pm25_now": 92,
            "level_24h": "Moderate",
            "level_48h": "High",
        }
        save_latest_forecast(sample)
        loaded = get_latest_forecast()
        self.assertIsNotNone(loaded)
        self.assertEqual(int(loaded["pm25_now"]), 92)
        self.assertEqual(loaded["level_24h"], "Moderate")
        history = get_forecast_history(limit=5)
        self.assertTrue(any(item.get("generated_at") == sample["generated_at"] for item in history))


if __name__ == "__main__":
    unittest.main()
