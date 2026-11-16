import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from tests.conftest import RUN_DIR
from tests.procs import Http, Server, free_port


class Recorder(BaseHTTPRequestHandler):
    seen = []

    def handle_any(self):
        length = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(length)
        Recorder.seen.append({"method": self.command, "path": self.path, "bytes": length})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b"{}")

    do_GET = do_POST = do_PATCH = do_PUT = handle_any

    def log_message(self, *args):
        pass


async def conversation(port_env, name):
    server = Server(RUN_DIR, name, AUTH_TOKENS="tok-smith=smith", **port_env)
    client = Http(server.url, "tok-smith")
    thread = await client.thread()
    await client.say(thread, "How long does shipping take?")
    await client.say(thread, "Refund ORD-smith-3")
    await client.approve(thread, "reject")
    server.stop()


async def test_langsmith_receives_nothing_unless_enabled():
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    port = free_port()
    recorder = ThreadingHTTPServer(("127.0.0.1", port), Recorder)
    threading.Thread(target=recorder.serve_forever, daemon=True).start()
    endpoint = f"http://127.0.0.1:{port}"
    base = {"LANGSMITH_ENDPOINT": endpoint, "LANGCHAIN_ENDPOINT": endpoint, "LANGSMITH_API_KEY": "lsv2_pt_fake"}
    counts = {}
    try:
        for label, flag in [("enabled_control", "true"), ("disabled", "false"), ("unset", None)]:
            before = len(Recorder.seen)
            await conversation({**base, "LANGSMITH_TRACING": flag, "LANGCHAIN_TRACING_V2": flag}, f"smith-{label}")
            counts[label] = Recorder.seen[before:]
    finally:
        recorder.shutdown()
    (RUN_DIR / "smith-off.json").write_text(json.dumps(
        {label: {"requests": len(rows), "paths": sorted({r["path"] for r in rows})} for label, rows in counts.items()},
        indent=2))
    assert len(counts["enabled_control"]) > 0
    assert counts["disabled"] == [] and counts["unset"] == []
