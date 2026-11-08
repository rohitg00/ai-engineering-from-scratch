
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .cfg import FunctionGraph, build_cfg
from .elf import ElfObject
from .ir import (
    Assign,
    Bin,
    CallExpr,
    Cast,
    Concat,
    Cond,
    Const,
    Field,
    Flags,
    Function,
    Index,
    IndirectJump,
    IrPrinter,
    Load,
    Phi,
    Return,
    SignFill,
    Store,
    Symbolic,
    Var,
    const_text,
    iter_nodes,
    lift_function,
    stmt_exprs,
    variables,
    width_of,
)
from .passes import OptimizeReport, count_uses, optimize
from .ssa import to_ssa
from .structure import structure
from .types import Signature, ctype, declaration, recover_signature, utype

PRECEDENCE = {
    "*": 13, "/": 13, "%": 13, "/u": 13, "%u": 13, "+": 12, "-": 12, "<<": 11, ">>s": 11, ">>u": 11,
    "<": 10, "<=": 10, ">": 10, ">=": 10, "<u": 10, "<=u": 10, ">u": 10, ">=u": 10,
    "==": 9, "!=": 9, "&": 8, "^": 7, "|": 6,
}


class Emitter:

    def __init__(self, fn: Function) -> None:
        self.fn = fn

    def name(self, var: Var) -> str:
        return self.fn.web_names.get(var.key, f"{var.name}_{var.version}")

    def type_of(self, label: str) -> str:
        return self.fn.web_types.get(label, "int")

    def is_unsigned(self, e: Any) -> bool:
        return isinstance(e, Var) and self.type_of(self.name(e)).startswith("unsigned")

    def table_name(self, sym: Symbolic) -> str:
        label = f"lookup_{sym.offset:x}" if sym.section == ".rodata" else f"{sym.section.strip('.').replace('.', '_')}_{sym.offset:x}"
        self.fn.tables[label] = (sym.section, sym.offset)
        return label

    @staticmethod
    def wrap(text: str, prec: int, parent: int) -> str:
        return f"({text})" if prec < parent else text

    def unsigned(self, e: Any) -> str:
        if isinstance(e, Const):
            return const_text(e.value & ((1 << e.width) - 1)) if e.value < 0 else const_text(e.value)
        if self.is_unsigned(e):
            return self.expr(e, 14)
        return f"({utype(width_of(e))}){self.expr(e, 14)}"

    def expr(self, e: Any, parent: int = 0) -> str:
        if isinstance(e, Const):
            return const_text(e.value)
        if isinstance(e, Var):
            return self.name(e)
        if isinstance(e, Symbolic):
            return self.wrap(f"(long)&{self.table_name(e)}", 14, parent)
        if isinstance(e, Index):
            base = self.table_name(e.base) if isinstance(e.base, Symbolic) else self.expr(e.base, 20)
            return f"{base}[{self.expr(e.index)}]"
        if isinstance(e, Field):
            return f"{self.expr(e.base, 20)}->field_{e.offset:x}"
        if isinstance(e, Load):
            return f"*({ctype(e.width)} *)({self.expr(e.addr)})"
        if isinstance(e, Cast):
            inner = self.expr(e.expr, 14)
            if e.kind == "zext":
                if self.is_unsigned(e.expr):
                    return self.wrap(f"({utype(e.width)}){inner}", 14, parent)
                return self.wrap(f"({utype(e.width)})({utype(e.expr.width)}){inner}", 14, parent)
            return self.wrap(f"({ctype(e.width)}){inner}", 14, parent)
        if isinstance(e, Bin):
            prec = PRECEDENCE[e.op]
            if e.op == ">>u":
                return self.wrap(f"{self.unsigned(e.left)} >> {self.expr(e.right, prec + 1)}", prec, parent)
            if e.op in ("/u", "%u"):
                return self.wrap(f"{self.unsigned(e.left)} {e.op[0]} {self.unsigned(e.right)}", prec, parent)
            if e.op.endswith("u"):
                return self.wrap(f"{self.unsigned(e.left)} {e.op[:-1]} {self.unsigned(e.right)}", prec, parent)
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
            return f"j{e.cc}({self.expr(e.flags)})"
        raise TypeError(type(e))

    def target_width(self, label: str) -> int:
        type_name = self.type_of(label)
        return 64 if type_name.endswith("*") or "long" in type_name else 32

    def assign(self, stmt: Assign) -> str:
        label = self.name(stmt.dst)
        width, src = self.target_width(label), stmt.src
        if isinstance(src, Const):
            return f"{label} = {self.const_for(src, label)};"
        if width_of(src) < width and not isinstance(src, Symbolic):
            return f"{label} = ({utype(width)})({utype(width_of(src))}){self.expr(src, 14)};"
        if width_of(src) > width:
            return f"{label} = ({ctype(width)}){self.expr(src, 14)};"
        return f"{label} = {self.expr(src)};"

    def const_for(self, c: Const, label: str) -> str:
        if self.type_of(label).startswith("unsigned") and c.value < 0:
            return const_text(c.value & ((1 << c.width) - 1))
        return const_text(c.value)

    def statement(self, stmt: Any, uses: dict[tuple[str, int], Any]) -> str | None:
        if isinstance(stmt, Assign):
            if isinstance(stmt.src, CallExpr) and stmt.dst.key not in uses:
                return f"{self.expr(stmt.src)};"
            return self.assign(stmt)
        if isinstance(stmt, Store):
            if stmt.place is not None:
                return f"{self.expr(stmt.place)} = {self.expr(stmt.value)};"
            return f"*({ctype(stmt.width)} *)({self.expr(stmt.addr)}) = {self.expr(stmt.value)};"
        if isinstance(stmt, Return):
            if self.fn.return_type == "void":
                return "return;"
            return f"return {self.expr(stmt.value)};"
        if isinstance(stmt, IndirectJump):
            return f"goto *(void *){self.expr(stmt.target, 14)};"
        return None

    def condition(self, cond: Any) -> str:
        return self.expr(cond)


@dataclass
class Decompiled:
    name: str
    graph: FunctionGraph
    function: Function
    signature: Signature
    ir_text: str
    ssa_text: str
    optimized_text: str
    body: list[str]
    pseudocode: str
    struct_definitions: list[str]
    data_definitions: list[str]
    tables: dict[str, dict[str, Any]]
    optimize_report: OptimizeReport
    phis: int
    gotos: int
    notes: list[str] = field(default_factory=list)
    unknowns: list[str] = field(default_factory=list)
    compare_constants: list[int] = field(default_factory=list)

    @property
    def unit(self) -> str:
        return "\n".join(self.struct_definitions + self.data_definitions + [self.pseudocode])

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "signature": self.signature.to_dict(),
            "blocks": len(self.function.blocks),
            "phis": self.phis,
            "gotos": self.gotos,
            "optimize": self.optimize_report.to_dict(),
            "tables": self.tables,
            "notes": list(self.notes),
            "unknowns": list(self.unknowns),
            "compareConstants": list(self.compare_constants),
        }


def table_values(elf: ElfObject, section: str, offset: int, width: int) -> list[int]:
    raise NotImplementedError("Stage 7: implement table_values")


def compare_constants(fn: Function) -> list[int]:
    raise NotImplementedError("Stage 7: implement compare_constants")


def struct_definition(name: str, fields: dict[int, int]) -> str:
    raise NotImplementedError("Stage 7: implement struct_definition")


def decompile(elf: ElfObject, name: str, recognize_division: bool = True, signatures: dict[str, tuple[tuple[int, ...], int]] | None = None) -> Decompiled:
    raise NotImplementedError("Stage 7: implement decompile")


def decompile_all(elf: ElfObject, recognize_division: bool = True, functions: list[str] | None = None) -> dict[str, Decompiled]:
    raise NotImplementedError("Stage 7: implement decompile_all")


def translation_unit(results: dict[str, Decompiled]) -> str:
    raise NotImplementedError("Stage 7: implement translation_unit")
