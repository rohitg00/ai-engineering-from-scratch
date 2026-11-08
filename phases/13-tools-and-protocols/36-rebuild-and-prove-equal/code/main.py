"""Companion code for docs/en.md: prove a rebuilt C function equal to the original two ways,
a differential grid with C integer semantics (McKeeman 1998) and recompiled bytes after
relocation masking (System V gABI chapter 4, x86-64 psABI), with an agent loop over rea's
MCP server (MCP 2025-11-25) or the captured run in fixtures/runs/agent-run.json.
Run `python3 main.py`, `python3 main.py --live`, or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import queue
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
CANDIDATES = FIXTURES / "candidates"
RUNS = FIXTURES / "runs"
ORIGINAL_SOURCE = FIXTURES / "ledger.c"
ORIGINAL_OBJECT = FIXTURES / "ledger-x86_64-O1.o"
DRIVER_SOURCE = HERE / "driver.c"
AGENT_RUN = RUNS / "agent-run.json"
FIXTURE_FLAGS = (
    "-target",
    "x86_64-unknown-linux-gnu",
    "-O1",
    "-fno-asynchronous-unwind-tables",
    "-c",
)
INT_MIN = -(2**31)
INT_MAX = 2**31 - 1
TRAP = "trap"
FUNCTIONS = ("percent_change", "grade")
REA_COMMAND = os.environ.get("REA_MCP_COMMAND", "npx -y rea-agents@6.5.0 mcp").split()
MCP_PROTOCOL_VERSION = "2025-11-25"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def wrap32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value >= 0x80000000 else value


def c_div(dividend: int, divisor: int) -> int:
    quotient = abs(dividend) // abs(divisor)
    return -quotient if (dividend < 0) != (divisor < 0) else quotient


def idiv32(dividend: int, divisor: int, arch: str) -> int | str:
    """Signed 32-bit division as the target instruction performs it.
    x86-64 `idiv` raises #DE for INT_MIN / -1. AArch64 `sdiv` returns INT_MIN."""
    if dividend == INT_MIN and divisor == -1:
        return TRAP if arch == "x86_64" else INT_MIN
    return c_div(dividend, divisor)


def percent_change_model(before: int, after: int, arch: str = "x86_64") -> int | str:
    if before == 0:
        return 0
    product = wrap32(wrap32(after - before) * 100)
    return idiv32(product, before, arch)


def grade_model(score: int) -> int:
    tens = c_div(score, 10)
    return {10: 4, 9: 4, 8: 3, 7: 2, 6: 1}.get(tens, 0)


def model(function: str, args: tuple[int, ...], arch: str = "x86_64") -> int | str:
    if function == "percent_change":
        return percent_change_model(args[0], args[1], arch)
    if function == "grade":
        return grade_model(args[0])
    raise ValueError(f"no model for {function}")


PERCENT_BEFORE = (0, 1, -1, 3, -3, 7, 100, -100, INT_MAX, INT_MIN)
PERCENT_AFTER = (0, 5, -5, 105, 536870911, INT_MAX, INT_MIN)
GRADE_SCORES = (
    INT_MIN, -11, -10, -9, -1, 0, 9, 10, 59, 60, 69, 70, 79, 80, 89, 90,
    99, 100, 101, 109, 110, INT_MAX,
)
NAIVE_CASES: dict[str, tuple[tuple[int, ...], ...]] = {
    "percent_change": ((100, 150), (200, 100), (0, 5), (50, 100)),
    "grade": ((55,), (65,), (75,), (85,), (95,), (100,)),
}


@dataclass(frozen=True)
class Cell:
    function: str
    args: tuple[int, ...]
    kind: str

    def line(self) -> str:
        return " ".join([self.function, *map(str, self.args)])


def classify(function: str, args: tuple[int, ...]) -> str:
    if function == "percent_change":
        before, after = args
        if before == 0:
            return "zero guard"
        difference = after - before
        product = wrap32(difference) * 100
        if wrap32(difference) != difference or wrap32(product) != product:
            return "trap" if percent_change_model(before, after) == TRAP else "overflow"
        if before < 0 or after < 0:
            return "negative"
        return "rounding" if product % before else "plain"
    score = args[0]
    if score < 0:
        return "negative truncation"
    if score > 109:
        return "beyond the switch"
    return "boundary" if score % 10 in (0, 9) else "plain"


def input_grid() -> list[Cell]:
    cells = [
        Cell("percent_change", (before, after), classify("percent_change", (before, after)))
        for before in PERCENT_BEFORE
        for after in PERCENT_AFTER
    ]
    cells.extend(Cell("grade", (score,), classify("grade", (score,))) for score in GRADE_SCORES)
    return cells


def naive_cells() -> list[Cell]:
    return [
        Cell(function, args, "naive")
        for function, cases in NAIVE_CASES.items()
        for args in cases
    ]


def host_arch() -> str:
    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        return "x86_64"
    if machine in ("arm64", "aarch64"):
        return "aarch64"
    return machine


def host_compiler() -> str | None:
    return shutil.which("clang") or shutil.which("cc")


def original_is_fixture_object() -> bool:
    return host_arch() == "x86_64" and platform.system() == "Linux"


@dataclass
class Harness:
    binary: Path
    original_kind: str
    host: str
    compiler: str


def build_harness(candidates: dict[str, Path], workdir: Path) -> Harness:
    """Compile the original, the renamed candidates, and the driver into one program."""
    compiler = host_compiler()
    if compiler is None:
        raise RuntimeError("no C compiler on PATH")
    missing = [name for name in FUNCTIONS if name not in candidates]
    if missing:
        raise ValueError(f"candidate missing for {missing}")
    objects: list[Path] = []
    if original_is_fixture_object():
        objects.append(ORIGINAL_OBJECT)
        original_kind = "fixture-object"
    else:
        original = workdir / "original.o"
        subprocess.run([compiler, "-O1", "-c", str(ORIGINAL_SOURCE), "-o", str(original)], check=True)
        objects.append(original)
        original_kind = "fixture-source"
    renames = [f"-D{name}=cand_{name}" for name in FUNCTIONS]
    for name in FUNCTIONS:
        out = workdir / f"cand_{name}.o"
        subprocess.run([compiler, "-O1", *renames, "-c", str(candidates[name]), "-o", str(out)], check=True)
        objects.append(out)
    binary = workdir / "differential"
    subprocess.run([compiler, "-O1", str(DRIVER_SOURCE), *map(str, objects), "-o", str(binary)], check=True)
    return Harness(binary, original_kind, f"{host_arch()} {platform.system()}", compiler)


def parse_value(token: str) -> int | str:
    return TRAP if token == TRAP else int(token)


def execute(harness: Harness, cells: list[Cell]) -> list[dict[str, Any]]:
    feed = "".join(cell.line() + "\n" for cell in cells)
    completed = subprocess.run([str(harness.binary)], input=feed, capture_output=True, text=True, check=True)
    rows = []
    for cell, line in zip(cells, completed.stdout.splitlines()):
        tokens = line.split()
        original, candidate = parse_value(tokens[-2]), parse_value(tokens[-1])
        rows.append(
            {
                "function": cell.function,
                "args": list(cell.args),
                "kind": cell.kind,
                "original": original,
                "candidate": candidate,
                "match": original == candidate,
            }
        )
    if len(rows) != len(cells):
        raise RuntimeError("driver printed fewer rows than cells")
    return rows


def oracle_disagreements(rows: list[dict[str, Any]], arch: str) -> list[dict[str, Any]]:
    """Cells where our Python model of the original disagrees with the observed original."""
    disagreements = []
    for row in rows:
        expected = model(row["function"], tuple(row["args"]), arch)
        if expected != row["original"]:
            disagreements.append({**row, "model": expected})
    return disagreements


@dataclass
class LegOneReport:
    original_kind: str
    host: str
    arch: str
    naive_passed: bool
    cells: int
    mismatches: list[dict[str, Any]]
    oracle_disagreements: list[dict[str, Any]]
    rows: list[dict[str, Any]] = field(default_factory=list, repr=False)


def prove_behaviour(candidates: dict[str, Path], grid: list[Cell] | None = None) -> LegOneReport:
    grid = list(grid or input_grid())
    with tempfile.TemporaryDirectory() as tmp:
        harness = build_harness(candidates, Path(tmp))
        naive_rows = execute(harness, naive_cells())
        rows = execute(harness, grid)
    arch = host_arch()
    return LegOneReport(
        original_kind=harness.original_kind,
        host=harness.host,
        arch=arch,
        naive_passed=all(row["match"] for row in naive_rows),
        cells=len(rows),
        mismatches=[row for row in rows if not row["match"]],
        oracle_disagreements=oracle_disagreements(rows, arch),
        rows=rows,
    )


def compare_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if row["original"] != row["candidate"]]


SHT_SYMTAB = 2
SHT_RELA = 4
STT_SECTION = 3
EM_X86_64 = 62
ET_REL = 1
RELOC_NAMES = {0: "R_X86_64_NONE", 1: "R_X86_64_64", 2: "R_X86_64_PC32", 4: "R_X86_64_PLT32", 10: "R_X86_64_32", 11: "R_X86_64_32S"}
RELOC_WIDTH = {1: 8, 2: 4, 4: 4, 10: 4, 11: 4}
PC_RELATIVE = {2, 4}


@dataclass
class Reloc:
    offset: int
    type: int
    symbol: str
    addend: int

    @property
    def type_name(self) -> str:
        return RELOC_NAMES.get(self.type, f"R_X86_64_{self.type}")

    @property
    def width(self) -> int:
        return RELOC_WIDTH.get(self.type, 4)


@dataclass
class FunctionBytes:
    name: str
    section: str
    start: int
    data: bytes
    relocations: list[Reloc]

    @property
    def size(self) -> int:
        return len(self.data)


class ElfObject:
    """A reader for one ELF64 little-endian x86-64 relocatable object."""

    def __init__(self, path: Path):
        self.path = Path(path)
        data = self.path.read_bytes()
        self.data = data
        if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
            raise ValueError(f"{path} is not an ELF64 little-endian file")
        e_type, e_machine = struct.unpack_from("<HH", data, 16)
        if e_machine != EM_X86_64 or e_type != ET_REL:
            raise ValueError(f"{path} is not an x86-64 relocatable object")
        shoff = struct.unpack_from("<Q", data, 40)[0]
        shentsize, shnum, shstrndx = struct.unpack_from("<HHH", data, 58)
        raw = []
        for index in range(shnum):
            fields = struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize)
            raw.append(
                {"name_offset": fields[0], "type": fields[1], "offset": fields[4], "size": fields[5], "link": fields[6], "info": fields[7]}
            )
        names = raw[shstrndx]
        for section in raw:
            section["name"] = self._cstring(names["offset"] + section["name_offset"])
            section["data"] = data[section["offset"] : section["offset"] + section["size"]]
        self.sections = raw
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    def _cstring(self, offset: int) -> str:
        end = self.data.index(b"\0", offset)
        return self.data[offset:end].decode("ascii")

    def _read_symbols(self) -> list[dict[str, Any]]:
        symtab = next(section for section in self.sections if section["type"] == SHT_SYMTAB)
        strtab = self.sections[symtab["link"]]
        symbols = []
        for offset in range(0, symtab["size"], 24):
            name_offset, info, _other, shndx, value, size = struct.unpack_from("<IBBHQQ", symtab["data"], offset)
            name = self._cstring(strtab["offset"] + name_offset)
            if info & 0xF == STT_SECTION and shndx < len(self.sections):
                name = self.sections[shndx]["name"]
            symbols.append({"name": name, "value": value, "size": size, "shndx": shndx, "type": info & 0xF})
        return symbols

    def _read_relocations(self) -> dict[int, list[Reloc]]:
        table: dict[int, list[Reloc]] = {}
        for section in self.sections:
            if section["type"] != SHT_RELA:
                continue
            entries = []
            for offset in range(0, section["size"], 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section["data"], offset)
                symbol = self.symbols[r_info >> 32]["name"]
                entries.append(Reloc(r_offset, r_info & 0xFFFFFFFF, symbol, r_addend))
            table[section["info"]] = entries
        return table

    def section_named(self, name: str) -> dict[str, Any]:
        return next(section for section in self.sections if section["name"] == name)

    def symbol(self, name: str) -> dict[str, Any]:
        matches = [symbol for symbol in self.symbols if symbol["name"] == name and symbol["type"] != STT_SECTION]
        if not matches:
            raise KeyError(f"{name} is not a symbol in {self.path.name}")
        return matches[0]

    def function(self, name: str) -> FunctionBytes:
        symbol = self.symbol(name)
        section = self.sections[symbol["shndx"]]
        start, size = symbol["value"], symbol["size"]
        inside = [
            Reloc(reloc.offset - start, reloc.type, reloc.symbol, reloc.addend)
            for reloc in self.relocations.get(symbol["shndx"], [])
            if start <= reloc.offset < start + size
        ]
        return FunctionBytes(name, section["name"], start, section["data"][start : start + size], inside)

    def read_target(self, reloc: Reloc, length: int) -> bytes:
        """Bytes at the place a relocation points to. For a PC-relative field that ends its
        instruction, the target is symbol + addend + field width."""
        section = self.section_named(reloc.symbol)
        offset = reloc.addend + (reloc.width if reloc.type in PC_RELATIVE else 0)
        return section["data"][offset : offset + length]


def mask_relocations(data: bytes, relocations: list[Reloc]) -> tuple[bytes, list[tuple[int, int]]]:
    masked = bytearray(data)
    ranges = []
    for reloc in relocations:
        for index in range(reloc.offset, min(reloc.offset + reloc.width, len(masked))):
            masked[index] = 0
        ranges.append((reloc.offset, reloc.width))
    return bytes(masked), ranges


def read_table(obj: ElfObject, reloc: Reloc, entries: int, width: int) -> list[int]:
    raw = obj.read_target(reloc, entries * width)
    return [int.from_bytes(raw[index : index + width], "little", signed=True) for index in range(0, len(raw), width)]


CLAIMS: dict[str, dict[str, Any]] = {
    "percent_change": {"relocations": 0},
    "grade": {"relocations": 1, "table": {"entries": 5, "width": 4}},
}


@dataclass
class LegTwoReport:
    function: str
    candidate: str
    original_size: int
    candidate_size: int
    masked_equal: bool
    differing_offsets: list[int]
    masked_ranges: list[tuple[int, int]]
    relocations_match: bool
    relocation_detail: list[dict[str, Any]]
    original_table: list[int] | None
    candidate_table: list[int] | None

    @property
    def tables_equal(self) -> bool | None:
        if self.original_table is None:
            return None
        return self.original_table == self.candidate_table

    @property
    def bytes_equal(self) -> bool:
        return self.original_size == self.candidate_size and self.masked_equal and self.relocations_match

    @property
    def status(self) -> str:
        if not self.bytes_equal or self.tables_equal is False:
            return "fail"
        return "pass"

    def reasons(self) -> list[str]:
        reasons = []
        if self.original_size != self.candidate_size:
            reasons.append(f"size {self.original_size} vs {self.candidate_size} bytes")
        elif not self.masked_equal:
            reasons.append(f"{len(self.differing_offsets)} unmasked bytes differ, first at offset {self.differing_offsets[0]:#x}")
        if not self.relocations_match:
            reasons.append("relocation records differ in count, offset, type, or target section")
        if self.tables_equal is False:
            reasons.append(f"referenced constants differ: {self.original_table} vs {self.candidate_table}")
        return reasons


def compile_fixture_object(source: Path, out: Path) -> Path:
    clang = shutil.which("clang")
    if clang is None:
        raise RuntimeError("clang is required for the x86-64 fixture flags")
    subprocess.run([clang, *FIXTURE_FLAGS, str(source), "-o", str(out)], check=True)
    return out


def candidate_object(candidate: Path, workdir: Path | None) -> Path:
    if candidate.suffix == ".o":
        return candidate
    if shutil.which("clang") and workdir is not None:
        return compile_fixture_object(candidate, workdir / (candidate.stem + ".o"))
    committed = candidate.with_suffix(".o")
    if committed.exists():
        return committed
    raise RuntimeError(f"no clang and no committed object for {candidate.name}")


def prove_bytes(function: str, candidate: Path, original: Path = ORIGINAL_OBJECT, workdir: Path | None = None) -> LegTwoReport:
    original_obj = ElfObject(original)
    candidate_obj = ElfObject(candidate_object(candidate, workdir))
    left = original_obj.function(function)
    right = candidate_obj.function(function)
    masked_left, ranges = mask_relocations(left.data, left.relocations)
    masked_right, _ = mask_relocations(right.data, right.relocations)
    differing = [index for index, (a, b) in enumerate(zip(masked_left, masked_right)) if a != b]
    detail = []
    relocations_match = len(left.relocations) == len(right.relocations)
    for reloc_left, reloc_right in zip(left.relocations, right.relocations):
        same = (
            reloc_left.offset == reloc_right.offset
            and reloc_left.type == reloc_right.type
            and reloc_left.symbol == reloc_right.symbol
        )
        relocations_match = relocations_match and same
        detail.append(
            {
                "offset": reloc_left.offset,
                "type": reloc_left.type_name,
                "original_target": f"{reloc_left.symbol}{reloc_left.addend:+#x}",
                "candidate_target": f"{reloc_right.symbol}{reloc_right.addend:+#x}",
                "same_shape": same,
            }
        )
    claim = CLAIMS.get(function, {})
    if "relocations" in claim and len(left.relocations) != claim["relocations"]:
        raise ValueError(f"{function}: expected {claim['relocations']} relocations in the original, found {len(left.relocations)}")
    original_table = candidate_table = None
    if "table" in claim and left.relocations and right.relocations:
        entries, width = claim["table"]["entries"], claim["table"]["width"]
        original_table = read_table(original_obj, left.relocations[0], entries, width)
        candidate_table = read_table(candidate_obj, right.relocations[0], entries, width)
    return LegTwoReport(
        function=function,
        candidate=candidate.stem,
        original_size=left.size,
        candidate_size=right.size,
        masked_equal=left.size == right.size and not differing,
        differing_offsets=differing,
        masked_ranges=ranges,
        relocations_match=relocations_match,
        relocation_detail=detail,
        original_table=original_table,
        candidate_table=candidate_table,
    )


class McpError(RuntimeError):
    pass


class McpStdioClient:
    """Newline-delimited JSON-RPC 2.0 over a child process's stdin and stdout."""

    def __init__(self, command: list[str], env: dict[str, str] | None = None, timeout: float = 330.0):
        self.command = command
        self.env = env
        self.timeout = timeout
        self.process: subprocess.Popen[bytes] | None = None
        self.inbox: queue.Queue[dict[str, Any] | None] = queue.Queue()
        self.next_id = 0
        self.notifications: list[dict[str, Any]] = []
        self.server_info: dict[str, Any] = {}
        self.protocol_version = ""

    def __enter__(self) -> McpStdioClient:
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def start(self) -> None:
        self.process = subprocess.Popen(
            self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=self.env
        )
        threading.Thread(target=self._pump, daemon=True).start()
        result = self.request(
            "initialize",
            {"protocolVersion": MCP_PROTOCOL_VERSION, "capabilities": {}, "clientInfo": {"name": "aiefs-lesson-36", "version": "1.0.0"}},
        )
        self.server_info = result.get("serverInfo", {})
        self.protocol_version = result.get("protocolVersion", "")
        self.notify("notifications/initialized", {})

    def _pump(self) -> None:
        assert self.process and self.process.stdout
        for line in self.process.stdout:
            try:
                self.inbox.put(json.loads(line))
            except json.JSONDecodeError:
                continue
        self.inbox.put(None)

    def _send(self, message: dict[str, Any]) -> None:
        assert self.process and self.process.stdin
        self.process.stdin.write((json.dumps(message) + "\n").encode("utf-8"))
        self.process.stdin.flush()

    def notify(self, method: str, params: dict[str, Any]) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        self.next_id += 1
        request_id = self.next_id
        self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + self.timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise McpError(f"{method}: no response within {self.timeout:.0f} s")
            try:
                message = self.inbox.get(timeout=remaining)
            except queue.Empty:
                continue
            if message is None:
                raise McpError(f"{method}: server closed stdout")
            if message.get("id") != request_id:
                self.notifications.append(message)
                continue
            if "error" in message:
                raise McpError(json.dumps(message["error"]))
            return message.get("result", {})

    def list_tools(self) -> list[str]:
        return sorted(tool["name"] for tool in self.request("tools/list", {}).get("tools", []))

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self.request("tools/call", {"name": name, "arguments": arguments})

    def close(self) -> None:
        if self.process is None:
            return
        try:
            if self.process.stdin:
                self.process.stdin.close()
            self.process.wait(timeout=20)
        except Exception:
            self.process.kill()
        if self.process.stdout:
            self.process.stdout.close()
        self.process = None


def rea_available() -> bool:
    ghidra = os.environ.get("GHIDRA_INSTALL_DIR", "")
    return bool(shutil.which(REA_COMMAND[0])) and bool(ghidra) and Path(ghidra).is_dir()


def table_address(assembly: list[str]) -> str | None:
    """The operand of the `LEA` that loads the switch table address."""
    for line in assembly:
        if "LEA" in line.upper():
            found = re.findall(r"0x[0-9a-fA-F]+", line)
            if found:
                return found[-1]
    return None


def agent_loop(target: Path, client: McpStdioClient, functions: tuple[str, ...] = FUNCTIONS) -> dict[str, Any]:
    """Fetch function evidence for a target and record every step with its evidence id."""
    steps: list[dict[str, Any]] = []
    evidence: dict[str, Any] = {}

    def step(tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        started = time.monotonic()
        result = client.call_tool(tool, arguments)
        structured = result.get("structuredContent") or {}
        evidence_id = structured.get("evidence_id")
        if evidence_id:
            evidence[evidence_id] = structured
        steps.append(
            {
                "step": len(steps) + 1,
                "tool": tool,
                "arguments": arguments,
                "seconds": round(time.monotonic() - started, 2),
                "is_error": bool(result.get("isError")),
                "evidence_id": evidence_id,
                "confidence": structured.get("confidence"),
                "authority": structured.get("authority"),
                "limitations": structured.get("limitations", []),
                "result_sha256": digest(result),
            }
        )
        if result.get("isError"):
            raise McpError(json.dumps(result.get("content"))[:800])
        return structured

    step("open_binary", {"path": str(target), "provider_id": "ghidra"})
    dossiers = {name: step("analyze_function", {"procedure": name}) for name in functions}
    address = table_address((dossiers.get("grade") or {}).get("normalized_result", {}).get("assembly", []))
    if address:
        step("read_bytes", {"address": address, "length": 20})
    step("get_evidence_bundle", {"detail": "summary"})
    step("close_binary", {})
    return {
        "target": {"path": target.name, "sha256": file_sha256(target)},
        "server": {**client.server_info, "protocolVersion": client.protocol_version},
        "command": client.command,
        "steps": steps,
        "evidence": evidence,
    }


def load_agent_run(path: Path = AGENT_RUN) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def function_evidence(run: dict[str, Any], function: str) -> dict[str, Any] | None:
    for step in run["steps"]:
        if step["tool"] == "analyze_function" and step["arguments"].get("procedure") == function:
            return run["evidence"].get(step["evidence_id"])
    return None


def pseudocode(run: dict[str, Any], function: str) -> str:
    record = function_evidence(run, function) or {}
    return (record.get("normalized_result") or {}).get("pseudocode") or ""


def claim(claim_id: str, kind: str, status: str, evidence_ids: list[str], detail: dict[str, Any]) -> dict[str, Any]:
    return {"claim_id": claim_id, "kind": kind, "status": status, "evidence_ids": evidence_ids, "detail": detail}


def aggregate(statuses: list[str]) -> str:
    """fail wins, then unknown. An empty claim list proves nothing, so it is unknown."""
    if any(status == "fail" for status in statuses):
        return "fail"
    if not statuses or any(status != "pass" for status in statuses):
        return "unknown"
    return "pass"


def build_proof(leg_one: LegOneReport | None, leg_two: list[LegTwoReport], run: dict[str, Any]) -> dict[str, Any]:
    ids = {
        name: [step["evidence_id"] for step in run["steps"] if step["tool"] == "analyze_function" and step["arguments"].get("procedure") == name and step["evidence_id"]]
        for name in FUNCTIONS
    }
    claims = []
    for name in FUNCTIONS:
        if leg_one is None:
            claims.append(claim(f"{name}.behaviour", "behavioral", "unknown", ids[name], {"reason": "no C compiler on this host"}))
        else:
            mismatches = [row for row in leg_one.mismatches if row["function"] == name]
            cells = sum(1 for row in leg_one.rows if row["function"] == name)
            claims.append(
                claim(
                    f"{name}.behaviour",
                    "behavioral",
                    "pass" if not mismatches else "fail",
                    ids[name],
                    {"original": leg_one.original_kind, "host": leg_one.host, "cells": cells, "mismatches": len(mismatches)},
                )
            )
    for report in leg_two:
        claims.append(
            claim(
                f"{report.function}.bytes",
                "structural-function",
                "pass" if report.bytes_equal else "fail",
                ids[report.function],
                {"candidate": report.candidate, "size": report.original_size, "masked": report.masked_ranges},
            )
        )
        if report.tables_equal is not None:
            claims.append(
                claim(
                    f"{report.function}.referenced-constants",
                    "structural-function",
                    "pass" if report.tables_equal else "fail",
                    ids[report.function],
                    {"original": report.original_table, "candidate": report.candidate_table},
                )
            )
    status = aggregate([entry["status"] for entry in claims])
    record = {
        "predicate_type": "rea.reconstruction-proof",
        "operation": "verify_reconstruction_obligations",
        "confidence": "observed",
        "authority": "controlled-replay",
        "subject": run.get("target"),
        "normalized_result": {"passed": status == "pass", "status": status, "claims": claims},
        "evidence_links": sorted({evidence_id for group in ids.values() for evidence_id in group}),
        "limitations": [
            "Pass covers the declared claims on the declared grid and the declared bytes. It is not global equivalence.",
        ],
    }
    record["evidence_id"] = "ev_" + digest(record)
    return record


PLAUSIBLE = {"percent_change": CANDIDATES / "percent_change_wide.c", "grade": CANDIDATES / "grade_thresholds.c"}
EQUAL = {"percent_change": CANDIDATES / "percent_change_mul_first.c", "grade": CANDIDATES / "grade_switch.c"}
LEG_TWO_CANDIDATES = (
    ("percent_change", CANDIDATES / "percent_change_mul_first.c"),
    ("percent_change", CANDIDATES / "percent_change_split.c"),
    ("percent_change", CANDIDATES / "percent_change_wide.c"),
    ("percent_change", CANDIDATES / "percent_change_div_first.c"),
    ("grade", CANDIDATES / "grade_switch.c"),
    ("grade", CANDIDATES / "grade_table.c"),
    ("grade", CANDIDATES / "grade_thresholds.c"),
    ("grade", CANDIDATES / "grade_case10_wrong.c"),
)


def leg_one_summary(report: LegOneReport) -> dict[str, Any]:
    return {
        "naivePassed": report.naive_passed,
        "gridMismatches": len(report.mismatches),
        "firstMismatches": [
            {"function": row["function"], "args": row["args"], "kind": row["kind"], "original": row["original"], "candidate": row["candidate"]}
            for row in report.mismatches[:3]
        ],
        "oracleDisagreements": len(report.oracle_disagreements),
    }


def save_leg_one_run(report: LegOneReport, label: str) -> Path:
    RUNS.mkdir(exist_ok=True)
    path = RUNS / f"leg-one-{label}-{report.arch}-{platform.system().lower()}.json"
    path.write_text(json.dumps({"original_kind": report.original_kind, "host": report.host, "arch": report.arch, "naive_passed": report.naive_passed, "rows": report.rows}, indent=1) + "\n")
    return path


def run_agent(live: bool, target: Path = ORIGINAL_OBJECT) -> tuple[dict[str, Any], str]:
    if live and rea_available():
        with McpStdioClient(REA_COMMAND, env={**os.environ}) as client:
            run = agent_loop(target, client)
        RUNS.mkdir(exist_ok=True)
        AGENT_RUN.write_text(json.dumps(run, indent=1) + "\n")
        return run, "live"
    if live:
        print("rea or GHIDRA_INSTALL_DIR not found; replaying fixtures/runs/agent-run.json", file=sys.stderr)
    return load_agent_run(), "replayed fixture"


def demo(argv: list[str]) -> None:
    live = "--live" in argv
    save_runs = "--save-runs" in argv
    leg_one: dict[str, LegOneReport | None] = {"plausible": None, "equal": None}
    if host_compiler():
        leg_one["plausible"] = prove_behaviour(PLAUSIBLE)
        leg_one["equal"] = prove_behaviour(EQUAL)
        if save_runs:
            for label, report in leg_one.items():
                if report:
                    save_leg_one_run(report, label)
    with tempfile.TemporaryDirectory() as tmp:
        leg_two = [prove_bytes(name, path, workdir=Path(tmp)) for name, path in LEG_TWO_CANDIDATES]
    run, mode = run_agent(live)
    equal_reports = [report for report in leg_two if report.candidate in ("percent_change_mul_first", "grade_switch")]
    proof = build_proof(leg_one["equal"], equal_reports, run)
    print(
        json.dumps(
            {
                "host": f"{host_arch()} {platform.system()}",
                "originalKind": leg_one["equal"].original_kind if leg_one["equal"] else "not run",
                "gridCells": len(input_grid()),
                "plausible": leg_one_summary(leg_one["plausible"]) if leg_one["plausible"] else "no C compiler",
                "equal": leg_one_summary(leg_one["equal"]) if leg_one["equal"] else "no C compiler",
                "legTwo": {report.candidate: {"status": report.status, "reasons": report.reasons()} for report in leg_two},
                "agentRun": {"mode": mode, "server": run["server"], "steps": [f'{step["tool"]} {step["evidence_id"] or "-"}' for step in run["steps"]]},
                "proof": {"status": proof["normalized_result"]["status"], "evidence_id": proof["evidence_id"], "claims": {entry["claim_id"]: entry["status"] for entry in proof["normalized_result"]["claims"]}},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    demo(sys.argv[1:])
