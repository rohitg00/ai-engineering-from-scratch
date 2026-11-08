"""Companion code for docs/en.md: match functions between two builds and solve for inputs that reach a path.
Matching stages follow the BinDiff concepts page: byte hash, masked hash, mnemonic hash, flow-graph shape, names.
Relocations: x86-64 psABI Table 4.9 (R_X86_64_PC32 = S + A - P, R_X86_64_64 = S + A).
Symbolic execution: King, "Symbolic execution and program testing" (1976). Path explosion: Baldoni et al. (2018), section 5.
Run `python3 main.py` for the demo or `python3 -m unittest discover -s tests -v` for the suite.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import re
import struct
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
LEVELS = {"O0": "ledger-x86_64-O0.o", "O1": "ledger-x86_64-O1.o", "O2": "ledger-x86_64-O2.o"}
IMAGE_BASE = 0x100000

SHT_SYMTAB = 2
SHT_STRTAB = 3
SHT_RELA = 4
SHT_NOBITS = 8
SHF_ALLOC = 2
STT_FUNC = 2
STT_SECTION = 3
R_X86_64_64 = 1
R_X86_64_PC32 = 2
R_X86_64_PLT32 = 4
RELOCATION_NAMES = {0: "R_X86_64_NONE", 1: "R_X86_64_64", 2: "R_X86_64_PC32", 4: "R_X86_64_PLT32", 10: "R_X86_64_32", 11: "R_X86_64_32S"}
RELOCATION_WIDTHS = {1: 8, 2: 4, 4: 4, 10: 4, 11: 4}
PC_RELATIVE = {R_X86_64_PC32, R_X86_64_PLT32}


class ElfError(ValueError):
    pass


@dataclass(frozen=True)
class Section:
    index: int
    name: str
    type: int
    flags: int
    offset: int
    size: int
    link: int
    info: int
    align: int
    data: bytes


@dataclass(frozen=True)
class Symbol:
    name: str
    value: int
    size: int
    type: int
    bind: int
    shndx: int


@dataclass(frozen=True)
class Relocation:
    offset: int
    type: int
    symbol: Symbol
    addend: int
    target_section: str

    @property
    def width(self) -> int:
        return RELOCATION_WIDTHS.get(self.type, 4)

    @property
    def type_name(self) -> str:
        return RELOCATION_NAMES.get(self.type, f"R_X86_64_{self.type}")

    def describe(self, elf: "ElfObject") -> str:
        name = self.symbol.name or elf.sections[self.symbol.shndx].name
        sign = "+" if self.addend >= 0 else "-"
        return f"{self.type_name} {name}{sign}0x{abs(self.addend):x}"


def _cstring(table: bytes, offset: int) -> str:
    end = table.index(b"\0", offset)
    return table[offset:end].decode("ascii")


class ElfObject:
    def __init__(self, data: bytes, name: str = "") -> None:
        if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
            raise ElfError("not a little-endian ELF64 file")
        if struct.unpack_from("<H", data, 0x12)[0] != 62:
            raise ElfError("not an x86-64 object")
        self.name = name
        self.data = data
        shoff = struct.unpack_from("<Q", data, 0x28)[0]
        shentsize, shnum, shstrndx = struct.unpack_from("<HHH", data, 0x3A)
        raw = []
        for index in range(shnum):
            fields = struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize)
            raw.append(fields)
        names = data[raw[shstrndx][4] : raw[shstrndx][4] + raw[shstrndx][5]]
        self.sections: list[Section] = []
        for index, (sh_name, sh_type, sh_flags, _, sh_offset, sh_size, sh_link, sh_info, sh_align, _) in enumerate(raw):
            body = b"" if sh_type == SHT_NOBITS else data[sh_offset : sh_offset + sh_size]
            self.sections.append(Section(index, _cstring(names, sh_name), sh_type, sh_flags, sh_offset, sh_size, sh_link, sh_info, sh_align, body))
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    def _read_symbols(self) -> list[Symbol]:
        table = next((s for s in self.sections if s.type == SHT_SYMTAB), None)
        if table is None:
            return []
        strings = self.sections[table.link].data
        symbols = []
        for offset in range(0, table.size, 24):
            st_name, st_info, _, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", table.data, offset)
            symbols.append(Symbol(_cstring(strings, st_name), st_value, st_size, st_info & 0xF, st_info >> 4, st_shndx))
        return symbols

    def _read_relocations(self) -> dict[str, list[Relocation]]:
        result: dict[str, list[Relocation]] = {}
        for section in self.sections:
            if section.type != SHT_RELA:
                continue
            target = self.sections[section.info].name
            entries = []
            for offset in range(0, section.size, 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, offset)
                entries.append(Relocation(r_offset, r_info & 0xFFFFFFFF, self.symbols[r_info >> 32], r_addend, target))
            result[target] = sorted(entries, key=lambda r: r.offset)
        return result

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise ElfError(f"no section named {name}")

    def symbol_section(self, symbol: Symbol) -> Section:
        return self.sections[symbol.shndx]

    def functions(self) -> list[Symbol]:
        text = self.section(".text").index
        return sorted((s for s in self.symbols if s.type == STT_FUNC and s.shndx == text), key=lambda s: s.value)

    def function_extent(self, name: str) -> tuple[int, int]:
        for symbol in self.functions():
            if symbol.name == name:
                return symbol.value, symbol.value + symbol.size
        raise ElfError(f"no function named {name}")

    def relocations_in(self, section: str, start: int, end: int) -> list[Relocation]:
        return [r for r in self.relocations.get(section, []) if start <= r.offset < end]

    def read_u32(self, section: str, offset: int) -> int:
        return struct.unpack_from("<i", self.section(section).data, offset)[0]


def read_object(path: Path) -> ElfObject:
    return ElfObject(path.read_bytes(), path.name)


def load_fixture(name: str) -> ElfObject:
    return read_object(FIXTURES / name)


def fixture_listing(name: str) -> dict[str, list["Instruction"]]:
    return parse_listing((FIXTURES / name.replace(".o", ".objdump.txt")).read_text())


CONDITIONAL_JUMPS = {"ja", "jae", "jb", "jbe", "je", "jne", "jl", "jle", "jg", "jge", "js", "jns", "jo", "jno", "jp", "jnp"}
LINE_RE = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}\s)+)\s*(\S+)?\s*(.*)$")
HEADER_RE = re.compile(r"^([0-9a-f]{16}) <([^>]+)>:$")


@dataclass(frozen=True)
class Instruction:
    address: int
    raw: bytes
    mnemonic: str
    operands: str

    @property
    def end(self) -> int:
        return self.address + len(self.raw)

    @property
    def is_conditional(self) -> bool:
        return self.mnemonic in CONDITIONAL_JUMPS

    @property
    def is_jump(self) -> bool:
        return self.mnemonic == "jmp"

    @property
    def is_indirect_jump(self) -> bool:
        return self.mnemonic == "jmpq" and self.operands.startswith("*")

    @property
    def is_return(self) -> bool:
        return self.mnemonic == "retq"

    @property
    def ends_block(self) -> bool:
        return self.is_conditional or self.is_jump or self.is_indirect_jump or self.is_return

    @property
    def target(self) -> int | None:
        if not (self.is_conditional or self.is_jump):
            return None
        match = re.match(r"0x([0-9a-f]+)", self.operands)
        return int(match.group(1), 16) if match else None

    @property
    def text(self) -> str:
        return f"{self.mnemonic} {self.operands}".strip()


def parse_listing(text: str) -> dict[str, list[Instruction]]:
    functions: dict[str, list[Instruction]] = {}
    current: str | None = None
    for line in text.splitlines():
        header = HEADER_RE.match(line.strip())
        if header:
            current = header.group(2)
            functions[current] = []
            continue
        match = LINE_RE.match(line)
        if not match or current is None or match.group(3) is None:
            continue
        operands = match.group(4).split("#")[0].strip()
        functions[current].append(Instruction(int(match.group(1), 16), bytes.fromhex(match.group(2).replace(" ", "")), match.group(3), operands))
    return functions


@dataclass
class Block:
    start: int
    end: int
    instructions: list[Instruction]

    @property
    def size(self) -> int:
        return self.end - self.start

    @property
    def last(self) -> Instruction:
        return self.instructions[-1]


@dataclass(frozen=True)
class Edge:
    source: int
    target: int
    kind: str


def jump_table_targets(elf: ElfObject, start: int, end: int) -> list[int]:
    text_index = elf.section(".text").index
    rodata_index = elf.section(".rodata").index
    lea = next((r for r in elf.relocations_in(".text", start, end) if r.type == R_X86_64_PC32 and r.symbol.type == STT_SECTION and r.symbol.shndx == rodata_index), None)
    if lea is None:
        return []
    table_offset = lea.addend + 4
    expected = table_offset
    targets: list[int] = []
    for entry in elf.relocations.get(".rodata", []):
        if entry.offset < table_offset:
            continue
        if entry.offset != expected or entry.symbol.type != STT_SECTION or entry.symbol.shndx != text_index:
            break
        target = entry.addend + table_offset - entry.offset
        if not start <= target < end:
            break
        targets.append(target)
        expected += 4
    return targets


def build_cfg(instructions: list[Instruction], start: int, end: int, table_targets: list[int]) -> tuple[list[Block], list[Edge]]:
    by_address = {i.address: i for i in instructions}
    leaders = {start}
    for insn in instructions:
        if insn.target is not None and start <= insn.target < end:
            leaders.add(insn.target)
        if insn.ends_block and insn.end < end:
            leaders.add(insn.end)
        if insn.is_indirect_jump:
            leaders.update(t for t in table_targets if start <= t < end)
    blocks: dict[int, Block] = {}
    current: Block | None = None
    for insn in sorted(instructions, key=lambda i: i.address):
        if insn.address in leaders or current is None or current.end != insn.address:
            current = Block(insn.address, insn.end, [insn])
            blocks[insn.address] = current
        else:
            current.instructions.append(insn)
            current.end = insn.end
    successors: dict[int, list[Edge]] = {}
    for block in blocks.values():
        last = block.last
        edges: list[Edge] = []
        if last.is_return:
            pass
        elif last.is_jump and last.target is not None:
            edges.append(Edge(block.start, last.target, "jump"))
        elif last.is_conditional and last.target is not None:
            edges.append(Edge(block.start, last.target, "taken"))
            if block.end in blocks:
                edges.append(Edge(block.start, block.end, "fallthrough"))
        elif last.is_indirect_jump:
            edges.extend(Edge(block.start, t, "table") for t in sorted(set(table_targets)))
        elif block.end in blocks:
            edges.append(Edge(block.start, block.end, "fallthrough"))
        successors[block.start] = edges
    reachable: list[int] = []
    stack = [start]
    seen = set()
    while stack:
        node = stack.pop()
        if node in seen or node not in blocks:
            continue
        seen.add(node)
        reachable.append(node)
        stack.extend(e.target for e in successors[node])
    ordered = sorted(reachable)
    edges = [e for node in ordered for e in successors[node] if e.target in seen]
    del by_address
    return [blocks[node] for node in ordered], edges


@dataclass
class FunctionRecord:
    name: str
    source: str
    start: int
    end: int
    raw: bytes
    instructions: list[Instruction]
    relocations: list[Relocation]
    blocks: list[Block]
    edges: list[Edge]
    table_targets: list[int]
    loaded: bool = False
    referenced_data: bytes | None = None

    @property
    def size(self) -> int:
        return self.end - self.start

    @property
    def mnemonics(self) -> list[str]:
        return [i.mnemonic for i in self.instructions]

    def masked_bytes(self) -> bytes:
        masked = bytearray(self.raw)
        for relocation in self.relocations:
            for index in range(relocation.offset - self.start, relocation.offset - self.start + relocation.width):
                if 0 <= index < len(masked):
                    masked[index] = 0
        return bytes(masked)

    def reachable_bytes(self) -> bytes:
        return b"".join(self.raw[b.start - self.start : b.end - self.start] for b in self.blocks)

    def degree_sequence(self) -> list[tuple[int, int]]:
        incoming = {b.start: 0 for b in self.blocks}
        outgoing = {b.start: 0 for b in self.blocks}
        for edge in self.edges:
            outgoing[edge.source] += 1
            incoming[edge.target] += 1
        return sorted((incoming[b.start], outgoing[b.start]) for b in self.blocks)

    def cfg_shape(self) -> str:
        degrees = ",".join(f"{i}/{o}" for i, o in self.degree_sequence())
        return f"{len(self.blocks)}b {len(self.edges)}e [{degrees}]"

    def signatures(self) -> dict[str, str]:
        return {
            "exact-bytes": hashlib.sha256(self.raw).hexdigest()[:16],
            "masked-bytes": hashlib.sha256(self.masked_bytes()).hexdigest()[:16],
            "mnemonics": hashlib.sha256(" ".join(self.mnemonics).encode()).hexdigest()[:16],
            "cfg-shape": self.cfg_shape(),
            "name": self.name,
        }

    def summary(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "start": self.start,
            "size": self.size,
            "instructions": len(self.instructions),
            "blocks": len(self.blocks),
            "edges": len(self.edges),
            "relocations": len(self.relocations),
            "signatures": self.signatures(),
        }


@dataclass
class Image:
    elf: ElfObject
    base: int
    addresses: dict[str, int]
    data: dict[str, bytearray]

    def address_of(self, symbol: Symbol) -> int | None:
        if symbol.shndx >= len(self.elf.sections) or self.elf.sections[symbol.shndx].name not in self.addresses:
            return None
        return self.addresses[self.elf.sections[symbol.shndx].name] + symbol.value


def load_image(elf: ElfObject, base: int = IMAGE_BASE) -> Image:
    addresses: dict[str, int] = {}
    data: dict[str, bytearray] = {}
    address = base
    for section in elf.sections:
        if not section.flags & SHF_ALLOC or section.type == SHT_NOBITS:
            continue
        align = max(1, section.align)
        address = (address + align - 1) // align * align
        addresses[section.name] = address
        data[section.name] = bytearray(section.data)
        address += section.size
    image = Image(elf, base, addresses, data)
    for target, relocations in elf.relocations.items():
        if target not in data:
            continue
        for relocation in relocations:
            symbol_value = image.address_of(relocation.symbol)
            if symbol_value is None:
                continue
            place = addresses[target] + relocation.offset
            if relocation.type in PC_RELATIVE:
                struct.pack_into("<i", data[target], relocation.offset, symbol_value + relocation.addend - place)
            elif relocation.type == R_X86_64_64:
                struct.pack_into("<Q", data[target], relocation.offset, symbol_value + relocation.addend)
            elif relocation.type in (10, 11):
                struct.pack_into("<I", data[target], relocation.offset, (symbol_value + relocation.addend) & 0xFFFFFFFF)
    return image


def referenced_table(elf: ElfObject, instructions: list[Instruction], relocations: list[Relocation], image: Image | None) -> bytes | None:
    rodata = elf.section(".rodata").index
    lea = next((r for r in relocations if r.type == R_X86_64_PC32 and r.symbol.type == STT_SECTION and r.symbol.shndx == rodata), None)
    if lea is None:
        return None
    count = None
    width = None
    for insn in instructions:
        if insn.mnemonic == "cmpl" and insn.operands.startswith("$"):
            count = int(insn.operands.split(",")[0][1:], 16) + 1
        if insn.mnemonic == "subl" and insn.operands.startswith("$"):
            count = int(insn.operands.split(",")[0][1:], 16) + 1
        scaled = re.search(r",\s*(\d)\)", insn.operands)
        if scaled and insn.mnemonic in ("movl", "movq", "movslq"):
            width = int(scaled.group(1))
    if count is None or width is None:
        return None
    offset = lea.addend + 4
    source = image.data[".rodata"] if image is not None else elf.section(".rodata").data
    return bytes(source[offset : offset + count * width])


def function_record(elf: ElfObject, listing: dict[str, list[Instruction]], name: str, image: Image | None = None) -> FunctionRecord:
    start, end = elf.function_extent(name)
    text = image.data[".text"] if image is not None else elf.section(".text").data
    instructions = [i for i in listing[name] if start <= i.address < end]
    for insn in instructions:
        if elf.section(".text").data[insn.address : insn.end] != insn.raw:
            raise ElfError(f"listing bytes differ from the object at 0x{insn.address:x}")
    relocations = elf.relocations_in(".text", start, end)
    targets = jump_table_targets(elf, start, end) if any(i.is_indirect_jump for i in instructions) else []
    blocks, edges = build_cfg(instructions, start, end, targets)
    raw = bytes(text[start:end])
    if image is not None:
        instructions = [Instruction(i.address, raw[i.address - start : i.end - start], i.mnemonic, i.operands) for i in instructions]
        blocks, edges = build_cfg(instructions, start, end, targets)
    record = FunctionRecord(name, elf.name, start, end, raw, instructions, relocations, blocks, edges, targets, image is not None)
    record.referenced_data = referenced_table(elf, instructions, relocations, image)
    return record


def function_records(elf: ElfObject, listing: dict[str, list[Instruction]], image: Image | None = None) -> list[FunctionRecord]:
    return [function_record(elf, listing, symbol.name, image) for symbol in elf.functions()]


def fixture_records(name: str, loaded: bool = False) -> list[FunctionRecord]:
    elf = load_fixture(name)
    image = load_image(elf) if loaded else None
    return function_records(elf, fixture_listing(name), image)


@dataclass(frozen=True)
class Stage:
    id: str
    label: str
    quality: str
    ghidra: str
    bindiff: str


STAGES = [
    Stage("exact-bytes", "exact function bytes", "very good", "Exact Function Bytes Match", "hash matching"),
    Stage("masked-bytes", "bytes with relocation fields masked", "very good", "Exact Function Instructions Match", "hash matching on a relocatable object"),
    Stage("mnemonics", "mnemonic sequence", "good", "Exact Function Mnemonics Match", "prime signature matching"),
    Stage("cfg-shape", "flow-graph shape", "medium", "none", "MD index matching"),
    Stage("name", "symbol name", "very good", "Exact Symbol Name Match", "name hash matching"),
]
STAGE_BY_ID = {stage.id: stage for stage in STAGES}
LESSON_ORDER = [stage.id for stage in STAGES]
BINDIFF_ORDER = ["exact-bytes", "name", "masked-bytes", "mnemonics", "cfg-shape"]


@dataclass
class Match:
    left: FunctionRecord
    right: FunctionRecord
    stage: str
    agreeing: list[str]
    similarity: float
    data_equal: bool | None

    @property
    def quality(self) -> str:
        return STAGE_BY_ID[self.stage].quality

    @property
    def names_agree(self) -> bool:
        return self.left.name == self.right.name

    def to_dict(self) -> dict[str, Any]:
        return {
            "left": self.left.name,
            "right": self.right.name,
            "stage": self.stage,
            "quality": self.quality,
            "agreeing": self.agreeing,
            "similarity": round(self.similarity, 6),
            "sizes": [self.left.size, self.right.size],
            "namesAgree": self.names_agree,
            "dataEqual": self.data_equal,
        }


@dataclass
class MatchReport:
    left_object: str
    right_object: str
    loaded: bool
    matches: list[Match]
    unmatched_left: list[FunctionRecord]
    unmatched_right: list[FunctionRecord]
    order: list[str] = field(default_factory=lambda: list(LESSON_ORDER))

    def by_name(self, left_name: str) -> Match | None:
        return next((m for m in self.matches if m.left.name == left_name), None)

    def stage_of(self, left_name: str) -> str | None:
        match = self.by_name(left_name)
        return match.stage if match else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "left": self.left_object,
            "right": self.right_object,
            "view": "loaded image" if self.loaded else "object file",
            "order": self.order,
            "matches": [m.to_dict() for m in self.matches],
            "unmatchedLeft": [f.name for f in self.unmatched_left],
            "unmatchedRight": [f.name for f in self.unmatched_right],
        }


def levenshtein(left: bytes, right: bytes) -> int:
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, start=1):
        current = [i]
        for j, b in enumerate(right, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a != b)))
        previous = current
    return previous[-1]


def radare2_ratio(left: bytes, right: bytes) -> float:
    longest = max(len(left), len(right))
    return 1.0 if longest == 0 else 1.0 - levenshtein(left, right) / longest


def match_functions(left: list[FunctionRecord], right: list[FunctionRecord], stages: list[str] | None = None) -> MatchReport:
    order = stages or [stage.id for stage in STAGES]
    left_open = list(left)
    right_open = list(right)
    matches: list[Match] = []
    for stage in order:
        left_groups: dict[str, list[FunctionRecord]] = {}
        right_groups: dict[str, list[FunctionRecord]] = {}
        for record in left_open:
            left_groups.setdefault(record.signatures()[stage], []).append(record)
        for record in right_open:
            right_groups.setdefault(record.signatures()[stage], []).append(record)
        for signature, candidates in left_groups.items():
            partners = right_groups.get(signature, [])
            if len(candidates) != 1 or len(partners) != 1:
                continue
            a, b = candidates[0], partners[0]
            agreeing = [s.id for s in STAGES if a.signatures()[s.id] == b.signatures()[s.id]]
            data_equal = None if a.referenced_data is None or b.referenced_data is None else a.referenced_data == b.referenced_data
            matches.append(Match(a, b, stage, agreeing, radare2_ratio(a.raw, b.raw), data_equal))
            left_open.remove(a)
            right_open.remove(b)
    matches.sort(key=lambda m: m.left.start)
    left_name = left[0].source if left else ""
    right_name = right[0].source if right else ""
    loaded = bool(left and left[0].loaded)
    return MatchReport(left_name, right_name, loaded, matches, left_open, right_open, list(order))


def diff_fixtures(left: str, right: str, loaded: bool = False, stages: list[str] | None = None) -> MatchReport:
    return match_functions(fixture_records(left, loaded), fixture_records(right, loaded), stages)


RADIFF2_LINE = re.compile(r"^\s*sym\.(\S+)\s+(\d+)\s+0x([0-9a-f]+)\s+\|\s+(MATCH|UNMATCH)\s+\(([0-9.]+)\)\s+\|\s+0x([0-9a-f]+)\s+(\d+)\s+sym\.(\S+)\s*$")


def parse_radiff2(text: str) -> list[dict[str, Any]]:
    rows = []
    for line in text.splitlines():
        match = RADIFF2_LINE.match(line)
        if match:
            rows.append({
                "left": match.group(1),
                "leftSize": int(match.group(2)),
                "verdict": match.group(4),
                "ratio": float(match.group(5)),
                "rightSize": int(match.group(7)),
                "right": match.group(8),
            })
    return rows


def radiff2_fixture(name: str) -> list[dict[str, Any]]:
    path = FIXTURES / name
    return parse_radiff2(path.read_text()) if path.exists() else []


def parse_ghidra_vt(text: str) -> dict[str, Any]:
    report: dict[str, Any] = {"blocks": {"source": {}, "destination": {}}, "functions": {"source": {}, "destination": {}}, "correlators": {}, "matches": []}
    for line in text.splitlines():
        parts = line.strip().split("|")
        if len(parts) < 3 or parts[0] != "VT":
            continue
        kind = parts[1]
        if kind == "ghidra":
            report["version"] = parts[2]
        elif kind == "block" and "::" not in parts[4]:
            report["blocks"][parts[2]][parts[3]] = {"start": int(parts[4], 16), "end": int(parts[5], 16), "size": int(parts[6])}
        elif kind == "function":
            report["functions"][parts[2]][parts[3]] = {"entry": int(parts[4], 16), "size": int(parts[5])}
        elif kind == "correlator":
            report["correlators"][parts[2]] = int(parts[3])
        elif kind == "match":
            report["matches"].append({
                "correlator": parts[2],
                "source": parts[3],
                "sourceAddress": int(parts[4], 16),
                "sourceLength": int(parts[5]),
                "destination": parts[6],
                "destinationAddress": int(parts[7], 16),
                "destinationLength": int(parts[8]),
                "type": parts[9],
                "similarity": float(parts[10]),
                "confidence": float(parts[11]),
            })
    return report


def ghidra_fixture(name: str) -> dict[str, Any]:
    path = FIXTURES / name
    return parse_ghidra_vt(path.read_text()) if path.exists() else {"blocks": {}, "functions": {}, "correlators": {}, "matches": []}


def ghidra_functions_matched(report: dict[str, Any], correlator: str) -> list[str]:
    return sorted(m["source"] for m in report["matches"] if m["correlator"] == correlator and m["type"] == "Function")


def angr_fixture() -> dict[str, Any]:
    path = FIXTURES / "angr-runs.json"
    return json.loads(path.read_text()) if path.exists() else {}


def z3_fixture() -> dict[str, Any]:
    path = FIXTURES / "z3-runs.json"
    return json.loads(path.read_text()) if path.exists() else {}


@dataclass(frozen=True)
class Const:
    value: int
    width: int = 32


@dataclass(frozen=True)
class Var:
    name: str
    width: int = 32


@dataclass(frozen=True)
class Bin:
    op: str
    left: Any
    right: Any
    width: int = 32


@dataclass(frozen=True)
class Not:
    expr: Any


@dataclass(frozen=True)
class Cast:
    kind: str
    expr: Any
    width: int


@dataclass(frozen=True)
class Load:
    table: str
    index: Any
    width: int = 32


@dataclass(frozen=True)
class Assign:
    dst: Var
    src: Any


@dataclass(frozen=True)
class Branch:
    cond: Any
    target: int
    fallthrough: int


@dataclass(frozen=True)
class Jump:
    target: int


@dataclass(frozen=True)
class Switch:
    index: Any
    targets: tuple[int, ...]


@dataclass(frozen=True)
class Return:
    value: Any


@dataclass
class IRBlock:
    start: int
    stmts: list[Any]
    insns: list[int]
    next: int | None = None


@dataclass
class IRFunction:
    name: str
    source: str
    entry: int
    params: list[Var]
    blocks: dict[int, IRBlock]
    tables: dict[str, list[int]]


class IRError(ValueError):
    pass


def to_signed(value: int, width: int) -> int:
    value &= (1 << width) - 1
    return value - (1 << width) if value & (1 << (width - 1)) else value


def to_unsigned(value: int, width: int) -> int:
    return value & ((1 << width) - 1)


def c_divide(dividend: int, divisor: int) -> int:
    if divisor == 0:
        raise ZeroDivisionError("division by zero in the path")
    quotient = abs(dividend) // abs(divisor)
    return quotient if (dividend < 0) == (divisor < 0) else -quotient


def evaluate(expr: Any, assignment: dict[str, int], tables: dict[str, list[int]]) -> int:
    if isinstance(expr, Const):
        return to_signed(expr.value, expr.width)
    if isinstance(expr, Var):
        if expr.name not in assignment:
            raise IRError(f"no value for {expr.name}")
        return to_signed(assignment[expr.name], expr.width)
    if isinstance(expr, Not):
        return 0 if evaluate(expr.expr, assignment, tables) else 1
    if isinstance(expr, Cast):
        inner = evaluate(expr.expr, assignment, tables)
        if expr.kind == "zext":
            return to_signed(to_unsigned(inner, width_of(expr.expr)), expr.width)
        return to_signed(inner, expr.width)
    if isinstance(expr, Load):
        index = evaluate(expr.index, assignment, tables)
        table = tables[expr.table]
        if not 0 <= index < len(table):
            raise IndexError(f"index {index} outside {expr.table}")
        return to_signed(table[index], expr.width)
    if isinstance(expr, Bin):
        a = evaluate(expr.left, assignment, tables)
        b = evaluate(expr.right, assignment, tables)
        width = expr.width
        if expr.op == "+":
            return to_signed(a + b, width)
        if expr.op == "-":
            return to_signed(a - b, width)
        if expr.op == "*":
            return to_signed(a * b, width)
        if expr.op == "/":
            return to_signed(c_divide(a, b), width)
        if expr.op == "<<":
            return to_signed(a << b, width)
        if expr.op == ">>":
            return a >> b
        if expr.op == ">>u":
            return to_signed(to_unsigned(a, width_of(expr.left)) >> b, width)
        if expr.op == "==":
            return int(a == b)
        if expr.op == "!=":
            return int(a != b)
        if expr.op == "<":
            return int(a < b)
        if expr.op == "<=":
            return int(a <= b)
        if expr.op == ">":
            return int(a > b)
        if expr.op == ">=":
            return int(a >= b)
        operand_width = width_of(expr.left)
        ua, ub = to_unsigned(a, operand_width), to_unsigned(b, operand_width)
        if expr.op == "<u":
            return int(ua < ub)
        if expr.op == "<=u":
            return int(ua <= ub)
        if expr.op == ">u":
            return int(ua > ub)
        if expr.op == ">=u":
            return int(ua >= ub)
        if expr.op == "&&":
            return int(bool(a) and bool(b))
        if expr.op == "||":
            return int(bool(a) or bool(b))
        raise IRError(f"unknown operator {expr.op}")
    raise IRError(f"cannot evaluate {expr!r}")


def width_of(expr: Any) -> int:
    if isinstance(expr, (Const, Var, Bin, Cast, Load)):
        return expr.width
    return 1


def substitute(expr: Any, env: dict[str, Any]) -> Any:
    if isinstance(expr, Var):
        return env.get(expr.name, expr)
    if isinstance(expr, Not):
        return Not(substitute(expr.expr, env))
    if isinstance(expr, Cast):
        inner = substitute(expr.expr, env)
        if isinstance(inner, Const):
            return Const(evaluate(Cast(expr.kind, inner, expr.width), {}, {}), expr.width)
        return Cast(expr.kind, inner, expr.width)
    if isinstance(expr, Load):
        return Load(expr.table, substitute(expr.index, env), expr.width)
    if isinstance(expr, Bin):
        left = substitute(expr.left, env)
        right = substitute(expr.right, env)
        if isinstance(left, Const) and isinstance(right, Const) and expr.op not in ("/",):
            return Const(evaluate(Bin(expr.op, left, right, expr.width), {}, {}), expr.width)
        return Bin(expr.op, left, right, expr.width)
    return expr


PRECEDENCE = {"||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "<u": 4, "<=u": 4, ">u": 4, ">=u": 4, "<<": 5, ">>": 5, ">>u": 5, "+": 6, "-": 6, "*": 7, "/": 7}


def render(expr: Any, parent: int = 0) -> str:
    if isinstance(expr, Const):
        return str(to_signed(expr.value, expr.width))
    if isinstance(expr, Var):
        return expr.name
    if isinstance(expr, Not):
        return "!(" + render(expr.expr) + ")"
    if isinstance(expr, Cast):
        return f"{expr.kind}{expr.width}({render(expr.expr)})"
    if isinstance(expr, Load):
        return f"{expr.table}[{render(expr.index)}]"
    if isinstance(expr, Bin):
        level = PRECEDENCE[expr.op]
        text = f"{render(expr.left, level)} {expr.op} {render(expr.right, level + 1)}"
        return f"({text})" if level < parent else text
    return repr(expr)


class BoundedSearch:
    def __init__(self, domains: dict[str, range], tables: dict[str, list[int]] | None = None) -> None:
        self.domains = domains
        self.tables = tables or {}
        self.evaluations = 0

    def holds(self, constraints: list[Any], assignment: dict[str, int]) -> bool:
        for constraint in constraints:
            self.evaluations += 1
            try:
                if not evaluate(constraint, assignment, self.tables):
                    return False
            except (ZeroDivisionError, IndexError):
                return False
        return True

    def models(self, constraints: list[Any]) -> Iterator[dict[str, int]]:
        names = list(self.domains)
        for values in itertools.product(*(self.domains[n] for n in names)):
            assignment = dict(zip(names, values))
            if self.holds(constraints, assignment):
                yield assignment

    def satisfiable(self, constraints: list[Any]) -> bool:
        return next(self.models(constraints), None) is not None

    def solve(self, constraints: list[Any]) -> dict[str, int] | None:
        return next(self.models(constraints), None)

    def summarize(self, constraints: list[Any], name: str) -> dict[str, Any] | None:
        values = [m[name] for m in self.models(constraints)]
        if not values:
            return None
        return {"count": len(values), "min": min(values), "max": max(values), "sample": values[0]}


@dataclass
class PathState:
    block: int
    trace: list[int]
    condition: list[Any]
    env: dict[str, Any]
    returned: Any = None
    status: str = "active"

    def fork(self, block: int, extra: Any | None) -> "PathState":
        condition = self.condition + ([extra] if extra is not None else [])
        return PathState(block, self.trace + [block], condition, dict(self.env))

    def describe(self) -> str:
        return " && ".join(render(c, PRECEDENCE["&&"]) for c in self.condition) or "true"

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace": [f"0x{b:x}" for b in self.trace],
            "condition": self.describe(),
            "returns": render(self.returned) if self.returned is not None else None,
            "status": self.status,
        }


def execute(function: IRFunction, solver: BoundedSearch, step_limit: int = 64) -> list[PathState]:
    solver.tables = function.tables
    start = PathState(function.entry, [function.entry], [], {p.name: p for p in function.params})
    worklist = [start]
    finished: list[PathState] = []
    while worklist:
        path = worklist.pop()
        if len(path.trace) > step_limit:
            path.status = "truncated"
            finished.append(path)
            continue
        block = function.blocks[path.block]
        successors: list[PathState] = []
        terminated = False
        for stmt in block.stmts:
            if isinstance(stmt, Assign):
                path.env[stmt.dst.name] = substitute(stmt.src, path.env)
            elif isinstance(stmt, Branch):
                cond = substitute(stmt.cond, path.env)
                for extra, target in ((cond, stmt.target), (Not(cond), stmt.fallthrough)):
                    if solver.satisfiable(path.condition + [extra]):
                        successors.append(path.fork(target, extra))
                terminated = True
            elif isinstance(stmt, Jump):
                successors.append(path.fork(stmt.target, None))
                terminated = True
            elif isinstance(stmt, Switch):
                index = substitute(stmt.index, path.env)
                by_target: dict[int, list[int]] = {}
                for entry, target in enumerate(stmt.targets):
                    by_target.setdefault(target, []).append(entry)
                for target, entries in by_target.items():
                    extra: Any = Bin("==", index, Const(entries[0]))
                    for entry in entries[1:]:
                        extra = Bin("||", extra, Bin("==", index, Const(entry)), 1)
                    if solver.satisfiable(path.condition + [extra]):
                        successors.append(path.fork(target, extra))
                terminated = True
            elif isinstance(stmt, Return):
                path.returned = substitute(stmt.value, path.env)
                path.status = "returned"
                finished.append(path)
                terminated = True
            if terminated:
                break
        if not terminated:
            if block.next is None:
                raise IRError(f"block 0x{block.start:x} has no terminator and no fallthrough")
            successors.append(path.fork(block.next, None))
        worklist.extend(reversed(successors))
    finished.sort(key=lambda p: p.trace)
    return finished


def solve_returns(paths: list[PathState], solver: BoundedSearch, variable: str, values: list[int]) -> dict[int, list[dict[str, Any]]]:
    classes: dict[int, list[dict[str, Any]]] = {}
    for value in values:
        hits = []
        for path in paths:
            if path.status != "returned":
                continue
            summary = solver.summarize(path.condition + [Bin("==", path.returned, Const(value))], variable)
            if summary is not None:
                summary["leaf"] = f"0x{path.trace[-1]:x}"
                hits.append(summary)
        classes[value] = hits
    return classes


def rodata_table(elf: ElfObject, offset: int, count: int) -> list[int]:
    return [elf.read_u32(".rodata", offset + 4 * index) for index in range(count)]


def grade_ir_o0(elf: ElfObject | None = None) -> IRFunction:
    elf = elf or load_fixture(LEVELS["O0"])
    score = Var("score")
    quotient = Bin("-", Bin("/", score, Const(10)), Const(6))
    targets = tuple(jump_table_targets(elf, *elf.function_extent("grade")))
    blocks = {
        0x30: IRBlock(0x30, [Assign(Var("local_8"), score), Assign(Var("local_10"), quotient), Branch(Bin(">u", Var("local_10"), Const(4)), 0x9A, 0x62)], [0x30, 0x31, 0x34, 0x37, 0x3B, 0x42, 0x45, 0x49, 0x4B, 0x4F, 0x51, 0x53, 0x57, 0x59, 0x5D, 0x60]),
        0x62: IRBlock(0x62, [Switch(Var("local_10"), targets)], [0x62, 0x66, 0x6D, 0x71, 0x74]),
        0x76: IRBlock(0x76, [Assign(Var("local_4"), Const(4)), Jump(0xA1)], [0x76, 0x7D]),
        0x7F: IRBlock(0x7F, [Assign(Var("local_4"), Const(3)), Jump(0xA1)], [0x7F, 0x86]),
        0x88: IRBlock(0x88, [Assign(Var("local_4"), Const(2)), Jump(0xA1)], [0x88, 0x8F]),
        0x91: IRBlock(0x91, [Assign(Var("local_4"), Const(1)), Jump(0xA1)], [0x91, 0x98]),
        0x9A: IRBlock(0x9A, [Assign(Var("local_4"), Const(0))], [0x9A], next=0xA1),
        0xA1: IRBlock(0xA1, [Return(Var("local_4"))], [0xA1, 0xA4, 0xA5]),
    }
    return IRFunction("grade", LEVELS["O0"], 0x30, [score], blocks, {})


def grade_ir_o1(elf: ElfObject | None = None) -> IRFunction:
    elf = elf or load_fixture(LEVELS["O1"])
    score = Var("score")
    quotient = Bin("-", Bin("/", score, Const(10)), Const(6))
    blocks = {
        0x10: IRBlock(0x10, [Assign(Var("ecx"), quotient), Assign(Var("eax"), Const(0)), Branch(Bin(">u", Var("ecx"), Const(4)), 0x3D, 0x31)], [0x10, 0x13, 0x1A, 0x1D, 0x21, 0x25, 0x27, 0x2A, 0x2C, 0x2F]),
        0x31: IRBlock(0x31, [Assign(Var("eax"), Load("lookup_14", Var("ecx")))], [0x31, 0x33, 0x3A], next=0x3D),
        0x3D: IRBlock(0x3D, [Return(Var("eax"))], [0x3D]),
    }
    return IRFunction("grade", LEVELS["O1"], 0x10, [score], blocks, {"lookup_14": rodata_table(elf, 0x14, 5)})


def percent_change_ir_o1() -> IRFunction:
    before, after = Var("before"), Var("after")
    blocks = {
        0x0: IRBlock(0x0, [Branch(Bin("==", before, Const(0)), 0xD, 0x4)], [0x0, 0x2]),
        0x4: IRBlock(0x4, [Return(Bin("/", Bin("*", Bin("-", after, before), Const(100)), before))], [0x4, 0x6, 0x9, 0xA, 0xC]),
        0xD: IRBlock(0xD, [Return(Const(0))], [0xD, 0xF]),
    }
    return IRFunction("percent_change", LEVELS["O1"], 0x0, [before, after], blocks, {})


def total_ir_o1(values: list[int]) -> IRFunction:
    count = Var("count")
    blocks = {
        0x40: IRBlock(0x40, [Branch(Bin("<=", count, Const(0)), 0x5C, 0x44)], [0x40, 0x42]),
        0x44: IRBlock(0x44, [Assign(Var("rcx", 64), Cast("zext", count, 64)), Assign(Var("rdx", 64), Const(0, 64)), Assign(Var("eax"), Const(0))], [0x44, 0x46, 0x48, 0x4A], next=0x50),
        0x50: IRBlock(0x50, [Assign(Var("eax"), Bin("+", Var("eax"), Load("values", Var("rdx", 64)))), Assign(Var("rdx", 64), Bin("+", Var("rdx", 64), Const(1, 64), 64)), Branch(Bin("!=", Var("rdx", 64), Var("rcx", 64), 64), 0x50, 0x5B)], [0x50, 0x53, 0x56, 0x59]),
        0x5B: IRBlock(0x5B, [Return(Var("eax"))], [0x5B]),
        0x5C: IRBlock(0x5C, [Return(Const(0))], [0x5C, 0x5E]),
    }
    return IRFunction("total", LEVELS["O1"], 0x40, [count], blocks, {"values": list(values)})


SCORE_DOMAIN = range(-200, 1201)
PERCENT_DOMAIN = range(-16, 17)
TOTAL_VALUES = list(range(1, 10))


def check_ir_against_listing(function: IRFunction) -> list[str]:
    start, end = load_fixture(function.source).function_extent(function.name)
    listing = [i for i in fixture_listing(function.source)[function.name] if start <= i.address < end]
    addresses = {i.address for i in listing}
    problems = []
    for block in function.blocks.values():
        for address in block.insns:
            if address not in addresses:
                problems.append(f"0x{address:x} is not an instruction of {function.name} in {function.source}")
    claimed = sorted(a for b in function.blocks.values() for a in b.insns)
    if claimed != sorted(i.address for i in listing):
        problems.append("the IR does not cover every instruction once")
    return problems


def grade_paths(level: str = "O0") -> dict[str, Any]:
    function = grade_ir_o0() if level == "O0" else grade_ir_o1()
    solver = BoundedSearch({"score": SCORE_DOMAIN})
    started = time.perf_counter()
    paths = execute(function, solver)
    seconds = round(time.perf_counter() - started, 3)
    classes = solve_returns(paths, solver, "score", [0, 1, 2, 3, 4])
    return {
        "function": function.name,
        "object": function.source,
        "domain": [SCORE_DOMAIN.start, SCORE_DOMAIN.stop - 1],
        "paths": [p.to_dict() for p in paths],
        "pathCount": len(paths),
        "seconds": seconds,
        "evaluations": solver.evaluations,
        "returns": {str(value): hits for value, hits in classes.items()},
    }


def percent_change_paths() -> dict[str, Any]:
    function = percent_change_ir_o1()
    solver = BoundedSearch({"before": PERCENT_DOMAIN, "after": PERCENT_DOMAIN})
    paths = execute(function, solver)
    nonzero = next(p for p in paths if p.status == "returned" and not isinstance(p.returned, Const))
    returns_50 = solver.solve(nonzero.condition + [Bin("==", nonzero.returned, Const(50))])
    minus_133 = solver.solve(nonzero.condition + [Bin("==", nonzero.returned, Const(-133)), Bin("==", Var("before"), Const(3))])
    return {
        "function": function.name,
        "object": function.source,
        "domain": [PERCENT_DOMAIN.start, PERCENT_DOMAIN.stop - 1],
        "paths": [p.to_dict() for p in paths],
        "pathCount": len(paths),
        "returns50": returns_50,
        "before3ReturnsMinus133": minus_133,
    }


def total_paths(bound: int, step_limit: int = 64) -> dict[str, Any]:
    values = TOTAL_VALUES if bound < len(TOTAL_VALUES) else list(range(1, bound + 2))
    function = total_ir_o1(values)
    solver = BoundedSearch({"count": range(0, bound + 1)})
    started = time.perf_counter()
    paths = execute(function, solver, step_limit)
    seconds = round(time.perf_counter() - started, 3)
    pairs = []
    for path in paths:
        if path.status != "returned":
            continue
        model = solver.solve(path.condition)
        assert model is not None
        pairs.append([model["count"], evaluate(path.returned, model, function.tables)])
    return {
        "bound": bound,
        "pathCount": len(paths),
        "returned": sum(1 for p in paths if p.status == "returned"),
        "truncated": sum(1 for p in paths if p.status == "truncated"),
        "seconds": seconds,
        "evaluations": solver.evaluations,
        "countSum": sorted(pairs),
    }


def explosion_report() -> dict[str, Any]:
    return {
        "bounded": [total_paths(bound) for bound in (2, 4, 8)],
        "capped": total_paths(64, step_limit=24),
    }


def tool_comparison(left: str, right: str, radiff_name: str, ghidra_name: str) -> dict[str, Any]:
    objects = diff_fixtures(left, right)
    images = diff_fixtures(left, right, loaded=True)
    radiff = {row["left"]: row for row in radiff2_fixture(radiff_name)}
    ghidra = ghidra_fixture(ghidra_name)
    rows = []
    for record in fixture_records(left):
        name = record.name
        correlators = sorted(m["correlator"] for m in ghidra["matches"] if m["source"] == name and m["type"] == "Function")
        rows.append({
            "function": name,
            "objectStage": objects.stage_of(name),
            "imageStage": images.stage_of(name),
            "radiff2": {"verdict": radiff[name]["verdict"], "ratio": radiff[name]["ratio"]} if name in radiff else None,
            "ghidra": correlators,
        })
    return {"left": left, "right": right, "rows": rows, "ghidraCorrelatorCounts": ghidra.get("correlators", {}), "ghidraBlocks": ghidra.get("blocks", {})}


def radare2_ratio_check() -> dict[str, Any]:
    o0 = {r.name: r for r in fixture_records(LEVELS["O0"])}
    o1 = {r.name: r for r in fixture_records(LEVELS["O1"])}
    o2 = {r.name: r for r in fixture_records(LEVELS["O2"])}
    grade_without_table = function_record(load_fixture(LEVELS["O0"]), fixture_listing(LEVELS["O0"]), "grade")
    blocks, _ = build_cfg(grade_without_table.instructions, grade_without_table.start, grade_without_table.end, [])
    grade_without_table.blocks = blocks
    return {
        "percent_change O0 vs O1": round(radare2_ratio(o0["percent_change"].raw, o1["percent_change"].raw), 6),
        "total O0 vs O1": round(radare2_ratio(o0["total"].raw, o1["total"].raw), 6),
        "grade_label O0 vs O1": round(radare2_ratio(o0["grade_label"].raw, o1["grade_label"].raw), 6),
        "total O1 vs O2": round(radare2_ratio(o1["total"].raw, o2["total"].raw), 6),
        "grade O0 vs O1, 118 bytes": round(radare2_ratio(o0["grade"].raw, o1["grade"].raw), 6),
        "grade O0 vs O1, 82 reachable bytes without the table": round(radare2_ratio(grade_without_table.reachable_bytes(), o1["grade"].raw), 6),
        "fingerprintBytesWithoutTable": len(grade_without_table.reachable_bytes()),
    }


def grade_relocation_case() -> dict[str, Any]:
    left_elf, right_elf = load_fixture(LEVELS["O1"]), load_fixture(LEVELS["O2"])
    left_image, right_image = load_image(left_elf), load_image(right_elf)
    left = function_record(left_elf, fixture_listing(LEVELS["O1"]), "grade", left_image)
    right = function_record(right_elf, fixture_listing(LEVELS["O2"]), "grade", right_image)
    lea_left = next(r for r in left.relocations)
    field_left = left.raw[lea_left.offset - left.start : lea_left.offset - left.start + 4]
    field_right = right.raw[lea_left.offset - right.start : lea_left.offset - right.start + 4]
    return {
        "layout": {
            LEVELS["O1"]: {name: hex(a) for name, a in left_image.addresses.items()},
            LEVELS["O2"]: {name: hex(a) for name, a in right_image.addresses.items()},
        },
        "rodataShift": right_image.addresses[".rodata"] - left_image.addresses[".rodata"],
        "relocation": lea_left.describe(left_elf),
        "fieldOffset": lea_left.offset,
        "fieldBytes": {LEVELS["O1"]: field_left.hex(" "), LEVELS["O2"]: field_right.hex(" ")},
        "displacements": {LEVELS["O1"]: struct.unpack("<i", field_left)[0], LEVELS["O2"]: struct.unpack("<i", field_right)[0]},
        "objectBytesEqual": function_record(left_elf, fixture_listing(LEVELS["O1"]), "grade").raw == function_record(right_elf, fixture_listing(LEVELS["O2"]), "grade").raw,
        "imageBytesEqual": left.raw == right.raw,
        "maskedImageBytesEqual": left.masked_bytes() == right.masked_bytes(),
    }


def figure_data() -> dict[str, Any]:
    objects = diff_fixtures(LEVELS["O1"], LEVELS["O2"])
    images = diff_fixtures(LEVELS["O1"], LEVELS["O2"], loaded=True)
    relocation = grade_relocation_case()

    def column(records: list[FunctionRecord]) -> list[dict[str, Any]]:
        return [{"name": r.name, "start": r.start, "size": r.size, "insns": len(r.instructions), "blocks": len(r.blocks), "edges": len(r.edges)} for r in records]

    def view(report: MatchReport) -> dict[str, Any]:
        return {
            "matches": [{"left": m.left.name, "right": m.right.name, "stage": m.stage, "agreeing": m.agreeing, "similarity": round(m.similarity, 3)} for m in report.matches],
            "unmatchedLeft": [f.name for f in report.unmatched_left],
            "unmatchedRight": [f.name for f in report.unmatched_right],
        }

    tree = grade_paths("O0")
    function = grade_ir_o0()
    angr = angr_fixture().get("objects", {}).get(LEVELS["O0"], {}).get("grade", {}).get("returns", {})
    z3 = z3_fixture().get("grade", {}).get("returns", {})
    leaves = []
    for path in tree["paths"]:
        leaf = path["trace"][-1]
        value = int(path["returns"])
        mine = next((h for h in tree["returns"][str(value)] if h["leaf"] == leaf), None)
        angr_hit = (angr.get(str(value)) or [None])[0]
        z3_hit = z3.get(str(value))
        leaves.append({
            "leaf": leaf,
            "case": path["trace"][-2],
            "returns": value,
            "condition": path["condition"],
            "trace": path["trace"],
            "bounded": {k: mine[k] for k in ("count", "min", "max", "sample")} if mine else None,
            "angr": {"min": angr_hit["min"], "max": angr_hit["max"]} if angr_hit else None,
            "z3": {"min": z3_hit["min"], "max": z3_hit["max"]} if z3_hit else None,
        })
    edges = []
    for block in function.blocks.values():
        for stmt in block.stmts:
            if isinstance(stmt, Branch):
                edges.append({"from": f"0x{block.start:x}", "to": f"0x{stmt.target:x}", "cond": render(stmt.cond)})
                edges.append({"from": f"0x{block.start:x}", "to": f"0x{stmt.fallthrough:x}", "cond": "!(" + render(stmt.cond) + ")"})
            elif isinstance(stmt, Switch):
                by_target: dict[int, list[int]] = {}
                for entry, target in enumerate(stmt.targets):
                    by_target.setdefault(target, []).append(entry)
                for target, entries in by_target.items():
                    edges.append({"from": f"0x{block.start:x}", "to": f"0x{target:x}", "cond": " || ".join(f"{render(stmt.index)} == {e}" for e in entries)})
            elif isinstance(stmt, Jump):
                edges.append({"from": f"0x{block.start:x}", "to": f"0x{stmt.target:x}", "cond": ""})
        if block.next is not None:
            edges.append({"from": f"0x{block.start:x}", "to": f"0x{block.next:x}", "cond": ""})
    labels = {}
    for block in function.blocks.values():
        parts = []
        for stmt in block.stmts:
            if isinstance(stmt, Assign) and stmt.dst.name != "local_8":
                parts.append(f"{stmt.dst.name} = {render(stmt.src)}")
            elif isinstance(stmt, Return):
                parts.append(f"return {render(stmt.value)}")
            elif isinstance(stmt, Switch):
                parts.append(f"switch {render(stmt.index)}")
        labels[f"0x{block.start:x}"] = parts
    return {
        "stages": [{"id": s.id, "label": s.label, "quality": s.quality, "ghidra": s.ghidra} for s in STAGES],
        "left": {"object": LEVELS["O1"], "functions": column(fixture_records(LEVELS["O1"]))},
        "right": {"object": LEVELS["O2"], "functions": column(fixture_records(LEVELS["O2"]))},
        "views": {"object": view(objects), "image": view(images)},
        "relocation": {"shift": relocation["rodataShift"], "displacements": relocation["displacements"], "field": relocation["fieldOffset"]},
        "tree": {
            "function": "grade",
            "object": LEVELS["O0"],
            "entry": "0x30",
            "domain": tree["domain"],
            "labels": labels,
            "edges": edges,
            "leaves": leaves,
            "pathCount": tree["pathCount"],
        },
    }


def demo() -> dict[str, Any]:
    pairs = [(LEVELS["O0"], LEVELS["O1"], "radiff2-AC-O0-vs-O1.txt", "ghidra-vt-O0-vs-O1.txt"), (LEVELS["O1"], LEVELS["O2"], "radiff2-AC-O1-vs-O2.txt", "ghidra-vt-O1-vs-O2.txt")]
    report: dict[str, Any] = {"diffs": [], "toolComparison": [], "patch": None, "radare2Ratios": radare2_ratio_check(), "gradeRelocationCase": grade_relocation_case(), "symbolic": {}}
    for left, right, radiff_name, ghidra_name in pairs:
        report["diffs"].append(diff_fixtures(left, right).to_dict())
        report["diffs"].append(diff_fixtures(left, right, loaded=True).to_dict())
        report["toolComparison"].append(tool_comparison(left, right, radiff_name, ghidra_name))
    report["diffs"].append(diff_fixtures(LEVELS["O0"], LEVELS["O1"], stages=BINDIFF_ORDER).to_dict())
    report["patch"] = diff_fixtures(LEVELS["O1"], "grade_case10_wrong.o").to_dict()
    report["symbolic"] = {
        "grade O0": grade_paths("O0"),
        "grade O1": grade_paths("O1"),
        "percent_change O1": percent_change_paths(),
        "total O1": explosion_report(),
    }
    return report


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "diff" and len(argv) in (3, 4):
        loaded = len(argv) == 4 and argv[3] == "--image"
        left, right = Path(argv[1]), Path(argv[2])
        left_elf, right_elf = read_object(left), read_object(right)
        left_listing = parse_listing(left.with_suffix(".objdump.txt").read_text())
        right_listing = parse_listing(right.with_suffix(".objdump.txt").read_text())
        left_records = function_records(left_elf, left_listing, load_image(left_elf) if loaded else None)
        right_records = function_records(right_elf, right_listing, load_image(right_elf) if loaded else None)
        print(json.dumps(match_functions(left_records, right_records).to_dict(), indent=2))
        return 0
    if command == "paths" and len(argv) >= 2:
        if argv[1] == "grade":
            print(json.dumps(grade_paths(argv[2] if len(argv) > 2 else "O0"), indent=2))
        elif argv[1] == "percent_change":
            print(json.dumps(percent_change_paths(), indent=2))
        elif argv[1] == "total":
            print(json.dumps(total_paths(int(argv[2]) if len(argv) > 2 else 2), indent=2))
        else:
            print("usage: main.py paths [grade O0|O1 | percent_change | total BOUND]", file=sys.stderr)
            return 2
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [diff A.o B.o [--image] | paths FUNCTION ... | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
