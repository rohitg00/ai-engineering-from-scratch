import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE
TESTS = HERE / "t19_tests"
PY = str(OUT / "_venv" / "bin" / "python")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def main():
    n = int(os.environ.get("T19_N", "3"))
    hits = []
    lock = threading.Lock()

    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def any(self):
            ln = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(ln) if ln else b""
            text = body.decode("utf-8", "replace")
            names = re.findall(r'"name":\s*"([^"]{1,60})"', text)[:12]
            with lock:
                hits.append({"method": self.command, "path": UUID_RE.sub("<id>", self.path.split("?")[0]), "bytes": ln, "names": names})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"{}")

        do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = any

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH", "LANGCHAIN")) and "proxy" not in k.lower()}
    base["PYTHONDONTWRITEBYTECODE"] = "1"
    ep = {**base, "LANGSMITH_ENDPOINT": f"http://127.0.0.1:{srv.server_port}", "LANGSMITH_API_KEY": "dummy-not-a-key"}
    off = {"LANGSMITH_TEST_TRACKING": "false"}
    conds = [
        ("off-ep", {**ep, **off}, []),
        ("off-noenv", {**base, **off, "T19_GUARD": "refuse"}, []),
        ("off-noenv-logcli", {**base, **off, "T19_GUARD": "refuse"}, ["-o", "log_cli=true", "--log-cli-level=INFO"]),
        ("off-noenv-output", {**base, **off, "T19_GUARD": "refuse"}, ["--langsmith-output"]),
        ("on-ep", ep, []),
        ("on-ep-output", ep, ["--langsmith-output"]),
        ("on-noenv-refuse", {**base, "T19_GUARD": "refuse"}, []),
        ("on-noenv-fake200", {**base, "T19_GUARD": "fake200"}, []),
        ("off-ep-tracing", {**ep, **off, "LANGSMITH_TRACING": "true"}, []),
    ]
    only = os.environ.get("T19_ONLY")
    if only:
        conds = [c for c in conds if c[0] in only.split(",")]
    rows = []
    for rep in range(1, n + 1):
        for name, env, extra in conds:
            log = OUT / f"_guard-{name}-{rep}.jsonl"
            if log.exists():
                log.unlink()
            env = {**env, "T19_LOG": str(log)}
            with lock:
                hits.clear()
            cmd = [PY, "-m", "pytest", str(TESTS / "test_ls_plugin.py"), "-p", "no:cacheprovider", "-rA", "--color=no", *extra]
            t0 = time.perf_counter()
            try:
                cp = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=240, cwd=str(TESTS))
                rc, so, se = cp.returncode, cp.stdout, cp.stderr
            except subprocess.TimeoutExpired as e:
                rc, so, se = "timeout", (e.stdout or b"").decode() if isinstance(e.stdout, bytes) else (e.stdout or ""), ""
            wall = time.perf_counter() - t0
            time.sleep(0.3)
            guard = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
            if log.exists():
                log.unlink()
            with lock:
                rec = list(hits)
            (OUT / f"02-{name}-rep{rep}-stdout.txt").write_text(f"$ {' '.join(cmd[1:])}\nrc={rc} wall={wall:.2f}s\n--- stdout\n{so}\n--- stderr\n{se}")
            res = {"cond": name, "rep": rep, "rc": rc, "wall_s": round(wall, 2), "summary": (so.strip().splitlines() or [""])[-1],
                   "recorder": rec, "guard": guard}
            rows.append(res)
            print(name, rep, rc, round(wall, 2), res["summary"][:120], "recorder", len(rec), "guard", len(guard), flush=True)
    srv.shutdown()
    (OUT / os.environ.get("T19_OUT", "01-pytest-runs.jsonl")).write_text("\n".join(json.dumps(r) for r in rows) + "\n")


if __name__ == "__main__":
    main()
