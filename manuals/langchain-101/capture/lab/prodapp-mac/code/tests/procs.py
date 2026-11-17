import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).parent.parent
DSN = os.environ.get("DATABASE_URL", "postgresql:///lc_prod")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def clean_env(**extra):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH", "LANGCHAIN"))}
    env.update({k: str(v) for k, v in extra.items() if v is not None})
    return env


class Server:
    def __init__(self, run_dir, name, graceful=10, **env):
        self.port = free_port()
        self.url = f"http://127.0.0.1:{self.port}"
        self.log = open(Path(run_dir) / f"{name}.server.log", "a")
        env.setdefault("OTEL_FILE", str(Path(run_dir) / f"{name}.spans.jsonl"))
        env.setdefault("LOG_FILE", str(Path(run_dir) / f"{name}.log.jsonl"))
        command = [sys.executable, "-m", "uvicorn", "app.server:create_app", "--factory",
                   "--port", str(self.port), "--timeout-graceful-shutdown", str(graceful)]
        self.proc = subprocess.Popen(command, cwd=ROOT, env=clean_env(**env), stdout=self.log, stderr=self.log)
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                if httpx.get(f"{self.url}/healthz", timeout=0.5).status_code == 200:
                    return
            except httpx.HTTPError:
                time.sleep(0.1)
        self.stop()
        raise RuntimeError(f"server {name} did not start")

    def term(self, timeout=30):
        self.proc.send_signal(signal.SIGTERM)
        return self.proc.wait(timeout)

    def kill(self):
        self.proc.kill()
        return self.proc.wait(10)

    def stop(self):
        if self.proc.poll() is None:
            self.term()
        self.log.close()


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if not line.startswith(":"))
        if lines:
            events.append((lines["event"], json.loads(lines["data"])))
    return events


class Http:
    def __init__(self, url, token):
        self.http = httpx.AsyncClient(base_url=url, headers={"Authorization": f"Bearer {token}"}, timeout=60)

    async def thread(self):
        return (await self.http.post("/threads")).json()["thread_id"]

    async def post_sse(self, path, body):
        response = await self.http.post(path, json=body)
        return parse_sse(response.text)

    async def say(self, thread_id, text):
        return await self.post_sse(f"/threads/{thread_id}/runs", {"message": text})

    async def approve(self, thread_id, decision="approve"):
        return await self.post_sse(f"/threads/{thread_id}/approve", {"decision": decision})

    async def state(self, thread_id):
        return (await self.http.get(f"/threads/{thread_id}/state")).json()


def sql(query, *params):
    with psycopg.connect(DSN, autocommit=True, row_factory=dict_row) as conn:
        cur = conn.execute(query, params)
        return cur.fetchall() if cur.description else None


def reset_user(user):
    sql("delete from refunds where order_id like %s", f"ORD-{user}-%")
    sql("delete from tickets where user_id = %s", user)
    sql("update orders set refunded_cents = 0 where user_id = %s", user)
