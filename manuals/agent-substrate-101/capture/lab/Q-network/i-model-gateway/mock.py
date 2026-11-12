import json, os, http.server, time
NAME = os.environ.get("NAME", "backend")
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    wbufsize = 65536
    def reply(self, obj):
        out = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)
        self.wfile.flush()
    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(n)
        try:
            req = json.loads(body)
        except Exception:
            req = {}
        rec = {"t": time.strftime("%H:%M:%S"), "backend": NAME, "path": self.path, "model": req.get("model"), "authorization": self.headers.get("authorization"), "x_lab": self.headers.get("x-lab"), "host": self.headers.get("host")}
        print(json.dumps(rec), flush=True)
        text = "served_by=%s model=%s authorization=%s x_lab=%s" % (NAME, req.get("model"), self.headers.get("authorization"), self.headers.get("x-lab"))
        self.reply({"id": "chatcmpl-lab", "object": "chat.completion", "created": int(time.time()), "model": req.get("model"), "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}})
    def do_GET(self):
        self.reply({"object": "list", "data": []})
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(("", 80), H).serve_forever()
