import argparse
import difflib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FIXTURES = os.path.join(HERE, "fixtures")
WORK = os.path.join(HERE, "work")
HOME = os.path.expanduser("~")
USER = os.path.basename(HOME)
DEMO = "m101-demo"
RUN_ID = uuid.uuid4().hex[:6]
POLICY = f"m101-policy-{RUN_ID}"
SECRET = f"m101-secret-{RUN_ID}"
RECEIVER_PORT = 18080
REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest"
DEEPWIKI_URL = "https://mcp.deepwiki.com/mcp"
ONE_TIME_FILES = {"03-policy-init.txt"}
AUTO_STOP_WAIT = 45
COMMAND_TIMEOUT = 900
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
]
PULL_BLOCK = re.compile(r"^((?:Pulling|Checking) image\n)((?:  [0-9a-f]{12} (?:downloaded|already present).*\n)+)", re.M)
LS_LINE = re.compile(r"^[-dl][rwxsStT-]{9}")
LS_DATE = re.compile(r"[A-Z][a-z]{2}\s{1,2}\d{1,2}\s(?:\d{2}:\d{2}|\d{4})")
DF_LINE = re.compile(r"^(host|overlay|/dev/\S+)\s+\d")
DF_COLS = re.compile(r"\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+(?:\.\d+)?[KMGTP]?i?\s+\d+%")


def mask_text(text, docker_user):
    for path, token in ((HERE, "$CAPTURE"), (HOME, "$HOME")):
        for variant in sorted({path, os.path.realpath(path)}, key=len, reverse=True):
            text = text.replace(variant, token)
    if docker_user:
        text = text.replace(docker_user, "<docker-user>")
    text = re.sub(r"\b" + re.escape(USER) + r"\b", "$USER", text)
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


class Kit:
    def __init__(self, out_dir):
        self.out = out_dir
        self.manifest = []
        self.docker_user = None
        self.versions = {}
        os.makedirs(out_dir, exist_ok=True)

    def run(self, args, cwd=None, env=None, merged=True):
        stderr = subprocess.STDOUT if merged else subprocess.PIPE
        try:
            proc = subprocess.run(args, cwd=cwd, env={**os.environ, **(env or {})}, stdout=subprocess.PIPE, stderr=stderr, text=True, timeout=COMMAND_TIMEOUT)
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

    def block(self, args, cwd=None, env=None, output_filter=None):
        code, out, _ = self.run(args, cwd, env)
        if output_filter:
            out = output_filter(out)
        head = "$ " + shlex.join(args)
        body = out.rstrip("\n")
        if body:
            return f"{head}\n{body}\n[exit {code}]\n"
        return f"{head}\n[exit {code}]\n"

    def entry(self, args, label=None, cwd=None, env=None, output_filter=None):
        return self.block(args, cwd, env, output_filter), label or shlex.join(args)

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

    def json_file(self, name, args, cwd=None, transform=None):
        code, out, err = self.run(args, cwd, merged=False)
        try:
            data = json.loads(out)
            if transform:
                data = transform(data)
            text = pretty_json(data)
        except ValueError:
            text = out + err
        label = shlex.join(args)
        if code:
            label += f"  [exit {code}]"
        self.write(name, text, [label])

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
    for sandbox in kit.json_list(["sbx", "ls", "--json"], "sandboxes"):
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
    remove_tree(WORK)
    os.makedirs(WORK)


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


def step_help(kit):
    kit.capture("01-help-sbx.txt", ["sbx", "--help"])
    kit.capture("01-help-docker-agent.txt", ["docker-agent", "--help"])


def step_docker_agent_static(kit):
    agent = os.path.join(FIXTURES, "agents", "greeter.yaml")
    kit.capture("16-docker-agent-version.txt", ["docker-agent", "version"])
    kit.capture("16-doctor.txt", ["docker-agent", "doctor"])
    kit.json_file("16-doctor.json", ["docker-agent", "doctor", "--json"])
    kit.capture("16-toolsets.txt", ["docker-agent", "toolsets"])
    kit.json_file("16-toolsets.json", ["docker-agent", "toolsets", "--format", "json"])
    kit.capture("16-models.txt", ["docker-agent", "models", "list"])
    kit.json_file("16-models.json", ["docker-agent", "models", "list", "--format", "json"])
    kit.capture("16-sandbox-list.txt", ["docker-agent", "sandbox", "list"])
    kit.capture("16-dry-run.txt", ["docker-agent", "run", "--dry-run", "--exec", agent, "hi"], cwd=HERE)


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
    inside = "pwd; echo; git remote -v; echo; git log --oneline; echo; ls -la /run/sandbox/source; git -C /run/sandbox/source log --oneline -1; touch /run/sandbox/source/x; echo; mount | grep -E 'virtiofs|/run/sandbox|repo-clone'; echo; git config --list --show-origin | grep -E 'remote|branch'"
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
    ("K99", "b", "remove everything the kit created", step_cleanup),
]


def write_readme(kit, tiers):
    rows = [(name, commands) for name, commands in kit.manifest if name not in ONE_TIME_FILES]
    if "b" in tiers:
        rows.append(("03-policy-init.txt", ["sbx policy init balanced (recorded once, by the run that initialized the global policy on the recording host; --check does not compare it)"]))
    lines = [
        "# Capture output: Docker Sandboxes and Docker Agent 101",
        "",
        "Recorded by `capture/run.py` with:",
        "",
        f"- sbx: {kit.versions.get('sbx', '?')}",
        f"- docker-agent: {kit.versions.get('docker-agent', '?')}",
        f"- host: {kit.versions.get('host', '?')}",
        f"- tiers: {''.join(sorted(tiers))}",
        "",
        "Values that change on every run are masked at write time: `$CAPTURE`, `$HOME`, `$USER`, `<docker-user>`, `<uuid>`, `<id>`, `<ts>`, `<port>`, `<session>`, `<rand>`, `<dur>`, `<n>`, `<layers>`, `<date>`, `<age>`, `<digest>`, `<sha256>`, `<base64>`. The rules are in `run.py`, `MASKS`.",
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
    return subprocess.run(["sbx", "daemon", "status"], capture_output=True, text=True).returncode == 0


def preflight(tiers):
    missing = [name for name in ("sbx", "docker-agent") if shutil.which(name) is None]
    if missing:
        return "not installed: " + ", ".join(missing)
    if "b" not in tiers or daemon_running():
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


def capture(out_dir, tiers, only):
    kit = Kit(out_dir)
    kit.docker_user = kit.signed_in_user()
    if "b" in tiers and not only:
        sweep(kit)
    else:
        os.makedirs(WORK, exist_ok=True)
    for step_id, tier, title, func in STEPS:
        if tier not in tiers or (only and step_id not in only):
            continue
        print(f"{step_id} ({tier}) {title}", flush=True)
        try:
            func(kit)
        except Exception as exc:
            kit.write(f"{step_id}-error.txt", f"{step_id} failed inside run.py: {exc!r}\n", [f"{step_id} raised an exception in run.py"])
            print(f"  {step_id} failed: {exc!r}", flush=True)
    write_readme(kit, tiers)
    return kit


def file_diff(name, fresh):
    expected = read_file(os.path.join(OUT, name)).splitlines(keepends=True)
    actual = read_file(os.path.join(fresh, name)).splitlines(keepends=True)
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
    full = {"a", "b"} <= tiers and not only
    with tempfile.TemporaryDirectory() as fresh:
        capture(fresh, tiers, only)
        fresh_names = sorted(name for name in os.listdir(fresh) if not name.startswith(".") and (full or name != "README.md"))
        drift = find_drift(fresh, fresh_names, full)
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
    parser.add_argument("--tier", default="ab", help="tiers to run: a, ab (default), or abc")
    parser.add_argument("--only", default="", help="comma-separated step ids to run, for example K09,K10")
    args = parser.parse_args()
    tiers = set(args.tier.lower())
    if "c" in tiers:
        print("Tier C (cloud, tokens, ssh setup) is not part of this kit version; running the other tiers")
        tiers.discard("c")
    only = [item.strip() for item in args.only.split(",") if item.strip()]
    reason = skip_reason(tiers)
    if args.check:
        if reason:
            print("skipped: " + reason)
            return 0
        return check(tiers, only)
    if reason:
        print(reason)
        return 1
    if not only:
        shutil.rmtree(OUT, ignore_errors=True)
    kit = capture(OUT, tiers, only)
    print(f"wrote {len(kit.manifest)} files to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
