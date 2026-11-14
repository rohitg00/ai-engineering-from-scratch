import argparse
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, required=True)
ap.add_argument("--log", required=True)
ap.add_argument("--mode", default="ok", choices=["ok", "slow", "hang", "error500"])
ap.add_argument("--delay", type=float, default=2.0)
args = ap.parse_args()
lock = threading.Lock()
logf = open(args.log, "a")


def count_runs(body: bytes, enc: str | None):
    raw = body
    if enc == "zstd":
        import zstandard
        raw = zstandard.ZstdDecompressor().decompressobj().decompress(body)
    text = raw.decode("utf-8", "replace")
    posts = set(re.findall(r'name="post\.([0-9a-f-]{36})"', text))
    patches = set(re.findall(r'name="patch\.([0-9a-f-]{36})"', text))
    if not posts and not patches and text.startswith("{"):
        try:
            d = json.loads(text)
            if isinstance(d, dict) and ("post" in d or "patch" in d):
                posts = {r.get("id") for r in d.get("post", [])}
                patches = {r.get("id") for r in d.get("patch", [])}
            elif isinstance(d, dict) and "id" in d:
                posts = {d["id"]}
        except Exception:
            pass
    return sorted(posts), sorted(patches)


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def handle_any(self):
        t = time.time()
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else b""
        posts, patches = ([], [])
        try:
            posts, patches = count_runs(body, self.headers.get("Content-Encoding"))
        except Exception as e:
            posts, patches = [f"parse-error {e}"], []
        with lock:
            logf.write(json.dumps({"t": t, "method": self.command, "path": re.sub(r"[0-9a-f-]{36}", "<id>", self.path), "host": self.headers.get("Host"),
                                   "bytes": n, "ctype": (self.headers.get("Content-Type") or "")[:40], "enc": self.headers.get("Content-Encoding"),
                                   "posts": posts, "patches": patches, "mode": args.mode}) + "\n")
            logf.flush()
        if args.mode == "hang":
            time.sleep(3600)
            return
        if args.mode == "slow":
            time.sleep(args.delay)
        if args.mode == "error500" and self.command != "GET":
            data = b'{"detail":"boom"}'
            self.send_response(500)
        else:
            data = b"{}"
            self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_PATCH = do_PUT = handle_any


srv = ThreadingHTTPServer(("127.0.0.1", args.port), H)
srv.daemon_threads = True
print("ready", flush=True)
srv.serve_forever()
