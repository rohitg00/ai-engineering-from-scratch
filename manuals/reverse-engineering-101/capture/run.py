import argparse
import difflib
import glob
import hashlib
import importlib.util
import json
import os
import pathlib
import platform
import queue
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.realpath(__file__))
OUT = os.path.join(HERE, "out")
FIXTURES = os.path.join(HERE, "fixtures")
HOME = os.path.realpath(os.path.expanduser("~"))
USER = os.path.basename(HOME)
REA_VERSION = "6.7.0"
GHIDRA_VERSION = "12.1.4"
WABT_VERSION = "1.0.42"
GHIDRA_CANDIDATES = ["/opt/homebrew/Cellar/ghidra/12.1.4/libexec", "/opt/homebrew/opt/ghidra/libexec", "/usr/local/opt/ghidra/libexec"]
JAVA_CANDIDATES = ["/opt/homebrew/opt/openjdk@21", "/usr/local/opt/openjdk@21"]
WABT_CANDIDATES = ["/opt/homebrew/bin", "/usr/local/bin"]
WABT_TOOLS = ("wasm-validate", "wasm-objdump", "wasm2wat")
LLVM_OBJDUMP = "/Library/Developer/CommandLineTools/usr/bin/llvm-objdump"
ARM64_O1 = "ledger-arm64-O1"
ARM64_O2 = "ledger-arm64-O2"
ELF_O1 = "ledger-x86_64-O1.o"
JS_APP = "js-app"
WASM = os.path.join("wasm", "ledger.wasm")
FUNCTIONS = ["percent_change", "grade", "total", "grade_label"]
COMPARED = ["percent_change", "total"]
REPO = os.path.realpath(os.path.join(HERE, "..", "..", ".."))
LESSON36 = os.path.join(REPO, "phases", "13-tools-and-protocols", "36-rebuild-and-prove-equal", "code")
HARNESS_FLAGS = "clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c"
COMMAND_TIMEOUT = 600
MCP_CALL_TIMEOUT = 360
SCHEMA_TOOLS = {"open_binary", "binary_session", "list_procedures", "procedure_assembly", "xrefs", "list_strings", "analyze_function", "export_evidence_bundle", "import_evidence_bundle", "compare_functions", "verify_reconstruction", "close_binary"}
JS_RECORD_KEYS = ",".join([
    "evidence_id", "subject", "provider", "analysis_profile", "predicate_type", "operation", "parameters", "raw_result",
    "normalized_result.input_path", "normalized_result.format", "normalized_result.root_artifact_sha256",
    "normalized_result.inventory_manifest_id", "normalized_result.inventory_graph_sha256",
    "normalized_result.integrity_contradictions", "normalized_result.summary", "normalized_result.statistics",
    "normalized_result.limitations", "confidence", "authority", "environment", "limitations", "locations", "evidence_links",
])
FIXTURE_BUILDS = [
    ["clang", "-target", "x86_64-unknown-linux-gnu", "-O0", "-fno-asynchronous-unwind-tables", "-c", "ledger.c", "-o", "ledger-x86_64-O0.o"],
    ["clang", "-target", "x86_64-unknown-linux-gnu", "-O1", "-fno-asynchronous-unwind-tables", "-c", "ledger.c", "-o", "ledger-x86_64-O1.o"],
    ["clang", "-target", "x86_64-unknown-linux-gnu", "-O2", "-fno-asynchronous-unwind-tables", "-c", "ledger.c", "-o", "ledger-x86_64-O2.o"],
    ["clang", "-O1", "-fno-asynchronous-unwind-tables", "-c", "ledger.c", "-o", "ledger-arm64-O1.o"],
    ["clang", "-O2", "-fno-asynchronous-unwind-tables", "-c", "ledger.c", "-o", "ledger-arm64-O2.o"],
    ["clang", "-O1", "-o", ARM64_O1, "ledger.c", "ledger-main.c"],
    ["clang", "-O2", "-o", ARM64_O2, "ledger.c", "ledger-main.c"],
    ["wat2wasm", "wasm/ledger.wat", "-o", "wasm/ledger.wasm"],
]

CHECK_MASKS = [
    (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", "<ts>"),
    (r"\"time\":\d{13}", "\"time\":<ts>"),
    (r"\"durationMs\":\d+(?:\.\d+)?", "\"durationMs\":<dur>"),
    (r"\"(duration_ms|elapsed_ms|startup_ms|timeout_remaining_ms)\":\s*\d+", r"\"\1\": <dur>"),
    (r"\b\d+(?:\.\d+)? s\b", "<dur>"),
    (r"\b\d+ ms\b", "<dur>"),
    (r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<uuid>"),
    (r"/private/var/folders/[^\"\s]+", "<tmp>"),
    (r"/var/folders/[^\"\s]+", "<tmp>"),
    (r"/tmp/rea-ghidra-socket-[^\"\s/]+", "<tmp>"),
    (r"rea-ghidra-[A-Za-z0-9_-]+", "rea-ghidra-<id>"),
    (r"\"pid\":\s*\d+", "\"pid\": <pid>"),
    (r"\"process_id\":\s*\d+", "\"process_id\": <pid>"),
    (r"\\\"process_id\\\":\s*\d+", r"\\\"process_id\\\": <pid>"),
    (r"\bpid \d+", "pid <pid>"),
]


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_text(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def write_text(path, text):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def load_json(path):
    try:
        return json.loads(read_text(path))
    except (OSError, ValueError):
        return None


def pretty(data):
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def run_quiet(argv, env=None, timeout=60):
    try:
        proc = subprocess.run(argv, capture_output=True, text=True, env=env, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def rea_version(argv):
    code, text = run_quiet(argv + ["--version"])
    if code != 0:
        return None
    return text.splitlines()[-1].strip() if text else None


def find_rea():
    override = os.environ.get("REA_COMMAND")
    if override:
        argv = shlex.split(override)
        return (argv, None) if rea_version(argv) == REA_VERSION else (None, f"REA_COMMAND does not run rea {REA_VERSION}")
    on_path = shutil.which("rea")
    if on_path and rea_version([on_path]) == REA_VERSION:
        return [on_path], None
    node = shutil.which("node")
    for manifest in sorted(glob.glob(os.path.join(HOME, ".npm", "_npx", "*", "node_modules", "rea-agents", "package.json"))):
        package = load_json(manifest) or {}
        if package.get("version") != REA_VERSION or node is None:
            continue
        argv = [node, os.path.join(os.path.dirname(manifest), "scripts", "rea.mjs")]
        if rea_version(argv) == REA_VERSION:
            return argv, None
    if on_path:
        return None, f"rea on PATH is version {rea_version([on_path])}, not {REA_VERSION}"
    return None, f"rea-agents {REA_VERSION} is not installed (no rea on PATH and no npx cache entry)"


def find_ghidra():
    for root in [os.environ.get("GHIDRA_INSTALL_DIR")] + GHIDRA_CANDIDATES:
        if not root or not os.path.isabs(root):
            continue
        properties = os.path.join(root, "Ghidra", "application.properties")
        if not os.path.exists(properties):
            continue
        if f"application.version={GHIDRA_VERSION}" in read_text(properties).splitlines():
            return root, None
        return None, f"{root} is not Ghidra {GHIDRA_VERSION}"
    return None, f"Ghidra {GHIDRA_VERSION} is not installed (GHIDRA_INSTALL_DIR unset and no Homebrew install)"


def find_java():
    for root in [os.environ.get("JAVA_HOME")] + JAVA_CANDIDATES:
        if root and os.path.exists(os.path.join(root, "bin", "java")):
            return root, None
    return None, "JDK 21 is not installed (JAVA_HOME unset and no Homebrew openjdk@21)"


def find_wabt():
    for directory in [os.environ.get("REA_WABT_BIN_DIRECTORY")] + WABT_CANDIDATES:
        if directory and all(os.path.exists(os.path.join(directory, tool)) for tool in WABT_TOOLS):
            code, text = run_quiet([os.path.join(directory, "wasm2wat"), "--version"])
            if code == 0 and text.strip() == WABT_VERSION:
                return directory, None
            return None, f"{directory} holds WABT {text.strip()}, not {WABT_VERSION}"
    return None, f"WABT {WABT_VERSION} is not installed (REA_WABT_BIN_DIRECTORY unset and no wasm2wat in Homebrew bin)"


def check_masks(text):
    for pattern, replacement in CHECK_MASKS:
        text = re.sub(pattern, replacement, text)
    return text


def cut(reason):
    return f"<cut by run.py: {reason}>"


class Mcp:
    def __init__(self, argv, env):
        self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=HERE, text=True, bufsize=1)
        self.lines = queue.Queue()
        self.stderr = []
        self.next_id = 0
        threading.Thread(target=self._pump, args=(self.proc.stdout, self.lines.put), daemon=True).start()
        threading.Thread(target=self._pump, args=(self.proc.stderr, self.stderr.append), daemon=True).start()

    @staticmethod
    def _pump(stream, sink):
        for line in stream:
            sink(line)
        sink(None)

    def message(self, method, params):
        self.next_id += 1
        return {"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params}

    def send(self, message):
        self.proc.stdin.write(json.dumps(message) + "\n")
        self.proc.stdin.flush()

    def wait(self, message_id, timeout=MCP_CALL_TIMEOUT):
        notifications = []
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"no response to request {message_id} within {timeout} s")
            try:
                line = self.lines.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError(f"no response to request {message_id} within {timeout} s")
            if line is None:
                raise RuntimeError("the MCP server closed its stdout")
            try:
                parsed = json.loads(line)
            except ValueError:
                notifications.append({"raw": line.rstrip("\n")})
                continue
            if parsed.get("id") == message_id:
                return parsed, notifications
            notifications.append(parsed)

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            self.proc.kill()
            self.proc.wait(timeout=10)

    def log_lines(self):
        return [line for line in self.stderr if line is not None]


class Kit:
    def __init__(self, out, rea, ghidra, java, wabt, work):
        self.out = out
        self.rea_argv = rea
        self.ghidra = ghidra
        self.java = java
        self.wabt = wabt
        self.work = work
        self.commands = []
        self.mcp_index = []
        self.mcp_count = 0
        self.evidence_files = {}
        self.timings = []
        env = dict(os.environ)
        env.pop("PWD", None)
        env.pop("JAVA_TOOL_OPTIONS", None)
        env["GHIDRA_INSTALL_DIR"] = ghidra
        env["JAVA_HOME"] = java
        if wabt:
            env["REA_WABT_BIN_DIRECTORY"] = wabt
        self.env = env

    def fixture(self, name):
        return os.path.join(FIXTURES, name)

    def out_path(self, name):
        return os.path.join(self.out, name)

    def mask(self, text):
        for path, token in ((self.out, "$OUT"), (self.work, "$WORK"), (HERE, "$CAPTURE"), (HOME, "$HOME")):
            for variant in sorted({path, os.path.realpath(path)}, key=len, reverse=True):
                text = re.sub(re.escape(variant) + r"(?![\w.-])", token, text)
        text = re.sub(r"(?<=/)" + re.escape(USER) + r"(?![\w.-])", "$USER", text)
        return re.sub(r"_npx/[0-9a-f]+", "_npx/<hash>", text)

    def write(self, name, text):
        write_text(self.out_path(name), self.mask(text))

    def write_json(self, name, data):
        self.write(name, pretty(data))

    def shown(self, text):
        for path, token in ((self.out, "out"), (self.work, "$WORK")):
            for variant in sorted({path, os.path.realpath(path)}, key=len, reverse=True):
                text = text.replace(variant + "/", token + "/")
        return text.replace(HERE + "/", "")

    def rea(self, name, args, stdout_path=None):
        argv = self.rea_argv + list(args)
        started = time.monotonic()
        try:
            proc = subprocess.run(argv, cwd=HERE, env=self.env, capture_output=True, text=True, timeout=COMMAND_TIMEOUT)
            code, stdout, stderr = proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired as exc:
            stdout, stderr = (
                part.decode("utf-8", errors="replace") if isinstance(part, bytes) else part or ""
                for part in (exc.stdout, exc.stderr)
            )
            code, stderr = "timeout", stderr + f"\n[run.py] timed out after {COMMAND_TIMEOUT} s"
        elapsed = time.monotonic() - started
        self.timings.append((name or stdout_path, elapsed))
        if stdout_path is not None:
            write_text(stdout_path, stdout)
        try:
            data = json.loads(stdout)
        except ValueError:
            data = None
        if name is None:
            target = self.shown(stdout_path)
        elif data is not None:
            self.write_json(name, data)
            target = name
        else:
            name = os.path.splitext(name)[0] + ".txt"
            self.write(name, stdout if stdout.endswith("\n") or not stdout else stdout + "\n")
            target = name
        entry = [f"$ {self.shown(shlex.join(['rea'] + list(args)))}", f"[exit {code}] ({elapsed:.1f} s) -> {target}"]
        if stderr.strip():
            entry.extend("[stderr] " + line for line in stderr.strip().splitlines())
        self.commands.append("\n".join(entry))
        return code, data

    def tool(self, argv, timeout=60):
        code, text = run_quiet(argv, env=self.env, timeout=timeout)
        return f"$ {shlex.join(argv)}\n{text}\n[exit {code}]\n"

    def step_versions(self):
        java = os.path.join(self.java, "bin", "java")
        properties = read_text(os.path.join(self.ghidra, "Ghidra", "application.properties")).splitlines()
        blocks = [
            self.tool(self.rea_argv + ["--version"]).replace(shlex.join(self.rea_argv), "rea"),
            self.tool([shutil.which("node") or "node", "--version"]),
            self.tool(["clang", "--version"]),
            self.tool([LLVM_OBJDUMP, "--version"]) if os.path.exists(LLVM_OBJDUMP) else "llvm-objdump: not found\n",
            self.tool(["sw_vers"]),
            self.tool(["uname", "-m"]),
            f"GHIDRA_INSTALL_DIR={self.ghidra}\n" + "".join(line + "\n" for line in properties if line.startswith(("application.version=", "application.release.name=", "application.build.date="))),
            f"JAVA_HOME={self.java}\n" + self.tool([java, "-version"]),
        ]
        if self.wabt:
            blocks.append(f"REA_WABT_BIN_DIRECTORY={self.wabt}\n" + "".join(self.tool([os.path.join(self.wabt, tool), "--version"]) for tool in WABT_TOOLS + ("wat2wasm",)))
        else:
            blocks.append("REA_WABT_BIN_DIRECTORY: unset, WABT is not installed\n")
        self.write("00-versions.txt", "\n".join(blocks))
        rows = []
        for root, _, files in sorted(os.walk(FIXTURES)):
            if "/." in root:
                continue
            for file in sorted(files):
                path = os.path.join(root, file)
                rows.append(f"{sha256_of(path)}  {os.path.getsize(path):>6}  {os.path.relpath(path, HERE)}")
        self.write("00-fixtures.txt", "\n".join(rows) + "\n")

    def step_cli(self):
        arm64 = self.fixture(ARM64_O1)
        elf = self.fixture(ELF_O1)
        self.rea("01-doctor-ghidra.json", ["doctor", "--provider", "ghidra", "--format", "json", "--filter-output", "healthy,environment_healthy,scope,scope_checks"])
        self.rea("02-capabilities.json", ["capabilities", "--format", "json"])
        self.rea("03-inspect-artifact.json", ["inspect-artifact", arm64, "--format", "json"])
        self.rea("04-inspect-binary-layout.json", ["inspect-binary-layout", elf, "--format", "json"])
        self.rea("04-inspect-macho.json", ["inspect-macho", arm64, "--format", "json"])
        self.rea("05-analyze-arm64-O1.json", ["analyze", arm64, "--provider", "ghidra", "--format", "json"])
        self.rea("05-analyze-x86_64-O1.json", ["analyze", elf, "--provider", "ghidra", "--format", "json"])
        grade_address = None
        for function in FUNCTIONS:
            _, data = self.rea(f"06-function-{function.replace('_', '-')}.json", ["function", arm64, f"_{function}", "--provider", "ghidra", "--format", "json"])
            if function == "grade" and isinstance(data, dict):
                grade_address = data.get("normalized_result", {}).get("procedure", {}).get("address")
        self.rea("06-function-grade-x86_64-O1.json", ["function", elf, "grade", "--provider", "ghidra", "--format", "json"])
        self.rea("07-decompile-total.json", ["decompile", arm64, "_total", "--provider", "ghidra", "--format", "json"])
        self.rea("07-decompile-grade-x86_64-O1.json", ["decompile", elf, "grade", "--provider", "ghidra", "--format", "json"])
        self.rea("08-address-to-file-offset.json", ["address-to-file-offset", arm64, grade_address or "_grade", "--provider", "ghidra", "--format", "json"])

    @staticmethod
    def structured(record):
        return ((record.get("response") or {}).get("result") or {}).get("structuredContent")

    def trim(self, record, method, params):
        result = (record.get("response") or {}).get("result")
        if not isinstance(result, dict):
            return
        if method == "tools/list":
            for tool in result.get("tools", []):
                if tool.get("name") not in SCHEMA_TOOLS:
                    for key in ("inputSchema", "outputSchema"):
                        if key in tool:
                            tool[key] = cut("schemas are kept only for the tools this session calls")
            return
        tool = params.get("name")
        structured = result.get("structuredContent")
        content = result.get("content") or []
        if structured is not None and content and content[0].get("type") == "text":
            try:
                same = json.loads(content[0]["text"]) == structured
            except ValueError:
                same = False
            if same:
                content[0]["text"] = cut(f"the text copy of structuredContent, {len(content[0]['text'])} bytes")
        if tool == "binary_session" and structured:
            session = structured.get("result") or {}
            for holder, key in ((session, "tool_availability"), (session.get("server_identity", {}).get("catalog", {}), "tools")):
                items = holder.get(key)
                if isinstance(items, list) and len(items) > 3:
                    holder[key] = items[:3] + [cut(f"{len(items) - 3} more entries, one per MCP tool")]
        if tool == "compare_functions":
            arguments = record["request"]["params"]["arguments"]
            for side in ("left", "right"):
                evidence = arguments.get(side) or {}
                evidence_id = evidence.get("evidence_id")
                arguments[side] = {"evidence_id": evidence_id, "record": cut(f"the complete analyze_function record, see {self.evidence_files.get(evidence_id, 'the session files')}")}

    def mcp_call(self, client, slug, method, params):
        self.mcp_count += 1
        name = f"10-mcp-{self.mcp_count:02d}-{slug}.json"
        message = client.message(method, params)
        record = {"request": message}
        started = time.monotonic()
        try:
            client.send(message)
            response, notifications = client.wait(message["id"])
            record["response"] = response
            if notifications:
                record["notifications"] = notifications
        except (OSError, RuntimeError, TimeoutError) as exc:
            record["error"] = str(exc)
        elapsed_ms = int((time.monotonic() - started) * 1000)
        result = (record.get("response") or {}).get("result") or {}
        if result.get("isError") and result.get("content"):
            try:
                record["decoded_text"] = json.loads(result["content"][0].get("text", ""))
            except ValueError:
                pass
        structured = self.structured(record)
        if params.get("name") == "analyze_function" and isinstance(structured, dict) and structured.get("evidence_id"):
            self.evidence_files[structured["evidence_id"]] = name
        self.trim(record, method, params)
        self.write_json(name, record)
        tool = params.get("name", "") if method == "tools/call" else ""
        failed = "error" in record or "error" in (record.get("response") or {}) or result.get("isError")
        self.mcp_index.append(f"{self.mcp_count:02d}  {method:<10} {tool:<24} {'error' if failed else 'ok':<6} -> {name}  ({elapsed_ms} ms)")
        self.timings.append((name, elapsed_ms / 1000))
        return record, structured

    def step_mcp(self):
        client = Mcp(self.rea_argv + ["mcp"], self.env)
        bundles = {"O1": os.path.join(self.work, "bundle-O1.json"), "O2": os.path.join(self.work, "bundle-O2.json")}
        dossiers = {"O1": {}, "O2": {}}
        try:
            self.mcp_call(client, "initialize", "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "re101-capture", "version": "1.0.0"}})
            client.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
            self.mcp_call(client, "tools-list", "tools/list", {})
            self.mcp_call(client, "open-binary-O1", "tools/call", {"name": "open_binary", "arguments": {"path": self.fixture(ARM64_O1), "provider_id": "ghidra"}})
            self.mcp_call(client, "binary-session", "tools/call", {"name": "binary_session", "arguments": {}})
            _, procedures = self.mcp_call(client, "list-procedures", "tools/call", {"name": "list_procedures", "arguments": {}})
            grade_address = "_grade"
            for item in ((procedures or {}).get("normalized_result") or []):
                if item.get("value") == "_grade":
                    grade_address = item.get("address", grade_address)
            self.mcp_call(client, "procedure-assembly-grade", "tools/call", {"name": "procedure_assembly", "arguments": {"procedure": "_grade"}})
            self.mcp_call(client, "xrefs-grade", "tools/call", {"name": "xrefs", "arguments": {"address": grade_address}})
            self.mcp_call(client, "list-strings", "tools/call", {"name": "list_strings", "arguments": {}})
            for function in FUNCTIONS:
                _, dossiers["O1"][function] = self.mcp_call(client, f"analyze-function-{function.replace('_', '-')}-O1", "tools/call", {"name": "analyze_function", "arguments": {"procedure": f"_{function}"}})
            self.mcp_call(client, "analyze-function-missing", "tools/call", {"name": "analyze_function", "arguments": {"procedure": "_nothing"}})
            self.mcp_call(client, "export-evidence-bundle-O1", "tools/call", {"name": "export_evidence_bundle", "arguments": {"path": bundles["O1"], "overwrite": True}})
            self.mcp_call(client, "close-binary-O1", "tools/call", {"name": "close_binary", "arguments": {}})
            self.mcp_call(client, "open-binary-O2", "tools/call", {"name": "open_binary", "arguments": {"path": self.fixture(ARM64_O2), "provider_id": "ghidra"}})
            for function in COMPARED:
                _, dossiers["O2"][function] = self.mcp_call(client, f"analyze-function-{function.replace('_', '-')}-O2", "tools/call", {"name": "analyze_function", "arguments": {"procedure": f"_{function}"}})
            self.mcp_call(client, "export-evidence-bundle-O2", "tools/call", {"name": "export_evidence_bundle", "arguments": {"path": bundles["O2"], "overwrite": True}})
            claims = []
            for function in COMPARED:
                left, right = dossiers["O1"].get(function), dossiers["O2"].get(function)
                if not (left and right):
                    continue
                _, comparison = self.mcp_call(client, f"compare-functions-{function.replace('_', '-')}", "tools/call", {"name": "compare_functions", "arguments": {"left": left, "right": right}})
                evidence_id = (comparison or {}).get("evidence_id")
                for dimension in ("pseudocode", "assembly"):
                    if evidence_id:
                        claims.append({"claim_id": f"{function.replace('_', '-')}-{dimension}", "title": f"{function}: the Ghidra {dimension} is the same text in the -O1 and -O2 builds", "kind": "structural-function", "dimension": dimension, "comparison_evidence_id": evidence_id})
            if claims:
                self.mcp_call(client, "verify-reconstruction", "tools/call", {"name": "verify_reconstruction", "arguments": {"specification": {"name": "ledger functions rebuilt at -O2 against the -O1 build", "claims": claims}}})
            self.mcp_call(client, "import-evidence-bundle-O1", "tools/call", {"name": "import_evidence_bundle", "arguments": {"path": bundles["O1"]}})
            self.mcp_call(client, "inspect-wasm-artifact", "tools/call", {"name": "inspect_wasm_artifact", "arguments": {"path": self.fixture(WASM)}})
            self.mcp_call(client, "close-binary-O2", "tools/call", {"name": "close_binary", "arguments": {}})
        finally:
            client.close()
        self.write("10-mcp-session.txt", "\n".join(self.mcp_index) + "\n")
        self.write("10-mcp-server.log", "".join(client.log_lines()))
        rows = []
        for key, path in bundles.items():
            name = f"11-bundle-{key}.json"
            if os.path.exists(path):
                self.write(name, read_text(path) + "\n")
                rows.append(f"{sha256_of(self.out_path(name))}  {os.path.getsize(self.out_path(name)):>6}  {name} (the bytes export_evidence_bundle wrote, with the capture path masked and a newline added)")
                self.rea(f"11-inspect-evidence-bundle-{key}.json", ["inspect-evidence-bundle", json.dumps({"path": self.out_path(name), "detail": "summary"}), "--format", "json"])
            else:
                rows.append(f"{name}: export_evidence_bundle wrote no file")
        self.write("11-bundles.txt", "\n".join(rows) + "\n")
        return bundles

    def step_evidence_cli(self, bundles):
        left = self.out_path("11-bundle-O1.json")
        right = self.out_path("11-bundle-O2.json")
        canonical = os.path.join(self.work, "canonical-O1.json")
        self.rea("12-evidence-export.json", ["evidence-export", left, canonical, "--format", "json"])
        rows = []
        for label, path in (("export_evidence_bundle over MCP, out/11-bundle-O1.json", left), ("evidence-export over the CLI, $WORK/canonical-O1.json", canonical)):
            rows.append(f"{sha256_of(path)}  {os.path.getsize(path):>6}  {label}" if os.path.exists(path) else f"missing  {label}")
        same_bytes = os.path.exists(canonical) and sha256_of(canonical) == sha256_of(bundles["O1"])
        same_content = load_json(canonical) is not None and load_json(canonical) == load_json(left)
        rows.append(f"same bytes as the MCP export: {'yes' if same_bytes else 'no'}")
        rows.append(f"same JSON content as the MCP export: {'yes' if same_content else 'no'}")
        self.write("12-evidence-export.txt", "\n".join(rows) + "\n")
        self.rea("13-evidence-import.json", ["evidence-import", left, "--format", "json"])
        self.rea("13-evidence-import-rea-6.5.0.json", ["evidence-import", self.fixture("bundle-rea-6.5.0-O1.json"), "--format", "json"])
        self.rea("14-compare-bundles.json", ["compare", left, right, "--format", "json"])

    def step_javascript(self):
        app = self.fixture(JS_APP)
        full = os.path.join(self.work, "js-app-full.json")
        self.rea("15-js-app.json", ["analyze-javascript-application", app, "--format", "json", "--filter-output", JS_RECORD_KEYS])
        self.rea("15-js-app-graph.json", ["analyze-javascript-application", app, "--format", "json", "--filter-output", "normalized_result.graph"])
        code, _ = self.rea(None, ["analyze-javascript-application", app, "--format", "json"], stdout_path=full)
        evidence = load_json(full)
        if code != 0 or not isinstance(evidence, dict) or "evidence_id" not in evidence:
            self.commands.append("# 15-js-app-view-*.json skipped: the complete analyze-javascript-application record was not produced")
            return
        views = {"summary": {"kind": "summary"}, "modules": {"kind": "page", "collection": "modules", "offset": 0, "limit": 32}}
        for label, view in views.items():
            request = os.path.join(self.work, f"js-app-view-{label}.json")
            write_text(request, json.dumps({"source": {"kind": "inline", "evidence": evidence}, "view": view}))
            self.rea(f"15-js-app-view-{label}.json", ["inspect-analysis-view", request, "--format", "json"])
            self.commands.append(f"# $WORK/js-app-view-{label}.json holds {{\"source\": {{\"kind\": \"inline\", \"evidence\": <the complete record from $WORK/js-app-full.json>}}, \"view\": {json.dumps(view)}}}")

    def step_wasm(self):
        wasm = self.fixture(WASM)
        self.rea("16-inspect-wasm-artifact.json", ["inspect-wasm-artifact", wasm, "--format", "json"])
        if not self.wabt:
            self.write("16-wabt.txt", f"WABT {WABT_VERSION} is not installed on this host, so the three WABT commands REA would run were not recorded.\n")
            return
        blocks = [
            self.tool([os.path.join(self.wabt, "wasm-validate"), "--enable-all", wasm]),
            self.tool([os.path.join(self.wabt, "wasm-objdump"), "-h", "-x", wasm]),
            self.tool([os.path.join(self.wabt, "wasm2wat"), "--enable-all", wasm]),
        ]
        self.write("16-wabt.txt", "\n".join(blocks).replace(FIXTURES + "/", "fixtures/"))

    def step_setup(self):
        rows = []
        cases = (
            ("18-setup-claude-jsonc.json", "claude-jsonc.json", ["--dry-run"], "status,plannedActions,remediation,doctor.identity.registrations"),
            ("18-setup-claude-duplicate.json", "claude-duplicate.json", ["--yes"], "status,appliedActions,remediation"),
        )
        saved = self.env
        try:
            for name, source, mode, keys in cases:
                home = os.path.join(self.work, "home-" + os.path.splitext(source)[0])
                config_dir = os.path.join(home, ".claude")
                os.makedirs(config_dir, exist_ok=True)
                config = os.path.join(config_dir, ".claude.json")
                shutil.copyfile(self.fixture(os.path.join("setup", source)), config)
                self.env = dict(saved, HOME=home, CLAUDE_CONFIG_DIR=config_dir)
                self.rea(name, ["setup", "--client", "claude_code", "--skill=false", *mode, "--format", "json", "--filter-output", keys])
                with open(config, encoding="utf-8") as handle:
                    rows.append(f"# {source} after rea setup {' '.join(mode)}\n{handle.read()}")
        finally:
            self.env = saved
        self.write("18-setup-configs.txt", "\n".join(rows))

    def step_harness(self):
        main_py = os.path.join(LESSON36, "main.py")
        clang = shutil.which("clang")
        if not os.path.exists(main_py) or clang is None:
            reason = "lesson 36 code is missing" if not os.path.exists(main_py) else "clang is not installed"
            self.write("17-harness.txt", f"The lesson 36 harness was not run: {reason}.\n")
            self.commands.append(f"# 17-harness-*.json skipped: {reason}")
            return
        spec = importlib.util.spec_from_file_location("lesson36", main_py)
        lesson = importlib.util.module_from_spec(spec)
        sys.modules["lesson36"] = lesson
        spec.loader.exec_module(lesson)
        original = self.fixture(ELF_O1)
        grid = lesson.input_grid()
        classes = {}
        for cell in grid:
            classes[cell.kind] = classes.get(cell.kind, 0) + 1
        self.write_json("17-harness-grid.json", {
            "cells": len(grid),
            "classes": dict(sorted(classes.items(), key=lambda item: (-item[1], item[0]))),
            "percent_change": {"before": list(lesson.PERCENT_BEFORE), "after": list(lesson.PERCENT_AFTER)},
            "grade": {"scores": list(lesson.GRADE_SCORES)},
            "naive": {name: [list(args) for args in cases] for name, cases in lesson.NAIVE_CASES.items()},
        })
        started = time.monotonic()
        for label, candidates in (("plausible", lesson.PLAUSIBLE), ("equal", lesson.EQUAL)):
            report = lesson.prove_behaviour(candidates, grid)
            self.write_json(f"17-harness-execute-{label}.json", {
                "candidates": {name: os.path.relpath(str(path), REPO) for name, path in candidates.items()},
                "original": "fixtures/ledger.c compiled with the host clang at -O1" if report.original_kind == "fixture-source" else "fixtures/ledger-x86_64-O1.o",
                "original_kind": report.original_kind,
                "host": report.host,
                "arch": report.arch,
                "naive_passed": report.naive_passed,
                "cells": report.cells,
                "mismatches": report.mismatches,
                "oracle_disagreements": report.oracle_disagreements,
                "rows": report.rows,
            })
        self.timings.append(("17-harness-execute", time.monotonic() - started))
        started = time.monotonic()
        elf = lesson.ElfObject(original)
        functions = {}
        for name in FUNCTIONS:
            function = elf.function(name)
            functions[name] = {
                "section": function.section,
                "start": function.start,
                "size": function.size,
                "bytes": function.data.hex(),
                "relocations": [{"offset": reloc.offset, "type": reloc.type_name, "symbol": reloc.symbol, "addend": reloc.addend} for reloc in function.relocations],
            }
        rows = []
        with tempfile.TemporaryDirectory(prefix="re101-harness-") as work:
            for name, candidate in lesson.LEG_TWO_CANDIDATES:
                report = lesson.prove_bytes(name, candidate, original=pathlib.Path(original), workdir=pathlib.Path(work))
                rows.append({
                    "function": name,
                    "candidate": report.candidate,
                    "source": os.path.relpath(str(candidate), REPO),
                    "original_size": report.original_size,
                    "candidate_size": report.candidate_size,
                    "masked_equal": report.masked_equal,
                    "differing_offsets": report.differing_offsets[:8],
                    "masked_ranges": [list(item) for item in report.masked_ranges],
                    "relocations_match": report.relocations_match,
                    "relocations": report.relocation_detail,
                    "original_table": report.original_table,
                    "candidate_table": report.candidate_table,
                    "status": report.status,
                    "reasons": report.reasons(),
                })
        self.timings.append(("17-harness-bytes", time.monotonic() - started))
        self.write_json("17-harness-bytes.json", {
            "original": {"path": os.path.relpath(original, HERE), "sha256": sha256_of(original), "functions": functions},
            "build": HARNESS_FLAGS,
            "candidates": rows,
        })
        self.write("17-harness.txt", "\n".join([
            f"harness: {os.path.relpath(main_py, REPO)} loaded from {os.path.relpath(LESSON36, REPO)}",
            f"original object: {os.path.relpath(original, HERE)} ({sha256_of(original)})",
            f"host: {lesson.host_arch()} {platform.system()}, compiler {clang}",
            f"leg one: fixtures/ledger.c and each candidate compiled natively at -O1 into one program with {os.path.relpath(str(lesson.DRIVER_SOURCE), REPO)}, then run over {len(grid)} cells",
            f"leg two: each candidate compiled with `{HARNESS_FLAGS}`, then compared with the original after relocation masking",
            "files: 17-harness-grid.json, 17-harness-execute-plausible.json, 17-harness-execute-equal.json, 17-harness-bytes.json",
        ]) + "\n")
        self.commands.append("# 17-harness-*.json: the lesson 36 harness (phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/main.py) run in-process over fixtures/ledger-x86_64-O1.o, see 17-harness.txt")

    def finish(self):
        self.write("00-commands.txt", "\n\n".join(self.commands) + "\n")


def capture(out, rea, ghidra, java, wabt):
    os.makedirs(out, exist_ok=True)
    for name in os.listdir(out):
        if not name.startswith("."):
            os.remove(os.path.join(out, name))
    with tempfile.TemporaryDirectory(prefix="re101-") as work:
        kit = Kit(out, rea, ghidra, java, wabt, work)
        kit.step_versions()
        kit.step_cli()
        bundles = kit.step_mcp()
        kit.step_evidence_cli(bundles)
        kit.step_javascript()
        kit.step_wasm()
        kit.step_setup()
        kit.step_harness()
        kit.finish()
    return kit


def check(rea, ghidra, java, wabt):
    with tempfile.TemporaryDirectory(prefix="re101-check-") as fresh:
        capture(fresh, rea, ghidra, java, wabt)
        expected = sorted(name for name in os.listdir(OUT) if not name.startswith("."))
        actual = sorted(name for name in os.listdir(fresh) if not name.startswith("."))
        drift = []
        for name in sorted(set(expected) | set(actual)):
            if name not in expected:
                drift.append((name, f"{name}: present in the fresh run, missing in out/"))
            elif name not in actual:
                drift.append((name, f"{name}: present in out/, missing in the fresh run"))
            else:
                left = check_masks(read_text(os.path.join(OUT, name))).splitlines()
                right = check_masks(read_text(os.path.join(fresh, name))).splitlines()
                if left != right:
                    diff = list(difflib.unified_diff(left, right, f"out/{name}", f"fresh/{name}", lineterm="", n=1))
                    drift.append((name, "\n".join(diff[:40])))
    if drift:
        for _, text in drift:
            print(text)
        print("capture drift in: " + ", ".join(name for name, _ in drift))
        return 1
    print(f"capture check: {len(actual)} files match")
    return 0


def build_fixtures():
    before = {}
    for argv in FIXTURE_BUILDS:
        target = os.path.join(FIXTURES, argv[argv.index("-o") + 1])
        before[target] = sha256_of(target) if os.path.exists(target) else None
        program = argv[0]
        if program == "wat2wasm":
            directory, _ = find_wabt()
            if directory is None:
                print(f"skipped {shlex.join(argv)}: wat2wasm {WABT_VERSION} is not installed")
                continue
            argv = [os.path.join(directory, "wat2wasm")] + argv[1:]
        proc = subprocess.run(argv, cwd=FIXTURES, capture_output=True, text=True)
        if not os.path.exists(target):
            state = "missing"
        elif before[target] == sha256_of(target):
            state = "unchanged"
        else:
            state = "changed"
        print(f"[exit {proc.returncode}] {state}  {shlex.join([program] + argv[1:])}")
        if proc.stderr.strip():
            print(proc.stderr.strip())
    for target in before:
        if os.path.exists(target):
            print(f"{sha256_of(target)}  {os.path.relpath(target, HERE)}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Capture kit for Reverse Engineering 101: rea 6.7.0 with the Ghidra 12.1.4 provider")
    parser.add_argument("--check", action="store_true", help="capture into a temporary directory and compare with out/ after masking")
    parser.add_argument("--build-fixtures", action="store_true", help="rebuild the committed fixture binaries and the WASM module, then print their SHA-256")
    args = parser.parse_args()
    if args.build_fixtures:
        return build_fixtures()
    rea, rea_reason = find_rea()
    ghidra, ghidra_reason = find_ghidra()
    java, java_reason = find_java()
    wabt, _ = find_wabt()
    reason = rea_reason or ghidra_reason or java_reason
    if reason:
        if args.check:
            print("skipped: " + reason)
            return 0
        print(reason)
        return 1
    if args.check:
        return check(rea, ghidra, java, wabt)
    started = time.monotonic()
    kit = capture(OUT, rea, ghidra, java, wabt)
    files = len([name for name in os.listdir(OUT) if not name.startswith(".")])
    print(f"wrote {files} files to {OUT} in {time.monotonic() - started:.0f} s")
    for name, seconds in kit.timings:
        if seconds >= 2:
            print(f"  {seconds:6.1f} s  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
