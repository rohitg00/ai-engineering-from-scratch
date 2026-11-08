
from __future__ import annotations

from typing import Any, Callable

from .cfg import EXIT, dominates
from .ir import Bin, Branch, Const, Function, IRBlock, IndirectJump, Jump, Phi, Return, TERMINATORS

NEGATE = {
    "==": "!=", "!=": "==", "<": ">=", ">=": "<", "<=": ">", ">": "<=",
    "<u": ">=u", ">=u": "<u", "<=u": ">u", ">u": "<=u",
}


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
    from .cfg import immediate_dominators

    succs, preds = fn.succs(), fn.preds()
    exits = [b for b, s in succs.items() if not s]
    reverse_succs = {b: list(p) for b, p in preds.items()}
    reverse_succs[EXIT] = exits
    reverse_preds = {b: list(s) + ([EXIT] if b in exits else []) for b, s in succs.items()}
    reverse_preds[EXIT] = []
    seen: set[int] = set()
    postorder: list[int] = []

    def visit(node: int) -> None:
        seen.add(node)
        for target in reverse_succs.get(node, []):
            if target not in seen:
                visit(target)
        postorder.append(node)

    visit(EXIT)
    order = list(reversed(postorder))
    return immediate_dominators(EXIT, order, lambda node: reverse_preds.get(node, []))


class Structurer:

    def __init__(self, fn: Function, statement: Callable[[Any], str | None], condition: Callable[[Any], str]) -> None:
        self.fn = fn
        self.statement = statement
        self.condition = condition
        self.succs = fn.succs()
        fn.ipdom = post_dominators(fn)
        self.loops = natural_loops(fn)
        self.lines: list[str] = []
        self.emitted: set[int] = set()
        self.gotos = 0

    def emit(self, text: str, depth: int) -> None:
        self.lines.append("  " * depth + text)

    @staticmethod
    def terminator(block: IRBlock) -> Any:
        return block.stmts[-1] if block.stmts and isinstance(block.stmts[-1], TERMINATORS) else None

    def body(self, block: IRBlock, depth: int) -> None:
        for stmt in block.stmts:
            if isinstance(stmt, (Phi, Branch, Jump, IndirectJump)):
                continue
            text = self.statement(stmt)
            if text is not None:
                self.emit(text, depth)

    def region_size(self, start: int, stop: int) -> int:
        seen: set[int] = set()
        stack = [start]
        while stack:
            node = stack.pop()
            if node in seen or node == stop or node == EXIT:
                continue
            seen.add(node)
            stack.extend(self.succs[node])
        return len(seen)

    def walk(self, block_id: int, stop: int, depth: int) -> None:
        raise NotImplementedError("Stage 7: implement Structurer.walk")

    def switch_head(self, block_id: int, other: int) -> IndirectJump | None:
        if block_id in (EXIT,) or block_id not in self.fn.blocks:
            return None
        term = self.terminator(self.fn.blocks[block_id])
        if isinstance(term, IndirectJump) and term.table is not None and other not in term.table.targets:
            return term
        return None

    def emit_branch(self, block: IRBlock, term: Branch, stop: int, depth: int) -> None:
        raise NotImplementedError("Stage 7: implement Structurer.emit_branch")

    def emit_switch(self, block: IRBlock, term: IndirectJump, default: int | None, join: int, depth: int) -> None:
        raise NotImplementedError("Stage 7: implement Structurer.emit_switch")

    def emit_loop(self, header: IRBlock, stop: int, depth: int) -> None:
        raise NotImplementedError("Stage 7: implement Structurer.emit_loop")

    def run(self) -> list[str]:
        self.walk(self.fn.entry, EXIT, 1)
        return self.lines


def structure(fn: Function, statement: Callable[[Any], str | None], condition: Callable[[Any], str]) -> tuple[list[str], int]:
    structurer = Structurer(fn, statement, condition)
    lines = structurer.run()
    return lines, structurer.gotos
