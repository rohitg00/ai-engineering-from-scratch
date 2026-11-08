
from __future__ import annotations

from .cfg import dominance_frontiers
from .ir import EXIT, Assign, Cast, Function, Phi, Var, map_stmt, rewrite


def insert_phis(fn: Function) -> int:
    raise NotImplementedError("Stage 4: implement insert_phis")


def rename(fn: Function) -> None:
    raise NotImplementedError("Stage 4: implement rename")


def to_ssa(fn: Function) -> int:
    placed = insert_phis(fn)
    rename(fn)
    return placed


def check_single_assignment(fn: Function) -> list[str]:
    raise NotImplementedError("Stage 4: implement check_single_assignment")
