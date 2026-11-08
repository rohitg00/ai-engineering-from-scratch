
from __future__ import annotations

from .cfg import dominance_frontiers
from .ir import EXIT, Assign, Cast, Function, Phi, Var, map_stmt, rewrite


def insert_phis(fn: Function) -> int:
    frontier = dominance_frontiers(fn.idom, lambda node: fn.blocks[node].preds)
    defsites: dict[str, set[int]] = {}
    for block in fn.blocks.values():
        for stmt in block.stmts:
            if isinstance(stmt, Assign):
                defsites.setdefault(stmt.dst.name, set()).add(block.start)
    placed = 0
    for name, sites in sorted(defsites.items()):
        has_phi: set[int] = set()
        work = sorted(sites)
        while work:
            node = work.pop()
            for join in sorted(frontier.get(node, ())):
                if join in has_phi:
                    continue
                has_phi.add(join)
                sources = {p: Var(name, 0) for p in fn.blocks[join].preds}
                if join == fn.entry:
                    sources[EXIT] = Var(name, 0, 0)
                phi = Phi(Var(name, 0), sources)
                fn.blocks[join].stmts.insert(0, phi)
                placed += 1
                if join not in sites:
                    work.append(join)
    return placed


def rename(fn: Function) -> None:
    counters: dict[str, int] = {}
    stacks: dict[str, list[int]] = {}
    children_of: dict[int, list[int]] = {b: [] for b in fn.blocks}
    for node, parent in fn.idom.items():
        if node != parent and parent in children_of:
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

    def rename_uses(expr):
        return rewrite(expr, lambda e: use(e) if isinstance(e, Var) else e)

    def visit(block_id: int) -> None:
        block = fn.blocks[block_id]
        pushed: list[str] = []
        for stmt in block.stmts:
            if isinstance(stmt, Phi):
                stmt.dst = fresh(stmt.dst.name, 0)
                pushed.append(stmt.dst.name)
                continue
            map_stmt(stmt, rename_uses)
            if isinstance(stmt, Assign):
                stmt.dst = fresh(stmt.dst.name, stmt.dst.width)
                pushed.append(stmt.dst.name)
        for succ in block.succs:
            for stmt in fn.blocks[succ].stmts:
                if isinstance(stmt, Phi):
                    stmt.sources[block_id] = use(Var(stmt.dst.name, 0))
        for child in sorted(children_of[block_id]):
            visit(child)
        for name in pushed:
            stacks[name].pop()

    visit(fn.entry)
    changed = True
    while changed:
        changed = False
        for stmt in fn.statements():
            if isinstance(stmt, Phi):
                width = max(fn.def_width.get(s.key, 0) for s in stmt.sources.values())
                if width > fn.def_width[stmt.dst.key]:
                    fn.def_width[stmt.dst.key] = width
                    changed = True
    for stmt in fn.statements():
        if isinstance(stmt, Phi):
            for source in stmt.sources.values():
                if source.version == 0:
                    fn.def_width[source.key] = max(fn.def_width.get(source.key, 0), fn.def_width[stmt.dst.key])
            stmt.dst = Var(stmt.dst.name, fn.def_width[stmt.dst.key], stmt.dst.version)
            stmt.sources = {p: Var(s.name, fn.def_width[s.key], s.version) for p, s in stmt.sources.items()}

    def cast_use(expr):
        if not isinstance(expr, Var):
            return expr
        def_width = fn.def_width.get(expr.key, expr.width)
        if def_width == 0 or expr.width == 0:
            return Var(expr.name, def_width or expr.width, expr.version)
        if expr.width == def_width:
            return expr
        definition = Var(expr.name, def_width, expr.version)
        return Cast("zext" if expr.width > def_width else "trunc", definition, expr.width)

    for stmt in fn.statements():
        if not isinstance(stmt, Phi):
            map_stmt(stmt, lambda e: rewrite(e, cast_use))


def to_ssa(fn: Function) -> int:
    placed = insert_phis(fn)
    rename(fn)
    return placed


def check_single_assignment(fn: Function) -> list[str]:
    seen: dict[tuple[str, int], int] = {}
    for stmt in fn.statements():
        if isinstance(stmt, (Assign, Phi)):
            seen[stmt.dst.key] = seen.get(stmt.dst.key, 0) + 1
    return [f"{name}_{version}" for (name, version), count in sorted(seen.items()) if count > 1]
