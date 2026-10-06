import base64
import copy
import hashlib
import hmac
import http.client
import json
import queue
import random
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PROTOCOL_VERSION = "1.0"
TERMINAL = ("TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED")
INTERRUPTED = ("TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED")
JSON_TYPES = ("application/json", "application/a2a+json")

ERRORS = {
    "JSONParseError": (-32700, 400, "INVALID_ARGUMENT", "Invalid JSON payload"),
    "InvalidRequestError": (-32600, 400, "INVALID_ARGUMENT", "Request payload validation error"),
    "MethodNotFoundError": (-32601, 404, "NOT_FOUND", "Method not found"),
    "InvalidParamsError": (-32602, 400, "INVALID_ARGUMENT", "Invalid parameters"),
    "InternalError": (-32603, 500, "INTERNAL", "Internal error"),
    "TaskNotFoundError": (-32001, 404, "NOT_FOUND", "Task not found"),
    "TaskNotCancelableError": (-32002, 400, "FAILED_PRECONDITION", "Task cannot be canceled"),
    "PushNotificationNotSupportedError": (-32003, 400, "FAILED_PRECONDITION", "Push notifications are not supported"),
    "UnsupportedOperationError": (-32004, 400, "FAILED_PRECONDITION", "This operation is not supported"),
    "ContentTypeNotSupportedError": (-32005, 400, "INVALID_ARGUMENT", "Content type not supported"),
    "ExtendedAgentCardNotConfiguredError": (-32007, 400, "FAILED_PRECONDITION", "Extended agent card is not configured"),
    "VersionNotSupportedError": (-32009, 400, "FAILED_PRECONDITION", "Protocol version not supported"),
}


class A2AError(Exception):
    def __init__(self, name, detail=None, metadata=None):
        super().__init__(name)
        self.name = name
        self.detail = detail
        self.metadata = metadata or {}

    @property
    def code(self):
        return ERRORS[self.name][0]

    @property
    def http_status(self):
        return ERRORS[self.name][1]

    def details(self):
        if self.name in ("JSONParseError", "InvalidRequestError", "MethodNotFoundError", "InternalError"):
            return []
        if self.name == "InvalidParamsError":
            return [{"@type": "type.googleapis.com/google.rpc.BadRequest", "fieldViolations": [self.detail]}]
        reason = self.name[:-5] if self.name.endswith("Error") else self.name
        reason = "".join(f"_{c}" if c.isupper() else c for c in reason).lstrip("_").upper()
        info = {"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": reason, "domain": "a2a-protocol.org"}
        if self.metadata:
            info["metadata"] = self.metadata
        return [info]

    def jsonrpc(self):
        error = {"code": self.code, "message": ERRORS[self.name][3]}
        details = self.details()
        if details:
            error["data"] = details
        return error

    def status(self):
        error = {"code": self.http_status, "status": ERRORS[self.name][2], "message": ERRORS[self.name][3]}
        details = self.details()
        if details:
            error["details"] = details
        return {"error": error}


class Clock:
    def __init__(self, start):
        self.now_ms = start * 1000
        self.lock = threading.Lock()

    def stamp(self, step_ms=250):
        with self.lock:
            self.now_ms += step_ms
            seconds, ms = divmod(self.now_ms, 1000)
            return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(seconds)) + f".{ms:03d}Z"


class Ids:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.lock = threading.Lock()

    def new(self):
        with self.lock:
            return str(uuid.UUID(int=self.rng.getrandbits(128), version=4))


def prune(value):
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            item = prune(item)
            if item is None or item == "" or item == [] or item == {}:
                continue
            out[key] = item
        return out
    if isinstance(value, list):
        return [prune(item) for item in value]
    return value


MESSAGE_FIELDS = ("messageId", "contextId", "taskId", "role", "parts", "metadata", "extensions", "referenceTaskIds")


def ordered_message(message, **changes):
    merged = dict(message, **changes)
    return {key: merged[key] for key in MESSAGE_FIELDS if key in merged}


def text_part(text):
    return {"text": text}


def data_part(data, media_type="application/json"):
    return {"data": data, "mediaType": media_type}


def raw_part(content, media_type, filename=None):
    return prune({"raw": base64.b64encode(content).decode("ascii"), "filename": filename, "mediaType": media_type})


def url_part(url, media_type, filename=None):
    return prune({"url": url, "filename": filename, "mediaType": media_type})


def part_media_type(part):
    if "mediaType" in part:
        return part["mediaType"]
    if "text" in part:
        return "text/plain"
    if "data" in part:
        return "application/json"
    return "application/octet-stream"


def jcs(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_card(card, key, kid):
    payload = {k: v for k, v in card.items() if k != "signatures"}
    header = {"alg": "HS256", "typ": "JOSE", "kid": kid}
    protected = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{protected}.{b64url(jcs(payload))}".encode("ascii")
    signature = b64url(hmac.new(key, signing_input, hashlib.sha256).digest())
    signed = dict(card)
    signed["signatures"] = [{"protected": protected, "signature": signature}]
    return signed, {"canonical": jcs(payload).decode("utf-8"), "signingInput": signing_input.decode("ascii")}


def verify_card(card, key):
    signature = card["signatures"][0]
    payload = {k: v for k, v in card.items() if k != "signatures"}
    signing_input = f"{signature['protected']}.{b64url(jcs(payload))}".encode("ascii")
    expected = b64url(hmac.new(key, signing_input, hashlib.sha256).digest())
    return hmac.compare_digest(expected, signature["signature"])


class Turn:
    def __init__(self, agent, task, message):
        self.agent = agent
        self.task = task
        self.message = message

    def text(self):
        return " ".join(part["text"] for part in self.message.get("parts", []) if "text" in part).strip()

    def agent_message(self, text):
        return {"messageId": self.agent.ids.new(), "contextId": self.task["contextId"], "taskId": self.task["id"], "role": "ROLE_AGENT", "parts": [text_part(text)]}

    def status(self, state, text=None):
        status = {"state": state}
        if text is not None:
            status["message"] = self.agent_message(text)
        status["timestamp"] = self.agent.clock.stamp()
        return {"statusUpdate": {"taskId": self.task["id"], "contextId": self.task["contextId"], "status": status}}

    def artifact(self, artifact_id, name, parts, append=False, last_chunk=False, description=None):
        artifact = prune({"artifactId": artifact_id, "name": name, "description": description, "parts": parts})
        event = {"taskId": self.task["id"], "contextId": self.task["contextId"], "artifact": artifact}
        if append:
            event["append"] = True
        if last_chunk:
            event["lastChunk"] = True
        return {"artifactUpdate": event}


class Agent:
    def __init__(self, name, port, card, behavior, seed, start, token=None, extended=None, signing_key=None, quick=None):
        self.name = name
        self.port = port
        self.base = f"http://localhost:{port}"
        self.card = card
        self.behavior = behavior
        self.quick = quick
        self.ids = Ids(seed)
        self.clock = Clock(start)
        self.token = token
        self.extended = extended
        self.signing_key = signing_key
        self.tasks = {}
        self.order = []
        self.lock = threading.RLock()
        self.changed = threading.Condition(self.lock)
        self.subscribers = {}
        self.push_configs = {}
        self.gates = {}
        self.gate_next = False
        self.approvals = {}
        self.applied = {}

    def published_card(self):
        if self.signing_key:
            return sign_card(self.card, self.signing_key, f"{self.name}-key-1")[0]
        return self.card

    def snapshot(self, task, history_length=None):
        out = copy.deepcopy({key: value for key, value in task.items() if not key.startswith("_")})
        if history_length is not None:
            out["history"] = out.get("history", [])[-history_length:] if history_length > 0 else []
        return prune(out)

    def authenticated(self, headers):
        return not self.token or headers.get("Authorization") == f"Bearer {self.token}"

    def find(self, task_id):
        task = self.tasks.get(task_id)
        if task is None:
            raise A2AError("TaskNotFoundError", metadata={"taskId": task_id})
        return task

    def validate_message(self, request):
        message = request.get("message")
        if not isinstance(message, dict):
            raise A2AError("InvalidParamsError", {"field": "message", "description": "A message is required"})
        if not message.get("messageId"):
            raise A2AError("InvalidParamsError", {"field": "message.messageId", "description": "messageId is required"})
        if message.get("role") != "ROLE_USER":
            raise A2AError("InvalidParamsError", {"field": "message.role", "description": "Client messages use ROLE_USER"})
        if not message.get("parts"):
            raise A2AError("InvalidParamsError", {"field": "message.parts", "description": "At least one part is required"})
        accepted = self.card["defaultInputModes"]
        for part in message["parts"]:
            if part_media_type(part) not in accepted:
                raise A2AError("ContentTypeNotSupportedError", metadata={"mediaType": part_media_type(part)})
        return message

    def send(self, request, stream=None):
        message = self.validate_message(request)
        configuration = request.get("configuration", {})
        with self.lock:
            if message.get("taskId"):
                task = self.find(message["taskId"])
                if message.get("contextId") and message["contextId"] != task["contextId"]:
                    raise A2AError("InvalidParamsError", {"field": "message.contextId", "description": "contextId does not match the task"})
                if task["status"]["state"] in TERMINAL:
                    raise A2AError("UnsupportedOperationError", metadata={"taskId": task["id"], "state": task["status"]["state"]})
                message = ordered_message(message, contextId=task["contextId"])
                if "message" in task["status"]:
                    task.setdefault("history", []).append(task["status"].pop("message"))
                task.setdefault("history", []).append(message)
                resume = True
            else:
                if self.quick and self.quick(message):
                    context_id = message.get("contextId") or self.ids.new()
                    reply = {"messageId": self.ids.new(), "contextId": context_id, "role": "ROLE_AGENT", "parts": [text_part(self.quick(message))]}
                    if stream is not None:
                        stream.put({"message": reply})
                        stream.put(None)
                    return {"message": reply}
                context_id = message.get("contextId") or self.ids.new()
                task_id = self.ids.new()
                message = ordered_message(message, contextId=context_id, taskId=task_id)
                task = {"id": task_id, "contextId": context_id, "status": {"state": "TASK_STATE_SUBMITTED", "timestamp": self.clock.stamp()}, "history": [message]}
                self.tasks[task_id] = task
                self.order.append(task_id)
                resume = False
            push = configuration.get("taskPushNotificationConfig")
            if push:
                self.add_push(task["id"], push)
            if stream is not None:
                self.subscribers.setdefault(task["id"], []).append(stream)
                stream.put({"task": self.snapshot(task)})
            gated = self.gate_next
            self.gate_next = False
            if gated:
                self.gates[task["id"]] = threading.Semaphore(0)
            if resume:
                self.apply(task["id"], Turn(self, task, message).status("TASK_STATE_WORKING"))
            immediate_snapshot = self.snapshot(task, configuration.get("historyLength"))
            task["_busy"] = True
        threading.Thread(target=self.work, args=(task["id"], message, resume), daemon=True).start()
        if stream is not None:
            return None
        if configuration.get("returnImmediately"):
            return {"task": immediate_snapshot}
        with self.changed:
            self.changed.wait_for(lambda: task["status"]["state"] in TERMINAL + INTERRUPTED)
            return {"task": self.snapshot(task, configuration.get("historyLength"))}

    def busy(self, task_id):
        return self.tasks[task_id].get("_busy", False)

    def work(self, task_id, message, resume):
        task = self.tasks[task_id]
        events = self.behavior(Turn(self, task, message), resume)
        try:
            while True:
                gate = self.gates.get(task_id)
                if gate is not None:
                    gate.acquire()
                with self.lock:
                    if task["status"]["state"] in TERMINAL:
                        break
                    try:
                        event = next(events)
                    except StopIteration:
                        break
                    if isinstance(event, threading.Event):
                        waiting = event
                    else:
                        waiting = None
                        self.apply(task_id, event)
                if waiting is not None:
                    waiting.wait(timeout=10)
        finally:
            with self.changed:
                task["_busy"] = False
                self.changed.notify_all()

    def apply(self, task_id, event):
        task = self.tasks[task_id]
        if "statusUpdate" in event:
            if "message" in task["status"]:
                task.setdefault("history", []).append(task["status"]["message"])
            task["status"] = copy.deepcopy(event["statusUpdate"]["status"])
        if "artifactUpdate" in event:
            update = event["artifactUpdate"]
            artifacts = task.setdefault("artifacts", [])
            existing = next((a for a in artifacts if a["artifactId"] == update["artifact"]["artifactId"]), None)
            if existing is not None and update.get("append"):
                existing["parts"].extend(copy.deepcopy(update["artifact"]["parts"]))
            elif existing is not None:
                artifacts[artifacts.index(existing)] = copy.deepcopy(update["artifact"])
            else:
                artifacts.append(copy.deepcopy(update["artifact"]))
        self.applied[task_id] = self.applied.get(task_id, 0) + 1
        self.broadcast(task_id, event)
        self.changed.notify_all()

    def broadcast(self, task_id, event):
        state = self.tasks[task_id]["status"]["state"]
        closes = "statusUpdate" in event and state in TERMINAL + ("TASK_STATE_INPUT_REQUIRED",)
        for stream in list(self.subscribers.get(task_id, [])):
            stream.put(copy.deepcopy(event))
            if closes:
                stream.put(None)
        if closes:
            self.subscribers.pop(task_id, None)
        for config in self.push_configs.get(task_id, []):
            self.deliver(config, event)

    def deliver(self, config, event):
        target = urlparse(config["url"])
        headers = {"Content-Type": "application/a2a+json"}
        auth = config.get("authentication")
        if auth:
            headers["Authorization"] = f"{auth['scheme']} {auth.get('credentials', '')}".strip()
        if config.get("token"):
            headers["X-A2A-Notification-Token"] = config["token"]
        body = json.dumps(event, indent=2).encode("utf-8")
        connection = http.client.HTTPConnection(target.hostname, target.port, timeout=10)
        connection.request("POST", target.path, body=body, headers=headers)
        connection.getresponse().read()
        connection.close()

    def add_push(self, task_id, config):
        if not self.card["capabilities"].get("pushNotifications"):
            raise A2AError("PushNotificationNotSupportedError")
        stored = prune({"id": config.get("id") or self.ids.new(), "taskId": task_id, "url": config["url"], "token": config.get("token"), "authentication": config.get("authentication")})
        self.push_configs.setdefault(task_id, []).append(stored)
        return stored

    def step(self, task_id, count=1):
        gate = self.gates[task_id]
        for _ in range(count):
            gate.release()

    def release(self, task_id):
        gate = self.gates.pop(task_id, None)
        if gate is not None:
            gate.release(1000)

    def wait_idle(self, task_id):
        with self.changed:
            self.changed.wait_for(lambda: not self.busy(task_id), timeout=10)

    def wait_applied(self, task_id, count):
        with self.changed:
            self.changed.wait_for(lambda: self.applied.get(task_id, 0) >= count, timeout=10)

    def cancel(self, task_id):
        with self.lock:
            task = self.find(task_id)
            if task["status"]["state"] in TERMINAL:
                raise A2AError("TaskNotCancelableError", metadata={"taskId": task_id, "state": task["status"]["state"]})
            turn = Turn(self, task, {})
            self.apply(task_id, turn.status("TASK_STATE_CANCELED", "Canceled at the client's request."))
            gate = self.gates.get(task_id)
            if gate is not None:
                gate.release()
            return self.snapshot(task)

    def subscribe(self, task_id, stream):
        with self.lock:
            task = self.find(task_id)
            if task["status"]["state"] in TERMINAL:
                raise A2AError("UnsupportedOperationError", metadata={"taskId": task_id, "state": task["status"]["state"]})
            self.subscribers.setdefault(task_id, []).append(stream)
            stream.put({"task": self.snapshot(task)})

    def list_tasks(self, params):
        context_id = params.get("contextId")
        state = params.get("status")
        page_size = min(int(params.get("pageSize") or 50), 100)
        history_length = params.get("historyLength")
        position = lambda task: (task["status"].get("timestamp", ""), task["id"])
        matches = sorted((self.tasks[t] for t in self.order if (not context_id or self.tasks[t]["contextId"] == context_id) and (not state or self.tasks[t]["status"]["state"] == state)), key=position, reverse=True)
        remaining = matches
        if params.get("pageToken"):
            token = params["pageToken"]
            try:
                cursor = json.loads(base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)))
                after = (cursor["ts"], cursor["id"])
            except (ValueError, KeyError, TypeError):
                raise A2AError("InvalidParamsError", {"field": "pageToken", "description": "pageToken did not come from this server"})
            remaining = [task for task in matches if position(task) < after]
        page = remaining[:page_size]
        next_token = ""
        if len(remaining) > page_size:
            cursor = json.dumps({"ts": page[-1]["status"].get("timestamp", ""), "id": page[-1]["id"]}, separators=(",", ":"))
            next_token = base64.urlsafe_b64encode(cursor.encode("utf-8")).decode("ascii").rstrip("=")
        tasks = []
        for task in page:
            snap = self.snapshot(task, int(history_length) if history_length is not None else None)
            if not params.get("includeArtifacts"):
                snap.pop("artifacts", None)
            tasks.append(snap)
        return {"tasks": tasks, "nextPageToken": next_token, "pageSize": page_size, "totalSize": len(matches)}

    def extended_card(self):
        if not self.card["capabilities"].get("extendedAgentCard"):
            raise A2AError("UnsupportedOperationError")
        if not self.extended:
            raise A2AError("ExtendedAgentCardNotConfiguredError")
        return self.extended


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    agent = None

    def log_message(self, *args):
        return

    def authenticate(self):
        if self.agent.authenticated({key: value for key, value in self.headers.items()}):
            return True
        body = json.dumps({"error": {"code": 401, "status": "UNAUTHENTICATED", "message": "Send Authorization: Bearer <token>"}}).encode("utf-8")
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.send_header("WWW-Authenticate", f'Bearer realm="{self.agent.name}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return False

    def write_json(self, status, payload, content_type):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def open_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def pump(self, stream, wrap):
        try:
            while True:
                event = stream.get(timeout=10)
                if event is None:
                    break
                self.wfile.write(f"data: {json.dumps(wrap(event))}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, queue.Empty):
            with self.agent.lock:
                for streams in self.agent.subscribers.values():
                    if stream in streams:
                        streams.remove(stream)

    def check_version(self):
        version = self.headers.get("A2A-Version") or parse_qs(urlparse(self.path).query).get("A2A-Version", [""])[0]
        if version != PROTOCOL_VERSION:
            raise A2AError("VersionNotSupportedError", metadata={"requested": version or "0.3 (no header)", "supported": PROTOCOL_VERSION})

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/.well-known/agent-card.json":
            return self.write_json(200, self.agent.published_card(), "application/json")
        if url.path == "/approvals":
            return self.write_json(200, {"pending": sorted(self.agent.approvals)}, "application/json")
        if url.path.startswith("/a2a/rest/"):
            return self.rest("GET", url)
        self.write_json(404, {"error": {"code": 404, "status": "NOT_FOUND", "message": "No such path"}}, "application/json")

    def do_DELETE(self):
        url = urlparse(self.path)
        if url.path.startswith("/a2a/rest/"):
            return self.rest("DELETE", url)
        self.write_json(404, {"error": {"code": 404, "status": "NOT_FOUND", "message": "No such path"}}, "application/json")

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        if url.path == "/a2a/jsonrpc":
            return self.jsonrpc(raw)
        if url.path.startswith("/a2a/rest/"):
            return self.rest("POST", url, raw)
        if url.path.startswith("/approve/"):
            task_id = url.path.rsplit("/", 1)[-1]
            approved = self.agent.approvals.pop(task_id, None)
            if approved is None:
                return self.write_json(404, {"approved": False}, "application/json")
            approved.set()
            return self.write_json(200, {"approved": True, "taskId": task_id}, "application/json")
        self.write_json(404, {"error": {"code": 404, "status": "NOT_FOUND", "message": "No such path"}}, "application/json")

    def jsonrpc(self, raw):
        request_id = None
        if not self.authenticate():
            return None
        try:
            try:
                request = json.loads(raw)
            except ValueError:
                raise A2AError("JSONParseError")
            if not isinstance(request, dict) or request.get("jsonrpc") != "2.0" or "method" not in request:
                raise A2AError("InvalidRequestError")
            request_id = request.get("id")
            self.check_version()
            method = request["method"]
            params = request.get("params") or {}
            agent = self.agent
            if method == "SendMessage":
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.send(params)}, "application/json")
            if method == "SendStreamingMessage":
                if not agent.card["capabilities"].get("streaming"):
                    raise A2AError("UnsupportedOperationError")
                stream = queue.Queue()
                agent.send(params, stream)
                self.open_stream()
                return self.pump(stream, lambda event: {"jsonrpc": "2.0", "id": request_id, "result": event})
            if method == "GetTask":
                task = agent.find(params.get("id", ""))
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.snapshot(task, params.get("historyLength"))}, "application/json")
            if method == "ListTasks":
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.list_tasks(params)}, "application/json")
            if method == "CancelTask":
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.cancel(params.get("id", ""))}, "application/json")
            if method == "SubscribeToTask":
                if not agent.card["capabilities"].get("streaming"):
                    raise A2AError("UnsupportedOperationError")
                stream = queue.Queue()
                agent.subscribe(params.get("id", ""), stream)
                self.open_stream()
                return self.pump(stream, lambda event: {"jsonrpc": "2.0", "id": request_id, "result": event})
            if method.endswith("PushNotificationConfig") or method.endswith("PushNotificationConfigs"):
                if not agent.card["capabilities"].get("pushNotifications"):
                    raise A2AError("PushNotificationNotSupportedError")
            if method == "CreateTaskPushNotificationConfig":
                with agent.lock:
                    agent.find(params.get("taskId", ""))
                    return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.add_push(params["taskId"], params)}, "application/json")
            if method == "GetTaskPushNotificationConfig":
                config = next((c for c in agent.push_configs.get(params.get("taskId"), []) if c["id"] == params.get("id")), None)
                if config is None:
                    raise A2AError("TaskNotFoundError", metadata={"taskId": params.get("taskId", "")})
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": config}, "application/json")
            if method == "ListTaskPushNotificationConfigs":
                agent.find(params.get("taskId", ""))
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": prune({"configs": agent.push_configs.get(params["taskId"], [])})}, "application/json")
            if method == "DeleteTaskPushNotificationConfig":
                configs = agent.push_configs.get(params.get("taskId"), [])
                agent.push_configs[params.get("taskId")] = [c for c in configs if c["id"] != params.get("id")]
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": {}}, "application/json")
            if method == "GetExtendedAgentCard":
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.extended_card()}, "application/json")
            raise A2AError("MethodNotFoundError")
        except A2AError as error:
            return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "error": error.jsonrpc()}, "application/json")

    def rest_push(self, verb, route, body):
        agent = self.agent
        task_id, _, rest = route[len("/tasks/"):].partition("/pushNotificationConfigs")
        config_id = rest[1:] if rest.startswith("/") else None
        if not agent.card["capabilities"].get("pushNotifications"):
            raise A2AError("PushNotificationNotSupportedError")
        configs = agent.push_configs.get(task_id, [])
        if verb == "POST" and config_id is None:
            with agent.lock:
                agent.find(task_id)
                return self.write_json(200, agent.add_push(task_id, body), "application/a2a+json")
        if verb == "GET" and config_id is None:
            agent.find(task_id)
            return self.write_json(200, prune({"configs": configs}), "application/a2a+json")
        if verb == "GET":
            config = next((c for c in configs if c["id"] == config_id), None)
            if config is None:
                raise A2AError("TaskNotFoundError", metadata={"taskId": task_id})
            return self.write_json(200, config, "application/a2a+json")
        if verb == "DELETE" and config_id is not None:
            agent.push_configs[task_id] = [c for c in configs if c["id"] != config_id]
            return self.write_json(200, {}, "application/a2a+json")
        raise A2AError("MethodNotFoundError")

    def rest(self, verb, url, raw=b""):
        route = url.path[len("/a2a/rest"):]
        query = {key: values[0] for key, values in parse_qs(url.query).items()}
        if not self.authenticate():
            return None
        try:
            self.check_version()
            agent = self.agent
            body = json.loads(raw) if raw else {}
            if verb == "POST" and route == "/message:send":
                return self.write_json(200, agent.send(body), "application/a2a+json")
            if verb == "POST" and route == "/message:stream":
                stream = queue.Queue()
                agent.send(body, stream)
                self.open_stream()
                return self.pump(stream, lambda event: event)
            if verb == "GET" and route == "/tasks":
                return self.write_json(200, agent.list_tasks(query), "application/a2a+json")
            if route.startswith("/tasks/") and route.endswith(":subscribe"):
                stream = queue.Queue()
                agent.subscribe(route[len("/tasks/"):-len(":subscribe")], stream)
                self.open_stream()
                return self.pump(stream, lambda event: event)
            if verb == "GET" and route.startswith("/tasks/") and "/" not in route[len("/tasks/"):]:
                history = query.get("historyLength")
                task = agent.find(route[len("/tasks/"):])
                return self.write_json(200, agent.snapshot(task, int(history) if history is not None else None), "application/a2a+json")
            if verb == "POST" and route.endswith(":cancel"):
                return self.write_json(200, agent.cancel(route[len("/tasks/"):-len(":cancel")]), "application/a2a+json")
            if verb == "GET" and route == "/extendedAgentCard":
                return self.write_json(200, agent.extended_card(), "application/a2a+json")
            if route.startswith("/tasks/") and "/pushNotificationConfigs" in route:
                return self.rest_push(verb, route, body)
            raise A2AError("MethodNotFoundError")
        except A2AError as error:
            payload = error.status()
            body = json.dumps(payload).encode("utf-8")
            self.send_response(error.http_status)
            self.send_header("Content-Type", "application/a2a+json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None


def serve(agent):
    handler = type(f"{agent.name}Handler", (Handler,), {"agent": agent})
    server = ThreadingHTTPServer(("127.0.0.1", agent.port), handler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
