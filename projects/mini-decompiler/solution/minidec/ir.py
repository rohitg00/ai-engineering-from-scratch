
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
    op, ops = insn.op, insn.operands

    def address_of(mem: Mem) -> Any:
        if mem.rip:
            relocation = ctx.elf.relocation_at(ctx.section, insn.address + (mem.disp_offset or 0))
            if relocation is None:
                return Const(insn.end + mem.disp, 64)
            target = relocation_target(relocation, insn.end)
            return Symbolic(target.section, target.offset)
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
        if isinstance(operand, IndirectOperand):
            operand = operand.inner
        w = width or operand.width
        if isinstance(operand, Reg):
            return Var(family(operand.name), w)
        if isinstance(operand, Imm):
            return Const(operand.value, w)
        if isinstance(operand, Mem):
            if is_slot(operand):
                return Var(local_name(operand.disp), w)
            return Load(address_of(operand), w)
        raise LiftError(f"0x{insn.address:x}: cannot read operand {operand!r}")

    def write(operand: Any, expr: Any) -> Any:
        if isinstance(operand, Reg):
            return Assign(Var(family(operand.name), operand.width), expr)
        if isinstance(operand, Mem):
            if is_slot(operand):
                return Assign(Var(local_name(operand.disp), operand.width), expr)
            return Store(address_of(operand), expr, operand.width)
        raise LiftError(f"0x{insn.address:x}: cannot write operand {operand!r}")

    def same_register(a: Any, b: Any) -> bool:
        return isinstance(a, Reg) and isinstance(b, Reg) and family(a.name) == family(b.name)

    def is_rsp(operand: Any) -> bool:
        return isinstance(operand, Reg) and operand.name == "rsp"

    if op in ("push", "pop", "nop"):
        return []
    if op == "mov" and same_register(ops[1], Reg("rbp", 64)) and same_register(ops[0], Reg("rsp", 64)):
        ctx.frame = True
        return []
    if op in ("add", "sub") and is_rsp(ops[1]):
        return []
    captured: list[Any] = []
    for table in ctx.tables.values():
        if table.load_instruction == insn.address and table.is_jump_table:
            captured.append(Assign(Var("switch_index", 64), Var(table.index_register, 64)))
    if op == "mov":
        return captured + [write(ops[1], read(ops[0]))]
    if op == "movsxd":
        ctx.evidence("signed", insn)
        return captured + [write(ops[1], Cast("sext", read(ops[0], 32), 64))]
    if op == "movsx":
        ctx.evidence("signed", insn)
        return [write(ops[1], Cast("sext", read(ops[0], insn.source_width or 8), insn.width))]
    if op == "movzx":
        ctx.evidence("unsigned", insn)
        return [write(ops[1], Cast("zext", read(ops[0], insn.source_width or 8), insn.width))]
    if op == "lea":
        expr = address_of(ops[0])
        if ops[1].width == 32:
            expr = Cast("trunc", expr, 32)
        return [write(ops[1], expr)]
    if op in ("add", "sub", "and", "or", "xor"):
        if op in ("sub", "xor") and same_register(ops[0], ops[1]):
            return [write(ops[1], Const(0, ops[1].width))]
        source, destination = read(ops[0]), read(ops[1])
        symbol = {"add": "+", "sub": "-", "and": "&", "or": "|", "xor": "^"}[op]
        kind = "cmp" if op == "sub" else op
        return [Assign(FLAGS, Flags(kind, destination, source, insn.width)), write(ops[1], Bin(symbol, destination, source, insn.width))]
    if op in ("inc", "dec"):
        value = read(ops[0])
        one = Const(1, insn.width)
        return [Assign(FLAGS, Flags(op, value, one, insn.width)), write(ops[0], Bin("+" if op == "inc" else "-", value, one, insn.width))]
    if op == "neg":
        value = read(ops[0])
        return [Assign(FLAGS, Flags("cmp", Const(0, insn.width), value, insn.width)), write(ops[0], Bin("-", Const(0, insn.width), value, insn.width))]
    if op == "not":
        return [write(ops[0], Bin("^", read(ops[0]), Const(-1, insn.width), insn.width))]
    if op in ("cmp", "test"):
        return [Assign(FLAGS, Flags(op, read(ops[1]), read(ops[0]), insn.width))]
    if op == "imul":
        if len(ops) == 3:
            return [write(ops[2], Bin("*", read(ops[1]), read(ops[0]), insn.width))]
        return [write(ops[1], Bin("*", read(ops[1]), read(ops[0]), insn.width))]
    if op in ("shl", "shr", "sar"):
        symbol = {"shl": "<<", "shr": ">>u", "sar": ">>s"}[op]
        if op != "shl":
            ctx.evidence("signed" if op == "sar" else "unsigned", insn)
        return [write(ops[1], Bin(symbol, read(ops[1]), Const(ops[0].value, 8), insn.width))]
    if op == "cdq":
        ctx.evidence("signed", insn)
        return [Assign(Var("rdx", insn.width), SignFill(Var("rax", insn.width), insn.width))]
    if op in ("idiv", "div"):
        w = insn.width
        signed = op == "idiv"
        ctx.evidence("signed" if signed else "unsigned", insn)
        dividend = Var("dividend", 2 * w)
        divisor = read(ops[0])
        quotient, remainder = ("/", "%") if signed else ("/u", "%u")
        return [
            Assign(dividend, Concat(Var("rdx", w), Var("rax", w), 2 * w)),
            Assign(Var("rax", w), Bin(quotient, dividend, divisor, w)),
            Assign(Var("rdx", w), Bin(remainder, dividend, divisor, w)),
        ]
    if op == "jcc":
        if insn.cc in SIGNED_CONDITIONS:
            ctx.evidence("signed", insn)
        elif insn.cc in UNSIGNED_CONDITIONS:
            ctx.evidence("unsigned", insn)
        if insn.cc not in COND_OPS:
            raise LiftError(f"0x{insn.address:x}: no lifting rule for condition {insn.cc}")
        return [Branch(Cond(insn.cc, FLAGS), insn.target, insn.end)]
    if op == "jmp":
        if insn.flow == "jump":
            return [Jump(insn.target)]
        table = ctx.tables.get(insn.address)
        index = Var("switch_index", 64) if table else None
        return [IndirectJump(read(ops[0], 64), table, index)]
    if op == "call":
        relocation = ctx.elf.relocation_at(ctx.section, insn.address + (insn.immediate_offset or 1))
        if insn.flow == "indirect-call":
            name = "indirect_call"
        else:
            name = relocation.symbol_name if relocation else f"sub_{insn.target:x}"
        param_widths, result_width = ctx.signatures.get(name, ((), 32))
        if name not in ctx.signatures:
            ctx.notes.append(f"call to {name} at 0x{insn.address:x} has no recovered signature; arguments are unknown")
        args = tuple(Var(ARG_REGISTERS[i], w) for i, w in enumerate(param_widths))
        return [Assign(Var("rax", result_width), CallExpr(name, args, result_width))]
    if op == "ret":
        return [Return(Var("rax", 0))]
    raise LiftError(f"0x{insn.address:x}: no lifting rule for {insn.text}")


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
    cfg = graph.cfg
    reachable = cfg.reachable()
    blocks: dict[int, IRBlock] = {}
    for start in sorted(cfg.blocks):
        if start in reachable:
            block = cfg.blocks[start]
            blocks[start] = IRBlock(start, list(block.instructions), [], [t for t in cfg.successors(start) if t in reachable], [p for p in cfg.predecessors(start) if p in reachable])
    fn = Function(graph.name, graph.start, blocks, graph)
    ctx = LiftContext(elf, dict(graph.descent.tables), signatures or {})
    for block in fn.ordered_blocks():
        for insn in block.instructions:
            block.stmts.extend(lift_instruction(insn, ctx))
    fn.frame_pointer = ctx.frame
    fn.signedness = ctx.signedness
    fn.notes.extend(ctx.notes)
    dropped = sorted(b for b in cfg.blocks if b not in reachable)
    if dropped:
        fn.notes.append(f"{len(dropped)} block(s) at {', '.join(f'0x{b:x}' for b in dropped)} are unreachable from the entry and were not lifted")
    for address in cfg.unresolved:
        fn.notes.append(f"indirect jump at 0x{address:x} has no recovered table; its targets are unknown")
    fn.idom = cfg.dominators()
    return fn


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
