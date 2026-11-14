import argparse
import json
import re
import socket
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOCK = threading.Lock()
STATE = {"n": 0}


def parse_model(model):
    parts = model.split("|")
    cfg = {"scenario": parts[0], "K": 40, "R": 20.0, "P": 50.0, "A": 200, "Ra": 5.0, "noid": 0, "ncalls": 1}
    for p in parts[1:]:
        k, v = p.split("=")
        cfg[k] = float(v) if "." in v else int(v)
    return cfg


def run_tag(req):
    for m in reversed(req.get("messages", [])):
        if m.get("role") == "user":
            c = m.get("content")
            if isinstance(c, list):
                c = " ".join(x.get("text", "") for x in c if isinstance(x, dict))
            mt = re.search(r"run-[0-9a-f]+", c or "")
            if mt:
                return mt.group(0)
    return None


def chunk(cid, model, delta, finish=None):
    return {"id": cid, "object": "chat.completion.chunk", "created": 0, "model": model,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    log_fh = None
    upstream = None
    mode = "stub"

    def setup(self):
        super().setup()
        self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def log_message(self, *a):
        pass

    def do_GET(self):
        body = b'{"ok": true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _start_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()

    def _write(self, data: bytes):
        self.wfile.write(f"{len(data):X}\r\n".encode() + data + b"\r\n")
        self.wfile.flush()

    def _sse(self, obj):
        self._write(b"data: " + json.dumps(obj).encode() + b"\n\n")
        return time.time_ns()

    def _end(self):
        self._write(b"data: [DONE]\n\n")
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def do_POST(self):
        t_recv = time.time_ns()
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        req = json.loads(raw or b"{}")
        with LOCK:
            STATE["n"] += 1
            idx = STATE["n"]
        rec = {"idx": idx, "t_recv_ns": t_recv, "tag": run_tag(req), "req_bytes": len(raw), "stream": bool(req.get("stream")),
               "n_msgs": len(req.get("messages", [])), "model": req.get("model"), "events": []}
        if self.mode == "proxy":
            self._proxy(raw, req, rec)
        else:
            self._stub(req, rec)
        rec["t_done_ns"] = time.time_ns()
        with LOCK:
            self.log_fh.write(json.dumps(rec) + "\n")
            self.log_fh.flush()

    def _proxy(self, raw, req, rec):
        up = urllib.request.Request(self.upstream + self.path, data=raw, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(up, timeout=600) as r:
            self._start_sse()
            k = 0
            for line in r:
                if not line.strip():
                    continue
                self._write(line.rstrip(b"\n") + b"\n\n")
                t = time.time_ns()
                s = line.decode().strip()
                if s.startswith("data: ") and s != "data: [DONE]":
                    try:
                        obj = json.loads(s[6:])
                        d = obj["choices"][0]["delta"] if obj.get("choices") else {}
                        kind = "tool" if d.get("tool_calls") else ("text" if d.get("content") else "other")
                        rec["events"].append([t, kind, k, d.get("content") or ""])
                        if obj.get("usage"):
                            rec["usage"] = obj["usage"]
                    except Exception:
                        rec["events"].append([t, "raw", k, ""])
                k += 1
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()

    def _stub(self, req, rec):
        cfg = parse_model(req.get("model", "text"))
        msgs = req.get("messages", [])
        n_tool = sum(1 for m in msgs if m.get("role") == "tool")
        cid = f"chatcmpl-{rec['idx']}"
        model = req.get("model")
        want_tool = cfg["scenario"] in ("tool", "noid", "subagent") and n_tool == 0
        if cfg["scenario"] == "subagent":
            sys_txt = " ".join(str(m.get("content")) for m in msgs if m.get("role") == "system")
            want_tool = n_tool == 0 and "SUPERVISOR" in sys_txt
        if not req.get("stream"):
            self._nonstream(req, rec, cfg, want_tool, cid, model)
            return
        self._start_sse()
        time.sleep(cfg["P"] / 1000)
        if want_tool:
            ncalls = int(cfg["ncalls"])
            name = "call_weather" if cfg["scenario"] == "subagent" else "lookup"
            for c in range(ncalls):
                tc = {"index": c, "type": "function", "function": {"name": name, "arguments": ""}}
                if not cfg["noid"]:
                    tc["id"] = f"call_{rec['idx']}_{c}"
                rec["events"].append([self._sse(chunk(cid, model, {"role": "assistant", "content": None, "tool_calls": [tc]})), "tool_open", c, ""])
                arg_pieces = ['{"q": "'] + [f"a{j:04d}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx " for j in range(int(cfg["A"]))] + ['"}']
                for j, piece in enumerate(arg_pieces):
                    time.sleep(cfg["Ra"] / 1000)
                    rec["events"].append([self._sse(chunk(cid, model, {"tool_calls": [{"index": c, "function": {"arguments": piece}}]})), "tool_arg", j, ""])
            rec["events"].append([self._sse(chunk(cid, model, {}, "tool_calls")), "finish", 0, ""])
        else:
            pfx = "w"
            if cfg["scenario"] == "subagent" and "SUPERVISOR" not in " ".join(str(m.get("content")) for m in msgs if m.get("role") == "system"):
                pfx = "s"
            for k in range(int(cfg["K"])):
                if k:
                    time.sleep(cfg["R"] / 1000)
                d = {"content": f"{pfx}{k:03d} "}
                if k == 0:
                    d["role"] = "assistant"
                rec["events"].append([self._sse(chunk(cid, model, d)), "text", k, d["content"]])
            rec["events"].append([self._sse(chunk(cid, model, {}, "stop")), "finish", 0, ""])
        self._end()

    def _nonstream(self, req, rec, cfg, want_tool, cid, model):
        if want_tool:
            ncalls = int(cfg["ncalls"])
            tcs = []
            for c in range(ncalls):
                tc = {"type": "function", "function": {"name": "lookup", "arguments": json.dumps({"q": f"n{c}"})}}
                if not cfg["noid"]:
                    tc["id"] = f"call_{rec['idx']}_{c}"
                tcs.append(tc)
            msg = {"role": "assistant", "content": None, "tool_calls": tcs}
            fin = "tool_calls"
        else:
            msg = {"role": "assistant", "content": "done"}
            fin = "stop"
        body = json.dumps({"id": cid, "object": "chat.completion", "created": 0, "model": model,
                           "choices": [{"index": 0, "message": msg, "finish_reason": fin}],
                           "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--log", required=True)
    p.add_argument("--mode", choices=["stub", "proxy"], default="stub")
    p.add_argument("--upstream", default="http://127.0.0.1:11434")
    a = p.parse_args()
    H.log_fh = open(a.log, "a")
    H.upstream = a.upstream
    H.mode = a.mode
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    srv.daemon_threads = True
    print(f"listening {a.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    sys.exit(main())
