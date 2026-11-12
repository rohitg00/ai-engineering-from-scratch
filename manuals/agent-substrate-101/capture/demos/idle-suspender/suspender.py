import argparse
import http.client
import http.server
import json
import subprocess
import sys
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument("--atespace", required=True)
parser.add_argument("--idle", type=float, default=60)
parser.add_argument("--listen", type=int, default=8080)
parser.add_argument("--first-port", type=int, default=18080)
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("actors", nargs="+")
args = parser.parse_args()

lock = threading.Condition()
actors = {}


def log(*fields):
    print(time.strftime("%Y-%m-%dT%H:%M:%S"), *fields, sep="\t", flush=True)


def cli(*words):
    started = time.time()
    done = subprocess.run(["kubectl", "ate", *words, "-a", args.atespace], capture_output=True, text=True)
    return done, time.time() - started


def actor_state(name):
    done, _ = cli("get", "actor", name, "-o", "json")
    try:
        return json.loads(done.stdout[done.stdout.index("{"):])["status"]["state"]
    except ValueError:
        return "UNKNOWN"


def start_proxies():
    for offset, name in enumerate(args.actors):
        port = args.first_port + offset
        subprocess.Popen(
            ["kubectl", "ate", "proxy", "actor", name, "-a", args.atespace, f"{port}:80"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        running = actor_state(name) == "ACTOR_STATE_RUNNING"
        actors[name] = {"port": port, "last": time.time(), "open": 0, "running": running, "suspending": False}
        log("watch", name, f"port={port}", f"running={running}")
    time.sleep(3)


class Front(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *ignored):
        pass

    def forward(self):
        name, _, rest = self.path.lstrip("/").partition("/")
        actor = actors.get(name)
        if actor is None:
            self.send_error(404, "unknown actor")
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        with lock:
            while actor["suspending"]:
                lock.wait()
            actor["open"] += 1
            woke = not actor["running"]
        started = time.time()
        try:
            upstream = http.client.HTTPConnection("127.0.0.1", actor["port"], timeout=120)
            upstream.request(self.command, "/" + rest, body=body, headers={"Content-Type": self.headers.get("Content-Type", "text/plain")})
            reply = upstream.getresponse()
            status, payload = reply.status, reply.read()
            upstream.close()
        except OSError as error:
            status, payload = 502, str(error).encode()
        with lock:
            actor["open"] -= 1
            actor["last"] = time.time()
            if status == 200:
                actor["running"] = True
        log("request", name, status, f"{time.time() - started:.3f}", "resumed" if woke and status == 200 else "warm")
        self.send_response(status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PUT = do_DELETE = forward


def sweep():
    while True:
        time.sleep(1)
        now = time.time()
        with lock:
            due = [name for name, actor in actors.items() if actor["running"] and actor["open"] == 0 and now - actor["last"] >= args.idle]
            for name in due:
                actors[name]["suspending"] = not args.dry_run
        for name in due:
            idle = now - actors[name]["last"]
            if args.dry_run:
                log("would-suspend", name, f"idle={idle:.0f}s")
                continue
            done, seconds = cli("suspend", "actor", name)
            with lock:
                if done.returncode == 0:
                    actors[name]["running"] = False
                actors[name]["suspending"] = False
                lock.notify_all()
            log("suspend", name, f"idle={idle:.0f}s", f"{seconds:.3f}", "ok" if done.returncode == 0 else done.stderr.strip()[-120:])


start_proxies()
threading.Thread(target=sweep, daemon=True).start()
log("listen", f"http://127.0.0.1:{args.listen}/<actor>/<path>", f"idle={args.idle:.0f}s")
try:
    http.server.ThreadingHTTPServer(("127.0.0.1", args.listen), Front).serve_forever()
except KeyboardInterrupt:
    sys.exit(0)
