"""Create the DynamoDB Local table used by the forecast API and worker."""
import os
import boto3

ENDPOINT = os.environ.get("DDB_ENDPOINT", "http://localhost:8000")
REGION = os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-2")
TABLE = os.environ.get("TABLE", "StubbleForecasts")

client = boto3.client(
    "dynamodb",
    endpoint_url=ENDPOINT,
    region_name=REGION,
    aws_access_key_id="local",
    aws_secret_access_key="local",
)

try:
    client.describe_table(TableName=TABLE)
    print(f"Table {TABLE} already exists at {ENDPOINT}")
except client.exceptions.ResourceNotFoundException:
    client.create_table(
        TableName=TABLE,
        KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
        AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}, {"AttributeName": "sk", "AttributeType": "N"}],
        BillingMode="PAY_PER_REQUEST",
    )
    client.get_waiter("table_exists").wait(TableName=TABLE)
    print(f"Created {TABLE} at {ENDPOINT}")
