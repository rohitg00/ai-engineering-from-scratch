import http.server
import os
import threading
import time

count = 0
started = time.time()
hog = []


def eat_memory():
    while True:
        hog.append(os.urandom(32 << 20))


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *ignored):
        pass

    def reply(self, code, text):
        body = (text + "\n").encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        global count
        if self.path == "/readyz":
            self.reply(200, "ok")
        elif self.path == "/exit":
            self.reply(200, "exiting with code 3")
            threading.Timer(0.2, lambda: os._exit(3)).start()
        elif self.path == "/oom":
            self.reply(200, "allocating until killed")
            threading.Thread(target=eat_memory, daemon=True).start()
        else:
            count += 1
            self.reply(200, f"count={count} process_age_s={time.time() - started:.1f}")

    do_POST = do_GET


http.server.ThreadingHTTPServer(("", 80), Handler).serve_forever()
