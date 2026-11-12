import os, resource, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

started = time.time()
state = {"count": 0, "ready": False}
data = {i: os.urandom(100) for i in range(1_000_000)}
os.makedirs("/data", exist_ok=True)
db = sqlite3.connect("/data/app.db", check_same_thread=False)
db.execute("create table if not exists hits (n integer)")
db.commit()
state["ready"] = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/readyz":
            self.send_response(200 if state["ready"] else 503)
            self.end_headers()
            return
        state["count"] += 1
        db.execute("insert into hits values (?)", (state["count"],))
        db.commit()
        rows = db.execute("select count(*) from hits").fetchone()[0]
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024
        body = f"python count={state['count']} sqlite_rows={rows} dict={len(data)} maxrss_mib={rss} pid={os.getpid()} process_age_s={time.time() - started:.1f}\n"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body.encode())


ThreadingHTTPServer(("", 80), Handler).serve_forever()
