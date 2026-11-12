import http.server
import json
import os
import subprocess
import time

WORK = "/work"
os.makedirs(WORK, exist_ok=True)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *ignored):
        pass

    def reply(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200, {"ok": True, "files": sorted(os.listdir(WORK))})

    def do_POST(self):
        task = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        started = time.time()
        try:
            done = subprocess.run(["sh", "-c", task["cmd"]], cwd=WORK, capture_output=True, text=True, timeout=task.get("timeout", 20))
            result = {"exit": done.returncode, "stdout": done.stdout[-2000:], "stderr": done.stderr[-1000:]}
        except subprocess.TimeoutExpired:
            result = {"exit": None, "stdout": "", "stderr": "timeout"}
        result["seconds"] = round(time.time() - started, 2)
        self.reply(200, result)


http.server.ThreadingHTTPServer(("", 80), Handler).serve_forever()
