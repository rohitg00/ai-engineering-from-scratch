
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .ir import (
    COND_OPS,
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
    Load,
    Phi,
    SignFill,
    Store,
    Symbolic,
    Var,
    iter_nodes,
    map_stmt,
    rewrite,
    stmt_exprs,
    variables,
)

INT_MIN = -(2**31)
INT_MAX = 2**31 - 1


def c_div(dividend: int, divisor: int) -> int:
    quotient = abs(dividend) // abs(divisor)
    return -quotient if (dividend < 0) != (divisor < 0) else quotient


def truncate(value: int, width: int) -> int:
    value &= (1 << width) - 1
    return value - (1 << width) if width and value >> (width - 1) else value


def magic_divisor(multiplier: int, shift: int) -> int | None:
    raise NotImplementedError("Stage 5: implement magic_divisor")


def division_identity_holds(multiplier: int, shift: int, divisor: int, samples: list[int] | None = None) -> bool:
    raise NotImplementedError("Stage 5: implement division_identity_holds")


@dataclass
class OptimizeReport:
    rounds: int = 0
    removed: int = 0
    substituted: int = 0
    copies: int = 0
    merged_phis: int = 0
    divisions: list[dict[str, int]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"rounds": self.rounds, "removed": self.removed, "substituted": self.substituted, "copies": self.copies, "mergedPhis": self.merged_phis, "divisions": list(self.divisions)}


def place_of(addr: Any, width: int) -> Any:
    if isinstance(addr, Bin) and addr.op == "+":
        for base, offset in ((addr.left, addr.right), (addr.right, addr.left)):
            scaled = isinstance(offset, Bin) and offset.op == "*" and isinstance(offset.right, Const)
            if scaled and offset.right.value * 8 == width and isinstance(base, (Var, Symbolic)):
                return Index(base, offset.left, width)
        if isinstance(addr.left, Var) and isinstance(addr.right, Const) and addr.left.width == 64 and 0 <= addr.right.value < 4096:
            return Field(addr.left, addr.right.value, width)
    if isinstance(addr, Var) and addr.width == 64:
        return Field(addr, 0, width)
    return None


COMMUTATIVE = {"+", "*", "&", "|", "^"}


def definition_order(fn: Function) -> dict[tuple[str, int], int]:
    from .ir import ARG_REGISTERS

    order: dict[tuple[str, int], int] = {}
    for position, stmt in enumerate(fn.statements()):
        if isinstance(stmt, (Assign, Phi)):
            order[stmt.dst.key] = position
        for expr in stmt_exprs(stmt):
            for var in variables(expr):
                if var.version == 0 and var.key not in order:
                    order[var.key] = -100 + (ARG_REGISTERS.index(var.name) if var.name in ARG_REGISTERS else 50)
    return order


def make_simplifier(defs: dict[tuple[str, int], Any], recognize_division: bool, report: OptimizeReport | None = None, order: dict[tuple[str, int], int] | None = None):
    raise NotImplementedError("Stage 5: implement make_simplifier")


def count_uses(fn: Function) -> dict[tuple[str, int], list[tuple[int, Any]]]:
    uses: dict[tuple[str, int], list[tuple[int, Any]]] = {}
    for block in fn.blocks.values():
        for stmt in block.stmts:
            if isinstance(stmt, Phi):
                for src in stmt.sources.values():
                    uses.setdefault(src.key, []).append((block.start, stmt))
                continue
            for expr in stmt_exprs(stmt):
                for var in variables(expr):
                    uses.setdefault(var.key, []).append((block.start, stmt))
    return uses


def has_call(expr: Any) -> bool:
    return any(isinstance(node, CallExpr) for node in iter_nodes(expr))


def contains_load(expr: Any) -> bool:
    return any(isinstance(node, (Load, Index, Field)) for node in iter_nodes(expr))


def stmt_has_side_effect(stmt: Any) -> bool:
    return isinstance(stmt, Store) or any(has_call(e) for e in stmt_exprs(stmt))


def remove_dead_code(fn: Function, uses: dict[tuple[str, int], list[tuple[int, Any]]]) -> int:
    raise NotImplementedError("Stage 5: implement remove_dead_code")


def propagate_copies(fn: Function) -> int:
    raise NotImplementedError("Stage 5: implement propagate_copies")


def substitute_once(fn: Function, uses: dict[tuple[str, int], list[tuple[int, Any]]]) -> bool:
    raise NotImplementedError("Stage 5: implement substitute_once")


def merge_congruent_phis(fn: Function) -> int:
    raise NotImplementedError("Stage 5: implement merge_congruent_phis")


def simplify_function(fn: Function, recognize_division: bool, report: OptimizeReport | None = None) -> None:
    defs = {s.dst.key: s.src for s in fn.statements() if isinstance(s, Assign)}
    simplify = make_simplifier(defs, recognize_division, report, definition_order(fn))
    for stmt in fn.statements():
        map_stmt(stmt, lambda e: rewrite(e, simplify))
        if isinstance(stmt, Store):
            stmt.place = place_of(stmt.addr, stmt.width)


def optimize(fn: Function, recognize_division: bool = True, rounds: int = 400) -> OptimizeReport:
    raise NotImplementedError("Stage 5: implement optimize")
