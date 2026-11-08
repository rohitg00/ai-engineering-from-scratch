"""Companion code for docs/en.md: recognize compiler idioms in llvm-objdump listings of our own fixtures.
Division by constant: Granlund and Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994).
Switch lowering kinds follow the LLVM names: jump table, lookup table, linear map, comparison tree, compare chain.
Run `python3 main.py` for the report or `python3 -m unittest discover -s tests` for the suite.
"""

from __future__ import annotations

import json
import re
import struct
import sys
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"

LEVELS = ["O0", "O1", "O2", "O3"]
ARCHES = ["x86_64", "arm64"]
PARAM_REGISTERS = {
    "x86_64": ["di", "si", "d", "c", "r8", "r9"],
    "arm64": ["0", "1", "2", "3", "4", "5", "6", "7"],
}
SIMD_REGISTER = re.compile(r"%[xy]mm\d+|\bv\d+\.\d+[bhsd]\b|\bq\d+\b")
X86_SIZE_SUFFIX = {"q", "l", "w", "b"}
X86_CONDITIONS = {
    "e": "==", "ne": "!=", "g": ">", "ge": ">=", "l": "<", "le": "<=",
    "a": ">", "ae": ">=", "b": "<", "be": "<=", "s": "< 0", "ns": ">= 0",
}
ARM_CONDITIONS = {
    "eq": "==", "ne": "!=", "gt": ">", "ge": ">=", "lt": "<", "le": "<=",
    "hi": ">", "hs": ">=", "cs": ">=", "lo": "<", "cc": "<", "ls": "<=", "mi": "< 0", "pl": ">= 0",
}
UNSIGNED_CONDITIONS = {"a", "ae", "b", "be", "hi", "hs", "cs", "lo", "cc", "ls"}


@dataclass(frozen=True)
class Instruction:
    address: int
    raw: str
    mnemonic: str
    operands: tuple[str, ...]
    size: int
    relocation: tuple[str, str] | None = None

    @property
    def text(self) -> str:
        return self.mnemonic + (" " + ", ".join(self.operands) if self.operands else "")

    @property
    def end(self) -> int:
        return self.address + self.size

    @property
    def relocation_symbol(self) -> str | None:
        if self.relocation is None:
            return None
        return re.match(r"([^+-]+)", self.relocation[1]).group(1)

    @property
    def relocation_addend(self) -> int:
        if self.relocation is None:
            return 0
        match = re.search(r"([+-]0x[0-9a-f]+)$", self.relocation[1])
        return int(match.group(1), 16) if match else 0


@dataclass
class Function:
    name: str
    start: int
    arch: str
    instructions: list[Instruction] = field(default_factory=list)

    @property
    def end(self) -> int:
        return self.instructions[-1].end if self.instructions else self.start

    def at(self, address: int) -> Instruction | None:
        for instruction in self.instructions:
            if instruction.address == address:
                return instruction
        return None

    def index(self, address: int) -> int:
        for position, instruction in enumerate(self.instructions):
            if instruction.address == address:
                return position
        raise KeyError(hex(address))

    def body(self) -> list[Instruction]:
        return [i for i in self.instructions if not i.mnemonic.startswith("nop")]


@dataclass
class Listing:
    name: str
    arch: str
    functions: dict[str, Function]

    def text_of(self, function: str) -> str:
        return "\n".join(i.text for i in self.functions[function].instructions)


def split_operands(text: str) -> tuple[str, ...]:
    """Split on commas that are not inside () or []."""
    parts: list[str] = []
    depth = 0
    current = ""
    for char in text:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += char
    if current.strip():
        parts.append(current.strip())
    return tuple(parts)


HEADER = re.compile(r"^([0-9a-f]+) <([^>]+)>:$")
RELOC_LINE = re.compile(r"^\s*([0-9a-f]{16}):\s+(R_\w+)\s+(\S+)$")
INSN_LINE = re.compile(r"^\s*([0-9a-f]+):\s*(.*)$")
SYMBOL_SUFFIX = re.compile(r"\s*<[^>]*>")


def parse_listing(text: str, name: str = "") -> Listing:
    arch = "arm64" if "littleaarch64" in text else "x86_64"
    functions: dict[str, Function] = {}
    current: Function | None = None
    for line in text.splitlines():
        header = HEADER.match(line)
        if header:
            current = Function(header.group(2), int(header.group(1), 16), arch)
            functions[current.name] = current
            continue
        if current is None:
            continue
        reloc = RELOC_LINE.match(line)
        if reloc and current.instructions:
            last = current.instructions[-1]
            current.instructions[-1] = replace(last, relocation=(reloc.group(2), reloc.group(3)))
            continue
        match = INSN_LINE.match(line)
        if not match or "\t" not in match.group(2):
            continue
        fields = match.group(2).split("\t")
        raw = " ".join(fields[0].split())
        mnemonic = fields[1].strip()
        operand_text = fields[2] if len(fields) > 2 else ""
        operand_text = operand_text.split("#", 1)[0] if arch == "x86_64" else operand_text.split("//", 1)[0]
        operand_text = SYMBOL_SUFFIX.sub("", operand_text).strip()
        size = 4 if arch == "arm64" else len(raw.split())
        current.instructions.append(Instruction(int(match.group(1), 16), raw, mnemonic, split_operands(operand_text), size))
    return Listing(name, arch, functions)


def load_listing(name: str) -> Listing:
    return parse_listing((FIXTURES / name).read_text(), name)


SHT_SYMTAB = 2
SHT_RELA = 4
SHT_NOBITS = 8
STT_SECTION = 3


class ElfFile:
    """Sections, symbols, and RELA relocations of an ELF64 relocatable object (x86-64 or AArch64)."""

    def __init__(self, data: bytes) -> None:
        if data[:4] != b"\x7fELF" or data[4] != 2:
            raise ValueError("not an ELF64 file")
        header = struct.unpack_from("<16sHHIQQQIHHHHHH", data, 0)
        self.machine = header[2]
        shoff, shentsize, shnum, shstrndx = header[6], header[11], header[12], header[13]
        raw = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + i * shentsize) for i in range(shnum)]
        names = raw[shstrndx]
        table = data[names[4] : names[4] + names[5]]
        self.sections: list[dict[str, Any]] = []
        for index, (sh_name, sh_type, _flags, _addr, sh_offset, sh_size, sh_link, sh_info, _align, _entsize) in enumerate(raw):
            end = table.find(b"\0", sh_name)
            payload = b"" if sh_type == SHT_NOBITS else data[sh_offset : sh_offset + sh_size]
            self.sections.append({"index": index, "name": table[sh_name:end].decode(), "type": sh_type, "data": payload, "link": sh_link, "info": sh_info, "size": sh_size})
        self.symbols: list[dict[str, Any]] = []
        for section in self.sections:
            if section["type"] != SHT_SYMTAB:
                continue
            strings = self.sections[section["link"]]["data"]
            for offset in range(0, section["size"], 24):
                st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", section["data"], offset)
                end = strings.find(b"\0", st_name)
                section_name = self.sections[st_shndx]["name"] if st_shndx < len(self.sections) else ""
                self.symbols.append({"name": strings[st_name:end].decode(), "value": st_value, "size": st_size, "type": st_info & 0xF, "section": section_name})
        self.relocations: dict[str, list[dict[str, Any]]] = {}
        for section in self.sections:
            if section["type"] != SHT_RELA:
                continue
            target = self.sections[section["info"]]["name"]
            for offset in range(0, section["size"], 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section["data"], offset)
                symbol = self.symbols[r_info >> 32]
                base = 0 if symbol["type"] == STT_SECTION else symbol["value"]
                self.relocations.setdefault(target, []).append({"offset": r_offset, "type": r_info & 0xFFFFFFFF, "symbol": symbol["section"] if symbol["type"] == STT_SECTION else symbol["name"], "base": base, "addend": r_addend})

    def section(self, name: str) -> bytes:
        for section in self.sections:
            if section["name"] == name:
                return section["data"]
        raise KeyError(name)

    def relocation_at(self, section: str, offset: int) -> dict[str, Any] | None:
        for relocation in self.relocations.get(section, []):
            if relocation["offset"] == offset:
                return relocation
        return None

    def words(self, section: str, offset: int, count: int, size: int = 4, signed: bool = True) -> list[int]:
        data = self.section(section)
        return [int.from_bytes(data[offset + k * size : offset + (k + 1) * size], "little", signed=signed) for k in range(count)]


def load_elf(name: str) -> ElfFile:
    return ElfFile((FIXTURES / name).read_bytes())


@dataclass(frozen=True)
class Magic:
    divisor: int
    multiplier: int
    shift: int
    bits: int
    signed: bool
    error: int

    @property
    def add(self) -> bool:
        """True when the multiplier does not fit the operand width and the compiler needs the add fix-up."""
        return self.multiplier >= (1 << (self.bits - (1 if self.signed else 0)))

    def to_dict(self) -> dict[str, Any]:
        return {"divisor": self.divisor, "multiplier": f"0x{self.multiplier:x}", "shift": self.shift, "error": self.error, "add": self.add, "signed": self.signed}


def magic_numbers(divisor: int, bits: int = 32, signed: bool = False) -> Magic:
    """Smallest shift s >= bits such that m = ceil(2^s / d) satisfies the Granlund-Montgomery bound
    m*d - 2^s <= 2^(s-bits) for unsigned n < 2^bits, or <= 2^(s-bits+1) for signed |n| < 2^(bits-1)."""
    if divisor < 2:
        raise ValueError("divisor must be at least 2")
    if divisor & (divisor - 1) == 0:
        raise ValueError("power of two: the compiler uses a shift, never the multiply")
    for shift in range(bits, 2 * bits + 1):
        multiplier = -(-(1 << shift) // divisor)
        error = multiplier * divisor - (1 << shift)
        bound = 1 << (shift - bits + (1 if signed else 0))
        if error <= bound:
            return Magic(divisor, multiplier, shift, bits, signed, error)
    raise ValueError("no magic number found")


def divisor_from_magic(multiplier: int, shift: int, bits: int = 32, signed: bool = False) -> int | None:
    """Recover d from the multiplier and total shift, and accept it only when magic_numbers(d) gives them back."""
    power = 1 << shift
    for candidate in (power // multiplier, power // multiplier + 1):
        if candidate >= 2:
            try:
                magic = magic_numbers(candidate, bits, signed)
            except ValueError:
                continue
            if magic.multiplier == multiplier and magic.shift == shift:
                return candidate
    return None


def evaluate_division(n: int, magic: Magic) -> int:
    """Run the instruction sequence the compiler emits for this magic and return the quotient."""
    bits = magic.bits
    mask = (1 << bits) - 1
    if magic.signed:
        product = n * magic.multiplier
        quotient = (product >> magic.shift) + ((product >> (2 * bits - 1)) & 1)
        return quotient
    if magic.add:
        reduced = magic.multiplier - (1 << bits)
        high = (n * reduced) >> bits
        return ((((n - high) & mask) >> 1) + high) >> (magic.shift - bits - 1)
    return (n * magic.multiplier) >> magic.shift


def c_div(a: int, b: int) -> int:
    quotient = abs(a) // abs(b)
    return quotient if (a < 0) == (b < 0) else -quotient


def check_identity(magic: Magic, samples: list[int]) -> bool:
    for n in samples:
        expected = c_div(n, magic.divisor) if magic.signed else n // magic.divisor
        if evaluate_division(n, magic) != expected:
            return False
    return True


def edge_values(bits: int = 32, signed: bool = False) -> list[int]:
    values: set[int] = set()
    top = (1 << (bits - 1)) if signed else (1 << bits)
    low = -top if signed else 0
    for k in range(bits):
        for delta in (-1, 0, 1):
            for candidate in ((1 << k) + delta, -(1 << k) + delta):
                if low <= candidate < top:
                    values.add(candidate)
    values.update([low, top - 1, 0, 1, 2, 3, 7, 9, 10, 11, 99, 100, 1000, 65535, 65536])
    return sorted(values)


@dataclass
class Val:
    coefficients: dict[str, int] = field(default_factory=dict)
    constant: int = 0
    text: str | None = None
    seeded: bool = False

    @staticmethod
    def const(value: int) -> "Val":
        return Val({}, value)

    @staticmethod
    def symbol(name: str) -> "Val":
        return Val({name: 1}, 0)

    @staticmethod
    def opaque(text: str, seeded: bool = False) -> "Val":
        return Val(text=text, seeded=seeded)

    @property
    def affine(self) -> bool:
        return self.text is None

    def is_const(self) -> bool:
        return self.affine and not self.coefficients

    def add(self, other: "Val") -> "Val":
        if self.affine and other.affine:
            merged = dict(self.coefficients)
            for name, value in other.coefficients.items():
                merged[name] = merged.get(name, 0) + value
            return Val({k: v for k, v in merged.items() if v}, self.constant + other.constant)
        if other.is_const() and other.constant == 0:
            return self
        if self.is_const() and self.constant == 0:
            return other
        if other.is_const() and other.constant < 0:
            return Val.opaque(f"{self} - {-other.constant}")
        return Val.opaque(f"{self} + {other}")

    def scale(self, factor: int) -> "Val":
        if self.affine:
            return Val({k: v * factor for k, v in self.coefficients.items()}, self.constant * factor)
        return Val.opaque(f"{self}*{factor}")

    def negate(self) -> "Val":
        return self.scale(-1) if self.affine else Val.opaque(f"-{self}")

    def sub(self, other: "Val") -> "Val":
        if self.affine and other.affine:
            return self.add(other.negate())
        return Val.opaque(f"{self} - {other}")

    def __str__(self) -> str:
        if not self.affine:
            return self.text or "?"
        terms = []
        for name, value in sorted(self.coefficients.items()):
            if value == 1:
                terms.append(name)
            elif value == -1:
                terms.append(f"-{name}")
            else:
                terms.append(f"{value}*{name}")
        if self.constant or not terms:
            terms.append(str(self.constant))
        rendered = " + ".join(terms).replace("+ -", "- ")
        return rendered


def x86_family(register: str) -> str | None:
    """%eax, %rax, %ax, %al -> 'a'; %r8d, %r8 -> 'r8'; %edi -> 'di'."""
    name = register.lstrip("%")
    match = re.fullmatch(r"r(\d+)[dwb]?", name)
    if match:
        return "r" + match.group(1)
    match = re.fullmatch(r"[re]?([abcd])[xlh]", name)
    if match:
        return match.group(1)
    match = re.fullmatch(r"[re]?([sd]i|[sb]p)l?", name)
    if match:
        return match.group(1)
    return None


def arm_family(register: str) -> str | None:
    match = re.fullmatch(r"[wx](\d+)", register)
    return match.group(1) if match else None


def register_family(arch: str, operand: str) -> str | None:
    if arch == "x86_64":
        return x86_family(operand) if operand.startswith("%") else None
    return arm_family(operand)


def parse_immediate(text: str) -> int | None:
    text = text.strip()
    if text.startswith("$") or text.startswith("#"):
        text = text[1:]
    match = re.fullmatch(r"(-?)0x([0-9a-f]+)", text)
    if match:
        value = int(match.group(2), 16)
        return -value if match.group(1) else value
    match = re.fullmatch(r"-?\d+", text)
    return int(text) if match else None


X86_MEMORY = re.compile(r"^(-?0x[0-9a-f]+|-?\d+)?\(([^,)]*)(?:,([^,)]+)(?:,(\d))?)?\)$")


@dataclass(frozen=True)
class MemoryOperand:
    base: str | None
    index: str | None
    scale: int
    displacement: int


def parse_x86_memory(operand: str) -> MemoryOperand | None:
    match = X86_MEMORY.match(operand)
    if not match:
        return None
    displacement = parse_immediate(match.group(1)) if match.group(1) else 0
    return MemoryOperand(match.group(2) or None, match.group(3), int(match.group(4) or 1), displacement or 0)


def parse_arm_memory(operand: str) -> MemoryOperand | None:
    match = re.fullmatch(r"\[([wx]\d+|sp)(?:, #(-?0x[0-9a-f]+|-?\d+))?\]", operand)
    if match:
        return MemoryOperand(match.group(1), None, 1, parse_immediate(match.group(2)) if match.group(2) else 0)
    match = re.fullmatch(r"\[([wx]\d+|sp), ([wx]\d+)(?:, (?:uxtw|lsl) #(\d))?\]", operand)
    if match:
        return MemoryOperand(match.group(1), match.group(2), 1 << int(match.group(3) or 0), 0)
    return None


def branch_target(instruction: Instruction) -> int | None:
    mnemonic = instruction.mnemonic
    if mnemonic.startswith("j") and instruction.operands and not instruction.operands[0].startswith("*"):
        return parse_immediate(instruction.operands[0])
    if mnemonic == "b" or mnemonic.startswith("b."):
        return parse_immediate(instruction.operands[-1]) if instruction.operands else None
    if mnemonic in ("cbz", "cbnz", "tbz", "tbnz"):
        return parse_immediate(instruction.operands[-1])
    return None


def is_branch(instruction: Instruction) -> bool:
    return branch_target(instruction) is not None


def is_conditional(instruction: Instruction) -> bool:
    return is_branch(instruction) and instruction.mnemonic not in ("jmp", "b")


def is_return(instruction: Instruction) -> bool:
    return instruction.mnemonic in ("retq", "ret")


def back_edges(function: Function) -> list[tuple[Instruction, int]]:
    """Branches whose target is at or before them and inside the function: each one closes a loop."""
    edges = []
    for instruction in function.instructions:
        target = branch_target(instruction)
        if target is not None and function.start <= target <= instruction.address:
            edges.append((instruction, target))
    return edges


def loop_body(function: Function, edge: tuple[Instruction, int]) -> list[Instruction]:
    branch, target = edge
    return [i for i in function.instructions if target <= i.address <= branch.address]


def is_terminator(instruction: Instruction) -> bool:
    return is_branch(instruction) or is_return(instruction) or instruction.mnemonic in ("jmpq", "br")


def is_unconditional(instruction: Instruction) -> bool:
    return instruction.mnemonic in ("jmp", "b", "jmpq", "br") or is_return(instruction)


def block_starts(function: Function) -> set[int]:
    starts = {function.start}
    for position, instruction in enumerate(function.instructions):
        target = branch_target(instruction)
        if target is not None:
            starts.add(target)
        if is_terminator(instruction) and position + 1 < len(function.instructions):
            starts.add(function.instructions[position + 1].address)
    return starts


def is_loop(function: Function, edge: tuple[Instruction, int]) -> bool:
    """A backward branch closes a loop only when the path from its target can reach it again.
    A target block that leaves the region with an unconditional jump is a shared tail, not a loop."""
    branch, target = edge
    for instruction in function.instructions:
        if instruction.address < target:
            continue
        if instruction.address >= branch.address:
            return True
        if is_return(instruction) or instruction.mnemonic in ("jmpq", "br"):
            return False
        if is_unconditional(instruction):
            jump = branch_target(instruction)
            return jump is not None and target <= jump <= branch.address
    return False


def loops(function: Function) -> list[tuple[Instruction, int]]:
    return [edge for edge in back_edges(function) if is_loop(function, edge)]


def slot_key(arch: str, operand: str) -> str | None:
    """Stack slots are tracked by their operand text so -O0 code can be followed through memory."""
    if arch == "x86_64":
        memory = parse_x86_memory(operand)
        if memory is not None and memory.base in ("%rbp", "%rsp") and memory.index is None:
            return operand
    else:
        memory = parse_arm_memory(operand)
        if memory is not None and memory.base in ("sp", "x29") and memory.index is None:
            return operand
    return None


class Evaluator:
    """Forward symbolic pass over the basic blocks of a function in listing order. Parameters get their
    C names, stack slots are tracked by operand text, other registers start opaque. States of the
    predecessors are merged at each block entry; where they differ a seeded source name wins, else the
    value is opaque. Seeds rename a register or slot right after an address, or at a block entry."""

    def __init__(self, function: Function, params: list[str], seeds: dict[int, tuple[str, str]] | None = None, entry_seeds: dict[int, tuple[str, str]] | None = None) -> None:
        self.function = function
        self.arch = function.arch
        self.params = params
        self.seeds = seeds or {}
        self.entry_seeds = entry_seeds or {}
        self.state: dict[str, Val] = {}
        self.flags: tuple[Val, Val] | None = None
        self.states: dict[int, dict[str, Val]] = {}
        self.flags_at: dict[int, tuple[Val, Val] | None] = {}
        self.initial: dict[str, Val] = {}
        for position, name in enumerate(params):
            registers = PARAM_REGISTERS[self.arch]
            if position < len(registers):
                self.initial[registers[position]] = Val.symbol(name)

    def family(self, operand: str) -> str | None:
        return register_family(self.arch, operand)

    def key(self, operand: str) -> str | None:
        return self.family(operand) or slot_key(self.arch, operand)

    def read(self, operand: str) -> Val:
        immediate = parse_immediate(operand)
        if immediate is not None and (operand.startswith("$") or operand.startswith("#")):
            return Val.const(immediate)
        if operand in ("wzr", "xzr"):
            return Val.const(0)
        key = self.key(operand)
        if key is not None:
            fallback = operand.lstrip("%") if self.family(operand) else f"[{operand.strip('%')}]"
            return self.state.get(key, Val.opaque(fallback))
        memory = parse_x86_memory(operand) if self.arch == "x86_64" else None
        if memory is not None and memory.base == "%rip" and memory.index is None:
            return Val.opaque("table")
        return Val.opaque(f"[{operand.strip('%')}]")

    def write(self, operand: str, value: Val) -> None:
        key = self.key(operand)
        if key is not None:
            self.state[key] = value

    def merge(self, states: list[dict[str, Val]]) -> dict[str, Val]:
        merged: dict[str, Val] = {}
        keys = set().union(*[s.keys() for s in states])
        for key in keys:
            values = [s.get(key) for s in states]
            rendered = {str(v) if v is not None else None for v in values}
            if len(rendered) == 1 and values[0] is not None:
                merged[key] = values[0]
                continue
            seeded = {str(v) for v in values if v is not None and v.seeded}
            if len(seeded) == 1:
                merged[key] = Val.opaque(seeded.pop(), seeded=True)
        return merged

    def run(self) -> None:
        function = self.function
        starts = sorted(block_starts(function))
        blocks: list[list[Instruction]] = []
        for position, start in enumerate(starts):
            end = starts[position + 1] if position + 1 < len(starts) else function.end + 1
            blocks.append([i for i in function.instructions if start <= i.address < end])
        predecessors: dict[int, list[int]] = {start: [] for start in starts}
        for block in blocks:
            if not block:
                continue
            last = block[-1]
            following = last.end
            if following in predecessors and not is_unconditional(last):
                predecessors[following].append(block[0].address)
            target = branch_target(last)
            if target in predecessors:
                predecessors[target].append(block[0].address)
        exits: dict[int, dict[str, Val]] = {}
        exit_flags: dict[int, tuple[Val, Val] | None] = {}
        for block in blocks:
            if not block:
                continue
            start = block[0].address
            if start == function.start:
                self.state = dict(self.initial)
                self.flags = None
            else:
                available = [exits[p] for p in predecessors[start] if p in exits]
                self.state = self.merge(available) if available else {}
                fallthrough = [p for p in predecessors[start] if p in exits and p + 0 == p and exits.get(p) is not None and function.at(p) is not None]
                self.flags = exit_flags.get(fallthrough[-1]) if fallthrough else None
            seed = self.entry_seeds.get(start)
            if seed is not None:
                self.state[seed[0]] = Val.opaque(seed[1], seeded=True)
            for instruction in block:
                self.states[instruction.address] = dict(self.state)
                self.flags_at[instruction.address] = self.flags
                self.step(instruction)
                seed = self.seeds.get(instruction.address)
                if seed is not None:
                    self.state[seed[0]] = Val.opaque(seed[1], seeded=True)
            exits[start] = dict(self.state)
            exit_flags[start] = self.flags

    def before(self, address: int) -> dict[str, Val]:
        return self.states.get(address, {})

    def condition(self, code: str, flags: tuple[Val, Val] | None) -> str:
        table = X86_CONDITIONS if self.arch == "x86_64" else ARM_CONDITIONS
        operator = table.get(code, code)
        if flags is None:
            return f"flags {code}"
        left, right = flags
        if operator.endswith(" 0"):
            return f"{left} {operator}"
        if right.is_const() and right.constant == 0 and left.is_const() is False and str(left) == str(right):
            return f"{left} {operator} 0"
        return f"{left} {operator} {right}"

    def step(self, instruction: Instruction) -> None:
        if self.arch == "x86_64":
            self.step_x86(instruction)
        else:
            self.step_arm(instruction)

    def step_x86(self, instruction: Instruction) -> None:
        mnemonic = instruction.mnemonic
        ops = instruction.operands
        base = mnemonic[:-1] if mnemonic[-1] in X86_SIZE_SUFFIX and len(mnemonic) > 3 and not mnemonic.startswith("set") and not mnemonic.startswith("cmov") and mnemonic not in ("call", "shrl", "shll", "sarl") else mnemonic
        if mnemonic in ("shrl", "shll", "sarl", "shrq", "shlq", "sarq"):
            base = mnemonic[:-1]
        if base in ("mov", "movslq", "movsbl", "movzbl", "movabs") or mnemonic in ("movslq", "movsbl", "movzbl"):
            if len(ops) == 2:
                value = self.read(ops[0])
                if mnemonic == "movl" and value.is_const() and value.constant > 0x7FFFFFFF:
                    value = Val.const(value.constant - (1 << 32))
                self.write(ops[1], value)
            return
        if base == "xor" and len(ops) == 2 and ops[0] == ops[1]:
            self.write(ops[1], Val.const(0))
            return
        if base == "lea" and len(ops) == 2:
            memory = parse_x86_memory(ops[0])
            if memory is not None and not (memory.base == "%rip"):
                value = Val.const(memory.displacement)
                if memory.base and memory.index and x86_family(memory.base) == x86_family(memory.index):
                    value = value.add(self.read(memory.base).scale(1 + memory.scale))
                else:
                    if memory.base:
                        value = value.add(self.read(memory.base))
                    if memory.index:
                        value = value.add(self.read(memory.index).scale(memory.scale))
                self.write(ops[1], value)
            return
        if base == "add" and len(ops) == 2:
            self.write(ops[1], self.read(ops[1]).add(self.read(ops[0])))
            return
        if base == "sub" and len(ops) == 2:
            self.flags = (self.read(ops[1]), self.read(ops[0]))
            self.write(ops[1], self.read(ops[1]).sub(self.read(ops[0])))
            return
        if base == "inc" and len(ops) == 1:
            self.write(ops[0], self.read(ops[0]).add(Val.const(1)))
            return
        if base == "neg" and len(ops) == 1:
            value = self.read(ops[0]).negate()
            self.write(ops[0], value)
            self.flags = (value, Val.const(0))
            return
        if base == "shl" and len(ops) == 2:
            count = parse_immediate(ops[0])
            if count is not None:
                self.write(ops[1], self.read(ops[1]).scale(1 << count))
            return
        if base == "imul" and len(ops) == 3:
            factor = parse_immediate(ops[0])
            if factor is not None:
                self.write(ops[2], self.read(ops[1]).scale(factor))
            return
        if base == "cmp" and len(ops) == 2:
            self.flags = (self.read(ops[1]), self.read(ops[0]))
            return
        if base == "test" and len(ops) == 2:
            self.flags = (self.read(ops[1]), Val.const(0))
            return
        if mnemonic.startswith("set") and len(ops) == 1:
            self.write(ops[0], Val.opaque(f"({self.condition(mnemonic[3:], self.flags)})"))
            return
        if mnemonic.startswith("cmov") and len(ops) == 2:
            code = mnemonic[4:-1] if mnemonic[-1] in X86_SIZE_SUFFIX else mnemonic[4:]
            condition = self.condition(code, self.flags)
            self.write(ops[1], Val.opaque(f"{condition} ? {self.read(ops[0])} : {self.read(ops[1])}"))
            return
        if base == "and" and len(ops) == 2:
            self.write(ops[1], Val.opaque(f"{self.read(ops[1])} & {ops[0].lstrip('$')}"))
            return
        if mnemonic in ("cltd", "cqto", "pushq", "popq", "retq", "nop") or mnemonic.startswith("nop") or mnemonic.startswith("j"):
            return
        if mnemonic in ("divl", "idivl") and len(ops) == 1:
            dividend = self.read("%eax")
            divisor = self.read(ops[0])
            self.write("%eax", Val.opaque(f"{dividend} / {divisor}"))
            self.write("%edx", Val.opaque(f"{dividend} % {divisor}"))
            return
        for operand in ops[-1:]:
            if self.key(operand) is not None and not (base in ("cmp", "test") or mnemonic.startswith("mov") and parse_x86_memory(operand)):
                self.write(operand, Val.opaque(f"{mnemonic}(...)"))

    def step_arm(self, instruction: Instruction) -> None:
        mnemonic = instruction.mnemonic
        ops = instruction.operands

        def shifted(operand: str, modifier: str | None) -> Val:
            value = self.read(operand)
            if modifier and modifier.startswith("lsl #"):
                return value.scale(1 << int(modifier[5:]))
            if modifier and modifier.startswith("lsr #"):
                return Val.opaque(f"{value} >> {modifier[5:]}")
            return value

        if mnemonic == "mov" and len(ops) == 2:
            self.write(ops[0], self.read(ops[1]))
            return
        if mnemonic == "movk" and len(ops) == 3:
            low = self.read(ops[0])
            high = parse_immediate(ops[1]) or 0
            if low.is_const():
                self.write(ops[0], Val.const((low.constant & 0xFFFF) | (high << 16)))
            return
        if mnemonic in ("add", "adds", "sub", "subs") and len(ops) >= 3:
            right = shifted(ops[2], ops[3] if len(ops) > 3 else None)
            left = self.read(ops[1])
            result = left.add(right) if mnemonic.startswith("add") else left.sub(right)
            if mnemonic.endswith("s"):
                self.flags = (left, right)
            self.write(ops[0], result)
            return
        if mnemonic == "lsl" and len(ops) == 3:
            count = parse_immediate(ops[2])
            self.write(ops[0], self.read(ops[1]).scale(1 << (count or 0)))
            return
        if mnemonic in ("madd", "msub") and len(ops) == 4:
            product = self.read(ops[1])
            factor = self.read(ops[2])
            if factor.is_const():
                product = product.scale(factor.constant)
            elif product.is_const():
                product = factor.scale(product.constant)
            else:
                product = Val.opaque(f"{product}*{factor}")
            addend = self.read(ops[3])
            self.write(ops[0], addend.add(product) if mnemonic == "madd" else addend.sub(product))
            return
        if mnemonic in ("neg", "negs") and len(ops) == 2:
            value = self.read(ops[1]).negate()
            self.write(ops[0], value)
            if mnemonic == "negs":
                self.flags = (value, Val.const(0))
            return
        if mnemonic == "cmp" and len(ops) == 2:
            self.flags = (self.read(ops[0]), self.read(ops[1]))
            return
        if mnemonic in ("cbz", "cbnz") and ops:
            self.flags = (self.read(ops[0]), Val.const(0))
            return
        if mnemonic == "csel" and len(ops) == 4:
            self.write(ops[0], Val.opaque(f"{self.condition(ops[3], self.flags)} ? {self.read(ops[1])} : {self.read(ops[2])}"))
            return
        if mnemonic == "csinv" and len(ops) == 4:
            other = self.read(ops[2])
            inverted = Val.const(~other.constant) if other.is_const() else Val.opaque(f"~{other}")
            self.write(ops[0], Val.opaque(f"{self.condition(ops[3], self.flags)} ? {self.read(ops[1])} : {inverted}"))
            return
        if mnemonic == "csneg" and len(ops) == 4:
            self.write(ops[0], Val.opaque(f"{self.condition(ops[3], self.flags)} ? {self.read(ops[1])} : {self.read(ops[2]).negate()}"))
            return
        if mnemonic == "csinc" and len(ops) == 4:
            self.write(ops[0], Val.opaque(f"{self.condition(ops[3], self.flags)} ? {self.read(ops[1])} : {self.read(ops[2]).add(Val.const(1))}"))
            return
        if mnemonic == "cneg" and len(ops) == 3:
            value = self.read(ops[1])
            self.write(ops[0], Val.opaque(f"{self.condition(ops[2], self.flags)} ? {value.negate()} : {value}"))
            return
        if mnemonic == "cset" and len(ops) == 2:
            self.write(ops[0], Val.opaque(f"({self.condition(ops[1], self.flags)})"))
            return
        if mnemonic == "and" and len(ops) == 3:
            self.write(ops[0], Val.opaque(f"{self.read(ops[1])} & {ops[2].lstrip('#')}"))
            return
        if mnemonic in ("sdiv", "udiv") and len(ops) == 3:
            self.write(ops[0], Val.opaque(f"{self.read(ops[1])} / {self.read(ops[2])}"))
            return
        if mnemonic in ("str", "stur") and len(ops) == 2:
            self.write(ops[1], self.read(ops[0]))
            return
        if mnemonic in ("ldr", "ldur") and len(ops) == 2 and slot_key("arm64", ops[1]):
            self.write(ops[0], self.read(ops[1]))
            return
        if mnemonic in ("ret", "b", "br", "bl", "blr") or mnemonic.startswith("b.") or mnemonic.startswith("st"):
            return
        if ops and self.family(ops[0]) is not None:
            self.write(ops[0], Val.opaque(f"{mnemonic}(...)"))


@dataclass
class Idiom:
    kind: str
    function: str
    source: str
    evidence: list[int]
    detail: dict[str, Any] = field(default_factory=dict)
    verified: bool | None = None
    result: tuple[int, str, str] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "function": self.function,
            "source": self.source,
            "evidence": [f"0x{a:x}" for a in self.evidence],
            "verified": self.verified,
            **self.detail,
        }


@dataclass
class SourceFunction:
    name: str
    params: list[str]
    body: str
    divisions: list[int]
    modulos: list[int]
    multiplies: list[int]
    has_switch: bool
    cases: dict[int, int | None]
    has_select: bool
    has_loop: bool
    calls: list[str]
    has_array: bool
    accumulator: str | None = None

    @property
    def case_values(self) -> list[int]:
        return [v for _k, v in sorted(self.cases.items()) if v is not None]


FUNCTION_RE = re.compile(r"^(?:unsigned |int |void |long |char |static )+\*?\s*(\w+)\(", re.M)
CASE_RUN_RE = re.compile(r"((?:case\s+\d+:\s*)+)(?:return|\w+\s*=)\s*(-?\d+)")
CALL_RE = re.compile(r"\b([a-z_]\w*)\s*\(")
KEYWORDS = {"switch", "for", "if", "return", "while", "sizeof"}


def _balanced(text: str, start: int, open_char: str, close_char: str) -> int:
    depth = 0
    for position in range(start, len(text)):
        if text[position] == open_char:
            depth += 1
        elif text[position] == close_char:
            depth -= 1
            if depth == 0:
                return position
    return len(text)


def _param_name(declaration: str) -> str:
    pointer = re.search(r"\(\*(\w+)\)", declaration)
    if pointer:
        return pointer.group(1)
    return declaration.split()[-1].lstrip("*")


def parse_source(text: str) -> dict[str, SourceFunction]:
    functions: dict[str, SourceFunction] = {}
    for match in FUNCTION_RE.finditer(text):
        name = match.group(1)
        params_end = _balanced(text, match.end() - 1, "(", ")")
        brace = text.find("{", params_end)
        if brace < 0 or text[params_end + 1 : brace].strip():
            continue
        body_end = _balanced(text, brace, "{", "}")
        body = text[brace + 1 : body_end]
        raw_params = text[match.end() : params_end]
        params = [_param_name(p) for p in split_operands(raw_params) if p.strip() and p.strip() != "void"]
        accumulator = re.search(r"(\w+)\s*\+=", body)
        cases: dict[int, int | None] = {}
        for run, value in CASE_RUN_RE.findall(body):
            for label in re.findall(r"case\s+(\d+):", run):
                cases[int(label)] = int(value)
        for label in re.findall(r"case\s+(\d+):", body):
            cases.setdefault(int(label), None)
        calls = [c for c in CALL_RE.findall(body) if c not in KEYWORDS and c != name]
        functions[name] = SourceFunction(
            name=name,
            params=params,
            body=body,
            divisions=[int(v) for v in re.findall(r"/\s*(\d+)", body)],
            modulos=[int(v) for v in re.findall(r"%\s*(\d+)", body)],
            multiplies=[int(v) for v in re.findall(r"\*\s*(\d+)", body)],
            has_switch="switch" in body,
            cases=cases,
            has_select="?" in body,
            has_loop="for (" in body,
            calls=calls,
            has_array=bool(re.search(r"\w+\s+\w+\[\d+\];", body)),
            accumulator=accumulator.group(1) if accumulator else None,
        )
    return functions


def load_source(name: str = "idioms.c") -> dict[str, SourceFunction]:
    return parse_source((FIXTURES / name).read_text())


def find_reductions(function: Function, source: SourceFunction | None) -> tuple[dict[int, tuple[str, str]], dict[int, tuple[str, str]]]:
    """Accumulator of each real loop: a register (or -O0 stack slot) that an add reads and writes.
    Returns (seeds after the back-edge branch, seeds at the loop header) naming it after the source."""
    name = (source.accumulator if source and source.accumulator else "sum")
    seeds: dict[int, tuple[str, str]] = {}
    entry_seeds: dict[int, tuple[str, str]] = {}
    for branch, target in loops(function):
        body = loop_body(function, (branch, target))
        if any(SIMD_REGISTER.search(o) for i in body for o in i.operands):
            continue
        key = None
        for position, instruction in enumerate(body):
            if function.arch == "x86_64" and instruction.mnemonic == "addl" and len(instruction.operands) == 2 and x86_family(instruction.operands[1]) and not instruction.operands[0].startswith("$"):
                key = x86_family(instruction.operands[1])
                if position + 1 < len(body) and body[position + 1].mnemonic == "movl" and slot_key("x86_64", body[position + 1].operands[1]) and x86_family(body[position + 1].operands[0]) == key:
                    key = body[position + 1].operands[1]
                break
            if function.arch == "arm64" and instruction.mnemonic == "add" and len(instruction.operands) == 3 and arm_family(instruction.operands[0]) in (arm_family(instruction.operands[1]), arm_family(instruction.operands[2])):
                key = arm_family(instruction.operands[0])
                if position + 1 < len(body) and body[position + 1].mnemonic == "str" and slot_key("arm64", body[position + 1].operands[1]) and arm_family(body[position + 1].operands[0]) == key:
                    key = body[position + 1].operands[1]
                break
        if key is None:
            continue
        seeds[branch.address] = (key, name)
        entry_seeds[target] = (key, name)
    return seeds, entry_seeds


def evaluator_for(function: Function, source: SourceFunction | None, seeds: dict[int, tuple[str, str]] | None = None) -> Evaluator:
    reduction_seeds, entry_seeds = find_reductions(function, source)
    merged = dict(reduction_seeds)
    merged.update(seeds or {})
    evaluator = Evaluator(function, source.params if source else [], merged, entry_seeds)
    evaluator.run()
    return evaluator


def window(function: Function, start: int, count: int) -> list[Instruction]:
    return function.instructions[start : start + count]


def find_divisions(function: Function, evaluator: Evaluator) -> list[Idiom]:
    """Magic multiply forms (both architectures), the add fix-up form, and the -O0 hardware division."""
    found: list[Idiom] = []
    if function.arch == "x86_64":
        found.extend(_x86_magic_divisions(function, evaluator))
        found.extend(_x86_hardware_divisions(function, evaluator))
    else:
        found.extend(_arm_magic_divisions(function, evaluator))
        found.extend(_arm_hardware_divisions(function, evaluator))
    return found


def _x86_magic_divisions(function: Function, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    instructions = function.instructions
    for position, instruction in enumerate(instructions):
        if not instruction.mnemonic.startswith("imul"):
            continue
        magic_value: int | None = None
        evidence = [instruction.address]
        if len(instruction.operands) == 3:
            magic_value = parse_immediate(instruction.operands[0])
            source_reg = x86_family(instruction.operands[1])
            product = x86_family(instruction.operands[2])
        elif len(instruction.operands) == 2:
            product = x86_family(instruction.operands[1])
            source_reg = x86_family(instruction.operands[0])
            for earlier in reversed(window(function, max(0, position - 3), min(3, position))):
                if earlier.mnemonic == "movl" and len(earlier.operands) == 2 and earlier.operands[0].startswith("$") and x86_family(earlier.operands[1]) in (product, source_reg):
                    magic_value = parse_immediate(earlier.operands[0]) & 0xFFFFFFFF
                    evidence.insert(0, earlier.address)
                    if x86_family(earlier.operands[1]) == source_reg:
                        source_reg = product
                    break
        else:
            continue
        if magic_value is None or magic_value < 0x1000 or product is None:
            continue
        magic_value &= 0xFFFFFFFF
        signed = False
        dividend = Val.opaque("?")
        for earlier in reversed(window(function, max(0, position - 3), min(3, position))):
            if earlier.mnemonic in ("movslq", "movl") and len(earlier.operands) == 2 and not earlier.operands[0].startswith("$") and x86_family(earlier.operands[1]) == source_reg:
                signed = earlier.mnemonic == "movslq"
                probe = Evaluator(function, [])
                probe.state = dict(evaluator.before(earlier.address))
                dividend = probe.read(earlier.operands[0])
                evidence.insert(0, earlier.address)
                break
        else:
            dividend = evaluator.before(instruction.address).get(source_reg or "", Val.opaque(source_reg or "?"))
        copies = {product}
        shift = None
        sign_fix = False
        sign_reg = None
        fixup = []
        result_reg = product
        last = instruction
        combines: list[tuple[Instruction, str]] = []
        for later in window(function, position + 1, 12):
            mnemonic = later.mnemonic
            ops = later.operands
            if mnemonic == "movq" and len(ops) == 2 and x86_family(ops[0]) in copies:
                copies.add(x86_family(ops[1]))
                evidence.append(later.address)
                continue
            if mnemonic == "shrq" and len(ops) == 2 and x86_family(ops[1]) in copies and parse_immediate(ops[0]) == 63:
                sign_fix = True
                sign_reg = x86_family(ops[1])
                evidence.append(later.address)
                continue
            if mnemonic in ("sarq", "shrq") and len(ops) == 2 and x86_family(ops[1]) in copies and shift is None:
                shift = parse_immediate(ops[0])
                result_reg = x86_family(ops[1])
                evidence.append(later.address)
                last = later
                continue
            if shift is not None and sign_fix and not fixup and mnemonic in ("addl", "leal"):
                sources: set[str | None] = set()
                if mnemonic == "addl" and len(ops) == 2:
                    sources = {x86_family(ops[0]), x86_family(ops[1])}
                if mnemonic == "leal" and len(ops) == 2:
                    memory = parse_x86_memory(ops[0])
                    if memory and memory.displacement == 0 and memory.scale == 1:
                        sources = {x86_family(memory.base or ""), x86_family(memory.index or "")}
                if sources == {result_reg, sign_reg} and result_reg != sign_reg:
                    combines.append((later, x86_family(ops[-1]) or ""))
                    continue
            if combines and ops and x86_family(ops[-1]) in copies:
                break
            if combines and not (mnemonic in ("addl", "leal", "subl", "movl")):
                break
            if shift == 32 and not sign_fix and mnemonic == "subl" and len(ops) == 2 and x86_family(ops[0]) in copies:
                fixup.append(later)
                evidence.append(later.address)
                continue
            if fixup and mnemonic in ("shrl", "addl"):
                fixup.append(later)
                evidence.append(later.address)
                if mnemonic == "shrl" and len(ops) == 2 and x86_family(ops[1]) in copies and parse_immediate(ops[0]) not in (None, 1):
                    result_reg = x86_family(ops[1])
                    last = later
                    break
                continue
            if shift is not None and not sign_fix and not fixup:
                break
        if shift is None:
            continue
        effective = magic_value
        total_shift = shift
        if fixup:
            effective = magic_value + (1 << 32)
            total_shift = shift + 1 + (parse_immediate(fixup[-1].operands[0]) or 0)
        divisor = divisor_from_magic(effective, total_shift, 32, signed)
        if divisor is None:
            continue
        magic = magic_numbers(divisor, 32, signed)
        detail = {"form": "magic multiply" + (" with add fix-up" if fixup else ""), "signed": signed, "magic": f"0x{magic_value:x}", "effectiveMagic": f"0x{effective:x}", "shift": total_shift, "algorithm": magic.to_dict(), "clangMatchesAlgorithm": magic.multiplier == effective and magic.shift == total_shift}
        if sign_fix and not combines:
            continue
        results = [(c, reg) for c, reg in combines] or [(last, result_reg or "")]
        for combine, register in results:
            found.append(Idiom(
                "division", function.name, f"{dividend} / {divisor}", evidence + ([combine.address] if combine is not last else []),
                dict(detail, sharedQuotient=len(results) > 1),
                result=(combine.address, register, f"{dividend} / {divisor}"),
            ))
    return found


def _x86_hardware_divisions(function: Function, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    instructions = function.instructions
    for position, instruction in enumerate(instructions):
        if instruction.mnemonic not in ("divl", "idivl") or len(instruction.operands) != 1:
            continue
        divisor_reg = x86_family(instruction.operands[0])
        divisor = None
        evidence = [instruction.address]
        for earlier in reversed(window(function, max(0, position - 4), 4)):
            if earlier.mnemonic == "movl" and len(earlier.operands) == 2 and earlier.operands[0].startswith("$") and x86_family(earlier.operands[1]) == divisor_reg:
                divisor = parse_immediate(earlier.operands[0])
                evidence.insert(0, earlier.address)
            if earlier.mnemonic in ("cltd", "xorl"):
                evidence.insert(0, earlier.address)
        if divisor is None:
            continue
        dividend = evaluator.before(instruction.address).get("a", Val.opaque("eax"))
        remainder_used = any(later.operands and x86_family(later.operands[0]) == "d" for later in window(function, position + 1, 2))
        evidence = [e for e in evidence if function.at(e) is not None and (function.at(e).mnemonic != "xorl" or x86_family(function.at(e).operands[0]) == "d")]
        kind = "modulo" if remainder_used else "division"
        operator = "%" if remainder_used else "/"
        result_reg = "d" if remainder_used else "a"
        found.append(Idiom(kind, function.name, f"{dividend} {operator} {divisor}", evidence, {"form": f"hardware {instruction.mnemonic}", "signed": instruction.mnemonic == "idivl", "divisor": divisor}, result=(instruction.address, result_reg, f"{dividend} {operator} {divisor}")))
    return found


def _arm_constant(function: Function, position: int, register: str) -> tuple[int | None, list[int]]:
    """mov wK, #lo ; movk wK, #hi, lsl #16 ending at or before position."""
    value = None
    evidence: list[int] = []
    for earlier in reversed(window(function, max(0, position - 4), min(4, position))):
        if earlier.mnemonic == "movk" and arm_family(earlier.operands[0]) == register:
            value = (value or 0) | ((parse_immediate(earlier.operands[1]) or 0) << 16)
            evidence.insert(0, earlier.address)
        elif earlier.mnemonic == "mov" and arm_family(earlier.operands[0]) == register and earlier.operands[1].startswith("#"):
            value = (value or 0) | ((parse_immediate(earlier.operands[1]) or 0) & 0xFFFF)
            evidence.insert(0, earlier.address)
            break
    return value, evidence


def _arm_magic_divisions(function: Function, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    for position, instruction in enumerate(function.instructions):
        if instruction.mnemonic not in ("smull", "umull") or len(instruction.operands) != 3:
            continue
        signed = instruction.mnemonic == "smull"
        product = arm_family(instruction.operands[0])
        operand_a, operand_b = instruction.operands[1], instruction.operands[2]
        magic_value, evidence = _arm_constant(function, position, arm_family(operand_b) or "")
        dividend_reg = operand_a
        if magic_value is None:
            magic_value, evidence = _arm_constant(function, position, arm_family(operand_a) or "")
            dividend_reg = operand_b
        if magic_value is None:
            continue
        evidence.append(instruction.address)
        dividend = evaluator.before(instruction.address).get(arm_family(dividend_reg) or "", Val.opaque(dividend_reg))
        shift = None
        sign_fix = False
        fixup: list[Instruction] = []
        result_reg = product
        last = instruction
        for later in window(function, position + 1, 8):
            mnemonic, ops = later.mnemonic, later.operands
            if mnemonic == "lsr" and len(ops) == 3 and arm_family(ops[1]) == product and parse_immediate(ops[2]) == 63:
                sign_fix = True
                evidence.append(later.address)
                continue
            if mnemonic in ("asr", "lsr") and len(ops) == 3 and arm_family(ops[1]) == product and shift is None:
                shift = parse_immediate(ops[2])
                result_reg = arm_family(ops[0])
                evidence.append(later.address)
                last = later
                if not signed and shift != 32:
                    break
                continue
            if shift is not None and signed and mnemonic == "add" and len(ops) == 3:
                result_reg = arm_family(ops[0])
                evidence.append(later.address)
                last = later
                break
            if shift == 32 and not signed and mnemonic == "sub":
                fixup.append(later)
                evidence.append(later.address)
                continue
            if fixup and mnemonic in ("add", "lsr"):
                fixup.append(later)
                evidence.append(later.address)
                if mnemonic == "lsr":
                    result_reg = arm_family(ops[0])
                    last = later
                    break
        if shift is None:
            continue
        effective, total_shift = magic_value, shift
        if fixup:
            effective = magic_value + (1 << 32)
            total_shift = shift + 1 + (parse_immediate(fixup[-1].operands[2]) or 0)
        divisor = divisor_from_magic(effective, total_shift, 32, signed)
        if divisor is None:
            continue
        magic = magic_numbers(divisor, 32, signed)
        found.append(Idiom(
            "division", function.name, f"{dividend} / {divisor}", evidence,
            {"form": "magic multiply" + (" with add fix-up" if fixup else ""), "signed": signed, "magic": f"0x{magic_value:x}", "effectiveMagic": f"0x{effective:x}", "shift": total_shift, "algorithm": magic.to_dict(), "clangMatchesAlgorithm": magic.multiplier == effective and magic.shift == total_shift},
            result=(last.address, result_reg or "", f"{dividend} / {divisor}"),
        ))
    return found


def _arm_hardware_divisions(function: Function, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    for position, instruction in enumerate(function.instructions):
        if instruction.mnemonic not in ("sdiv", "udiv") or len(instruction.operands) != 3:
            continue
        divisor_value, evidence = _arm_constant(function, position, arm_family(instruction.operands[2]) or "")
        if divisor_value is None:
            continue
        evidence.append(instruction.address)
        dividend = evaluator.before(instruction.address).get(arm_family(instruction.operands[1]) or "", Val.opaque(instruction.operands[1]))
        quotient = arm_family(instruction.operands[0])
        following = window(function, position + 1, 2)
        msub = next((i for i in following if i.mnemonic == "msub" and arm_family(i.operands[1]) == quotient), None)
        mul = next((i for i in following if i.mnemonic == "mul" and arm_family(i.operands[1]) == quotient), None)
        subtract = next((i for i in following if mul is not None and i.address > mul.address and i.mnemonic in ("sub", "subs") and arm_family(i.operands[2]) == arm_family(mul.operands[0])), None)
        if msub is not None:
            evidence.append(msub.address)
            found.append(Idiom("modulo", function.name, f"{dividend} % {divisor_value}", evidence, {"form": f"hardware {instruction.mnemonic} + msub", "signed": instruction.mnemonic == "sdiv", "divisor": divisor_value}, result=(msub.address, arm_family(msub.operands[0]) or "", f"{dividend} % {divisor_value}")))
        elif mul is not None and subtract is not None:
            evidence.extend([mul.address, subtract.address])
            found.append(Idiom("modulo", function.name, f"{dividend} % {divisor_value}", evidence, {"form": f"hardware {instruction.mnemonic} + mul + {subtract.mnemonic}", "signed": instruction.mnemonic == "sdiv", "divisor": divisor_value}, result=(subtract.address, arm_family(subtract.operands[0]) or "", f"{dividend} % {divisor_value}")))
        else:
            found.append(Idiom("division", function.name, f"{dividend} / {divisor_value}", evidence, {"form": f"hardware {instruction.mnemonic}", "signed": instruction.mnemonic == "sdiv", "divisor": divisor_value}, result=(instruction.address, quotient or "", f"{dividend} / {divisor_value}")))
    return found


def find_modulos(function: Function, divisions: list[Idiom], evaluator: Evaluator) -> list[Idiom]:
    """A recognized quotient multiplied back by the divisor and subtracted from the dividend is x % d.
    Also the power-of-two forms that never compute a quotient."""
    found: list[Idiom] = []
    for division in divisions:
        if division.kind != "division" or division.result is None or division.detail.get("form", "").startswith("hardware"):
            continue
        end_address, quotient_reg, _text = division.result
        divisor = division.detail["algorithm"]["divisor"]
        dividend_text = division.source.split(" / ")[0]
        position = function.index(end_address)
        factors = {quotient_reg: 1}
        evidence: list[int] = []
        for later in window(function, position + 1, 12):
            mnemonic, ops = later.mnemonic, later.operands
            written = register_family(function.arch, ops[-1] if function.arch == "x86_64" else ops[0]) if ops else None
            if function.arch == "arm64" and mnemonic == "msub" and len(ops) == 4 and arm_family(ops[1]) == quotient_reg:
                constant, const_evidence = _arm_constant(function, function.index(later.address), arm_family(ops[2]) or "")
                if constant == divisor:
                    found.append(Idiom("modulo", function.name, f"{dividend_text} % {divisor}", division.evidence + const_evidence + [later.address], {"form": "msub quotient * divisor from dividend", "divisor": divisor}, result=(later.address, arm_family(ops[0]) or "", f"{dividend_text} % {divisor}")))
                break
            if function.arch == "arm64" and written == quotient_reg and mnemonic not in ("mul",):
                break
            if function.arch == "x86_64":
                if mnemonic == "movl" and len(ops) == 2 and x86_family(ops[0]) in factors and x86_family(ops[1]) is not None:
                    factors[x86_family(ops[1])] = factors[x86_family(ops[0])]
                    evidence.append(later.address)
                    continue
                if mnemonic == "addl" and len(ops) == 2 and x86_family(ops[0]) == x86_family(ops[1]) and x86_family(ops[1]) in factors:
                    factors[x86_family(ops[1])] *= 2
                    evidence.append(later.address)
                    continue
                if mnemonic == "shll" and len(ops) == 2 and x86_family(ops[1]) in factors:
                    factors[x86_family(ops[1])] *= 1 << (parse_immediate(ops[0]) or 0)
                    evidence.append(later.address)
                    continue
                if mnemonic == "leal" and len(ops) == 2:
                    memory = parse_x86_memory(ops[0])
                    if memory and x86_family(memory.base or "") in factors and x86_family(memory.index or "") == x86_family(memory.base or "") and memory.displacement == 0:
                        factors[x86_family(ops[1])] = factors[x86_family(memory.base)] * (1 + memory.scale)
                        evidence.append(later.address)
                        continue
                if mnemonic == "imull" and len(ops) == 3 and x86_family(ops[1]) in factors:
                    factors[x86_family(ops[2])] = factors[x86_family(ops[1])] * (parse_immediate(ops[0]) or 0)
                    evidence.append(later.address)
                    continue
                if mnemonic == "subl" and len(ops) == 2 and x86_family(ops[0]) in factors and factors[x86_family(ops[0])] == divisor:
                    evidence.append(later.address)
                    found.append(Idiom("modulo", function.name, f"{dividend_text} % {divisor}", division.evidence + evidence, {"form": "quotient multiplied back and subtracted", "multiplyBack": f"{quotient_reg} * {divisor}", "divisor": divisor}, result=(later.address, x86_family(ops[1]) or "", f"{dividend_text} % {divisor}")))
                    break
                if written in factors and mnemonic not in ("addl", "leal", "imull", "movl", "shll"):
                    break
    found.extend(_power_of_two_modulos(function, evaluator))
    return found


def _power_of_two_modulos(function: Function, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    instructions = function.instructions
    if function.arch == "x86_64":
        for position, instruction in enumerate(instructions):
            if not instruction.mnemonic.startswith("cmov") or instruction.mnemonic[4:-1] not in ("s", "ns"):
                continue
            later = window(function, position + 1, 2)
            if len(later) < 2 or not later[0].mnemonic == "andl" or not later[1].mnemonic == "subl":
                continue
            mask = parse_immediate(later[0].operands[0])
            if mask is None or mask >= 0 or (-mask) & (-mask - 1):
                continue
            modulus = -mask
            bias = next((i for i in reversed(window(function, max(0, position - 3), 3)) if (i.mnemonic == "leal" and parse_x86_memory(i.operands[0]) and parse_x86_memory(i.operands[0]).displacement == modulus - 1) or (i.mnemonic == "addl" and parse_immediate(i.operands[0]) == modulus - 1)), None)
            if bias is None:
                continue
            dividend = evaluator.before(later[1].address).get(x86_family(later[1].operands[1]) or "", Val.opaque("x"))
            evidence = [bias.address] + [i.address for i in window(function, function.index(bias.address) + 1, position - function.index(bias.address))] + [later[0].address, later[1].address]
            found.append(Idiom("modulo", function.name, f"{dividend} % {modulus}", evidence, {"form": "signed power-of-two modulo: bias by 2^k-1 when negative, mask, subtract", "divisor": modulus}, result=(later[1].address, x86_family(later[1].operands[1]) or "", f"{dividend} % {modulus}")))
    else:
        for position, instruction in enumerate(instructions):
            if instruction.mnemonic != "csneg" or len(instruction.operands) != 4 or instruction.operands[3] != "mi":
                continue
            masks = [i for i in window(function, max(0, position - 3), 3) if i.mnemonic == "and" and len(i.operands) == 3]
            negs = next((i for i in window(function, max(0, position - 3), 3) if i.mnemonic == "negs"), None)
            if len(masks) < 2 or negs is None:
                continue
            mask = parse_immediate(masks[0].operands[2])
            if mask is None or (mask + 1) & mask:
                continue
            dividend = evaluator.before(negs.address).get(arm_family(negs.operands[1]) or "", Val.opaque("x"))
            evidence = [negs.address] + [m.address for m in masks] + [instruction.address]
            found.append(Idiom("modulo", function.name, f"{dividend} % {mask + 1}", sorted(evidence), {"form": "signed power-of-two modulo: negate, mask both signs, csneg", "divisor": mask + 1}, result=(instruction.address, arm_family(instruction.operands[0]) or "", f"{dividend} % {mask + 1}")))
    return found


def _bounds_check(function: Function, before: int, register: str | None = None) -> tuple[int | None, str | None, list[int]]:
    """cmp/sub $N, reg ; ja/jae (x86) or cmp wN, #N ; b.hi/b.hs (arm64) before an address: the valid entry count."""
    position = function.index(before)
    earlier = window(function, max(0, position - 8), min(8, position))
    for index in range(len(earlier) - 1, 0, -1):
        branch = earlier[index]
        compare = earlier[index - 1]
        if function.arch == "x86_64" and branch.mnemonic in ("ja", "jae") and compare.mnemonic in ("cmpl", "cmpq", "subl", "subq") and compare.operands[0].startswith("$"):
            limit = parse_immediate(compare.operands[0]) or 0
            return limit + (1 if branch.mnemonic == "ja" else 0), x86_family(compare.operands[1]), [compare.address, branch.address]
        if function.arch == "arm64" and branch.mnemonic in ("b.hi", "b.hs") and compare.mnemonic == "cmp" and compare.operands[1].startswith("#"):
            limit = parse_immediate(compare.operands[1]) or 0
            return limit + (1 if branch.mnemonic == "b.hi" else 0), arm_family(compare.operands[0]), [compare.address, branch.address]
    return None, None, []


def _table_base(function: Function, before: int, register: str | None) -> tuple[Instruction | None, int | None]:
    """The RIP-relative lea (x86) or adrp+add pair (arm64) that put the .rodata table address in a register."""
    position = function.index(before)
    for earlier in reversed(window(function, max(0, position - 6), min(6, position))):
        if function.arch == "x86_64" and earlier.mnemonic == "leaq" and earlier.relocation and x86_family(earlier.operands[1]) == register:
            if earlier.relocation_symbol == ".rodata":
                return earlier, earlier.relocation_addend + 4
        if function.arch == "arm64" and earlier.mnemonic == "add" and earlier.relocation and earlier.relocation_symbol == ".rodata" and arm_family(earlier.operands[0]) == register:
            return earlier, earlier.relocation_addend
    return None, None


def find_switches(function: Function, elf: ElfFile | None, source: SourceFunction | None, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    found.extend(_jump_tables(function, elf, source, evaluator))
    found.extend(_lookup_tables(function, elf, source, evaluator))
    found.extend(_linear_maps_and_select_chains(function, source, evaluator))
    if not found:
        found.extend(_comparison_trees(function, source, evaluator))
    return found


def _index_text(index: Val, count: int | None) -> tuple[str, str]:
    """'sum / 10 - 6' with 5 entries reads as switch (sum / 10) over cases 6..10."""
    text = str(index)
    match = re.search(r"^(.*) - (\d+)$", text)
    if match and count:
        bias = int(match.group(2))
        return match.group(1), f"cases {bias}..{bias + count - 1}"
    return text, f"cases 0..{count - 1}" if count else ""


def _jump_tables(function: Function, elf: ElfFile | None, source: SourceFunction | None, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    for position, instruction in enumerate(function.instructions):
        if function.arch == "x86_64":
            if instruction.mnemonic != "jmpq" or not instruction.operands[0].startswith("*%"):
                continue
            target_reg = x86_family(instruction.operands[0][1:])
            earlier = list(reversed(window(function, max(0, position - 4), min(4, position))))
            add = next((i for i in earlier if i.mnemonic == "addq" and x86_family(i.operands[1]) == target_reg), None)
            load = next((i for i in earlier if i.mnemonic == "movslq" and parse_x86_memory(i.operands[0]) and x86_family(i.operands[1]) == target_reg), None)
            if add is None or load is None:
                continue
            memory = parse_x86_memory(load.operands[0])
            base_reg = x86_family(memory.base or "")
            lea, table_offset = _table_base(function, load.address, base_reg)
            if lea is None or table_offset is None:
                continue
            count, index_reg, bounds = _bounds_check(function, lea.address)
            targets: list[int] = []
            if elf is not None and count:
                for k in range(count):
                    relocation = elf.relocation_at(".rodata", table_offset + 4 * k)
                    if relocation is not None:
                        targets.append(relocation["base"] + relocation["addend"] - 4 * k)
            evidence = bounds + [lea.address, load.address, add.address, instruction.address]
            index_val = evaluator.before(load.address).get(x86_family(memory.index or "") or "", Val.opaque(memory.index or "?"))
            expression, case_range = _index_text(index_val, count)
            found.append(_switch_idiom(function, source, "jump table", evidence, {"table": f".rodata+0x{table_offset:x}", "entries": count, "entrySize": 4, "targets": [f"0x{t:x}" for t in targets], "distinctTargets": len(set(targets)), "indexRegister": index_reg, "index": str(index_val), "caseRange": case_range, "entryEvidence": "relocation" if targets else "none"}, len(set(targets)) if targets else None, expression))
        else:
            if instruction.mnemonic != "br" or len(instruction.operands) != 1:
                continue
            target_reg = arm_family(instruction.operands[0])
            earlier = list(reversed(window(function, max(0, position - 6), min(6, position))))
            add = next((i for i in earlier if i.mnemonic == "add" and arm_family(i.operands[0]) == target_reg and len(i.operands) == 4 and i.operands[3] == "lsl #2"), None)
            if add is None:
                continue
            adr = next((i for i in earlier if i.mnemonic == "adr" and arm_family(i.operands[0]) == arm_family(add.operands[1])), None)
            load = next((i for i in earlier if i.mnemonic in ("ldrb", "ldrh", "ldrsw", "ldr") and arm_family(i.operands[0]) == arm_family(add.operands[2])), None)
            if adr is None or load is None:
                continue
            memory = parse_arm_memory(load.operands[1])
            table_insn, table_offset = _table_base(function, load.address, arm_family(memory.base or "") if memory else None)
            if table_insn is None or table_offset is None:
                continue
            count, index_reg, bounds = _bounds_check(function, table_insn.address)
            entry_size = {"ldrb": 1, "ldrh": 2, "ldrsw": 4, "ldr": 4}[load.mnemonic]
            base = parse_immediate(adr.operands[1]) or 0
            targets = []
            if elf is not None and count:
                entries = elf.words(".rodata", table_offset, count, entry_size, signed=entry_size == 4)
                targets = [base + 4 * e for e in entries]
            adrp = function.instructions[function.index(table_insn.address) - 1]
            evidence = bounds + [adrp.address, table_insn.address, adr.address, load.address, add.address, instruction.address]
            index_val = evaluator.before(load.address).get(arm_family(memory.index or "") or "", Val.opaque(memory.index or "?"))
            expression, case_range = _index_text(index_val, count)
            found.append(_switch_idiom(function, source, "jump table", evidence, {"table": f".rodata+0x{table_offset:x}", "entries": count, "entrySize": entry_size, "compressed": entry_size < 4, "targets": [f"0x{t:x}" for t in targets], "distinctTargets": len(set(targets)), "indexRegister": index_reg, "index": str(index_val), "caseRange": case_range, "entryEvidence": "bytes" if targets else "none"}, len(set(targets)) if targets else None, expression))
    return found


def _lookup_tables(function: Function, elf: ElfFile | None, source: SourceFunction | None, evaluator: Evaluator) -> list[Idiom]:
    found: list[Idiom] = []
    for position, instruction in enumerate(function.instructions):
        if function.arch == "x86_64":
            if instruction.mnemonic not in ("movl", "movslq") or len(instruction.operands) != 2:
                continue
            memory = parse_x86_memory(instruction.operands[0])
            if memory is None or memory.index is None or memory.scale != 4:
                continue
            if any(i.mnemonic == "jmpq" for i in window(function, position + 1, 3)):
                continue
            lea, table_offset = _table_base(function, instruction.address, x86_family(memory.base or ""))
            if lea is None or table_offset is None:
                continue
            count, index_reg, bounds = _bounds_check(function, lea.address)
            entry_size = 4
            evidence = bounds + [lea.address, instruction.address]
            index_val = evaluator.before(instruction.address).get(x86_family(memory.index) or "", Val.opaque(memory.index))
            result_reg = x86_family(instruction.operands[1])
        else:
            if instruction.mnemonic != "ldr" or len(instruction.operands) != 2:
                continue
            memory = parse_arm_memory(instruction.operands[1])
            if memory is None or memory.index is None or memory.scale != 4:
                continue
            table_insn, table_offset = _table_base(function, instruction.address, arm_family(memory.base or ""))
            if table_insn is None or table_offset is None:
                continue
            count, index_reg, bounds = _bounds_check(function, table_insn.address)
            entry_size = 4
            adrp = function.instructions[function.index(table_insn.address) - 1]
            evidence = bounds + [adrp.address, table_insn.address, instruction.address]
            index_val = evaluator.before(instruction.address).get(arm_family(memory.index) or "", Val.opaque(memory.index))
            result_reg = arm_family(instruction.operands[0])
        entries: list[int] = []
        if elf is not None and count:
            entries = elf.words(".rodata", table_offset, count, entry_size)
        expression, case_range = _index_text(index_val, count)
        detail = {"table": f".rodata+0x{table_offset:x}", "entries": count, "entrySize": entry_size, "values": entries, "indexRegister": index_reg, "index": str(index_val), "caseRange": case_range}
        idiom = _switch_idiom(function, source, "lookup table", evidence, detail, None, expression)
        idiom.result = (instruction.address, result_reg or "", f"table[{index_val}]")
        if source is not None and entries:
            values = source.case_values
            ratio = None
            if values and len(values) == len(entries) and all(v != 0 for v in values) and len({e / v for e, v in zip(entries, values)}) == 1:
                ratio = entries[0] // values[0]
            idiom.detail["caseValues"] = values
            idiom.detail["foldedFactor"] = ratio
            idiom.verified = ratio is not None
        found.append(idiom)
    return found


def _linear_maps_and_select_chains(function: Function, source: SourceFunction | None, evaluator: Evaluator) -> list[Idiom]:
    """A switch that became arithmetic: a cmov/csinv guarded by a bounds compare whose chosen value is
    affine in the index (LLVM LinearMapKind), or a chain of setcc/cmov or csel on equality compares."""
    found: list[Idiom] = []
    if source is None or not source.has_switch or not source.params:
        return found
    index = source.params[0]
    selects = [i for i in function.instructions if i.mnemonic.startswith("cmov") or i.mnemonic in ("csel", "csinv", "csinc", "csneg")]
    if not selects:
        return found
    last = selects[-1]
    state = dict(evaluator.before(last.address))
    probe = Evaluator(function, source.params)
    probe.state = state
    probe.flags = evaluator.flags_at.get(last.address)
    probe.step(last)
    destination = last.operands[-1] if function.arch == "x86_64" else last.operands[0]
    result = probe.state.get(register_family(function.arch, destination) or "")
    if result is None:
        return found
    compares = [i for i in function.instructions if i.mnemonic in ("cmpl", "cmp") and any(parse_immediate(o) is not None and (o.startswith("$") or o.startswith("#")) for o in i.operands)]
    evidence = sorted({i.address for i in compares} | {i.address for i in selects} | {i.address for i in function.instructions if i.mnemonic in ("leal", "madd", "sete", "setne", "movl", "mov", "xorl") and function.start <= i.address < last.address})
    text = str(result)
    affine = re.search(rf"\? (-?\d+\*{index}(?: [+-] \d+)?|{index}(?: [+-] \d+)?) : (-?\d+)$", text)
    if affine and len(selects) == 1:
        detail = {"lowering": "linear map", "expression": text}
        idiom = _switch_idiom(function, source, "linear map", evidence, detail, None)
        formula = affine.group(1)
        default = int(affine.group(2))
        coefficient = int(formula.split("*")[0]) if "*" in formula else 1
        constant = 0
        tail = re.search(r" ([+-]) (\d+)$", formula)
        if tail:
            constant = int(tail.group(2)) * (1 if tail.group(1) == "+" else -1)
        expected = {k: coefficient * k + constant for k in source.cases if source.cases[k] is not None}
        idiom.detail["formula"] = f"{coefficient}*{index} + {constant}"
        idiom.detail["default"] = default
        idiom.verified = all(source.cases[k] == v for k, v in expected.items()) and bool(expected)
        idiom.result = (last.address, register_family(function.arch, destination) or "", text)
        found.append(idiom)
        return found
    if len(compares) >= 1 and (len(selects) >= 2 or any(i.mnemonic.startswith("set") for i in function.instructions)):
        idiom = _switch_idiom(function, source, "select chain", evidence, {"lowering": "select chain", "expression": text, "selects": len(selects)}, None)
        idiom.verified = len([k for k in source.cases if source.cases[k] is not None]) <= 3
        idiom.result = (last.address, register_family(function.arch, destination) or "", text)
        found.append(idiom)
    return found


def _comparison_trees(function: Function, source: SourceFunction | None, evaluator: Evaluator) -> list[Idiom]:
    """Equality tests on one value, split by ordered compares: LLVM's binary-search lowering.
    With no ordered compare it is a plain compare chain. A `sub N; cmp M; jae` is a range test N..N+M-1."""
    equality: dict[str, list[tuple[Instruction, Instruction, int]]] = {}
    ordered: dict[str, list[tuple[Instruction, Instruction, int]]] = {}
    ranges: dict[str, list[tuple[Instruction, Instruction, int, int]]] = {}
    instructions = function.instructions
    flag_writers = {"cmpl", "cmpq", "subl", "subq", "testl", "cmp", "subs", "adds", "negs", "cbz", "cbnz", "negl", "addl"}
    for position, instruction in enumerate(instructions):
        branch = None
        for candidate in window(function, position + 1, 3):
            if is_conditional(candidate):
                branch = candidate
                break
            if candidate.mnemonic in flag_writers or is_branch(candidate) or is_return(candidate):
                break
        value: Val | None = None
        constant: int | None = None
        code = ""
        state = evaluator.before(instruction.address)

        def constant_of(operand: str) -> int | None:
            if operand.startswith("$") or operand.startswith("#"):
                return parse_immediate(operand)
            register_value = state.get(register_family(function.arch, operand) or "")
            return register_value.constant if register_value is not None and register_value.is_const() else None

        if function.arch == "x86_64":
            if branch is not None and instruction.mnemonic in ("cmpl", "subl", "subq", "cmpq") and len(instruction.operands) == 2 and constant_of(instruction.operands[0]) is not None:
                value = state.get(x86_family(instruction.operands[1]) or "")
                constant = constant_of(instruction.operands[0])
            elif branch is not None and instruction.mnemonic == "testl" and len(instruction.operands) == 2 and instruction.operands[0] == instruction.operands[1]:
                value = state.get(x86_family(instruction.operands[1]) or "")
                constant = 0
            code = branch.mnemonic[1:] if branch is not None else ""
        else:
            if branch is not None and instruction.mnemonic in ("cmp", "subs") and constant_of(instruction.operands[-1]) is not None:
                value = state.get(arm_family(instruction.operands[1] if instruction.mnemonic == "subs" else instruction.operands[0]) or "")
                constant = constant_of(instruction.operands[-1])
                code = branch.mnemonic[2:] if branch.mnemonic.startswith("b.") else ""
            elif instruction.mnemonic in ("cbz", "cbnz"):
                value = state.get(arm_family(instruction.operands[0]) or "")
                constant = 0
                code = "eq"
                branch = instruction
        if value is None or constant is None or branch is None:
            continue
        text = str(value)
        biased = re.match(r"^(.*) - (\d+)$", text)
        if biased and code in ("ae", "b", "hs", "lo", "a", "be", "hi", "ls"):
            inclusive = code in ("be", "ls", "a", "hi")
            low = int(biased.group(2))
            ranges.setdefault(biased.group(1), []).append((instruction, branch, low, low + constant - (0 if inclusive else 1)))
            continue
        if code in ("e", "ne", "eq"):
            equality.setdefault(text, []).append((instruction, branch, constant))
        elif code in ("l", "le", "g", "ge", "lt", "gt", "hs", "hi", "lo", "ls", "ae", "a", "b", "be"):
            ordered.setdefault(text, []).append((instruction, branch, constant))
    if not equality:
        return []
    key = max(equality, key=lambda r: len(equality[r]))
    leaves = equality[key]
    if len(leaves) < 2 and not ranges.get(key):
        return []
    pivots = ordered.get(key, [])
    range_tests = ranges.get(key, [])
    evidence = sorted({i.address for i, _b, _c in leaves} | {b.address for _i, b, _c in leaves} | {i.address for i, _b, _c in pivots} | {b.address for _i, b, _c in pivots} | {i.address for i, _b, _lo, _hi in range_tests} | {b.address for _i, b, _lo, _hi in range_tests})
    kind = "comparison tree" if pivots else "compare chain"
    constants = sorted({c for _i, _b, c in leaves})
    detail = {"lowering": kind, "index": key, "equalityTests": constants, "pivots": sorted({c for _i, _b, c in pivots}), "rangeTests": [[lo, hi] for _i, _b, lo, hi in range_tests], "depth": len(pivots)}
    idiom = _switch_idiom(function, source, kind, evidence, detail, None, key)
    if source is not None:
        tested = set(constants) | {k for _i, _b, lo, hi in range_tests for k in range(lo, hi + 1)}
        idiom.verified = source.has_switch and tested <= set(source.cases)
    return [idiom]


def _switch_idiom(function: Function, source: SourceFunction | None, lowering: str, evidence: list[int], detail: dict[str, Any], distinct_targets: int | None, index_text: str | None = None) -> Idiom:
    index_name = index_text or (source.params[0] if source and source.params else "k")
    idiom = Idiom("switch", function.name, f"switch ({index_name}) as {lowering}", sorted(dict.fromkeys(evidence)), {"lowering": lowering, **detail})
    if source is not None:
        idiom.verified = source.has_switch
        if distinct_targets is not None and source.cases:
            distinct_source = len(set(v for v in source.cases.values()) if all(v is not None for v in source.cases.values()) else source.cases)
            idiom.detail["distinctSourceOutcomes"] = distinct_source
            idiom.verified = idiom.verified and distinct_targets == distinct_source
        if detail.get("entries") is not None and source.cases:
            idiom.detail["sourceCases"] = sorted(source.cases)
            if detail["entries"] != len(source.cases) and idiom.verified is not False:
                idiom.verified = False
    return idiom


def lane_count(mnemonic: str, operands: tuple[str, ...]) -> tuple[int, int] | None:
    """(lanes, bits per lane) of a packed add."""
    if mnemonic == "paddd":
        return 4, 32
    if mnemonic == "paddq":
        return 2, 64
    if mnemonic == "paddw":
        return 8, 16
    for operand in operands:
        match = re.search(r"\.(\d+)([bhsd])$", operand)
        if mnemonic in ("add", "addv") and match:
            return int(match.group(1)), {"b": 8, "h": 16, "s": 32, "d": 64}[match.group(2)]
    return None


def find_vector_loops(function: Function, source: SourceFunction | None) -> list[Idiom]:
    found: list[Idiom] = []
    edges = loops(function)
    for branch, target in edges:
        body = loop_body(function, (branch, target))
        simd = [i for i in body if any(SIMD_REGISTER.search(o) for o in i.operands)]
        if not simd:
            continue
        adds = [i for i in simd if lane_count(i.mnemonic, i.operands)]
        lanes = lane_count(adds[0].mnemonic, adds[0].operands) if adds else None
        accumulators = {(i.operands[-1] if function.arch == "x86_64" else i.operands[0]) for i in adds}
        step = None
        for i in body:
            if function.arch == "x86_64" and i.mnemonic == "addq" and i.operands[0].startswith("$"):
                step = parse_immediate(i.operands[0])
            if function.arch == "arm64" and i.mnemonic == "subs" and i.operands[2].startswith("#"):
                step = parse_immediate(i.operands[2])
        elements = None
        if lanes and step is not None:
            elements = step // (lanes[1] // 8) if function.arch == "x86_64" else step
        position = function.index(target)
        before = window(function, max(0, position - 24), min(24, position))
        mask = next((i for i in reversed(before) if i.mnemonic in ("andl", "and") and any(parse_immediate(o) is not None and (parse_immediate(o) or 0) & 0x7FFFFFF8 == 0x7FFFFFF8 and not o.startswith("%") for o in i.operands)), None)
        guard = next((i for i in reversed(before) if i.mnemonic in ("cmpl", "cmp") and parse_immediate(i.operands[0] if function.arch == "x86_64" else i.operands[1]) == (elements or 8) - 1), None)
        after = window(function, function.index(branch.address) + 1, 8)
        reduction = [i for i in after if i.mnemonic in ("pshufd", "paddd", "movd", "addv", "fmov")]
        remainder = [e for e in edges if e[1] > branch.address and not any(SIMD_REGISTER.search(o) for i in loop_body(function, e) for o in i.operands)]
        evidence = sorted({i.address for i in body} | {i.address for i in reduction} | ({mask.address} if mask else set()) | ({guard.address} if guard else set()))
        detail = {
            "vectorRegisters": sorted({m.group(0) for i in simd for o in i.operands for m in [SIMD_REGISTER.search(o)] if m}),
            "lanes": lanes[0] if lanes else None,
            "laneBits": lanes[1] if lanes else None,
            "accumulators": len(accumulators),
            "elementsPerIteration": elements,
            "tripCountMask": mask.text if mask else None,
            "minimumTripGuard": guard.text if guard else None,
            "reduction": [i.text for i in reduction],
            "scalarRemainderLoop": f"0x{remainder[0][1]:x}-0x{remainder[0][0].address:x}" if remainder else None,
            "loop": f"0x{target:x}-0x{branch.address:x}",
        }
        stores = [i for i in simd if (function.arch == "x86_64" and i.mnemonic.startswith("mov") and parse_x86_memory(i.operands[-1])) or (function.arch == "arm64" and i.mnemonic in ("str", "stp"))]
        if lanes:
            text = f"vectorized loop: {lanes[0]} lanes x {len(accumulators)} accumulators = {elements} elements per iteration"
        else:
            text = f"vectorized store loop: {len(stores)} x 16-byte stores = {step} bytes per iteration"
            detail["stores"] = len(stores)
            detail["bytesPerIteration"] = step
        idiom = Idiom("vector loop", function.name, text, evidence, detail)
        idiom.verified = source.has_loop if source else None
        final = remainder[0][0] if remainder else (reduction[-1] if reduction else branch)
        accumulator_family = None
        if reduction:
            last = reduction[-1]
            accumulator_family = register_family(function.arch, last.operands[-1] if function.arch == "x86_64" else last.operands[0])
        if accumulator_family:
            idiom.result = (final.address, accumulator_family, "sum")
        found.append(idiom)
    if not edges:
        simd = [i for i in function.instructions if any(SIMD_REGISTER.search(o) for o in i.operands)]
        reduction = [i for i in simd if i.mnemonic in ("pshufd", "paddd", "addv")]
        if reduction and source and source.has_loop:
            lanes = next((lane_count(i.mnemonic, i.operands) for i in reduction if lane_count(i.mnemonic, i.operands)), None)
            evidence = [i.address for i in simd]
            found.append(Idiom("vector loop", function.name, f"fixed-count loop fully vectorized: one {lanes[0] if lanes else '?'}-lane load and a horizontal reduction, no back edge", evidence, {"lanes": lanes[0] if lanes else None, "reduction": [i.text for i in reduction], "loop": None}, verified=True))
    return found


def find_unrolled_loops(function: Function, source: SourceFunction | None) -> list[Idiom]:
    """N loads from one base register at consecutive offsets inside one region: the body was copied N times."""
    found: list[Idiom] = []
    if source is None or not source.has_loop:
        return found
    edges = loops(function)
    regions = [(loop_body(function, e), e) for e in edges] + ([(function.instructions, None)] if not edges else [])
    for body, edge in regions:
        if any(SIMD_REGISTER.search(o) for i in body for o in i.operands):
            continue
        loads: dict[tuple[str, str | None], list[tuple[int, int]]] = {}
        for instruction in body:
            for operand in instruction.operands:
                memory = parse_x86_memory(operand) if function.arch == "x86_64" else parse_arm_memory(operand)
                if memory is None or memory.base is None or memory.base in ("%rbp", "%rsp", "sp"):
                    continue
                if instruction.mnemonic.startswith("mov") and function.arch == "x86_64" and instruction.operands[-1] == operand:
                    continue
                width = 2 if instruction.mnemonic == "ldp" else 1
                loads.setdefault((memory.base, memory.index), []).append((memory.displacement, width))
        for (base, index), entries in loads.items():
            offsets = sorted(set(o for o, _w in entries))
            copies = sum(w for _o, w in entries)
            if copies < 4 or len(offsets) < 2:
                continue
            stride = offsets[1] - offsets[0]
            if any(b - a != stride for a, b in zip(offsets, offsets[1:])):
                continue
            step = None
            if edge is not None:
                for i in body:
                    if function.arch == "x86_64" and i.mnemonic == "addq" and i.operands[0].startswith("$") and register_family("x86_64", i.operands[1]) == register_family("x86_64", index or ""):
                        step = parse_immediate(i.operands[0])
            evidence = [i.address for i in body if any((parse_x86_memory(o) if function.arch == "x86_64" else parse_arm_memory(o)) and ((parse_x86_memory(o) if function.arch == "x86_64" else parse_arm_memory(o)).base == base) for o in i.operands)]
            text = f"loop unrolled by {copies}" + (", loop kept" if edge is not None else ", no back edge: fully unrolled")
            detail = {"copies": copies, "stride": stride, "offsets": [f"0x{o:x}" for o in offsets], "base": base.lstrip("%"), "indexStep": step, "loop": f"0x{edge[1]:x}-0x{edge[0].address:x}" if edge else None}
            found.append(Idiom("unrolled loop", function.name, text, sorted(evidence), detail, verified=True))
    return found


def find_tail_calls(function: Function, source: SourceFunction | None) -> list[Idiom]:
    found: list[Idiom] = []
    for instruction in function.instructions:
        if instruction.relocation is None:
            continue
        symbol = instruction.relocation_symbol or ""
        if symbol in ("memset", "memcpy") and source is not None and symbol not in source.calls:
            continue
        if (function.arch == "x86_64" and instruction.mnemonic == "jmp" and instruction.relocation[0] == "R_X86_64_PLT32") or (function.arch == "arm64" and instruction.mnemonic == "b" and instruction.relocation[0] == "R_AARCH64_JUMP26"):
            idiom = Idiom("tail call", function.name, f"return {symbol}(...)", [instruction.address], {"callee": symbol, "relocation": instruction.relocation[0], "returnsThroughCallee": True})
            idiom.verified = symbol in source.calls if source else None
            found.append(idiom)
    return found


def find_calls(function: Function) -> list[tuple[Instruction, str]]:
    calls = []
    for instruction in function.instructions:
        if instruction.relocation and ((instruction.mnemonic == "callq" and instruction.relocation[0] == "R_X86_64_PLT32") or (instruction.mnemonic == "bl" and instruction.relocation[0] == "R_AARCH64_CALL26")):
            calls.append((instruction, instruction.relocation_symbol or ""))
    return calls


def shape(instruction: Instruction, arch: str) -> str:
    """Mnemonic plus source operands, without the destination register."""
    ops = list(instruction.operands)
    if arch == "x86_64" and ops:
        ops = ops[:-1]
    elif arch == "arm64" and ops:
        ops = ops[1:]
    return instruction.mnemonic + " " + ", ".join(ops)


def find_inlined_calls(listing: Listing, function: Function, source: SourceFunction | None, sources: dict[str, SourceFunction]) -> list[Idiom]:
    found: list[Idiom] = []
    if source is None:
        return found
    direct = {symbol for _i, symbol in find_calls(function)} | {i.relocation_symbol for i in function.instructions if i.mnemonic in ("jmp", "b") and i.relocation}
    for callee in source.calls:
        if callee not in listing.functions or callee in direct:
            continue
        callee_function = listing.functions[callee]
        body_shapes = {shape(i, listing.arch) for i in callee_function.body() if not is_return(i) and i.mnemonic not in ("pushq", "popq", "movq", "movl", "sub", "add", "str", "ldr", "ldur", "stur") or i.mnemonic in ("add",) and len(i.operands) == 3 and not i.operands[2].startswith("#")}
        matches = [i for i in function.body() if shape(i, listing.arch) in body_shapes]
        evidence = [i.address for i in matches] or [function.start]
        found.append(Idiom("inlined call", function.name, f"{callee}(...) expanded in place", evidence, {"callee": callee, "calleeBodyShapes": sorted(body_shapes), "matchedInCaller": [i.text for i in matches], "directCallPresent": False}, verified=bool(matches)))
    return found


def find_selects(function: Function, source: SourceFunction | None, evaluator: Evaluator, taken: set[int]) -> list[Idiom]:
    found: list[Idiom] = []
    for instruction in function.instructions:
        if instruction.address in taken:
            continue
        is_select = (function.arch == "x86_64" and (instruction.mnemonic.startswith("cmov") or (instruction.mnemonic.startswith("set") and instruction.mnemonic != "setg" or instruction.mnemonic == "setg"))) or (function.arch == "arm64" and instruction.mnemonic in ("csel", "cset", "cneg", "csinv", "csneg", "csinc"))
        if not is_select or instruction.mnemonic.startswith("set") and function.arch == "x86_64" and not instruction.mnemonic[3:] in X86_CONDITIONS:
            continue
        probe = Evaluator(function, source.params if source else [])
        probe.state = dict(evaluator.before(instruction.address))
        probe.flags = evaluator.flags_at.get(instruction.address)
        probe.step(instruction)
        destination = instruction.operands[-1] if function.arch == "x86_64" else instruction.operands[0]
        value = probe.state.get(register_family(function.arch, destination) or "")
        text = str(value) if value else instruction.text
        position = function.index(instruction.address)
        compare = next((i for i in reversed(window(function, max(0, position - 3), min(3, position))) if i.mnemonic in ("cmpl", "testl", "negl", "cmp", "negs", "subs")), None)
        evidence = ([compare.address] if compare else []) + [instruction.address]
        kind = "branchless select" if "?" in text else "branchless flag"
        idiom = Idiom(kind, function.name, text, evidence, {"instruction": instruction.text, "condition": compare.text if compare else None})
        if source is not None:
            idiom.verified = source.has_select or bool(re.search(r"[<>]=?\s*\w+\s*;", source.body)) or bool(re.search(r"\b(a|b|x|rem) [<>] ", source.body))
        idiom.result = (instruction.address, register_family(function.arch, destination) or "", text)
        found.append(idiom)
    return found


def find_memory_builtins(function: Function, source: SourceFunction | None) -> list[Idiom]:
    found: list[Idiom] = []
    for instruction in function.instructions:
        symbol = instruction.relocation_symbol
        if symbol in ("memset", "memcpy") and instruction.mnemonic in ("jmp", "callq", "b", "bl"):
            via = "tail call" if instruction.mnemonic in ("jmp", "b") else "call"
            text = f"{symbol}(...) library {via}"
            if source and not any(c == symbol for c in source.calls) and source.has_loop:
                text = f"store loop recognized as {symbol}(...)"
            idiom = Idiom(symbol, function.name, text, [instruction.address], {"form": f"library {via}", "callee": symbol})
            idiom.verified = (symbol in source.calls or source.has_loop) if source else None
            found.append(idiom)
    instructions = function.instructions
    for position, instruction in enumerate(instructions):
        if function.arch == "x86_64" and instruction.mnemonic in ("movups", "movdqu", "movaps") and position + 1 < len(instructions):
            store = instructions[position + 1]
            if store.mnemonic == instruction.mnemonic and store.operands[0] == instruction.operands[1] and parse_x86_memory(store.operands[1]) and parse_x86_memory(instruction.operands[0]) and not loops(function):
                idiom = Idiom("memcpy", function.name, "memcpy(dst, src, 16) expanded inline as one 16-byte load and store", [instruction.address, store.address], {"form": "inline expansion", "bytes": 16})
                idiom.verified = "memcpy" in (source.calls if source else [])
                found.append(idiom)
        if function.arch == "arm64" and instruction.mnemonic == "ldr" and instruction.operands[0].startswith("q") and position + 1 < len(instructions):
            store = instructions[position + 1]
            if store.mnemonic == "str" and store.operands[0] == instruction.operands[0]:
                idiom = Idiom("memcpy", function.name, "memcpy(dst, src, 16) expanded inline as one 16-byte load and store", [instruction.address, store.address], {"form": "inline expansion", "bytes": 16})
                idiom.verified = "memcpy" in (source.calls if source else [])
                found.append(idiom)
        if function.arch == "x86_64" and instruction.mnemonic == "movq" and parse_x86_memory(instruction.operands[0]) and position + 3 < len(instructions):
            following = instructions[position + 1 : position + 4]
            if following[0].mnemonic == "movq" and parse_x86_memory(following[0].operands[1]) and following[1].mnemonic == "movq" and parse_x86_memory(following[1].operands[0]) and following[2].mnemonic == "movq" and parse_x86_memory(following[2].operands[1]) and parse_x86_memory(following[1].operands[0]).displacement == 8:
                idiom = Idiom("memcpy", function.name, "memcpy(dst, src, 16) expanded inline as two 8-byte loads and stores", [instruction.address] + [i.address for i in following], {"form": "inline expansion", "bytes": 16})
                idiom.verified = "memcpy" in (source.calls if source else [])
                found.append(idiom)
    return found


def find_stack_protector(function: Function) -> list[Idiom]:
    fail = next((i for i in function.instructions if i.relocation_symbol == "__stack_chk_fail"), None)
    if fail is None:
        return []
    if function.arch == "x86_64":
        loads = [i for i in function.instructions if any("%fs:0x28" in o for o in i.operands)]
        compare = next((i for i in function.instructions if i.mnemonic == "cmpq"), None)
        slot = next((i.operands[1] for i in function.instructions if i.mnemonic == "movq" and i.address > loads[0].address and parse_x86_memory(i.operands[1])), None) if loads else None
        guard = "%fs:0x28 (tcbhead_t.stack_guard)"
    else:
        loads = [i for i in function.instructions if i.relocation_symbol == "__stack_chk_guard"]
        compare = next((i for i in function.instructions if i.mnemonic == "cmp" and i.address > loads[-1].address), None) if loads else None
        slot = next((i.operands[1] for i in function.instructions if i.mnemonic == "stur"), None)
        guard = "__stack_chk_guard through the GOT"
    branch = next((i for i in function.instructions if compare and i.address > compare.address and is_conditional(i)), None)
    evidence = [i.address for i in loads] + ([compare.address] if compare else []) + ([branch.address] if branch else []) + [fail.address]
    return [Idiom("stack protector", function.name, "canary stored in the prologue and compared in the epilogue", sorted(set(evidence)), {"guard": guard, "slot": slot, "failCall": fail.text + " -> __stack_chk_fail"}, verified=True)]


def find_cet(function: Function) -> list[Idiom]:
    if function.instructions and function.instructions[0].mnemonic == "endbr64":
        return [Idiom("cet landing pad", function.name, "endbr64 as the first instruction (-fcf-protection)", [function.start], {"bytes": function.instructions[0].raw}, verified=True)]
    return []


def find_strength_reduction(function: Function, source: SourceFunction | None, evaluator: Evaluator, taken: set[int]) -> list[Idiom]:
    found: list[Idiom] = []
    if source is None:
        return found
    for instruction in function.instructions:
        if instruction.address in taken:
            continue
        factor = None
        if function.arch == "x86_64" and instruction.mnemonic == "leal":
            memory = parse_x86_memory(instruction.operands[0])
            if memory and memory.base and memory.index and x86_family(memory.base) == x86_family(memory.index) and memory.displacement == 0:
                factor = 1 + memory.scale
                operand = memory.base
        if function.arch == "arm64" and instruction.mnemonic == "add" and len(instruction.operands) == 4 and instruction.operands[3].startswith("lsl #") and arm_family(instruction.operands[1]) == arm_family(instruction.operands[2]):
            factor = 1 + (1 << int(instruction.operands[3][5:]))
            operand = instruction.operands[1]
        if factor is None or factor not in source.multiplies:
            continue
        value = evaluator.before(instruction.address).get(register_family(function.arch, operand) or "", Val.opaque(operand))
        found.append(Idiom("strength reduction", function.name, f"{value} * {factor}", [instruction.address], {"instruction": instruction.text, "factor": factor}, verified=True))
    return found


def quotient_shared(function: Function, division: Idiom, modulo: Idiom) -> bool:
    """True when an instruction outside the modulo reads the quotient before it is overwritten:
    the same division then serves x / d and x % d and both idioms stay in the report."""
    if division.result is None:
        return False
    end_address, quotient, _text = division.result
    reads_outside = False
    for instruction in function.instructions:
        if instruction.address <= end_address or instruction.address in modulo.evidence:
            continue
        families = [register_family(function.arch, o) for o in instruction.operands]
        if not families:
            if is_return(instruction):
                break
            continue
        destination = families[-1] if function.arch == "x86_64" else families[0]
        sources = families[:-1] if function.arch == "x86_64" else families[1:]
        if instruction.mnemonic in ("addl", "subl", "andl", "cmpl", "testl") and function.arch == "x86_64":
            sources = families
        if quotient in sources:
            reads_outside = True
        if destination == quotient and quotient not in sources:
            break
        if is_terminator(instruction) and not is_conditional(instruction):
            break
    return reads_outside


def analyze_function(listing: Listing, name: str, elf: ElfFile | None, sources: dict[str, SourceFunction]) -> list[Idiom]:
    function = listing.functions[name]
    source = sources.get(name)
    first = evaluator_for(function, source)
    divisions = find_divisions(function, first)
    modulos = find_modulos(function, divisions, first)
    seeds: dict[int, tuple[str, str]] = {}
    for idiom in divisions + modulos:
        if idiom.result:
            seeds[idiom.result[0]] = (idiom.result[1], idiom.result[2])
    vectors = find_vector_loops(function, source)
    second = evaluator_for(function, source, seeds)
    divisions = find_divisions(function, second)
    modulos = find_modulos(function, divisions, second)
    divisions = [d for d in divisions if not any(m.evidence[: len(d.evidence)] == d.evidence and not quotient_shared(function, d, m) for m in modulos)]
    for idiom in divisions + modulos:
        if idiom.result:
            seeds[idiom.result[0]] = (idiom.result[1], idiom.result[2])
    third = evaluator_for(function, source, seeds)
    switches = find_switches(function, elf, source, third)
    for idiom in switches:
        if idiom.result:
            seeds[idiom.result[0]] = (idiom.result[1], idiom.result[2])
    final = evaluator_for(function, source, seeds)
    taken = {a for i in divisions + modulos + switches for a in i.evidence}
    idioms = divisions + modulos + switches + vectors
    idioms += find_unrolled_loops(function, source)
    idioms += find_tail_calls(function, source)
    idioms += find_inlined_calls(listing, function, source, sources)
    idioms += find_selects(function, source, final, taken)
    idioms += find_memory_builtins(function, source)
    idioms += find_stack_protector(function)
    idioms += find_cet(function)
    idioms += find_strength_reduction(function, source, final, taken)
    for idiom in divisions + modulos:
        if source is not None:
            divisor = idiom.detail.get("divisor") or idiom.detail.get("algorithm", {}).get("divisor")
            idiom.verified = divisor in (source.divisions if idiom.kind == "division" else source.modulos)
    return idioms


def tail_call_text(idioms: list[Idiom]) -> list[str]:
    return [i.source for i in idioms if i.kind == "tail call"]


FIXTURE_BUILDS = [
    ("idioms", "x86_64", "O0", "idioms.c"), ("idioms", "x86_64", "O1", "idioms.c"), ("idioms", "x86_64", "O2", "idioms.c"), ("idioms", "x86_64", "O3", "idioms.c"),
    ("idioms", "arm64", "O0", "idioms.c"), ("idioms", "arm64", "O1", "idioms.c"), ("idioms", "arm64", "O2", "idioms.c"), ("idioms", "arm64", "O3", "idioms.c"),
    ("idioms", "x86_64-nofastisel", "O0", "idioms.c"), ("idioms", "x86_64-nojt", "O2", "idioms.c"), ("idioms", "x86_64-novec", "O2", "idioms.c"), ("idioms", "x86_64-nobuiltin", "O2", "idioms.c"),
    ("idioms", "arm64-jt4", "O2", "idioms.c"),
    ("dispatch", "x86_64", "O2", "dispatch.c"), ("dispatch", "arm64", "O2", "dispatch.c"),
    ("canary", "x86_64-ssp", "O2", "canary.c"), ("canary", "x86_64-cet", "O2", "canary.c"), ("canary", "arm64-ssp", "O2", "canary.c"),
]


def build_name(program: str, tag: str, level: str) -> str:
    return f"{program}-{tag}-{level}"


def analyze_build(program: str, tag: str, level: str, source_file: str) -> dict[str, Any]:
    base = build_name(program, tag, level)
    listing = load_listing(base + ".objdump.txt")
    elf = load_elf(base + ".o")
    sources = load_source(source_file)
    functions = {name: [i.to_dict() for i in analyze_function(listing, name, elf, sources)] for name in listing.functions}
    return {"arch": listing.arch, "level": level, "flags": tag, "functions": functions}


def analyze_all() -> dict[str, dict[str, Any]]:
    return {build_name(p, t, l): analyze_build(p, t, l, s) for p, t, l, s in FIXTURE_BUILDS}


def kind_matrix(report: dict[str, dict[str, Any]]) -> dict[str, dict[str, int]]:
    matrix: dict[str, dict[str, int]] = {}
    for build, entry in report.items():
        counts: dict[str, int] = {}
        for idioms in entry["functions"].values():
            for idiom in idioms:
                counts[idiom["kind"]] = counts.get(idiom["kind"], 0) + 1
        matrix[build] = dict(sorted(counts.items()))
    return matrix


def relative_text(function: Function, instruction: Instruction) -> str:
    """Instruction text with a branch target written relative to the function start, so that a shifted
    function compares equal to itself."""
    target = branch_target(instruction)
    if target is None:
        return instruction.text
    return f"{instruction.mnemonic} ->+0x{target - function.start:x}"


def listing_identity(first: str, second: str) -> dict[str, Any]:
    """Compare two listings function by function on instruction text, with branch targets made relative."""
    a, b = load_listing(first), load_listing(second)
    differences = []
    for name in a.functions:
        if name not in b.functions:
            differences.append({"function": name, "reason": "missing in second"})
            continue
        fa, fb = a.functions[name], b.functions[name]
        for x, y in zip(fa.instructions, fb.instructions):
            if relative_text(fa, x) != relative_text(fb, y):
                differences.append({"function": name, "offset": f"+0x{x.address - fa.start:x}", "first": x.text, "second": y.text})
        if len(fa.instructions) != len(fb.instructions):
            differences.append({"function": name, "reason": f"instruction counts differ: {len(fa.instructions)} vs {len(fb.instructions)}"})
    return {"identical": not differences, "differences": differences}


def unverified(report: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for build, entry in report.items():
        for name, idioms in entry["functions"].items():
            for idiom in idioms:
                if idiom["verified"] is False:
                    rows.append({"build": build, "function": name, "kind": idiom["kind"], "source": idiom["source"]})
    return rows


def demo() -> dict[str, Any]:
    report = analyze_all()
    return {
        "builds": report,
        "kindMatrix": kind_matrix(report),
        "sameCodeAtO2AndO3": {"x86_64": listing_identity("idioms-x86_64-O2.objdump.txt", "idioms-x86_64-O3.objdump.txt"), "arm64": listing_identity("idioms-arm64-O2.objdump.txt", "idioms-arm64-O3.objdump.txt")},
        "unverified": unverified(report),
    }


FIGURE_KINDS = ["division", "modulo", "switch", "vector loop", "unrolled loop", "branchless select", "branchless flag", "tail call", "inlined call", "memset", "memcpy", "strength reduction"]


def figure_data(function_name: str = "digest") -> dict[str, Any]:
    sources = load_source("idioms.c")
    data: dict[str, Any] = {"function": function_name, "source": sources[function_name].body.strip().splitlines(), "kinds": FIGURE_KINDS, "arches": {}}
    for arch in ARCHES:
        levels: dict[str, Any] = {}
        for level in LEVELS:
            base = build_name("idioms", arch, level)
            listing = load_listing(base + ".objdump.txt")
            elf = load_elf(base + ".o")
            function = listing.functions[function_name]
            idioms = [i for i in analyze_function(listing, function_name, elf, sources) if i.kind in FIGURE_KINDS]
            instructions = [{"a": i.address, "b": i.raw, "t": " ".join(i.text.split())} for i in function.instructions]
            spans = [{"k": i.kind, "s": i.source, "e": i.evidence, "d": {key: value for key, value in i.detail.items() if key in ("lowering", "form", "magic", "shift", "entries", "values", "targets", "elementsPerIteration", "lanes", "accumulators", "copies", "callee", "formula", "expression")}} for i in idioms]
            levels[level] = {"instructions": instructions, "spans": spans, "bytes": function.end - function.start, "count": len(function.instructions)}
        data["arches"][arch] = levels
    return data


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "scan" and len(argv) in (2, 3):
        path = Path(argv[1])
        listing = parse_listing(path.read_text(), path.name)
        object_path = path.with_name(path.name.replace(".objdump.txt", ".o"))
        elf = ElfFile(object_path.read_bytes()) if object_path.exists() else None
        source_name = "dispatch.c" if path.name.startswith("dispatch") else "canary.c" if path.name.startswith("canary") else "idioms.c"
        sources = load_source(source_name) if (FIXTURES / source_name).exists() else {}
        names = [argv[2]] if len(argv) == 3 else list(listing.functions)
        print(json.dumps({name: [i.to_dict() for i in analyze_function(listing, name, elf, sources)] for name in names}, indent=2))
        return 0
    if command == "magic" and len(argv) in (2, 3):
        divisor = int(argv[1], 0)
        signed = len(argv) == 3 and argv[2] == "signed"
        magic = magic_numbers(divisor, 32, signed)
        print(json.dumps({**magic.to_dict(), "identityHoldsOnEdgeValues": check_identity(magic, edge_values(32, signed))}, indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [scan LISTING.objdump.txt [FUNCTION] | magic DIVISOR [signed] | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
