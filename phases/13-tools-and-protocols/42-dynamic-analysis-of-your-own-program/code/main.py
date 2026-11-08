"""Companion code for docs/en.md: drive lldb in batch mode over a program we compiled ourselves,
record registers and memory at every stop, and grade static claims as confirmed, refuted, or not observed.
lldb batch flags and command grammar: https://lldb.llvm.org/man/lldb.html and https://lldb.llvm.org/use/tutorial.html.
Argument registers: AAPCS64 section 6.4 (x0 to x7) and the x86-64 psABI section 3.2.3 (rdi, rsi, rdx, rcx, r8, r9).
Run `python3 main.py` for the fixture-based demo. Run `python3 main.py live` when lldb can launch a process here.
"""

from __future__ import annotations

import ast
import datetime as dt
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
PROGRAM = "account.c"
VARIANTS = ("O0", "O2")
FUNCTIONS = ("bump", "classify", "sum_balances")
EDGE_FUNCTION = "classify"
WATCH_FUNCTION = "bump"
WATCH_EXPRESSION = "a->balance"
STRUCT_NAME = "account"
MEMORY_WORDS = 24
CONTINUE_BUDGET = 16
EXPECTED_CALLS = {"bump": 1, "classify": 3, "sum_balances": 1}
EXPECTED_OUTPUT = ("sizeof 32 align 8", "offsets 0 4 8 16 24", "class 0 1 -1", "sum 315")
HOOK_REGISTERS = {"arm64": ("x0", "x1", "pc"), "x86_64": ("rdi", "rsi", "rip")}
ARGUMENT_REGISTERS = {
    "arm64": ("x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"),
    "x86_64": ("rdi", "rsi", "rdx", "rcx", "r8", "r9"),
}
CONDITIONAL_ARM64 = {"cbz", "cbnz", "tbz", "tbnz"}
CALL_MNEMONICS = {"bl", "callq", "call"}
LLDB_SETTINGS = "settings set interpreter.stop-command-source-on-error false"
VERDICTS = ("confirmed", "refuted", "not-observed")
TOOLS = ("lldb", "gdb", "rr", "strace", "ltrace", "bpftrace", "dtrace", "dtruss", "clang", "objdump", "llvm-objdump")

COMMAND_MAP = [
    ("break at a function", "break bump", "breakpoint set -n bump", "b bump"),
    ("break at file and line", "break account.c:13", "breakpoint set -f account.c -l 13", "b account.c:13"),
    ("break at an address", "break *0x1000004f0", "breakpoint set -a 0x1000004f0", ""),
    ("break in one module only", "(no direct form)", "breakpoint set -a 0x1000004f0 -s account-O0", ""),
    ("condition on a breakpoint", "condition 1 by == 5", "breakpoint modify -c 'by == 5' 1", ""),
    ("commands on a breakpoint", "commands 1 ... end", "breakpoint command add 1", ""),
    ("run commands at every stop", "define hook-stop ... end", "target stop-hook add -o 'register read x0'", ""),
    ("list breakpoints", "info breakpoints", "breakpoint list", "br l"),
    ("watch a variable for writes", "watch a->balance", "watchpoint set variable a->balance", "wa s v a->balance"),
    ("watch an address", "watch *(int *)0x16fdfe1fc", "watchpoint set expression -- 0x16fdfe1fc", "wa s e -- 0x16fdfe1fc"),
    ("list watchpoints", "info watchpoints", "watchpoint list -v", "wa l -v"),
    ("start the program", "run", "process launch", "run"),
    ("start and stop at the first instruction", "starti", "process launch --stop-at-entry", ""),
    ("continue", "continue", "thread continue", "c"),
    ("step into a call", "step", "thread step-in", "s"),
    ("step over a call", "next", "thread step-over", "n"),
    ("step one instruction", "stepi", "thread step-inst", "si"),
    ("step one instruction over a call", "nexti", "thread step-inst-over", "ni"),
    ("run until the function returns", "finish", "thread step-out", "finish"),
    ("backtrace", "bt", "thread backtrace", "bt"),
    ("read every register", "info registers", "register read", "re r"),
    ("read one register", "p $x0", "register read x0", ""),
    ("read memory as words", "x/8xw 0x16fdfe1f8", "memory read -s4 -fx -c8 0x16fdfe1f8", "x -s4 -fx -c8 0x16fdfe1f8"),
    ("show arguments", "info args", "frame variable --no-locals", ""),
    ("show locals", "info locals", "frame variable --no-args", ""),
    ("show one variable", "print a->balance", "frame variable a->balance", "v a->balance"),
    ("evaluate an expression", "print by + 1", "expression by + 1", "p by + 1"),
    ("disassemble the current function", "disassemble", "disassemble --frame", "di -f"),
    ("disassemble a named function", "disassemble bump", "disassemble --name bump", "di -n bump"),
    ("name an address", "info symbol 0x1000004bc", "image lookup --address 0x1000004bc", "im loo -a 0x1000004bc"),
    ("attach to a process", "attach 1234", "process attach --pid 1234", ""),
    ("open a core file", "gdb account-O0 core", "lldb -c core account-O0", ""),
    ("write a core file", "gcore core", "process save-core --style stack core", ""),
    ("run a script line", "python print(1)", "script print(1)", ""),
    ("quit", "quit", "quit", "q"),
]

HARDWARE_LIMITS = [
    {"arch": "x86-64", "resource": "debug address registers DR0 to DR3", "count": 4, "lengths": [1, 2, 4, 8], "softwareBreakpoint": "int3, opcode 0xCC, one byte"},
    {"arch": "arm64", "resource": "DBGWVR<n>_EL1 and DBGWCR<n>_EL1 pairs", "count": "2 to 64 per implementation, 4 reported by lldb on this machine", "lengths": [1, 2, 4, 8], "softwareBreakpoint": "brk #imm16, opcode 0xd4200000 | imm16 << 5, four bytes"},
]


class HarnessError(ValueError):
    pass


@dataclass(frozen=True)
class Line:
    address: int
    encoding: str
    mnemonic: str
    operands: str

    @property
    def text(self) -> str:
        return self.mnemonic + ("\t" + self.operands if self.operands else "")

    @property
    def target(self) -> int | None:
        for token in self.operands.replace(",", " ").split():
            if token.startswith("0x"):
                return int(token, 16)
        return None

    @property
    def target_symbol(self) -> str | None:
        match = re.search(r"<([^>+]+)(?:\+0x[0-9a-f]+)?>", self.operands)
        return match.group(1) if match else None


@dataclass(frozen=True)
class Branch:
    address: int
    mnemonic: str
    operands: str
    target: int
    fallthrough: int

    @property
    def text(self) -> str:
        return f"{self.mnemonic}\t{self.operands}"


@dataclass
class Function:
    symbol: str
    name: str
    start: int
    lines: list[Line] = field(default_factory=list)

    @property
    def end(self) -> int:
        last = self.lines[-1]
        return last.address + max(1, len(last.encoding.replace(" ", "")) // 2)

    def line_at(self, address: int) -> Line | None:
        for line in self.lines:
            if line.address == address:
                return line
        return None

    def line_before(self, address: int) -> Line | None:
        previous = None
        for line in self.lines:
            if line.address >= address:
                return previous
            previous = line
        return previous

    def conditional_branches(self, arch: str) -> list[Branch]:
        branches: list[Branch] = []
        for position, line in enumerate(self.lines):
            if not is_conditional(line.mnemonic, arch) or line.target is None or position + 1 >= len(self.lines):
                continue
            branches.append(Branch(line.address, line.mnemonic, line.operands.split("<")[0].strip(), line.target, self.lines[position + 1].address))
        return branches

    def calls(self) -> list[tuple[int, str | None]]:
        return [(line.address, line.target_symbol) for line in self.lines if line.mnemonic in CALL_MNEMONICS]


def is_conditional(mnemonic: str, arch: str) -> bool:
    if arch == "arm64":
        return mnemonic.startswith("b.") or mnemonic in CONDITIONAL_ARM64
    return bool(re.match(r"^j(?!mp$)[a-z]+$", mnemonic))


HEADER_RE = re.compile(r"^(\S+):\s+file format (\S+)(?:\s+(\S+))?\s*$")
FUNCTION_RE = re.compile(r"^([0-9a-f]+) <(.+)>:\s*$")
INSTRUCTION_RE = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}(?: [0-9a-f]{2})*)|[0-9a-f]{8})\s*\t(\S+)(?:\t(.*))?$")


class Listing:
    """Functions and instructions from `llvm-objdump -d` text, for Mach-O arm64 and ELF x86-64 output."""

    def __init__(self, text: str) -> None:
        self.format = ""
        self.arch = ""
        self.functions: dict[str, Function] = {}
        current: Function | None = None
        for raw in text.splitlines():
            header = HEADER_RE.match(raw)
            if header and not self.format:
                self.format = header.group(2)
                self.arch = header.group(3) or ("x86_64" if "x86-64" in header.group(2) else "")
                continue
            start = FUNCTION_RE.match(raw)
            if start:
                symbol = start.group(2)
                if symbol.startswith("__") and self.format.startswith("mach-o"):
                    current = None
                    continue
                name = symbol[1:] if self.format.startswith("mach-o") and symbol.startswith("_") else symbol
                current = Function(symbol, name, int(start.group(1), 16))
                self.functions[name] = current
                continue
            instruction = INSTRUCTION_RE.match(raw)
            if instruction and current is not None:
                operands = (instruction.group(4) or "").split(";")[0].strip()
                current.lines.append(Line(int(instruction.group(1), 16), instruction.group(2).strip(), instruction.group(3), operands))
        if not self.functions:
            raise HarnessError("no functions found in the listing")

    def function(self, name: str) -> Function:
        if name not in self.functions:
            raise HarnessError(f"no function named {name} in the listing")
        return self.functions[name]

    def function_containing(self, address: int) -> Function | None:
        for function in self.functions.values():
            if function.start <= address < function.end:
                return function
        return None

    def call_counts(self, caller: str) -> dict[str, int]:
        """Calls into listed functions by name. A target outside every listed function is a stub or an import, counted as external."""
        counts: dict[str, int] = {}
        for line in self.function(caller).lines:
            if line.mnemonic not in CALL_MNEMONICS or line.target is None:
                continue
            callee = self.function_containing(line.target)
            name = callee.name if callee is not None else "external"
            counts[name] = counts.get(name, 0) + 1
        return counts


def load_listing(name: str) -> Listing:
    return Listing((FIXTURES / name).read_text())


DIE_RE = re.compile(r"^(0x[0-9a-f]+):\s+(DW_TAG_\w+)")
ATTRIBUTE_RE = re.compile(r"^\s+(DW_AT_\w+)\s+\((.*)\)\s*$")


def parse_dies(text: str) -> list[tuple[str, dict[str, str]]]:
    dies: list[tuple[str, dict[str, str]]] = []
    for raw in text.splitlines():
        die = DIE_RE.match(raw)
        if die:
            dies.append((die.group(2), {}))
            continue
        attribute = ATTRIBUTE_RE.match(raw)
        if attribute and dies:
            dies[-1][1][attribute.group(1)] = attribute.group(2)
    return dies


def struct_layout(dwarf_text: str, name: str) -> dict[str, Any]:
    """DW_TAG_structure_type with DW_AT_byte_size, then one DW_TAG_member per field with DW_AT_data_member_location (DWARF 5, 5.7.6)."""
    dies = parse_dies(dwarf_text)
    for position, (tag, attributes) in enumerate(dies):
        if tag != "DW_TAG_structure_type" or attributes.get("DW_AT_name") != f'"{name}"':
            continue
        members: dict[str, dict[str, Any]] = {}
        for member_tag, member in dies[position + 1 :]:
            if member_tag != "DW_TAG_member":
                break
            type_text = member.get("DW_AT_type", "")
            type_name = type_text.split('"')[1] if '"' in type_text else type_text
            members[member["DW_AT_name"].strip('"')] = {"offset": int(member["DW_AT_data_member_location"], 16), "type": type_name}
        return {"name": name, "size": int(attributes["DW_AT_byte_size"], 16), "members": members}
    raise HarnessError(f"no structure named {name} in the DWARF dump")


def count_tags(dwarf_text: str, tag: str) -> int:
    return sum(1 for die_tag, _attributes in parse_dies(dwarf_text) if die_tag == tag)


def subprogram_names(dwarf_text: str) -> list[str]:
    """Defined subprograms only. A DW_TAG_subprogram with DW_AT_declaration is a prototype of an external function."""
    return [a["DW_AT_name"].strip('"') for t, a in parse_dies(dwarf_text) if t == "DW_TAG_subprogram" and "DW_AT_name" in a and "DW_AT_declaration" not in a]


def lift_condition(function: Function, branch: Branch, value_name: str) -> tuple[str, Callable[[int], bool]]:
    """The lesson 34 lift of one conditional branch: when is it taken, as a predicate on the compared value."""
    operands = [part.strip() for part in branch.operands.split(",")]
    if branch.mnemonic in ("tbz", "tbnz"):
        bit = int(operands[1].lstrip("#"), 0)
        want = 0 if branch.mnemonic == "tbz" else 1
        if bit == 31:
            text = f"{value_name} >= 0" if want == 0 else f"{value_name} < 0"
            return text, (lambda value: value >= 0) if want == 0 else (lambda value: value < 0)
        return f"bit {bit} of {value_name} is {want}", lambda value: ((value >> bit) & 1) == want
    if branch.mnemonic in ("cbz", "cbnz"):
        if branch.mnemonic == "cbz":
            return f"{value_name} == 0", lambda value: value == 0
        return f"{value_name} != 0", lambda value: value != 0
    condition = branch.mnemonic[2:] if branch.mnemonic.startswith("b.") else branch.mnemonic[1:]
    compare = function.line_before(branch.address)
    if compare is None or compare.mnemonic.split("l")[0] not in ("subs", "cmp", "cmpl", "cmpq", "cmp"):
        raise HarnessError(f"no compare before the branch at 0x{branch.address:x}")
    immediates = [token for token in compare.operands.replace(",", " ").split() if token[:1] in "#$"]
    if not immediates:
        raise HarnessError(f"the compare at 0x{compare.address:x} has no immediate")
    constant = int(immediates[0].lstrip("#$"), 0)
    tests: dict[str, tuple[str, Callable[[int], bool]]] = {
        "le": ("<=", lambda value: value <= constant),
        "lt": ("<", lambda value: value < constant),
        "ge": (">=", lambda value: value >= constant),
        "gt": (">", lambda value: value > constant),
        "eq": ("==", lambda value: value == constant),
        "ne": ("!=", lambda value: value != constant),
        "e": ("==", lambda value: value == constant),
        "g": (">", lambda value: value > constant),
        "l": ("<", lambda value: value < constant),
    }
    if condition not in tests:
        raise HarnessError(f"condition {condition} is not in the subset")
    symbol, predicate = tests[condition]
    return f"{value_name} {symbol} {constant}", predicate


@dataclass(frozen=True)
class Plan:
    """The fixed command list one lldb session runs. The run decides how many of the continues are used."""

    variant: str
    binary: str
    listing: Listing
    functions: tuple[str, ...] = FUNCTIONS
    edge_function: str = EDGE_FUNCTION
    watch: str | None = WATCH_EXPRESSION
    continues: int = CONTINUE_BUDGET

    @property
    def arch(self) -> str:
        return self.listing.arch

    def hook_registers(self) -> tuple[str, ...]:
        return HOOK_REGISTERS[self.arch]

    def branches(self) -> list[Branch]:
        return self.listing.function(self.edge_function).conditional_branches(self.arch)

    def commands(self) -> list[str]:
        commands = [f"breakpoint set -n {name}" for name in self.functions]
        for branch in self.branches():
            commands.append(f"breakpoint set -a 0x{branch.target:x} -s {self.binary}")
            commands.append(f"breakpoint set -a 0x{branch.fallthrough:x} -s {self.binary}")
        registers = self.hook_registers()
        commands.append(
            f'target stop-hook add -o "register read {" ".join(registers)}" -o "memory read -s4 -fx -c{MEMORY_WORDS} ${registers[0]}" -o "frame variable -P 1"'
        )
        commands.append("run")
        if self.watch:
            commands.append(f"watchpoint set variable {self.watch}")
            commands.append("watchpoint list")
        commands.extend(["continue"] * self.continues)
        commands.extend(["breakpoint list", "watchpoint list -v"])
        return commands

    def session_name(self) -> str:
        return f"session-{self.variant}.lldb"

    def lldb_command(self) -> list[str]:
        return ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", self.session_name(), f"./{self.binary}"]


def make_plan(variant: str, listing: Listing | None = None) -> Plan:
    listing = listing or load_listing(f"account-{variant}.objdump.txt")
    return Plan(variant, f"account-{variant}", listing)


@dataclass
class Variable:
    type: str
    name: str
    value: str
    fields: dict[str, str] = field(default_factory=dict)

    def field_int(self, name: str) -> int:
        return int(self.fields[name].split()[0], 0)

    def field_char(self, name: str) -> str:
        return self.fields[name].strip("'")

    def field_float(self, name: str) -> float:
        return float(self.fields[name])

    def field_pointer(self, name: str) -> int:
        return int(self.fields[name].split()[0], 16)

    def field_string(self, name: str) -> str | None:
        parts = self.fields[name].split(" ", 1)
        return parts[1].strip('"') if len(parts) == 2 else None

    @property
    def pointer(self) -> int | None:
        token = self.value.split()[0] if self.value else ""
        return int(token, 16) if token.startswith("0x") else None


@dataclass
class Stop:
    index: int
    pc: int
    function: str
    arguments: dict[str, str]
    file: str | None
    line: int | None
    reason: str
    registers: dict[str, int] = field(default_factory=dict)
    memory_base: int | None = None
    memory: list[int] = field(default_factory=list)
    variables: dict[str, Variable] = field(default_factory=dict)
    watch_hit: tuple[int, int] | None = None

    @property
    def breakpoint(self) -> int | None:
        match = re.match(r"breakpoint (\d+)\.\d+", self.reason)
        return int(match.group(1)) if match else None

    @property
    def is_watchpoint(self) -> bool:
        return self.reason.startswith("watchpoint")

    def word(self, offset: int) -> int | None:
        index = offset // 4
        return self.memory[index] if 0 <= index < len(self.memory) else None

    def struct_pointer(self) -> Variable | None:
        for variable in self.variables.values():
            if variable.fields and variable.pointer is not None:
                return variable
        return None


@dataclass
class BreakpointInfo:
    number: int
    spec: str
    address: int | None = None
    where: str | None = None
    line: int | None = None
    resolved: bool = False
    hits: int = 0


@dataclass
class WatchpointInfo:
    number: int
    address: int
    size: int
    kind: str
    hits: list[tuple[int, int]] = field(default_factory=list)
    hit_count: int | None = None


@dataclass
class Exchange:
    command: str
    lines: list[str]


@dataclass
class Transcript:
    header: dict[str, str]
    exchanges: list[Exchange]
    executable: str | None = None
    arch: str | None = None
    breakpoints: dict[int, BreakpointInfo] = field(default_factory=dict)
    watchpoints: dict[int, WatchpointInfo] = field(default_factory=dict)
    hardware_watchpoints: int | None = None
    stops: list[Stop] = field(default_factory=list)
    backtrace: list[tuple[int, int, str]] = field(default_factory=list)
    variables: dict[str, Variable] = field(default_factory=dict)
    memory: dict[int, list[int]] = field(default_factory=dict)
    script_values: list[Any] = field(default_factory=list)
    program_output: list[str] = field(default_factory=list)
    errors: list[tuple[str, str]] = field(default_factory=list)
    launched: int | None = None
    exit_status: int | None = None

    def stops_in(self, function: str) -> list[Stop]:
        return [stop for stop in self.stops if stop.function == function]

    def entry_stops(self) -> list[Stop]:
        return [stop for stop in self.stops if stop.breakpoint is not None and self.breakpoints[stop.breakpoint].spec.startswith("name")]

    def hits(self) -> dict[str, int]:
        return {info.spec.split("=", 1)[1]: info.hits for info in self.breakpoints.values()}


TARGET_RE = re.compile(r"^Current executable set to '(.+)' \((\w+)\)\.$")
BREAKPOINT_SET_RE = re.compile(r"^Breakpoint (\d+): (?:where = (\S+?)`(.+?) at (\S+?):(\d+)(?::\d+)?, )?address = 0x([0-9a-f]+)$")
BREAKPOINT_PENDING_RE = re.compile(r"^Breakpoint (\d+): no locations \(pending\)")
BREAKPOINT_LIST_RE = re.compile(r"^(\d+): (name = '(\w+)'|address = (\S+)), locations = (\d+)")
LOCATION_RE = re.compile(r"^\s+(\d+)\.(\d+): .*?address = 0x([0-9a-f]+), (resolved|unresolved), hit count = (\d+)")
WATCHPOINT_CREATED_RE = re.compile(r"^Watchpoint created: Watchpoint (\d+): addr = 0x([0-9a-f]+) size = (\d+) state = \w+ type = (\w)")
WATCHPOINT_HIT_RE = re.compile(r"^Watchpoint (\d+) hit:")
HARDWARE_RE = re.compile(r"^Number of supported hardware watchpoints: (\d+)")
HIT_COUNT_RE = re.compile(r"^\s+hit_count = (\d+)")
VALUE_RE = re.compile(r"^\s*(old|new) value: (-?\d+)")
PROCESS_RE = re.compile(r"^Process (\d+) (launched|stopped|resuming|exited with status = (\d+))")
THREAD_RE = re.compile(r"^\s*\*?\s*thread #(\d+),(?: queue = '[^']*',)? stop reason = (.+)$")
FRAME_RE = re.compile(r"^\s*\*?\s*frame #(\d+): 0x([0-9a-f]+) ([^`]+)`([\w.]+)(?:\((.*)\))?(?: \+ \d+)?(?: at ([^:\s]+):(\d+)(?::\d+)?)?\s*$")
REGISTER_RE = re.compile(r"^\s+(\w+) = 0x([0-9a-f]+)(?:\s{2,}(.*))?$")
MEMORY_RE = re.compile(r"^0x([0-9a-f]+):((?:\s+0x[0-9a-f]+)+)$")
VARIABLE_RE = re.compile(r"^\((.+?)\) (\S+) = (.*?)(\s\{)?$")
FIELD_RE = re.compile(r"^\s+(\w+) = (.*)$")
SOURCE_RE = re.compile(r"^(?:->|\s+)\s*\d+\s*\t|^\s*\t\s*\^|^\s+\^\s*$")
ERROR_RE = re.compile(r"^error: (.*)$")
IGNORED_RE = re.compile(r"^(Target \d+: \(.*\) stopped\.|Executing commands in '.*'\.|Stop hook #\d+ added\.|Current watchpoints:|Current breakpoints:|Core file '.*' was loaded\.|\s*watchpoint spec = .*|\s*declare @ .*|\s*watchpoint resources:|\s*#\d+: addr = .*|\s+ignore_count = .*|\s*Options: .*|\s*Breakpoint commands:|\s*\d+\.\d+: where = .*|\s*hit_count = .*)$")


def split_exchanges(text: str) -> tuple[dict[str, str], list[Exchange]]:
    header: dict[str, str] = {}
    exchanges: list[Exchange] = [Exchange("", [])]
    for raw in text.splitlines():
        if raw.startswith("# ") and len(exchanges) == 1 and not exchanges[0].lines:
            key, _sep, value = raw[2:].partition(": ")
            header[key] = value
            continue
        if raw.startswith("(lldb) "):
            exchanges.append(Exchange(raw[len("(lldb) ") :].strip(), []))
            continue
        exchanges[-1].lines.append(raw)
    return header, exchanges


def parse_fields(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for part in re.findall(r"(\w+) = ('[^']*'|\"[^\"]*\"|0x[0-9a-f]+(?: \"[^\"]*\")?|-?[\d.]+)", text):
        fields[part[0]] = part[1]
    return fields


def parse_transcript(text: str, leader: str = "x0") -> Transcript:
    """Walk the batch output in order. Hook output precedes the `Process stopped` block of its stop,
    so a chunk opened by the leader register is attached to the next frame #0 line."""
    header, exchanges = split_exchanges(text)
    transcript = Transcript(header, exchanges)
    pending_registers: dict[str, int] = {}
    pending_memory: dict[int, list[int]] = {}
    pending_variables: dict[str, Variable] = {}
    pending_watch: tuple[int, int] | None = None
    watch_values: dict[str, int] = {}
    awaiting_stop = False
    reason = ""
    block: Variable | None = None
    for exchange in exchanges:
        for raw in exchange.lines:
            if block is not None:
                if raw.strip() == "}":
                    block = None
                    continue
                fld = FIELD_RE.match(raw)
                if fld:
                    block.fields[fld.group(1)] = fld.group(2).strip()
                continue
            if not raw.strip():
                continue
            match = TARGET_RE.match(raw)
            if match:
                transcript.executable, transcript.arch = match.group(1), match.group(2)
                continue
            match = BREAKPOINT_SET_RE.match(raw)
            if match:
                number = int(match.group(1))
                spec = f"name={match.group(3).split(' + ')[0]}" if match.group(3) and exchange.command.startswith("breakpoint set -n") else f"address=0x{match.group(6)}"
                transcript.breakpoints[number] = BreakpointInfo(number, spec, int(match.group(6), 16), match.group(3), int(match.group(5)) if match.group(5) else None, True)
                continue
            match = BREAKPOINT_PENDING_RE.match(raw)
            if match:
                number = int(match.group(1))
                transcript.breakpoints[number] = BreakpointInfo(number, f"name={exchange.command.split()[-1]}")
                continue
            match = LOCATION_RE.match(raw)
            if match:
                info = transcript.breakpoints.get(int(match.group(1)))
                if info is not None:
                    info.address = int(match.group(3), 16)
                    info.resolved = match.group(4) == "resolved"
                    info.hits = int(match.group(5))
                continue
            if BREAKPOINT_LIST_RE.match(raw):
                continue
            match = WATCHPOINT_CREATED_RE.match(raw)
            if match:
                number = int(match.group(1))
                transcript.watchpoints[number] = WatchpointInfo(number, int(match.group(2), 16), int(match.group(3)), match.group(4))
                continue
            match = HARDWARE_RE.match(raw)
            if match:
                transcript.hardware_watchpoints = int(match.group(1))
                continue
            match = HIT_COUNT_RE.match(raw)
            if match and transcript.watchpoints:
                transcript.watchpoints[max(transcript.watchpoints)].hit_count = int(match.group(1))
                continue
            if WATCHPOINT_HIT_RE.match(raw):
                watch_values = {}
                continue
            match = VALUE_RE.match(raw)
            if match:
                watch_values[match.group(1)] = int(match.group(2))
                if "old" in watch_values and "new" in watch_values:
                    pending_watch = (watch_values["old"], watch_values["new"])
                    if transcript.watchpoints and exchange.command.startswith(("run", "continue")):
                        transcript.watchpoints[max(transcript.watchpoints)].hits.append(pending_watch)
                    watch_values = {}
                continue
            match = PROCESS_RE.match(raw)
            if match:
                if match.group(2) == "launched":
                    transcript.launched = int(match.group(1))
                elif match.group(2) == "stopped":
                    awaiting_stop = True
                elif match.group(2).startswith("exited"):
                    transcript.exit_status = int(match.group(3))
                continue
            match = THREAD_RE.match(raw)
            if match:
                reason = match.group(2).strip()
                continue
            match = FRAME_RE.match(raw)
            if match:
                depth, pc, function_name = int(match.group(1)), int(match.group(2), 16), match.group(4)
                transcript.backtrace.append((depth, pc, function_name))
                if depth == 0 and awaiting_stop:
                    arguments = dict(part.split("=", 1) for part in (match.group(5) or "").split(", ") if "=" in part)
                    stop = Stop(len(transcript.stops), pc, function_name, arguments, match.group(6), int(match.group(7)) if match.group(7) else None, reason)
                    stop.registers = pending_registers
                    if pending_memory:
                        base = min(pending_memory)
                        stop.memory_base = base
                        stop.memory = [word for address in sorted(pending_memory) for word in pending_memory[address]]
                    stop.variables = pending_variables
                    stop.watch_hit = pending_watch
                    transcript.stops.append(stop)
                    pending_registers, pending_memory, pending_variables, pending_watch = {}, {}, {}, None
                    awaiting_stop = False
                continue
            match = REGISTER_RE.match(raw)
            if match:
                if match.group(1) == leader:
                    pending_registers, pending_memory, pending_variables = {}, {}, {}
                pending_registers[match.group(1)] = int(match.group(2), 16)
                continue
            match = MEMORY_RE.match(raw)
            if match:
                words = [int(token, 16) for token in match.group(2).split()]
                pending_memory[int(match.group(1), 16)] = words
                transcript.memory[int(match.group(1), 16)] = words
                continue
            match = VARIABLE_RE.match(raw)
            if match and not raw.startswith("(lldb)"):
                variable = Variable(match.group(1), match.group(2), match.group(3).strip())
                if match.group(4):
                    block = variable
                elif variable.value.startswith("(") and " = " in variable.value:
                    variable.fields = parse_fields(variable.value)
                pending_variables[variable.name] = variable
                transcript.variables[variable.name] = variable
                continue
            match = ERROR_RE.match(raw)
            if match:
                transcript.errors.append((exchange.command, match.group(1)))
                continue
            if exchange.command.startswith("script"):
                try:
                    transcript.script_values.append(ast.literal_eval(raw.strip()))
                except (ValueError, SyntaxError):
                    transcript.script_values.append(raw.strip())
                continue
            if SOURCE_RE.match(raw) or IGNORED_RE.match(raw) or raw.startswith("Saving ") or raw.startswith("Modified-memory") or raw.startswith("not show") or raw.startswith("those binaries") or raw.startswith("in this corefile"):
                continue
            if exchange.command.startswith(("run", "continue", "process launch")):
                transcript.program_output.append(raw)
    return transcript


def load_transcript(name: str, leader: str = "x0") -> Transcript:
    return parse_transcript((FIXTURES / name).read_text(), leader)


@dataclass(frozen=True)
class Claim:
    id: str
    kind: str
    statement: str
    source: str
    function: str | None = None


@dataclass
class Evidence:
    claim: str
    verdict: str
    stop: int | None
    observation: str

    def to_dict(self) -> dict[str, Any]:
        return {"claim": self.claim, "verdict": self.verdict, "stop": self.stop, "observation": self.observation}


def claims_for(plan: Plan, layout: dict[str, Any]) -> list[Claim]:
    registers = ARGUMENT_REGISTERS[plan.arch]
    abi = "AAPCS64 section 6.4.2" if plan.arch == "arm64" else "x86-64 psABI section 3.2.3"
    offsets = ", ".join(f"{name} at {member['offset']}" for name, member in layout["members"].items())
    claims = [
        Claim("arg-registers", "argument-register", f"At every function entry the first arguments arrive in {registers[0]} and {registers[1]} ({abi}).", "lesson 32 and the ABI"),
        Claim("field-offsets", "field-offset", f"struct {layout['name']} is {layout['size']} bytes with {offsets} (DW_AT_data_member_location).", "lesson 41 and the DWARF dump"),
    ]
    function = plan.listing.function(plan.edge_function)
    for position, branch in enumerate(plan.branches(), start=1):
        text, _predicate = lift_condition(function, branch, f"{plan.watch or 'a->balance'}")
        claims.append(
            Claim(
                f"branch-{position}",
                "branch-taken",
                f"In {plan.edge_function} the branch {branch.mnemonic} {branch.operands} at 0x{branch.address:x} goes to 0x{branch.target:x} when {text}, otherwise to 0x{branch.fallthrough:x}.",
                "lesson 33 edges and the lesson 34 lift",
                plan.edge_function,
            )
        )
    calls = ", ".join(f"{name} {count} time{'s' if count != 1 else ''}" for name, count in EXPECTED_CALLS.items())
    claims.append(Claim("calls", "call-edge", f"main calls {calls}, as the source says and the symbol table lists.", "source text and nm", "main"))
    claims.append(Claim("store-once", "store", f"{WATCH_FUNCTION} writes {plan.watch} exactly once and the new value is the old value plus by.", "lesson 34 pseudocode", WATCH_FUNCTION))
    claims.append(Claim("stride", "struct-stride", f"sizeof(struct {layout['name']}) is {layout['size']}, so list[i].balance sits at list + {layout['size']}*i + {layout['members']['balance']['offset']}.", "lesson 41 and the psABI aggregate rule", "sum_balances"))
    claims.append(Claim("output", "behaviour", "The program prints " + " / ".join(EXPECTED_OUTPUT[2:]) + ".", "source arithmetic"))
    return claims


def _check_arguments(plan: Plan, stop: Stop) -> Evidence:
    registers = ARGUMENT_REGISTERS[plan.arch]
    parts: list[str] = []
    verdict = "confirmed"
    for position, (name, text) in enumerate(stop.arguments.items()):
        register = registers[position]
        expected = int(text, 0)
        actual = stop.registers.get(register)
        if actual is None:
            return Evidence("arg-registers", "not-observed", stop.index, f"{register} was not read at this stop")
        if actual != expected:
            verdict = "refuted"
        parts.append(f"{register} = 0x{actual:x} and {name} = {text}")
    return Evidence("arg-registers", verdict, stop.index, f"{stop.function}: " + ", ".join(parts))


def _check_layout(layout: dict[str, Any], stop: Stop) -> Evidence | None:
    pointer = stop.struct_pointer()
    if pointer is None or pointer.pointer is None or stop.memory_base != pointer.pointer:
        return None
    members = layout["members"]
    checks: list[tuple[str, Any, Any]] = []
    word = stop.word
    kind_word = word(members["kind"]["offset"])
    balance_word = word(members["balance"]["offset"])
    code_word = word(members["code"]["offset"])
    rate_low, rate_high = word(members["rate"]["offset"]), word(members["rate"]["offset"] + 4)
    label_low, label_high = word(members["label"]["offset"]), word(members["label"]["offset"] + 4)
    if None in (kind_word, balance_word, code_word, rate_low, rate_high, label_low, label_high):
        return Evidence("field-offsets", "not-observed", stop.index, "fewer memory words than the struct needs")
    checks.append(("kind", chr(kind_word & 0xFF), pointer.field_char("kind")))
    checks.append(("balance", struct.unpack("<i", struct.pack("<I", balance_word))[0], pointer.field_int("balance")))
    checks.append(("code", struct.unpack("<h", struct.pack("<H", code_word & 0xFFFF))[0], pointer.field_int("code")))
    checks.append(("rate", struct.unpack("<d", struct.pack("<II", rate_low, rate_high))[0], pointer.field_float("rate")))
    checks.append(("label", hex((label_high << 32) | label_low), hex(pointer.field_pointer("label"))))
    mismatches = [name for name, got, expected in checks if got != expected]
    words = " ".join(f"{w:08x}" for w in stop.memory[: layout["size"] // 4])
    observation = f"{stop.function}: bytes at 0x{pointer.pointer:x} = {words}; " + ", ".join(f"{name} {got!r}" if isinstance(got, str) and not got.startswith("0x") else f"{name} {got}" for name, got, _expected in checks)
    return Evidence("field-offsets", "refuted" if mismatches else "confirmed", stop.index, observation)


def _activations(transcript: Transcript, function: str) -> list[list[Stop]]:
    groups: list[list[Stop]] = []
    for stop in transcript.stops_in(function):
        if stop.breakpoint is not None and transcript.breakpoints[stop.breakpoint].spec.startswith("name"):
            groups.append([stop])
        elif groups:
            groups[-1].append(stop)
    return groups


def _check_branches(plan: Plan, transcript: Transcript) -> list[Evidence]:
    function = plan.listing.function(plan.edge_function)
    evidence: list[Evidence] = []
    branches = plan.branches()
    for activation in _activations(transcript, plan.edge_function):
        entry = activation[0]
        pointer = entry.struct_pointer()
        if pointer is None:
            continue
        value = pointer.field_int("balance")
        for stop in activation[1:]:
            for position, branch in enumerate(branches, start=1):
                if stop.pc not in (branch.target, branch.fallthrough):
                    continue
                text, predicate = lift_condition(function, branch, "a->balance")
                expected = branch.target if predicate(value) else branch.fallthrough
                edge = "taken" if stop.pc == branch.target else "fallthrough"
                verdict = "confirmed" if stop.pc == expected else "refuted"
                evidence.append(Evidence(f"branch-{position}", verdict, stop.index, f"a->balance = {value}, {text} is {predicate(value)}, next stop 0x{stop.pc:x} ({edge}), expected 0x{expected:x}"))
    return evidence


def _check_calls(transcript: Transcript) -> Evidence:
    counts = {name: len([s for s in transcript.entry_stops() if s.function == name]) for name in EXPECTED_CALLS}
    hits = transcript.hits()
    text = ", ".join(f"{name} {counts[name]} (hit count {hits.get(name, 0)})" for name in EXPECTED_CALLS)
    if transcript.exit_status is None:
        return Evidence("calls", "not-observed", None, f"the run did not finish: entry stops {text}")
    if counts == EXPECTED_CALLS:
        return Evidence("calls", "confirmed", None, f"entry stops {text}")
    return Evidence("calls", "refuted", None, f"after a full run with exit status {transcript.exit_status}: entry stops {text}")


def _check_store(transcript: Transcript) -> Evidence:
    bump = transcript.stops_in(WATCH_FUNCTION)
    if not bump:
        failed = [message for command, message in transcript.errors if command.startswith("watchpoint set")]
        detail = f"; watchpoint set failed: {failed[0]}" if failed else ""
        return Evidence("store-once", "not-observed", None, f"no stop in {WATCH_FUNCTION}, so the watchpoint was never set{detail}")
    hits = [stop for stop in bump if stop.is_watchpoint and stop.watch_hit]
    if not hits:
        return Evidence("store-once", "not-observed", bump[0].index, "the watchpoint never reported a hit")
    old, new = hits[0].watch_hit or (0, 0)
    by = int(hits[0].arguments.get("by", "0"), 0)
    total = sum(len(w.hits) for w in transcript.watchpoints.values())
    verdict = "confirmed" if total == 1 and new - old == by else "refuted"
    return Evidence("store-once", verdict, hits[0].index, f"watchpoint hit {total} time(s): old {old}, new {new}, by {by}, pc 0x{hits[0].pc:x}")


def _check_stride(layout: dict[str, Any], transcript: Transcript) -> Evidence:
    stops = [s for s in transcript.stops_in("sum_balances") if s.struct_pointer() is not None]
    if not stops:
        return Evidence("stride", "not-observed", None, "no stop in sum_balances")
    stop = stops[0]
    pointer = stop.struct_pointer()
    assert pointer is not None and pointer.pointer is not None
    count = int(stop.arguments.get("count", "0"), 0)
    stride, offset = layout["size"], layout["members"]["balance"]["offset"]
    by_address = {s.struct_pointer().pointer: s.struct_pointer().field_int("balance") for s in transcript.stops_in(EDGE_FUNCTION) if s.struct_pointer() and s.struct_pointer().pointer is not None}
    seen: list[str] = []
    verdict = "confirmed"
    total = 0
    for index in range(count):
        word = stop.word(stride * index + offset)
        if word is None:
            return Evidence("stride", "not-observed", stop.index, f"fewer than {count} rows were read")
        value = struct.unpack("<i", struct.pack("<I", word))[0]
        total += value
        row = pointer.pointer + stride * index
        expected = by_address.get(row)
        if expected is not None and expected != value:
            verdict = "refuted"
        seen.append(f"row {index} at 0x{row:x} balance {value}" + (f" (classify saw {expected})" if expected is not None else ""))
    printed = next((line for line in transcript.program_output if line.startswith("sum ")), None)
    if printed is not None and int(printed.split()[1]) != total:
        verdict = "refuted"
    return Evidence("stride", verdict, stop.index, "; ".join(seen) + f"; total {total}, program printed {printed!r}")


def _check_output(transcript: Transcript) -> Evidence:
    missing = [line for line in EXPECTED_OUTPUT[2:] if line not in transcript.program_output]
    if transcript.exit_status is None:
        return Evidence("output", "not-observed", None, "the process did not exit")
    verdict = "refuted" if missing else "confirmed"
    return Evidence("output", verdict, None, f"stdout {transcript.program_output}, exit status {transcript.exit_status}")


def evaluate(plan: Plan, transcript: Transcript, layout: dict[str, Any]) -> list[Evidence]:
    """Every claim gets at least one record. A claim no stop could test is not-observed, with the reason."""
    evidence: list[Evidence] = []
    for stop in transcript.entry_stops():
        evidence.append(_check_arguments(plan, stop))
    for stop in transcript.stops:
        record = _check_layout(layout, stop)
        if record is not None:
            evidence.append(record)
    evidence.extend(_check_branches(plan, transcript))
    evidence.append(_check_calls(transcript))
    evidence.append(_check_store(transcript))
    evidence.append(_check_stride(layout, transcript))
    evidence.append(_check_output(transcript))
    covered = {record.claim for record in evidence}
    for claim in claims_for(plan, layout):
        if claim.id not in covered:
            hits = transcript.hits()
            reason = f"no stop tested it; breakpoint hit counts {hits}" if hits else "no stop tested it"
            evidence.append(Evidence(claim.id, "not-observed", None, reason))
    return evidence


def rollup(evidence: list[Evidence]) -> dict[str, dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {}
    for record in evidence:
        entry = summary.setdefault(record.claim, {"confirmed": 0, "refuted": 0, "not-observed": 0})
        entry[record.verdict] += 1
    for entry in summary.values():
        if entry["refuted"]:
            entry["verdict"] = "refuted"
        elif entry["confirmed"]:
            entry["verdict"] = "confirmed"
        else:
            entry["verdict"] = "not-observed"
    return summary


def stop_kind(transcript: Transcript, stop: Stop) -> str:
    if stop.is_watchpoint:
        return "watchpoint"
    if stop.breakpoint is not None and transcript.breakpoints[stop.breakpoint].spec.startswith("name"):
        return "entry"
    return "edge"


def variant_report(variant: str) -> dict[str, Any]:
    plan = make_plan(variant)
    transcript = load_transcript(f"session-{variant}.lldb.txt", plan.hook_registers()[0])
    layout = struct_layout((FIXTURES / f"account-{variant}.dwarfdump.txt").read_text(), STRUCT_NAME)
    evidence = evaluate(plan, transcript, layout)
    summary = rollup(evidence)
    claims = claims_for(plan, layout)
    return {
        "binary": plan.binary,
        "arch": transcript.arch,
        "sessionFile": plan.session_name(),
        "commands": len(plan.commands()),
        "breakpoints": {f"{info.number}": {"spec": info.spec, "address": None if info.address is None else f"0x{info.address:x}", "resolved": info.resolved, "hits": info.hits} for info in transcript.breakpoints.values()},
        "hardwareWatchpoints": transcript.hardware_watchpoints,
        "watchpoints": {f"{w.number}": {"address": f"0x{w.address:x}", "size": w.size, "type": w.kind, "hits": w.hits, "hitCount": w.hit_count} for w in transcript.watchpoints.values()},
        "stops": [
            {
                "index": stop.index,
                "pc": f"0x{stop.pc:x}",
                "function": stop.function,
                "line": stop.line,
                "reason": stop.reason,
                "kind": stop_kind(transcript, stop),
                "registers": {name: f"0x{value:x}" for name, value in stop.registers.items() if name != plan.hook_registers()[-1]},
                "arguments": stop.arguments,
                "watchHit": stop.watch_hit,
            }
            for stop in transcript.stops
        ],
        "exitStatus": transcript.exit_status,
        "programOutput": transcript.program_output,
        "errors": [f"{command}: {message}" for command, message in transcript.errors],
        "claims": [{"id": claim.id, "kind": claim.kind, "statement": claim.statement, "source": claim.source, **summary.get(claim.id, {})} for claim in claims],
        "evidence": [record.to_dict() for record in evidence],
    }


def core_report() -> dict[str, Any]:
    save = load_transcript("core-save-O0.lldb.txt")
    load = load_transcript("core-load-O0.lldb.txt")
    saving = next((line for exchange in save.exchanges for line in exchange.lines if line.startswith("Saving ")), None)
    label = load.variables.get("a->label")
    deref = load.variables.get("*a")
    return {
        "savedAt": None if not save.stops else {"function": save.stops[0].function, "pc": f"0x{save.stops[0].pc:x}"},
        "saving": saving,
        "backtrace": [{"frame": depth, "pc": f"0x{pc:x}", "function": name} for depth, pc, name in load.backtrace],
        "fieldsFromCore": None if deref is None else deref.fields,
        "labelPointer": None if label is None else label.value,
        "labelString": None if label is None else label.field_string("label") if label.fields else label.value.split(" ", 1)[1].strip('"') if " " in label.value else None,
        "memory": {f"0x{address:x}": [f"0x{w:08x}" for w in words] for address, words in load.memory.items()},
    }


def types_report() -> dict[str, Any]:
    transcript = load_transcript("types-O0.lldb.txt")
    values = transcript.script_values
    return {
        "python": next((v for v in values if isinstance(v, str) and v[:1].isdigit()), None),
        "fields": next((v for v in values if isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 3), None),
        "size": next((v for v in values if isinstance(v, int)), None),
        "functions": next((v for v in values if isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 4), None),
    }


def sandbox_report() -> dict[str, Any]:
    transcript = load_transcript("sandbox-O0.lldb.txt")
    return {"stops": len(transcript.stops), "errors": [message for _command, message in transcript.errors][:3], "exitStatus": transcript.exit_status}


def tools_present() -> dict[str, bool]:
    return {name: shutil.which(name) is not None for name in TOOLS}


def demo() -> dict[str, Any]:
    report: dict[str, Any] = {"program": PROGRAM, "variants": {variant: variant_report(variant) for variant in VARIANTS}}
    report["core"] = core_report()
    report["types"] = types_report()
    report["sandbox"] = sandbox_report()
    report["commandMap"] = len(COMMAND_MAP)
    report["hardwareLimits"] = HARDWARE_LIMITS
    report["tools"] = tools_present()
    report["absentTools"] = sorted(name for name, present in report["tools"].items() if not present)
    return report


def figure_data() -> dict[str, Any]:
    layout = struct_layout((FIXTURES / "account-O0.dwarfdump.txt").read_text(), STRUCT_NAME)
    variants: dict[str, Any] = {}
    claim_order: list[str] = []
    for variant in VARIANTS:
        plan = make_plan(variant)
        transcript = load_transcript(f"session-{variant}.lldb.txt", plan.hook_registers()[0])
        evidence = evaluate(plan, transcript, layout)
        summary = rollup(evidence)
        claims = claims_for(plan, layout)
        claim_order.extend(claim.id for claim in claims if claim.id not in claim_order)
        by_stop: dict[int, dict[str, str]] = {}
        for record in evidence:
            if record.stop is not None:
                by_stop.setdefault(record.stop, {})[record.claim] = record.verdict
        stops = []
        for stop in transcript.stops:
            pointer = stop.struct_pointer()
            stops.append(
                {
                    "i": stop.index,
                    "pc": f"0x{stop.pc:x}",
                    "fn": stop.function,
                    "line": stop.line,
                    "kind": stop_kind(transcript, stop),
                    "reason": stop.reason,
                    "regs": {name: f"0x{value:x}" for name, value in stop.registers.items() if name in plan.hook_registers()[:2]},
                    "words": [f"{w:08x}" for w in stop.memory[:8]],
                    "args": stop.arguments,
                    "balance": None if pointer is None else pointer.field_int("balance"),
                    "watch": stop.watch_hit,
                    "claims": by_stop.get(stop.index, {}),
                }
            )
        variants[variant] = {
            "binary": plan.binary,
            "stops": stops,
            "exit": transcript.exit_status,
            "hits": [{"bp": info.number, "spec": info.spec, "hits": info.hits} for info in transcript.breakpoints.values()],
            "claims": [{"id": claim.id, "kind": claim.kind, "statement": claim.statement, **summary.get(claim.id, {})} for claim in claims],
            "runLevel": [record.to_dict() for record in evidence if record.stop is None],
            "output": transcript.program_output,
        }
    offsets = {name: member["offset"] for name, member in layout["members"].items()}
    return {"program": PROGRAM, "struct": {"name": layout["name"], "size": layout["size"], "offsets": offsets}, "claimOrder": claim_order, "variants": variants}


def write_transcript(path: Path, command: list[str], output: str, cwd: Path) -> None:
    version = subprocess.run(["lldb", "--version"], capture_output=True, text=True, check=False).stdout.strip().splitlines()
    header = [
        "# lesson 42 capture",
        f"# command: {' '.join(command)}",
        f"# cwd: {cwd.name}",
        f"# lldb: {version[0] if version else 'unknown'}",
        f"# date: {dt.date.today().isoformat()}",
    ]
    path.write_text("\n".join(header) + "\n" + output)


def run_lldb(command: list[str], cwd: Path) -> str:
    completed = subprocess.run(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    return completed.stdout


def capture(variants: list[str], directory: Path = FIXTURES) -> list[str]:
    """Write the session file from the plan, run lldb on the committed binary, and store the transcript beside it."""
    if shutil.which("lldb") is None:
        raise HarnessError("lldb is not on PATH")
    written: list[str] = []
    for variant in variants:
        plan = make_plan(variant, Listing((directory / f"account-{variant}.objdump.txt").read_text()))
        session = directory / plan.session_name()
        session.write_text("\n".join(plan.commands()) + "\n")
        output = run_lldb(plan.lldb_command(), directory)
        write_transcript(directory / f"{plan.session_name()}.txt", plan.lldb_command(), output, directory)
        written.extend([session.name, f"{plan.session_name()}.txt"])
    return written


def capture_extras(directory: Path = FIXTURES) -> list[str]:
    core = "account-O0-stack.core"
    sessions = {
        "core-save-O0.lldb": ([f"breakpoint set -n {WATCH_FUNCTION}", "run", f"process save-core --style stack {core}"], ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", "core-save-O0.lldb", "./account-O0"]),
        "core-load-O0.lldb": (["bt", "frame variable *a", "frame variable a->label", "memory read -s4 -fx -c8 $x0"], ["lldb", "-b", "-c", core, "-o", LLDB_SETTINGS, "-s", "core-load-O0.lldb", "./account-O0"]),
        "types-O0.lldb": (
            [
                "script import sys; print(sys.version.split()[0])",
                f'script print([(f.name, f.byte_offset, f.type.name) for f in lldb.target.FindFirstType("{STRUCT_NAME}").get_fields_array()])',
                f'script print(lldb.target.FindFirstType("{STRUCT_NAME}").size)',
                "script print([(c.function.name, hex(c.function.addr.file_addr), hex(c.function.end_addr.file_addr), c.function.addr.line_entry.line) for n in "
                + repr(tuple(FUNCTIONS))
                + " for c in lldb.target.FindFunctions(n)])",
            ],
            ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", "types-O0.lldb", "./account-O0"],
        ),
    }
    written: list[str] = []
    for name, (commands, command) in sessions.items():
        (directory / name).write_text("\n".join(commands) + "\n")
        output = run_lldb(command, directory)
        write_transcript(directory / f"{name}.txt", command, output, directory)
        written.extend([name, f"{name}.txt"])
    core_path = directory / core
    if core_path.exists():
        core_path.unlink()
    return written


def live(variant: str) -> dict[str, Any]:
    """Compile account.c here, plan from a fresh listing, run lldb, and grade the claims against this machine's run."""
    missing = [tool for tool in ("clang", "lldb") if shutil.which(tool) is None]
    objdump = shutil.which("llvm-objdump") or shutil.which("objdump")
    if objdump is None:
        missing.append("objdump")
    if missing:
        return {"ran": False, "reason": f"missing tools: {', '.join(missing)}"}
    with tempfile.TemporaryDirectory(prefix="lesson42-") as temp:
        directory = Path(temp)
        binary = f"account-{variant}"
        subprocess.run(["clang", "-g", f"-{variant}", "-o", str(directory / binary), str(FIXTURES / PROGRAM)], check=True)
        listing_text = subprocess.run([objdump, "-d", str(directory / binary)], capture_output=True, text=True, check=True).stdout
        (directory / f"{binary}.objdump.txt").write_text(listing_text)
        dwarfdump = shutil.which("dwarfdump")
        dwarf = subprocess.run([dwarfdump, "--debug-info", str(directory / f"{binary}.dSYM")], capture_output=True, text=True, check=False).stdout if dwarfdump else ""
        plan = make_plan(variant, Listing(listing_text))
        (directory / plan.session_name()).write_text("\n".join(plan.commands()) + "\n")
        output = run_lldb(plan.lldb_command(), directory)
        transcript = parse_transcript(output, plan.hook_registers()[0])
        if transcript.launched is None:
            return {"ran": False, "reason": "lldb could not launch the process", "errors": [m for _c, m in transcript.errors][:3]}
        layout = struct_layout(dwarf, STRUCT_NAME) if dwarf else struct_layout((FIXTURES / "account-O0.dwarfdump.txt").read_text(), STRUCT_NAME)
        evidence = evaluate(plan, transcript, layout)
        return {"ran": True, "variant": variant, "stops": len(transcript.stops), "exitStatus": transcript.exit_status, "claims": rollup(evidence), "evidence": [e.to_dict() for e in evidence]}


def command_table() -> str:
    width = max(len(row[0]) for row in COMMAND_MAP)
    lines = [f"{'task':<{width}}  gdb                                 lldb"]
    for task, gdb, lldb, alias in COMMAND_MAP:
        suffix = f"  ({alias})" if alias else ""
        lines.append(f"{task:<{width}}  {gdb:<35} {lldb}{suffix}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    if command == "commands":
        print(command_table())
        return 0
    if command == "tools":
        print(json.dumps(tools_present(), indent=2))
        return 0
    if command == "plan" and len(argv) == 2:
        print("\n".join(make_plan(argv[1]).commands()))
        return 0
    if command == "capture":
        variants = argv[1:] or list(VARIANTS)
        written = capture([v for v in variants if v in VARIANTS])
        if "extras" in variants or not argv[1:]:
            written.extend(capture_extras())
        print("\n".join(written))
        return 0
    if command == "live":
        result = live(argv[1] if len(argv) > 1 else "O0")
        print(json.dumps(result, indent=2))
        return 0 if result["ran"] else 1
    print("usage: main.py [figure-data | commands | tools | plan VARIANT | capture [VARIANT ...] | live [VARIANT]]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
