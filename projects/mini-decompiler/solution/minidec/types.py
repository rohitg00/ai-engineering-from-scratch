
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
    entry_reads = {key for key in live_keys(fn) if key[1] == 0 and key[0] != "flags"}
    used = [name for name, _ in entry_reads if name in ARG_REGISTERS]
    count = max((ARG_REGISTERS.index(name) for name in used), default=-1) + 1
    fn.params = ARG_REGISTERS[:count]
    fn.param_widths = {name: fn.def_width.get((name, 0), 64) for name in fn.params}
    fn.undefined_reads = sorted(name for name, _ in entry_reads if name not in ARG_REGISTERS and name != "rax")


def coalesce_webs(fn: Function) -> None:
    parent: dict[tuple[str, int], tuple[str, int]] = {}

    def find(key):
        parent.setdefault(key, key)
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key

    for key in live_keys(fn):
        find(key)
    for stmt in fn.statements():
        if isinstance(stmt, Phi):
            for src in stmt.sources.values():
                root_a, root_b = find(stmt.dst.key), find(src.key)
                if root_a != root_b:
                    parent[root_a] = root_b
    webs: dict[tuple[str, int], list[tuple[str, int]]] = {}
    for key in list(parent):
        webs.setdefault(find(key), []).append(key)
    counters: dict[str, int] = {}
    fn.web_names = {}
    fn.web_types = {}
    for members in sorted(webs.values(), key=min):
        members.sort()
        width = max(fn.def_width.get(m, 0) for m in members) or 32
        name, version = members[0]
        if name in fn.params and version == 0:
            label = f"param_{fn.params.index(name) + 1}"
        elif name.startswith("local_") or name.startswith("arg_"):
            label = name
        elif version == 0:
            label = f"undefined_{name}"
        else:
            register = name if width == 64 or name not in REG64 else REG32[REG64.index(name)]
            counters[register] = counters.get(register, 0) + 1
            label = f"{register}_{counters[register]}"
        for member in members:
            fn.web_names[member] = label
        fn.web_types[label] = ctype(width)


def signedness_by_web(fn: Function) -> dict[str, set[str]]:
    evidence: dict[str, set[str]] = {}

    def web(var: Var) -> str:
        return fn.web_names.get(var.key, var.name)

    def note(expr: Any, kind: str) -> None:
        if isinstance(expr, Var):
            evidence.setdefault(web(expr), set()).add(kind)
        elif isinstance(expr, Cast) and expr.kind == "zext" and isinstance(expr.expr, Var):
            evidence.setdefault(web(expr.expr), set()).add(kind)

    for stmt in fn.statements():
        for expr in stmt_exprs(stmt):
            for node in iter_nodes(expr):
                if isinstance(node, Bin):
                    if node.op in SIGNED_OPS:
                        note(node.left, "signed")
                        if node.op in ("<", "<=", ">", ">="):
                            note(node.right, "signed")
                    elif node.op in (">>u", "/u", "%u"):
                        note(node.left, "unsigned-arithmetic")
                    elif node.op in UNSIGNED_OPS:
                        note(node.left, "unsigned-compare")
                        note(node.right, "unsigned-compare")
                elif isinstance(node, Cast) and node.kind == "sext" and isinstance(node.expr, Var):
                    evidence.setdefault(web(node.expr), set()).add("signed")
    return evidence


def signedness_label(kinds: set[str]) -> str:
    if not kinds:
        return "none"
    if "signed" in kinds and len(kinds) > 1:
        return "mixed"
    if kinds == {"signed"}:
        return "signed"
    if "unsigned-arithmetic" in kinds:
        return "unsigned"
    return "unsigned-compare"


def infer_types(fn: Function) -> None:
    aliases: dict[str, set[str]] = {}

    def link(a: str, b: str) -> None:
        group = aliases.setdefault(a, {a}) | aliases.setdefault(b, {b})
        for member in group:
            aliases[member] = group

    def web(var: Var) -> str:
        return fn.web_names.get(var.key, var.name)

    element_evidence: dict[str, int] = {}
    struct_evidence: dict[str, dict[int, int]] = {}
    returned: list[int] = []
    undefined_return = False
    for stmt in fn.statements():
        if isinstance(stmt, Assign) and isinstance(stmt.src, Var):
            link(web(stmt.dst), web(stmt.src))
        if isinstance(stmt, Phi):
            for src in stmt.sources.values():
                link(web(stmt.dst), web(src))
        if isinstance(stmt, Return):
            if isinstance(stmt.value, Var) and stmt.value.version == 0:
                undefined_return = True
            else:
                returned.append(getattr(stmt.value, "width", 32))
        places = list(stmt_exprs(stmt)) + ([stmt.place] if isinstance(stmt, Store) and stmt.place is not None else [])
        for expr in places:
            for node in iter_nodes(expr):
                if isinstance(node, Index) and isinstance(node.base, Var):
                    element_evidence[web(node.base)] = node.width
                if isinstance(node, Field) and isinstance(node.base, Var):
                    struct_evidence.setdefault(web(node.base), {})[node.offset] = node.width
    fn.structs = {}
    for label, fields in struct_evidence.items():
        group = aliases.get(label, {label})
        param_labels = sorted(member for member in group if member.startswith("param_"))
        struct_name = f"{fn.name}_{param_labels[0] if param_labels else label}"
        merged = fn.structs.setdefault(struct_name, {})
        for other in group:
            merged.update(struct_evidence.get(other, {}))
        for member in group:
            fn.web_types[member] = f"struct {struct_name} *"
    for label, width in element_evidence.items():
        for member in aliases.get(label, {label}):
            if not fn.web_types.get(member, "").startswith("struct"):
                fn.web_types[member] = f"{ctype(width)} *"
    for label, kinds in signedness_by_web(fn).items():
        if signedness_label(kinds) == "unsigned" and label in fn.web_types and not fn.web_types[label].endswith("*"):
            fn.web_types[label] = "unsigned " + fn.web_types[label]
    if undefined_return and not returned:
        fn.return_type = "void"
    elif not returned:
        fn.return_type = "void"
    else:
        fn.return_type = ctype(max(returned))


def recover_signature(fn: Function) -> Signature:
    collect_params(fn)
    coalesce_webs(fn)
    infer_types(fn)
    kinds = signedness_by_web(fn)
    params: list[Param] = []
    for position, register in enumerate(fn.params):
        label = f"param_{position + 1}"
        width = fn.param_widths.get(register, 64)
        type_name = fn.web_types.get(label, ctype(width))
        evidence = [f"%{register if width == 64 else REG32[REG64.index(register)]} is read before any write"]
        if type_name.endswith("*"):
            if type_name.startswith("struct"):
                struct_name = type_name[len("struct ") : -2].strip()
                offsets = ", ".join(f"0x{o:x}" for o in sorted(fn.structs.get(struct_name, {})))
                evidence.append(f"accessed through constant offsets {offsets}")
            else:
                evidence.append("base register of a scaled element access")
        touched = kinds.get(label, set())
        signedness = "pointer" if type_name.endswith("*") else signedness_label(touched)
        if touched:
            evidence.append("touched by " + " and ".join(sorted(touched)) + " instructions")
        params.append(Param(label, register, width, type_name, signedness, evidence))
    return_width = {"void": 0, "int": 32, "long": 64}.get(fn.return_type, 32)
    evidence = [f"{len(fn.params)} argument register(s) read before write", f"return value width {return_width} from the value in %rax at every return"]
    for kind, lines in sorted(fn.signedness.items()):
        evidence.append(f"{kind} instructions: " + "; ".join(lines[:6]))
    return Signature(fn.name, params, fn.return_type, return_width, dict(fn.structs), list(fn.undefined_reads), evidence)
