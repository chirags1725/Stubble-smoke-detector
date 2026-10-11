
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Handler(BaseHTTPRequestHandler):


    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5175")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/refresh":
            self.send_error(404)
            return

        try:
            result = subprocess.run(
                [sys.executable, str(ROOT / "src/run_forecast.py")],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=110,
            )

            if result.returncode != 0:
                print(result.stdout)
                print(result.stderr)
                self.respond(500, {"error": "Forecast failed; check service logs."})
                return

            self.respond(200, {"message": "Forecast refreshed successfully."})

        except subprocess.TimeoutExpired:
            self.respond(504, {"error": "Forecast generation timed out."})

    def respond(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5175")
        self.send_header("Vary", "Origin")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(format % args)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 3001), Handler).serve_forever()
