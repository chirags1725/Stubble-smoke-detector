"""Small API-side DynamoDB helper (CodeUri is src/api)."""
from decimal import Decimal

import boto3


# LOCAL TESTING ONLY: DynamoDB Local published on your Mac's port 8000.
# Remove this hardcoded endpoint before deploying to AWS.
LOCAL_DDB_ENDPOINT = "http://host.docker.internal:8000"


def get_table( ):
    region = "ap-southeast-2"

    # DynamoDB Local does not use real AWS credentials.
    dynamodb = boto3.resource(
        "dynamodb",
        region_name=region,
        endpoint_url=LOCAL_DDB_ENDPOINT,
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )

    table_name = "StubbleForecasts"
    print(
        f"DDB CONFIG: endpoint = {LOCAL_DDB_ENDPOINT} "
        f"table = {table_name!r} region = {region}"
    )
    return dynamodb.Table(table_name)


def json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"Cannot serialize {type(value).__name__}")
