
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
    if multiplier <= 0 or shift < 32 or shift > 63:
        return None
    power = 1 << shift
    for d in (power // multiplier, power // multiplier + 1):
        if d > 1 and multiplier == -(-power // d) and multiplier * d - power <= power >> 31:
            return d
    return None


def division_identity_holds(multiplier: int, shift: int, divisor: int, samples: list[int] | None = None) -> bool:
    values = samples or list(range(-40, 41)) + [INT_MIN, INT_MIN + 1, INT_MAX - 1, INT_MAX, 2**30, -(2**30), 123456789, -123456789]
    for x in values:
        product = truncate(x * multiplier, 64)
        quotient = truncate(product >> shift, 32) + ((product >> 63) & 1)
        if truncate(quotient, 32) != c_div(x, divisor):
            return False
    return True


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
    order = order or {}

    def resolve(expr: Any) -> Any:
        seen = 0
        while isinstance(expr, Var) and expr.key in defs and seen < 64:
            expr = defs[expr.key]
            seen += 1
        return expr

    def strip_trunc(expr: Any) -> Any:
        return expr.expr if isinstance(expr, Cast) and expr.kind == "trunc" else expr

    def division_pattern(expr: Any) -> Any:
        if not recognize_division or not isinstance(expr, Bin) or expr.op != "+" or expr.width != 32:
            return None
        parts = [resolve(strip_trunc(expr.left)), resolve(strip_trunc(expr.right))]
        for quotient, sign in (parts, parts[::-1]):
            if not (isinstance(quotient, Bin) and quotient.op in (">>s", ">>u") and isinstance(quotient.right, Const)):
                continue
            shift = quotient.right.value
            if quotient.op == ">>u" and shift != 32:
                continue
            if not (isinstance(sign, Bin) and sign.op == ">>u" and isinstance(sign.right, Const) and sign.right.value == 63):
                continue
            product_a, product_b = resolve(quotient.left), resolve(sign.left)
            if product_a != product_b or not (isinstance(product_a, Bin) and product_a.op == "*"):
                continue
            operand, multiplier = product_a.left, product_a.right
            if isinstance(operand, Const):
                operand, multiplier = multiplier, operand
            if not (isinstance(multiplier, Const) and isinstance(operand, Cast) and operand.kind == "sext"):
                continue
            divisor = magic_divisor(multiplier.value, shift)
            if divisor is None or not division_identity_holds(multiplier.value, shift, divisor):
                continue
            if report is not None:
                record = {"multiplier": multiplier.value, "shift": shift, "divisor": divisor}
                if record not in report.divisions:
                    report.divisions.append(record)
            return Bin("/", operand.expr, Const(divisor, 32), 32)
        return None

    def fold_constants(expr: Bin) -> Any:
        left, right = expr.left, expr.right
        if isinstance(left, Const) and isinstance(right, Const):
            a, b = left.value, right.value
            table = {"+": a + b, "-": a - b, "*": a * b, "&": a & b, "|": a | b, "^": a ^ b, "<<": a << b}
            if expr.op in table:
                return Const(truncate(table[expr.op], expr.width), expr.width)
        if expr.op in ("+", "-") and isinstance(right, Const) and right.value == 0:
            return left
        if expr.op == "*" and isinstance(right, Const) and right.value == 1:
            return left
        return expr

    def simplify(expr: Any) -> Any:
        if isinstance(expr, Cond) and isinstance(expr.flags, Flags):
            flags, op = expr.flags, COND_OPS[expr.cc]
            if flags.kind == "cmp":
                return Bin(op, flags.left, flags.right, 32)
            if flags.kind == "test":
                if flags.left == flags.right:
                    return Bin(op, flags.left, Const(0, flags.width), 32)
                return Bin(op, Bin("&", flags.left, flags.right, flags.width), Const(0, flags.width), 32)
            if flags.kind in ("add", "inc", "dec", "and", "or", "xor") and expr.cc in ("e", "ne", "s", "ns", "l", "ge", "le", "g"):
                symbol = {"add": "+", "inc": "+", "dec": "-", "and": "&", "or": "|", "xor": "^"}[flags.kind]
                return Bin(op, Bin(symbol, flags.left, flags.right, flags.width), Const(0, flags.width), 32)
        if isinstance(expr, Bin):
            expr = fold_constants(expr)
        if isinstance(expr, Bin) and expr.op in COMMUTATIVE and isinstance(expr.left, Var) and isinstance(expr.right, Var):
            if order.get(expr.right.key, 0) < order.get(expr.left.key, 0):
                expr = Bin(expr.op, expr.right, expr.left, expr.width)
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
            place = place_of(expr.addr, expr.width)
            if place is not None:
                return place
        folded = division_pattern(expr)
        if folded is not None:
            return folded
        return expr

    return simplify


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
    removed = 0
    for block in fn.blocks.values():
        kept = []
        for stmt in block.stmts:
            dead = isinstance(stmt, (Assign, Phi)) and stmt.dst.key not in uses
            if dead and not (isinstance(stmt, Assign) and has_call(stmt.src)):
                removed += 1
                continue
            kept.append(stmt)
        block.stmts = kept
    return removed


def propagate_copies(fn: Function) -> int:
    replacements: dict[tuple[str, int], Any] = {}
    for stmt in fn.statements():
        if isinstance(stmt, Assign):
            if isinstance(stmt.src, Const) or (isinstance(stmt.src, Var) and stmt.src.width == stmt.dst.width and stmt.src.key not in replacements):
                replacements[stmt.dst.key] = stmt.src
    if not replacements:
        return 0
    for key, value in list(replacements.items()):
        seen = {key}
        while isinstance(value, Var) and value.key in replacements and value.key not in seen:
            seen.add(value.key)
            value = replacements[value.key]
        replacements[key] = value
    changed = 0

    def swap(expr: Any) -> Any:
        nonlocal changed
        if isinstance(expr, Var) and expr.key in replacements:
            changed += 1
            return replacements[expr.key]
        return expr

    for stmt in fn.statements():
        if not isinstance(stmt, Phi):
            map_stmt(stmt, lambda e: rewrite(e, swap))
    return changed


def substitute_once(fn: Function, uses: dict[tuple[str, int], list[tuple[int, Any]]]) -> bool:
    for block in fn.blocks.values():
        for position, stmt in enumerate(block.stmts):
            if not isinstance(stmt, Assign) or has_call(stmt.src):
                continue
            users = uses.get(stmt.dst.key, [])
            if len(users) != 1 or isinstance(users[0][1], Phi):
                continue
            user_block, user = users[0]
            later = block.stmts[position + 1 :]
            same_block = user_block == block.start and any(user is s for s in later)
            if not (same_block or isinstance(stmt.src, Symbolic)):
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


def merge_congruent_phis(fn: Function) -> int:
    defs = {s.dst.key: s.src for s in fn.statements() if isinstance(s, Assign)}

    def value(var: Var) -> Any:
        seen: set[tuple[str, int]] = set()
        current: Any = var
        while isinstance(current, Var) and current.key in defs and current.key not in seen:
            seen.add(current.key)
            following = defs[current.key]
            if isinstance(following, (Var, Const)):
                current = following
            else:
                break
        return current.value if isinstance(current, Const) else current.key if isinstance(current, Var) else None

    merged = 0
    replacements: dict[tuple[str, int], Var] = {}
    for block in fn.blocks.values():
        phis = [s for s in block.stmts if isinstance(s, Phi)]
        for position, later in enumerate(phis):
            for earlier in phis[:position]:
                if earlier.dst.key in replacements or later.dst.key in replacements:
                    continue
                if set(earlier.sources) != set(later.sources):
                    continue
                same = all(value(earlier.sources[p]) is not None and value(earlier.sources[p]) == value(later.sources[p]) for p in earlier.sources)
                widths_match = fn.def_width.get(earlier.dst.key) == fn.def_width.get(later.dst.key)
                if same and widths_match:
                    replacements[later.dst.key] = earlier.dst
                    break
    if not replacements:
        return 0

    def swap(expr: Any) -> Any:
        if isinstance(expr, Var) and expr.key in replacements:
            return Var(replacements[expr.key].name, expr.width, replacements[expr.key].version)
        return expr

    for block in fn.blocks.values():
        kept = []
        for stmt in block.stmts:
            if isinstance(stmt, Phi):
                if stmt.dst.key in replacements:
                    merged += 1
                    continue
                stmt.sources = {p: swap(v) for p, v in stmt.sources.items()}
            else:
                map_stmt(stmt, lambda e: rewrite(e, swap))
            kept.append(stmt)
        block.stmts = kept
    return merged


def simplify_function(fn: Function, recognize_division: bool, report: OptimizeReport | None = None) -> None:
    defs = {s.dst.key: s.src for s in fn.statements() if isinstance(s, Assign)}
    simplify = make_simplifier(defs, recognize_division, report, definition_order(fn))
    for stmt in fn.statements():
        map_stmt(stmt, lambda e: rewrite(e, simplify))
        if isinstance(stmt, Store):
            stmt.place = place_of(stmt.addr, stmt.width)


def optimize(fn: Function, recognize_division: bool = True, rounds: int = 400) -> OptimizeReport:
    report = OptimizeReport()
    for _ in range(rounds):
        report.rounds += 1
        simplify_function(fn, recognize_division, report)
        uses = count_uses(fn)
        removed = remove_dead_code(fn, uses)
        if removed:
            report.removed += removed
            continue
        copies = propagate_copies(fn)
        if copies:
            report.copies += copies
            continue
        merged = merge_congruent_phis(fn)
        if merged:
            report.merged_phis += merged
            continue
        if substitute_once(fn, uses):
            report.substituted += 1
            continue
        break
    fn.divisions = list(report.divisions)
    return report
