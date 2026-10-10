"""Model demo interface: one HTML page, a JSON endpoint, and a Server-Sent Events stream.

See: phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md
Specs: WHATWG HTML server-sent events, RFC 9110 (HTTP semantics), RFC 6585 (429).
`python3 code/main.py` runs a self-test. Add `--serve` to serve on 127.0.0.1:8000.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import html
import json
import math
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import OrderedDict, deque
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Iterable, Iterator


MAX_CHARS = 500
MAX_BODY_BYTES = 4096
DRAIN_LIMIT_BYTES = 65536
BUCKET_CAPACITY = 5
REFILL_PER_SECOND = 0.5
DAILY_CALL_CAP = 2000
SERVE_TOKEN_DELAY = 0.04

EXAMPLES = (
    "The battery lasts all day and the screen is bright.",
    "The update broke my login and support never replied.",
    "The package arrived on Tuesday.",
)

POSITIVE = frozenset({
    "good", "great", "love", "excellent", "fast", "bright", "lasts",
    "happy", "easy", "works", "helpful", "clear", "reliable",
})
NEGATIVE = frozenset({
    "bad", "broke", "broken", "slow", "never", "hate", "poor",
    "crash", "crashes", "late", "worst", "confusing", "lost",
})

WORD_RE = re.compile(r"[a-z']+")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def classify(text: str) -> dict:
    words = WORD_RE.findall(text.lower())
    positive = sum(1 for word in words if word in POSITIVE)
    negative = sum(1 for word in words if word in NEGATIVE)
    score = (positive - negative) / max(1, positive + negative)
    if score > 0:
        label = "positive"
    elif score < 0:
        label = "negative"
    else:
        label = "neutral"
    return {
        "label": label,
        "score": round(score, 3),
        "positive_cues": positive,
        "negative_cues": negative,
        "words": len(words),
    }


def generate(text: str) -> Iterator[str]:
    result = classify(text)
    reply = (
        f"Label: {result['label']}. Positive cues: {result['positive_cues']}. "
        f"Negative cues: {result['negative_cues']}. Words read: {result['words']}."
    )
    parts = reply.split(" ")
    yield parts[0]
    for part in parts[1:]:
        yield " " + part


def predict(text: str) -> dict:
    result = classify(text)
    return {"label": result["label"], "score": result["score"], "reply": "".join(generate(text))}


class DemoError(Exception):
    def __init__(self, status: int, code: str, message: str, hint: str, headers: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint
        self.headers = dict(headers or {})


def error_body(err: DemoError, request_id: str) -> dict:
    return {
        "error": {
            "code": err.code,
            "message": err.message,
            "hint": err.hint,
            "request_id": request_id,
        }
    }


def check_body_size(content_length: str | None, max_bytes: int = MAX_BODY_BYTES) -> int:
    if content_length is None:
        raise DemoError(411, "length_required", "The request has no Content-Length header.",
                        "Send the body with a Content-Length header. Browsers add it for you.")
    try:
        size = int(content_length)
    except ValueError:
        size = -1
    if size < 0:
        raise DemoError(400, "bad_length", "The Content-Length header is not a valid number.",
                        "Send a whole number of bytes in Content-Length.")
    if size > max_bytes:
        raise DemoError(413, "body_too_large", f"The request body has {size} bytes. The limit is {max_bytes} bytes.",
                        "Send a shorter text.")
    return size


def parse_json_body(content_type: str | None, raw: bytes) -> dict:
    media_type = (content_type or "").split(";")[0].strip().lower()
    if media_type != "application/json":
        raise DemoError(415, "unsupported_media_type", "The request body is not JSON.",
                        "Send the body with Content-Type: application/json.")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise DemoError(400, "bad_json", "The request body is not valid JSON.",
                        'Send an object such as {"text": "The screen is bright."}.') from None
    if not isinstance(payload, dict):
        raise DemoError(400, "bad_json", "The JSON body is not an object.",
                        'Send an object such as {"text": "The screen is bright."}.')
    return payload


def validate_text(payload: dict, max_chars: int = MAX_CHARS) -> str:
    if "text" not in payload:
        raise DemoError(422, "missing_text", 'The field "text" is missing.', 'Add a "text" field with your input.')
    text = payload["text"]
    if not isinstance(text, str):
        raise DemoError(422, "text_not_string", 'The field "text" is not a string.', "Send the input as a string.")
    text = text.strip()
    if not text:
        raise DemoError(422, "empty_text", "The text is empty.", "Type a sentence or pick an example.")
    if len(text) > max_chars:
        raise DemoError(422, "text_too_long", f"The text has {len(text)} characters. The limit is {max_chars}.",
                        f"Shorten the text to {max_chars} characters or fewer.")
    if CONTROL_RE.search(text):
        raise DemoError(422, "control_characters", "The text contains control characters.",
                        "Remove the hidden characters, then send the text again.")
    return text


class FakeClock:
    def __init__(self, start: float = 1000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class TokenBucket:
    def __init__(self, capacity: float, refill_per_second: float, now: float):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        if refill_per_second <= 0:
            raise ValueError("refill_per_second must be positive")
        self.capacity = float(capacity)
        self.refill_per_second = float(refill_per_second)
        self.tokens = float(capacity)
        self.updated = now

    def take(self, now: float, cost: float = 1.0) -> float:
        elapsed = max(0.0, now - self.updated)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_second)
        self.updated = now
        if self.tokens >= cost:
            self.tokens -= cost
            return 0.0
        return (cost - self.tokens) / self.refill_per_second


class RateLimiter:
    def __init__(self, capacity: float, refill_per_second: float,
                 clock: Callable[[], float] = time.monotonic, max_clients: int = 10000):
        TokenBucket(capacity, refill_per_second, 0.0)
        self.capacity = capacity
        self.refill_per_second = refill_per_second
        self.clock = clock
        self.max_clients = max_clients
        self.buckets: OrderedDict[str, TokenBucket] = OrderedDict()
        self.lock = threading.Lock()

    def check(self, client_id: str) -> float:
        with self.lock:
            now = self.clock()
            bucket = self.buckets.pop(client_id, None)
            if bucket is None:
                bucket = TokenBucket(self.capacity, self.refill_per_second, now)
            self.buckets[client_id] = bucket
            while len(self.buckets) > self.max_clients:
                self.buckets.popitem(last=False)
            return bucket.take(now)


class UsageCap:
    def __init__(self, max_calls: int, window_seconds: float = 86400.0,
                 clock: Callable[[], float] = time.time):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self.clock = clock
        self.window = None
        self.used = 0
        self.lock = threading.Lock()

    def spend(self) -> float:
        with self.lock:
            now = self.clock()
            window = int(now // self.window_seconds)
            if window != self.window:
                self.window = window
                self.used = 0
            if self.used >= self.max_calls:
                return (window + 1) * self.window_seconds - now
            self.used += 1
            return 0.0


def plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def check_auth(authorization: str | None, expected_token: str | None) -> None:
    if not expected_token:
        return
    prefix = "Bearer "
    supplied = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
    if not hmac.compare_digest(supplied.encode("utf-8"), expected_token.encode("utf-8")):
        raise DemoError(401, "unauthorized", "The access token is missing or wrong.",
                        "Paste the access token that the demo owner gave you.",
                        {"WWW-Authenticate": 'Bearer realm="demo"'})


def sse_event(event: str, data: dict) -> bytes:
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


def parse_sse(raw: bytes) -> list[tuple[str, dict]]:
    events = []
    for block in raw.decode("utf-8").split("\n\n"):
        if not block.strip():
            continue
        name = "message"
        data_lines = []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                value = line[len("data:"):]
                data_lines.append(value[1:] if value.startswith(" ") else value)
        events.append((name, json.loads("\n".join(data_lines))))
    return events


MODEL_ERROR = {
    "code": "model_error",
    "message": "The model stopped before it finished the reply.",
    "hint": "Send the text again. If it fails again, try a shorter text.",
}


def stream_events(text: str, generate_fn: Callable[[str], Iterable[str]] = generate,
                  delay: float = 0.0, sleep: Callable[[float], None] = time.sleep) -> Iterator[bytes]:
    count = 0
    try:
        for token in generate_fn(text):
            yield sse_event("token", {"index": count, "text": token})
            count += 1
            if delay:
                sleep(delay)
    except Exception:
        yield sse_event("error", MODEL_ERROR)
        return
    result = classify(text)
    yield sse_event("done", {"label": result["label"], "score": result["score"], "tokens": count})


class PrivacyLog:
    def __init__(self, salt: bytes | None = None, keep: int = 1000,
                 sink: Callable[[str], None] | None = None):
        self.salt = salt or secrets.token_bytes(16)
        self.records: deque = deque(maxlen=keep)
        self.sink = sink

    def pseudonym(self, client_id: str) -> str:
        return hmac.new(self.salt, client_id.encode("utf-8"), hashlib.sha256).hexdigest()[:12]

    def record(self, request_id: str, route: str, client_id: str, status: int,
               input_chars: int, latency_ms: float, code: str | None = None) -> dict:
        entry = {
            "ts": round(time.time(), 3),
            "request_id": request_id,
            "route": route,
            "client": self.pseudonym(client_id),
            "status": status,
            "code": code,
            "input_chars": input_chars,
            "latency_ms": round(latency_ms, 1),
        }
        self.records.append(entry)
        if self.sink:
            self.sink(json.dumps(entry))
        return entry


@dataclass
class DemoConfig:
    max_chars: int = MAX_CHARS
    max_body_bytes: int = MAX_BODY_BYTES
    bucket_capacity: float = BUCKET_CAPACITY
    refill_per_second: float = REFILL_PER_SECOND
    daily_call_cap: int = DAILY_CALL_CAP
    token_delay: float = 0.0
    access_token: str | None = None


class DemoApp:
    def __init__(self, config: DemoConfig | None = None,
                 clock: Callable[[], float] = time.monotonic,
                 wall_clock: Callable[[], float] = time.time,
                 log_sink: Callable[[str], None] | None = None):
        self.config = config or DemoConfig()
        self.limiter = RateLimiter(self.config.bucket_capacity, self.config.refill_per_second, clock=clock)
        self.cap = UsageCap(self.config.daily_call_cap, clock=wall_clock)
        self.log = PrivacyLog(sink=log_sink)

    def admit(self, client_id: str, authorization: str | None) -> None:
        check_auth(authorization, self.config.access_token)
        wait = self.limiter.check(client_id)
        if wait > 0:
            seconds = max(1, math.ceil(wait))
            raise DemoError(429, "rate_limited", "You sent too many requests in a short time.",
                            f"Wait {plural(seconds, 'second')}, then try again.", {"Retry-After": str(seconds)})

    def read_text(self, content_type: str | None, body: bytes) -> str:
        return validate_text(parse_json_body(content_type, body), self.config.max_chars)

    def charge(self) -> None:
        wait = self.cap.spend()
        if wait > 0:
            seconds = max(1, math.ceil(wait))
            hours = max(1, math.ceil(seconds / 3600))
            raise DemoError(503, "usage_cap_reached", "The demo reached its usage limit for today.",
                            f"Try again in about {plural(hours, 'hour')}.", {"Retry-After": str(seconds)})


PAGE_STYLE = """
:root{color-scheme:light dark;--ink:#1a1a1a;--mute:#666;--line:#ccc;--accent:#3553ff;--warn:#b8870f;--bg:#fafaf5}
@media (prefers-color-scheme:dark){:root{--ink:#eee;--mute:#aaa;--line:#444;--accent:#8fa2ff;--warn:#e0b44a;--bg:#16161a}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px}
textarea,input[type=password]{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid var(--line);background:transparent;color:inherit}
.row,.examples{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;color:var(--mute);font-size:14px}
.row{justify-content:space-between}
button{font:inherit;padding:6px 12px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer}
button[type=submit]{background:var(--accent);color:var(--bg)}
button:disabled{opacity:.5;cursor:default}
#status[data-kind=error]{color:var(--warn)}
#output{white-space:pre-wrap;border:1px solid var(--line);padding:12px;min-height:3em}
.note{color:var(--mute);font-size:14px}
"""

PAGE_SCRIPT = """
const form = document.getElementById("demo-form");
const input = document.getElementById("text");
const counter = document.getElementById("count");
const statusLine = document.getElementById("status");
const output = document.getElementById("output");
const labelLine = document.getElementById("label");
const runButton = document.getElementById("run");
const streamBox = document.getElementById("stream");
const tokenBox = document.getElementById("token");
const maxChars = Number(input.getAttribute("maxlength"));
let timer = null;
let blockedUntil = 0;

function updateCount() { counter.textContent = input.value.length + " / " + maxChars; }

function setStatus(text, kind) { statusLine.textContent = text; statusLine.dataset.kind = kind; }

function startTimer(started) {
  timer = setInterval(function () {
    setStatus("Running the model: " + ((performance.now() - started) / 1000).toFixed(1) + " s", "busy");
  }, 100);
}

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function showError(err) {
  stopTimer();
  setStatus(err.message + " " + err.hint + " (request " + err.request_id + ")", "error");
}

function requestHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (tokenBox && tokenBox.value) { headers["Authorization"] = "Bearer " + tokenBox.value; }
  return headers;
}

async function readError(response) {
  const retry = Number(response.headers.get("Retry-After") || 0);
  if (retry > 0) { blockedUntil = Date.now() + retry * 1000; setTimeout(function () { runButton.disabled = false; }, retry * 1000); }
  try {
    const body = await response.json();
    return body.error;
  } catch (e) {
    return { message: "The server returned status " + response.status + ".", hint: "Try again in a moment.", request_id: response.headers.get("X-Request-Id") || "unknown" };
  }
}

function parseFrame(frame) {
  let event = "message";
  const data = [];
  frame.split("\\n").forEach(function (line) {
    if (line.startsWith("event:")) { event = line.slice(6).trim(); }
    else if (line.startsWith("data:")) { data.push(line.slice(5).replace(/^ /, "")); }
  });
  return { event: event, data: JSON.parse(data.join("\\n")) };
}

async function runPlain(text, started) {
  const response = await fetch("/api/predict", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ text: text }) });
  if (!response.ok) { showError(await readError(response)); return; }
  const body = await response.json();
  stopTimer();
  output.textContent = body.reply;
  labelLine.textContent = "Label: " + body.label + " (score " + body.score + ")";
  setStatus("Done in " + (performance.now() - started).toFixed(0) + " ms.", "done");
}

async function runStream(text, started) {
  const response = await fetch("/api/stream", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ text: text }) });
  if (!response.ok) { showError(await readError(response)); return; }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let first = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) { break; }
    buffer += decoder.decode(chunk.value, { stream: true });
    let cut = buffer.indexOf("\\n\\n");
    while (cut >= 0) {
      const frame = parseFrame(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf("\\n\\n");
      if (frame.event === "token") {
        if (!first) { first = performance.now() - started; stopTimer(); setStatus("First token after " + first.toFixed(0) + " ms. Receiving tokens.", "busy"); }
        output.textContent += frame.data.text;
      } else if (frame.event === "done") {
        labelLine.textContent = "Label: " + frame.data.label + " (score " + frame.data.score + ")";
        setStatus("Done. First token " + first.toFixed(0) + " ms. Total " + (performance.now() - started).toFixed(0) + " ms.", "done");
      } else if (frame.event === "error") {
        showError(Object.assign({ request_id: response.headers.get("X-Request-Id") || "unknown" }, frame.data));
      }
    }
  }
}

input.addEventListener("input", updateCount);
document.querySelectorAll("[data-example]").forEach(function (button) {
  button.addEventListener("click", function () { input.value = button.dataset.example; updateCount(); input.focus(); });
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { showError({ message: "The text is empty.", hint: "Type a sentence or pick an example.", request_id: "none" }); return; }
  runButton.disabled = true;
  output.textContent = "";
  labelLine.textContent = "";
  const started = performance.now();
  startTimer(started);
  try {
    if (streamBox.checked) { await runStream(text, started); } else { await runPlain(text, started); }
  } catch (e) {
    showError({ message: "The request did not reach the server.", hint: "Check the connection, then try again.", request_id: "none" });
  } finally {
    stopTimer();
    runButton.disabled = Date.now() < blockedUntil;
  }
});

updateCount();
"""

PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toy sentiment demo</title>
<style>__STYLE__</style>
</head>
<body>
<main>
<h1>Toy sentiment demo</h1>
<p class="note">A small keyword model labels your text. Do not paste private data. The server keeps only the length of your text, never the text.</p>
<form id="demo-form">
<label for="text">Text to label</label>
<textarea id="text" name="text" rows="5" maxlength="__MAX__" required placeholder="Type a sentence, or pick an example."></textarea>
<div class="row"><span id="count">0 / __MAX__</span><label><input type="checkbox" id="stream" checked> Show tokens as they arrive</label></div>
__TOKEN_FIELD__
<div class="examples"><span>Examples:</span>__EXAMPLES__</div>
<button id="run" type="submit">Run model</button>
</form>
<h2>Result</h2>
<p id="status" role="status" aria-live="polite">Ready.</p>
<p id="label"></p>
<pre id="output"></pre>
</main>
<script>__SCRIPT__</script>
</body>
</html>
"""

TOKEN_FIELD = '<label for="token">Access token</label><input id="token" type="password" autocomplete="off">'


def csp_hash(source: str) -> str:
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode("ascii") + "'"


CONTENT_SECURITY_POLICY = (
    f"default-src 'none'; script-src {csp_hash(PAGE_SCRIPT)}; style-src {csp_hash(PAGE_STYLE)}; "
    "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
)


def render_page(config: DemoConfig) -> str:
    buttons = "".join(
        f'<button type="button" data-example="{html.escape(text, quote=True)}">Example {index}</button>'
        for index, text in enumerate(EXAMPLES, start=1)
    )
    return (PAGE_TEMPLATE
            .replace("__STYLE__", PAGE_STYLE)
            .replace("__SCRIPT__", PAGE_SCRIPT)
            .replace("__MAX__", str(config.max_chars))
            .replace("__TOKEN_FIELD__", TOKEN_FIELD if config.access_token else "")
            .replace("__EXAMPLES__", buttons))


class DemoServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], app: DemoApp):
        super().__init__(address, DemoHandler)
        self.app = app


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "ModelDemo/1.0"
    routes = ("/api/predict", "/api/stream")
    timeout = 10

    def log_message(self, format: str, *args) -> None:
        return

    def send_bytes(self, status: int, body: bytes, content_type: str, request_id: str,
                   extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Request-Id", request_id)
        for name, value in (extra or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, payload: dict, request_id: str, extra: dict | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8", request_id, extra)

    def send_error_json(self, err: DemoError, request_id: str) -> None:
        self.send_json(err.status, error_body(err, request_id), request_id, err.headers)

    def do_GET(self) -> None:
        request_id = uuid.uuid4().hex[:12]
        if self.path == "/":
            page = render_page(self.server.app.config).encode("utf-8")
            self.send_bytes(200, page, "text/html; charset=utf-8", request_id,
                            {"Content-Security-Policy": CONTENT_SECURITY_POLICY})
        elif self.path == "/healthz":
            self.send_json(200, {"ok": True}, request_id)
        else:
            self.send_error_json(DemoError(404, "not_found", "This page does not exist.", "Open / to use the demo."),
                                 request_id)

    def drain(self, declared: int) -> None:
        remaining = min(max(declared, 0), DRAIN_LIMIT_BYTES)
        while remaining > 0:
            chunk = self.rfile.read(min(remaining, 8192))
            if not chunk:
                break
            remaining -= len(chunk)

    def do_POST(self) -> None:
        app = self.server.app
        request_id = uuid.uuid4().hex[:12]
        client_id = self.client_address[0]
        started = time.perf_counter()
        route = self.path if self.path in self.routes else "other"
        status, code, chars = 200, None, 0
        try:
            declared = self.headers.get("Content-Length")
            try:
                if route == "other":
                    raise DemoError(404, "not_found", "This endpoint does not exist.",
                                    "Send requests to /api/predict or /api/stream.")
                size = check_body_size(declared, app.config.max_body_bytes)
            except DemoError:
                self.drain(int(declared) if declared and declared.isdigit() else 0)
                raise
            body = self.rfile.read(size)
            app.admit(client_id, self.headers.get("Authorization"))
            text = app.read_text(self.headers.get("Content-Type"), body)
            chars = len(text)
            app.charge()
            if route == "/api/predict":
                self.send_json(200, predict(text), request_id)
            else:
                code = self.send_stream(text, request_id)
        except DemoError as err:
            status, code = err.status, err.code
            self.send_error_json(err, request_id)
        except TimeoutError:
            status, code = 408, "request_timeout"
            self.close_connection = True
        except Exception:
            status, code = 500, "internal_error"
            self.send_error_json(DemoError(500, "internal_error", "The server failed on this request.",
                                           "Try again. Quote the request id if you report the problem."), request_id)
        finally:
            latency_ms = (time.perf_counter() - started) * 1000
            app.log.record(request_id, route, client_id, status, chars, latency_ms, code)

    def send_stream(self, text: str, request_id: str) -> str | None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Request-Id", request_id)
        self.end_headers()
        events = stream_events(text, delay=self.server.app.config.token_delay)
        try:
            for frame in events:
                self.wfile.write(frame)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            events.close()
            return "client_closed"
        return None


def start_background_server(app: DemoApp, host: str = "127.0.0.1", port: int = 0) -> tuple[DemoServer, threading.Thread]:
    server = DemoServer((host, port), app)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
    thread.start()
    return server, thread


def stop_server(server: DemoServer, thread: threading.Thread) -> None:
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def http_request(url: str, method: str = "GET", payload: dict | None = None,
                 headers: dict | None = None, timeout: float = 5.0) -> tuple[int, dict, bytes]:
    data = None
    merged = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        merged.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, method=method, headers=merged)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read()
    except urllib.error.HTTPError as err:
        with err:
            return err.code, dict(err.headers.items()), err.read()


def run_selftest() -> int:
    results = []

    def check(name: str, ok: bool) -> None:
        results.append(ok)
        print(f"{'PASS' if ok else 'FAIL'}  {name}")

    def error_code(fn: Callable[[], object]) -> str | None:
        try:
            fn()
        except DemoError as err:
            return err.code
        return None

    check("validator strips and accepts normal text", validate_text({"text": "  works well  "}) == "works well")
    check("validator rejects empty text", error_code(lambda: validate_text({"text": "   "})) == "empty_text")
    check("validator rejects text over the limit", error_code(lambda: validate_text({"text": "a" * 501})) == "text_too_long")
    check("body check rejects a large body", error_code(lambda: check_body_size("9000")) == "body_too_large")

    clock = FakeClock()
    limiter = RateLimiter(capacity=2, refill_per_second=1.0, clock=clock)
    waits = [limiter.check("client-a") for _ in range(3)]
    clock.advance(1.0)
    check("token bucket allows a burst of 2, then rejects", waits[:2] == [0.0, 0.0] and waits[2] > 0)
    check("token bucket refills after one second", limiter.check("client-a") == 0.0)

    events = parse_sse(b"".join(stream_events(EXAMPLES[0])))
    reply = "".join(data["text"] for name, data in events if name == "token")
    check("stream ends with a done event", events[-1][0] == "done")
    check("streamed tokens equal the full reply", reply == predict(EXAMPLES[0])["reply"])

    body = error_body(DemoError(429, "rate_limited", "Too many.", "Wait."), "abc123")
    check("error body has code, message, hint, request_id", set(body["error"]) == {"code", "message", "hint", "request_id"})

    server, thread = start_background_server(DemoApp(DemoConfig(bucket_capacity=2)))
    try:
        base = f"http://127.0.0.1:{server.server_address[1]}"
        status, _, raw = http_request(base + "/api/predict", "POST", {"text": EXAMPLES[1]})
        check("HTTP predict returns 200 and a label", status == 200 and json.loads(raw)["label"] == "negative")
        status, headers, raw = http_request(base + "/api/stream", "POST", {"text": EXAMPLES[2]})
        check("HTTP stream returns text/event-stream", status == 200 and headers.get("Content-Type", "").startswith("text/event-stream"))
        status, headers, raw = http_request(base + "/api/predict", "POST", {"text": "x"})
        check("third request in a burst of 2 gets 429 and Retry-After", status == 429 and "Retry-After" in headers)
    finally:
        stop_server(server, thread)
    check("server thread stopped", not thread.is_alive())

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    print("Start the demo with: python3 code/main.py --serve")
    return 0 if passed == len(results) else 1


def serve(host: str, port: int) -> int:
    config = DemoConfig(token_delay=SERVE_TOKEN_DELAY, access_token=os.environ.get("DEMO_ACCESS_TOKEN") or None)
    app = DemoApp(config, log_sink=lambda line: print(line, file=sys.stderr))
    server = DemoServer((host, port), app)
    print(f"Serving the demo on http://{host}:{server.server_address[1]}  (Ctrl+C to stop)")
    if config.access_token:
        print("Access token required: DEMO_ACCESS_TOKEN is set.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Model demo interface with the standard library.")
    parser.add_argument("--serve", action="store_true", help="start the HTTP server and block until Ctrl+C")
    parser.add_argument("--selftest", action="store_true", help="run the quick self-test and exit (default)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args(argv)
    if args.serve:
        return serve(args.host, args.port)
    return run_selftest()


if __name__ == "__main__":
    sys.exit(main())
