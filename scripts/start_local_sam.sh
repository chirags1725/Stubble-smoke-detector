#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop/CLI is required. Start Docker Desktop, then retry." >&2
  exit 1
fi

if ! command -v sam >/dev/null 2>&1; then
  echo "AWS SAM CLI is required. Install it, then retry." >&2
  exit 1
fi

echo "Starting DynamoDB Local..."
docker compose up -d dynamodb-local

if ! docker network inspect stubble-local >/dev/null 2>&1; then
  echo "Docker network stubble-local was not created by Compose." >&2
  echo "Check docker-compose.yml and run: docker compose up -d dynamodb-local" >&2
  exit 1
fi

if [[ ! -f .aws-sam/build/template.yaml ]]; then
  echo "SAM build output is missing; building the project now..."
  sam build --use-container
fi

python3 scripts/make_sam_env.py

echo "Starting one SAM API server on port 3000, connected to stubble-local."
exec sam local start-api \
  --host 0.0.0.0 \
  --port 3000 \
  --env-vars .aws-sam/env.local.json \
  --docker-network stubble-local
