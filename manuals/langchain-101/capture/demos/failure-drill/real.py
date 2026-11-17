import os
import socket
import sys
import threading
import time
from importlib.metadata import version

os.environ.setdefault("LANGSMITH_TRACING", "false")

OLLAMA = ("127.0.0.1", 11434)
MODEL = "qwen3:4b-instruct-2507-q4_K_M"
SETTINGS = {"temperature": 0, "seed": 42, "num_ctx": "server default 8192"}


def header(script):
    found = {}
    for name in ("langchain", "langchain-core", "langgraph", "langchain-ollama", "langchain-openai", "langsmith"):
        try:
            found[name] = version(name)
        except Exception:
            found[name] = None
    found["python"] = sys.version.split()[0]
    return {"kind": "header", "script": script, "model": MODEL, "settings": SETTINGS, "versions": found,
            "cpu_count": os.cpu_count(), "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def chat(model=MODEL, port=None, **kw):
    from langchain_ollama import ChatOllama
    params = dict(model=model, temperature=0, seed=42, base_url=f"http://127.0.0.1:{port or OLLAMA[1]}")
    params.update(kw)
    return ChatOllama(**params)


def chat_openai(model=MODEL, port=None, **kw):
    from langchain_openai import ChatOpenAI
    params = dict(model=model, base_url=f"http://127.0.0.1:{port or OLLAMA[1]}/v1", api_key="ollama-local-no-key", temperature=0, seed=42)
    params.update(kw)
    return ChatOpenAI(**params)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def _read_request(c):
    buf = b""
    while b"\r\n\r\n" not in buf:
        d = c.recv(65536)
        if not d:
            return None, None
        buf += d
    head, rest = buf.split(b"\r\n\r\n", 1)
    lines = head.split(b"\r\n")
    n = 0
    for ln in lines[1:]:
        if ln.lower().startswith(b"content-length:"):
            n = int(ln.split(b":", 1)[1].strip())
    while len(rest) < n:
        d = c.recv(65536)
        if not d:
            break
        rest += d
    path = lines[0].split(b" ")[1].decode()
    kept = [ln for ln in lines[1:] if not ln.lower().startswith(b"connection:")]
    req = b"\r\n".join([lines[0], *kept, b"Connection: close"]) + b"\r\n\r\n" + rest
    return req, path


class Relay:
    def __init__(self, schedule=None, default="pass", upstream=OLLAMA):
        self.schedule = list(schedule or [])
        self.default = default
        self.upstream = upstream
        self.arrivals = []
        self.lock = threading.Lock()
        self.sock = socket.socket()
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(64)
        self.port = self.sock.getsockname()[1]
        self.alive = True
        threading.Thread(target=self._accept, daemon=True).start()

    def _accept(self):
        while self.alive:
            try:
                c, _ = self.sock.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(c,), daemon=True).start()

    def _handle(self, c):
        try:
            req, path = _read_request(c)
            if req is None:
                c.close()
                return
            with self.lock:
                action = self.schedule.pop(0) if self.schedule else self.default
                self.arrivals.append({"t": time.time(), "path": path, "action": action})
            if action == "drop":
                c.shutdown(socket.SHUT_RDWR)
                c.close()
                return
            u = socket.create_connection(self.upstream)
            u.sendall(req)
            while True:
                d = u.recv(65536)
                if not d:
                    break
                c.sendall(d)
            u.close()
            c.close()
        except OSError:
            try:
                c.close()
            except OSError:
                pass

    def close(self):
        self.alive = False
        self.sock.close()
