"""Companion code for docs/en.md: a comparison harness over captured tool outputs, a two-style IR translator,
and the data behind the field-map figure.
Captures live in fixtures/: *.objdump.txt (llvm-objdump -d -r), *.radare2.json, *.rizin.json, *.angr.json,
*.ghidra.json, and ir-lifts.json. fixtures/capture_tools.py made them once and recorded every command and
version in fixtures/captures.json. Nothing here runs an external tool; the harness reads what the tools said.
Run `python3 main.py` for the report or `python3 -m unittest discover -s tests` for the suite.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
FIXTURE_OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"]
TOOLS = ["llvm-objdump", "radare2", "rizin", "angr", "ghidra"]
DESCENT_TOOLS = ["radare2", "rizin", "angr", "ghidra"]
CAPTURE_SUFFIX = {
    "llvm-objdump": ".objdump.txt",
    "radare2": ".radare2.json",
    "rizin": ".rizin.json",
    "angr": ".angr.json",
    "ghidra": ".ghidra.json",
}
LOCAL_BINARIES = {"llvm-objdump": ["llvm-objdump", "objdump"], "radare2": ["r2", "radare2"], "rizin": ["rizin"], "ghidra": ["analyzeHeadless"]}

SHT_SYMTAB = 2
STT_FUNC = 2
EM_X86_64 = 62


class ElfError(ValueError):
    pass


@dataclass(frozen=True)
class FunctionSymbol:
    name: str
    start: int
    size: int

    @property
    def end(self) -> int:
        return self.start + self.size

    def covers(self, offset: int) -> bool:
        return self.start <= offset < self.end


@dataclass(frozen=True)
class TextSection:
    """The .text size and the STT_FUNC symbols of one relocatable object, read from the ELF symbol table."""

    size: int
    functions: tuple[FunctionSymbol, ...]

    def function(self, name: str) -> FunctionSymbol:
        for symbol in self.functions:
            if symbol.name == name:
                return symbol
        raise ElfError(f"no function symbol named {name}")

    def gaps(self) -> list[tuple[int, int]]:
        ranges: list[tuple[int, int]] = []
        position = 0
        for symbol in self.functions:
            if symbol.start > position:
                ranges.append((position, symbol.start))
            position = symbol.end
        if position < self.size:
            ranges.append((position, self.size))
        return ranges

    def owner(self, offset: int) -> FunctionSymbol | None:
        for symbol in self.functions:
            if symbol.covers(offset):
                return symbol
        return None


def _cstring(table: bytes, offset: int) -> str:
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("ascii", "replace")


def read_text_symbols(path: Path) -> TextSection:
    data = path.read_bytes()
    if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        raise ElfError("only ELF64 little-endian objects are supported")
    header = struct.unpack_from("<16sHHIQQQIHHHHHH", data, 0)
    if header[2] != EM_X86_64:
        raise ElfError(f"e_machine {header[2]} is not x86-64")
    shoff, shentsize, shnum, shstrndx = header[6], header[11], header[12], header[13]
    headers = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize) for index in range(shnum)]
    names = data[headers[shstrndx][4] : headers[shstrndx][4] + headers[shstrndx][5]]
    text_index = next(index for index, raw in enumerate(headers) if _cstring(names, raw[0]) == ".text")
    functions: list[FunctionSymbol] = []
    for raw in headers:
        if raw[1] != SHT_SYMTAB:
            continue
        strings_header = headers[raw[6]]
        strings = data[strings_header[4] : strings_header[4] + strings_header[5]]
        for offset in range(0, raw[5], 24):
            st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", data, raw[4] + offset)
            if st_info & 0xF == STT_FUNC and st_shndx == text_index:
                functions.append(FunctionSymbol(_cstring(strings, st_name), st_value, st_size))
    return TextSection(headers[text_index][5], tuple(sorted(functions, key=lambda s: s.start)))


@dataclass
class Block:
    start: int
    size: int
    instructions: int

    @property
    def end(self) -> int:
        return self.start + self.size


@dataclass
class FunctionView:
    """One tool's view of one function, in .text offsets. blocks is None when the tool builds no graph."""

    name: str
    start: int
    size: int
    from_symbol: bool
    blocks: list[Block] | None
    edges: set[tuple[int, int]] = field(default_factory=set)
    decompiled: str | None = None

    @property
    def end(self) -> int:
        return self.start + self.size


@dataclass
class ToolView:
    tool: str
    version: str
    fixture: str
    base: int
    instructions: dict[int, int]
    functions: dict[str, FunctionView]
    notes: list[str] = field(default_factory=list)

    def claimed(self) -> set[int]:
        claimed: set[int] = set()
        for start, size in self.instructions.items():
            claimed.update(range(start, start + size))
        return claimed

    def starts_in(self, start: int, end: int) -> set[int]:
        return {address for address in self.instructions if start <= address < end}


def load_manifest() -> dict[str, Any]:
    return json.loads((FIXTURES / "captures.json").read_text())


def parse_objdump(text: str, fixture: str, version: str = "") -> ToolView:
    """llvm-objdump -d -r: labels mark symbols, every other line with an address is one instruction.
    A linear sweep has no blocks and no edges, so blocks stays None."""
    instructions: dict[int, int] = {}
    labels: list[tuple[int, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.endswith(">:") and " <" in stripped:
            address_text, _space, rest = stripped.partition(" <")
            labels.append((int(address_text, 16), rest[:-2]))
            continue
        if ":" not in line or "\t" not in line:
            continue
        head, _tab, _rest = line.partition("\t")
        address_text, _colon, byte_text = head.strip().partition(":")
        if not address_text or not all(c in "0123456789abcdef" for c in address_text):
            continue
        instructions[int(address_text, 16)] = len(byte_text.split())
    functions: dict[str, FunctionView] = {}
    for position, (start, name) in enumerate(labels):
        following = labels[position + 1][0] if position + 1 < len(labels) else max((a + n for a, n in instructions.items()), default=start)
        functions[name] = FunctionView(name, start, following - start, True, None)
    return ToolView("llvm-objdump", version, fixture, 0, instructions, functions, ["linear sweep: no blocks, no edges, labels come from the symbol table"])


def _edges_from_r2_blocks(blocks: list[dict[str, Any]], base: int, start: int, end: int) -> set[tuple[int, int]]:
    edges: set[tuple[int, int]] = set()
    for block in blocks:
        source = block["addr"] - base
        targets = [block[key] for key in ("jump", "fail") if block.get(key)]
        if "switch_op" in block:
            targets.extend(case["jump"] for case in block["switch_op"].get("cases", []))
        for target in targets:
            offset = target - base
            if start <= offset < end:
                edges.add((source, offset))
    return edges


def parse_r2_family(record: dict[str, Any], fixture: str) -> ToolView:
    """radare2 and rizin: iSj gives the .text base, aflj the functions, afbj the blocks, pdfj the instructions."""
    commands = record["commands"]
    base = next(s["vaddr"] for s in commands["iSj"]["output"] if s["name"] == ".text")
    functions: dict[str, FunctionView] = {}
    instructions: dict[int, int] = {}
    notes: list[str] = []
    for entry in commands["aaa; aflj"]["output"]:
        address = entry.get("addr", entry.get("offset"))
        name = entry["name"].removeprefix("sym.")
        start = address - base
        size = entry["size"]
        raw_blocks = commands[f"aaa; afbj @ {address:#x}"]["output"]
        for op in commands[f"aaa; pdfj @ {address:#x}"]["output"]["ops"]:
            op_address = op.get("addr", op.get("offset"))
            instructions[op_address - base] = op["size"]
        blocks = [Block(b["addr"] - base, b["size"], b["ninstr"]) for b in raw_blocks]
        edges = _edges_from_r2_blocks(raw_blocks, base, start, start + size)
        if any("switch_op" in b for b in raw_blocks):
            notes.append(f"{name}: jump table resolved as switch_op with {sum(len(b['switch_op']['cases']) for b in raw_blocks if 'switch_op' in b)} cases")
        pseudo = commands.get(f"aaa; pdc @ {address:#x}", {}).get("output")
        functions[name] = FunctionView(name, start, size, not name.startswith("fcn."), blocks, edges, pseudo)
    return ToolView(record["tool"], record["version"], fixture, base, instructions, functions, notes)


def parse_angr(record: dict[str, Any], fixture: str) -> ToolView:
    """angr: CFGFast functions with blocks and typed transition edges; invented functions carry fromSymbol false."""
    base = record["sections"][".text"]["vaddr"]
    text_size = record["sections"][".text"]["size"]
    functions: dict[str, FunctionView] = {}
    instructions: dict[int, int] = {}
    notes: list[str] = []
    for entry in record["functions"]:
        start = entry["addr"] - base
        blocks = []
        for block in entry["blocks"]:
            blocks.append(Block(block["addr"] - base, block["size"], len(block["instructions"])))
            for insn in block["instructions"]:
                instructions[insn["addr"] - base] = insn["size"]
        edges: set[tuple[int, int]] = set()
        for edge in entry["edges"]:
            if edge["type"] == "transition" and not edge["outside"] and edge["target"] == "BlockNode":
                edges.add((edge["from"] - base, edge["to"] - base))
            elif edge["target"] == "HookNode":
                notes.append(f"{entry['name']}: transfer at {edge['from'] - base:#x} leads to an unresolvable target node")
        if not entry["fromSymbol"]:
            notes.append(f"{entry['name']}: function invented at {start:#x}, {entry['size']} bytes, no symbol")
        functions[entry["name"]] = FunctionView(entry["name"], start, entry["size"], entry["fromSymbol"], blocks, edges, entry.get("decompiled"))
    for item in record.get("memoryData", []):
        offset = item["addr"] - base
        if 0 <= offset < text_size:
            notes.append(f"memory data recorded inside .text at {offset:#x}, {item['size']} bytes, sort {item['sort']}")
    version = record["versions"]["angr"]
    return ToolView("angr", version, fixture, base, instructions, functions, notes)


def parse_ghidra(record: dict[str, Any], fixture: str) -> ToolView:
    """Ghidra: functions with BasicBlockModel blocks and typed flows; call flows are not graph edges."""
    base = next(b["start"] for b in record["memoryBlocks"] if b["name"] == ".text")
    functions: dict[str, FunctionView] = {}
    instructions: dict[int, int] = {}
    notes: list[str] = []
    for entry in record["functions"]:
        start = entry["entry"] - base
        body_min, body_max = entry["bodyMin"] - base, entry["bodyMax"] - base
        for insn in entry["instructions"]:
            instructions[insn["addr"] - base] = insn["size"]
        blocks = []
        edges: set[tuple[int, int]] = set()
        for block in entry["blocks"]:
            block_start = block["start"] - base
            count = sum(1 for insn in entry["instructions"] if block_start <= insn["addr"] - base < block_start + block["size"])
            blocks.append(Block(block_start, block["size"], count))
            for destination in block["destinations"]:
                flow = destination["flow"]
                target = destination["to"] - base
                if "CALL" in flow:
                    continue
                if body_min <= target <= body_max:
                    edges.add((block_start, target))
                if "COMPUTED" in flow:
                    notes.append(f"{entry['name']}: computed jump at block {block_start:#x} resolved to {target:#x}")
        functions[entry["name"]] = FunctionView(entry["name"], start, entry["bodySize"], entry["symbolSource"] == "IMPORTED", blocks, edges, entry.get("decompiled"))
    for symbol in record.get("symbols", []):
        if symbol["type"] == "Label" and symbol["name"].startswith("switchD"):
            notes.append(f"switch label {symbol['name']} at {symbol['addr'] - base:#x}")
    return ToolView("ghidra", record["version"], fixture, base, instructions, functions, notes)


PARSERS: dict[str, Callable[..., ToolView]] = {
    "llvm-objdump": parse_objdump,
    "radare2": parse_r2_family,
    "rizin": parse_r2_family,
    "angr": parse_angr,
    "ghidra": parse_ghidra,
}


def load_view(tool: str, fixture: str) -> ToolView | None:
    path = FIXTURES / fixture.replace(".o", CAPTURE_SUFFIX[tool])
    if not path.exists():
        return None
    if tool == "llvm-objdump":
        version = load_manifest()["tools"].get("llvm-objdump", {}).get("version", "")
        return parse_objdump(path.read_text(), fixture, version)
    return PARSERS[tool](json.loads(path.read_text()), fixture)


def load_views(fixture: str) -> dict[str, ToolView]:
    views: dict[str, ToolView] = {}
    for tool in TOOLS:
        view = load_view(tool, fixture)
        if view is not None:
            views[tool] = view
    return views


def majority(sets: list[set[int]]) -> set[int]:
    """Elements present in more than half of the sets."""
    counts: dict[int, int] = {}
    for members in sets:
        for member in members:
            counts[member] = counts.get(member, 0) + 1
    return {member for member, count in counts.items() if count * 2 > len(sets)}


def ranges(offsets: set[int]) -> list[tuple[int, int]]:
    """Compress a set of byte offsets into sorted half-open ranges."""
    result: list[tuple[int, int]] = []
    for offset in sorted(offsets):
        if result and result[-1][1] == offset:
            result[-1] = (result[-1][0], offset + 1)
        else:
            result.append((offset, offset + 1))
    return result


def hex_ranges(offsets: set[int]) -> list[str]:
    return [f"0x{a:x}-0x{b:x}" for a, b in ranges(offsets)]


def function_report(text: TextSection, symbol: FunctionSymbol, views: dict[str, ToolView], descent: list[str]) -> dict[str, Any]:
    starts = {tool: view.starts_in(symbol.start, symbol.end) for tool, view in views.items()}
    agreed = majority([starts[tool] for tool in descent])
    differences = {}
    for tool, found in starts.items():
        if found != agreed:
            differences[tool] = {"extra": [f"0x{a:x}" for a in sorted(found - agreed)], "missing": [f"0x{a:x}" for a in sorted(agreed - found)]}
    blocks: dict[str, int] = {}
    block_starts: dict[str, list[str]] = {}
    edges: dict[str, int] = {}
    edge_sets: dict[str, frozenset[tuple[int, int]]] = {}
    for tool, view in views.items():
        function = view.functions.get(symbol.name)
        if function is None or function.blocks is None:
            continue
        blocks[tool] = len(function.blocks)
        block_starts[tool] = [f"0x{b.start:x}" for b in sorted(function.blocks, key=lambda b: b.start)]
        edges[tool] = len(function.edges)
        edge_sets[tool] = frozenset(function.edges)
    edge_union = set().union(*edge_sets.values()) if edge_sets else set()
    edge_differences = {}
    for tool, found in edge_sets.items():
        missing = edge_union - found
        if missing:
            edge_differences[tool] = [f"0x{a:x}->0x{b:x}" for a, b in sorted(missing)]
    return {
        "extent": f"0x{symbol.start:x}-0x{symbol.end:x}",
        "size": symbol.size,
        "found": {tool: symbol.name in view.functions for tool, view in views.items()},
        "instructionStarts": {
            "agreed": len(agreed),
            "perTool": {tool: len(found) for tool, found in starts.items()},
            "allDescentToolsAgree": all(starts[tool] == agreed for tool in descent),
            "differences": differences,
        },
        "blocks": blocks,
        "blockStarts": block_starts,
        "blocksAgree": len(set(blocks.values())) <= 1,
        "edges": edges,
        "edgesAgree": len(set(edge_sets.values())) <= 1,
        "edgesMissingPerTool": edge_differences,
    }


def function_start_report(text: TextSection, views: dict[str, ToolView]) -> dict[str, Any]:
    symbols = {s.name: s.start for s in text.functions}
    report = {}
    for tool, view in views.items():
        found = {name: f.start for name, f in view.functions.items()}
        invented = [f"{name}@0x{start:x}" for name, start in sorted(found.items(), key=lambda kv: kv[1]) if start not in symbols.values()]
        missed = [name for name, start in symbols.items() if start not in found.values()]
        report[tool] = {"found": len(found), "invented": invented, "missed": missed}
    return report


def byte_report(text: TextSection, views: dict[str, ToolView], descent: list[str]) -> dict[str, Any]:
    claimed = {tool: view.claimed() for tool, view in views.items()}
    agreed = majority([claimed[tool] for tool in descent])
    symbol_bytes = {offset for symbol in text.functions for offset in range(symbol.start, symbol.end)}
    gap_bytes = {offset for a, b in text.gaps() for offset in range(a, b)}
    report = {}
    for tool, bytes_claimed in claimed.items():
        report[tool] = {
            "codeBytesInsideSymbols": len(bytes_claimed & symbol_bytes),
            "paddingBytesClaimed": len(bytes_claimed & gap_bytes),
            "symbolBytesUnclaimed": hex_ranges(symbol_bytes - bytes_claimed),
            "invents": hex_ranges(bytes_claimed - agreed),
            "misses": hex_ranges((agreed - bytes_claimed) & symbol_bytes),
        }
    report["dataInsideSymbols"] = hex_ranges(symbol_bytes - agreed)
    report["symbolBytes"] = len(symbol_bytes)
    report["paddingBytes"] = len(gap_bytes)
    return report


def findings(text: TextSection, views: dict[str, ToolView], bytes_report: dict[str, Any], starts_report: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for tool in views:
        entry = bytes_report[tool]
        for span in entry["invents"]:
            lines.append(f"{tool} decodes bytes {span} that most graph builders treat as data or padding")
        for span in entry["misses"]:
            a = int(span.split("-")[0], 16)
            owner = text.owner(a)
            lines.append(f"{tool} never reaches bytes {span} inside {owner.name if owner else '?'} that the other graph builders decode")
        for name in starts_report[tool]["invented"]:
            lines.append(f"{tool} invents a function {name} with no symbol")
        for name in starts_report[tool]["missed"]:
            lines.append(f"{tool} misses the function {name}")
    for span in bytes_report["dataInsideSymbols"]:
        lines.append(f"no graph builder decodes {span}; those bytes sit inside a function and are data")
    return lines


def compare(fixture: str) -> dict[str, Any]:
    text = read_text_symbols(FIXTURES / fixture)
    views = load_views(fixture)
    descent = [tool for tool in DESCENT_TOOLS if tool in views]
    starts_report = function_start_report(text, views)
    bytes_report = byte_report(text, views, descent)
    return {
        "fixture": fixture,
        "textSize": text.size,
        "symbols": {s.name: f"0x{s.start:x}-0x{s.end:x}" for s in text.functions},
        "padding": [f"0x{a:x}-0x{b:x}" for a, b in text.gaps()],
        "tools": {tool: view.version for tool, view in views.items()},
        "bases": {tool: f"0x{view.base:x}" for tool, view in views.items()},
        "functionStarts": starts_report,
        "functions": {symbol.name: function_report(text, symbol, views, descent) for symbol in text.functions},
        "bytes": bytes_report,
        "notes": {tool: view.notes for tool, view in views.items() if view.notes},
        "findings": findings(text, views, bytes_report, starts_report),
    }


REGISTERS_64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi"]
REGISTERS_32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"]
VEX_GUEST_OFFSET = {"rax": 16, "rcx": 24, "rdx": 32, "rbx": 40, "rsp": 48, "rbp": 56, "rsi": 64, "rdi": 72, "cc_op": 144, "cc_dep1": 152, "cc_dep2": 160, "cc_ndep": 168}
VEX_CC_OP_SUB = {8: 5, 16: 6, 32: 7, 64: 8}


class TranslateError(ValueError):
    pass


@dataclass(frozen=True)
class SmallInstruction:
    """One of the three encodings the translator knows: 83 /5 ib, 83 /7 ib, and REX.W 63 /r in register form."""

    hex: str
    kind: str
    text: str
    destination: str
    source: str
    width: int
    immediate: int | None


def decode_small(code: bytes) -> SmallInstruction:
    position = 0
    rex_w = False
    if code and 0x40 <= code[0] <= 0x4F:
        rex_w = bool(code[0] & 0x8)
        if code[0] & 0x7:
            raise TranslateError("REX.R, REX.X, and REX.B are outside this translator")
        position = 1
    if len(code) < position + 2:
        raise TranslateError("instruction too short")
    opcode, modrm = code[position], code[position + 1]
    mod, reg, rm = modrm >> 6, (modrm >> 3) & 7, modrm & 7
    if mod != 3:
        raise TranslateError("only the register form (mod = 11) is translated")
    width = 64 if rex_w else 32
    names = REGISTERS_64 if rex_w else REGISTERS_32
    if opcode == 0x83 and reg in (5, 7):
        if len(code) != position + 3:
            raise TranslateError("83 /digit ib needs exactly one immediate byte")
        immediate = int.from_bytes(code[position + 2 : position + 3], "little", signed=True)
        kind = "sub" if reg == 5 else "cmp"
        suffix = "q" if rex_w else "l"
        return SmallInstruction(code.hex(), kind, f"{kind}{suffix} ${immediate:#x}, %{names[rm]}", names[rm], names[rm], width, immediate)
    if opcode == 0x63 and rex_w:
        if len(code) != position + 2:
            raise TranslateError("63 /r has no immediate")
        return SmallInstruction(code.hex(), "movsxd", f"movslq %{REGISTERS_32[rm]}, %{REGISTERS_64[reg]}", REGISTERS_64[reg], REGISTERS_32[rm], 64, None)
    raise TranslateError(f"opcode {opcode:02x} with /{reg} is outside this translator")


def to_pcode_like(instruction: SmallInstruction) -> list[str]:
    """Register transfers with every flag written eagerly, in the shape of SLEIGH output."""
    destination = instruction.destination.upper()
    if instruction.kind == "movsxd":
        return [f"{destination} = sext({instruction.source.upper()})"]
    immediate = f"{instruction.immediate:#x}"
    result = destination if instruction.kind == "sub" else "tmp"
    lines = [f"CF = {destination} < {immediate}", f"OF = sborrow({destination}, {immediate})", f"{result} = {destination} - {immediate}"]
    lines += [f"SF = {result} s< 0x0", f"ZF = {result} == 0x0", f"PF = popcount({result} & 0xff) & 0x1 == 0x0"]
    return lines


def to_vex_like(instruction: SmallInstruction) -> list[str]:
    """Temporaries and a condition-code thunk, in the shape of VEX: flags are stored as (op, dep1, dep2), never computed."""
    source64 = REGISTERS_64[REGISTERS_32.index(instruction.source)] if instruction.source in REGISTERS_32 else instruction.source
    lines = [f"t0 = GET:I64({source64})"]
    if instruction.kind == "movsxd":
        return lines + ["t1 = 64to32(t0)", "t2 = 32Sto64(t1)", f"PUT({instruction.destination}) = t2"]
    immediate = f"{instruction.immediate:#x}"
    cc_op = f"{VEX_CC_OP_SUB[instruction.width]:#x}"
    if instruction.width == 64:
        lines += [f"t1 = Sub64(t0, {immediate})", f"PUT(cc_op) = {cc_op}", "PUT(cc_dep1) = t0", f"PUT(cc_dep2) = {immediate}", "PUT(cc_ndep) = 0x0"]
        if instruction.kind == "sub":
            lines.append(f"PUT({instruction.destination}) = t1")
        return lines
    lines += ["t1 = 64to32(t0)", f"PUT(cc_op) = {cc_op}", "t2 = 32Uto64(t1)", "PUT(cc_dep1) = t2", f"PUT(cc_dep2) = {immediate}", "PUT(cc_ndep) = 0x0"]
    if instruction.kind == "sub":
        lines.append(f"t3 = Sub32(t1, {immediate})")
        lines.append(f"PUT({instruction.destination}) = 32Uto64(t3)")
    return lines


def translate(hex_text: str) -> dict[str, Any]:
    instruction = decode_small(bytes.fromhex(hex_text.replace(" ", "")))
    pcode = to_pcode_like(instruction)
    vex = to_vex_like(instruction)
    return {
        "hex": instruction.hex,
        "text": instruction.text,
        "kind": instruction.kind,
        "width": instruction.width,
        "pcodeLike": pcode,
        "vexLike": vex,
        "flags": {
            "pcodeLike": "eager" if any(line.startswith(("CF", "OF", "SF", "ZF", "PF")) for line in pcode) else "none",
            "vexLike": "thunk" if any("cc_op" in line for line in vex) else "none",
        },
        "statements": {"pcodeLike": len(pcode), "vexLike": len(vex)},
    }


def observed_ir() -> dict[str, Any]:
    """Statement counts and flag styles of the four captured IRs for the three instructions."""
    report = json.loads((FIXTURES / "ir-lifts.json").read_text())
    rows = []
    for item in report["instructions"]:
        vex_statements = [s for s in item["vex"] if not s.startswith("------ IMark")]
        pcode_ops = [s for s in item["pcode"] if not s.startswith("IMARK")]
        cc_op = next((int(s.rsplit("=", 1)[1].strip(), 16) for s in vex_statements if s.startswith(f"PUT(offset={VEX_GUEST_OFFSET['cc_op']})")), None)
        rows.append({
            "name": item["name"],
            "hex": item["hex"],
            "att": item["att"],
            "esil": {"tokens": len(item["esil"].split(",")), "writesFlags": any(f",{flag},:=" in item["esil"] or f",{flag},=" in item["esil"] for flag in ("zf", "cf", "of", "sf", "pf"))},
            "rzil": {"sets": item["rzil"].count("(set "), "writesFlags": "(set zf" in item["rzil"] or "(set cf" in item["rzil"]},
            "pcode": {"ops": len(pcode_ops), "writesFlags": any(s.startswith(("CF ", "OF ", "SF ", "ZF ", "PF ")) for s in pcode_ops)},
            "vex": {"statements": len(vex_statements), "ccOp": cc_op, "computesFlags": any(s.startswith(("CF", "OF", "SF", "ZF", "PF")) for s in vex_statements)},
        })
    return {"versions": report["versions"], "instructions": rows}


def local_tools() -> dict[str, str]:
    """Which external tools this machine has. The lesson never needs them; the captures stand in."""
    found: dict[str, str] = {}
    for tool, names in LOCAL_BINARIES.items():
        path = next((shutil.which(name) for name in names if shutil.which(name)), None)
        found[tool] = path or "absent"
    found["angr"] = "importable" if importlib.util.find_spec("angr") else "absent"
    return found


TIMELINE = [
    {"year": 1973, "label": "Hollander (Stanford) and Housel (Purdue) write the first decompilation theses", "family": "research", "tool": None},
    {"year": 1977, "label": "adb tutorial at Bell Labs; the debugger ships with UNIX V7 in 1979", "family": "debugger", "tool": None},
    {"year": 1981, "label": "DEBUG with an 8086 disassembler ships in PC-DOS 1.00", "family": "debugger", "tool": None},
    {"year": 1986, "label": "GDB enters distribution", "family": "debugger", "tool": None},
    {"year": 1988, "label": "Sourcer commenting disassembler; first GNU binutils snapshots", "family": "disassembler", "tool": None},
    {"year": 1991, "label": "IDA 0.1 released as shareware on 20 May", "family": "disassembler", "tool": "ida"},
    {"year": 1994, "label": "Cifuentes, Reverse Compilation Techniques; the dcc decompiler", "family": "decompiler", "tool": None},
    {"year": 1997, "label": "REC, Reverse Engineering Compiler 1.1", "family": "decompiler", "tool": None},
    {"year": 2002, "label": "Boomerang open-source decompiler, first code", "family": "decompiler", "tool": None},
    {"year": 2004, "label": "Flake, Structural Comparison of Executable Objects; BinDiff goes on sale", "family": "diffing", "tool": None},
    {"year": 2006, "label": "radare starts as a forensic hex editor", "family": "disassembler", "tool": "radare2"},
    {"year": 2007, "label": "Hex-Rays Decompiler 1.0; Van Emmerik, SSA for decompilation", "family": "decompiler", "tool": "ida"},
    {"year": 2009, "label": "radare2 r2-0.1, the modular rewrite, LGPL-3.0", "family": "framework", "tool": "radare2"},
    {"year": 2010, "label": "LLDB announced as an LLVM subproject", "family": "debugger", "tool": None},
    {"year": 2011, "label": "BAP (CAV); Google acquires zynamics; Hopper appears", "family": "framework", "tool": None},
    {"year": 2012, "label": "Compiler Explorer starts", "family": "compiler-side", "tool": None},
    {"year": 2013, "label": "angr first line of code; Phoenix decompiler (USENIX Security)", "family": "framework", "tool": "angr"},
    {"year": 2015, "label": "DREAM, No More Gotos (NDSS)", "family": "research", "tool": None},
    {"year": 2015, "label": "Vector 35 founded; Binary Ninja prototype", "family": "disassembler", "tool": "binja"},
    {"year": 2015, "label": "angr released publicly under BSD-2-Clause", "family": "framework", "tool": "angr"},
    {"year": 2016, "label": "Binary Ninja on sale with LLIL and a Python API", "family": "disassembler", "tool": "binja"},
    {"year": 2016, "label": "BinDiff free of charge; angr SoK paper (IEEE S&P)", "family": "diffing", "tool": None},
    {"year": 2017, "label": "Cutter 1.0, a Qt GUI for radare2", "family": "disassembler", "tool": "radare2"},
    {"year": 2017, "label": "IDA 7.0 native 64-bit; Binary Ninja MLIL", "family": "disassembler", "tool": "ida"},
    {"year": 2018, "label": "Guilfanov, Decompiler internals: microcode (Recon)", "family": "decompiler", "tool": "ida"},
    {"year": 2019, "label": "Ghidra 9.0 released by NSA under Apache-2.0", "family": "decompiler", "tool": "ghidra"},
    {"year": 2019, "label": "angr 8.19.2.4 adds a preliminary decompiler", "family": "decompiler", "tool": "angr"},
    {"year": 2020, "label": "Binary Ninja 2.0 with the HLIL decompiler", "family": "decompiler", "tool": "binja"},
    {"year": 2020, "label": "Rizin announced as a fork of radare2; the Cutter team joins", "family": "framework", "tool": "rizin"},
    {"year": 2021, "label": "IDA Freeware 7.6 with a cloud x64 decompiler", "family": "decompiler", "tool": "ida"},
    {"year": 2021, "label": "Cutter 2.0 on rizin; iaito continues for radare2", "family": "disassembler", "tool": "rizin"},
    {"year": 2023, "label": "BinDiff 8 open-sourced under Apache-2.0", "family": "diffing", "tool": None},
    {"year": 2024, "label": "SAILR becomes the default angr structurer (USENIX Security)", "family": "research", "tool": "angr"},
    {"year": 2024, "label": "Binary Ninja 4.0 with the Free edition; IDA 9.0 with idalib", "family": "disassembler", "tool": "binja"},
    {"year": 2025, "label": "Ghidra 12.0", "family": "decompiler", "tool": "ghidra"},
    {"year": 2025, "label": "Binary Ninja 5.0; DecompileBench (ACL Findings)", "family": "research", "tool": "binja"},
    {"year": 2026, "label": "Ghidra 12.1.4 (21 Sep)", "family": "decompiler", "tool": "ghidra"},
    {"year": 2026, "label": "radare2 6.2.4 (5 Oct)", "family": "framework", "tool": "radare2"},
    {"year": 2026, "label": "rizin 0.9.1 and Cutter 2.5.0 (June)", "family": "framework", "tool": "rizin"},
    {"year": 2026, "label": "Binary Ninja 6.0 Krypton (3 Sep)", "family": "disassembler", "tool": "binja"},
    {"year": 2026, "label": "IDA 9.4 (13 Jul)", "family": "disassembler", "tool": "ida"},
    {"year": 2026, "label": "angr 10.0.3 (10 Oct)", "family": "framework", "tool": "angr"},
    {"year": 2026, "label": "LLM decompiler studies: readability metrics; recompile more, preserve less", "family": "research", "tool": None},
]

STAGES = [
    {"id": "loader", "label": "Loader", "what": "Parse the container, map sections, read symbols and relocations."},
    {"id": "disassembly", "label": "Disassembly", "what": "Decode bytes into instructions and decide where code starts."},
    {"id": "cfg", "label": "CFG recovery", "what": "Cut instructions into basic blocks and add the edges."},
    {"id": "lifting", "label": "Lifting", "what": "Translate each instruction into a machine-independent form."},
    {"id": "ssa", "label": "SSA", "what": "Give every definition one name so each use points at one definition."},
    {"id": "dataflow", "label": "Data flow and types", "what": "Propagate constants, remove dead code, recover arguments, variables, and types."},
    {"id": "structuring", "label": "Structuring", "what": "Turn the graph back into if, while, and switch, with goto for the rest."},
    {"id": "emission", "label": "Emission", "what": "Print the result as C-like text with names and casts."},
]

FIGURE_TOOLS = [
    {"id": "ghidra", "label": "Ghidra", "maker": "NSA", "version": "12.1.4", "licence": "Apache-2.0", "ran": True},
    {"id": "binja", "label": "Binary Ninja", "maker": "Vector 35", "version": "6.0", "licence": "commercial, Free edition", "ran": False},
    {"id": "ida", "label": "IDA / Hex-Rays", "maker": "Hex-Rays", "version": "9.4", "licence": "commercial, IDA Free", "ran": False},
    {"id": "radare2", "label": "radare2", "maker": "radareorg", "version": "6.2.4", "licence": "LGPL-3.0", "ran": True},
    {"id": "rizin", "label": "rizin", "maker": "rizinorg", "version": "0.9.1", "licence": "LGPL-3.0", "ran": True},
    {"id": "angr", "label": "angr", "maker": "UCSB SecLab, ASU SEFCOM", "version": "10.0.3", "licence": "BSD-2-Clause", "ran": True},
]

TERMS = {
    "loader": {
        "ghidra": "ElfLoader, MachoLoader, PeLoader; .ldefs picks the language",
        "binja": "BinaryView, BinaryViewType",
        "ida": "Loader module (LDSC)",
        "radare2": "RBin (rabin2)",
        "rizin": "RzBin (rz-bin)",
        "angr": "CLE (cle.Loader, main_object)",
    },
    "disassembly": {
        "ghidra": "Disassembler; SLEIGH .slaspec to .sla; Disassemble Entry Points, Function Start Search",
        "binja": "Architecture plugin; Recursive Descent, then linear sweep phases",
        "ida": "Processor module (ana.cpp, emu.cpp, out.cpp); autoanalysis queues; FLIRT",
        "radare2": "RArch plugin to RAnalOp; aa, aaa, af",
        "rizin": "RzAnalysis plugin; aa, aaa, af",
        "angr": "Capstone blocks; CFGFast function start search",
    },
    "cfg": {
        "ghidra": "Generate Basic Blocks and the CFG; BlockGraph; Decompiler Switch Analysis",
        "binja": "Function, BasicBlock; CFG Analysis phase",
        "ida": "mbl_graph_t, ready at MMAT_LOCOPT",
        "radare2": "afb, agf, aab",
        "rizin": "afb, agf, aab (Nucleus)",
        "angr": "CFGFast, CFGEmulated; kb.functions; IRSB",
    },
    "lifting": {
        "ghidra": "Generate Raw P-code; Varnodes in ram, register, const, unique",
        "binja": "Lifted IL to LLIL to Mapped MLIL to MLIL",
        "ida": "microcode (minsn_t, mop_t); MMAT_GENERATED",
        "radare2": "ESIL (asm.esil, ae)",
        "rizin": "RzIL (aoi, aez)",
        "angr": "VEX (pyvex.lift, IRSB), then AIL",
    },
    "ssa": {
        "ghidra": "Heritage, ActionHeritage; MULTIEQUAL, INDIRECT",
        "binja": "LLIL SSA, MLIL SSA, HLIL SSA; HLIL_VAR_PHI",
        "ida": "no named SSA; use-def data flow in MMAT_GLBOPT1 to 3",
        "radare2": "none; ESIL is built for emulation",
        "rizin": "none; RzIL is built for emulation",
        "angr": "_stage_transform_to_ssa_level0 and level1; SeqNodeDephication",
    },
    "dataflow": {
        "ghidra": "ActionDeadCode, ActionInferTypes, Rule pool; prototype from .cspec",
        "binja": "MLIL constant propagation, variables and types; analyzeReturns",
        "ida": "Transform microcode; MMAT_CALLS, MMAT_GLBOPT, MMAT_LVARS; TIL",
        "radare2": "afv, afc, aaft; ESIL emulation",
        "rizin": "afv, afc, aft",
        "angr": "CallingConventionAnalysis, VariableRecoveryFast, Typehoon",
    },
    "structuring": {
        "ghidra": "CollapseStructure; BlockIf, BlockWhileDo, BlockSwitch, BlockGoto",
        "binja": "HLIL_IF, HLIL_WHILE, HLIL_SWITCH; AST at root",
        "ida": "Generate ctree; structural analysis; goto regions",
        "radare2": "pdc (ESIL plus pseudo); pdd (r2dec); pdg (r2ghidra)",
        "rizin": "pdg (rz-ghidra); jsdec",
        "angr": "RegionIdentifier; RecursiveStructurer with SAILRStructurer",
    },
    "emission": {
        "ghidra": "Emit Final C Tokens; PrintC, ActionNameVars, ActionSetCasts",
        "binja": "HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python",
        "ida": "Beautify ctree; Print ctree; cfunc_t",
        "radare2": "text of pdc, pdd, pdg",
        "rizin": "pdg text",
        "angr": "CStructuredCodeGenerator; codegen.text",
    },
}


def figure_data() -> dict[str, Any]:
    reports = {name: compare(name) for name in FIXTURE_OBJECTS}
    o1 = reports["ledger-x86_64-O1.o"]
    o0 = reports["ledger-x86_64-O0.o"]
    trap = reports["sweep-trap.o"]
    evidence: dict[str, Any] = {}
    for tool in DESCENT_TOOLS:
        evidence[tool] = {
            "o1Blocks": [o1["functions"][name]["blocks"].get(tool) for name in ("percent_change", "grade", "total", "grade_label")],
            "o0GradeBlocks": o0["functions"]["grade"]["blocks"].get(tool),
            "o0GradeEdges": o0["functions"]["grade"]["edges"].get(tool),
            "trapLookupInstructions": trap["functions"]["lookup"]["instructionStarts"]["perTool"].get(tool),
            "inventedFunctions": sum(len(report["functionStarts"][tool]["invented"]) for report in reports.values()),
        }
    return {"timeline": TIMELINE, "stages": STAGES, "tools": FIGURE_TOOLS, "terms": TERMS, "evidence": evidence}


IR_EXAMPLES = ["4883ec10", "4863c7", "83f904"]


def demo() -> dict[str, Any]:
    manifest = load_manifest()
    return {
        "captured": manifest["captured"],
        "captureTools": {tool: entry["version"] for tool, entry in manifest["tools"].items()},
        "localTools": local_tools(),
        "fixtures": {name: compare(name) for name in FIXTURE_OBJECTS},
        "ir": {"translator": [translate(code) for code in IR_EXAMPLES], "observed": observed_ir()},
    }


def main(argv: list[str]) -> int:
    if not argv:
        report = demo()
        absent = [tool for tool, where in report["localTools"].items() if where == "absent"]
        if absent:
            print("external tools absent on this machine (captures are used instead): " + ", ".join(absent), file=sys.stderr)
        print(json.dumps(report, indent=2))
        return 0
    command = argv[0]
    if command == "compare" and len(argv) == 2:
        print(json.dumps(compare(argv[1]), indent=2))
        return 0
    if command == "ir" and len(argv) == 2:
        print(json.dumps(translate(argv[1]), indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [compare FIXTURE.o | ir HEXBYTES | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
