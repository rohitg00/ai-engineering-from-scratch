import argparse
import contextlib
import difflib
import gzip
import itertools
import json
import os
import re
import shlex
import shutil
import signal
import socket
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.realpath(__file__))
OUT = os.path.join(HERE, "out")
FIXTURES = os.path.join(HERE, "fixtures")
WORK = os.path.join(HERE, "work")
CASSETTES = os.path.join(HERE, "cassettes")
CASSETTE_WORK = os.path.join(WORK, "cassettes")
RECORD_DATA = os.path.join(WORK, "record-data")
HOME = os.path.expanduser("~")
USER = os.path.basename(HOME)
DEMO = "m101-demo"
RUN_ID = uuid.uuid4().hex[:6]
POLICY = f"m101-policy-{RUN_ID}"
SECRET = f"m101-secret-{RUN_ID}"
RECEIVER_PORT = 18080
REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest"
DEEPWIKI_URL = "https://mcp.deepwiki.com/mcp"
ONE_TIME_FILES = {"03-policy-init.txt", "25-model-pull-latest.txt"}
AUTO_STOP_WAIT = 45
COMMAND_TIMEOUT = 900
PROBE_TIMEOUT = 30
MODEL = "dmr/ai/qwen3:4b"
MODEL_NAME = "ai/qwen3:4b"
DMR_URL = "http://localhost:12434"
AGENT_DIR_FLAGS = {"--config-dir", "--data-dir", "--cache-dir"}
NO_DAEMON_ENV = {"DOCKER_CONTEXT": "m101-no-daemon"}
LOCAL_REGISTRY = "m101-registry"
LOCAL_REGISTRY_PORT = 15000
LOCAL_REGISTRY_HOST = f"localhost:{LOCAL_REGISTRY_PORT}"
LOCAL_NET = "m101-net"
BUILDER = "m101-builder"
KIT_REF = f"{LOCAL_REGISTRY_HOST}/m101/hello-kit:v1"
KIT_REF_IN_NET = f"{LOCAL_REGISTRY}:5000/m101/hello-kit:v1"
AGENT_REF = f"{LOCAL_REGISTRY_HOST}/m101/agent:v1"
API_PORT, MCP_PORT, A2A_PORT, CHAT_PORT = 8080, 8081, 8082, 8083
FILES_TASK = "List the files in the working directory and count the lines of README.md."
FILES_TURNS = ["List the files in the working directory.", "How many lines does README.md have? Count them with a shell command."]
TEAM_TURNS = ["Ask the writer for one sentence about microVMs.", "Now hand the conversation to the reviewer."]
BACKGROUND_TASK = "Run the writer as a background agent on the topic microVMs, wait for it, and repeat its sentence."
GUARDED_TURNS = ["Run the shell command: echo m101-ok", "Run the shell command: pwd", "Run the shell command: rm -rf work/m101-nothing"]
OCI_ACCEPT = "Accept: application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json"
A2A_V1 = "A2A-Version: 1.0"
PARALLEL_TYPES = ("tool_call", "tool_call_confirmation", "hook_started", "hook_finished", "tool_call_output", "tool_call_response", "message_added")
ROUTING_TYPES = ("agent_route", "agent_switching", "sub_session_completed", "background_agent_started", "background_agent_completed")
BUILD_NOISE = (" / ", "pushing layer", "transferring", "extracting", "resolve docker.io")
NDJSON_NOTE = "  (agent_choice_reasoning and partial_tool_call events dropped, agent_choice tokens joined)"
SCRUB_KEYS = {"input_tokens", "output_tokens", "total_tokens", "prompt_tokens", "completion_tokens", "cached_input_tokens", "cached_write_tokens", "reasoning_tokens", "cost", "created", "created_at", "updated_at", "timestamp", "started_at", "finished_at", "duration", "duration_ms", "elapsed", "context_limit", "tokens", "seq", "sequence", "last_event_seq", "context_length"}
HOST_GIT_ENV = {"GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null"}
GIT_ENV = {
    "GIT_AUTHOR_NAME": "m101",
    "GIT_AUTHOR_EMAIL": "m101@example.test",
    "GIT_COMMITTER_NAME": "m101",
    "GIT_COMMITTER_EMAIL": "m101@example.test",
    "GIT_AUTHOR_DATE": "2026-10-08T09:00:00Z",
    "GIT_COMMITTER_DATE": "2026-10-08T09:00:00Z",
    **HOST_GIT_ENV,
}
INSIDE_GIT_DATE = "GIT_AUTHOR_DATE=2026-10-08T09:05:00Z GIT_COMMITTER_DATE=2026-10-08T09:05:00Z"
BOOT_HOSTS = {"ports.ubuntu.com:80", "download.docker.com:443"}
DEMO_HOSTS = BOOT_HOSTS | {"example.com:443"}
SECRET_HOSTS = BOOT_HOSTS | {f"localhost:{RECEIVER_PORT}", f"gateway.docker.internal:{RECEIVER_PORT}"}

MASKS = [
    (r"m101-(policy|secret)-[0-9a-f]{6}", r"m101-\1"),
    (r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<uuid>"),
    (r"sha256:[0-9a-f]{64}", "sha256:<digest>"),
    (r"\b[0-9a-f]{64}\b", "<sha256>"),
    (r"bind-[0-9a-f]{16}", "bind-<id>"),
    (r"-swap-[0-9a-f]{8}", "-swap-<id>"),
    (r"(sandboxes-swap/[A-Za-z0-9._-]+\s+)[0-9a-f]{8}\b", r"\1<id>"),
    (r"(\"tag\": \")[0-9a-f]{8}(\")", r"\1<id>\2"),
    (r"\b[0-9a-f]{12}\b", "<id>"),
    (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?", "<ts>"),
    (r"\d{2}:\d{2}:\d{2} \d{1,2}-[A-Z][a-z]{2}(\s+)\d+$", r"<ts>\1<n>"),
    (r"^Date: .*$", "Date: <http-date>"),
    (r"^(date|last-modified|expires|etag|age|cf-ray|cf-cache-status|alt-svc|via|x-cache|x-served-by|x-timer|set-cookie|report-to|nel|server-timing): .*$", r"\1: <value>"),
    (r"^(Mcp-Session-Id: )\S+", r"\1<session>"),
    (r"^session=\S+", "session=<session>"),
    (r"^id: [A-Z0-9]{26}_\d+$", "id: <event-id>"),
    (r"sbx-cs-[A-Za-z0-9]{16}", "sbx-cs-<rand>"),
    (r"\bsk-[A-Za-z0-9]{16}\b", "sk-<rand>"),
    (r"PROXY_CA_CERT_B64=\S+", "PROXY_CA_CERT_B64=<base64>"),
    (r"(127\.0\.0\.1:|\[::1\]:|::1:)(49[1-9]\d{2}|5\d{4}|6[0-5]\d{3})\b", r"\1<port>"),
    (r"\"host_port\": (49[1-9]\d{2}|5\d{4}|6[0-5]\d{3})\b", "\"host_port\": \"<port>\""),
    (r"\((kit=[^,)]+, user=[^,)]+), \d+(?:\.\d+)?s\)", r"(\1, <dur>)"),
    (r"collected \(\d+ bytes\)", "collected (<n> bytes)"),
    (r"\d+(?:\.\d+)?GiB free", "<n>GiB free"),
    (r"of \d+(?:\.\d+)?GiB on", "of <n>GiB on"),
    (r"\"count_since\": \d+", "\"count_since\": \"<n>\""),
    (r"\"size\": \d+", "\"size\": \"<n>\""),
    (r"after \d+ ms", "after <n> ms"),
    (r"(--unpublish |for port )(49[1-9]\d{2}|5\d{4}|6[0-5]\d{3})\b", r"\1<port>"),
    (r"size \d+ bytes", "size <n> bytes"),
    (r"for \d+ running sandbox\(es\)", "for <n> running sandbox(es)"),
    (r"\d+ (?:second|minute|hour|day|week|month)s? ago|Less than a minute ago|About (?:a|an) \w+ ago", "<age>"),
    (r"\bcall_[A-Za-z0-9_-]{4,}", "call_<id>"),
    (r"\bchatcmpl-[A-Za-z0-9]{8,}", "chatcmpl-<id>"),
    (r"^Total Time: \S+$", "Total Time: <dur>"),
    (r"sandbox-kits/[0-9a-f]{8,}", "sandbox-kits/<hash>"),
    (r"docker-agent-[0-9a-f]{24}", "docker-agent-<hash>"),
    (r"\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}", "<ts>"),
    (r"^(#\d+ (?:DONE|CACHED)) \d+(?:\.\d+)?s$", r"\1 <dur>"),
    (r"^View build details: .*$", "View build details: <url>"),
    (r"^(#\d+ .*) \d+(?:\.\d+)?s done$", r"\1 <dur> done"),
    (r"(?m)^(\s*(?:Container|Network|Volume|Image)\s+\S+\s+\w+)\s+\d+(?:\.\d+)?s$", r"\1 <dur>"),
]
CALL_ID = re.compile(r"[A-Za-z0-9_-]{20,}")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
TRANSIENT_LINES = re.compile(r"^WARN: docker hub refresh lock held by another process[^\n]*\n", re.M)
PULL_BLOCK = re.compile(r"^((?:Pulling|Checking) image\n)((?:  [0-9a-f]{12} (?:downloaded|already present).*\n)+)", re.M)
LS_LINE = re.compile(r"^[-dl][rwxsStT-]{9}")
LS_DATE = re.compile(r"[A-Z][a-z]{2}\s{1,2}\d{1,2}\s(?:\d{2}:\d{2}|\d{4})")
DF_LINE = re.compile(r"^(host|overlay|/dev/\S+)\s+\d")
DF_COLS = re.compile(r"\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+%")
COMPOSE_SERVICE = re.compile(r"^([a-z0-9-]+-\d+)\s+\| ")
HOST_FACTS = {
    "00-versions.txt": re.compile(r"^\$ (?:sw_vers|uname -m|sysctl kern\.hv_support|python3 --version)\n.*?^\[exit \d+\]\n", re.M | re.S),
    "README.md": re.compile(r"^- (?:docker|host): .*\n", re.M),
}


def mask_text(text, docker_user):
    text = TRANSIENT_LINES.sub("", text)
    for path, token in ((HERE, "$CAPTURE"), (HOME, "$HOME")):
        for variant in sorted({path, os.path.realpath(path)}, key=len, reverse=True):
            text = re.sub(re.escape(variant) + r"(?![\w.-])", token, text)
    text = re.sub(r"(?<=/)" + re.escape(USER) + r"(?![\w.-])", "$USER", text)
    if docker_user:
        text = re.sub(r"(?i)(signed[_ ]in[_ ]as\W{0,4})" + re.escape(docker_user) + r"(?![\w.-])", r"\1<docker-user>", text)
    text = PULL_BLOCK.sub(r"\1  <layers>\n", text)
    for pattern, replacement in MASKS:
        text = re.sub(pattern, replacement, text, flags=re.M)
    return "\n".join(mask_listing_line(line) for line in text.split("\n"))


def mask_listing_line(line):
    if LS_LINE.match(line):
        line = LS_DATE.sub("<date>", line)
    if DF_LINE.match(line):
        line = DF_COLS.sub("  <size>  <used>  <avail>  <use%>", line)
    return line


def log_row_host(row):
    columns = row.split()
    return columns[2] if len(columns) > 2 else None


def log_row_key(row):
    return row.get("host", ""), row.get("reason", ""), row.get("rule", "")


def policy_log_table(hosts):
    def keep_hosts(text):
        sections = []
        for section in text.split("\n\n"):
            lines = [line.rstrip() for line in section.split("\n")]
            rows = sorted(row for row in lines[2:] if log_row_host(row) in hosts)
            sections.append("\n".join(lines[:2] + rows))
        return "\n\n".join(sections)
    return keep_hosts


def policy_log_json(hosts):
    def keep_hosts(data):
        for key in ("blocked_hosts", "allowed_hosts"):
            if isinstance(data.get(key), list):
                rows = [row for row in data[key] if row.get("host") in hosts]
                data[key] = sorted(rows, key=log_row_key)
        return data
    return keep_hosts


def write_file(path, text):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def read_file(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def sort_ports(value):
    if isinstance(value, dict):
        return {key: (sorted(sort_ports(item), key=json.dumps) if key == "ports" and isinstance(item, list) else sort_ports(item)) for key, item in value.items()}
    if isinstance(value, list):
        return [sort_ports(item) for item in value]
    return value


def pretty_json(data):
    return json.dumps(sort_ports(data), indent=2, ensure_ascii=False) + "\n"


def remove_tree(path):
    if os.path.exists(path):
        shutil.rmtree(path)


def remove_file(path):
    if os.path.exists(path):
        os.remove(path)


class RecordingHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        lines = [f"{self.command} {self.path} {self.request_version}"]
        lines.extend(f"{key}: {value}" for key, value in self.headers.items())
        self.server.requests.append("\n".join(lines) + "\n")
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()


class Receiver:
    def __init__(self, port):
        self.requests = []
        self.error = None
        self.server = None
        try:
            self.server = HTTPServer(("127.0.0.1", port), RecordingHandler)
        except OSError as exc:
            self.error = f"receiver could not bind 127.0.0.1:{port}: {exc}"
            return
        self.server.requests = self.requests
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def text(self):
        if self.error:
            return self.error + "\n"
        return "\n".join(self.requests) if self.requests else "(no request reached the receiver)\n"

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()


def as_text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value or ""


def agent_dirs(root, data_dir=None):
    return ["--config-dir", os.path.join(root, "cfg"), "--data-dir", data_dir or os.path.join(root, "data"), "--cache-dir", os.path.join(root, "cache")]


def agent(*args, data_dir=None):
    return ["docker-agent", *agent_dirs(WORK, data_dir), *(os.path.join(HERE, item) if item.startswith(("fixtures/", "work/")) else item for item in args)]


def agent_in_work(*args):
    return ["docker-agent", *agent_dirs(""), *args]


def capture_relative(text):
    return text.replace(HERE + "/", "")


def shown_command(args):
    parts = []
    words = iter(args)
    for part in words:
        if part in AGENT_DIR_FLAGS:
            next(words, None)
        else:
            parts.append(part)
    return capture_relative(shlex.join(parts))


def with_exit(label, code):
    if code:
        return f"{label}  [exit {code}]"
    return label


def stderr_lines(text):
    return "[stderr] " + text.replace("\n", "\n[stderr] ")


def is_call_id(value):
    return isinstance(value, str) and bool(CALL_ID.fullmatch(value)) and not UUID_RE.fullmatch(value) and not value.startswith("chatcmpl-")


def scrub_field(key, item):
    if key in SCRUB_KEYS and isinstance(item, (int, float)) and not isinstance(item, bool):
        return "<n>"
    if key in ("duration", "elapsed") and isinstance(item, str):
        return "<dur>"
    if key in ("tool_call_id", "tool_use_id", "id") and is_call_id(item):
        return "<call-id>"
    return scrub(item)


def scrub(value):
    if isinstance(value, dict):
        return {key: scrub_field(key, item) for key, item in value.items()}
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def without(event, *keys):
    return {key: item for key, item in event.items() if key not in keys}


def is_parallel(event):
    return event.get("type") in PARALLEL_TYPES


def parallel_key(event):
    return PARALLEL_TYPES.index(event.get("type")), json.dumps(scrub(without(event, "timestamp")), sort_keys=True)


def compact_events(events):
    joined = []
    for event in events:
        kind = event.get("type")
        if kind in ("agent_choice_reasoning", "partial_tool_call"):
            continue
        previous = joined[-1] if joined else {}
        if kind == "agent_choice" and previous.get("type") == "agent_choice" and previous.get("agent_name") == event.get("agent_name"):
            previous["content"] = previous.get("content", "") + event.get("content", "")
            continue
        joined.append(dict(event))
    ordered = []
    for parallel, run in itertools.groupby(joined, key=is_parallel):
        if parallel:
            ordered.extend(sorted(run, key=parallel_key))
        else:
            ordered.extend(run)
    return ordered


def transcript_line(event):
    kind = event.get("type")
    agent_name = event.get("agent_name", "")
    if kind == "user_message":
        return f"user: {event.get('message', '')}"
    if kind == "agent_choice":
        return f"{agent_name}: {event.get('content', '').strip()}"
    if kind == "tool_call":
        call = event.get("tool_call", {}).get("function", {})
        return f"{agent_name} -> tool_call {call.get('name')} {call.get('arguments', '')}"
    if kind == "tool_call_response":
        title = event.get("tool_definition", {}).get("annotations", {}).get("title", "")
        response = str(event.get("response", "")).strip().replace("\n", "\n    ")
        return f"{agent_name} <- tool_call_response {title}: {response}"
    if kind in ROUTING_TYPES:
        return f"{kind}: {json.dumps(without(event, 'timestamp', 'type'), ensure_ascii=False)}"
    if kind == "stream_stopped":
        return f"stream_stopped ({event.get('finish_reason', '')}, {event.get('reason', '')})"
    if kind == "tool_call_confirmation":
        return f"tool_call_confirmation: {json.dumps(scrub(without(event, 'timestamp', 'type', 'tool_definition')), ensure_ascii=False)}"
    if kind in ("error", "notification", "stderr"):
        return f"{kind}: {event.get('message', event.get('error', ''))}"
    return None


def transcript_text(events):
    lines = [transcript_line(event) for event in compact_events(events)]
    return "\n".join(line for line in lines if line is not None) + "\n"


def cut_reasoning(text):
    paragraphs = [part for part in re.split(r"\n\s*\n", text.strip("\n")) if part.strip()]
    if len(paragraphs) <= 2:
        return text
    kept = [paragraphs[0]] if paragraphs[0].startswith("Recording mode") else []
    cut_lines = sum(part.count("\n") + 1 for part in paragraphs[len(kept):-1])
    kept += [f"[... {cut_lines} lines of model reasoning cut by run.py ...]", paragraphs[-1]]
    return "\n\n".join(kept) + "\n"


def port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def pretty_body(text):
    stripped = text.strip()
    if not stripped:
        return ""
    try:
        return json.dumps(scrub(json.loads(stripped)), indent=2, ensure_ascii=False)
    except ValueError:
        return stripped


class Transcript:
    def __init__(self, kit):
        self.kit = kit
        self.lines = []
        self.labels = []
        self.last_head = ""

    def exchange(self, title, method, url, body=None, headers=(), stream=False):
        host, _, path = url.partition("://")[2].partition("/")
        cmd = ["curl", "-sS", "-i", "--max-time", "180", "-X", method]
        if stream:
            cmd.append("-N")
        for header in headers:
            cmd += ["-H", header]
        if body is not None:
            cmd += ["-H", "Content-Type: application/json", "-d", body]
        cmd.append(url)
        code, out, err = self.kit.run(cmd, merged=False)
        self.labels.append(shlex.join(cmd))
        self.lines += [f"### {len(self.labels)} · {title}", f"{method} /{path} HTTP/1.1", f"Host: {host}", *headers]
        if body is not None:
            self.lines += ["Content-Type: application/json", "", *pretty_body(body).split("\n")]
        self.lines.append("")
        head, _, response_body = out.replace("\r\n", "\n").partition("\n\n")
        self.last_head = head
        if not head:
            self.lines.append(f"(no response: curl exit {code}: {err.strip()})")
        else:
            self.lines.extend(line for line in head.split("\n") if not line.lower().startswith("content-length:"))
            self.lines.append("")
            if stream:
                self.lines.extend(sse_scrub(response_body).rstrip("\n").split("\n"))
            else:
                self.lines.extend(pretty_body(response_body).split("\n"))
        self.lines.append("")
        return response_body

    def write(self, name, server):
        self.kit.write(name, "\n".join(self.lines).rstrip("\n") + "\n", [server, *self.labels])


@contextlib.contextmanager
def start_server(args, port, log_name):
    if port_open(port):
        raise RuntimeError(f"127.0.0.1:{port} is already in use, so the step would talk to a stale server")
    command = agent(*args)
    with open(os.path.join(WORK, log_name), "w", encoding="utf-8") as log:
        proc = subprocess.Popen(command, cwd=HERE, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
    try:
        deadline = time.time() + 120
        while time.time() < deadline and proc.poll() is None and not port_open(port):
            time.sleep(0.5)
        yield shown_command(command)
    finally:
        stop_server(proc)


def wait_or_kill(proc, timeout, grace):
    try:
        proc.wait(timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(grace)


def stop_server(proc):
    if proc.poll() is None:
        proc.send_signal(signal.SIGINT)
        wait_or_kill(proc, 20, 10)


class Kit:
    def __init__(self, out_dir):
        self.out = out_dir
        self.manifest = []
        self.docker_user = None
        self.versions = {}
        self.record_cassettes = False
        self.checking = False
        self.recorded = []
        self.missing = []
        os.makedirs(out_dir, exist_ok=True)

    def run(self, args, cwd=None, env=None, merged=True, new_session=False):
        stderr = subprocess.STDOUT if merged else subprocess.PIPE
        try:
            proc = subprocess.run(args, cwd=cwd, env={**os.environ, **(env or {})}, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=stderr, text=True, timeout=COMMAND_TIMEOUT, start_new_session=new_session)
        except subprocess.TimeoutExpired as exc:
            return 124, as_text(exc.stdout) + f"\n[timed out after {COMMAND_TIMEOUT}s]\n", as_text(exc.stderr)
        except FileNotFoundError as exc:
            return 127, str(exc) + "\n", ""
        return proc.returncode, proc.stdout, proc.stderr or ""

    def output(self, args):
        return self.run(args)[1]

    def json_result(self, args):
        _, out, _ = self.run(args, merged=False)
        try:
            return json.loads(out)
        except ValueError:
            return {}

    def json_list(self, args, key):
        return self.json_result(args).get(key, [])

    def ensure_running(self, sandbox):
        self.run(["sbx", "exec", sandbox, "true"])

    def exec_out(self, sandbox, script):
        self.ensure_running(sandbox)
        return self.output(["sbx", "exec", sandbox, "sh", "-c", script])

    def block(self, args, cwd=None, env=None, output_filter=None, shown=None, new_session=False):
        code, out, _ = self.run(args, cwd, env, new_session=new_session)
        if output_filter:
            out = output_filter(out)
        head = "$ " + (shown or shlex.join(args))
        body = out.rstrip("\n")
        if body:
            return f"{head}\n{body}\n[exit {code}]\n"
        return f"{head}\n[exit {code}]\n"

    def entry(self, args, label=None, cwd=None, env=None, output_filter=None, shown=None, new_session=False):
        return self.block(args, cwd, env, output_filter, shown, new_session), label or shown or shlex.join(args)

    def exec_entry(self, sandbox, script, user=None, label=None):
        options = ["-u", user] if user else []
        self.ensure_running(sandbox)
        text = self.block(["sbx", "exec", *options, sandbox, "sh", "-c", script])
        if label is None:
            prefix = " ".join(["sbx", "exec", *options])
            label = f"{prefix} {sandbox} sh -c '{script}'"
        return text, label

    def write(self, name, text, commands):
        write_file(os.path.join(self.out, name), mask_text(text, self.docker_user))
        self.manifest.append((name, commands))

    def write_blocks(self, name, entries):
        self.write(name, "\n".join(text for text, _ in entries), [label for _, label in entries])

    def capture(self, name, *commands, cwd=None, env=None, output_filter=None):
        self.write_blocks(name, [self.entry(args, cwd=cwd, env=env, output_filter=output_filter) for args in commands])

    def exec_file(self, name, sandbox, script, label=None):
        self.write_blocks(name, [self.exec_entry(sandbox, script, label=label)])

    def json_file(self, name, args, cwd=None, transform=None, env=None, shown=None):
        code, out, err = self.run(args, cwd, env, merged=False)
        try:
            data = json.loads(out)
            if transform:
                data = transform(data)
            text = pretty_json(data)
        except ValueError:
            text = out + err
        self.write(name, text, [with_exit(shown or shlex.join(args), code)])

    def agent_entry(self, args, output_filter=None):
        command = agent(*args)
        return self.entry(command, cwd=HERE, output_filter=output_filter, shown=shown_command(command))

    def agent_file(self, name, *commands, output_filter=None):
        self.write_blocks(name, [self.agent_entry(args, output_filter=output_filter) for args in commands])

    def agent_json(self, name, args, transform=None):
        command = agent(*args)
        self.json_file(name, command, cwd=HERE, transform=transform, shown=shown_command(command))

    def ndjson_file(self, name, args):
        command = agent(*args)
        code, out, err = self.run(command, HERE, merged=False)
        events = []
        extra = []
        for line in out.split("\n"):
            if not line.strip():
                continue
            try:
                events.append(json.loads(line))
            except ValueError:
                extra.append(line)
        compacted = [scrub(event) for event in compact_events(events)]
        lines = [json.dumps(event, ensure_ascii=False, sort_keys=True) for event in compacted] + extra
        if err.strip():
            lines.append(stderr_lines(err.strip()))
            compacted.append({"type": "stderr", "message": err.strip()})
        self.write(name, "\n".join(lines) + "\n", [with_exit(shown_command(command) + NDJSON_NOTE, code)])
        return compacted

    def start_recording(self, name):
        if not self.record_cassettes and os.path.exists(cassette_path(name)):
            return None
        self.recorded.append(name)
        return ["--models-gateway", f"{DMR_URL}/engines", f"--record={CASSETTE_WORK}/{name}"]

    def recording_flags(self, name):
        if self.checking:
            if not os.path.exists(committed_cassette(name)):
                self.missing.append(name)
            return None
        flags = self.start_recording(name)
        if flags:
            remove_file(cassette_path(name))
        return flags

    def ensure_cassette(self, name, args):
        flags = self.recording_flags(name)
        if flags:
            self.run(agent(args[0], *flags, *args[1:], data_dir=RECORD_DATA), cwd=HERE)

    def server_log(self, name, log_name, label):
        path = os.path.join(WORK, log_name)
        self.write(name, read_file(path) if os.path.exists(path) else "(no log)\n", [label])

    def sandboxes(self):
        return self.json_list(["sbx", "ls", "--json"], "sandboxes")

    def custom_secrets(self):
        return self.json_list(["sbx", "secret", "ls", "--json"], "custom_secrets")

    def added_rule_id(self, sandbox):
        rules = self.json_list(["sbx", "policy", "ls", sandbox, "--wide", "--json"], "rules")
        return next((rule["id"] for rule in rules if rule.get("provenance", {}).get("created_via") == "added"), "<missing>")

    def signed_in_user(self):
        gateway = self.json_result(["sbx", "mcp", "ls", "--json"]).get("gateway", {})
        return gateway.get("signed_in_as") or None


def make_repo(path):
    remove_tree(path)
    os.makedirs(path)
    env = {**os.environ, **GIT_ENV}

    def git(*args):
        subprocess.run(["git", *args], cwd=path, env=env, check=True, capture_output=True, text=True)

    git("init", "-q", "-b", "main")
    git("commit", "-q", "--allow-empty", "-m", "first")
    write_file(os.path.join(path, "README.md"), "hello\n")
    git("add", "README.md")
    git("commit", "-q", "-m", "second")


def copy_repo(source, target):
    remove_tree(target)
    shutil.copytree(source, target, symlinks=True)


def host_git(path, *args):
    return ["git", "-C", path, *args]


def remove_kit_sandboxes(kit):
    for sandbox in kit.sandboxes():
        if sandbox["name"].startswith("m101-"):
            kit.run(["sbx", "rm", "--force", sandbox["name"]])


def kit_secret_removals(kit):
    return [["sbx", "secret", "rm", "--placeholder", secret["placeholder"], "-f"] for secret in kit.custom_secrets() if secret.get("env", "").startswith("M101_")]


def sweep(kit):
    remove_kit_sandboxes(kit)
    for image in kit.json_list(["sbx", "template", "ls", "--json"], "images"):
        short = image["repository"].split("/")[-1]
        if short.startswith("m101-"):
            kit.run(["sbx", "template", "rm", f"{short}:{image['tag']}", "--force"])
    for server in kit.json_list(["sbx", "mcp", "ls", "--json"], "servers"):
        if server["name"].startswith("m101-"):
            kit.run(["sbx", "mcp", "rm", server["name"], "--force"])
    for args in kit_secret_removals(kit):
        kit.run(args)


def strip_agent_version_prefix(line):
    if line.startswith("docker-agent version"):
        return line.split(" ", 2)[-1]
    return line


def step_versions(kit):
    kit.capture("00-versions.txt", ["sbx", "version"], ["docker-agent", "version"], ["sw_vers"], ["uname", "-m"], ["sysctl", "kern.hv_support"], ["python3", "--version"])
    kit.versions["sbx"] = kit.output(["sbx", "version"]).strip().replace("sbx version: ", "")
    agent_lines = kit.output(["docker-agent", "version"]).strip().split("\n")
    kit.versions["docker-agent"] = " ".join(strip_agent_version_prefix(line) for line in agent_lines)
    macos = kit.output(["sw_vers", "-productVersion"]).strip()
    arch = kit.output(["uname", "-m"]).strip()
    kit.versions["host"] = f"macOS {macos} {arch}"
    kit.versions["docker"] = kit.output(["docker", "--version"]).strip()
    rows = model_rows(kit.output(["docker", "model", "ls"]))
    kit.versions["model"] = mask_text(" ".join(rows[0].split()), None) if rows else f"{MODEL_NAME} not pulled"


def step_help(kit):
    kit.capture("01-help-sbx.txt", ["sbx", "--help"])
    kit.capture("01-help-docker-agent.txt", ["docker-agent", "--help"])


def step_docker_agent_static(kit):
    greeter = os.path.join(FIXTURES, "agents", "greeter.yaml")
    kit.capture("16-docker-agent-version.txt", ["docker-agent", "version"])
    kit.capture("16-doctor.txt", ["docker-agent", "doctor"], env=NO_DAEMON_ENV)
    kit.json_file("16-doctor.json", ["docker-agent", "doctor", "--json"], env=NO_DAEMON_ENV)
    kit.capture("16-toolsets.txt", ["docker-agent", "toolsets"])
    kit.json_file("16-toolsets.json", ["docker-agent", "toolsets", "--format", "json"])
    kit.capture("16-models.txt", ["docker-agent", "models", "list"], env=NO_DAEMON_ENV)
    kit.json_file("16-models.json", ["docker-agent", "models", "list", "--format", "json"], env=NO_DAEMON_ENV)
    kit.capture("16-sandbox-list.txt", ["docker-agent", "sandbox", "list"])
    kit.capture("16-dry-run.txt", ["docker-agent", "run", "--dry-run", "--exec", greeter, "hi"], cwd=HERE, env=NO_DAEMON_ENV)


def step_docker_agent_share_pull(kit):
    kit.capture("16-share-pull.txt", ["docker-agent", "share", "pull", "agentcatalog/pirate", "--force"], cwd=WORK)
    pulled = os.path.join(WORK, "agentcatalog_pirate.yaml")
    if os.path.exists(pulled):
        kit.write("16-share-pull-agent.yaml", read_file(pulled), ["cat work/agentcatalog_pirate.yaml (written by share pull)"])


def step_daemon_settings_diagnose(kit):
    kit.capture("02-daemon-status.txt", ["sbx", "daemon", "status"])
    kit.json_file("02-daemon-status.json", ["sbx", "daemon", "status", "--json"])
    kit.json_file("00-sbx-version.json", ["sbx", "version", "--json"])
    kit.capture("02-diagnose.txt", ["sbx", "diagnose"])
    kit.json_file("02-diagnose.json", ["sbx", "diagnose", "--json"])
    kit.capture("02-settings.txt", ["sbx", "settings", "list"])
    kit.json_file("02-settings.json", ["sbx", "settings", "list", "--json"])
    kit.json_file("02-settings-experimental.json", ["sbx", "settings", "get", "--json", "platform.allowExperimentalFeatures"])
    kit.capture("02-settings-get.txt", ["sbx", "settings", "get", "skills.defaultMode"], ["sbx", "settings", "get", "--json", "kit.allowedSources"])


def step_policy_init(kit):
    code, _, _ = kit.run(["sbx", "policy", "ls"])
    if code != 0:
        kit.capture("03-policy-init.txt", ["sbx", "policy", "init", "balanced"])
    kit.capture("03-policy-ls.txt", ["sbx", "policy", "ls"])
    kit.json_file("03-policy-balanced.json", ["sbx", "policy", "ls", "--wide", "--json"])
    kit.json_file("03-policy-check-example.json", ["sbx", "policy", "check", "network", "example.com", "--verbose", "--json"])
    kit.json_file("03-policy-check-anthropic.json", ["sbx", "policy", "check", "network", "api.anthropic.com", "--verbose", "--json"])
    kit.capture("03-policy-profile-ls.txt", ["sbx", "policy", "profile", "ls"], ["sbx", "policy", "profile", "ls", "--json"])
    kit.capture("03-policy-org.txt", ["sbx", "policy", "ls", "--source", "org"], ["sbx", "policy", "ls", "--include-inactive"])


def auto_stop_log_lines(kit):
    status = kit.json_result(["sbx", "daemon", "status", "--json"])
    try:
        with open(status["logs"], encoding="utf-8", errors="replace") as handle:
            return [line.rstrip("\n") for line in handle if f'"runtime":"{DEMO}"' in line and "auto-stop" in line]
    except (ValueError, OSError, KeyError):
        return ["(daemon log not readable)"]


def record_auto_stop(kit):
    kit.ensure_running(DEMO)
    before = kit.entry(["sbx", "ls"])
    time.sleep(AUTO_STOP_WAIT)
    after = kit.entry(["sbx", "ls"], f"sbx ls  (after {AUTO_STOP_WAIT} s with no session)")
    lines = auto_stop_log_lines(kit)
    tail = "\n".join(lines[-2:]) if lines else "(no auto-stop line for m101-demo in the daemon log)"
    grep = (f"$ grep auto-stop daemon.log | grep m101-demo | tail -2\n{tail}\n", "grep auto-stop daemon.log (the daemon log named by sbx daemon status --json)")
    kit.write_blocks("04-auto-stop.txt", [before, after, grep])


def step_lifecycle_create(kit):
    repo = os.path.join(FIXTURES, "repo")
    make_repo(repo)
    kit.capture("04-create.txt", ["sbx", "create", "shell", repo, "--name", DEMO])
    kit.ensure_running(DEMO)
    kit.capture("04-ls.txt", ["sbx", "ls"])
    kit.ensure_running(DEMO)
    kit.json_file("04-ls.json", ["sbx", "ls", "--json"])
    kit.exec_file("04-env.txt", DEMO, "env | sort")
    guest = "uname -a; echo; cat /etc/os-release; echo; id; getconf PAGESIZE; echo; docker version; echo; mount | grep -E 'virtiofs|/run/sandbox|fixtures'; echo; df -h \"$PWD\" /; echo; cat /etc/hosts"
    kit.exec_file("04-guest.txt", DEMO, guest)
    kit.exec_file("04-workspace.txt", DEMO, "pwd; echo; ls -la; echo; cat README.md; echo; git log --oneline")
    record_auto_stop(kit)


def curl_status(url):
    return ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}\\n", url]


def ephemeral_port(kit):
    port = None
    for row in kit.json_result(["sbx", "ports", DEMO, "--json"]):
        if row.get("protocol") == "tcp" and row.get("host_ip") == "127.0.0.1":
            port = row["host_port"]
    return port


def step_ports(kit):
    ports = ["sbx", "ports", DEMO]
    kit.exec_out(DEMO, "cd \"$PWD\" && (setsid nohup python3 -m http.server 8080 >/tmp/srv.log 2>&1 &); sleep 1")
    kit.ensure_running(DEMO)
    kit.capture("05-ports.txt", [*ports, "--publish", "18081:8080"], ports)
    kit.json_file("05-ports.json", [*ports, "--json"])
    kit.capture("05-ports-curl.txt", curl_status("http://127.0.0.1:18081/README.md"), curl_status("http://[::1]:18081/README.md"))
    kit.ensure_running(DEMO)
    kit.capture("05-ports-ls.txt", ["sbx", "ls"])
    kit.capture("05-ports-tcp.txt", [*ports, "--publish", "8080/tcp"], [*ports, "--json"])
    unpublish = [[*ports, "--unpublish", "18081:8080"]]
    port = ephemeral_port(kit)
    if port:
        unpublish.append([*ports, "--unpublish", f"{port}:8080/tcp"])
    kit.capture("05-ports-unpublish.txt", *unpublish, [*ports, "--json"])


def step_cp(kit):
    inbound = os.path.join(WORK, "in.txt")
    outbound = os.path.join(WORK, "out.txt")
    write_file(inbound, "in\n")
    kit.ensure_running(DEMO)
    kit.write_blocks("06-cp.txt", [
        kit.entry(["sbx", "cp", inbound, f"{DEMO}:/tmp/in.txt"], f"sbx cp work/in.txt {DEMO}:/tmp/in.txt"),
        kit.exec_entry(DEMO, "cat /tmp/in.txt; printf out > /tmp/out.txt"),
        kit.entry(["sbx", "cp", f"{DEMO}:/tmp/out.txt", outbound], f"sbx cp {DEMO}:/tmp/out.txt work/out.txt"),
        kit.entry(["cat", outbound], "cat work/out.txt"),
        kit.entry(["sbx", "cp", f"{DEMO}:/tmp/out.txt", "m101-demo-2:/tmp/x"]),
    ])


def record_bypass_grep(kit):
    hits = [line for line in kit.output(["sbx", "policy", "--help"]).split("\n") if "bypass" in line.lower()]
    if hits:
        body, code = "\n".join(hits), 0
    else:
        body, code = "(no line of `sbx policy --help` contains the word bypass)", 1
    kit.write("09-bypass-grep.txt", f"$ sbx policy --help | grep -i bypass\n{body}\n[exit {code}]\n", ["sbx policy --help | grep -i bypass"])


def step_policy_deny_log(kit):
    curl_head = "curl -sS --max-time 10 -I https://example.com; echo exit=$?"
    curl_body = "curl -sS --max-time 10 https://example.com; echo; echo exit=$?"
    check_example = ["sbx", "policy", "check", "network", "example.com", "--sandbox", POLICY, "--verbose", "--json"]
    deny_example = ["sbx", "policy", "deny", "network", "--sandbox", POLICY, "example.com"]
    added_rules = ["sbx", "policy", "ls", POLICY, "--wide", "--created-via", "added"]
    log_json = ["sbx", "policy", "log", POLICY, "--json"]
    demo_hosts_only = policy_log_json(DEMO_HOSTS)
    kit.capture("09-create.txt", ["sbx", "create", "shell", "--name", POLICY])
    kit.write_blocks("09-blocked.txt", [kit.exec_entry(POLICY, curl_head), kit.exec_entry(POLICY, curl_body)])
    kit.capture("09-policy-log.txt", ["sbx", "policy", "log", POLICY], output_filter=policy_log_table(DEMO_HOSTS))
    kit.json_file("09-policy-log.json", log_json, transform=demo_hosts_only)
    kit.json_file("09-check-verbose.json", check_example)
    kit.capture("09-allow.txt", ["sbx", "policy", "allow", "network", "--sandbox", POLICY, "example.com"], ["sbx", "policy", "ls", POLICY])
    kit.capture("09-ls-wide.txt", added_rules)
    kit.json_file("09-ls-wide.json", [*added_rules, "--json"])
    kit.json_file("09-check-allowed.json", check_example)
    kit.exec_file("09-allowed.txt", POLICY, curl_head)
    kit.json_file("09-policy-log-after.json", log_json, transform=demo_hosts_only)
    kit.capture("09-deny-conflict.txt", deny_example)
    allow_id = kit.added_rule_id(POLICY)
    kit.capture("09-inspect-rule.txt", ["sbx", "policy", "inspect", allow_id])
    kit.json_file("09-inspect-rule.json", ["sbx", "policy", "inspect", allow_id, "--json"])
    kit.capture("09-rm-allow.txt", ["sbx", "policy", "rm", "network", "--sandbox", POLICY, "--id", allow_id, "--force"])
    kit.capture("09-deny.txt", deny_example)
    kit.json_file("09-check-deny.json", check_example)
    kit.exec_file("09-blocked-by-rule.txt", POLICY, curl_body)
    kit.json_file("09-policy-log-deny.json", log_json, transform=demo_hosts_only)
    deny_id = kit.added_rule_id(POLICY)
    kit.json_file("09-inspect-deny-rule.json", ["sbx", "policy", "inspect", deny_id, "--json"])
    kit.capture("09-rm-deny.txt", ["sbx", "policy", "rm", "network", "--sandbox", POLICY, "--id", deny_id, "--force"], added_rules)
    record_bypass_grep(kit)
    kit.run(["sbx", "rm", "--force", POLICY])


def swap_curls(placeholder):
    base = f"http://host.docker.internal:{RECEIVER_PORT}"
    return [
        f"curl -sS --max-time 10 -H \"Authorization: Bearer $M101_RECV_KEY\" -H \"X-Demo: $M101_RECV_KEY\" -o /dev/null -w '%{{http_code}}\\n' {base}/from-variable",
        f"curl -sS --max-time 10 -H 'Authorization: Bearer {placeholder}' -H 'X-Demo: {placeholder}' -o /dev/null -w '%{{http_code}}\\n' {base}/from-literal",
        f"curl -sS --max-time 10 -H 'Authorization: {placeholder}' -o /dev/null -w '%{{http_code}}\\n' {base}/no-scheme",
        f"curl -sS --max-time 10 -H \"Authorization: Bearer $M101_RECV_KEY\" -o /dev/null -w '%{{http_code}}\\n' http://gateway.docker.internal:{RECEIVER_PORT}/other-host; echo exit=$?",
    ]


def step_secrets(kit):
    receiver = Receiver(RECEIVER_PORT)
    try:
        kit.capture("10-set-custom.txt", ["sbx", "secret", "set-custom", "--host", "host.docker.internal", "--host", "localhost", "--env", "M101_RECV_KEY", "--value", "m101-dummy-receiver-0000"])
        kit.capture("10-secret-ls.txt", ["sbx", "secret", "ls"])
        kit.json_file("10-secret-ls.json", ["sbx", "secret", "ls", "--json"])
        placeholder = next((secret["placeholder"] for secret in kit.custom_secrets() if secret.get("env") == "M101_RECV_KEY"), "<missing>")
        kit.exec_file("10-env-existing.txt", DEMO, "env | grep -c M101_RECV_KEY; echo exit=$?")
        kit.capture("10-secret-create.txt", ["sbx", "create", "shell", "--name", SECRET], ["sbx", "policy", "allow", "network", "--sandbox", SECRET, f"localhost:{RECEIVER_PORT}"])
        sentinel = "env | grep -E '^M101_|^SBX_CRED|proxy-managed' | sort"
        kit.exec_file("10-env-sentinel.txt", SECRET, sentinel, label=f"sbx exec m101-secret sh -c \"{sentinel}\"")
        swaps = [kit.exec_entry(SECRET, script, label=f"sbx exec m101-secret sh -c {shlex.quote(script)}") for script in swap_curls(placeholder)]
        kit.write_blocks("10-swap-curl.txt", swaps)
        kit.write("10-receiver.log", receiver.text(), ["requests received by the host receiver on 127.0.0.1:18080 (run.py, class Receiver)"])
        kit.json_file("10-policy-log.json", ["sbx", "policy", "log", SECRET, "--json"], transform=policy_log_json(SECRET_HOSTS))
        kit.capture("10-placeholder.txt", ["sbx", "secret", "set-custom", "--host", "api.example.test", "--env", "M101_NAMED", "--placeholder", "sk-{rand}", "--value", "m101-dummy-1111"], ["sbx", "secret", "ls", "--json"])
        kit.capture("10-import-dry-run.txt", ["sbx", "secret", "import", "--dry-run"])
        kit.capture("10-secret-rm.txt", ["sbx", "rm", "--force", SECRET], *kit_secret_removals(kit), ["sbx", "secret", "ls"])
    finally:
        receiver.stop()


def last_sse_data(raw):
    payloads = [line[6:] for line in raw.split("\n") if line.startswith("data: ")]
    if not payloads:
        return None
    try:
        return json.loads(payloads[-1])
    except ValueError:
        return None


def gateway_probe(kit, sandbox, name_txt, name_json, name_http=None):
    kit.ensure_running(sandbox)
    kit.run(["sbx", "cp", os.path.join(FIXTURES, "mcp-probe.sh"), f"{sandbox}:/tmp/mcp-probe.sh"])
    kit.exec_file(name_txt, sandbox, "sh /tmp/mcp-probe.sh", label=f"sbx exec {sandbox} sh /tmp/mcp-probe.sh  (fixtures/mcp-probe.sh: initialize, notifications/initialized, tools/list)")
    raw = kit.exec_out(sandbox, "cat /tmp/mcp-tools.txt")
    data = last_sse_data(raw)
    text = raw if data is None else pretty_json(data)
    kit.write(name_json, text, [f"tools/list answer of the gateway inside {sandbox} (the data: line of /tmp/mcp-tools.txt)"])
    if name_http:
        http = kit.exec_out(sandbox, "cat /tmp/mcp-headers.txt; cat /tmp/mcp-init.txt")
        kit.write(name_http, http, [f"initialize headers and body of the gateway inside {sandbox} (/tmp/mcp-headers.txt and /tmp/mcp-init.txt)"])


def step_mcp(kit):
    kit.capture("11-mcp-add-registry.txt", ["sbx", "mcp", "add", "m101-fetch", "--url", REGISTRY_URL])
    kit.capture("11-mcp-add.txt", ["sbx", "mcp", "add", "m101-deepwiki", "--url", DEEPWIKI_URL])
    kit.capture("11-mcp-ls.txt", ["sbx", "mcp", "ls"])
    kit.json_file("11-mcp-ls.json", ["sbx", "mcp", "ls", "--json"])
    kit.capture("11-mcp-inspect.txt", ["sbx", "mcp", "inspect", "m101-deepwiki"])
    kit.json_file("11-mcp-inspect.json", ["sbx", "mcp", "inspect", "m101-deepwiki", "--json"])
    kit.json_file("11-mcp-auth-status.json", ["sbx", "mcp", "auth", "status", "--all", "--json"])
    kit.capture("11-static-create.txt", ["sbx", "create", "shell", "--name", "m101-mcp", "--static-mcp", "m101-deepwiki"])
    kit.exec_file("11-static-inside.txt", "m101-mcp", "env | grep -i mcp | sort")
    gateway_probe(kit, "m101-mcp", "11-gateway-probe-static.txt", "11-gateway-tools-static.json", "11-gateway-initialize.http")
    kit.capture("11-dynamic-create.txt", ["sbx", "create", "shell", "--name", "m101-mcp-dyn"])
    gateway_probe(kit, "m101-mcp-dyn", "11-gateway-probe-dynamic-before.txt", "11-gateway-tools-dynamic-before.json")
    kit.capture("11-load.txt", ["sbx", "mcp", "load", "m101-deepwiki", "--sandbox", "m101-mcp-dyn"])
    gateway_probe(kit, "m101-mcp-dyn", "11-gateway-probe-dynamic-after.txt", "11-gateway-tools-dynamic-after.json")
    kit.capture("11-mcp-rm.txt", ["sbx", "rm", "--force", "m101-mcp", "m101-mcp-dyn"], ["sbx", "mcp", "rm", "m101-deepwiki", "--force"], ["sbx", "mcp", "ls"])


def zip_listing(path):
    with zipfile.ZipFile(path) as archive:
        rows = [f"{info.file_size:>8}  {info.filename}" for info in sorted(archive.infolist(), key=lambda info: info.filename)]
    return "\n".join(rows) + "\n"


def step_kits_v2(kit):
    mixin = "./fixtures/kits/hello-mixin"
    kit.capture("12-validate.txt", ["sbx", "kit", "validate", mixin], cwd=HERE)
    kit.json_file("12-validate.json", ["sbx", "kit", "validate", mixin, "--json"], cwd=HERE)
    kit.capture("12-inspect.txt", ["sbx", "kit", "inspect", mixin], cwd=HERE)
    kit.json_file("12-inspect.json", ["sbx", "kit", "inspect", mixin, "--json"], cwd=HERE)
    archive = os.path.join(WORK, "hello-mixin.zip")
    pack = kit.entry(["sbx", "kit", "pack", mixin, "-o", archive], f"sbx kit pack {mixin} -o work/hello-mixin.zip", cwd=HERE)
    listing = zip_listing(archive) if os.path.exists(archive) else "(no archive written)\n"
    kit.write_blocks("12-pack.txt", [pack, (f"$ zip listing of work/hello-mixin.zip (size, name)\n{listing}", "zip listing of work/hello-mixin.zip (python zipfile)")])
    kit.json_file("12-validate-zip.json", ["sbx", "kit", "validate", archive, "--json"], cwd=HERE)
    repo_kit = os.path.join(FIXTURES, "repo-kit")
    copy_repo(os.path.join(FIXTURES, "repo"), repo_kit)
    create = kit.entry(["sbx", "create", "shell", repo_kit, "--name", "m101-kit", "--kit", mixin], f"sbx create shell $CAPTURE/fixtures/repo-kit --name m101-kit --kit {mixin}", cwd=HERE)
    kit.write_blocks("12-run-kit.txt", [create, kit.exec_entry("m101-kit", "command -v tree; tree --version | head -1; echo; ls; echo; cat HELLO.md")])
    kit.capture("12-policy-kit.txt", ["sbx", "policy", "ls", "m101-kit", "--source", "kit", "--wide"])
    kit.json_file("12-policy-kit.json", ["sbx", "policy", "ls", "m101-kit", "--source", "kit", "--wide", "--json"])
    kit.json_file("12-check-kit.json", ["sbx", "policy", "check", "network", "example.com", "--sandbox", "m101-kit", "--json"])
    kit.run(["sbx", "rm", "--force", "m101-kit"])
    kit.ensure_running(DEMO)
    kit.capture("12-kit-add-files.txt", ["sbx", "kit", "add", DEMO, mixin], cwd=HERE)
    kit.ensure_running(DEMO)
    kit.write_blocks("12-kit-add.txt", [
        kit.entry(["sbx", "kit", "add", DEMO, "./fixtures/kits/env-mixin"], cwd=HERE),
        kit.exec_entry(DEMO, "env | grep M101_FROM_KIT"),
        kit.entry(["sbx", "policy", "ls", DEMO, "--source", "kit", "--wide"]),
    ])


def step_kits_v3(kit):
    hello_kit = "./fixtures/kits/hello-kit"
    kit.capture("13-kit-v3-validate.txt", ["sbx", "kit", "validate", hello_kit], cwd=HERE)
    kit.capture("13-kit-v3-inspect.txt", ["sbx", "kit", "inspect", hello_kit, "--json"], cwd=HERE)
    kit.capture("13-kit-v3-pack.txt", ["sbx", "kit", "pack", hello_kit, "-o", os.path.join(WORK, "hello-kit.zip")], cwd=HERE)
    kit.capture("13-kit-builder-status.txt", ["sbx", "kit", "builder", "status"])


def step_env_plan(kit):
    kit.capture("14-env-plan.txt", ["sbx", "env", "plan", "./fixtures/env"], cwd=HERE)
    kit.capture("14-env-plan-arg.txt", ["sbx", "env", "plan", "--env-arg", "greeting=servus", "./fixtures/env"], cwd=HERE)


def step_skills(kit):
    kit.capture("15-skills-ls.txt", ["sbx", "skills", "ls"])
    kit.json_file("15-skills-ls.json", ["sbx", "skills", "ls", "--json"])


def tar_head(path, count=8):
    size = os.path.getsize(path)
    with tarfile.open(path) as archive:
        names = sorted(member.name for member in archive.getmembers())
    return f"size {size} bytes, {len(names)} entries, first {count} sorted:\n" + "\n".join(names[:count]) + "\n"


def step_templates(kit):
    tar_path = os.path.join(WORK, "m101-tpl.tar")
    save = ["sbx", "template", "save", DEMO, "m101-tpl:v1", "--output", tar_path]
    save_label = f"sbx template save {DEMO} m101-tpl:v1 --output work/m101-tpl.tar"
    marker = kit.exec_entry(DEMO, "touch /opt/marker-from-demo; ls -l /opt/marker-from-demo", user="root")
    kit.ensure_running(DEMO)
    save_while_running = kit.entry(save, save_label + "  (while running)")
    kit.write_blocks("07-template-save.txt", [marker, save_while_running, kit.entry(["sbx", "stop", DEMO]), kit.entry(save, save_label)])
    kit.capture("07-template-ls.txt", ["sbx", "template", "ls"])
    kit.json_file("07-template-ls.json", ["sbx", "template", "ls", "--json"])
    kit.capture("07-template-inspect.txt", ["sbx", "template", "inspect", "m101-tpl:v1"])
    head = tar_head(tar_path) if os.path.exists(tar_path) else "(no tar written)\n"
    kit.write("07-template-tar-head.txt", f"$ tar listing of work/m101-tpl.tar\n{head}", ["tar listing of work/m101-tpl.tar (python tarfile); the tar itself is not committed"])
    create = kit.entry(["sbx", "create", "--pull", "never", "-t", "m101-tpl:v1", "shell", "--name", "m101-from-tpl"])
    kit.ensure_running("m101-from-tpl")
    kit.write_blocks("07-template-run.txt", [create, kit.entry(["sbx", "ls"]), kit.exec_entry("m101-from-tpl", "ls -l /opt/marker-from-demo")])
    kit.capture("07-template-rm.txt", ["sbx", "rm", "--force", "m101-from-tpl"], ["sbx", "template", "rm", "m101-tpl:v1", "--force"], ["sbx", "template", "ls"])


def step_clone(kit):
    repo = os.path.join(FIXTURES, "repo-clone")
    copy_repo(os.path.join(FIXTURES, "repo"), repo)
    create = kit.entry(["sbx", "create", "--clone", "shell", repo, "--name", "m101-clone"], "sbx create --clone shell $CAPTURE/fixtures/repo-clone --name m101-clone")
    kit.ensure_running("m101-clone")
    kit.write_blocks("08-clone-create.txt", [create, kit.entry(["sbx", "ls"])])
    inside = "pwd; echo; git remote -v; echo; git log --oneline; echo; ls -la /run/sandbox/source; git -C /run/sandbox/source log --oneline -1; touch /run/sandbox/source/x 2>&1; echo; mount | grep -E 'virtiofs|/run/sandbox|repo-clone'; echo; git config --list --show-origin | grep -E 'remote|branch'"
    kit.exec_file("08-clone-inside.txt", "m101-clone", inside)
    commit = f"printf hi > from-sandbox.txt && git add from-sandbox.txt && printf 'from sandbox\\n' > /tmp/msg && {INSIDE_GIT_DATE} git -c user.name=agent -c user.email=agent@example.test commit -q -F /tmp/msg; git log --oneline; echo; git push 2>&1; echo push-exit=$?"
    kit.exec_file("08-clone-commit.txt", "m101-clone", commit, label=f"sbx exec m101-clone sh -c {shlex.quote(commit)}")
    kit.capture(
        "08-clone-host.txt",
        host_git(repo, "remote", "-v"),
        host_git(repo, "config", "--local", "--list", "--show-origin"),
        host_git(repo, "ls-remote", "sandbox-m101-clone"),
        host_git(repo, "fetch", "sandbox-m101-clone"),
        host_git(repo, "for-each-ref"),
        host_git(repo, "log", "--oneline", "--all"),
        env=HOST_GIT_ENV,
    )
    kit.capture("08-clone-rm.txt", ["sbx", "rm", "--force", "m101-clone"], host_git(repo, "remote", "-v"), host_git(repo, "for-each-ref", "refs/sandboxes/"), env=HOST_GIT_ENV)


def step_second_sandbox_prune(kit):
    repo = os.path.join(FIXTURES, "repo")
    kit.ensure_running(DEMO)
    kit.capture("04-second-sandbox.txt", ["sbx", "create", "shell", repo, "--name", "m101-demo-2"])
    kit.ensure_running(DEMO)
    kit.json_file("04-second-sandbox.json", ["sbx", "ls", "--json"])
    kit.capture("04-stop.txt", ["sbx", "stop", "m101-demo-2"], ["sbx", "ls"])
    kit.ensure_running(DEMO)
    kit.json_file("04-stop.json", ["sbx", "ls", "--json"])
    kit.ensure_running(DEMO)
    kit.json_file("04-prune-dry-run.json", ["sbx", "prune", "--dry-run", "--json"])
    kit.capture("04-prune.txt", ["sbx", "stop", DEMO], ["sbx", "prune", "--force"], ["sbx", "ls", "--json"])


def step_cleanup(kit):
    remove_kit_sandboxes(kit)
    kit.capture("99-final-state.txt", ["sbx", "ls"], ["sbx", "template", "ls"], ["sbx", "mcp", "ls"], ["sbx", "secret", "ls"], ["sbx", "policy", "ls"])


def ensure_repo():
    repo = os.path.join(FIXTURES, "repo")
    if not os.path.isdir(os.path.join(repo, ".git")):
        make_repo(repo)
    return repo


def probe(args):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=PROBE_TIMEOUT)
    except subprocess.TimeoutExpired:
        return None


def probe_ok(args):
    result = probe(args)
    return result is not None and result.returncode == 0


def docker_running():
    return probe_ok(["docker", "info", "--format", "{{.ServerVersion}}"])


def model_rows(text):
    names = {MODEL_NAME, MODEL_NAME.split("/", 1)[-1]}
    return [line for line in text.splitlines() if line.split()[:1] and line.split()[0] in names]


def model_listed():
    result = probe(["docker", "model", "ls"])
    return result is not None and result.returncode == 0 and bool(model_rows(result.stdout))


def model_tier_reason():
    if not docker_running():
        return "the Docker daemon is not reachable"
    if not model_listed():
        return f"docker model ls does not list {MODEL_NAME}"
    return None


def registry_url(path=""):
    return f"http://{LOCAL_REGISTRY_HOST}/v2/{path}"


def registry_ready(kit):
    return port_open(LOCAL_REGISTRY_PORT) and kit.run(curl_status(registry_url()))[1].strip() == "200"


def ensure_registry(kit):
    kit.run(["docker", "network", "create", LOCAL_NET])
    running = kit.output(["docker", "ps", "--filter", f"name=^{LOCAL_REGISTRY}$", "--format", "{{.Names}}"]).strip()
    if running != LOCAL_REGISTRY:
        kit.run(["docker", "rm", "-f", LOCAL_REGISTRY])
        kit.run(["docker", "run", "-d", "--name", LOCAL_REGISTRY, "--network", LOCAL_NET, "-p", f"127.0.0.1:{LOCAL_REGISTRY_PORT}:5000", "registry:2"])
    for _ in range(60):
        if registry_ready(kit):
            return
        time.sleep(1)


def remove_registry(kit):
    kit.run(["docker", "rm", "-f", LOCAL_REGISTRY])
    kit.run(["docker", "network", "rm", LOCAL_NET])


def remove_model_tier_leftovers(kit):
    kit.run(["docker", "compose", "-f", "fixtures/compose/compose.yaml", "down", "--remove-orphans"], cwd=HERE)
    kit.run(["docker", "buildx", "rm", "--force", BUILDER])
    remove_registry(kit)
    images = kit.output(["docker", "images", f"{LOCAL_REGISTRY_HOST}/m101/*", "--format", "{{.Repository}}:{{.Tag}}"]).split()
    for image in (*images, KIT_REF_IN_NET, f"{LOCAL_REGISTRY_HOST}/docker/sandbox-templates:shell"):
        kit.run(["docker", "image", "rm", image])
    for sandbox in kit.sandboxes():
        if HERE in json.dumps(sandbox):
            kit.run(["sbx", "rm", "--force", sandbox["name"]])


def cassette_path(name):
    return os.path.join(CASSETTE_WORK, f"{name}.yaml")


def committed_cassette(name):
    return os.path.join(CASSETTES, f"{name}.yaml.gz")


def replay(name):
    return ["--fake", f"{CASSETTE_WORK}/{name}"]


def unpack_cassettes():
    os.makedirs(CASSETTE_WORK, exist_ok=True)
    for name in sorted(os.listdir(CASSETTES)):
        if not name.endswith(".yaml.gz"):
            continue
        with gzip.open(os.path.join(CASSETTES, name), "rt", encoding="utf-8") as handle:
            text = handle.read()
        text = text.replace("$CAPTURE", HERE).replace("$HOME", HOME)
        write_file(os.path.join(CASSETTE_WORK, name[:-3]), text)


def pack_cassettes(names):
    tokens = ((HERE, "$CAPTURE"), (os.path.realpath(HOME), "$HOME"), (HOME, "$HOME"))
    for name in names:
        path = cassette_path(name)
        if not os.path.exists(path):
            continue
        text = read_file(path)
        for value, token in tokens:
            text = text.replace(value, token)
        with open(committed_cassette(name), "wb") as handle:
            handle.write(gzip.compress(text.encode("utf-8"), mtime=0))


def cassette_head(name, count=12):
    path = cassette_path(name)
    if not os.path.exists(path):
        return f"(cassettes/{name}.yaml was not written)\n"
    lines = read_file(path).split("\n")
    shown = "\n".join(line[:160] for line in lines[:count])
    return f"{len(lines)} lines, first {count}, cut at 160 columns:\n{shown}\n"


def hook_log_text(path):
    if not os.path.exists(path):
        return "(the hook wrote nothing)\n"
    rows = []
    decoder = json.JSONDecoder()
    text = read_file(path).strip()
    position = 0
    while position < len(text):
        try:
            value, end = decoder.raw_decode(text, position)
        except ValueError:
            rows.append(text[position:].strip())
            break
        rows.append(json.dumps(scrub(value), ensure_ascii=False, sort_keys=True))
        position = end
        while position < len(text) and text[position].isspace():
            position += 1
    return "\n".join(sorted(rows)) + "\n"


def session_db_text(path):
    if not os.path.exists(path):
        return "(no session.db)\n"
    lines = ["$ ls work/data/session.db", "work/data/session.db", "", "$ sqlite3 work/data/session.db .tables  (python sqlite3)"]
    con = sqlite3.connect(path)
    tables = [row[0] for row in con.execute("select name from sqlite_master where type='table' order by name")]
    lines.append(" ".join(tables))
    for table in tables:
        columns = [row[1] for row in con.execute(f"pragma table_info({table})")]
        count = con.execute(f"select count(*) from {table}").fetchone()[0]
        lines += ["", f"$ sqlite3 work/data/session.db 'pragma table_info({table})'  ({count} rows)", " ".join(columns)]
        if table != "sessions":
            continue
        wanted = [column for column in ("id", "title", "agent_filename", "agent_name") if column in columns]
        if wanted:
            query = f"select {', '.join(wanted)} from sessions order by created_at desc limit 5"
            lines += ["", f"$ sqlite3 work/data/session.db '{query}'"]
            lines.extend(" | ".join(str(item) for item in row) for row in con.execute(query))
    con.close()
    return "\n".join(lines) + "\n"


def sse_scrub(text):
    out = []
    pending = []

    def flush():
        for event in compact_events(pending):
            out.append("data: " + json.dumps(scrub(event), ensure_ascii=False, sort_keys=True))
            out.append("")
        pending.clear()

    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                pending.append(json.loads(line[6:]))
                continue
            except ValueError:
                pass
        if not line.strip():
            continue
        flush()
        out.append(line)
    flush()
    return "\n".join(out).rstrip("\n") + "\n"


def sse_payloads(text):
    payloads = []
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                payloads.append(json.loads(line[6:]))
            except ValueError:
                pass
    return payloads


def rpc_result(body):
    stripped = body.strip()
    try:
        return json.loads(stripped)
    except ValueError:
        payloads = sse_payloads(stripped)
        return payloads[-1] if payloads else {}


def build_log(text):
    kept = []
    for line in text.split("\n"):
        if not line.strip() or any(noise in line for noise in BUILD_NOISE):
            continue
        line = re.sub(r"(FROM \S+?)@sha256:[0-9a-f]{64}", r"\1", line)
        kept.append(re.sub(r" \d+(?:\.\d+)?s done$", " done", line))
    masked = list(dict.fromkeys(mask_text(line, None) for line in kept))
    final = set(masked)
    return "\n".join(line for line in masked if line + " done" not in final) + "\n"


def manifest_curl(repository, reference):
    return ["curl", "-sS", "-H", OCI_ACCEPT, registry_url(f"m101/{repository}/manifests/{reference}")]


def manifest_view(data):
    annotations = data.get("annotations") or {}
    descriptor = annotations.get("vnd.docker.sandbox.kit.descriptor")
    if descriptor:
        decoded = json.loads(descriptor)
        provides = decoded.get("provides") or []
        if len(provides) > 5:
            decoded["provides"] = provides[:5] + [f"... {len(provides) - 5} more derived provides entries"]
        annotations["vnd.docker.sandbox.kit.descriptor"] = decoded
    if "layers" in data:
        data["layers"] = [f"{len(data['layers'])} layers"]
    return data


def step_docker_agent_new(kit):
    description = "an agent that greets the user and names one fact about Docker sandboxes"
    before = set(os.listdir(WORK))
    shown = f"docker-agent new --model {MODEL} {shlex.quote(description)}  (in work/, without a controlling terminal)"
    kit.write_blocks("17-new.txt", [kit.entry(agent_in_work("new", "--model", MODEL, description), cwd=WORK, shown=shown, new_session=True)])
    written = sorted(name for name in set(os.listdir(WORK)) - before if name.endswith((".yaml", ".yml")))
    if written:
        kit.write("17-new-agent.yaml", read_file(os.path.join(WORK, written[0])), [f"cat work/{written[0]} (written by docker-agent new)"])
    else:
        kit.write("17-new-agent.yaml", "(docker-agent new wrote no YAML file into work/)\n", ["docker-agent new wrote no file"])


def step_single_agent(kit):
    ensure_repo()
    files = "fixtures/agents/files.yaml"
    run = ["run", "--exec", "--working-dir", "fixtures/repo"]
    fake = replay("18-files")
    kit.ensure_cassette("18-files", [*run, files, *FILES_TURNS])
    kit.agent_file("18-run-exec.txt", [*run, *fake, files, *FILES_TURNS], output_filter=cut_reasoning)
    events = kit.ndjson_file("18-run-json.ndjson", [*run, "--json", *fake, files, *FILES_TURNS])
    kit.write("18-transcript.txt", transcript_text(events), ["the user message, tool calls, tool results, and answer, cut from 18-run-json.ndjson"])
    kit.agent_file("18-run-last.txt", [*run, "--last", *fake, files, *FILES_TURNS])
    kit.write("18-cassette-head.txt", cassette_head("18-files"), ["head of cassettes/18-files.yaml (written by --record cassettes/18-files, replayed by --fake cassettes/18-files)"])


def step_team(kit):
    team = "fixtures/agents/team.yaml"
    fake = replay("19-team")
    kit.ensure_cassette("19-team", ["run", "--exec", team, *TEAM_TURNS])
    kit.agent_file("19-team.txt", ["run", "--exec", *fake, team, *TEAM_TURNS], output_filter=cut_reasoning)
    events = kit.ndjson_file("19-team.ndjson", ["run", "--exec", "--json", *fake, team, *TEAM_TURNS])
    kit.write("19-transcript.txt", transcript_text(events), ["the delegation as events: user message, transfer_task, handoff, tool results, answers, cut from 19-team.ndjson"])
    for tool, name in (("transfer_task", "19-transfer-task.json"), ("handoff", "19-handoff.json")):
        picked = [event for event in events if event.get("type") == "tool_call" and event.get("tool_call", {}).get("function", {}).get("name") == tool]
        text = pretty_json(picked) if picked else f"(no tool_call event names {tool} in 19-team.ndjson)\n"
        kit.write(name, text, [f"the tool_call events for {tool}, cut from 19-team.ndjson"])
    kit.ensure_cassette("19-background", ["run", "--exec", team, BACKGROUND_TASK])
    background = kit.ndjson_file("19-background.ndjson", ["run", "--exec", "--json", *replay("19-background"), team, BACKGROUND_TASK])
    kit.write("19-background.txt", transcript_text(background), ["the background agent run as events, cut from 19-background.ndjson"])


def step_permissions(kit):
    guarded = "fixtures/agents/guarded.yaml"
    hook_log = os.path.join(WORK, "hook-stdin.jsonl")
    kit.ensure_cassette("20-strict", ["run", "--exec", "--safety", "strict", guarded, *GUARDED_TURNS])
    strict = kit.ndjson_file("20-strict.ndjson", ["run", "--exec", "--json", "--safety", "strict", *replay("20-strict"), guarded, *GUARDED_TURNS])
    kit.write("20-strict.txt", transcript_text(strict), ["the --safety strict run as events, cut from 20-strict.ndjson"])
    kit.ensure_cassette("20-restricted", ["run", "--exec", "--safety", "restricted", guarded, *GUARDED_TURNS])
    remove_file(hook_log)
    restricted = kit.ndjson_file("20-restricted.ndjson", ["run", "--exec", "--json", "--safety", "restricted", *replay("20-restricted"), guarded, *GUARDED_TURNS])
    kit.write("20-restricted.txt", transcript_text(restricted), ["the --safety restricted run as events, cut from 20-restricted.ndjson"])
    kit.write("20-hook-stdin.jsonl", hook_log_text(hook_log), ["stdin of fixtures/hooks/log-hook.sh for each shell call of the --safety restricted replay (work/hook-stdin.jsonl)"])
    kit.agent_json("20-debug-toolsets.json", ["debug", "toolsets", guarded, "--json"])
    kit.agent_file("20-debug-tool.txt", ["debug", "tool", guarded, "shell", '{"cmd":"echo m101-direct"}'])


def step_sessions(kit):
    ensure_repo()
    run = ["run", "--exec", "--last", "--working-dir", "fixtures/repo", *replay("18-files"), "fixtures/agents/files.yaml", *FILES_TURNS]
    kit.agent_file("21-two-runs.txt", run, run)
    kit.agent_file("21-sessions.txt", ["sessions"])
    kit.agent_file("21-sessions-diff.txt", ["sessions", "diff", "-1", "-2"], ["sessions", "diff", "--", "-1", "-2"], ["sessions", "diff", "--fail-on-divergence", "--", "-1", "-3"])
    kit.agent_json("21-sessions-diff.json", ["sessions", "diff", "--json", "--", "-1", "-2"], transform=scrub)
    kit.write("21-session-db.txt", session_db_text(os.path.join(WORK, "data", "session.db")), ["the tables and session rows of work/data/session.db (python sqlite3)"])


def model_text(value):
    if isinstance(value, dict):
        return {key: ("<model-text>" if key in ("reasoning_content", "reason") and isinstance(item, str) and item else model_text(item)) for key, item in value.items()}
    if isinstance(value, list):
        return [model_text(item) for item in value]
    return value


def eval_run(kit, suffix, extra):
    out_dir = os.path.join(WORK, f"eval-results{suffix}")
    remove_tree(out_dir)
    text, label = kit.agent_entry(["eval", "fixtures/agents/files.yaml", "fixtures/evals", "--judge-model", MODEL, "-c", "1", *extra, "--output", f"work/eval-results{suffix}"])
    names = sorted(os.listdir(out_dir)) if os.path.isdir(out_dir) else []
    run_name = next((name[:-5] for name in names if name.endswith(".json") and not name.endswith("-sessions.json")), None)

    def unname(value):
        return value.replace(run_name, "<run>") if run_name else value

    kit.write(f"22-eval{suffix}.txt", unname(text), [label])
    listing = "\n".join(unname(name) for name in names) if names else "(no results directory)"
    kit.write(f"22-eval-results-ls{suffix}.txt", f"$ ls work/eval-results{suffix}\n{listing}\n", [f"ls work/eval-results{suffix}"])
    if run_name:
        data = json.loads(read_file(os.path.join(out_dir, run_name + ".json")))
        kit.write(f"22-eval-run{suffix}.json", unname(pretty_json(scrub(model_text(data)))), [f"cat work/eval-results{suffix}/<run>.json (the run file docker-agent eval wrote; reasoning_content and the judge's reason replaced by <model-text>)"])


def step_eval(kit):
    eval_run(kit, "", [])
    eval_run(kit, "-gateway", ["--models-gateway", "http://model-runner.docker.internal/engines"])
    eval_run(kit, "-container-env", ["-e", "DOCKER_AGENT_MODELS_GATEWAY=http://model-runner.docker.internal/engines"])


def api_exchanges(transcript):
    base = f"http://127.0.0.1:{API_PORT}"
    transcript.exchange("ping", "GET", f"{base}/api/ping")
    transcript.exchange("agents", "GET", f"{base}/api/agents")
    created = rpc_result(transcript.exchange("create a session", "POST", f"{base}/api/sessions", body="{}"))
    session_id = created.get("id", "missing")
    stream = transcript.exchange("run the agent (SSE)", "POST", f"{base}/api/sessions/{session_id}/agent/pong", body='{"messages":[{"role":"user","content":"ping"}]}', headers=["Accept: text/event-stream"], stream=True)
    transcript.exchange("read the session back", "GET", f"{base}/api/sessions/{session_id}")
    return stream


def serve_api(kit, pong):
    serve = ["serve", "api", pong, "--listen", f"127.0.0.1:{API_PORT}", "-s", "work/api-session.db"]
    flags = kit.recording_flags("23-api")
    if flags:
        with start_server([*serve, *flags], API_PORT, "serve-api-record.log"):
            api_exchanges(Transcript(kit))
    remove_file(os.path.join(WORK, "api-session.db"))
    transcript = Transcript(kit)
    with start_server([*serve, *replay("23-api")], API_PORT, "serve-api.log") as shown:
        stream = api_exchanges(transcript)
    transcript.write("23-api.http", shown)
    kit.write("23-api-run.sse", sse_scrub(stream.replace("\r\n", "\n")), ["the body of the SSE answer to POST /api/sessions/<id>/agent/pong (reasoning events dropped, agent_choice tokens joined)"])
    kit.server_log("23-serve-api.log", "serve-api.log", f"stdout and stderr of {shown}")


def serve_chat(kit, pong):
    base = f"http://127.0.0.1:{CHAT_PORT}"
    auth = "Authorization: Bearer m101-chat-key"
    transcript = Transcript(kit)
    with start_server(["serve", "chat", pong, "--listen", f"127.0.0.1:{CHAT_PORT}", "--api-key", "m101-chat-key"], CHAT_PORT, "serve-chat.log") as shown:
        models = rpc_result(transcript.exchange("models", "GET", f"{base}/v1/models", headers=[auth]))
        model_id = (models.get("data") or [{}])[0].get("id", "pong")
        body = json.dumps({"model": model_id, "messages": [{"role": "user", "content": "ping"}]})
        transcript.exchange("chat completion", "POST", f"{base}/v1/chat/completions", body=body, headers=[auth])
        transcript.exchange("the same without the token", "POST", f"{base}/v1/chat/completions", body=body)
    transcript.write("23-chat.http", shown)


def mcp_call(transcript, title, base, payload, session_id=None):
    headers = ["Accept: application/json, text/event-stream"]
    if session_id:
        headers.append(f"Mcp-Session-Id: {session_id}")
    return transcript.exchange(title, "POST", base, body=json.dumps(payload), headers=headers)


def mcp_session_id(head):
    session_id = None
    for line in head.split("\n"):
        if line.lower().startswith("mcp-session-id:"):
            session_id = line.split(":", 1)[1].strip()
    return session_id


def serve_mcp(kit, pong):
    base = f"http://127.0.0.1:{MCP_PORT}/mcp"
    transcript = Transcript(kit)
    with start_server(["serve", "mcp", pong, "--http", "--listen", f"127.0.0.1:{MCP_PORT}", "--tool-name", "pong"], MCP_PORT, "serve-mcp.log") as shown:
        init = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2026-07-28", "capabilities": {}, "clientInfo": {"name": "m101", "version": "0"}}}
        mcp_call(transcript, "initialize", base, init)
        session_id = mcp_session_id(transcript.last_head)
        mcp_call(transcript, "notifications/initialized", base, {"jsonrpc": "2.0", "method": "notifications/initialized"}, session_id)
        tools = rpc_result(mcp_call(transcript, "tools/list", base, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, session_id))
        listed = (tools.get("result") or {}).get("tools") or []
        tool = listed[0] if listed else {"name": "pong", "inputSchema": {}}
        schema = tool.get("inputSchema") or {}
        argument = (schema.get("required") or list((schema.get("properties") or {}).keys()) or ["message"])[0]
        call = {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": tool.get("name", "pong"), "arguments": {argument: "ping"}}}
        mcp_call(transcript, "tools/call", base, call, session_id)
    transcript.write("23-mcp.http", shown)


def acp_received_line(line):
    try:
        return "<< " + json.dumps(scrub(json.loads(line)), ensure_ascii=False, sort_keys=True)
    except ValueError:
        return "<< " + line


def serve_acp(kit, pong):
    messages = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": 1, "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False}}}},
        {"jsonrpc": "2.0", "id": 2, "method": "session/new", "params": {"cwd": HERE, "mcpServers": []}},
    ]
    args = agent("serve", "acp", pong)
    proc = subprocess.Popen(args, cwd=HERE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    received = []

    def reader():
        for line in proc.stdout:
            received.append(line.rstrip("\n"))

    threading.Thread(target=reader, daemon=True).start()
    lines = []
    for message in messages:
        wanted = len(received) + 1
        proc.stdin.write(json.dumps(message) + "\n")
        proc.stdin.flush()
        lines.append(">> " + json.dumps(message, ensure_ascii=False))
        deadline = time.time() + 60
        while len(received) < wanted and time.time() < deadline and proc.poll() is None:
            time.sleep(0.2)
        lines.extend(acp_received_line(line) for line in received[wanted - 1:])
        if len(received) < wanted:
            lines.append("<< (no answer within 60 s)")
    proc.stdin.close()
    wait_or_kill(proc, 15, 5)
    stderr = proc.stderr.read().strip()
    if stderr:
        lines.append(stderr_lines(stderr))
    lines.append(f"[exit {proc.returncode}]")
    kit.write("23-acp.jsonl", "\n".join(lines) + "\n", [f"{shown_command(args)}  (JSON-RPC lines on stdin, >> sent, << received)"])


def a2a_task(result):
    if isinstance(result.get("task"), dict):
        return result["task"]
    if result.get("kind") == "task":
        return result
    return {}


def serve_a2a(kit, pong):
    base = f"http://127.0.0.1:{A2A_PORT}"
    transcript = Transcript(kit)
    with start_server(["serve", "a2a", pong, "--listen", f"127.0.0.1:{A2A_PORT}"], A2A_PORT, "serve-a2a.log") as shown:
        card = rpc_result(transcript.exchange("agent card", "GET", f"{base}/.well-known/agent-card.json"))
        if not card:
            card = rpc_result(transcript.exchange("agent card, legacy path", "GET", f"{base}/.well-known/agent.json"))
        kit.write("23-agent-card.json", pretty_json(scrub(card)) if card else "(no agent card answered)\n", ["the agent card served by docker-agent serve a2a"])
        interfaces = card.get("supportedInterfaces") or []
        endpoint = (interfaces[0].get("url") if interfaces else None) or card.get("url") or f"{base}/"
        send = {"jsonrpc": "2.0", "id": 1, "method": "SendMessage", "params": {"message": {"messageId": "m101-0001", "role": "ROLE_USER", "parts": [{"text": "ping"}]}}}
        answer = rpc_result(transcript.exchange("SendMessage (A2A 1.0 names)", "POST", endpoint, body=json.dumps(send), headers=[A2A_V1]))
        legacy = "error" in answer or not answer
        if legacy:
            send = {"jsonrpc": "2.0", "id": 2, "method": "message/send", "params": {"message": {"messageId": "m101-0002", "role": "user", "kind": "message", "parts": [{"kind": "text", "text": "ping"}]}}}
            answer = rpc_result(transcript.exchange("message/send (A2A 0.3 names)", "POST", endpoint, body=json.dumps(send)))
        task_id = a2a_task(answer.get("result") or {}).get("id")
        if task_id:
            method = "tasks/get" if legacy else "GetTask"
            headers = [] if legacy else [A2A_V1]
            transcript.exchange(method, "POST", endpoint, body=json.dumps({"jsonrpc": "2.0", "id": 3, "method": method, "params": {"id": task_id}}), headers=headers)
    transcript.write("23-a2a.http", shown)


def step_serve(kit):
    pong = "fixtures/agents/pong.yaml"
    serve_api(kit, pong)
    serve_chat(kit, pong)
    serve_mcp(kit, pong)
    serve_acp(kit, pong)
    serve_a2a(kit, pong)


def step_share(kit):
    ensure_registry(kit)
    kit.agent_file("24-share-push.txt", ["share", "push", "fixtures/agents/files.yaml", AGENT_REF])
    pull = agent_in_work("share", "pull", AGENT_REF, "--force")
    kit.write_blocks("24-share-pull.txt", [kit.entry(pull, cwd=WORK, shown=f"docker-agent share pull {AGENT_REF} --force  (in work/)")])
    pulled = sorted(name for name in os.listdir(WORK) if "m101_agent" in name and name.endswith(".yaml"))
    if pulled:
        kit.write("24-share-pull-agent.yaml", read_file(os.path.join(WORK, pulled[0])), [f"cat work/{pulled[0]} (written by share pull)"])
    kit.json_file("24-manifest.json", manifest_curl("agent", "v1"))
    kit.capture("24-registry.txt", ["curl", "-sS", registry_url("_catalog")], ["curl", "-sS", registry_url("m101/agent/tags/list")], ["curl", "-sS", "-I", "-H", OCI_ACCEPT, registry_url("m101/agent/manifests/v1")])
    ensure_repo()
    kit.agent_file("24-run-ref.txt", ["run", "--exec", "--last", "--working-dir", "fixtures/repo", *replay("18-files"), AGENT_REF, *FILES_TURNS])


def step_dmr(kit):
    kit.capture("25-model-ls.txt", ["docker", "model", "ls"])
    kit.json_file("25-model-status.json", ["docker", "model", "status", "--json"])
    kit.json_file("25-models.json", ["curl", "-sS", f"{DMR_URL}/engines/v1/models"], transform=scrub)
    kit.agent_file("25-doctor.txt", ["doctor"])
    kit.agent_json("25-doctor.json", ["doctor", "--json"])
    kit.agent_file("25-doctor-dmr-agent.txt", ["doctor", "fixtures/agents/dmr.yaml"])
    kit.agent_file("25-run-dmr.txt", ["run", "--exec", "--last", "fixtures/agents/dmr.yaml", "Say hello."])


def compose_log(text):
    text = ANSI.sub("", text)
    text = re.sub(r"Bearer [A-Za-z0-9]{32,}", "Bearer <token>", text)
    text = re.sub(r"\b(in|after) \d+(?:\.\d+)?(?:µs|ms|s)\b", r"\1 <dur>", text)
    lines = [line for line, _ in itertools.groupby(row.rstrip() for row in text.split("\n"))]
    services = {}
    rest = []
    for line in lines:
        match = COMPOSE_SERVICE.match(line)
        if match:
            services.setdefault(match.group(1), []).append(f"{match.group(1)} | {line[match.end():]}")
        else:
            rest.append(line)
    for service in sorted(services):
        rest.extend(services[service])
    return "\n".join(rest)


def step_compose(kit):
    compose = ["docker", "compose", "-f", "fixtures/compose/compose.yaml"]
    kit.capture("26-compose-config.txt", [*compose, "config"], cwd=HERE)
    kit.run([*compose, "pull", "--quiet"], cwd=HERE)
    kit.capture("26-compose-up.txt", [*compose, "up", "--abort-on-container-exit"], cwd=HERE, output_filter=compose_log)
    kit.capture("26-compose-down.txt", [*compose, "down"], cwd=HERE, output_filter=compose_log)


def kit_cache_text(cache_dir):
    root = os.path.join(cache_dir, "sandbox-kits")
    if not os.path.isdir(root):
        return f"(no {capture_relative(root)} directory)\n"
    lines = [f"$ find {capture_relative(root)} -maxdepth 3 | sort"]
    walk = sorted(os.walk(root))
    for base, _, files in walk:
        if base[len(root):].count(os.sep) > 2:
            continue
        lines.append(capture_relative(base))
        lines.extend(capture_relative(os.path.join(base, name)) for name in sorted(files))
    manifests = [os.path.join(base, "manifest.json") for base, _, files in walk if "manifest.json" in files]
    if manifests:
        lines += ["", "$ cat " + capture_relative(manifests[0])]
        text = read_file(manifests[0])
        try:
            lines.append(pretty_json(scrub(json.loads(text))).rstrip("\n"))
        except ValueError:
            lines.append(text.rstrip("\n"))
    return "\n".join(lines) + "\n"


def watch_sandbox_run(kit, args, log_path, before):
    during = None
    with open(log_path, "w", encoding="utf-8") as log:
        proc = subprocess.Popen(args, cwd=HERE, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        deadline = time.time() + COMMAND_TIMEOUT
        while proc.poll() is None and time.time() < deadline:
            appeared = {sandbox["name"] for sandbox in kit.sandboxes()} - before
            if appeared and during is None:
                time.sleep(3)
                during = kit.entry(["sbx", "ls"], "sbx ls  (while docker-agent run --sandbox is running)")
            time.sleep(2)
        if proc.poll() is None:
            proc.kill()
        proc.wait()
    return during, proc.returncode


def step_sandbox_run(kit):
    workspace = os.path.join(FIXTURES, "repo-sandbox")
    copy_repo(ensure_repo(), workspace)
    state = os.path.join(workspace, ".m101")
    dirs = agent_dirs(state)
    agent_file = os.path.join(FIXTURES, "agents", "files-sandbox.yaml")
    note = "  (--config-dir, --data-dir, --cache-dir under fixtures/repo-sandbox/.m101, inside the workspace)"
    kit.write_blocks("27-data-dir-outside.txt", [kit.agent_entry(["run", "--sandbox", "--exec", "--working-dir", "fixtures/repo-sandbox", "fixtures/agents/files-sandbox.yaml", FILES_TASK])])
    allow = ["docker-agent", *dirs, "sandbox", "allow", "localhost:12434"]
    listing = ["docker-agent", *dirs, "sandbox", "list"]
    kit.write_blocks("27-sandbox-allow.txt", [kit.entry(command, cwd=HERE, shown=shown_command(command) + note) for command in (allow, listing)])
    before = {sandbox["name"] for sandbox in kit.sandboxes()}
    args = ["docker-agent", *dirs, "run", "--sandbox", "--exec", "--working-dir", workspace, agent_file, FILES_TASK]
    log_path = os.path.join(WORK, "sandbox-run.log")
    during, code = watch_sandbox_run(kit, args, log_path, before)
    shown = shown_command(args) + note
    body = read_file(log_path).rstrip("\n")
    kit.write("27-sandbox-run.txt", f"$ {shown}\n{body}\n[exit {code}]\n", [shown])
    kit.write_blocks("27-sbx-ls.txt", [during or ("$ sbx ls\n(no new sandbox appeared while the run was active)\n", "sbx ls during the run")])
    new_names = [sandbox["name"] for sandbox in kit.sandboxes() if sandbox["name"] not in before]
    kit.json_file("27-sbx-ls.json", ["sbx", "ls", "--json"])
    kit.write("27-kit-cache.txt", kit_cache_text(os.path.join(state, "cache")), ["the staged kit under fixtures/repo-sandbox/.m101/cache/sandbox-kits and its manifest.json"])
    if new_names:
        inside = "docker-agent version; echo; env | grep -iE 'proxy|gateway|models|safety|yolo' | sort; echo; docker-agent sandbox list"
        probe = "cd \"$PWD\" && mkdir -p .m101/probe && python3 -c 'import sqlite3; c = sqlite3.connect(\".m101/probe/x.db\"); c.execute(\"create table t(a)\"); c.execute(\"insert into t values (1)\"); c.commit(); print(\"sqlite write ok\")' 2>&1 | tail -1; mount | grep repo-sandbox"
        inner = f"docker-agent --config-dir /tmp/m101 --data-dir /tmp/m101 --cache-dir /tmp/m101 run --exec --last --working-dir {workspace} {agent_file} {shlex.quote(FILES_TASK)}"
        for name, script in (("27-inside.txt", inside), ("27-sqlite-probe.txt", probe), ("27-inside-run.txt", inner)):
            kit.exec_file(name, new_names[0], script, label=f"sbx exec <sandbox> sh -c {shlex.quote(script)}")
    removals = [["sbx", "rm", "--force", name] for name in new_names] or [["sbx", "ls"]]
    kit.capture("27-sbx-rm.txt", *removals)


def step_kit_v3(kit):
    ensure_registry(kit)
    kit_dir = "fixtures/kits/hello-kit"
    build = ["docker", "buildx", "build", "--progress=plain", "-f", f"{kit_dir}/kit.yaml"]
    lossy = f"{LOCAL_REGISTRY_HOST}/m101/hello-kit:docker-driver"
    kit.capture("28-buildx-docker-driver.txt", [*build, "-t", lossy, "--push", kit_dir], cwd=HERE, output_filter=build_log)
    kit.json_file("28-manifest-docker-driver.json", manifest_curl("hello-kit", "docker-driver"), transform=manifest_view)
    kit.capture("28-kit-inspect-source.txt", ["sbx", "kit", "inspect", f"./{kit_dir}", "--json"], cwd=HERE)
    write_file(os.path.join(WORK, "buildkitd.toml"), f'[registry."docker.io"]\n  mirrors = ["{LOCAL_REGISTRY}:5000"]\n[registry."{LOCAL_REGISTRY}:5000"]\n  http = true\n  insecure = true\n')
    base = "docker/sandbox-templates:shell"
    mirror = f"{LOCAL_REGISTRY_HOST}/{base}"
    kit.run(["docker", "pull", base])
    kit.run(["docker", "tag", base, mirror])
    kit.run(["docker", "push", mirror])
    kit.run(["docker", "buildx", "rm", "--force", BUILDER])
    kit.capture("28-builder.txt", ["cat", "work/buildkitd.toml"], ["docker", "buildx", "create", "--name", BUILDER, "--driver", "docker-container", "--driver-opt", f"network={LOCAL_NET}", "--buildkitd-config", "work/buildkitd.toml"], cwd=HERE)
    kit.capture("28-buildx.txt", [*build, "--builder", BUILDER, "-t", KIT_REF_IN_NET, "--push", kit_dir], cwd=HERE, output_filter=build_log)
    index = kit.json_result(manifest_curl("hello-kit", "v1"))
    kit.json_file("28-index.json", manifest_curl("hello-kit", "v1"))
    platform = next((item["digest"] for item in index.get("manifests", []) if item.get("platform", {}).get("os") == "linux"), "v1")
    kit.json_file("28-manifest.json", manifest_curl("hello-kit", platform), transform=manifest_view, shown=shlex.join(manifest_curl("hello-kit", "<platform manifest digest from 28-index.json>")))
    kit.capture("28-kit-inspect.txt", ["sbx", "kit", "inspect", KIT_REF, "--json"])
    copy_repo(os.path.join(FIXTURES, "repo"), os.path.join(FIXTURES, "repo-kit"))
    kit.capture("28-run-kit.txt", ["sbx", "create", KIT_REF, "fixtures/repo-kit", "--name", "m101-v3"], cwd=HERE)
    kit.run(["sbx", "rm", "--force", "m101-v3"])
    kit.capture("28-buildx-rm.txt", ["docker", "buildx", "rm", BUILDER], ["docker", "image", "rm", lossy], ["docker", "image", "rm", mirror])
    remove_registry(kit)


def step_legacy(kit):
    kit.capture("29-docker-sandbox.txt", ["docker", "sandbox", "--help"], ["docker", "sandbox", "version"])
    kit.capture("29-docker-agent-plugin.txt", ["docker", "agent", "version"], ["docker-agent", "version"])
    kit.capture("29-docker-plugins.txt", ["docker", "--version"], ["docker", "info", "--format", "{{range .ClientInfo.Plugins}}{{.Name}} {{.Version}}{{\"\\n\"}}{{end}}"])


def step_model_cleanup(kit):
    remove_model_tier_leftovers(kit)
    kit.run(["docker", "model", "unload", MODEL_NAME])
    kit.capture("98-model-final-state.txt", ["docker", "ps", "-a", "--filter", "name=m101-", "--format", "{{.Names}} {{.Status}}"], ["docker", "images", f"{LOCAL_REGISTRY_HOST}/m101/*", "--format", "{{.Repository}}:{{.Tag}}"], ["docker", "buildx", "ls", "--format", "{{.Name}}"], ["docker", "network", "ls", "--filter", "name=m101", "--format", "{{.Name}}"])


STEPS = [
    ("K00", "a", "versions and host facts", step_versions),
    ("K01", "a", "root help of both binaries", step_help),
    ("K16", "a", "docker-agent static commands and a --dry-run without a model", step_docker_agent_static),
    ("K16b", "b", "docker-agent share pull from Docker Hub", step_docker_agent_share_pull),
    ("K02", "b", "daemon status, diagnose, settings", step_daemon_settings_diagnose),
    ("K03", "b", "global policy init (once) and the balanced rules", step_policy_init),
    ("K04", "b", "create the demo sandbox, list it, read the guest, watch the auto-stop", step_lifecycle_create),
    ("K05", "b", "ports publish, curl from the host, unpublish", step_ports),
    ("K06", "b", "cp in and out", step_cp),
    ("K09", "b", "policy allow, deny, check, inspect, log on the demo sandbox", step_policy_deny_log),
    ("K10", "b", "custom secret, the sentinel inside, the proxy swap seen by a host receiver", step_secrets),
    ("K11", "b", "mcp add, ls, inspect, static set, gateway tools/list, load", step_mcp),
    ("K12", "b", "v2 kit validate, inspect, pack, a run with --kit, kit add", step_kits_v2),
    ("K13", "b", "v3 kit descriptor against the v2 tooling", step_kits_v3),
    ("K14", "b", "sbx env plan", step_env_plan),
    ("K15", "b", "sbx skills ls", step_skills),
    ("K07", "b", "template save, ls, inspect, a sandbox from the template, rm", step_templates),
    ("K08", "b", "--clone: the layout inside, a commit, the host-side remote", step_clone),
    ("K04b", "b", "a second sandbox on the same workspace, stop, prune", step_second_sandbox_prune),
    ("K17", "m", "docker-agent new from a description", step_docker_agent_new),
    ("K18", "m", "one agent with filesystem and shell, recorded and replayed", step_single_agent),
    ("K19", "m", "a team: transfer_task, handoff, background agents", step_team),
    ("K20", "m", "permissions, --safety strict and restricted, a pre_tool_use hook", step_permissions),
    ("K21", "m", "session.db and sessions diff", step_sessions),
    ("K22", "m", "docker-agent eval in containers with a DMR judge", step_eval),
    ("K23", "m", "serve api, chat, mcp, acp, a2a", step_serve),
    ("K24", "m", "share push and pull against a local registry", step_share),
    ("K25", "m", "Docker Model Runner and an explicit providers block", step_dmr),
    ("K26", "m", "Compose models: and the docker/mcp-gateway service", step_compose),
    ("K27", "m", "docker-agent run --sandbox end to end", step_sandbox_run),
    ("K28", "m", "v3 kit build with buildx, the manifest annotations, sbx against the pushed kit", step_kit_v3),
    ("K29", "a", "the legacy commands on Desktop 4.94", step_legacy),
    ("K98", "m", "remove the registry, builder, images, and sandboxes of the model tier", step_model_cleanup),
    ("K99", "b", "remove everything the kit created", step_cleanup),
]


def write_readme(kit, tiers):
    rows = [(name, commands) for name, commands in kit.manifest if name not in ONE_TIME_FILES]
    if "b" in tiers:
        rows.append(("03-policy-init.txt", ["sbx policy init balanced (recorded once, by the run that initialized the global policy on the recording host; --check does not compare it)"]))
    if "m" in tiers:
        rows.append(("25-model-pull-latest.txt", ["the Docker Model Runner log of the two docker model pull ai/qwen3 runs that ended in a digest mismatch on the recording host (written once; --check does not compare it)"]))
    lines = [
        "# Capture output: Docker Sandboxes and Docker Agent 101",
        "",
        "Recorded by `capture/run.py` with:",
        "",
        f"- sbx: {kit.versions.get('sbx', '?')}",
        f"- docker-agent: {kit.versions.get('docker-agent', '?')}",
        f"- docker: {kit.versions.get('docker', '?')}",
        f"- model: {kit.versions.get('model', '?')}",
        f"- host: {kit.versions.get('host', '?')}",
        f"- tiers: {''.join(sorted(tiers))}",
        f"- cassettes recorded by this run: {', '.join(kit.recorded) or 'none (all replayed)'}",
        "",
        "Values that change on every run are masked at write time: `$CAPTURE`, `$HOME`, `$USER`, `<docker-user>`, `<uuid>`, `<id>`, `<ts>`, `<port>`, `<session>`, `<rand>`, `<dur>`, `<n>`, `<layers>`, `<date>`, `<age>`, `<digest>`, `<sha256>`, `<base64>`, `<hash>`, `<run>`. The rules are in `run.py`, `MASKS` and `SCRUB_KEYS`.",
        "",
        "Every `docker-agent` command of the model tier carries `--config-dir work/cfg --data-dir work/data --cache-dir work/cache`; the command lines below leave those three flags out.",
        "",
        "| File | Produced by |",
        "|---|---|",
    ]
    for name, commands in sorted(rows, key=lambda row: row[0]):
        shown = "<br>".join("`" + mask_text(command, kit.docker_user).replace("|", "\\|") + "`" for command in commands)
        lines.append(f"| `{name}` | {shown} |")
    lines.append("")
    write_file(os.path.join(kit.out, "README.md"), "\n".join(lines))


def daemon_running():
    return probe_ok(["sbx", "daemon", "status"])


def preflight(tiers):
    missing = [name for name in ("sbx", "docker-agent", "docker") if shutil.which(name) is None]
    if missing:
        return "not installed: " + ", ".join(missing)
    if "b" not in tiers and "m" not in tiers or daemon_running():
        return None
    subprocess.Popen(["sbx", "daemon", "start"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(30):
        time.sleep(1)
        if daemon_running():
            return None
    return "sbx daemon status is not reachable after one sbx daemon start attempt"


def skip_reason(tiers):
    if os.environ.get("AIEFS_CAPTURE_SKIP"):
        return "AIEFS_CAPTURE_SKIP is set"
    return preflight(tiers)


def full_run(tiers, only):
    return {"a", "b", "m"} <= tiers and not only


def selected_steps(tiers, only):
    return [step for step in STEPS if step[1] in tiers and (not only or step[0] in only)]


def capture(out_dir, tiers, only, record=False, checking=False):
    kit = Kit(out_dir)
    kit.docker_user = kit.signed_in_user()
    kit.record_cassettes = record
    kit.checking = checking
    os.makedirs(CASSETTES, exist_ok=True)
    if ("b" in tiers or "m" in tiers) and not only:
        if "b" in tiers:
            sweep(kit)
        remove_tree(WORK)
        os.makedirs(WORK)
        if "m" in tiers:
            remove_model_tier_leftovers(kit)
    else:
        os.makedirs(WORK, exist_ok=True)
    unpack_cassettes()
    for step_id, tier, title, func in selected_steps(tiers, only):
        print(f"{step_id} ({tier}) {title}", flush=True)
        try:
            func(kit)
        except Exception as exc:
            kit.write(f"{step_id}-error.txt", f"{step_id} failed inside run.py: {exc!r}\n", [f"{step_id} raised an exception in run.py"])
            print(f"  {step_id} failed: {exc!r}", flush=True)
    return kit


def comparable(name, text):
    pattern = HOST_FACTS.get(name)
    return pattern.sub("", text) if pattern else text


def file_diff(name, fresh):
    expected = comparable(name, read_file(os.path.join(OUT, name))).splitlines(keepends=True)
    actual = comparable(name, read_file(os.path.join(fresh, name))).splitlines(keepends=True)
    if expected == actual:
        return None
    return "".join(difflib.unified_diff(expected, actual, fromfile=f"out/{name}", tofile=f"fresh/{name}"))


def find_drift(fresh, fresh_names, full):
    out_names = set(os.listdir(OUT)) if os.path.isdir(OUT) else set()
    drift = []
    for name in fresh_names:
        if name not in out_names:
            drift.append((name, f"{name}: present in the fresh run, missing in out/"))
            continue
        diff = file_diff(name, fresh)
        if diff:
            drift.append((name, diff))
    if full:
        for name in sorted(out_names - set(fresh_names)):
            if name not in ONE_TIME_FILES and not name.startswith("."):
                drift.append((name, f"{name}: present in out/, missing in the fresh run"))
    return drift


def check(tiers, only):
    full = full_run(tiers, only)
    with tempfile.TemporaryDirectory() as fresh:
        kit = capture(fresh, tiers, only, checking=True)
        write_readme(kit, tiers)
        fresh_names = sorted(name for name in os.listdir(fresh) if not name.startswith(".") and (full or name != "README.md"))
        drift = find_drift(fresh, fresh_names, full)
    drift += [(f"cassettes/{name}.yaml.gz", f"cassettes/{name}.yaml.gz: missing, and --check never records a cassette") for name in kit.missing]
    if not drift:
        print(f"capture check: {len(fresh_names)} files match")
        return 0
    for _, diff in drift:
        print("\n".join(diff.splitlines()[:60]))
    print("capture drift in: " + ", ".join(name for name, _ in drift))
    return 1


def main():
    parser = argparse.ArgumentParser(description="Capture kit for Docker Sandboxes and Docker Agent 101")
    parser.add_argument("--check", action="store_true", help="capture into a temporary directory and compare with out/")
    parser.add_argument("--tier", default="abm", help="tiers to run: a, ab, abm (default), or abcm")
    parser.add_argument("--only", default="", help="comma-separated step ids to run, for example K09,K10")
    parser.add_argument("--re-record", action="store_true", help="record the model cassettes anew with Docker Model Runner instead of replaying cassettes/")
    args = parser.parse_args()
    os.environ.pop("PWD", None)
    tiers = set(args.tier.lower())
    if "c" in tiers:
        print("Tier C (cloud, tokens, ssh setup) is not part of this kit version; running the other tiers")
        tiers.discard("c")
    only = [item.strip() for item in args.only.split(",") if item.strip()]
    reason = skip_reason(tiers)
    if "m" in tiers and not reason:
        model_reason = model_tier_reason()
        if model_reason:
            print(f"tier m skipped: {model_reason}")
            tiers.discard("m")
    if args.check:
        if reason:
            print("skipped: " + reason)
            return 0
        return check(tiers, only)
    if reason:
        print(reason)
        return 1
    full = full_run(tiers, only)
    kept = {}
    if full:
        for name in ONE_TIME_FILES:
            path = os.path.join(OUT, name)
            if os.path.exists(path):
                kept[name] = read_file(path)
        shutil.rmtree(OUT, ignore_errors=True)
    else:
        for step_id, _, _, _ in selected_steps(tiers, only):
            remove_file(os.path.join(OUT, f"{step_id}-error.txt"))
    kit = capture(OUT, tiers, only, args.re_record)
    pack_cassettes(kit.recorded)
    if full:
        write_readme(kit, tiers)
    for name, text in kept.items():
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            write_file(path, text)
    print(f"wrote {len(kit.manifest)} files to {OUT}")
    if not full:
        print("not a run of all three tiers: the other files in out/ and out/README.md were left as they were")
    return 0


if __name__ == "__main__":
    sys.exit(main())
