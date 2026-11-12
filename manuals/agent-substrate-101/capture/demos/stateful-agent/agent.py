import http.server
import json
import os
import sqlite3
import time
import urllib.request

DB = os.environ.get("AGENT_DB", "/data/agent.db")
MODEL_URL = os.environ["MODEL_URL"]
SCRATCH = "/tmp/scratch.txt"

started = time.time()
note = None


def database():
    connection = sqlite3.connect(DB)
    connection.execute("create table if not exists turns (n integer primary key, role text, content text)")
    return connection


def stored_turns():
    with database() as connection:
        return [{"role": role, "content": content} for role, content in connection.execute("select role, content from turns order by n")]


memory = stored_turns()
rehydrated = len(memory)


def ask_model(messages):
    request = urllib.request.Request(
        MODEL_URL,
        data=json.dumps({"model": "mock", "messages": messages}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer placeholder"},
    )
    with urllib.request.urlopen(request, timeout=30) as reply:
        return json.load(reply)["choices"][0]["message"]["content"]


def status():
    return {
        "memory_turns": len(memory),
        "db_turns": len(stored_turns()),
        "rehydrated_from_db": rehydrated,
        "note": note,
        "scratch_file": os.path.exists(SCRATCH),
        "process_age_s": round(time.time() - started, 1),
    }


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *ignored):
        pass

    def reply(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/readyz":
            self.reply(200, {"ok": True})
        elif self.path == "/history":
            self.reply(200, {**status(), "memory": memory})
        else:
            self.reply(404, {"error": "use /chat, /note, /history"})

    def do_POST(self):
        global note
        text = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["message"]
        if self.path == "/note":
            note = text
            with open(SCRATCH, "w") as scratch:
                scratch.write(text)
            self.reply(200, status())
            return
        if self.path != "/chat":
            self.reply(404, {"error": "use /chat, /note, /history"})
            return
        memory.append({"role": "user", "content": text})
        try:
            answer = ask_model(memory)
        except OSError as error:
            memory.pop()
            self.reply(502, {"error": f"model call failed: {error}"})
            return
        memory.append({"role": "assistant", "content": answer})
        with database() as connection:
            connection.executemany("insert into turns (role, content) values (?, ?)", [("user", text), ("assistant", answer)])
        self.reply(200, {"reply": answer, **status()})


http.server.ThreadingHTTPServer(("", 80), Handler).serve_forever()
