"""Companion code for docs/en.md: lift x86-64 machine code to C-like pseudocode.
Instruction format: Intel SDM Volume 2, chapter 2 (prefixes, opcode, ModR/M, SIB, displacement, immediate).
Calling convention: System V AMD64 psABI section 3.2.3 (%rdi, %rsi, %rdx, %rcx, %r8, %r9; result in %rax).
SSA form: Cytron, Ferrante, Rosen, Wegman, Zadeck, ACM TOPLAS 13(4), 1991, sections 5.1 and 5.2.
Dominators: Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm", 2001.
Run `python3 main.py` for the demo or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

FIXTURES = Path(__file__).resolve().parent / "fixtures"
ARG_REGISTERS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"]
REG64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi"] + [f"r{i}" for i in range(8, 16)]
REG32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"] + [f"r{i}d" for i in range(8, 16)]
REG16 = ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di"] + [f"r{i}w" for i in range(8, 16)]
R_X86_64_PC32 = 2
R_X86_64_PLT32 = 4
STT_FUNC = 2
STT_SECTION = 3
EXIT = -1


@dataclass
class Section:
    index: int
    name: str
    type: int
    offset: int
    size: int
    link: int
    data: bytes


@dataclass
class Symbol:
    name: str
    value: int
    size: int
    type: int
    shndx: int


@dataclass
class Relocation:
    offset: int
    type: int
    symbol: str
    addend: int


@dataclass
class ElfObject:
    path: Path
    sections: list[Section]
    symbols: list[Symbol]
    relocations: dict[str, list[Relocation]]

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise KeyError(name)

    def functions(self) -> list[Symbol]:
        text = self.section(".text").index
        found = [s for s in self.symbols if s.type == STT_FUNC and s.shndx == text]
        return sorted(found, key=lambda s: s.value)

    def function(self, name: str) -> Symbol:
        for symbol in self.functions():
            if symbol.name == name:
                return symbol
        raise KeyError(name)

    def function_end(self, symbol: Symbol) -> int:
        later = [s.value for s in self.functions() if s.value > symbol.value]
        return min(later) if later else self.section(".text").size

    def relocation_at(self, section: str, offset: int) -> Relocation | None:
        for relocation in self.relocations.get(section, []):
            if relocation.offset == offset:
                return relocation
        return None


def _cstr(table: bytes, index: int) -> str:
    end = table.index(b"\0", index)
    return table[index:end].decode("ascii")


def read_object(path: Path) -> ElfObject:
    data = path.read_bytes()
    if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        raise ValueError(f"{path} is not a little-endian ELF64 file")
    (e_shoff,) = struct.unpack_from("<Q", data, 0x28)
    e_shentsize, e_shnum, e_shstrndx = struct.unpack_from("<HHH", data, 0x3A)
    raw_headers = [
        struct.unpack_from("<IIQQQQIIQQ", data, e_shoff + i * e_shentsize) for i in range(e_shnum)
    ]
    shstr = raw_headers[e_shstrndx]
    shstrtab = data[shstr[4] : shstr[4] + shstr[5]]
    sections: list[Section] = []
    for index, header in enumerate(raw_headers):
        sh_name, sh_type, _flags, _addr, sh_offset, sh_size, sh_link, _info, _align, _entsize = header
        payload = b"" if sh_type == 8 else data[sh_offset : sh_offset + sh_size]
        sections.append(Section(index, _cstr(shstrtab, sh_name), sh_type, sh_offset, sh_size, sh_link, payload))
    symbols: list[Symbol] = []
    symtab = next((s for s in sections if s.name == ".symtab"), None)
    if symtab is not None:
        strtab = sections[symtab.link].data
        for i in range(symtab.size // 24):
            st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from(
                "<IBBHQQ", symtab.data, i * 24
            )
            st_type = st_info & 0xF
            name = sections[st_shndx].name if st_type == STT_SECTION else _cstr(strtab, st_name)
            symbols.append(Symbol(name, st_value, st_size, st_type, st_shndx))
    relocations: dict[str, list[Relocation]] = {}
    for section in sections:
        if not section.name.startswith(".rela."):
            continue
        target = section.name[len(".rela") :]
        entries = []
        for i in range(section.size // 24):
            r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, i * 24)
            entries.append(Relocation(r_offset, r_info & 0xFFFFFFFF, symbols[r_info >> 32].name, r_addend))
        relocations[target] = entries
    return ElfObject(path, sections, symbols, relocations)


class DecodeError(ValueError):
    pass


@dataclass(frozen=True)
class Reg:
    name: str
    width: int


@dataclass(frozen=True)
class Imm:
    value: int
    width: int


@dataclass(frozen=True)
class Mem:
    width: int
    base: str | None
    index: str | None
    scale: int
    disp: int
    rip: bool
    segment: str | None
    disp_offset: int


@dataclass(frozen=True)
class Rel:
    target: int


@dataclass
class Insn:
    address: int
    raw: bytes
    mnemonic: str
    operands: tuple[Any, ...]
    width: int

    @property
    def size(self) -> int:
        return len(self.raw)

    @property
    def next_address(self) -> int:
        return self.address + self.size

    def att(self) -> str:
        return render_att(self)


ALU_EV_GV = {0x01: "add", 0x29: "sub", 0x31: "xor", 0x39: "cmp", 0x85: "test", 0x89: "mov"}
ALU_GV_EV = {0x03: "add", 0x2B: "sub", 0x3B: "cmp", 0x8B: "mov", 0x8D: "lea"}
GROUP1 = {0: "add", 5: "sub", 7: "cmp"}
GROUP2 = {5: "shr", 7: "sar"}
GROUP3 = {7: "idiv"}
JCC = {
    0x72: "jb", 0x73: "jae", 0x74: "je", 0x75: "jne", 0x76: "jbe", 0x77: "ja",
    0x7C: "jl", 0x7D: "jge", 0x7E: "jle", 0x7F: "jg",
}
SUFFIX = {16: "w", 32: "l", 64: "q"}
JCC_NAMES = set(JCC.values())


def reg_name(number: int, width: int) -> str:
    return {16: REG16, 32: REG32, 64: REG64}[width][number]


def _sint(code: bytes, pos: int, size: int) -> int:
    return int.from_bytes(code[pos : pos + size], "little", signed=True)


def _parse_modrm(code: bytes, i: int, width: int, rex_x: int, rex_b: int, segment: str | None, start: int):
    modrm = code[i]
    i += 1
    mod, reg, rm = modrm >> 6, (modrm >> 3) & 7, modrm & 7
    if mod == 3:
        return Reg(reg_name(rm | rex_b << 3, width), width), reg, i
    base = index = None
    scale, disp, rip, disp_size = 1, 0, False, 0
    sib_base_is_disp = False
    if rm == 4:
        sib = code[i]
        i += 1
        scale = 1 << (sib >> 6)
        idx = ((sib >> 3) & 7) | rex_x << 3
        index = None if idx == 4 else REG64[idx]
        if (sib & 7) == 5 and mod == 0:
            sib_base_is_disp = True
        else:
            base = REG64[(sib & 7) | rex_b << 3]
    elif rm == 5 and mod == 0:
        rip = True
    else:
        base = REG64[rm | rex_b << 3]
    if mod == 1:
        disp_size = 1
    elif mod == 2 or rip or sib_base_is_disp:
        disp_size = 4
    disp_offset = i - start
    if disp_size:
        disp = _sint(code, i, disp_size)
        i += disp_size
    return Mem(width, base, index, scale, disp, rip, segment, disp_offset), reg, i


def decode_one(code: bytes, pos: int) -> Insn:
    start = i = pos
    opsize16, segment, rex = False, None, 0
    while i < len(code):
        b = code[i]
        if b == 0x66:
            opsize16 = True
        elif b == 0x2E:
            segment = "cs"
        elif 0x40 <= b <= 0x4F:
            rex = b
            i += 1
            break
        else:
            break
        i += 1
    if i >= len(code):
        raise DecodeError(f"0x{pos:x}: ran out of bytes inside the prefixes")
    rex_w, rex_r, rex_x, rex_b = (rex >> 3) & 1, (rex >> 2) & 1, (rex >> 1) & 1, rex & 1
    width = 64 if rex_w else 16 if opsize16 else 32
    op = code[i]
    i += 1

    def done(mnemonic: str, operands: tuple[Any, ...], w: int = width) -> Insn:
        return Insn(start, bytes(code[start:i]), mnemonic, operands, w)

    def modrm(w: int = width):
        nonlocal i
        rm_operand, reg_field, i = _parse_modrm(code, i, w, rex_x, rex_b, segment, start)
        return rm_operand, reg_field

    def imm(size: int, w: int = width) -> Imm:
        nonlocal i
        value = _sint(code, i, size)
        i += size
        return Imm(value, w)

    def rel(size: int) -> Rel:
        offset = imm(size).value
        return Rel(i + offset)

    def gv(reg_field: int, w: int = width) -> Reg:
        return Reg(reg_name(reg_field | rex_r << 3, w), w)

    if op in ALU_EV_GV:
        ev, reg_field = modrm()
        return done(ALU_EV_GV[op], (ev, gv(reg_field)))
    if op in ALU_GV_EV:
        ev, reg_field = modrm()
        return done(ALU_GV_EV[op], (gv(reg_field), ev))
    if op == 0x63:
        ev, reg_field = modrm(32)
        return done("movsxd", (gv(reg_field, 64), ev), 64)
    if op in (0x69, 0x6B):
        ev, reg_field = modrm()
        immediate = imm(4 if op == 0x69 else 1)
        return done("imul", (gv(reg_field), ev, immediate))
    if 0x50 <= op <= 0x5F:
        mnemonic = "push" if op <= 0x57 else "pop"
        return done(mnemonic, (Reg(reg_name((op & 7) | rex_b << 3, 64), 64),), 64)
    if op in JCC:
        return done(JCC[op], (rel(1),), 0)
    if op == 0x83:
        ev, reg_field = modrm()
        if reg_field not in GROUP1:
            raise DecodeError(f"0x{start:x}: group 1 extension /{reg_field} is outside the fixture subset")
        return done(GROUP1[reg_field], (ev, imm(1)))
    if op == 0x90:
        return done("nop", (), 0)
    if op == 0x99:
        return done("cqto" if rex_w else "cltd", (), width)
    if op == 0xC1:
        ev, reg_field = modrm()
        if reg_field not in GROUP2:
            raise DecodeError(f"0x{start:x}: group 2 extension /{reg_field} is outside the fixture subset")
        return done(GROUP2[reg_field], (ev, imm(1, 8)))
    if op == 0xC3:
        return done("ret", (), 64)
    if op == 0xC7:
        ev, reg_field = modrm()
        if reg_field != 0:
            raise DecodeError(f"0x{start:x}: C7 /{reg_field} is not mov")
        return done("mov", (ev, imm(4)))
    if op == 0xE8:
        return done("call", (rel(4),), 64)
    if op == 0xE9:
        return done("jmp", (rel(4),), 0)
    if op == 0xEB:
        return done("jmp", (rel(1),), 0)
    if op == 0xF7:
        ev, reg_field = modrm()
        if reg_field not in GROUP3:
            raise DecodeError(f"0x{start:x}: group 3 extension /{reg_field} is outside the fixture subset")
        return done(GROUP3[reg_field], (ev,))
    if op == 0xFF:
        extension = (code[i] >> 3) & 7
        ev, reg_field = modrm(64 if extension == 4 else width)
        if reg_field == 0:
            return done("inc", (ev,))
        if reg_field == 4:
            return done("jmp", (ev,), 64)
        raise DecodeError(f"0x{start:x}: group 5 extension /{reg_field} is outside the fixture subset")
    if op == 0x0F:
        op2 = code[i]
        i += 1
        if op2 == 0x1F:
            ev, _reg_field = modrm()
            return done("nop", (ev,))
        raise DecodeError(f"0x{start:x}: two-byte opcode 0f {op2:02x} is outside the fixture subset")
    raise DecodeError(f"0x{start:x}: opcode {op:02x} is outside the fixture subset")


def decode_range(code: bytes, start: int, end: int) -> list[Insn]:
    insns = []
    pos = start
    while pos < end:
        insn = decode_one(code, pos)
        insns.append(insn)
        pos = insn.next_address
    return insns


def _hex(value: int) -> str:
    return f"-0x{-value:x}" if value < 0 else f"0x{value:x}"


def _const_text(value: int) -> str:
    return _hex(value) if abs(value) >= 0x10000 else str(value)


def render_operand(operand: Any) -> str:
    if isinstance(operand, Reg):
        return f"%{operand.name}"
    if isinstance(operand, Imm):
        return f"${_hex(operand.value)}"
    if isinstance(operand, Rel):
        return _hex(operand.target)
    if isinstance(operand, Mem):
        prefix = f"%{operand.segment}:" if operand.segment else ""
        has_register = operand.base or operand.index or operand.rip
        disp = _hex(operand.disp) if operand.disp or not has_register else ""
        if operand.rip:
            return f"{prefix}{disp}(%rip)"
        inner = f"%{operand.base}" if operand.base else ""
        if operand.index:
            inner += f",%{operand.index}"
            if operand.scale != 1:
                inner += f",{operand.scale}"
        return f"{prefix}{disp}({inner})"
    raise TypeError(type(operand))


def render_att(insn: Insn) -> str:
    m = insn.mnemonic
    if jump_target(insn) is not None:
        return f"{m}\t{render_operand(insn.operands[0])}"
    if m == "jmp":
        return f"jmpq\t*{render_operand(insn.operands[0])}"
    if m in ("cltd", "cqto"):
        return m
    if m == "movsxd":
        return f"movslq\t{render_operand(insn.operands[1])}, {render_operand(insn.operands[0])}"
    if m == "nop":
        if not insn.operands:
            return "nop"
        return f"nop{SUFFIX[insn.width]}\t{render_operand(insn.operands[0])}"
    if m == "ret":
        return "retq"
    if m == "call":
        return f"callq\t{render_operand(insn.operands[0])}"
    name = m + SUFFIX[insn.width]
    operands = ", ".join(render_operand(o) for o in reversed(insn.operands))
    return f"{name}\t{operands}"


def parse_objdump(text: str) -> dict[str, list[tuple[int, bytes, str]]]:
    """Return {function: [(address, bytes, AT&T text)]} from `llvm-objdump -d -r` output."""
    functions: dict[str, list[tuple[int, bytes, str]]] = {}
    current = None
    for line in text.splitlines():
        if line.endswith(">:") and " <" in line:
            current = line.split("<", 1)[1][:-2]
            functions[current] = []
            continue
        if current is None or ":" not in line or line.startswith("\t\t"):
            continue
        head, _, rest = line.strip().partition(":")
        if not head or not all(c in "0123456789abcdef" for c in head):
            continue
        rest = rest.split("#", 1)[0]
        parts = rest.strip().split("\t")
        raw = bytes.fromhex(parts[0].replace(" ", ""))
        asm = "\t".join(p.strip() for p in parts[1:]).strip()
        if " <" in asm:
            asm = asm.split(" <", 1)[0]
        functions[current].append((int(head, 16), raw, asm))
    return functions


@dataclass(frozen=True)
class Const:
    value: int
    width: int


@dataclass(frozen=True)
class Var:
    name: str
    width: int
    version: int = -1


@dataclass(frozen=True)
class Bin:
    op: str
    left: Any
    right: Any
    width: int


@dataclass(frozen=True)
class Cast:
    kind: str
    expr: Any
    width: int


@dataclass(frozen=True)
class Load:
    addr: Any
    width: int


@dataclass(frozen=True)
class Index:
    base: Any
    index: Any
    width: int


@dataclass(frozen=True)
class Flags:
    kind: str
    left: Any
    right: Any
    width: int


@dataclass(frozen=True)
class Cond:
    cc: str
    flags: Any
    width: int = 32


@dataclass(frozen=True)
class Concat:
    high: Any
    low: Any
    width: int


@dataclass(frozen=True)
class SignFill:
    expr: Any
    width: int


@dataclass(frozen=True)
class Symbolic:
    section: str
    offset: int
    width: int = 64


@dataclass(frozen=True)
class CallExpr:
    name: str
    args: tuple[Any, ...]
    width: int


@dataclass(eq=False)
class Assign:
    dst: Var
    src: Any


@dataclass(eq=False)
class Store:
    addr: Any
    value: Any
    width: int


@dataclass(eq=False)
class Branch:
    cond: Any
    target: int
    fallthrough: int


@dataclass(eq=False)
class Jump:
    target: int


@dataclass(eq=False)
class IndirectJump:
    target: Any


@dataclass(eq=False)
class Return:
    value: Any


@dataclass(eq=False)
class PhiStmt:
    dst: Var
    sources: dict[int, Var]


@dataclass(eq=False)
class Block:
    start: int
    insns: list[Insn]
    stmts: list[Any] = field(default_factory=list)
    succs: list[int] = field(default_factory=list)
    preds: list[int] = field(default_factory=list)


FLAGS = Var("flags", 0)
COND_OPS = {
    "je": "==", "jne": "!=", "jl": "<", "jge": ">=", "jle": "<=", "jg": ">",
    "jb": "<u", "jae": ">=u", "jbe": "<=u", "ja": ">u",
}
NEGATE = {
    "==": "!=", "!=": "==", "<": ">=", ">=": "<", "<=": ">", ">": "<=",
    "<u": ">=u", ">=u": "<u", "<=u": ">u", ">u": "<=u",
}
TERMINATORS = (Branch, Jump, Return, IndirectJump)


def family(name: str) -> str:
    for table in (REG64, REG32, REG16):
        if name in table:
            return REG64[table.index(name)]
    return name


def jump_target(insn: Insn) -> int | None:
    if insn.mnemonic in JCC_NAMES or (insn.mnemonic == "jmp" and isinstance(insn.operands[0], Rel)):
        return insn.operands[0].target
    return None


def ends_block(insn: Insn) -> bool:
    return insn.mnemonic in JCC_NAMES or insn.mnemonic in ("jmp", "ret")


def build_blocks(insns: list[Insn]) -> dict[int, Block]:
    start, end = insns[0].address, insns[-1].next_address
    leaders = {start}
    for insn in insns:
        target = jump_target(insn)
        if target is not None and start <= target < end:
            leaders.add(target)
        if ends_block(insn) and insn.next_address < end:
            leaders.add(insn.next_address)
    blocks: dict[int, Block] = {}
    current = None
    for insn in insns:
        if insn.address in leaders:
            current = Block(insn.address, [])
            blocks[insn.address] = current
        current.insns.append(insn)
    for block in blocks.values():
        last = block.insns[-1]
        target = jump_target(last)
        if last.mnemonic in JCC_NAMES:
            block.succs = [target, last.next_address]
        elif target is not None:
            block.succs = [target]
        elif ends_block(last):
            block.succs = []
        elif last.next_address < end:
            block.succs = [last.next_address]
    for block in blocks.values():
        for succ in block.succs:
            blocks[succ].preds.append(block.start)
    return blocks


def reachable(entry: int, succs: dict[int, list[int]]) -> set[int]:
    seen: set[int] = set()
    stack = [entry]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(succs.get(node, []))
    return seen


def reverse_postorder(entry: int, succs: dict[int, list[int]]) -> list[int]:
    order: list[int] = []
    seen: set[int] = set()

    def visit(node: int) -> None:
        seen.add(node)
        for succ in succs.get(node, []):
            if succ not in seen:
                visit(succ)
        order.append(node)

    visit(entry)
    order.reverse()
    return order


def immediate_dominators(entry: int, succs: dict[int, list[int]], preds: dict[int, list[int]]) -> dict[int, int]:
    rpo = reverse_postorder(entry, succs)
    position = {node: i for i, node in enumerate(rpo)}
    idom: dict[int, int] = {entry: entry}

    def intersect(a: int, b: int) -> int:
        while a != b:
            while position[a] > position[b]:
                a = idom[a]
            while position[b] > position[a]:
                b = idom[b]
        return a

    changed = True
    while changed:
        changed = False
        for node in rpo[1:]:
            candidates = [p for p in preds.get(node, []) if p in idom]
            new_idom = candidates[0]
            for p in candidates[1:]:
                new_idom = intersect(p, new_idom)
            if idom.get(node) != new_idom:
                idom[node] = new_idom
                changed = True
    return idom


def dominance_frontiers(idom: dict[int, int], preds: dict[int, list[int]]) -> dict[int, set[int]]:
    frontier: dict[int, set[int]] = {node: set() for node in idom}
    for node in idom:
        node_preds = preds.get(node, [])
        if len(node_preds) < 2:
            continue
        for p in node_preds:
            runner = p
            while runner != idom[node]:
                frontier[runner].add(node)
                runner = idom[runner]
    return frontier


def dominates(idom: dict[int, int], a: int, b: int) -> bool:
    while True:
        if a == b:
            return True
        if idom[b] == b:
            return False
        b = idom[b]


@dataclass
class LiftContext:
    obj: ElfObject
    signatures: dict[str, tuple[tuple[int, ...], int]]
    frame: bool = False


def local_name(disp: int) -> str:
    return f"local_{-disp:x}" if disp < 0 else f"arg_{disp:x}"


def lift_insn(insn: Insn, ctx: LiftContext) -> list[Any]:
    m, ops = insn.mnemonic, insn.operands

    def address_of(mem: Mem) -> Any:
        if mem.rip:
            relocation = ctx.obj.relocation_at(".text", insn.address + mem.disp_offset)
            if relocation is None:
                return Const(insn.next_address + mem.disp, 64)
            return Symbolic(relocation.symbol, relocation.addend + (insn.size - mem.disp_offset))
        expr: Any = Var(mem.base, 64) if mem.base else None
        if mem.index:
            scaled: Any = Var(mem.index, 64)
            if mem.scale != 1:
                scaled = Bin("*", scaled, Const(mem.scale, 64), 64)
            expr = scaled if expr is None else Bin("+", expr, scaled, 64)
        if mem.disp or expr is None:
            disp = Const(mem.disp, 64)
            expr = disp if expr is None else Bin("+", expr, disp, 64)
        return expr

    def is_slot(mem: Mem) -> bool:
        return ctx.frame and mem.base == "rbp" and mem.index is None and not mem.rip

    def read(operand: Any, width: int | None = None) -> Any:
        w = width or operand.width
        if isinstance(operand, Reg):
            return Var(family(operand.name), w)
        if isinstance(operand, Imm):
            return Const(operand.value, w)
        if is_slot(operand):
            return Var(local_name(operand.disp), w)
        return Load(address_of(operand), w)

    def write(operand: Any, expr: Any) -> Any:
        if isinstance(operand, Reg):
            return Assign(Var(family(operand.name), operand.width), expr)
        if is_slot(operand):
            return Assign(Var(local_name(operand.disp), operand.width), expr)
        return Store(address_of(operand), expr, operand.width)

    def same_register(a: Any, b: Any) -> bool:
        return isinstance(a, Reg) and isinstance(b, Reg) and family(a.name) == family(b.name)

    if m in ("push", "pop", "nop"):
        return []
    if m == "mov" and same_register(ops[0], Reg("rbp", 64)) and same_register(ops[1], Reg("rsp", 64)):
        ctx.frame = True
        return []
    if m in ("add", "sub") and isinstance(ops[0], Reg) and ops[0].name == "rsp":
        return []
    if m == "mov":
        return [write(ops[0], read(ops[1]))]
    if m == "movsxd":
        return [write(ops[0], Cast("sext", read(ops[1], 32), 64))]
    if m == "lea":
        expr = address_of(ops[1])
        if ops[0].width == 32:
            expr = Cast("trunc", expr, 32)
        return [write(ops[0], expr)]
    if m in ("add", "sub", "xor"):
        if m in ("sub", "xor") and same_register(ops[0], ops[1]):
            return [write(ops[0], Const(0, ops[0].width))]
        a, b = read(ops[0]), read(ops[1])
        op = {"add": "+", "sub": "-", "xor": "^"}[m]
        flags = Flags("cmp" if m == "sub" else m, a, b, ops[0].width)
        return [Assign(FLAGS, flags), write(ops[0], Bin(op, a, b, ops[0].width))]
    if m == "inc":
        a = read(ops[0])
        one = Const(1, a.width)
        return [Assign(FLAGS, Flags("inc", a, one, a.width)), write(ops[0], Bin("+", a, one, a.width))]
    if m in ("cmp", "test"):
        return [Assign(FLAGS, Flags(m, read(ops[0]), read(ops[1]), ops[0].width))]
    if m == "imul":
        return [write(ops[0], Bin("*", read(ops[1]), read(ops[2]), ops[0].width))]
    if m in ("sar", "shr"):
        op = ">>s" if m == "sar" else ">>u"
        return [write(ops[0], Bin(op, read(ops[0]), Const(ops[1].value, 8), ops[0].width))]
    if m == "cltd":
        return [Assign(Var("rdx", 32), SignFill(Var("rax", 32), 32))]
    if m == "cqto":
        return [Assign(Var("rdx", 64), SignFill(Var("rax", 64), 64))]
    if m == "idiv":
        w = ops[0].width
        dividend = Var("dividend", 2 * w)
        divisor = read(ops[0])
        return [
            Assign(dividend, Concat(Var("rdx", w), Var("rax", w), 2 * w)),
            Assign(Var("rax", w), Bin("/", dividend, divisor, w)),
            Assign(Var("rdx", w), Bin("%", dividend, divisor, w)),
        ]
    if m in JCC_NAMES:
        return [Branch(Cond(m, FLAGS), ops[0].target, insn.next_address)]
    if m == "jmp":
        if isinstance(ops[0], Rel):
            return [Jump(ops[0].target)]
        return [IndirectJump(read(ops[0], 64))]
    if m == "call":
        relocation = ctx.obj.relocation_at(".text", insn.address + 1)
        name = relocation.symbol if relocation else f"sub_{ops[0].target:x}"
        param_widths, result_width = ctx.signatures.get(name, ((), 32))
        args = tuple(Var(ARG_REGISTERS[i], w) for i, w in enumerate(param_widths))
        return [Assign(Var("rax", result_width), CallExpr(name, args, result_width))]
    if m == "ret":
        return [Return(Var("rax", 0))]
    raise DecodeError(f"0x{insn.address:x}: no lifting rule for {m}")


def children(expr: Any) -> list[Any]:
    if isinstance(expr, (Bin, Flags)):
        return [expr.left, expr.right]
    if isinstance(expr, (Cast, SignFill)):
        return [expr.expr]
    if isinstance(expr, Load):
        return [expr.addr]
    if isinstance(expr, Index):
        return [expr.base, expr.index]
    if isinstance(expr, Cond):
        return [expr.flags]
    if isinstance(expr, Concat):
        return [expr.high, expr.low]
    if isinstance(expr, CallExpr):
        return list(expr.args)
    return []


def rebuild(expr: Any, kids: list[Any]) -> Any:
    if isinstance(expr, (Bin, Flags)):
        return replace(expr, left=kids[0], right=kids[1])
    if isinstance(expr, (Cast, SignFill)):
        return replace(expr, expr=kids[0])
    if isinstance(expr, Load):
        return replace(expr, addr=kids[0])
    if isinstance(expr, Index):
        return replace(expr, base=kids[0], index=kids[1])
    if isinstance(expr, Cond):
        return replace(expr, flags=kids[0])
    if isinstance(expr, Concat):
        return replace(expr, high=kids[0], low=kids[1])
    if isinstance(expr, CallExpr):
        return replace(expr, args=tuple(kids))
    return expr


def rewrite(expr: Any, fn) -> Any:
    kids = [rewrite(k, fn) for k in children(expr)]
    return fn(rebuild(expr, kids))


def iter_nodes(expr: Any):
    yield expr
    for kid in children(expr):
        yield from iter_nodes(kid)


def variables(expr: Any) -> list[Var]:
    return [node for node in iter_nodes(expr) if isinstance(node, Var)]


def stmt_exprs(stmt: Any) -> list[Any]:
    if isinstance(stmt, Assign):
        return [stmt.src]
    if isinstance(stmt, Store):
        return [stmt.addr, stmt.value]
    if isinstance(stmt, Branch):
        return [stmt.cond]
    if isinstance(stmt, IndirectJump):
        return [stmt.target]
    if isinstance(stmt, Return):
        return [stmt.value]
    return []


def map_stmt(stmt: Any, fn) -> Any:
    if isinstance(stmt, Assign):
        stmt.src = fn(stmt.src)
    elif isinstance(stmt, Store):
        stmt.addr, stmt.value = fn(stmt.addr), fn(stmt.value)
    elif isinstance(stmt, Branch):
        stmt.cond = fn(stmt.cond)
    elif isinstance(stmt, IndirectJump):
        stmt.target = fn(stmt.target)
    elif isinstance(stmt, Return):
        stmt.value = fn(stmt.value)
    return stmt


def width_of(expr: Any) -> int:
    return getattr(expr, "width", 32)


@dataclass
class Function:
    name: str
    insns: list[Insn]
    blocks: dict[int, Block]
    entry: int
    idom: dict[int, int] = field(default_factory=dict)
    ipdom: dict[int, int] = field(default_factory=dict)
    def_width: dict[tuple[str, int], int] = field(default_factory=dict)
    params: list[str] = field(default_factory=list)
    param_widths: dict[str, int] = field(default_factory=dict)
    undefined_reads: list[str] = field(default_factory=list)
    web_names: dict[tuple[str, int], str] = field(default_factory=dict)
    web_types: dict[str, str] = field(default_factory=dict)
    return_type: str = "int"
    tables: dict[str, tuple[str, int]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def succs(self) -> dict[int, list[int]]:
        return {b.start: list(b.succs) for b in self.blocks.values()}

    def preds(self) -> dict[int, list[int]]:
        return {b.start: list(b.preds) for b in self.blocks.values()}

    def ordered_blocks(self) -> list[Block]:
        return [self.blocks[k] for k in sorted(self.blocks)]

    def statements(self) -> list[Any]:
        return [s for b in self.ordered_blocks() for s in b.stmts]


def insert_phis(fn: Function) -> None:
    frontier = dominance_frontiers(fn.idom, fn.preds())
    defsites: dict[str, set[int]] = {}
    for block in fn.blocks.values():
        for stmt in block.stmts:
            if isinstance(stmt, Assign):
                defsites.setdefault(stmt.dst.name, set()).add(block.start)
    for name, sites in defsites.items():
        has_phi: set[int] = set()
        work = list(sites)
        while work:
            node = work.pop()
            for y in frontier[node]:
                if y in has_phi:
                    continue
                has_phi.add(y)
                phi = PhiStmt(Var(name, 0), {p: Var(name, 0) for p in fn.blocks[y].preds})
                fn.blocks[y].stmts.insert(0, phi)
                if y not in sites:
                    work.append(y)


def rename(fn: Function) -> None:
    counters: dict[str, int] = {}
    stacks: dict[str, list[int]] = {}
    children_of: dict[int, list[int]] = {b: [] for b in fn.blocks}
    for node, parent in fn.idom.items():
        if node != parent:
            children_of[parent].append(node)

    def fresh(name: str, width: int) -> Var:
        counters[name] = counters.get(name, 0) + 1
        version = counters[name]
        stacks.setdefault(name, []).append(version)
        fn.def_width[(name, version)] = width
        return Var(name, width, version)

    def use(var: Var) -> Var:
        stack = stacks.get(var.name)
        if not stack:
            fn.def_width[(var.name, 0)] = max(fn.def_width.get((var.name, 0), 0), var.width)
            return Var(var.name, var.width, 0)
        return Var(var.name, var.width, stack[-1])

    def rename_uses(expr: Any) -> Any:
        return rewrite(expr, lambda e: use(e) if isinstance(e, Var) else e)

    def visit(block_id: int) -> None:
        block = fn.blocks[block_id]
        pushed: list[str] = []
        for stmt in block.stmts:
            if isinstance(stmt, PhiStmt):
                stmt.dst = fresh(stmt.dst.name, 0)
                pushed.append(stmt.dst.name)
                continue
            map_stmt(stmt, rename_uses)
            if isinstance(stmt, Assign):
                stmt.dst = fresh(stmt.dst.name, stmt.dst.width)
                pushed.append(stmt.dst.name)
        for succ in block.succs:
            for stmt in fn.blocks[succ].stmts:
                if isinstance(stmt, PhiStmt):
                    stmt.sources[block_id] = use(Var(stmt.dst.name, 0))
        for child in children_of[block_id]:
            visit(child)
        for name in pushed:
            stacks[name].pop()

    visit(fn.entry)
    changed = True
    while changed:
        changed = False
        for stmt in fn.statements():
            if isinstance(stmt, PhiStmt):
                width = max(fn.def_width.get((s.name, s.version), 0) for s in stmt.sources.values())
                key = (stmt.dst.name, stmt.dst.version)
                if width > fn.def_width[key]:
                    fn.def_width[key] = width
                    changed = True
    for stmt in fn.statements():
        if isinstance(stmt, PhiStmt):
            stmt.dst = Var(stmt.dst.name, fn.def_width[(stmt.dst.name, stmt.dst.version)], stmt.dst.version)
            stmt.sources = {p: Var(s.name, fn.def_width[(s.name, s.version)], s.version) for p, s in stmt.sources.items()}

    def cast_use(expr: Any) -> Any:
        if not isinstance(expr, Var):
            return expr
        def_width = fn.def_width.get((expr.name, expr.version), expr.width)
        if def_width == 0 or expr.width == 0:
            return Var(expr.name, def_width or expr.width, expr.version)
        if expr.width == def_width:
            return expr
        definition = Var(expr.name, def_width, expr.version)
        return Cast("zext" if expr.width > def_width else "trunc", definition, expr.width)

    for stmt in fn.statements():
        if not isinstance(stmt, PhiStmt):
            map_stmt(stmt, lambda e: rewrite(e, cast_use))


def magic_divisor(multiplier: int, shift: int) -> int | None:
    """Return d when ((long)x * multiplier) >> shift, corrected by the sign bit, equals x / d for every int x."""
    if multiplier <= 0 or shift < 32:
        return None
    power = 1 << shift
    for d in (power // multiplier, power // multiplier + 1):
        if d > 1 and multiplier == -(-power // d) and multiplier * d - power <= power >> 31:
            return d
    return None


def c_div(a: int, b: int) -> int:
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


def truncate(value: int, width: int) -> int:
    value &= (1 << width) - 1
    return value - (1 << width) if value >> (width - 1) else value


def make_simplifier(defs: dict[tuple[str, int], Any], recognize_division: bool):
    def resolve(expr: Any) -> Any:
        if isinstance(expr, Var) and (expr.name, expr.version) in defs:
            return defs[(expr.name, expr.version)]
        return expr

    def strip_trunc(expr: Any) -> Any:
        return expr.expr if isinstance(expr, Cast) and expr.kind == "trunc" else expr

    def division_pattern(expr: Any) -> Any:
        if not recognize_division or not isinstance(expr, Bin) or expr.op != "+":
            return None
        parts = [resolve(strip_trunc(expr.left)), resolve(strip_trunc(expr.right))]
        for quotient, sign in (parts, parts[::-1]):
            if not (isinstance(quotient, Bin) and quotient.op == ">>s" and isinstance(quotient.right, Const)):
                continue
            if not (isinstance(sign, Bin) and sign.op == ">>u" and isinstance(sign.right, Const) and sign.right.value == 63):
                continue
            product_a, product_b = resolve(quotient.left), resolve(sign.left)
            if product_a != product_b or not (isinstance(product_a, Bin) and product_a.op == "*"):
                continue
            operand, multiplier = product_a.left, product_a.right
            if not (isinstance(multiplier, Const) and isinstance(operand, Cast) and operand.kind == "sext"):
                continue
            d = magic_divisor(multiplier.value, quotient.right.value)
            if d is not None:
                return Bin("/", operand.expr, Const(d, 32), 32)
        return None

    def simplify(expr: Any) -> Any:
        if isinstance(expr, Cond) and isinstance(expr.flags, Flags):
            flags, op = expr.flags, COND_OPS[expr.cc]
            if flags.kind == "cmp":
                return Bin(op, flags.left, flags.right, 32)
            if flags.kind == "test":
                if flags.left == flags.right:
                    return Bin(op, flags.left, Const(0, flags.width), 32)
                return Bin(op, Bin("&", flags.left, flags.right, flags.width), Const(0, flags.width), 32)
        if isinstance(expr, Bin) and expr.op == "+" and isinstance(expr.right, Const) and expr.right.value < 0:
            return Bin("-", expr.left, Const(-expr.right.value, expr.right.width), expr.width)
        if isinstance(expr, Cast) and isinstance(expr.expr, Const):
            value = expr.expr.value
            if expr.kind == "zext":
                return Const(value & ((1 << expr.expr.width) - 1), expr.width)
            return Const(truncate(value, expr.width), expr.width)
        if isinstance(expr, Cast) and expr.kind == "trunc":
            inner = expr.expr
            if isinstance(inner, Cast) and inner.kind in ("zext", "sext") and inner.expr.width == expr.width:
                return inner.expr
            if isinstance(inner, Bin) and inner.op in ("+", "-", "*") and inner.width > expr.width:
                left = simplify(Cast("trunc", inner.left, expr.width))
                right = simplify(Cast("trunc", inner.right, expr.width))
                return simplify(Bin(inner.op, left, right, expr.width))
        if isinstance(expr, Concat) and isinstance(expr.high, SignFill) and expr.high.expr == expr.low:
            return expr.low
        if isinstance(expr, Load):
            addr = expr.addr
            if isinstance(addr, Bin) and addr.op == "+":
                for base, offset in ((addr.left, addr.right), (addr.right, addr.left)):
                    scaled = isinstance(offset, Bin) and offset.op == "*" and isinstance(offset.right, Const)
                    if scaled and offset.right.value * 8 == expr.width and isinstance(base, (Var, Symbolic)):
                        return Index(base, offset.left, expr.width)
        folded = division_pattern(expr)
        if folded is not None:
            return folded
        return expr

    return simplify


def count_uses(fn: Function) -> dict[tuple[str, int], list[tuple[int, Any]]]:
    uses: dict[tuple[str, int], list[tuple[int, Any]]] = {}
    for block in fn.blocks.values():
        for stmt in block.stmts:
            if isinstance(stmt, PhiStmt):
                for src in stmt.sources.values():
                    uses.setdefault((src.name, src.version), []).append((block.start, stmt))
                continue
            for expr in stmt_exprs(stmt):
                for var in variables(expr):
                    uses.setdefault((var.name, var.version), []).append((block.start, stmt))
    return uses


def has_side_effect(expr: Any) -> bool:
    return any(isinstance(node, CallExpr) for node in iter_nodes(expr))


def contains_load(expr: Any) -> bool:
    return any(isinstance(node, (Load, Index)) for node in iter_nodes(expr))


def stmt_has_side_effect(stmt: Any) -> bool:
    return isinstance(stmt, Store) or any(has_side_effect(e) for e in stmt_exprs(stmt))


def remove_dead_code(fn: Function, uses: dict[tuple[str, int], list[tuple[int, Any]]]) -> bool:
    changed = False
    for block in fn.blocks.values():
        kept = []
        for stmt in block.stmts:
            dead = isinstance(stmt, (Assign, PhiStmt)) and (stmt.dst.name, stmt.dst.version) not in uses
            if dead and not (isinstance(stmt, Assign) and has_side_effect(stmt.src)):
                changed = True
                continue
            kept.append(stmt)
        block.stmts = kept
    return changed


def substitute_once(fn: Function, uses: dict[tuple[str, int], list[tuple[int, Any]]]) -> bool:
    for block in fn.blocks.values():
        for position, stmt in enumerate(block.stmts):
            if not isinstance(stmt, Assign) or has_side_effect(stmt.src):
                continue
            users = uses.get((stmt.dst.name, stmt.dst.version), [])
            if len(users) != 1 or isinstance(users[0][1], PhiStmt):
                continue
            user_block, user = users[0]
            later = block.stmts[position + 1 :]
            same_block = user_block == block.start and any(user is s for s in later)
            constant_like = isinstance(stmt.src, (Const, Symbolic))
            if not (same_block or constant_like):
                continue
            if contains_load(stmt.src):
                between = later[: next(i for i, s in enumerate(later) if s is user)]
                if any(stmt_has_side_effect(s) for s in between):
                    continue
            target = stmt.dst
            map_stmt(user, lambda e: rewrite(e, lambda x: stmt.src if x == target else x))
            block.stmts.remove(stmt)
            return True
    return False


def optimize(fn: Function, recognize_division: bool, rounds: int = 400) -> None:
    for _ in range(rounds):
        defs = {(s.dst.name, s.dst.version): s.src for s in fn.statements() if isinstance(s, Assign)}
        simplify = make_simplifier(defs, recognize_division)
        for stmt in fn.statements():
            map_stmt(stmt, lambda e: rewrite(e, simplify))
        uses = count_uses(fn)
        if remove_dead_code(fn, uses):
            continue
        if not substitute_once(fn, uses):
            return


def live_keys(fn: Function) -> set[tuple[str, int]]:
    keys: set[tuple[str, int]] = set()
    for stmt in fn.statements():
        if isinstance(stmt, (Assign, PhiStmt)):
            keys.add((stmt.dst.name, stmt.dst.version))
        if isinstance(stmt, PhiStmt):
            keys.update((s.name, s.version) for s in stmt.sources.values())
        for expr in stmt_exprs(stmt):
            keys.update((v.name, v.version) for v in variables(expr))
    return keys


def collect_params(fn: Function) -> None:
    """System V psABI 3.2.3: the k-th INTEGER argument arrives in the k-th register of %rdi, %rsi, %rdx, %rcx, %r8, %r9."""
    entry_reads = {key for key in live_keys(fn) if key[1] == 0}
    used = [name for name, _ in entry_reads if name in ARG_REGISTERS]
    count = max((ARG_REGISTERS.index(name) for name in used), default=-1) + 1
    fn.params = ARG_REGISTERS[:count]
    fn.param_widths = {name: fn.def_width.get((name, 0), 64) for name in fn.params}
    fn.undefined_reads = sorted(name for name, _ in entry_reads if name not in ARG_REGISTERS)


def coalesce_webs(fn: Function) -> None:
    parent: dict[tuple[str, int], tuple[str, int]] = {}

    def find(key):
        parent.setdefault(key, key)
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key

    for key in live_keys(fn):
        find(key)
    for stmt in fn.statements():
        if isinstance(stmt, PhiStmt):
            for src in stmt.sources.values():
                root_a, root_b = find((stmt.dst.name, stmt.dst.version)), find((src.name, src.version))
                if root_a != root_b:
                    parent[root_a] = root_b
    webs: dict[tuple[str, int], list[tuple[str, int]]] = {}
    for key in list(parent):
        webs.setdefault(find(key), []).append(key)
    counters: dict[str, int] = {}
    for members in sorted(webs.values(), key=min):
        members.sort()
        width = max(fn.def_width.get(m, 0) for m in members)
        name, version = members[0]
        if name in fn.params and version == 0:
            label = f"param_{fn.params.index(name) + 1}"
        elif name.startswith("local_") or name.startswith("arg_"):
            label = name
        elif version == 0:
            label = f"undefined_{name}"
        else:
            register = name if width == 64 or name not in REG64 else REG32[REG64.index(name)]
            counters[register] = counters.get(register, 0) + 1
            label = f"{register}_{counters[register]}"
        for member in members:
            fn.web_names[member] = label
        fn.web_types[label] = "long" if width == 64 else "int"


def infer_types(fn: Function) -> None:
    aliases: dict[str, set[str]] = {}

    def link(a: str, b: str) -> None:
        group = aliases.setdefault(a, {a}) | aliases.setdefault(b, {b})
        for member in group:
            aliases[member] = group

    def web(var: Var) -> str:
        return fn.web_names[(var.name, var.version)]

    pointer_evidence: dict[str, str] = {}
    returned: list[int] = []
    for stmt in fn.statements():
        if isinstance(stmt, Assign) and isinstance(stmt.src, Var):
            link(web(stmt.dst), web(stmt.src))
        if isinstance(stmt, PhiStmt):
            for src in stmt.sources.values():
                link(web(stmt.dst), web(src))
        if isinstance(stmt, Return):
            returned.append(width_of(stmt.value))
        for expr in stmt_exprs(stmt):
            for node in iter_nodes(expr):
                if isinstance(node, Index) and isinstance(node.base, Var):
                    pointer_evidence[web(node.base)] = f"{ctype(node.width)} *"
    for label, pointer_type in pointer_evidence.items():
        for member in aliases.get(label, {label}):
            fn.web_types[member] = pointer_type
    if not returned:
        fn.return_type = "void"
    else:
        fn.return_type = "long" if max(returned) == 64 else "int"


PRECEDENCE = {
    "*": 13, "/": 13, "%": 13, "+": 12, "-": 12, "<<": 11, ">>s": 11, ">>u": 11,
    "<": 10, "<=": 10, ">": 10, ">=": 10, "<u": 10, "<=u": 10, ">u": 10, ">=u": 10,
    "==": 9, "!=": 9, "&": 8, "^": 7, "|": 6,
}


def ctype(width: int) -> str:
    return {8: "char", 16: "short", 32: "int", 64: "long"}[width]


def utype(width: int) -> str:
    return "unsigned " + ctype(width)


def declaration(type_name: str, label: str) -> str:
    return f"{type_name}{label}" if type_name.endswith("*") else f"{type_name} {label}"


class Emitter:
    def __init__(self, fn: Function):
        self.fn = fn

    def name(self, var: Var) -> str:
        return self.fn.web_names.get((var.name, var.version), f"{var.name}_{var.version}")

    def const(self, c: Const) -> str:
        return _const_text(c.value)

    def table_name(self, sym: Symbolic) -> str:
        label = f"lookup_{sym.offset:x}" if sym.section == ".rodata" else f"{sym.section.strip('.')}_{sym.offset:x}"
        self.fn.tables[label] = (sym.section, sym.offset)
        return label

    def wrap(self, text: str, prec: int, parent: int) -> str:
        return f"({text})" if prec < parent else text

    def unsigned(self, e: Any) -> str:
        if isinstance(e, Const):
            return self.const(e)
        return f"({utype(width_of(e))}){self.expr(e, 14)}"

    def expr(self, e: Any, parent: int = 0) -> str:
        if isinstance(e, Const):
            return self.const(e)
        if isinstance(e, Var):
            return self.name(e)
        if isinstance(e, Symbolic):
            return self.wrap(f"(long)&{self.table_name(e)}", 14, parent)
        if isinstance(e, Index):
            base = self.table_name(e.base) if isinstance(e.base, Symbolic) else self.expr(e.base, 20)
            return f"{base}[{self.expr(e.index)}]"
        if isinstance(e, Load):
            return f"*({ctype(e.width)} *)({self.expr(e.addr)})"
        if isinstance(e, Cast):
            inner = self.expr(e.expr, 14)
            if e.kind == "zext":
                return self.wrap(f"({utype(e.width)})({utype(e.expr.width)}){inner}", 14, parent)
            return self.wrap(f"({ctype(e.width)}){inner}", 14, parent)
        if isinstance(e, Bin):
            prec = PRECEDENCE[e.op]
            if e.op == ">>u":
                return self.wrap(f"{self.unsigned(e.left)} >> {self.expr(e.right, prec + 1)}", prec, parent)
            if e.op.endswith("u"):
                left, right = self.unsigned(e.left), self.unsigned(e.right)
                return self.wrap(f"{left} {e.op[:-1]} {right}", prec, parent)
            op = ">>" if e.op == ">>s" else e.op
            return self.wrap(f"{self.expr(e.left, prec)} {op} {self.expr(e.right, prec + 1)}", prec, parent)
        if isinstance(e, Concat):
            high, low = self.expr(e.high, 14), self.expr(e.low, 14)
            return f"(({ctype(e.width)}){high} << {e.low.width} | ({utype(e.low.width)}){low})"
        if isinstance(e, SignFill):
            return self.wrap(f"{self.expr(e.expr, 11)} >> {e.width - 1}", 11, parent)
        if isinstance(e, CallExpr):
            return f"{e.name}({', '.join(self.expr(a) for a in e.args)})"
        if isinstance(e, Flags):
            return f"flags_of_{e.kind}({self.expr(e.left)}, {self.expr(e.right)})"
        if isinstance(e, Cond):
            return f"{e.cc}({self.expr(e.flags)})"
        raise TypeError(type(e))

    def target_width(self, label: str) -> int:
        return 32 if self.fn.web_types.get(label, "int") == "int" else 64

    def assign(self, stmt: Assign) -> str:
        label = self.name(stmt.dst)
        width, src = self.target_width(label), stmt.src
        if isinstance(src, Const):
            return f"{label} = {self.const(src)};"
        if width_of(src) < width and not isinstance(src, Symbolic):
            return f"{label} = ({utype(width)})({utype(width_of(src))}){self.expr(src, 14)};"
        if width_of(src) > width:
            return f"{label} = ({ctype(width)}){self.expr(src, 14)};"
        return f"{label} = {self.expr(src)};"

    def plain(self, stmt: Any, uses: dict[tuple[str, int], Any]) -> str | None:
        if isinstance(stmt, Assign):
            if isinstance(stmt.src, CallExpr) and (stmt.dst.name, stmt.dst.version) not in uses:
                return f"{self.expr(stmt.src)};"
            return self.assign(stmt)
        if isinstance(stmt, Store):
            return f"*({ctype(stmt.width)} *)({self.expr(stmt.addr)}) = {self.expr(stmt.value)};"
        if isinstance(stmt, Return):
            return f"return {self.expr(stmt.value)};"
        if isinstance(stmt, IndirectJump):
            return f"goto *(void *){self.expr(stmt.target, 14)}; /* indirect jump: the target table is not resolved here */"
        return None


def negate(cond: Any) -> Any:
    if isinstance(cond, Bin) and cond.op in NEGATE:
        return Bin(NEGATE[cond.op], cond.left, cond.right, cond.width)
    return Bin("==", cond, Const(0, 32), 32)


def natural_loops(fn: Function) -> dict[int, set[int]]:
    preds = fn.preds()
    loops: dict[int, set[int]] = {}
    for block in fn.blocks.values():
        for succ in block.succs:
            if dominates(fn.idom, succ, block.start):
                body = {succ}
                stack = [block.start]
                while stack:
                    node = stack.pop()
                    if node in body:
                        continue
                    body.add(node)
                    stack.extend(preds[node])
                loops.setdefault(succ, set()).update(body)
    return loops


def post_dominators(fn: Function) -> dict[int, int]:
    succs, preds = fn.succs(), fn.preds()
    exits = [b for b, s in succs.items() if not s]
    reverse_succs = {b: list(p) for b, p in preds.items()}
    reverse_succs[EXIT] = exits
    reverse_preds = {b: list(s) + ([EXIT] if b in exits else []) for b, s in succs.items()}
    reverse_preds[EXIT] = []
    return immediate_dominators(EXIT, reverse_succs, reverse_preds)


def structure(fn: Function) -> list[str]:
    emitter = Emitter(fn)
    uses = count_uses(fn)
    succs = fn.succs()
    fn.ipdom = post_dominators(fn)
    loops = natural_loops(fn)
    lines: list[str] = []
    emitted: set[int] = set()

    def emit(text: str, depth: int) -> None:
        lines.append("  " * depth + text)

    def terminator(block: Block) -> Any:
        return block.stmts[-1] if block.stmts and isinstance(block.stmts[-1], TERMINATORS) else None

    def body(block: Block, depth: int) -> None:
        for stmt in block.stmts:
            if isinstance(stmt, (PhiStmt, Branch, Jump)):
                continue
            text = emitter.plain(stmt, uses)
            if text is not None:
                emit(text, depth)

    def region_size(start: int, stop: int) -> int:
        seen: set[int] = set()
        stack = [start]
        while stack:
            node = stack.pop()
            if node in seen or node == stop or node == EXIT:
                continue
            seen.add(node)
            stack.extend(succs[node])
        return len(seen)

    def walk(block_id: int, stop: int, depth: int) -> None:
        if block_id in (stop, EXIT) or block_id in emitted:
            return
        block = fn.blocks[block_id]
        if block_id in loops:
            emit_loop(block, stop, depth)
            return
        emitted.add(block_id)
        term = terminator(block)
        body(block, depth)
        if isinstance(term, Branch):
            emit_branch(block, term, stop, depth)
        elif isinstance(term, Jump):
            walk(term.target, stop, depth)
        elif term is None and block.succs:
            walk(block.succs[0], stop, depth)

    def emit_branch(block: Block, term: Branch, stop: int, depth: int) -> None:
        join = fn.ipdom[block.start]
        taken, fall = term.target, term.fallthrough
        if join == taken:
            emit(f"if ({emitter.expr(negate(term.cond))}) {{", depth)
            walk(fall, join, depth + 1)
            emit("}", depth)
            walk(join, stop, depth)
        elif join == fall:
            emit(f"if ({emitter.expr(term.cond)}) {{", depth)
            walk(taken, join, depth + 1)
            emit("}", depth)
            walk(join, stop, depth)
        elif join in (EXIT, stop):
            first, second, cond = taken, fall, term.cond
            if region_size(fall, join) < region_size(taken, join):
                first, second, cond = fall, taken, negate(term.cond)
            emit(f"if ({emitter.expr(cond)}) {{", depth)
            walk(first, join, depth + 1)
            emit("}", depth)
            walk(second, join, depth)
        else:
            emit(f"if ({emitter.expr(term.cond)}) {{", depth)
            walk(taken, join, depth + 1)
            emit("} else {", depth)
            walk(fall, join, depth + 1)
            emit("}", depth)
            walk(join, stop, depth)

    def emit_loop(header: Block, stop: int, depth: int) -> None:
        members = loops[header.start]
        exits = sorted({s for b in members for s in succs[b] if s not in members})
        exit_block = exits[0] if exits else EXIT
        term = terminator(header)
        emitted.add(header.start)
        self_loop = header.start in succs[header.start]
        header_exits = isinstance(term, Branch) and (term.target not in members or term.fallthrough not in members)
        if header_exits and not self_loop:
            cond = term.cond if term.fallthrough not in members else negate(term.cond)
            inner = term.target if term.target in members else term.fallthrough
            body(header, depth)
            emit(f"while ({emitter.expr(cond)}) {{", depth)
            walk(inner, header.start, depth + 1)
            emit("}", depth)
        else:
            latch = header if self_loop else fn.blocks[[b for b in members if header.start in succs[b]][0]]
            latch_term = terminator(latch)
            emit("do {", depth)
            body(header, depth + 1)
            if latch is not header:
                for succ in header.succs:
                    walk(succ, latch.start, depth + 1)
                emitted.add(latch.start)
                body(latch, depth + 1)
            cond = latch_term.cond if latch_term.target == header.start else negate(latch_term.cond)
            emit(f"}} while ({emitter.expr(cond)});", depth)
        walk(exit_block, stop, depth)

    walk(fn.entry, EXIT, 1)
    return lines


class IrPrinter:
    def __init__(self, fn: Function, versions: bool):
        self.fn = fn
        self.versions = versions

    def var(self, v: Var) -> str:
        if v.name in REG64:
            width = v.width or self.fn.def_width.get((v.name, v.version), 64)
            index = REG64.index(v.name)
            name = REG32[index] if width == 32 else REG16[index] if width == 16 else v.name
        else:
            name = v.name
        return f"{name}_{v.version}" if self.versions and v.version >= 0 else name

    def expr(self, e: Any) -> str:
        if isinstance(e, Const):
            return _const_text(e.value)
        if isinstance(e, Var):
            return self.var(e)
        if isinstance(e, Bin):
            return f"{self.expr(e.left)} {e.op} {self.expr(e.right)}"
        if isinstance(e, Cast):
            return f"{e.kind}{e.width}({self.expr(e.expr)})"
        if isinstance(e, Load):
            return f"load{e.width}({self.expr(e.addr)})"
        if isinstance(e, Index):
            return f"{self.expr(e.base)}[{self.expr(e.index)}]"
        if isinstance(e, Flags):
            return f"{e.kind}({self.expr(e.left)}, {self.expr(e.right)})"
        if isinstance(e, Cond):
            return f"{e.cc}({self.expr(e.flags)})"
        if isinstance(e, Concat):
            return f"{self.expr(e.high)}:{self.expr(e.low)}"
        if isinstance(e, SignFill):
            return f"signfill({self.expr(e.expr)})"
        if isinstance(e, Symbolic):
            return f"&{e.section}+0x{e.offset:x}"
        if isinstance(e, CallExpr):
            return f"call {e.name}({', '.join(self.expr(a) for a in e.args)})"
        raise TypeError(type(e))

    def stmt(self, s: Any) -> str:
        if isinstance(s, Assign):
            return f"{self.var(s.dst)} = {self.expr(s.src)}"
        if isinstance(s, PhiStmt):
            inner = ", ".join(f"0x{p:x}: {self.var(v)}" for p, v in sorted(s.sources.items()))
            return f"{self.var(s.dst)} = phi({inner})"
        if isinstance(s, Store):
            return f"store{s.width}({self.expr(s.addr)}) = {self.expr(s.value)}"
        if isinstance(s, Branch):
            return f"if {self.expr(s.cond)} goto 0x{s.target:x} else goto 0x{s.fallthrough:x}"
        if isinstance(s, Jump):
            return f"goto 0x{s.target:x}"
        if isinstance(s, IndirectJump):
            return f"goto *{self.expr(s.target)}"
        if isinstance(s, Return):
            return f"return {self.expr(s.value)}"
        raise TypeError(type(s))

    def dump(self) -> str:
        lines = []
        for block in self.fn.ordered_blocks():
            succs = ", ".join(f"0x{s:x}" for s in block.succs) or "exit"
            lines.append(f"block 0x{block.start:x} -> {succs}")
            for stmt in block.stmts:
                lines.append(f"  {self.stmt(stmt)}")
        return "\n".join(lines)


def table_values(obj: ElfObject, section: str, offset: int, width: int) -> list[int]:
    """Read the table at `offset`; it ends where the next referenced address or the section ends."""
    data = obj.section(section).data
    referenced = {
        r.addend + 4
        for r in obj.relocations.get(".text", [])
        if r.symbol == section and r.type == R_X86_64_PC32
    }
    end = min(t for t in referenced | {len(data)} if t > offset)
    size = width // 8
    count = (end - offset) // size
    return [int.from_bytes(data[offset + i * size : offset + (i + 1) * size], "little", signed=True) for i in range(count)]


@dataclass
class Lifted:
    function: Function
    decoded: list[Insn]
    ir_text: str
    ssa_text: str
    pseudocode: str
    data_definitions: list[str]

    @property
    def unit(self) -> str:
        return "\n".join(self.data_definitions + [self.pseudocode])


def lift_function(
    obj: ElfObject,
    name: str,
    signatures: dict[str, tuple[tuple[int, ...], int]] | None = None,
    recognize_division: bool = True,
) -> Lifted:
    symbol = obj.function(name)
    text = obj.section(".text").data
    decoded = decode_range(text, symbol.value, obj.function_end(symbol))
    insns = list(decoded)
    while len(insns) > 1 and insns[-1].mnemonic == "nop" and insns[-1].address >= symbol.value + symbol.size:
        insns.pop()
    blocks = build_blocks(insns)
    fn = Function(name, insns, blocks, symbol.value)
    ctx = LiftContext(obj, signatures or {})
    for block in fn.ordered_blocks():
        for insn in block.insns:
            block.stmts.extend(lift_insn(insn, ctx))
    live = reachable(fn.entry, fn.succs())
    dropped = sorted(b for b in fn.blocks if b not in live)
    if dropped:
        fn.notes.append(
            f"{len(dropped)} block(s) at {', '.join(f'0x{b:x}' for b in dropped)} are reached only through an indirect jump and were not lifted"
        )
        fn.blocks = {b: blk for b, blk in fn.blocks.items() if b in live}
        for block in fn.blocks.values():
            block.preds = [p for p in block.preds if p in live]
    fn.idom = immediate_dominators(fn.entry, fn.succs(), fn.preds())
    ir_text = IrPrinter(fn, versions=False).dump()
    insert_phis(fn)
    rename(fn)
    ssa_text = IrPrinter(fn, versions=True).dump()
    optimize(fn, recognize_division)
    collect_params(fn)
    coalesce_webs(fn)
    infer_types(fn)
    body = structure(fn)
    emitter = Emitter(fn)
    table_widths: dict[str, int] = {}
    for stmt in fn.statements():
        for expr in stmt_exprs(stmt):
            for node in iter_nodes(expr):
                if isinstance(node, Index) and isinstance(node.base, Symbolic):
                    table_widths[emitter.table_name(node.base)] = node.width
    data_definitions = []
    for label, (section, offset) in sorted(fn.tables.items(), key=lambda kv: kv[1]):
        width = table_widths.get(label, 32)
        values = table_values(obj, section, offset, width)
        data_definitions.append(f"static const {ctype(width)} {label}[{len(values)}] = {{{', '.join(map(str, values))}}};")
    params = ", ".join(declaration(fn.web_types.get(f"param_{i + 1}", "long"), f"param_{i + 1}") for i in range(len(fn.params)))
    used = {emitter.name(v) for s in fn.statements() for e in stmt_exprs(s) for v in variables(e)}
    used |= {emitter.name(s.dst) for s in fn.statements() if isinstance(s, (Assign, PhiStmt))}
    declared = sorted(n for n in used if not n.startswith("param_"))
    header = [f"{fn.return_type} {name}({params or 'void'})", "{"]
    header.extend(f"  {declaration(fn.web_types.get(label, 'int'), label)};" for label in declared)
    header.extend(f"  /* {note} */" for note in fn.notes)
    if declared or fn.notes:
        header.append("")
    pseudocode = "\n".join(header + body + ["}"])
    return Lifted(fn, decoded, ir_text, ssa_text, pseudocode, data_definitions)


def lift_all(obj: ElfObject, recognize_division: bool = True) -> dict[str, Lifted]:
    signatures: dict[str, tuple[tuple[int, ...], int]] = {}
    results: dict[str, Lifted] = {}
    for symbol in obj.functions():
        lifted = lift_function(obj, symbol.name, signatures, recognize_division)
        fn = lifted.function
        widths = tuple(fn.def_width[(p, 0)] for p in fn.params)
        signatures[symbol.name] = (widths, 64 if fn.return_type == "long" else 32)
        results[symbol.name] = lifted
    return results


def ghidra_pseudocode(name: str) -> str:
    record = json.loads((FIXTURES / "ghidra" / f"{name}.json").read_text(encoding="utf-8"))
    return record["raw_result"]["value"].strip("\n")


def compare_with_objdump(lifted: dict[str, Lifted], objdump_text: str) -> list[str]:
    objdump = parse_objdump(objdump_text)
    mismatches = []
    for name, result in lifted.items():
        expected = objdump[name]
        if len(expected) != len(result.decoded):
            mismatches.append(f"{name}: {len(result.decoded)} decoded instructions, objdump lists {len(expected)}")
        for insn, (address, raw, asm) in zip(result.decoded, expected):
            if (insn.address, insn.raw, insn.att()) != (address, raw, asm):
                mismatches.append(f"0x{insn.address:x}: ours={insn.att()!r} objdump={asm!r}")
    return mismatches


def side_by_side(left: str, right: str, left_title: str, right_title: str, width: int = 46) -> str:
    left_lines, right_lines = left.splitlines(), right.splitlines()
    rows = [f"{left_title:<{width}} | {right_title}", f"{'-' * width}-+-{'-' * width}"]
    for i in range(max(len(left_lines), len(right_lines))):
        a = left_lines[i] if i < len(left_lines) else ""
        b = right_lines[i] if i < len(right_lines) else ""
        rows.append(f"{a:<{width}} | {b}")
    return "\n".join(rows)


def demo() -> None:
    o1 = read_object(FIXTURES / "ledger-x86_64-O1.o")
    o0 = read_object(FIXTURES / "ledger-x86_64-O0.o")
    lifted = lift_all(o1)
    mismatches = compare_with_objdump(lifted, (FIXTURES / "ledger-x86_64-O1.objdump.txt").read_text(encoding="utf-8"))
    decoded = sum(len(v.decoded) for v in lifted.values())
    print(f"== ledger-x86_64-O1.o: {decoded} instructions decoded, {len(mismatches)} differences from llvm-objdump ==")
    for line in mismatches:
        print("  " + line)
    for name in ("percent_change", "grade", "total"):
        print(f"\n== {name} at -O1: IR before SSA ==")
        print(lifted[name].ir_text)
        print(f"-- {name}: SSA with phi functions --")
        print(lifted[name].ssa_text)
        print(f"-- {name}: our pseudocode next to Ghidra 12.1.4 through rea 6.5.0 --")
        print(side_by_side(lifted[name].unit, ghidra_pseudocode(name), "lifter", "ghidra"))
    print("\n== grade at -O1 with division recognition switched off ==")
    print(lift_all(o1, recognize_division=False)["grade"].pseudocode)
    print("\n== ledger-x86_64-O0.o: stack slots become local variables ==")
    o0_lifted = lift_all(o0)
    for name in ("percent_change", "total", "grade_label"):
        print(o0_lifted[name].pseudocode)
        print()
    summary = {
        "functions": sorted(lifted),
        "instructions": decoded,
        "blocks": {name: len(v.function.blocks) for name, v in lifted.items()},
        "phis": {name: sum(isinstance(s, PhiStmt) for s in v.function.statements()) for name, v in lifted.items()},
        "objdumpDifferences": len(mismatches),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    demo()
