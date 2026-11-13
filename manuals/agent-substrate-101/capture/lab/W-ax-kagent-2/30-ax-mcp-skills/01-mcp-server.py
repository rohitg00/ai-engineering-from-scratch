import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOOL = {
    "name": "lab_fact",
    "description": "Returns the lab fact. Call it when you are asked for the lab fact.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
}


def answer(req):
    m = req.get("method", "")
    if m == "initialize":
        v = req.get("params", {}).get("protocolVersion", "2025-03-26")
        return {"protocolVersion": v, "capabilities": {"tools": {}}, "serverInfo": {"name": "lab-docs", "version": "0.1"}}
    if m == "tools/list":
        return {"tools": [TOOL]}
    if m == "tools/call":
        return {"content": [{"type": "text", "text": "lab-mcp-7421"}], "isError": False}
    if m == "ping":
        return {}
    return None


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def note(self, what):
        print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), self.client_address[0], self.command, self.path, what, flush=True)

    def send(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Mcp-Session-Id", "lab-session")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.note("get")
        if self.path == "/healthz":
            return self.send(200, b"ok", "text/plain")
        self.send(405)

    def do_DELETE(self):
        self.note("delete")
        self.send(200)

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        try:
            req = json.loads(raw)
        except ValueError:
            self.note("bad-json")
            return self.send(400)
        reqs = req if isinstance(req, list) else [req]
        out = []
        for r in reqs:
            self.note("method=" + str(r.get("method")) + " id=" + str(r.get("id")) + " name=" + str(r.get("params", {}).get("name", "")))
            if "id" not in r:
                continue
            res = answer(r)
            if res is None:
                out.append({"jsonrpc": "2.0", "id": r["id"], "error": {"code": -32601, "message": "method not found"}})
            else:
                out.append({"jsonrpc": "2.0", "id": r["id"], "result": res})
        if not out:
            return self.send(202)
        body = json.dumps(out if isinstance(req, list) else out[0]).encode()
        self.send(200, body)


ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
