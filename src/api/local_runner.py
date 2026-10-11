"""Host-side local runner used by SAM Local's POST /refresh proxy."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "src"))


def load_dotenv():
    """Load non-secret defaults from project .env without overriding shell values."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("\"'")
        if key:
            os.environ.setdefault(key, value)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            return self.respond(404, {"error": "not_found"})
        return self.respond(200, {"status": "ready"})

    def do_POST(self):
        if self.path != "/refresh":
            return self.respond(404, {"error": "not_found"})
        try:
            from run_forecast import main
            main()
            return self.respond(200, {"message": "Forecast refreshed successfully."})
        except Exception as exc:
            print(f"Forecast refresh failed: {exc}", flush=True)
            return self.respond(500, {"error": "Forecast failed; check local runner logs."})

    def respond(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    load_dotenv()
    os.environ.setdefault("DDB_ENDPOINT", "http://localhost:8000")
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("LOCAL_REFRESH_PORT", "3001"))), Handler).serve_forever()
