
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .decoder import DecodeError, Imm, IndirectOperand, Instruction, Mem, Reg, SweepResult, decode, linear_sweep
from .elf import ElfObject, relocation_target, symbol_base

EXIT = -1


@dataclass(frozen=True)
class JumpTable:
    section: str
    offset: int
    entry_size: int
    count: int
    targets: tuple[int, ...]
    evidence: str
    bounds_instruction: int | None
    lea_instruction: int
    load_instruction: int
    jump_instruction: int | None
    index_register: str

    @property
    def is_jump_table(self) -> bool:
        return self.jump_instruction is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "jump-table" if self.is_jump_table else "value-table",
            "table": f"{self.section}+0x{self.offset:x}",
            "entrySize": self.entry_size,
            "count": self.count,
            "entries": [f"0x{value:x}" for value in self.targets] if self.is_jump_table else list(self.targets),
            "evidence": self.evidence,
            "boundsCheck": None if self.bounds_instruction is None else f"0x{self.bounds_instruction:x}",
            "lea": f"0x{self.lea_instruction:x}",
            "load": f"0x{self.load_instruction:x}",
            "jump": None if self.jump_instruction is None else f"0x{self.jump_instruction:x}",
            "indexRegister": self.index_register,
        }


Resolver = Callable[[Instruction, dict[int, Instruction]], "JumpTable | None"]


@dataclass
class Descent:
    instructions: dict[int, Instruction]
    order: list[int]
    unresolved: list[Instruction]
    conflicts: list[tuple[int, int]]
    calls: list[tuple[int, int | None]]
    tables: dict[int, JumpTable]

    def sorted_instructions(self) -> list[Instruction]:
        return [self.instructions[address] for address in sorted(self.instructions)]

    def claimed_bytes(self) -> set[int]:
        claimed: set[int] = set()
        for instruction in self.instructions.values():
            claimed.update(range(instruction.address, instruction.end))
        return claimed


def recursive_descent(code: bytes, entries: list[int], end: int | None = None, resolver: Resolver | None = None) -> Descent:
    raise NotImplementedError("Stage 3: implement recursive_descent")


def _register_name(operand: Any) -> str | None:
    if isinstance(operand, Reg):
        return operand.name
    if isinstance(operand, IndirectOperand) and isinstance(operand.inner, Reg):
        return operand.inner.name
    return None


def _writes(instruction: Instruction) -> str | None:
    if instruction.op in ("cmp", "test", "nop", "push", "jcc", "jmp", "call", "ret"):
        return None
    if not instruction.operands:
        return None
    last = instruction.operands[-1]
    return _family(last.name) if isinstance(last, Reg) else None


def _family(name: str) -> str:
    from .decoder import REGISTERS

    for width, names in REGISTERS.items():
        if name in names:
            return REGISTERS[64][names.index(name)]
    return name


def bounds_check(instructions: list[Instruction], before: int) -> tuple[int | None, int | None]:
    raise NotImplementedError("Stage 3: implement bounds_check")


def recover_table(elf: ElfObject, instructions: list[Instruction], load: Instruction, jump: Instruction | None, section: str = ".text") -> JumpTable | None:
    raise NotImplementedError("Stage 3: implement recover_table")


def jump_table_resolver(elf: ElfObject, section: str = ".text") -> Resolver:

    raise NotImplementedError("Stage 3: implement jump_table_resolver")


def find_value_tables(elf: ElfObject, instructions: list[Instruction], section: str = ".text") -> list[JumpTable]:
    tables: list[JumpTable] = []
    for instruction in instructions:
        if instruction.op not in ("mov", "movsxd", "movzx", "movsx") or instruction.memory is None:
            continue
        if instruction.memory.base is None or instruction.memory.index is None:
            continue
        following = [i for i in instructions if i.address > instruction.address][:3]
        if any(i.flow == "indirect-jump" for i in following):
            continue
        table = recover_table(elf, instructions, instruction, None, section)
        if table is not None:
            tables.append(table)
    return tables


@dataclass
class Block:
    start: int
    instructions: list[Instruction]
    successors: list[tuple[int, str]] = field(default_factory=list)

    @property
    def end(self) -> int:
        return self.instructions[-1].end

    @property
    def last(self) -> Instruction:
        return self.instructions[-1]


class ControlFlowGraph:

    def __init__(self, entry: int, instructions: list[Instruction], tables: dict[int, JumpTable] | None = None) -> None:
        self.entry = entry
        self.tables = tables or {}
        self.instructions = sorted(instructions, key=lambda i: i.address)
        if not self.instructions or entry not in {i.address for i in self.instructions}:
            raise ValueError(f"entry 0x{entry:x} is not the address of a decoded instruction")
        self.blocks: dict[int, Block] = {}
        self.unresolved: list[int] = []
        self._build()
        self.edges: list[tuple[int, int, str]] = [(b.start, target, kind) for b in self.blocks.values() for target, kind in b.successors]
        self._idom: dict[int, int] | None = None

    def _leaders(self) -> set[int]:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph._leaders")

    def _build(self) -> None:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph._build")

    def successors(self, start: int) -> list[int]:
        return [target for target, _kind in self.blocks[start].successors]

    def predecessors(self, start: int) -> list[int]:
        return [source for source, target, _kind in self.edges if target == start]

    def reverse_postorder(self) -> list[int]:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph.reverse_postorder")

    def reachable(self) -> set[int]:
        return set(self.reverse_postorder())

    def unreachable(self) -> list[int]:
        reachable = self.reachable()
        return [start for start in sorted(self.blocks) if start not in reachable]

    def dominators(self) -> dict[int, int]:
        if self._idom is None:
            order = self.reverse_postorder()
            self._idom = immediate_dominators(self.entry, order, self.predecessors)
        return self._idom

    def dominates(self, dominator: int, start: int) -> bool:
        return dominates(self.dominators(), dominator, start)

    def dominance_frontiers(self) -> dict[int, set[int]]:
        return dominance_frontiers(self.dominators(), self.predecessors)

    def post_dominators(self) -> dict[int, int]:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph.post_dominators")

    def back_edges(self) -> list[tuple[int, int]]:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph.back_edges")

    def natural_loops(self) -> dict[int, set[int]]:
        raise NotImplementedError("Stage 3: implement ControlFlowGraph.natural_loops")

    def summary(self) -> dict[str, Any]:
        idom = self.dominators()
        return {
            "blocks": len(self.blocks),
            "edges": len(self.edges),
            "unreachableBlocks": [f"0x{s:x}" for s in self.unreachable()],
            "unresolvedIndirectJumps": [f"0x{a:x}" for a in self.unresolved],
            "backEdges": [f"0x{s:x}->0x{t:x}" for s, t in self.back_edges()],
            "immediateDominators": {f"0x{s:x}": f"0x{d:x}" for s, d in sorted(idom.items())},
        }


def immediate_dominators(entry: int, order: list[int], predecessors: Callable[[int], list[int]]) -> dict[int, int]:
    raise NotImplementedError("Stage 3: implement immediate_dominators")


def dominates(idom: dict[int, int], dominator: int, start: int) -> bool:
    while True:
        if start == dominator:
            return True
        parent = idom.get(start, start)
        if parent == start:
            return False
        start = parent


def dominance_frontiers(idom: dict[int, int], predecessors: Callable[[int], list[int]]) -> dict[int, set[int]]:
    raise NotImplementedError("Stage 3: implement dominance_frontiers")


@dataclass
class FunctionGraph:
    name: str
    start: int
    end: int
    padding_end: int
    sweep: SweepResult
    descent: Descent
    plain_descent: Descent
    cfg: ControlFlowGraph
    value_tables: list[JumpTable]

    def to_dict(self) -> dict[str, Any]:
        return {
            "function": self.name,
            "range": f"0x{self.start:x}-0x{self.end:x}",
            "paddingBytes": self.padding_end - self.end,
            "linearSweepInstructions": len(self.sweep.instructions),
            "descentInstructions": len(self.descent.instructions),
            "unresolvedWithoutTables": [f"0x{i.address:x}" for i in self.plain_descent.unresolved],
            **self.cfg.summary(),
            "tables": [t.to_dict() for t in self.descent.tables.values()] + [t.to_dict() for t in self.value_tables],
        }


def build_cfg(elf: ElfObject, name: str, section: str = ".text") -> FunctionGraph:
    code = elf.section(section).data
    start, end, padding_end = elf.function_extent(name, section)
    sweep = linear_sweep(code, start, padding_end)
    plain = recursive_descent(code, [start], padding_end)
    resolved = recursive_descent(code, [start], padding_end, jump_table_resolver(elf, section))
    cfg = ControlFlowGraph(start, resolved.sorted_instructions(), resolved.tables)
    value_tables = find_value_tables(elf, resolved.sorted_instructions(), section)
    return FunctionGraph(name, start, end, padding_end, sweep, resolved, plain, cfg, value_tables)
