import http.server
import json
import os
import subprocess
import threading
import time

WORK = "/work"
os.makedirs(WORK, exist_ok=True)


def keep_tail(stream, limit, kept):
    text = ""
    for chunk in iter(lambda: stream.read(65536), ""):
        text = (text + chunk)[-limit:]
    kept.append(text)


def run(command, timeout):
    process = subprocess.Popen(["sh", "-c", command], cwd=WORK, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = [], []
    readers = [
        threading.Thread(target=keep_tail, args=(process.stdout, 2000, out), daemon=True),
        threading.Thread(target=keep_tail, args=(process.stderr, 1000, err), daemon=True),
    ]
    for reader in readers:
        reader.start()
    try:
        code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        return {"exit": None, "stdout": "", "stderr": "timeout"}
    for reader in readers:
        reader.join()
    return {"exit": code, "stdout": out[0], "stderr": err[0]}


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
        result = run(task["cmd"], task.get("timeout", 20))
        result["seconds"] = round(time.time() - started, 2)
        self.reply(200, result)


http.server.ThreadingHTTPServer(("", 80), Handler).serve_forever()
