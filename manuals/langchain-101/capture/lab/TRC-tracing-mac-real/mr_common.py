import json
import os
import subprocess
import sys
import threading
import time
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version

os.environ.setdefault("LANGSMITH_TRACING", "false")

OLLAMA_PORT = 11434
MODEL = "qwen3:4b-instruct-2507-q4_K_M"
MODEL8 = "qwen3:8b"
SETTINGS = {"temperature": 0, "seed": 42, "num_ctx": "server default", "reasoning": "unset for qwen3:4b-instruct-2507 (no thinking mode)",
            "ollama": "0.31.1 on the Mac (Apple M1 Max, 10 cores, 64 GiB), Metal", "max_retries": "client default unless stated"}


def uptime():
    try:
        return subprocess.run(["uptime"], capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception as e:
        return f"uptime failed: {e}"


def versions():
    out = {}
    for p in ("langchain", "langchain-core", "langgraph", "langgraph-prebuilt", "langchain-ollama", "langchain-openai", "ollama", "openai",
              "langsmith", "httpx"):
        try:
            out[p] = version(p)
        except Exception:
            out[p] = None
    out["python"] = sys.version.split()[0]
    return out


def header(script, **extra):
    return {"kind": "header", "script": script, "model": MODEL, "settings": SETTINGS, "versions": versions(), "uptime": uptime(),
            "load": os.getloadavg(), "cpu_count": os.cpu_count(), "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **extra}


def block_mark(fh, label, **extra):
    row = {"kind": "block", "label": label, "uptime": uptime(), "load": os.getloadavg(), "time": time.time(), **extra}
    fh.write(json.dumps(row) + "\n")
    fh.flush()
    print(json.dumps(row), flush=True)
    return row


class RecordingProxy:
    """HTTP proxy in front of the real Ollama. It forwards each request unchanged and records, per request: arrival time,
    request bytes, upstream time (first byte sent upstream to last byte of the reply), reply bytes, the usage or the
    Ollama durations of a non-streamed reply. For streamed replies it stamps each line it passes on."""

    def __init__(self, upstream_port=OLLAMA_PORT, stamp_stream=True):
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
                t_recv = time.time_ns()
                rec = {"path": self.path, "method": self.command, "t_recv_ns": t_recv, "req_bytes": len(body)}
                try:
                    req = json.loads(body) if body else {}
                except Exception:
                    req = {}
                rec["req_keys"] = sorted(req) if isinstance(req, dict) else []
                rec["stream"] = bool(req.get("stream", self.path.startswith("/api/chat"))) if isinstance(req, dict) else False
                rec["n_msgs"] = len(req.get("messages", [])) if isinstance(req, dict) else 0
                if isinstance(req, dict) and req.get("response_format"):
                    rec["response_format_type"] = req["response_format"].get("type")
                if isinstance(req, dict) and "format" in req:
                    rec["format"] = "schema" if isinstance(req["format"], dict) else req["format"]
                rec["tag"] = proxy._tag(req)
                c = http.client.HTTPConnection("127.0.0.1", upstream_port, timeout=900)
                hdrs = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection", "content-length", "accept-encoding")}
                t_up0 = time.time_ns()
                c.request(self.command, self.path, body=body if body else None, headers={**hdrs, "Content-Length": str(len(body))})
                r = c.getresponse()
                rec["status"] = r.status
                ctype = r.getheader("Content-Type", "")
                streaming = "event-stream" in ctype or "ndjson" in ctype
                self.send_response(r.status)
                for k, v in r.getheaders():
                    if k.lower() in ("content-length", "transfer-encoding", "connection", "date"):
                        continue
                    self.send_header(k, v)
                if streaming:
                    self.send_header("Transfer-Encoding", "chunked")
                    self.end_headers()
                    ev = []
                    k = 0
                    total = 0
                    while True:
                        line = r.readline()
                        if not line:
                            break
                        total += len(line)
                        self.wfile.write(f"{len(line):X}\r\n".encode() + line + b"\r\n")
                        self.wfile.flush()
                        t = time.time_ns()
                        s = line.decode("utf-8", "replace").strip()
                        if not s:
                            continue
                        kind, text = proxy._classify(s, rec)
                        if proxy.stamp_stream:
                            ev.append([t, kind, k, text])
                        k += 1
                    self.wfile.write(b"0\r\n\r\n")
                    self.wfile.flush()
                    rec["events"] = ev
                    rec["resp_bytes"] = total
                else:
                    data = r.read()
                    t_up1 = time.time_ns()
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    rec["resp_bytes"] = len(data)
                    rec["upstream_ns"] = t_up1 - t_up0
                    try:
                        d = json.loads(data)
                        if "usage" in d:
                            rec["usage"] = d["usage"]
                        for key in ("total_duration", "load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration"):
                            if key in d:
                                rec[key] = d[key]
                        if r.status >= 400:
                            rec["error_body"] = data[:400].decode("utf-8", "replace")
                    except Exception:
                        if r.status >= 400:
                            rec["error_body"] = data[:400].decode("utf-8", "replace")
                rec["t_done_ns"] = time.time_ns()
                rec["upstream_ns"] = rec.get("upstream_ns", rec["t_done_ns"] - t_up0)
                c.close()
                with proxy.lock:
                    proxy.records.append(rec)

        self.stamp_stream = stamp_stream
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.srv.daemon_threads = True
        self.port = self.srv.server_port
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    @staticmethod
    def _tag(req):
        import re
        if not isinstance(req, dict):
            return None
        for m in reversed(req.get("messages", [])):
            if m.get("role") == "user":
                c = m.get("content")
                if isinstance(c, list):
                    c = " ".join(x.get("text", "") for x in c if isinstance(x, dict))
                mt = re.search(r"run-[0-9a-f]+", c or "")
                if mt:
                    return mt.group(0)
        return None

    @staticmethod
    def _classify(s, rec):
        if s.startswith("data: "):
            if s == "data: [DONE]":
                return "done", ""
            try:
                obj = json.loads(s[6:])
            except Exception:
                return "raw", ""
            if obj.get("usage"):
                rec["usage"] = obj["usage"]
            d = obj["choices"][0]["delta"] if obj.get("choices") else {}
            if d.get("tool_calls"):
                return "tool", ""
            if d.get("content"):
                return "text", d["content"]
            if d.get("reasoning"):
                return "reasoning", d["reasoning"]
            return "other", ""
        try:
            obj = json.loads(s)
        except Exception:
            return "raw", ""
        m = obj.get("message") or {}
        if obj.get("done"):
            for key in ("total_duration", "load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration"):
                if key in obj:
                    rec[key] = obj[key]
        if m.get("tool_calls"):
            return "tool", ""
        if m.get("thinking"):
            return "reasoning", m["thinking"]
        if m.get("content"):
            return "text", m["content"]
        return "done" if obj.get("done") else "other", ""

    def since(self, t0_ns, t1_ns=None):
        with self.lock:
            return [r for r in self.records if r["t_recv_ns"] >= t0_ns and (t1_ns is None or r["t_recv_ns"] <= t1_ns)]

    def close(self):
        self.srv.shutdown()
        self.srv.server_close()
