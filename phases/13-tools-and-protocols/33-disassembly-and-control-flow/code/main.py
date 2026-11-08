"""Companion code for docs/en.md: decode x86-64 machine code and recover control flow.
Instruction format: Intel SDM Volume 2, Chapter 2 (prefixes, REX, ModRM, SIB, RIP-relative).
Relocation formulas: x86-64 psABI Table 4.9 (R_X86_64_PC32 = S + A - P).
Dominators: Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001).
Run `python3 main.py` for the finite demo or `python3 tests/test_main.py` for the suite.
"""

from __future__ import annotations

import json
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
MAX_INSTRUCTION_LENGTH = 15

SHT_SYMTAB = 2
SHT_STRTAB = 3
SHT_RELA = 4
SHT_NOBITS = 8
STT_SECTION = 3
STT_FUNC = 2
EM_X86_64 = 62

RELOCATION_NAMES = {
    0: "R_X86_64_NONE",
    1: "R_X86_64_64",
    2: "R_X86_64_PC32",
    4: "R_X86_64_PLT32",
    10: "R_X86_64_32",
    11: "R_X86_64_32S",
}
PC_RELATIVE_RELOCATIONS = {2, 4}


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
    entsize: int
    data: bytes


@dataclass(frozen=True)
class Symbol:
    name: str
    value: int
    size: int
    type: int
    bind: int
    shndx: int
    section: str


@dataclass(frozen=True)
class Relocation:
    section: str
    offset: int
    type: int
    symbol: Symbol
    addend: int

    @property
    def type_name(self) -> str:
        return RELOCATION_NAMES.get(self.type, f"R_X86_64_{self.type}")

    @property
    def symbol_name(self) -> str:
        if self.symbol.type == STT_SECTION:
            return self.symbol.section
        return self.symbol.name

    def describe(self) -> str:
        if self.addend == 0:
            return f"{self.type_name} {self.symbol_name}"
        sign = "+" if self.addend > 0 else "-"
        return f"{self.type_name} {self.symbol_name}{sign}0x{abs(self.addend):x}"


class ElfError(ValueError):
    pass


class ElfObject:
    """Reads section headers, symbols, and RELA relocations of an ELF64 relocatable file."""

    def __init__(self, data: bytes) -> None:
        if data[:4] != b"\x7fELF":
            raise ElfError("not an ELF file")
        if data[4] != 2 or data[5] != 1:
            raise ElfError("only ELF64 little-endian objects are supported")
        header = struct.unpack_from("<16sHHIQQQIHHHHHH", data, 0)
        self.machine = header[2]
        if self.machine != EM_X86_64:
            raise ElfError(f"e_machine {self.machine} is not x86-64")
        shoff, shentsize, shnum, shstrndx = header[6], header[11], header[12], header[13]
        raw_headers = [
            struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize)
            for index in range(shnum)
        ]
        names = raw_headers[shstrndx]
        name_table = data[names[4] : names[4] + names[5]]
        self.sections: list[Section] = []
        for index, raw in enumerate(raw_headers):
            sh_name, sh_type, sh_flags, _addr, sh_offset, sh_size, sh_link, sh_info, _align, sh_entsize = raw
            payload = b"" if sh_type == SHT_NOBITS else data[sh_offset : sh_offset + sh_size]
            self.sections.append(
                Section(index, _cstring(name_table, sh_name), sh_type, sh_flags, sh_offset, sh_size, sh_link, sh_info, sh_entsize, payload)
            )
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    def _read_symbols(self) -> list[Symbol]:
        symbols: list[Symbol] = []
        for section in self.sections:
            if section.type != SHT_SYMTAB:
                continue
            strings = self.sections[section.link].data
            for offset in range(0, section.size, 24):
                st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", section.data, offset)
                section_name = self.sections[st_shndx].name if st_shndx < len(self.sections) else ""
                symbols.append(Symbol(_cstring(strings, st_name), st_value, st_size, st_info & 0xF, st_info >> 4, st_shndx, section_name))
        return symbols

    def _read_relocations(self) -> dict[str, list[Relocation]]:
        table: dict[str, list[Relocation]] = {}
        for section in self.sections:
            if section.type != SHT_RELA:
                continue
            target = self.sections[section.info].name
            for offset in range(0, section.size, 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, offset)
                symbol = self.symbols[r_info >> 32]
                table.setdefault(target, []).append(Relocation(target, r_offset, r_info & 0xFFFFFFFF, symbol, r_addend))
        return table

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise ElfError(f"no section named {name}")

    def functions(self, section: str = ".text") -> list[Symbol]:
        found = [s for s in self.symbols if s.type == STT_FUNC and s.section == section]
        return sorted(found, key=lambda s: s.value)

    def relocation_at(self, section: str, offset: int) -> Relocation | None:
        for relocation in self.relocations.get(section, []):
            if relocation.offset == offset:
                return relocation
        return None

    def symbolize(self, address: int, section: str = ".text") -> str:
        """Nearest preceding function symbol, written the way llvm-objdump writes it."""
        best: Symbol | None = None
        for symbol in self.functions(section):
            if symbol.value <= address and (best is None or symbol.value >= best.value):
                best = symbol
        if best is None:
            return f"{section}+0x{address:x}"
        delta = address - best.value
        return best.name if delta == 0 else f"{best.name}+0x{delta:x}"

    def function_extent(self, name: str, section: str = ".text") -> tuple[int, int, int]:
        """(start, end from st_size, end of the gap before the next function or the section end)."""
        functions = self.functions(section)
        for position, symbol in enumerate(functions):
            if symbol.name == name:
                following = functions[position + 1].value if position + 1 < len(functions) else self.section(section).size
                return symbol.value, symbol.value + symbol.size, following
        raise ElfError(f"no function symbol named {name}")


def _cstring(table: bytes, offset: int) -> str:
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("ascii", "replace")


def load_fixture(name: str) -> ElfObject:
    return ElfObject((FIXTURES / name).read_bytes())


LEGACY_PREFIXES = {0xF0, 0xF2, 0xF3, 0x2E, 0x36, 0x3E, 0x26, 0x64, 0x65, 0x66, 0x67}
SEGMENT_PREFIXES = {0x2E: "cs", 0x36: "ss", 0x3E: "ds", 0x26: "es", 0x64: "fs", 0x65: "gs"}
REGISTERS = {
    64: ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"],
    32: ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"],
    16: ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", "r8w", "r9w", "r10w", "r11w", "r12w", "r13w", "r14w", "r15w"],
    8: ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil", "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b"],
}
LEGACY_BYTE_REGISTERS = ["al", "cl", "dl", "bl", "ah", "ch", "dh", "bh"]
SUFFIX = {8: "b", 16: "w", 32: "l", 64: "q"}
CONDITIONS = ["o", "no", "b", "ae", "e", "ne", "be", "a", "s", "ns", "p", "np", "l", "ge", "le", "g"]
GROUP1 = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"]
GROUP2 = ["rol", "ror", "rcl", "rcr", "shl", "shr", "shl", "sar"]
GROUP3 = ["test", "test", "not", "neg", "mul", "imul", "div", "idiv"]
ALU_RM_R = {0x01: "add", 0x09: "or", 0x11: "adc", 0x19: "sbb", 0x21: "and", 0x29: "sub", 0x31: "xor", 0x39: "cmp", 0x85: "test", 0x89: "mov"}
ALU_R_RM = {0x03: "add", 0x0B: "or", 0x13: "adc", 0x1B: "sbb", 0x23: "and", 0x2B: "sub", 0x33: "xor", 0x3B: "cmp", 0x8B: "mov"}
ALU_ACC_IMM = {0x05: "add", 0x0D: "or", 0x15: "adc", 0x1D: "sbb", 0x25: "and", 0x2D: "sub", 0x35: "xor", 0x3D: "cmp"}
SSE_XMM_XMMM = {
    (0x66, 0xEF): "pxor",
    (0x66, 0xFE): "paddd",
    (0x66, 0xFA): "psubd",
    (0x66, 0xDB): "pand",
    (0x66, 0xEB): "por",
    (0x66, 0x6F): "movdqa",
    (0xF3, 0x6F): "movdqu",
}


class DecodeError(ValueError):
    def __init__(self, address: int, reason: str) -> None:
        super().__init__(f"0x{address:x}: {reason}")
        self.address = address
        self.reason = reason


@dataclass(frozen=True)
class Memory:
    base: str | None
    index: str | None
    scale: int
    displacement: int
    rip_relative: bool
    segment: str | None

    def render(self) -> str:
        if self.rip_relative:
            inner = "(%rip)"
        elif self.base is None and self.index is None:
            inner = ""
        else:
            parts = ["%" + self.base if self.base else ""]
            if self.index:
                parts.append("%" + self.index)
                if self.scale != 1:
                    parts.append(str(self.scale))
            inner = "(" + ",".join(parts) + ")"
        show_displacement = self.displacement != 0 or (self.base is None and not self.rip_relative)
        text = (format_signed(self.displacement) if show_displacement else "") + inner
        return f"%{self.segment}:{text}" if self.segment else text


@dataclass(frozen=True)
class Instruction:
    address: int
    raw: bytes
    mnemonic: str
    operands: tuple[str, ...]
    flow: str
    target: int | None = None
    memory: Memory | None = None
    displacement_offset: int | None = None
    immediate_offset: int | None = None
    prefixes: tuple[int, ...] = ()
    rex: int | None = None
    opcode: tuple[int, ...] = ()
    modrm: int | None = None

    @property
    def length(self) -> int:
        return len(self.raw)

    @property
    def end(self) -> int:
        return self.address + self.length

    @property
    def text(self) -> str:
        return self.mnemonic + ("\t" + ", ".join(self.operands) if self.operands else "")

    @property
    def hex(self) -> str:
        return " ".join(f"{byte:02x}" for byte in self.raw)

    def covers(self, address: int) -> bool:
        return self.address <= address < self.end


def format_signed(value: int) -> str:
    return f"-0x{-value:x}" if value < 0 else f"0x{value:x}"


def format_immediate(value: int) -> str:
    return "$" + format_signed(value)


class _Cursor:
    def __init__(self, code: bytes, start: int) -> None:
        self.code = code
        self.start = start
        self.position = start

    def byte(self) -> int:
        if self.position >= len(self.code):
            raise DecodeError(self.start, "instruction runs past the end of the section")
        if self.position - self.start >= MAX_INSTRUCTION_LENGTH:
            raise DecodeError(self.start, "instruction longer than 15 bytes")
        value = self.code[self.position]
        self.position += 1
        return value

    def peek(self) -> int | None:
        return self.code[self.position] if self.position < len(self.code) else None

    def integer(self, size: int, signed: bool) -> int:
        chunk = bytes(self.byte() for _ in range(size))
        return int.from_bytes(chunk, "little", signed=signed)


class Decoder:
    """Decodes one instruction at a time. Every decision cites the SDM Volume 2 Chapter 2 rule it follows."""

    def decode(self, code: bytes, address: int) -> Instruction:
        if address >= len(code):
            raise DecodeError(address, "address is past the end of the section")
        cursor = _Cursor(code, address)
        prefixes: list[int] = []
        while cursor.peek() in LEGACY_PREFIXES:
            prefixes.append(cursor.byte())
        rex = None
        if cursor.peek() is not None and 0x40 <= cursor.peek() <= 0x4F:
            rex = cursor.byte()
        state = _State(cursor, tuple(prefixes), rex)
        opcode = cursor.byte()
        if opcode == 0x0F:
            return self._two_byte(state, cursor.byte())
        return self._one_byte(state, opcode)

    def _one_byte(self, state: "_State", opcode: int) -> Instruction:
        size = state.operand_size()
        if opcode in ALU_RM_R:
            reg, rm = state.modrm(size, size)
            return state.finish(ALU_RM_R[opcode] + SUFFIX[size], (reg, rm))
        if opcode in ALU_R_RM:
            reg, rm = state.modrm(size, size)
            return state.finish(ALU_R_RM[opcode] + SUFFIX[size], (rm, reg))
        if opcode in ALU_ACC_IMM:
            immediate = state.read_immediate(_full_immediate_size(size))
            return state.finish(ALU_ACC_IMM[opcode] + SUFFIX[size], (format_immediate(immediate), "%" + REGISTERS[size][0]))
        if 0x50 <= opcode <= 0x57:
            return state.finish("pushq", ("%" + REGISTERS[64][(opcode & 7) | state.rex_b()],))
        if 0x58 <= opcode <= 0x5F:
            return state.finish("popq", ("%" + REGISTERS[64][(opcode & 7) | state.rex_b()],))
        if opcode == 0x63:
            if size != 64:
                raise DecodeError(state.cursor.start, "opcode 63 without REX.W is not in the subset")
            reg, rm = state.modrm(64, 32)
            return state.finish("movslq", (rm, reg))
        if opcode in (0x69, 0x6B):
            reg, rm = state.modrm(size, size)
            immediate = state.read_immediate(1 if opcode == 0x6B else _full_immediate_size(size))
            return state.finish("imul" + SUFFIX[size], (format_immediate(immediate), rm, reg))
        if 0x70 <= opcode <= 0x7F:
            return state.branch("j" + CONDITIONS[opcode & 0xF], 1, "branch")
        if opcode in (0x81, 0x83):
            digit, rm = state.modrm_group(size)
            immediate = state.read_immediate(1 if opcode == 0x83 else _full_immediate_size(size))
            return state.finish(GROUP1[digit] + SUFFIX[size], (format_immediate(immediate), rm))
        if opcode == 0x8D:
            reg, rm = state.modrm(size, size)
            if state.memory is None:
                raise DecodeError(state.cursor.start, "lea needs a memory operand")
            return state.finish("lea" + SUFFIX[size], (rm, reg))
        if opcode == 0x90:
            return state.finish("nop", ())
        if opcode == 0x99:
            return state.finish({16: "cwtd", 32: "cltd", 64: "cqto"}[size], ())
        if 0xB8 <= opcode <= 0xBF:
            register = "%" + REGISTERS[size][(opcode & 7) | state.rex_b()]
            if size == 64:
                return state.finish("movabsq", (format_immediate(state.read_immediate(8)), register))
            return state.finish("mov" + SUFFIX[size], (format_immediate(state.read_immediate(_full_immediate_size(size))), register))
        if opcode == 0xC1:
            digit, rm = state.modrm_group(size)
            return state.finish(GROUP2[digit] + SUFFIX[size], (format_immediate(state.read_immediate(1, signed=False)), rm))
        if opcode == 0xC3:
            return state.finish("retq", (), flow="return")
        if opcode == 0xC7:
            digit, rm = state.modrm_group(size)
            if digit != 0:
                raise DecodeError(state.cursor.start, f"opcode C7 /{digit} is not mov")
            return state.finish("mov" + SUFFIX[size], (format_immediate(state.read_immediate(_full_immediate_size(size))), rm))
        if opcode == 0xCC:
            return state.finish("int3", ())
        if opcode == 0xE8:
            return state.branch("callq", 4, "call")
        if opcode == 0xE9:
            return state.branch("jmp", 4, "jump")
        if opcode == 0xEB:
            return state.branch("jmp", 1, "jump")
        if opcode == 0xF4:
            return state.finish("hlt", ())
        if opcode == 0xF7:
            digit, rm = state.modrm_group(size)
            if digit in (0, 1):
                return state.finish("test" + SUFFIX[size], (format_immediate(state.read_immediate(_full_immediate_size(size))), rm))
            return state.finish(GROUP3[digit] + SUFFIX[size], (rm,))
        if opcode == 0xFF:
            digit, rm = state.modrm_group(size)
            if digit == 0:
                return state.finish("inc" + SUFFIX[size], (rm,))
            if digit == 1:
                return state.finish("dec" + SUFFIX[size], (rm,))
            if digit in (2, 4, 6):
                _digit, rm64 = state.modrm_group(64, reuse=True)
                if digit == 6:
                    return state.finish("pushq", (rm64,))
                if digit == 2:
                    return state.finish("callq", ("*" + rm64,), flow="indirect-call")
                return state.finish("jmpq", ("*" + rm64,), flow="indirect-jump")
            raise DecodeError(state.cursor.start, f"opcode FF /{digit} is not in the subset")
        raise DecodeError(state.cursor.start, f"opcode {opcode:02x} is not in the subset")

    def _two_byte(self, state: "_State", opcode: int) -> Instruction:
        mandatory = state.mandatory_prefix()
        if (mandatory, opcode) in SSE_XMM_XMMM:
            state.consume_mandatory()
            reg, rm = state.modrm("xmm", "xmm")
            return state.finish(SSE_XMM_XMMM[(mandatory, opcode)], (rm, reg))
        if mandatory == 0x66 and opcode == 0x70:
            state.consume_mandatory()
            reg, rm = state.modrm("xmm", "xmm")
            return state.finish("pshufd", (format_immediate(state.read_immediate(1, signed=False)), rm, reg))
        if mandatory == 0x66 and opcode in (0x6E, 0x7E):
            state.consume_mandatory()
            reg, rm = state.modrm("xmm", 64 if state.rex_w() else 32)
            operands = (reg, rm) if opcode == 0x7E else (rm, reg)
            return state.finish("movq" if state.rex_w() else "movd", operands)
        size = state.operand_size()
        if opcode == 0x0B:
            return state.finish("ud2", ())
        if opcode == 0x1F:
            _digit, rm = state.modrm_group(size)
            return state.finish("nop" + SUFFIX[size], (rm,))
        if 0x80 <= opcode <= 0x8F:
            return state.branch("j" + CONDITIONS[opcode & 0xF], 4, "branch")
        if 0x90 <= opcode <= 0x9F:
            _digit, rm = state.modrm_group(8)
            return state.finish("set" + CONDITIONS[opcode & 0xF], (rm,))
        if 0x40 <= opcode <= 0x4F:
            reg, rm = state.modrm(size, size)
            return state.finish("cmov" + CONDITIONS[opcode & 0xF] + SUFFIX[size], (rm, reg))
        if opcode == 0xAF:
            reg, rm = state.modrm(size, size)
            return state.finish("imul" + SUFFIX[size], (rm, reg))
        if opcode in (0xB6, 0xB7, 0xBE, 0xBF):
            source = 8 if opcode in (0xB6, 0xBE) else 16
            reg, rm = state.modrm(size, source)
            kind = "movz" if opcode in (0xB6, 0xB7) else "movs"
            return state.finish(kind + SUFFIX[source] + SUFFIX[size], (rm, reg))
        raise DecodeError(state.cursor.start, f"opcode 0f {opcode:02x} is not in the subset")


def _full_immediate_size(operand_size: int) -> int:
    return 2 if operand_size == 16 else 4


class _State:
    """Per-instruction decode state: prefixes, REX fields, ModRM and SIB results."""

    def __init__(self, cursor: _Cursor, prefixes: tuple[int, ...], rex: int | None) -> None:
        self.cursor = cursor
        self.prefixes = prefixes
        self.rex = rex
        self.memory: Memory | None = None
        self.modrm_byte: int | None = None
        self.displacement_offset: int | None = None
        self.immediate_offset: int | None = None
        self.opcode_start = cursor.position
        self._mandatory_consumed = False

    def rex_w(self) -> bool:
        return bool(self.rex and self.rex & 0x8)

    def rex_r(self) -> int:
        return 8 if self.rex and self.rex & 0x4 else 0

    def rex_x(self) -> int:
        return 8 if self.rex and self.rex & 0x2 else 0

    def rex_b(self) -> int:
        return 8 if self.rex and self.rex & 0x1 else 0

    def operand_size(self) -> int:
        if self.rex_w():
            return 64
        if 0x66 in self.prefixes and not self._mandatory_consumed:
            return 16
        return 32

    def mandatory_prefix(self) -> int | None:
        for candidate in (0xF2, 0xF3):
            if candidate in self.prefixes:
                return candidate
        return 0x66 if 0x66 in self.prefixes else None

    def consume_mandatory(self) -> None:
        self._mandatory_consumed = True

    def segment(self) -> str | None:
        for prefix in self.prefixes:
            if prefix in SEGMENT_PREFIXES:
                return SEGMENT_PREFIXES[prefix]
        return None

    def read_immediate(self, size: int, signed: bool = True) -> int:
        self.immediate_offset = self.cursor.position - self.cursor.start
        return self.cursor.integer(size, signed)

    def read_displacement(self, size: int) -> int:
        self.displacement_offset = self.cursor.position - self.cursor.start
        return self.cursor.integer(size, True)

    def register_name(self, size: int | str, number: int) -> str:
        if size == "xmm":
            return f"%xmm{number}"
        if size == 8 and self.rex is None and number < 8:
            return "%" + LEGACY_BYTE_REGISTERS[number]
        return "%" + REGISTERS[size][number]

    def modrm(self, reg_size: int | str, rm_size: int | str) -> tuple[str, str]:
        """SDM 2.1.3 and 2.1.5: the ModRM byte selects a register or a memory form, SIB and displacement follow."""
        modrm = self.cursor.byte()
        self.modrm_byte = modrm
        mod, reg, rm = modrm >> 6, (modrm >> 3) & 7, modrm & 7
        reg_text = self.register_name(reg_size, reg | self.rex_r())
        if mod == 3:
            return reg_text, self.register_name(rm_size, rm | self.rex_b())
        base: str | None = None
        index: str | None = None
        scale = 1
        rip_relative = False
        displacement = 0
        if rm == 4:
            sib = self.cursor.byte()
            scale = 1 << (sib >> 6)
            index_number = ((sib >> 3) & 7) | self.rex_x()
            base_number = (sib & 7) | self.rex_b()
            if index_number != 4:
                index = REGISTERS[64][index_number]
            if (sib & 7) == 5 and mod == 0:
                displacement = self.read_displacement(4)
            else:
                base = REGISTERS[64][base_number]
        elif rm == 5 and mod == 0:
            rip_relative = True
            displacement = self.read_displacement(4)
        else:
            base = REGISTERS[64][rm | self.rex_b()]
        if mod == 1:
            displacement = self.read_displacement(1)
        elif mod == 2:
            displacement = self.read_displacement(4)
        self.memory = Memory(base, index, scale, displacement, rip_relative, self.segment())
        return reg_text, self.memory.render()

    def modrm_group(self, rm_size: int | str, reuse: bool = False) -> tuple[int, str]:
        """Opcode extensions: the reg field is a /digit (SDM 2.1.2), the r/m field is the operand."""
        if not reuse or self.modrm_byte is None:
            self.modrm(rm_size, rm_size)
        assert self.modrm_byte is not None
        digit = (self.modrm_byte >> 3) & 7
        if self.modrm_byte >> 6 == 3:
            return digit, self.register_name(rm_size, (self.modrm_byte & 7) | self.rex_b())
        assert self.memory is not None
        return digit, self.memory.render()

    def branch(self, mnemonic: str, size: int, flow: str) -> Instruction:
        """Relative branches: the displacement is relative to the address of the next instruction (SDM 2.2.1.6 logic)."""
        offset = self.read_immediate(size)
        target = (self.cursor.position + offset) & 0xFFFFFFFFFFFFFFFF
        return self.finish(mnemonic, (f"0x{target:x}",), flow=flow, target=target)

    def finish(self, mnemonic: str, operands: tuple[str, ...], flow: str = "next", target: int | None = None) -> Instruction:
        raw = self.cursor.code[self.cursor.start : self.cursor.position]
        first = self.opcode_start - self.cursor.start
        opcode = tuple(raw[first : first + (2 if raw[first] == 0x0F else 1)])
        return Instruction(
            address=self.cursor.start,
            raw=bytes(raw),
            mnemonic=mnemonic,
            operands=operands,
            flow=flow,
            target=target,
            memory=self.memory,
            displacement_offset=self.displacement_offset,
            immediate_offset=self.immediate_offset,
            prefixes=self.prefixes,
            rex=self.rex,
            opcode=opcode,
            modrm=self.modrm_byte,
        )


DECODER = Decoder()


def decode(code: bytes, address: int) -> Instruction:
    return DECODER.decode(code, address)


def listing_line(instruction: Instruction, elf: ElfObject | None = None) -> str:
    """The llvm-objdump line shape: address, bytes, mnemonic, operands, and <symbol+offset> for direct targets."""
    text = instruction.text
    if instruction.target is not None and elf is not None:
        text += f" <{elf.symbolize(instruction.target)}>"
    return f"{instruction.address:8x}: {instruction.hex:<30}\t{text}"


@dataclass(frozen=True)
class Reference:
    """Where an instruction field points after the link editor applies its relocation."""

    instruction: int
    relocation: Relocation
    section: str
    offset: int
    field: str

    def describe(self) -> str:
        return f"{self.section}+0x{self.offset:x}"


def _symbol_base(symbol: Symbol) -> int:
    return 0 if symbol.type == STT_SECTION else symbol.value


def resolve_reference(elf: ElfObject, instruction: Instruction, section: str = ".text") -> Reference | None:
    """R_X86_64_PC32 and PLT32 store S + A - P. The processor adds the field to the next instruction address,
    so the final target is S + A + (end - P), with P the offset of the 4-byte field (psABI Table 4.9)."""
    for field_name, field_offset in (("displacement", instruction.displacement_offset), ("immediate", instruction.immediate_offset)):
        if field_offset is None:
            continue
        relocation = elf.relocation_at(section, instruction.address + field_offset)
        if relocation is None:
            continue
        base = _symbol_base(relocation.symbol)
        if relocation.type in PC_RELATIVE_RELOCATIONS:
            offset = base + relocation.addend + (instruction.end - (instruction.address + field_offset))
        else:
            offset = base + relocation.addend
        return Reference(instruction.address, relocation, relocation.symbol.section, offset, field_name)
    return None


@dataclass
class SweepResult:
    instructions: list[Instruction]
    undecodable: list[tuple[int, int]]

    def at(self, address: int) -> Instruction | None:
        for instruction in self.instructions:
            if instruction.address == address:
                return instruction
        return None

    def covering(self, address: int) -> Instruction | None:
        for instruction in self.instructions:
            if instruction.covers(address):
                return instruction
        return None


def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    """Decode every byte in address order (Schwarz, Debray, Andrews 2002, section 3.1). Data is decoded as code."""
    end = len(code) if end is None else end
    instructions: list[Instruction] = []
    undecodable: list[tuple[int, int]] = []
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
    return SweepResult(instructions, undecodable)


@dataclass
class DescentResult:
    instructions: dict[int, Instruction]
    order: list[int]
    unresolved: list[Instruction]
    conflicts: list[tuple[int, int]]
    calls: list[tuple[int, int | None]]
    resolved_tables: dict[int, "JumpTable"]

    def sorted_instructions(self) -> list[Instruction]:
        return [self.instructions[address] for address in sorted(self.instructions)]

    def claimed_bytes(self) -> set[int]:
        claimed: set[int] = set()
        for instruction in self.instructions.values():
            claimed.update(range(instruction.address, instruction.end))
        return claimed


Resolver = Callable[[Instruction, dict[int, Instruction]], "JumpTable | None"]


def recursive_descent(code: bytes, entries: list[int], end: int | None = None, resolver: Resolver | None = None) -> DescentResult:
    """Follow control flow from the entries (Schwarz, Debray, Andrews 2002, section 3.2).
    A direct branch adds its target. A call adds the return address. A return stops the path.
    An indirect jump stops the path unless the resolver gives its targets."""
    end = len(code) if end is None else end
    instructions: dict[int, Instruction] = {}
    order: list[int] = []
    unresolved: list[Instruction] = []
    conflicts: list[tuple[int, int]] = []
    calls: list[tuple[int, int | None]] = []
    tables: dict[int, JumpTable] = {}
    worklist = list(reversed(entries))
    while worklist:
        address = worklist.pop()
        while address < end and address not in instructions:
            inside = next((i for i in instructions.values() if i.covers(address)), None)
            if inside is not None:
                conflicts.append((address, inside.address))
                break
            try:
                instruction = decode(code[:end], address)
            except DecodeError:
                unresolved.append(Instruction(address, code[address : address + 1], "(undecodable)", (), "stop"))
                break
            instructions[address] = instruction
            order.append(address)
            if instruction.flow == "return":
                break
            if instruction.flow == "jump":
                address = instruction.target if instruction.target is not None else end
                continue
            if instruction.flow == "branch":
                worklist.append(instruction.target if instruction.target is not None else end)
                address = instruction.end
                continue
            if instruction.flow == "call":
                calls.append((instruction.address, instruction.target))
                address = instruction.end
                continue
            if instruction.flow == "indirect-jump":
                table = resolver(instruction, instructions) if resolver else None
                if table is None:
                    unresolved.append(instruction)
                    break
                tables[instruction.address] = table
                worklist.extend(sorted(set(table.targets), reverse=True))
                break
            if instruction.flow == "indirect-call":
                calls.append((instruction.address, None))
            address = instruction.end
    return DescentResult(instructions, order, unresolved, conflicts, calls, tables)


@dataclass(frozen=True)
class JumpTable:
    section: str
    offset: int
    entry_size: int
    count: int
    targets: tuple[int, ...]
    evidence: str
    bounds_instruction: int | None
    lea_instruction: int
    load_instruction: int
    jump_instruction: int | None

    @property
    def is_jump_table(self) -> bool:
        return self.jump_instruction is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "jump-table" if self.is_jump_table else "value-table",
            "table": f"{self.section}+0x{self.offset:x}",
            "entrySize": self.entry_size,
            "count": self.count,
            "entries": [f"0x{value:x}" for value in self.targets] if self.is_jump_table else list(self.targets),
            "evidence": self.evidence,
            "boundsCheck": None if self.bounds_instruction is None else f"0x{self.bounds_instruction:x}",
            "lea": f"0x{self.lea_instruction:x}",
            "load": f"0x{self.load_instruction:x}",
            "jump": None if self.jump_instruction is None else f"0x{self.jump_instruction:x}",
        }


def _register_of(operand: str) -> str | None:
    return operand[1:] if operand.startswith("%") else None


def _bounds_count(instructions: list[Instruction], before: int) -> tuple[int | None, int | None]:
    """The clang idiom: `cmp $N, reg` or `sub $N, reg` then `ja default`. N + 1 table entries are valid."""
    earlier = [i for i in instructions if i.address < before]
    for position in range(len(earlier) - 1, 0, -1):
        if earlier[position].mnemonic == "ja" and earlier[position - 1].mnemonic in ("cmpl", "subl", "cmpq", "subq"):
            immediate = earlier[position - 1].operands[0]
            if immediate.startswith("$"):
                return int(immediate[1:], 16), earlier[position - 1].address
    return None, None


def recover_table(elf: ElfObject, instructions: list[Instruction], load: Instruction, jump: Instruction | None, section: str = ".text") -> JumpTable | None:
    """Given the indexed load, find the lea that produced its base, read the relocation on the lea,
    and read the table entries, from relocations when the object is not linked yet."""
    if load.memory is None or load.memory.base is None or load.memory.index is None:
        return None
    base = load.memory.base
    lea = None
    for candidate in reversed([i for i in instructions if i.address < load.address]):
        if candidate.mnemonic == "leaq" and candidate.memory and candidate.memory.rip_relative and _register_of(candidate.operands[1]) == base:
            lea = candidate
            break
        if candidate.operands and _register_of(candidate.operands[-1]) == base:
            return None
    if lea is None:
        return None
    reference = resolve_reference(elf, lea, section)
    if reference is None:
        return None
    limit, bounds_address = _bounds_count(instructions, load.address)
    count = limit + 1 if limit is not None else 0
    entry_size = load.memory.scale
    table_section = elf.section(reference.section)
    entries: list[int] = []
    evidence = "bytes"
    for index in range(count):
        entry_offset = reference.offset + index * entry_size
        relocation = elf.relocation_at(reference.section, entry_offset)
        if relocation is not None and relocation.type in PC_RELATIVE_RELOCATIONS:
            entries.append(_symbol_base(relocation.symbol) + relocation.addend + (reference.offset - entry_offset))
            evidence = "relocation"
        else:
            raw = table_section.data[entry_offset : entry_offset + entry_size]
            if len(raw) < entry_size:
                return None
            value = int.from_bytes(raw, "little", signed=jump is not None)
            entries.append(reference.offset + value if jump is not None else value)
    return JumpTable(reference.section, reference.offset, entry_size, count, tuple(entries), evidence, bounds_address, lea.address, load.address, None if jump is None else jump.address)


def jump_table_resolver(elf: ElfObject, section: str = ".text") -> Resolver:
    """Recognise the clang position-independent jump table:
    lea table(%rip), base; movslq (base, index, 4), reg; add base, reg; jmp *reg."""

    def resolve(jump: Instruction, decoded: dict[int, Instruction]) -> JumpTable | None:
        register = _register_of(jump.operands[0][1:]) if jump.operands and jump.operands[0].startswith("*") else None
        if register is None:
            return None
        instructions = [decoded[a] for a in sorted(decoded) if a < jump.address]
        add = next((i for i in reversed(instructions) if i.mnemonic == "addq" and _register_of(i.operands[1]) == register), None)
        if add is None:
            return None
        base = _register_of(add.operands[0])
        load = next((i for i in reversed(instructions) if i.address < add.address and i.mnemonic == "movslq" and _register_of(i.operands[1]) == register and i.memory and i.memory.base == base), None)
        if load is None:
            return None
        return recover_table(elf, instructions, load, jump, section)

    return resolve


def find_value_tables(elf: ElfObject, instructions: list[Instruction], section: str = ".text") -> list[JumpTable]:
    """Loads of the form `mov (base, index, scale), reg` whose base came from a RIP-relative lea with a relocation."""
    tables: list[JumpTable] = []
    for instruction in instructions:
        if instruction.mnemonic not in ("movl", "movq", "movslq", "movzbl") or instruction.memory is None:
            continue
        if instruction.memory.base is None or instruction.memory.index is None:
            continue
        following = [i for i in instructions if i.address > instruction.address][:3]
        if any(i.flow == "indirect-jump" for i in following):
            continue
        table = recover_table(elf, instructions, instruction, None, section)
        if table is not None:
            tables.append(table)
    return tables


@dataclass
class Block:
    start: int
    instructions: list[Instruction]
    successors: list[tuple[int, str]] = field(default_factory=list)

    @property
    def end(self) -> int:
        return self.instructions[-1].end

    @property
    def last(self) -> Instruction:
        return self.instructions[-1]

    @property
    def size(self) -> int:
        return self.end - self.start


class ControlFlowGraph:
    """Allen 1970: nodes are basic blocks, entered only at the first instruction and left only at the last."""

    def __init__(self, entry: int, instructions: list[Instruction], tables: dict[int, JumpTable] | None = None, limit: int | None = None) -> None:
        self.entry = entry
        self.tables = tables or {}
        ordered = sorted(instructions, key=lambda i: i.address)
        if limit is not None:
            ordered = [i for i in ordered if i.address < limit]
        self.instructions = ordered
        self.blocks: dict[int, Block] = {}
        self.unresolved: list[int] = []
        self._build()
        self.edges: list[tuple[int, int, str]] = [(b.start, target, kind) for b in self.blocks.values() for target, kind in b.successors]
        self._idom: dict[int, int] | None = None

    def _leaders(self) -> set[int]:
        leaders = {self.entry}
        addresses = {i.address for i in self.instructions}
        for position, instruction in enumerate(self.instructions):
            if instruction.flow in ("jump", "branch", "return", "indirect-jump"):
                if position + 1 < len(self.instructions):
                    leaders.add(self.instructions[position + 1].address)
            if instruction.flow in ("jump", "branch") and instruction.target in addresses:
                leaders.add(instruction.target)
            if instruction.address in self.tables:
                leaders.update(t for t in self.tables[instruction.address].targets if t in addresses)
        return leaders

    def _build(self) -> None:
        leaders = self._leaders()
        current: Block | None = None
        for instruction in self.instructions:
            if instruction.address in leaders or current is None or current.end != instruction.address:
                current = Block(instruction.address, [])
                self.blocks[instruction.address] = current
            current.instructions.append(instruction)
        starts = sorted(self.blocks)
        for position, start in enumerate(starts):
            block = self.blocks[start]
            last = block.last
            following = starts[position + 1] if position + 1 < len(starts) else None
            falls_through = following is not None and following == block.end
            if last.flow == "return":
                continue
            if last.flow == "jump":
                if last.target in self.blocks:
                    block.successors.append((last.target, "jump"))
                continue
            if last.flow == "branch":
                if last.target in self.blocks:
                    block.successors.append((last.target, "taken"))
                if falls_through:
                    block.successors.append((following, "fallthrough"))
                continue
            if last.flow == "indirect-jump":
                table = self.tables.get(last.address)
                if table is None:
                    self.unresolved.append(last.address)
                    continue
                for target in sorted(set(table.targets)):
                    if target in self.blocks:
                        block.successors.append((target, "table"))
                continue
            if falls_through:
                block.successors.append((following, "fallthrough"))

    def predecessors(self, start: int) -> list[int]:
        return [source for source, target, _kind in self.edges if target == start]

    def reverse_postorder(self) -> list[int]:
        seen: set[int] = set()
        postorder: list[int] = []

        def visit(start: int) -> None:
            seen.add(start)
            for target, _kind in self.blocks[start].successors:
                if target not in seen:
                    visit(target)
            postorder.append(start)

        if self.entry in self.blocks:
            visit(self.entry)
        return list(reversed(postorder))

    def reachable(self) -> set[int]:
        return set(self.reverse_postorder())

    def unreachable(self) -> list[int]:
        reachable = self.reachable()
        return [start for start in sorted(self.blocks) if start not in reachable]

    def dominators(self) -> dict[int, int]:
        """Cooper, Harvey, Kennedy: iterate idom over reverse postorder until nothing changes.
        intersect() walks two fingers up the current tree until they meet."""
        if self._idom is not None:
            return self._idom
        order = self.reverse_postorder()
        number = {start: position for position, start in enumerate(order)}
        idom: dict[int, int] = {self.entry: self.entry}

        def intersect(first: int, second: int) -> int:
            while first != second:
                while number[first] > number[second]:
                    first = idom[first]
                while number[second] > number[first]:
                    second = idom[second]
            return first

        changed = True
        while changed:
            changed = False
            for start in order[1:]:
                processed = [p for p in self.predecessors(start) if p in idom]
                candidate = processed[0]
                for other in processed[1:]:
                    candidate = intersect(other, candidate)
                if idom.get(start) != candidate:
                    idom[start] = candidate
                    changed = True
        self._idom = idom
        return idom

    def dominates(self, dominator: int, start: int) -> bool:
        idom = self.dominators()
        while True:
            if start == dominator:
                return True
            if idom.get(start, start) == start:
                return False
            start = idom[start]

    def back_edges(self) -> list[tuple[int, int]]:
        """An edge whose target dominates its source closes a loop (Allen 1970)."""
        reachable = self.reachable()
        return [(source, target) for source, target, _kind in self.edges if source in reachable and target in reachable and self.dominates(target, source)]

    def dominator_tree(self) -> dict[int, list[int]]:
        tree: dict[int, list[int]] = {start: [] for start in self.dominators()}
        for start, parent in self.dominators().items():
            if start != parent:
                tree[parent].append(start)
        return tree

    def summary(self) -> dict[str, Any]:
        idom = self.dominators()
        return {
            "blocks": len(self.blocks),
            "edges": len(self.edges),
            "unreachableBlocks": [f"0x{s:x}" for s in self.unreachable()],
            "unresolvedIndirectJumps": [f"0x{a:x}" for a in self.unresolved],
            "backEdges": [f"0x{s:x}->0x{t:x}" for s, t in self.back_edges()],
            "immediateDominators": {f"0x{s:x}": f"0x{d:x}" for s, d in sorted(idom.items())},
        }


@dataclass
class FunctionAnalysis:
    name: str
    start: int
    end: int
    gap_end: int
    sweep: SweepResult
    descent: DescentResult
    descent_plain: DescentResult
    cfg: ControlFlowGraph
    cfg_plain: ControlFlowGraph
    cfg_sweep: ControlFlowGraph
    value_tables: list[JumpTable]

    def to_dict(self) -> dict[str, Any]:
        tables = [t.to_dict() for t in self.descent.resolved_tables.values()] + [t.to_dict() for t in self.value_tables]
        return {
            "range": f"0x{self.start:x}-0x{self.end:x}",
            "paddingBytes": self.gap_end - self.end,
            "linearSweep": {"instructions": len(self.sweep.instructions), **self.cfg_sweep.summary()},
            "recursiveDescent": {"instructions": len(self.descent_plain.instructions), **self.cfg_plain.summary()},
            "recursiveDescentWithTables": {"instructions": len(self.descent.instructions), **self.cfg.summary()},
            "tables": tables,
        }


def analyze_function(elf: ElfObject, name: str, section: str = ".text") -> FunctionAnalysis:
    code = elf.section(section).data
    start, end, gap_end = elf.function_extent(name, section)
    sweep = linear_sweep(code, start, gap_end)
    plain = recursive_descent(code, [start], gap_end)
    resolved = recursive_descent(code, [start], gap_end, jump_table_resolver(elf, section))
    cfg = ControlFlowGraph(start, resolved.sorted_instructions(), resolved.resolved_tables)
    cfg_plain = ControlFlowGraph(start, plain.sorted_instructions())
    cfg_sweep = ControlFlowGraph(start, sweep.instructions)
    value_tables = find_value_tables(elf, resolved.sorted_instructions(), section)
    return FunctionAnalysis(name, start, end, gap_end, sweep, resolved, plain, cfg, cfg_plain, cfg_sweep, value_tables)


def parse_objdump(text: str) -> list[tuple[int, str, str]]:
    """(address, bytes, text) for every instruction line of `llvm-objdump -d`. Comments after # are dropped."""
    rows: list[tuple[int, str, str]] = []
    for line in text.splitlines():
        if ":" not in line or "\t" not in line:
            continue
        head, _tab, rest = line.partition("\t")
        address_text, _colon, byte_text = head.strip().partition(":")
        if not address_text or not all(c in "0123456789abcdef" for c in address_text):
            continue
        body = rest.split("#", 1)[0]
        rows.append((int(address_text, 16), " ".join(byte_text.split()), " ".join(body.split())))
    return rows


def compare_with_oracle(elf: ElfObject, oracle_text: str, section: str = ".text") -> dict[str, Any]:
    code = elf.section(section).data
    ours = linear_sweep(code)
    expected = parse_objdump(oracle_text)
    mismatches: list[dict[str, str]] = []
    by_address = {i.address: i for i in ours.instructions}
    for address, byte_text, text in expected:
        instruction = by_address.get(address)
        if instruction is None:
            mismatches.append({"address": f"0x{address:x}", "expected": text, "got": "(no instruction starts here)"})
            continue
        got = " ".join(listing_line(instruction, elf).partition("\t")[2].split())
        if instruction.hex != byte_text or got != text:
            mismatches.append({"address": f"0x{address:x}", "expected": f"{byte_text} {text}", "got": f"{instruction.hex} {got}"})
    return {"compared": len(expected), "ours": len(ours.instructions), "mismatches": mismatches, "agree": not mismatches and len(expected) == len(ours.instructions)}


def figure_data(elf: ElfObject, name: str = "grade") -> dict[str, Any]:
    analysis = analyze_function(elf, name)

    def block_entries(cfg: ControlFlowGraph) -> list[dict[str, Any]]:
        return [{"s": b.start, "e": b.end, "n": len(b.instructions)} for b in sorted(cfg.blocks.values(), key=lambda b: b.start)]

    def edge_entries(cfg: ControlFlowGraph) -> list[dict[str, Any]]:
        return [{"f": s, "t": t, "k": k} for s, t, k in cfg.edges]

    layer: dict[int, int] = {analysis.start: 0}
    for start in analysis.cfg.reverse_postorder()[1:]:
        forward = [p for p in analysis.cfg.predecessors(start) if p in layer and not analysis.cfg.dominates(start, p)]
        layer[start] = 1 + max(layer[p] for p in forward)
    deepest = max(layer.values()) if layer else 0
    for start in analysis.cfg_sweep.blocks:
        if start not in layer:
            deepest += 1
            layer[start] = deepest
    table = next(iter(analysis.descent.resolved_tables.values()), None)
    instructions = [
        {"a": i.address, "n": i.length, "b": i.hex, "t": " ".join(i.text.split()), "f": i.flow, "g": i.target}
        for i in analysis.sweep.instructions
    ]
    return {
        "function": name,
        "start": analysis.start,
        "end": analysis.end,
        "gapEnd": analysis.gap_end,
        "instructions": instructions,
        "layers": {f"{s}": l for s, l in layer.items()},
        "table": None if table is None else {"at": f"{table.section}+0x{table.offset:x}", "count": table.count, "targets": sorted(set(table.targets)), "jump": table.jump_instruction},
        "methods": {
            "linear": {"order": [i.address for i in analysis.sweep.instructions], "blocks": block_entries(analysis.cfg_sweep), "edges": edge_entries(analysis.cfg_sweep)},
            "descent": {"order": analysis.descent_plain.order, "blocks": block_entries(analysis.cfg_plain), "edges": edge_entries(analysis.cfg_plain), "unresolved": [i.address for i in analysis.descent_plain.unresolved]},
            "table": {"order": analysis.descent.order, "blocks": block_entries(analysis.cfg), "edges": edge_entries(analysis.cfg), "unresolved": [i.address for i in analysis.descent.unresolved]},
        },
    }


FIXTURE_OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"]


def trap_report(elf: ElfObject) -> dict[str, Any]:
    code = elf.section(".text").data
    start, end, gap_end = elf.function_extent("lookup")
    sweep = linear_sweep(code, start, gap_end)
    descent = recursive_descent(code, [start], gap_end)
    jump = next(i for i in descent.sorted_instructions() if i.flow == "jump")
    assert jump.target is not None
    sweep_at_target = sweep.covering(jump.target)
    return {
        "function": "lookup",
        "jump": f"0x{jump.address:x} {jump.text} -> 0x{jump.target:x}",
        "dataBytes": {"range": f"0x{jump.end:x}-0x{jump.target:x}", "hex": code[jump.end : jump.target].hex(" ")},
        "linearSweep": {
            "instructions": len(sweep.instructions),
            "atJumpTarget": None if sweep_at_target is None else {"starts": f"0x{sweep_at_target.address:x}", "text": sweep_at_target.text, "startsAtTarget": sweep_at_target.address == jump.target},
            "claimedDataBytes": sum(1 for i in sweep.instructions for a in range(i.address, i.end) if jump.end <= a < jump.target),
            "claimedPaddingBytes": sum(1 for i in sweep.instructions for a in range(i.address, i.end) if a >= end),
        },
        "recursiveDescent": {
            "instructions": len(descent.instructions),
            "atJumpTarget": descent.instructions[jump.target].text if jump.target in descent.instructions else None,
            "claimedDataBytes": sum(1 for a in descent.claimed_bytes() if jump.end <= a < jump.target),
            "claimedPaddingBytes": sum(1 for a in descent.claimed_bytes() if a >= end),
        },
    }


def demo() -> dict[str, Any]:
    report: dict[str, Any] = {"fixtures": {}}
    for object_name in FIXTURE_OBJECTS:
        elf = load_fixture(object_name)
        oracle_path = FIXTURES / object_name.replace(".o", ".objdump.txt")
        entry: dict[str, Any] = {}
        if oracle_path.exists():
            comparison = compare_with_oracle(elf, oracle_path.read_text())
            entry["oracle"] = f"{comparison['compared'] - len(comparison['mismatches'])}/{comparison['compared']} instructions agree with llvm-objdump"
        entry["functions"] = {symbol.name: analyze_function(elf, symbol.name).to_dict() for symbol in elf.functions()}
        report["fixtures"][object_name] = entry
    report["sweepTrap"] = trap_report(load_fixture("sweep-trap.o"))
    return report


def disassemble(path: str) -> str:
    elf = ElfObject(Path(path).read_bytes())
    code = elf.section(".text").data
    lines: list[str] = []
    functions = {s.value: s.name for s in elf.functions()}
    for instruction in linear_sweep(code).instructions:
        if instruction.address in functions:
            lines.append(f"\n{instruction.address:016x} <{functions[instruction.address]}>:")
        line = listing_line(instruction, elf)
        reference = resolve_reference(elf, instruction)
        if reference is not None:
            line += f"\t; {reference.relocation.describe()} -> {reference.describe()}"
        lines.append(line)
    return "\n".join(lines).lstrip("\n")


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "disasm" and len(argv) == 2:
        print(disassemble(argv[1]))
        return 0
    if command == "cfg" and len(argv) == 3:
        elf = ElfObject(Path(argv[1]).read_bytes())
        print(json.dumps(analyze_function(elf, argv[2]).to_dict(), indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(load_fixture("ledger-x86_64-O0.o"), "grade"), separators=(",", ":")))
        return 0
    print("usage: main.py [disasm FILE.o | cfg FILE.o FUNCTION | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
