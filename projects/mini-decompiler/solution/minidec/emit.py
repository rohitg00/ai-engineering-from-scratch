
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
    data = elf.section(section).data
    referenced = set()
    for relocation in elf.relocations.get(".text", []):
        if relocation.symbol.section == section and relocation.pc_relative:
            referenced.add(relocation.addend + relocation.width)
    end = min(t for t in referenced | {len(data)} if t > offset)
    size = width // 8
    count = (end - offset) // size
    return [int.from_bytes(data[offset + i * size : offset + (i + 1) * size], "little", signed=True) for i in range(count)]


def compare_constants(fn: Function) -> list[int]:
    found: set[int] = set()
    for stmt in fn.statements():
        for expr in stmt_exprs(stmt):
            for node in iter_nodes(expr):
                if isinstance(node, Bin) and node.op in PRECEDENCE and PRECEDENCE[node.op] in (9, 10):
                    for side in (node.left, node.right):
                        if isinstance(side, Const):
                            found.add(side.value)
    return sorted(found)


def struct_definition(name: str, fields: dict[int, int]) -> str:
    lines = [f"struct {name} {{"]
    position = 0
    for offset in sorted(fields):
        if offset > position:
            lines.append(f"  char pad_{position:x}[{offset - position}];")
        width = fields[offset]
        lines.append(f"  {ctype(width)} field_{offset:x};")
        position = offset + width // 8
    lines.append("};")
    return "\n".join(lines)


def decompile(elf: ElfObject, name: str, recognize_division: bool = True, signatures: dict[str, tuple[tuple[int, ...], int]] | None = None) -> Decompiled:
    graph = build_cfg(elf, name)
    fn = lift_function(elf, graph, signatures)
    ir_text = IrPrinter(fn, versions=False).dump()
    phis = to_ssa(fn)
    ssa_text = IrPrinter(fn, versions=True).dump()
    report = optimize(fn, recognize_division)
    optimized_text = IrPrinter(fn, versions=True).dump()
    signature = recover_signature(fn)
    emitter = Emitter(fn)
    uses = count_uses(fn)
    body, gotos = structure(fn, lambda stmt: emitter.statement(stmt, uses), emitter.condition)
    table_widths: dict[str, int] = {}
    for stmt in fn.statements():
        for expr in stmt_exprs(stmt):
            for node in iter_nodes(expr):
                if isinstance(node, Index) and isinstance(node.base, Symbolic):
                    table_widths[emitter.table_name(node.base)] = node.width
    tables: dict[str, dict[str, Any]] = {}
    data_definitions = []
    for label, (section, offset) in sorted(fn.tables.items(), key=lambda kv: kv[1]):
        width = table_widths.get(label, 32)
        values = table_values(elf, section, offset, width)
        tables[label] = {"section": section, "offset": offset, "width": width, "values": values}
        data_definitions.append(f"static const {ctype(width)} {label}[{len(values)}] = {{{', '.join(map(str, values))}}};")
    struct_definitions = [struct_definition(struct_name, fields) for struct_name, fields in sorted(fn.structs.items())]
    params = ", ".join(declaration(p.ctype, p.name) for p in signature.params) or "void"
    used = {emitter.name(v) for s in fn.statements() for e in stmt_exprs(s) for v in variables(e)}
    used |= {emitter.name(s.dst) for s in fn.statements() if isinstance(s, (Assign, Phi))}
    declared = sorted(n for n in used if not n.startswith("param_"))
    header = [f"{fn.return_type} {name}({params})", "{"]
    header.extend(f"  {declaration(fn.web_types.get(label, 'int'), label)};" for label in declared)
    if declared:
        header.append("")
    pseudocode = "\n".join(header + body + ["}"])
    unknowns = list(fn.notes)
    for register in fn.undefined_reads:
        unknowns.append(f"%{register} is read before any write and is not an argument register")
    for label, info in tables.items():
        unknowns.append(f"{label} length {len(info['values'])} comes from the next referenced offset in {info['section']}; the bounds check is the only other witness")
    for param in signature.params:
        if param.signedness == "none":
            unknowns.append(f"{param.name}: no instruction fixes signedness; {param.ctype} is a default")
        elif param.signedness == "mixed":
            unknowns.append(f"{param.name}: both signed and unsigned instructions touch the value; the signed type is kept with casts at the unsigned uses")
        elif param.signedness == "unsigned-compare":
            unknowns.append(f"{param.name}: only an unsigned compare touches the value, the range-check idiom; the signed type is kept with a cast at that compare")
        if param.ctype.startswith("struct"):
            unknowns.append(f"{param.name}: field names, fields the function never touches, and const are not visible in the instructions")
        elif param.ctype.endswith("*"):
            unknowns.append(f"{param.name}: const and the element count behind the pointer are not visible in the instructions")
    if gotos:
        unknowns.append(f"{gotos} goto statement(s) remain: a region did not match any shape")
    if fn.return_type == "void":
        unknowns.append("no path writes %rax before the return; void is a guess that a caller could contradict")
    return Decompiled(name, graph, fn, signature, ir_text, ssa_text, optimized_text, body, pseudocode, struct_definitions, data_definitions, tables, report, phis, gotos, list(fn.notes), unknowns, compare_constants(fn))


def decompile_all(elf: ElfObject, recognize_division: bool = True, functions: list[str] | None = None) -> dict[str, Decompiled]:
    signatures: dict[str, tuple[tuple[int, ...], int]] = {}
    results: dict[str, Decompiled] = {}
    for symbol in elf.functions():
        if functions and symbol.name not in functions:
            continue
        result = decompile(elf, symbol.name, recognize_division, signatures)
        widths = tuple(result.function.param_widths[p] for p in result.function.params)
        signatures[symbol.name] = (widths, result.signature.return_width or 32)
        results[symbol.name] = result
    return results


def translation_unit(results: dict[str, Decompiled]) -> str:
    structs: dict[str, str] = {}
    tables: dict[str, str] = {}
    for result in results.values():
        for definition in result.struct_definitions:
            structs.setdefault(definition.split("\n", 1)[0], definition)
        for definition in result.data_definitions:
            tables.setdefault(definition.split("[", 1)[0], definition)
    parts = list(structs.values()) + list(tables.values()) + [result.pseudocode for result in results.values()]
    return "\n\n".join(parts) + "\n"
