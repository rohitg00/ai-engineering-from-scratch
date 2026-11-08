
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .ir import ARG_REGISTERS, REG32, REG64, Assign, Bin, Cast, Field, Function, Index, Phi, Return, Store, Var, iter_nodes, stmt_exprs, variables

SIGNED_OPS = {">>s", "/", "%", "<", "<=", ">", ">="}
UNSIGNED_OPS = {">>u", "/u", "%u", "<u", "<=u", ">u", ">=u"}


@dataclass
class Param:
    name: str
    register: str
    width: int
    ctype: str
    signedness: str
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "register": self.register, "width": self.width, "ctype": self.ctype, "signedness": self.signedness, "evidence": list(self.evidence)}


@dataclass
class Signature:
    name: str
    params: list[Param]
    return_type: str
    return_width: int
    structs: dict[str, dict[int, int]]
    undefined_reads: list[str]
    evidence: list[str] = field(default_factory=list)

    def declaration(self) -> str:
        params = ", ".join(declaration(p.ctype, p.name) for p in self.params) or "void"
        return f"{self.return_type} {self.name}({params})"

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "declaration": self.declaration(),
            "params": [p.to_dict() for p in self.params],
            "returnType": self.return_type,
            "returnWidth": self.return_width,
            "structs": {name: {f"0x{offset:x}": width for offset, width in sorted(fields.items())} for name, fields in self.structs.items()},
            "undefinedReads": list(self.undefined_reads),
            "evidence": list(self.evidence),
        }


def ctype(width: int) -> str:
    return {8: "char", 16: "short", 32: "int", 64: "long"}[width]


def utype(width: int) -> str:
    return "unsigned " + ctype(width)


def declaration(type_name: str, label: str) -> str:
    return f"{type_name}{label}" if type_name.endswith("*") else f"{type_name} {label}"


def live_keys(fn: Function) -> set[tuple[str, int]]:
    keys: set[tuple[str, int]] = set()
    for stmt in fn.statements():
        if isinstance(stmt, (Assign, Phi)):
            keys.add(stmt.dst.key)
        if isinstance(stmt, Phi):
            keys.update(s.key for s in stmt.sources.values())
        for expr in stmt_exprs(stmt):
            keys.update(v.key for v in variables(expr))
    return keys


def collect_params(fn: Function) -> None:
    raise NotImplementedError("Stage 6: implement collect_params")


def coalesce_webs(fn: Function) -> None:
    raise NotImplementedError("Stage 6: implement coalesce_webs")


def signedness_by_web(fn: Function) -> dict[str, set[str]]:
    raise NotImplementedError("Stage 6: implement signedness_by_web")


def signedness_label(kinds: set[str]) -> str:
    raise NotImplementedError("Stage 6: implement signedness_label")


def infer_types(fn: Function) -> None:
    raise NotImplementedError("Stage 6: implement infer_types")


def recover_signature(fn: Function) -> Signature:
    raise NotImplementedError("Stage 6: implement recover_signature")
