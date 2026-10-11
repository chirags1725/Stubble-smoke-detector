"""Generate .aws-sam/env.local.json for SAM containers on the local Compose network."""
import json
from pathlib import Path

ROOT = Path(__file__ ).resolve().parents[1]
base = json.loads((ROOT / "env.local.json").read_text(encoding="utf-8"))

env_path = ROOT / ".env"
settings = {}
if env_path.is_file():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            settings[key.strip()] = value.strip().strip("\"'")

# SAM Lambda containers are attached to the stubble-local Docker network.
for name in ("ForecastApi", "HistoryApi", "InsightsApi"):
    values = base.setdefault(name, {})
    values.update({
        "TABLE": "StubbleForecasts",
        "CITY": "DEL",
        "DDB_ENDPOINT": "http://dynamodb-local:8000",
        "AWS_ACCESS_KEY_ID": "local",
        "AWS_SECRET_ACCESS_KEY": "local",
    } )

if settings.get("FIRMS_KEY"):
    base.setdefault("FireMapApi", {})["FIRMS_KEY"] = settings["FIRMS_KEY"]

base.setdefault("FireMapApi", {}).update({"ALLOWED_ORIGIN": "*"})

base.setdefault("InsightsApi", {}).update({
    "ALERT_THRESHOLD_PM25": settings.get("ALERT_THRESHOLD_PM25", "150"),
    "BEDROCK_MODEL_ID": settings.get("BEDROCK_MODEL_ID", ""),
    "ALLOWED_ORIGIN": "*",
})

out = ROOT / ".aws-sam" / "env.local.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(base, indent=2) + "\n", encoding="utf-8")

print(f"Wrote {out.relative_to(ROOT)}. This generated file is ignored by git.")
print("DynamoDB API functions use http://dynamodb-local:8000 on Docker network stubble-local." )
if not settings.get("FIRMS_KEY"):
    print("Warning: FIRMS_KEY was not found in .env; live fire-map requests will not work.")
