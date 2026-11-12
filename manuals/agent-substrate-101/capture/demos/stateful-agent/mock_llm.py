import http.server
import json
import os

EXPECTED = "Bearer " + os.environ["EXPECTED_KEY"]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        messages = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["messages"]
        users = [message["content"] for message in messages if message["role"] == "user"]
        key = "real key" if self.headers.get("Authorization") == EXPECTED else "wrong key"
        answer = f"turn {len(users)}: you said '{users[-1]}'. Your first message was '{users[0]}'. Gateway sent the {key}."
        body = json.dumps({"choices": [{"message": {"role": "assistant", "content": answer}}]}).encode()
        print(f"chat users={len(users)} auth={key}", flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


http.server.ThreadingHTTPServer(("", 8080), Handler).serve_forever()
