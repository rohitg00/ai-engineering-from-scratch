import http.client
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version

os.environ["LANGSMITH_TRACING"] = "false"

OLLAMA_PORT = 11434
MODEL = "qwen3:4b-instruct-2507-q4_K_M"
SETTINGS = {"temperature": 0, "seed": 42, "num_ctx": "server default", "ollama": "0.31.1 on the Mac (Apple M1 Max, 10 cores, 64 GiB), Metal"}
DROP_HEADERS = ("host", "connection", "content-length", "accept-encoding")


def uptime():
    try:
        return subprocess.run(["uptime"], capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception as e:
        return f"uptime failed: {e}"


def ollama_ps():
    try:
        c = http.client.HTTPConnection("127.0.0.1", OLLAMA_PORT, timeout=10)
        c.request("GET", "/api/ps")
        d = json.loads(c.getresponse().read())
        return [{"name": m.get("name"), "context_length": m.get("context_length"), "size_vram": m.get("size_vram")} for m in d.get("models", [])]
    except Exception as e:
        return f"ps failed: {e}"


def versions():
    out = {}
    for p in ("langchain", "langchain-core", "langgraph", "langgraph-prebuilt", "langchain-ollama", "langchain-openai", "ollama", "openai", "httpx"):
        try:
            out[p] = version(p)
        except Exception:
            out[p] = None
    out["python"] = sys.version.split()[0]
    return out


def header(script, **extra):
    return {"kind": "header", "script": script, "model": MODEL, "settings": SETTINGS, "versions": versions(), "uptime": uptime(),
            "ollama_ps": ollama_ps(), "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **extra}


def block_mark(fh, label, **extra):
    row = {"kind": "block", "label": label, "uptime": uptime(), "ollama_ps": ollama_ps(), "time": time.time(), **extra}
    fh.write(json.dumps(row) + "\n")
    fh.flush()
    print(json.dumps(row), flush=True)
    return row


class BodyProxy:
    """Forwards each request unchanged to the real Ollama and keeps the raw request body, the request headers, the status,
    and the raw reply body of each non-streamed request."""

    def __init__(self, upstream_port=OLLAMA_PORT):
        self.records = []
        self.lock = threading.Lock()
        proxy = self

        class H(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *a):
                pass

            def do_GET(self):
                self._fwd(b"")

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                self._fwd(self.rfile.read(n) if n else b"")

            def _fwd(self, body):
                rec = {"path": self.path, "method": self.command, "t_recv_ns": time.time_ns(), "req_bytes": len(body),
                       "req_body": body.decode("utf-8", "replace"),
                       "req_headers": [[k.lower(), v] for k, v in self.headers.items()]}
                c = http.client.HTTPConnection("127.0.0.1", upstream_port, timeout=900)
                hdrs = {k: v for k, v in self.headers.items() if k.lower() not in DROP_HEADERS}
                t0 = time.time_ns()
                c.request(self.command, self.path, body=body if body else None, headers={**hdrs, "Content-Length": str(len(body))})
                r = c.getresponse()
                data = r.read()
                rec["upstream_ns"] = time.time_ns() - t0
                rec["status"] = r.status
                rec["resp_body"] = data.decode("utf-8", "replace")
                self.send_response(r.status)
                for k, v in r.getheaders():
                    if k.lower() in ("content-length", "transfer-encoding", "connection", "date"):
                        continue
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                c.close()
                with proxy.lock:
                    proxy.records.append(rec)

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.srv.daemon_threads = True
        self.port = self.srv.server_port
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def since(self, t0_ns):
        with self.lock:
            return [r for r in self.records if r["t_recv_ns"] >= t0_ns]

    def close(self):
        self.srv.shutdown()
        self.srv.server_close()
