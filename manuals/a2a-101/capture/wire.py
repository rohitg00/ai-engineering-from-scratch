import http.client
import json

from a2a_ref import Ids


class Transcript:
    def __init__(self):
        self.lines = []
        self.count = 0
        self.streams = []

    def note(self, text):
        self.lines.append(f"# {text}")
        self.lines.append("")

    def text(self):
        return "\n".join(self.lines).rstrip() + "\n"


class Client:
    def __init__(self, transcript, seed=7):
        self.t = transcript
        self.ids = Ids(seed)
        self.rpc_id = 0

    def message(self, text=None, parts=None, task_id=None, context_id=None, reference=None):
        message = {"messageId": self.ids.new()}
        if context_id:
            message["contextId"] = context_id
        if task_id:
            message["taskId"] = task_id
        message["role"] = "ROLE_USER"
        message["parts"] = parts if parts is not None else [{"text": text}]
        if reference:
            message["referenceTaskIds"] = reference
        return message

    def exchange(self, title, port, method, path, headers=None, body=None, raw=None, frames=None, on_frame=None):
        self.t.count += 1
        number = self.t.count
        headers = dict(headers or {})
        payload = raw if raw is not None else (json.dumps(body).encode("utf-8") if body is not None else None)
        send_headers = {"Host": f"localhost:{port}"}
        send_headers.update(headers)
        if payload is not None:
            send_headers["Content-Length"] = str(len(payload))
        lines = self.t.lines
        lines.append(f"### {number} · {title}")
        lines.append(f"{method} {path} HTTP/1.1")
        for key, value in send_headers.items():
            if key != "Content-Length":
                lines.append(f"{key}: {value}")
        lines.append("")
        if raw is not None:
            lines.append(raw.decode("utf-8"))
            lines.append("")
        elif body is not None:
            lines.extend(json.dumps(body, indent=2, ensure_ascii=False).split("\n"))
            lines.append("")
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
        connection.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
        for key, value in send_headers.items():
            connection.putheader(key, value)
        connection.endheaders(payload)
        response = connection.getresponse()
        lines.append(f"HTTP/1.1 {response.status} {response.reason}")
        for key in ("Content-Type", "WWW-Authenticate"):
            value = response.getheader(key)
            if value:
                lines.append(f"{key}: {value}")
        lines.append("")
        if response.getheader("Content-Type", "").startswith("text/event-stream"):
            events = []
            while True:
                if frames is not None and len(events) >= frames:
                    lines.append(f"# the client closes the connection after {frames} events")
                    lines.append("")
                    response.close()
                    connection.close()
                    break
                line = response.fp.readline()
                if not line:
                    break
                line = line.decode("utf-8").rstrip("\n")
                if line.startswith("data: "):
                    events.append(json.loads(line[len("data: "):]))
                    lines.append(line)
                    lines.append("")
                    if on_frame is not None:
                        on_frame(len(events), events[-1])
            connection.close()
            self.t.streams.append({"exchange": number, "title": title, "events": events})
            return response.status, events
        data = response.read()
        connection.close()
        parsed = json.loads(data) if data else None
        if parsed is not None:
            lines.extend(json.dumps(parsed, indent=2, ensure_ascii=False).split("\n"))
            lines.append("")
        return response.status, parsed

    def rpc(self, title, port, method, params, headers=None, frames=None, version="1.0", on_frame=None):
        self.rpc_id += 1
        base = {"Content-Type": "application/json"}
        if version is not None:
            base["A2A-Version"] = version
        base.update(headers or {})
        if frames is not None or method in ("SendStreamingMessage", "SubscribeToTask"):
            base["Accept"] = "text/event-stream"
        body = {"jsonrpc": "2.0", "id": self.rpc_id, "method": method, "params": params}
        return self.exchange(title, port, "POST", "/a2a/jsonrpc", base, body, frames=frames, on_frame=on_frame)

    def rest(self, title, port, method, path, body=None, headers=None, frames=None):
        base = {"A2A-Version": "1.0"}
        if body is not None:
            base["Content-Type"] = "application/a2a+json"
        if frames is not None or path.endswith((":stream", ":subscribe")):
            base["Accept"] = "text/event-stream"
        base.update(headers or {})
        return self.exchange(title, port, method, f"/a2a/rest{path}", base, body, frames=frames)
