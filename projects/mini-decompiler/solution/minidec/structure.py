
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
        if block_id in (stop, EXIT):
            return
        if block_id in self.emitted:
            self.gotos += 1
            self.emit(f"goto block_{block_id:x};", depth)
            return
        block = self.fn.blocks[block_id]
        if block_id in self.loops:
            self.emit_loop(block, stop, depth)
            return
        self.emitted.add(block_id)
        term = self.terminator(block)
        self.body(block, depth)
        if isinstance(term, Branch):
            self.emit_branch(block, term, stop, depth)
        elif isinstance(term, IndirectJump) and term.table is not None:
            self.emit_switch(block, term, None, stop, depth)
        elif isinstance(term, Jump):
            self.walk(term.target, stop, depth)
        elif term is None and block.succs:
            self.walk(block.succs[0], stop, depth)

    def switch_head(self, block_id: int, other: int) -> IndirectJump | None:
        if block_id in (EXIT,) or block_id not in self.fn.blocks:
            return None
        term = self.terminator(self.fn.blocks[block_id])
        if isinstance(term, IndirectJump) and term.table is not None and other not in term.table.targets:
            return term
        return None

    def emit_branch(self, block: IRBlock, term: Branch, stop: int, depth: int) -> None:
        join = self.fn.ipdom.get(block.start, EXIT)
        taken, fall = term.target, term.fallthrough
        head = self.switch_head(fall, taken)
        if head is not None and self.fn.blocks[fall].preds == [block.start]:
            self.emitted.add(fall)
            self.body(self.fn.blocks[fall], depth)
            self.emit_switch(self.fn.blocks[fall], head, taken, join, depth)
            self.walk(join, stop, depth)
            return
        if join == taken:
            self.emit(f"if ({self.condition(negate(term.cond))}) {{", depth)
            self.walk(fall, join, depth + 1)
            self.emit("}", depth)
            self.walk(join, stop, depth)
        elif join == fall:
            self.emit(f"if ({self.condition(term.cond)}) {{", depth)
            self.walk(taken, join, depth + 1)
            self.emit("}", depth)
            self.walk(join, stop, depth)
        elif join in (EXIT, stop):
            first, second, cond = taken, fall, term.cond
            if self.region_size(fall, join) < self.region_size(taken, join):
                first, second, cond = fall, taken, negate(term.cond)
            self.emit(f"if ({self.condition(cond)}) {{", depth)
            self.walk(first, join, depth + 1)
            self.emit("}", depth)
            self.walk(second, join, depth)
        else:
            self.emit(f"if ({self.condition(term.cond)}) {{", depth)
            self.walk(taken, join, depth + 1)
            self.emit("} else {", depth)
            self.walk(fall, join, depth + 1)
            self.emit("}", depth)
            self.walk(join, stop, depth)

    def emit_switch(self, block: IRBlock, term: IndirectJump, default: int | None, join: int, depth: int) -> None:
        table = term.table
        assert table is not None
        self.emit(f"switch ({self.condition(term.index)}) {{", depth)
        by_target: dict[int, list[int]] = {}
        for case, target in enumerate(table.targets):
            by_target.setdefault(target, []).append(case)
        for target, cases in sorted(by_target.items(), key=lambda item: item[1][0]):
            for case in cases:
                self.emit(f"case {case}:", depth)
            self.walk(target, join, depth + 1)
            self.emit("break;", depth + 1)
        if default is not None:
            self.emit("default:", depth)
            self.walk(default, join, depth + 1)
            self.emit("break;", depth + 1)
        self.emit("}", depth)

    def emit_loop(self, header: IRBlock, stop: int, depth: int) -> None:
        members = self.loops[header.start]
        exits = sorted({s for b in members for s in self.succs[b] if s not in members})
        exit_block = exits[0] if exits else EXIT
        term = self.terminator(header)
        self.emitted.add(header.start)
        self_loop = header.start in self.succs[header.start]
        header_exits = isinstance(term, Branch) and (term.target not in members or term.fallthrough not in members)
        if header_exits and not self_loop:
            cond = term.cond if term.fallthrough not in members else negate(term.cond)
            inner = term.target if term.target in members else term.fallthrough
            self.body(header, depth)
            self.emit(f"while ({self.condition(cond)}) {{", depth)
            self.walk(inner, header.start, depth + 1)
            self.emit("}", depth)
        else:
            latch = header if self_loop else self.fn.blocks[[b for b in members if header.start in self.succs[b]][0]]
            latch_term = self.terminator(latch)
            self.emit("do {", depth)
            self.body(header, depth + 1)
            if latch is not header:
                for succ in header.succs:
                    self.walk(succ, latch.start, depth + 1)
                self.emitted.add(latch.start)
                self.body(latch, depth + 1)
            if isinstance(latch_term, Branch):
                cond = latch_term.cond if latch_term.target == header.start else negate(latch_term.cond)
                self.emit(f"}} while ({self.condition(cond)});", depth)
            else:
                self.emit("} while (1);", depth)
        self.walk(exit_block, stop, depth)

    def run(self) -> list[str]:
        self.walk(self.fn.entry, EXIT, 1)
        return self.lines


def structure(fn: Function, statement: Callable[[Any], str | None], condition: Callable[[Any], str]) -> tuple[list[str], int]:
    structurer = Structurer(fn, statement, condition)
    lines = structurer.run()
    return lines, structurer.gotos
