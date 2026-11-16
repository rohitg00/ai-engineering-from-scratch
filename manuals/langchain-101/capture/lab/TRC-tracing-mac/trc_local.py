import json
import os
import subprocess
import sys
import threading
import time
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable


def child(case):
    warnings.filterwarnings("ignore")
    sys.path.insert(0, str(HERE))
    seen = []
    if case.endswith("patched-requests"):
        import requests

        def send(self, request, **kw):
            seen.append(f"{request.method} {request.url.split('?')[0]}")
            r = requests.Response()
            r.status_code = 200
            r._content = b"{}"
            r.headers["Content-Type"] = "application/json"
            r.url = request.url
            r.request = request
            return r

        requests.Session.send = send
    from langchain.agents import create_agent
    from langchain_core.messages import AIMessage
    from langchain_core.tools import tool
    from langchain_core.tracers.langchain import wait_for_all_tracers
    from langsmith import traceable, tracing_context
    from langsmith.utils import tracing_is_enabled
    import langsmith
    from fake_tools import ToolFake

    @tool
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    def agent_run():
        fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "c1", "type": "tool_call"}]), AIMessage(content="5")])
        return create_agent(fake, tools=[add]).invoke({"messages": [{"role": "user", "content": "2+3?"}]})["messages"][-1].content

    trees = []

    @traceable(name="turn")
    def turn():
        return agent_run()

    mode = case.split(":")[0]
    enabled = {"local": "local", "false": False, "true": True, "none": None}[mode]
    with tracing_context(enabled=enabled):
        state = tracing_is_enabled()
        if "traceable" in case:
            ans = turn(langsmith_extra={"on_end": trees.append})
        else:
            ans = agent_run()
    wait_for_all_tracers()
    try:
        from langsmith.run_trees import get_cached_client
        get_cached_client().flush()
    except Exception:
        pass
    time.sleep(0.5)
    print(json.dumps({"case": case, "tracing_is_enabled_inside": state, "answer": ans, "local_trees": len(trees),
                      "patched_requests_seen": seen, "langsmith": langsmith.__version__,
                      "env": {k: v for k, v in os.environ.items() if k.startswith(("LANGSMITH", "LANGCHAIN"))}}))


def main():
    out = Path(sys.argv[1])
    hits = []

    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def any(self):
            n = int(self.headers.get("Content-Length") or 0)
            if n:
                self.rfile.read(n)
            hits.append(f"{self.command} {self.path.split('?')[0]}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"{}")

        do_GET = do_POST = do_PATCH = any

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH", "LANGCHAIN"))}
    rec_env = {**base, "LANGSMITH_ENDPOINT": f"http://127.0.0.1:{srv.server_port}", "LANGSMITH_API_KEY": "dummy-not-a-key"}
    cases = [
        ("local:agent", rec_env, "LANGSMITH_TRACING unset, endpoint = local recorder"),
        ("local:traceable", rec_env, "same, agent wrapped in @traceable with on_end"),
        ("false:agent", rec_env, "control: enabled=False"),
        ("true:agent", rec_env, "control: enabled=True"),
        ("none:agent", rec_env, "control: enabled=None, LANGSMITH_TRACING unset"),
        ("local:agent:patched-requests", base, "no LANGSMITH_* env at all, requests.Session.send patched (no network)"),
        ("local:traceable:patched-requests", base, "same, @traceable"),
        ("true:agent:patched-requests", base, "control: enabled=True, no env, patched"),
    ]
    rows = []
    for case, env, note in cases:
        hits.clear()
        cp = subprocess.run([PY, __file__, "--child", case], env=env, capture_output=True, text=True, timeout=120)
        time.sleep(0.5)
        try:
            res = json.loads(cp.stdout.strip().splitlines()[-1])
        except Exception:
            res = {"stdout": cp.stdout[-500:], "stderr": cp.stderr[-800:]}
        res.update(note=note, recorder_hits=sorted(set(hits)), recorder_hit_count=len(hits), stderr_tail=cp.stderr[-300:])
        rows.append(res)
        print(json.dumps(res)[:700], flush=True)
    srv.shutdown()
    out.write_text("\n".join(json.dumps(r) for r in rows) + "\n")


if __name__ == "__main__":
    if sys.argv[1] == "--child":
        child(sys.argv[2])
    else:
        main()
