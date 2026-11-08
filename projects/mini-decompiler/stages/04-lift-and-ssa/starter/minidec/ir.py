
from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from .cfg import FunctionGraph, JumpTable
from .decoder import REGISTERS, Imm, IndirectOperand, Instruction, Mem, Reg
from .elf import ElfObject, relocation_target

ARG_REGISTERS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"]
REG64 = REGISTERS[64]
REG32 = REGISTERS[32]
REG16 = REGISTERS[16]
REG8 = REGISTERS[8]
EXIT = -1


class LiftError(ValueError):
    pass


@dataclass(frozen=True)
class Const:
    value: int
    width: int


@dataclass(frozen=True)
class Var:
    name: str
    width: int
    version: int = -1

    @property
    def key(self) -> tuple[str, int]:
        return (self.name, self.version)


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
class Field:
    base: Any
    offset: int
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
    place: Any = None


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
    table: JumpTable | None = None
    index: Any = None


@dataclass(eq=False)
class Return:
    value: Any


@dataclass(eq=False)
class Phi:
    dst: Var
    sources: dict[int, Var]


TERMINATORS = (Branch, Jump, Return, IndirectJump)
FLAGS = Var("flags", 0)
COND_OPS = {
    "e": "==", "ne": "!=", "l": "<", "ge": ">=", "le": "<=", "g": ">",
    "b": "<u", "ae": ">=u", "be": "<=u", "a": ">u", "s": "<", "ns": ">=",
}
SIGNED_CONDITIONS = {"l", "ge", "le", "g", "s", "ns"}
UNSIGNED_CONDITIONS = {"b", "ae", "be", "a"}


@dataclass(eq=False)
class IRBlock:
    start: int
    instructions: list[Instruction]
    stmts: list[Any] = field(default_factory=list)
    succs: list[int] = field(default_factory=list)
    preds: list[int] = field(default_factory=list)


@dataclass
class Function:
    name: str
    entry: int
    blocks: dict[int, IRBlock]
    graph: FunctionGraph | None = None
    idom: dict[int, int] = field(default_factory=dict)
    ipdom: dict[int, int] = field(default_factory=dict)
    def_width: dict[tuple[str, int], int] = field(default_factory=dict)
    frame_pointer: bool = False
    params: list[str] = field(default_factory=list)
    param_widths: dict[str, int] = field(default_factory=dict)
    undefined_reads: list[str] = field(default_factory=list)
    web_names: dict[tuple[str, int], str] = field(default_factory=dict)
    web_types: dict[str, str] = field(default_factory=dict)
    return_type: str = "int"
    tables: dict[str, tuple[str, int]] = field(default_factory=dict)
    structs: dict[str, dict[int, int]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    signedness: dict[str, list[str]] = field(default_factory=dict)
    divisions: list[dict[str, int]] = field(default_factory=list)

    def succs(self) -> dict[int, list[int]]:
        return {b.start: list(b.succs) for b in self.blocks.values()}

    def preds(self) -> dict[int, list[int]]:
        return {b.start: list(b.preds) for b in self.blocks.values()}

    def ordered_blocks(self) -> list[IRBlock]:
        return [self.blocks[k] for k in sorted(self.blocks)]

    def statements(self) -> list[Any]:
        return [s for b in self.ordered_blocks() for s in b.stmts]


def family(name: str) -> str:
    for table in (REG64, REG32, REG16, REG8):
        if name in table:
            return REG64[table.index(name)]
    return name


def local_name(disp: int) -> str:
    return f"local_{-disp:x}" if disp < 0 else f"arg_{disp:x}"


@dataclass
class LiftContext:
    elf: ElfObject
    tables: dict[int, JumpTable] = field(default_factory=dict)
    signatures: dict[str, tuple[tuple[int, ...], int]] = field(default_factory=dict)
    frame: bool = False
    section: str = ".text"
    signedness: dict[str, list[str]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def evidence(self, kind: str, insn: Instruction) -> None:
        self.signedness.setdefault(kind, []).append(f"0x{insn.address:x} {insn.text.replace(chr(9), ' ')}")


def lift_instruction(insn: Instruction, ctx: LiftContext) -> list[Any]:
    raise NotImplementedError("Stage 4: implement lift_instruction")


def children(expr: Any) -> list[Any]:
    if isinstance(expr, (Bin, Flags)):
        return [expr.left, expr.right]
    if isinstance(expr, (Cast, SignFill)):
        return [expr.expr]
    if isinstance(expr, Load):
        return [expr.addr]
    if isinstance(expr, Index):
        return [expr.base, expr.index]
    if isinstance(expr, Field):
        return [expr.base]
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
    if isinstance(expr, Field):
        return replace(expr, base=kids[0])
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
        return [stmt.index] if stmt.table is not None and stmt.index is not None else [stmt.target]
    if isinstance(stmt, Return):
        return [stmt.value]
    return []


def map_stmt(stmt: Any, fn) -> Any:
    if isinstance(stmt, Assign):
        stmt.src = fn(stmt.src)
    elif isinstance(stmt, Store):
        stmt.addr, stmt.value = fn(stmt.addr), fn(stmt.value)
        if stmt.place is not None:
            stmt.place = fn(stmt.place)
    elif isinstance(stmt, Branch):
        stmt.cond = fn(stmt.cond)
    elif isinstance(stmt, IndirectJump):
        stmt.target = fn(stmt.target)
        if stmt.index is not None:
            stmt.index = fn(stmt.index)
    elif isinstance(stmt, Return):
        stmt.value = fn(stmt.value)
    return stmt


def width_of(expr: Any) -> int:
    return getattr(expr, "width", 32)


def lift_function(elf: ElfObject, graph: FunctionGraph, signatures: dict[str, tuple[tuple[int, ...], int]] | None = None) -> Function:
    raise NotImplementedError("Stage 4: implement lift_function")


def const_text(value: int) -> str:
    if abs(value) >= 0x10000:
        return f"-0x{-value:x}" if value < 0 else f"0x{value:x}"
    return str(value)


class IrPrinter:

    def __init__(self, fn: Function, versions: bool) -> None:
        self.fn = fn
        self.versions = versions

    def var(self, v: Var) -> str:
        if v.name in REG64:
            width = v.width or self.fn.def_width.get((v.name, v.version), 64)
            index = REG64.index(v.name)
            name = {64: REG64, 32: REG32, 16: REG16, 8: REG8}.get(width, REG64)[index]
        else:
            name = v.name
        return f"{name}_{v.version}" if self.versions and v.version >= 0 else name

    def expr(self, e: Any) -> str:
        if isinstance(e, Const):
            return const_text(e.value)
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
        if isinstance(e, Field):
            return f"{self.expr(e.base)}->field_{e.offset:x}"
        if isinstance(e, Flags):
            return f"{e.kind}({self.expr(e.left)}, {self.expr(e.right)})"
        if isinstance(e, Cond):
            return f"j{e.cc}({self.expr(e.flags)})"
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
        if isinstance(s, Phi):
            inner = ", ".join(f"0x{p:x}: {self.var(v)}" for p, v in sorted(s.sources.items()))
            return f"{self.var(s.dst)} = phi({inner})"
        if isinstance(s, Store):
            return f"store{s.width}({self.expr(s.addr)}) = {self.expr(s.value)}"
        if isinstance(s, Branch):
            return f"if {self.expr(s.cond)} goto 0x{s.target:x} else goto 0x{s.fallthrough:x}"
        if isinstance(s, Jump):
            return f"goto 0x{s.target:x}"
        if isinstance(s, IndirectJump):
            if s.table is not None:
                return f"switch {self.expr(s.index)} via {s.table.section}+0x{s.table.offset:x}"
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
