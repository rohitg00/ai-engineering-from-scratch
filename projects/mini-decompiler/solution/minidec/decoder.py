
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .elf import ElfObject, relocation_target

MAX_INSTRUCTION_LENGTH = 15
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
ALU_EV_GV = {0x01: "add", 0x09: "or", 0x11: "adc", 0x19: "sbb", 0x21: "and", 0x29: "sub", 0x31: "xor", 0x39: "cmp", 0x85: "test", 0x89: "mov"}
ALU_GV_EV = {0x03: "add", 0x0B: "or", 0x13: "adc", 0x1B: "sbb", 0x23: "and", 0x2B: "sub", 0x33: "xor", 0x3B: "cmp", 0x8B: "mov"}
ALU_ACC_IMM = {0x05: "add", 0x0D: "or", 0x15: "adc", 0x1D: "sbb", 0x25: "and", 0x2D: "sub", 0x35: "xor", 0x3D: "cmp"}
SUFFIXED = {"add", "or", "adc", "sbb", "and", "sub", "xor", "cmp", "test", "mov", "lea", "imul", "inc", "dec", "neg", "not", "idiv", "div", "mul", "shl", "shr", "sar", "rol", "ror", "rcl", "rcr"}
UNSIGNED_IMMEDIATE_OPS = {"mov", "shl", "shr", "sar", "rol", "ror", "rcl", "rcr"}


class DecodeError(ValueError):
    def __init__(self, address: int, reason: str) -> None:
        super().__init__(f"0x{address:x}: {reason}")
        self.address = address
        self.reason = reason


@dataclass(frozen=True)
class Reg:
    name: str
    width: int

    def render(self) -> str:
        return "%" + self.name


@dataclass(frozen=True)
class Imm:
    value: int
    width: int
    unsigned: bool = False

    def render(self) -> str:
        if self.unsigned and self.value < 0:
            return "$" + format_hex(self.value & ((1 << self.width) - 1))
        return "$" + format_hex(self.value)


@dataclass(frozen=True)
class Mem:
    width: int
    base: str | None
    index: str | None
    scale: int
    disp: int
    rip: bool
    segment: str | None
    disp_offset: int | None

    def render(self) -> str:
        if self.rip:
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
        show = self.disp != 0 or (self.base is None and not self.rip)
        text = (format_hex(self.disp) if show else "") + inner
        return f"%{self.segment}:{text}" if self.segment else text


@dataclass(frozen=True)
class Rel:
    target: int

    def render(self) -> str:
        return format_hex(self.target)


Operand = Reg | Imm | Mem | Rel


@dataclass(frozen=True)
class Instruction:
    address: int
    raw: bytes
    op: str
    operands: tuple[Any, ...]
    width: int
    flow: str = "next"
    cc: str | None = None
    target: int | None = None
    displacement_offset: int | None = None
    immediate_offset: int | None = None
    prefixes: tuple[int, ...] = ()
    rex: int | None = None
    opcode: tuple[int, ...] = ()
    modrm: int | None = None
    source_width: int | None = None

    @property
    def length(self) -> int:
        return len(self.raw)

    @property
    def end(self) -> int:
        return self.address + self.length

    @property
    def hex(self) -> str:
        return " ".join(f"{byte:02x}" for byte in self.raw)

    @property
    def memory(self) -> Mem | None:
        for operand in self.operands:
            if isinstance(operand, Mem):
                return operand
        return None

    @property
    def mnemonic(self) -> str:
        return render_mnemonic(self)

    @property
    def text(self) -> str:
        rendered = ", ".join(operand.render() for operand in self.operands)
        return self.mnemonic + ("\t" + rendered if rendered else "")

    def covers(self, address: int) -> bool:
        return self.address <= address < self.end


def format_hex(value: int) -> str:
    return f"-0x{-value:x}" if value < 0 else f"0x{value:x}"


def render_mnemonic(insn: Instruction) -> str:
    op = insn.op
    if op == "jcc":
        return "j" + (insn.cc or "")
    if op == "set":
        return "set" + (insn.cc or "")
    if op == "cmov":
        return "cmov" + (insn.cc or "") + SUFFIX[insn.width]
    if op == "movsxd":
        return "movslq"
    if op in ("movzx", "movsx"):
        return ("movz" if op == "movzx" else "movs") + SUFFIX[insn.source_width or 8] + SUFFIX[insn.width]
    if op == "cdq":
        return {16: "cwtd", 32: "cltd", 64: "cqto"}[insn.width]
    if op in ("push", "pop", "ret"):
        return op + "q"
    if op == "call":
        return "callq"
    if op == "jmp":
        return "jmpq" if insn.flow == "indirect-jump" else "jmp"
    if op == "nop":
        return "nop" + SUFFIX[insn.width] if insn.operands else "nop"
    if op == "mov" and insn.width == 64 and insn.operands and isinstance(insn.operands[0], Imm) and insn.operands[0].width == 64:
        return "movabsq"
    if op in SUFFIXED:
        return op + SUFFIX[insn.width]
    return op


class _Cursor:
    def __init__(self, code: bytes, start: int) -> None:
        self.code = code
        self.start = start
        self.position = start

    def byte(self) -> int:
        if self.position >= len(self.code):
            raise DecodeError(self.start, "instruction runs past the end of the code")
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


class _State:
    def __init__(self, cursor: _Cursor, prefixes: tuple[int, ...], rex: int | None) -> None:
        self.cursor = cursor
        self.prefixes = prefixes
        self.rex = rex
        self.modrm_byte: int | None = None
        self.memory: Mem | None = None
        self.displacement_offset: int | None = None
        self.immediate_offset: int | None = None
        self.opcode_start = cursor.position

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
        return 16 if 0x66 in self.prefixes else 32

    def segment(self) -> str | None:
        for prefix in self.prefixes:
            if prefix in SEGMENT_PREFIXES:
                return SEGMENT_PREFIXES[prefix]
        return None

    def register(self, width: int, number: int) -> Reg:
        if width == 8 and self.rex is None and number < 8:
            return Reg(LEGACY_BYTE_REGISTERS[number], 8)
        return Reg(REGISTERS[width][number], width)

    def immediate(self, size: int, width: int, signed: bool = True, unsigned_text: bool = False) -> Imm:
        self.immediate_offset = self.cursor.position - self.cursor.start
        return Imm(self.cursor.integer(size, signed), width, unsigned_text)

    def displacement(self, size: int) -> int:
        self.displacement_offset = self.cursor.position - self.cursor.start
        return self.cursor.integer(size, True)

    def modrm(self, reg_width: int, rm_width: int) -> tuple[Reg, Operand, int]:
        modrm = self.cursor.byte()
        self.modrm_byte = modrm
        mod, reg, rm = modrm >> 6, (modrm >> 3) & 7, modrm & 7
        reg_operand = self.register(reg_width, reg | self.rex_r())
        if mod == 3:
            return reg_operand, self.register(rm_width, rm | self.rex_b()), reg
        base: str | None = None
        index: str | None = None
        scale = 1
        rip = False
        disp = 0
        if rm == 4:
            sib = self.cursor.byte()
            scale = 1 << (sib >> 6)
            index_number = ((sib >> 3) & 7) | self.rex_x()
            if index_number != 4:
                index = REGISTERS[64][index_number]
            if (sib & 7) == 5 and mod == 0:
                disp = self.displacement(4)
            else:
                base = REGISTERS[64][(sib & 7) | self.rex_b()]
        elif rm == 5 and mod == 0:
            rip = True
            disp = self.displacement(4)
        else:
            base = REGISTERS[64][rm | self.rex_b()]
        if mod == 1:
            disp = self.displacement(1)
        elif mod == 2:
            disp = self.displacement(4)
        self.memory = Mem(rm_width, base, index, scale, disp, rip, self.segment(), self.displacement_offset)
        return reg_operand, self.memory, reg

    def finish(self, op: str, operands: tuple[Any, ...], width: int, flow: str = "next", cc: str | None = None, target: int | None = None, source_width: int | None = None) -> Instruction:
        raw = self.cursor.code[self.cursor.start : self.cursor.position]
        first = self.opcode_start - self.cursor.start
        opcode = tuple(raw[first : first + (2 if raw[first] == 0x0F else 1)])
        return Instruction(
            address=self.cursor.start,
            raw=bytes(raw),
            op=op,
            operands=operands,
            width=width,
            flow=flow,
            cc=cc,
            target=target,
            displacement_offset=self.displacement_offset,
            immediate_offset=self.immediate_offset,
            prefixes=self.prefixes,
            rex=self.rex,
            opcode=opcode,
            modrm=self.modrm_byte,
            source_width=source_width,
        )

    def relative(self, op: str, size: int, flow: str, cc: str | None = None) -> Instruction:
        offset = self.immediate(size, 64).value
        target = (self.cursor.position + offset) & 0xFFFFFFFFFFFFFFFF
        return self.finish(op, (Rel(target),), 64, flow=flow, cc=cc, target=target)


def _imm_size(width: int) -> int:
    return 2 if width == 16 else 4


def decode(code: bytes, address: int) -> Instruction:
    if address < 0 or address >= len(code):
        raise DecodeError(address, "address is outside the code")
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
        return _two_byte(state, cursor.byte())
    return _one_byte(state, opcode)


def _one_byte(state: _State, opcode: int) -> Instruction:
    width = state.operand_size()
    if opcode in ALU_EV_GV:
        reg, rm, _ = state.modrm(width, width)
        return state.finish(ALU_EV_GV[opcode], (reg, rm), width)
    if opcode in ALU_GV_EV:
        reg, rm, _ = state.modrm(width, width)
        return state.finish(ALU_GV_EV[opcode], (rm, reg), width)
    if opcode in ALU_ACC_IMM:
        immediate = state.immediate(_imm_size(width), width)
        return state.finish(ALU_ACC_IMM[opcode], (immediate, Reg(REGISTERS[width][0], width)), width)
    if opcode in (0x88, 0x8A):
        reg, rm, _ = state.modrm(8, 8)
        operands = (reg, rm) if opcode == 0x88 else (rm, reg)
        return state.finish("mov", operands, 8)
    if 0x50 <= opcode <= 0x57:
        return state.finish("push", (state.register(64, (opcode & 7) | state.rex_b()),), 64)
    if 0x58 <= opcode <= 0x5F:
        return state.finish("pop", (state.register(64, (opcode & 7) | state.rex_b()),), 64)
    if opcode == 0x63:
        if width != 64:
            raise DecodeError(state.cursor.start, "opcode 63 without REX.W is not in the subset")
        reg, rm, _ = state.modrm(64, 32)
        return state.finish("movsxd", (rm, reg), 64, source_width=32)
    if opcode in (0x69, 0x6B):
        reg, rm, _ = state.modrm(width, width)
        immediate = state.immediate(1 if opcode == 0x6B else _imm_size(width), width)
        return state.finish("imul", (immediate, rm, reg), width)
    if 0x70 <= opcode <= 0x7F:
        return state.relative("jcc", 1, "branch", CONDITIONS[opcode & 0xF])
    if opcode in (0x81, 0x83):
        _, rm, digit = state.modrm(width, width)
        immediate = state.immediate(1 if opcode == 0x83 else _imm_size(width), width)
        return state.finish(GROUP1[digit], (immediate, rm), width)
    if opcode == 0x8D:
        reg, rm, _ = state.modrm(width, width)
        if not isinstance(rm, Mem):
            raise DecodeError(state.cursor.start, "lea needs a memory operand")
        return state.finish("lea", (rm, reg), width)
    if opcode == 0x90:
        return state.finish("nop", (), width)
    if opcode == 0x99:
        return state.finish("cdq", (), width)
    if 0xB8 <= opcode <= 0xBF:
        register = state.register(width, (opcode & 7) | state.rex_b())
        if width == 64:
            return state.finish("mov", (state.immediate(8, 64), register), 64)
        return state.finish("mov", (state.immediate(_imm_size(width), width, unsigned_text=True), register), width)
    if opcode in (0xC1, 0xD1):
        _, rm, digit = state.modrm(width, width)
        immediate = state.immediate(1, 8, signed=False) if opcode == 0xC1 else Imm(1, 8)
        return state.finish(GROUP2[digit], (immediate, rm), width)
    if opcode == 0xC3:
        return state.finish("ret", (), 64, flow="return")
    if opcode == 0xC7:
        _, rm, digit = state.modrm(width, width)
        if digit != 0:
            raise DecodeError(state.cursor.start, f"opcode c7 /{digit} is not mov")
        return state.finish("mov", (state.immediate(_imm_size(width), width, unsigned_text=width != 64), rm), width)
    if opcode == 0xCC:
        return state.finish("int3", (), 64)
    if opcode == 0xE8:
        return state.relative("call", 4, "call")
    if opcode == 0xE9:
        return state.relative("jmp", 4, "jump")
    if opcode == 0xEB:
        return state.relative("jmp", 1, "jump")
    if opcode == 0xF7:
        _, rm, digit = state.modrm(width, width)
        if digit in (0, 1):
            return state.finish("test", (state.immediate(_imm_size(width), width), rm), width)
        return state.finish(GROUP3[digit], (rm,), width)
    if opcode == 0xFF:
        _, rm, digit = state.modrm(width, width)
        if digit == 0:
            return state.finish("inc", (rm,), width)
        if digit == 1:
            return state.finish("dec", (rm,), width)
        if digit in (2, 4, 6):
            if isinstance(rm, Reg):
                rm = state.register(64, REGISTERS[rm.width].index(rm.name))
            else:
                rm = Mem(64, rm.base, rm.index, rm.scale, rm.disp, rm.rip, rm.segment, rm.disp_offset)
            if digit == 6:
                return state.finish("push", (rm,), 64)
            op = "call" if digit == 2 else "jmp"
            return state.finish(op, (IndirectOperand(rm),), 64, flow="indirect-call" if digit == 2 else "indirect-jump")
        raise DecodeError(state.cursor.start, f"opcode ff /{digit} is not in the subset")
    raise DecodeError(state.cursor.start, f"opcode {opcode:02x} is not in the subset")


def _two_byte(state: _State, opcode: int) -> Instruction:
    width = state.operand_size()
    if opcode == 0x0B:
        return state.finish("ud2", (), 64)
    if opcode == 0x1F:
        _, rm, _ = state.modrm(width, width)
        return state.finish("nop", (rm,), width)
    if 0x80 <= opcode <= 0x8F:
        return state.relative("jcc", 4, "branch", CONDITIONS[opcode & 0xF])
    if 0x90 <= opcode <= 0x9F:
        _, rm, _ = state.modrm(8, 8)
        return state.finish("set", (rm,), 8, cc=CONDITIONS[opcode & 0xF])
    if 0x40 <= opcode <= 0x4F:
        reg, rm, _ = state.modrm(width, width)
        return state.finish("cmov", (rm, reg), width, cc=CONDITIONS[opcode & 0xF])
    if opcode == 0xAF:
        reg, rm, _ = state.modrm(width, width)
        return state.finish("imul", (rm, reg), width)
    if opcode in (0xB6, 0xB7, 0xBE, 0xBF):
        source = 8 if opcode in (0xB6, 0xBE) else 16
        reg, rm, _ = state.modrm(width, source)
        return state.finish("movzx" if opcode in (0xB6, 0xB7) else "movsx", (rm, reg), width, source_width=source)
    raise DecodeError(state.cursor.start, f"opcode 0f {opcode:02x} is not in the subset")


@dataclass(frozen=True)
class IndirectOperand:
    inner: Reg | Mem

    def render(self) -> str:
        return "*" + self.inner.render()


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


def listing_line(instruction: Instruction, elf: ElfObject | None = None) -> str:
    text = instruction.text
    if instruction.target is not None and elf is not None:
        text += f" <{elf.symbolize(instruction.target)}>"
    return f"{instruction.address:8x}: {instruction.hex:<30}\t{text}"


def parse_objdump(text: str) -> list[tuple[int, str, str]]:
    rows: list[tuple[int, str, str]] = []
    for line in text.splitlines():
        if ":" not in line or "\t" not in line or line.startswith("\t\t"):
            continue
        head, _tab, rest = line.partition("\t")
        address_text, _colon, byte_text = head.strip().partition(":")
        if not address_text or not all(c in "0123456789abcdef" for c in address_text):
            continue
        body = rest.split("#", 1)[0]
        if " <" in body:
            body = body.split(" <", 1)[0]
        rows.append((int(address_text, 16), " ".join(byte_text.split()), " ".join(body.split())))
    return rows


@dataclass
class Comparison:
    compared: int
    ours: int
    mismatches: list[dict[str, str]] = field(default_factory=list)

    @property
    def agree(self) -> bool:
        return not self.mismatches and self.compared == self.ours

    def to_dict(self) -> dict[str, Any]:
        return {"compared": self.compared, "ours": self.ours, "mismatches": self.mismatches, "agree": self.agree}


def compare_with_objdump(elf: ElfObject, oracle_text: str, section: str = ".text") -> Comparison:
    code = elf.section(section).data
    ours = linear_sweep(code)
    expected = parse_objdump(oracle_text)
    by_address = {i.address: i for i in ours.instructions}
    comparison = Comparison(len(expected), len(ours.instructions))
    for address, byte_text, text in expected:
        instruction = by_address.get(address)
        if instruction is None:
            comparison.mismatches.append({"address": f"0x{address:x}", "expected": text, "got": "(no instruction starts here)"})
            continue
        got = " ".join(instruction.text.split())
        if instruction.hex != byte_text or got != text:
            comparison.mismatches.append({"address": f"0x{address:x}", "expected": f"{byte_text} {text}", "got": f"{instruction.hex} {got}"})
    return comparison


def disassemble(elf: ElfObject, section: str = ".text") -> str:
    code = elf.section(section).data
    lines: list[str] = []
    functions = {s.value: s.name for s in elf.functions(section)}
    for instruction in linear_sweep(code).instructions:
        if instruction.address in functions:
            lines.append(f"\n{instruction.address:016x} <{functions[instruction.address]}>:")
        line = listing_line(instruction, elf)
        for field_offset in (instruction.displacement_offset, instruction.immediate_offset):
            if field_offset is None:
                continue
            relocation = elf.relocation_at(section, instruction.address + field_offset)
            if relocation is not None:
                target = relocation_target(relocation, instruction.end)
                line += f"\t; {relocation.describe()} -> {target.describe()}"
        lines.append(line)
    return "\n".join(lines).lstrip("\n")
