import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE
PY = sys.executable
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def run_names(body: bytes, ctype: str):
    names = []
    if not body:
        return names
    text = body.decode("utf-8", "replace")
    if "multipart" in ctype:
        m = re.search(r"boundary=([^;\s]+)", ctype)
        if not m:
            return ["<no-boundary>"]
        for part in text.split("--" + m.group(1).strip('"')):
            hm = re.search(r'name="(post|patch)\.([0-9a-f-]{36})"\r?\n', part)
            if not hm:
                continue
            payload = part.split("\r\n\r\n", 1)[-1].strip()
            try:
                d = json.loads(payload)
                names.append(f"{hm.group(1)}:{d.get('run_type')}:{d.get('name')}:parent={'y' if d.get('parent_run_id') else 'n'}:project={d.get('session_name')}:ref_example={'y' if d.get('reference_example_id') else 'n'}")
            except Exception:
                names.append(f"{hm.group(1)}:<unparsed>")
        return names
    try:
        d = json.loads(text)
    except Exception:
        return ["<unparsed>"]
    if isinstance(d, dict) and ("post" in d or "patch" in d):
        for k in ("post", "patch"):
            for r in d.get(k) or []:
                names.append(f"{k}:{r.get('run_type')}:{r.get('name')}")
    elif isinstance(d, dict) and "name" in d:
        names.append(f"run:{d.get('run_type')}:{d.get('name')}")
    elif isinstance(d, dict):
        names.append(f"keys:{','.join(sorted(d)[:6])}")
    return names


def child(case):
    import warnings
    warnings.filterwarnings("ignore")
    sys.path.insert(0, str(HERE))
    seen = []
    blocked = []
    if case.startswith("noenv"):
        real_gai = socket.getaddrinfo

        def gai(host, *a, **k):
            if host not in ("127.0.0.1", "localhost", "::1"):
                blocked.append(f"getaddrinfo {host}")
                raise socket.gaierror(f"blocked by t18 guard: {host}")
            return real_gai(host, *a, **k)

        socket.getaddrinfo = gai
        import requests

        def send(self, request, **kw):
            body = request.body if isinstance(request.body, (bytes, bytearray)) else (request.body or "").encode()
            seen.append({"method": request.method, "url": request.url.split("?")[0],
                         "names": run_names(bytes(body), request.headers.get("Content-Type", ""))})
            r = requests.Response()
            r.status_code = 200
            r._content = b"{}"
            r.headers["Content-Type"] = "application/json"
            r.url = request.url
            r.request = request
            return r

        requests.Session.send = send

    import langsmith
    from langchain.agents import create_agent
    from langchain_core.messages import AIMessage
    from langchain_core.tools import tool
    from langchain_core.tracers.langchain import wait_for_all_tracers
    from langsmith import evaluate, schemas, tracing_context
    from fake_tools import ToolFake

    @tool
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    def agent_target(inputs: dict) -> dict:
        fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "c1", "type": "tool_call"}]),
                                AIMessage(content="The sum is 5.")])
        return {"answer": create_agent(fake, tools=[add]).invoke({"messages": [{"role": "user", "content": inputs["question"]}]})["messages"][-1].content}

    def quiet_target(inputs: dict) -> dict:
        with tracing_context(enabled=False):
            return agent_target(inputs)

    def plain_target(inputs: dict) -> dict:
        return {"answer": "The sum is 5."}

    def same_answer(outputs: dict, reference_outputs: dict) -> dict:
        return {"key": "same_answer", "score": outputs["answer"] == reference_outputs["answer"]}

    target = {"agent": agent_target, "quiet": quiet_target, "plain": plain_target}[case.split(":")[1]]
    created = datetime(2026, 1, 1, tzinfo=timezone.utc)
    data = [schemas.Example(id=uuid.UUID(int=11), dataset_id=uuid.UUID(int=99), inputs={"question": "What is 2 + 3?"},
                            outputs={"answer": "The sum is 5."}, created_at=created)]
    t0 = time.perf_counter()
    res = evaluate(target, data=data, evaluators=[same_answer], upload_results=False)
    rows = [{"answer": r["run"].outputs, "score": [e.score for e in r["evaluation_results"]["results"]]} for r in res]
    t_eval = time.perf_counter() - t0
    if os.environ.get("T18_NOFLUSH") == "1":
        print("T18RESULT " + json.dumps({"case": case, "rows": rows, "noflush": True, "patched_requests": seen, "guard_blocked": blocked}), flush=True)
        return
    wait_for_all_tracers()
    try:
        from langsmith.run_trees import get_cached_client
        get_cached_client().flush()
    except Exception as e:
        rows.append({"flush_error": repr(e)})
    time.sleep(0.3)
    print("T18RESULT " + json.dumps({"case": case, "rows": rows, "eval_s": round(t_eval, 3), "patched_requests": seen,
                                     "guard_blocked": blocked, "langsmith": langsmith.__version__,
                                     "env": sorted(k for k in os.environ if k.startswith(("LANGSMITH", "LANGCHAIN")) or "proxy" in k.lower())}), flush=True)


def main():
    OUT.mkdir(exist_ok=True)
    hits = []
    lock = threading.Lock()

    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def any(self):
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n) if n else b""
            with lock:
                hits.append({"method": self.command, "path": UUID_RE.sub("<id>", self.path.split("?")[0]),
                             "names": run_names(body, self.headers.get("Content-Type", ""))})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"{}")

        do_GET = do_POST = do_PATCH = do_PUT = any

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    strip = ("LANGSMITH", "LANGCHAIN")
    base = {k: v for k, v in os.environ.items() if not k.startswith(strip) and "proxy" not in k.lower()}
    ep = {**base, "LANGSMITH_ENDPOINT": f"http://127.0.0.1:{srv.server_port}", "LANGSMITH_API_KEY": "dummy-not-a-key"}
    conds = [("ep:agent", ep), ("ep:quiet", ep), ("ep:plain", ep), ("noenv:agent", base), ("noenv:quiet", base)]
    n = int(os.environ.get("T18_N", "5"))
    only = os.environ.get("T18_ONLY")
    if only:
        conds = [c for c in conds if c[0] in only.split(",")]
    outname = os.environ.get("T18_OUT", "01-evaluate-requests.jsonl")
    rows = []
    for rep in range(n):
        for case, env in conds:
            with lock:
                hits.clear()
            t0 = time.perf_counter()
            cp = subprocess.run([PY, __file__, "--child", case], env=env, capture_output=True, text=True, timeout=300, cwd=str(OUT))
            wall = time.perf_counter() - t0
            time.sleep(0.3)
            res = {"case": case, "rep": rep + 1, "rc": cp.returncode, "wall_s": round(wall, 2)}
            line = [l for l in cp.stdout.splitlines() if l.startswith("T18RESULT ")]
            if line:
                res.update(json.loads(line[-1][10:]))
            res["stdout_other"] = [l for l in cp.stdout.splitlines() if not l.startswith("T18RESULT ")][:6]
            res["stderr_tail"] = cp.stderr[-600:]
            with lock:
                res["recorder"] = list(hits)
            rows.append(res)
            print(json.dumps({k: res[k] for k in ("case", "rep", "rc", "wall_s")}), len(res["recorder"]), len(res.get("patched_requests", [])), flush=True)
    srv.shutdown()
    (OUT / outname).write_text("\n".join(json.dumps(r) for r in rows) + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--child":
        child(sys.argv[2])
    else:
        main()
