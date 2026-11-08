
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
    end = len(code) if end is None else end
    if any(entry < 0 or entry >= end for entry in entries):
        raise ValueError(f"entry outside the code range 0..0x{end:x}: {[hex(e) for e in entries]}")
    instructions: dict[int, Instruction] = {}
    order: list[int] = []
    unresolved: list[Instruction] = []
    conflicts: list[tuple[int, int]] = []
    calls: list[tuple[int, int | None]] = []
    tables: dict[int, JumpTable] = {}
    worklist = list(reversed(entries))
    while worklist:
        address = worklist.pop()
        while 0 <= address < end and address not in instructions:
            inside = next((i for i in instructions.values() if i.covers(address)), None)
            if inside is not None:
                conflicts.append((address, inside.address))
                break
            try:
                instruction = decode(code[:end], address)
            except DecodeError:
                unresolved.append(Instruction(address, code[address : address + 1], "(undecodable)", (), 0, flow="stop"))
                break
            instructions[address] = instruction
            order.append(address)
            if instruction.flow == "return":
                break
            if instruction.flow == "jump":
                address = instruction.target if instruction.target is not None else end
                continue
            if instruction.flow == "branch":
                worklist.append(instruction.target if instruction.target is not None else end)
                address = instruction.end
                continue
            if instruction.flow == "call":
                calls.append((instruction.address, instruction.target))
                address = instruction.end
                continue
            if instruction.flow == "indirect-jump":
                table = resolver(instruction, instructions) if resolver else None
                if table is None:
                    unresolved.append(instruction)
                    break
                tables[instruction.address] = table
                worklist.extend(sorted(set(table.targets), reverse=True))
                break
            if instruction.flow == "indirect-call":
                calls.append((instruction.address, None))
            address = instruction.end
    return Descent(instructions, order, unresolved, conflicts, calls, tables)


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
    earlier = [i for i in instructions if i.address < before]
    for position in range(len(earlier) - 1, 0, -1):
        guard, compare = earlier[position], earlier[position - 1]
        if guard.op == "jcc" and guard.cc == "a" and compare.op in ("cmp", "sub") and isinstance(compare.operands[0], Imm):
            return compare.operands[0].value, compare.address
    return None, None


def recover_table(elf: ElfObject, instructions: list[Instruction], load: Instruction, jump: Instruction | None, section: str = ".text") -> JumpTable | None:
    memory = load.memory
    if memory is None or memory.base is None or memory.index is None:
        return None
    lea = None
    for candidate in reversed([i for i in instructions if i.address < load.address]):
        if candidate.op == "lea" and candidate.memory is not None and candidate.memory.rip and _register_name(candidate.operands[1]) == memory.base:
            lea = candidate
            break
        if _writes(candidate) == _family(memory.base):
            return None
    if lea is None or lea.displacement_offset is None:
        return None
    relocation = elf.relocation_at(section, lea.address + lea.displacement_offset)
    if relocation is None:
        return None
    table_at = relocation_target(relocation, lea.end)
    if not elf.has_section(table_at.section):
        return None
    limit, bounds_address = bounds_check(instructions, load.address)
    if limit is None:
        return None
    count = limit + 1
    entry_size = memory.scale
    table_data = elf.section(table_at.section).data
    entries: list[int] = []
    evidence = "bytes"
    for index in range(count):
        entry_offset = table_at.offset + index * entry_size
        entry_relocation = elf.relocation_at(table_at.section, entry_offset)
        if entry_relocation is not None and entry_relocation.pc_relative:
            entries.append(symbol_base(entry_relocation.symbol) + entry_relocation.addend + (table_at.offset - entry_offset))
            evidence = "relocation"
            continue
        raw = table_data[entry_offset : entry_offset + entry_size]
        if len(raw) < entry_size:
            return None
        value = int.from_bytes(raw, "little", signed=jump is not None)
        entries.append(table_at.offset + value if jump is not None else value)
    return JumpTable(table_at.section, table_at.offset, entry_size, count, tuple(entries), evidence, bounds_address, lea.address, load.address, None if jump is None else jump.address, _family(memory.index))


def jump_table_resolver(elf: ElfObject, section: str = ".text") -> Resolver:

    def resolve(jump: Instruction, decoded: dict[int, Instruction]) -> JumpTable | None:
        register = _register_name(jump.operands[0]) if jump.operands else None
        if register is None:
            return None
        instructions = [decoded[a] for a in sorted(decoded) if a < jump.address]
        add = next((i for i in reversed(instructions) if i.op == "add" and _register_name(i.operands[1]) == register), None)
        if add is None:
            return None
        base = _register_name(add.operands[0])
        load = next(
            (i for i in reversed(instructions) if i.address < add.address and i.op == "movsxd" and _register_name(i.operands[1]) == register and i.memory is not None and i.memory.base == base),
            None,
        )
        if load is None:
            return None
        return recover_table(elf, instructions, load, jump, section)

    return resolve


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
        leaders = {self.entry}
        addresses = {i.address for i in self.instructions}
        for position, instruction in enumerate(self.instructions):
            if instruction.flow in ("jump", "branch", "return", "indirect-jump"):
                if position + 1 < len(self.instructions):
                    leaders.add(self.instructions[position + 1].address)
            if instruction.flow in ("jump", "branch") and instruction.target in addresses:
                leaders.add(instruction.target)
            if instruction.address in self.tables:
                leaders.update(t for t in self.tables[instruction.address].targets if t in addresses)
        return leaders

    def _build(self) -> None:
        leaders = self._leaders()
        current: Block | None = None
        for instruction in self.instructions:
            if instruction.address in leaders or current is None or current.end != instruction.address:
                current = Block(instruction.address, [])
                self.blocks[instruction.address] = current
            current.instructions.append(instruction)
        starts = sorted(self.blocks)
        for position, start in enumerate(starts):
            block = self.blocks[start]
            last = block.last
            following = starts[position + 1] if position + 1 < len(starts) else None
            falls_through = following is not None and following == block.end
            if last.flow == "return":
                continue
            if last.flow == "jump":
                if last.target in self.blocks:
                    block.successors.append((last.target, "jump"))
                continue
            if last.flow == "branch":
                if last.target in self.blocks:
                    block.successors.append((last.target, "taken"))
                if falls_through:
                    block.successors.append((following, "fallthrough"))
                continue
            if last.flow == "indirect-jump":
                table = self.tables.get(last.address)
                if table is None:
                    self.unresolved.append(last.address)
                    continue
                for target in sorted(set(table.targets)):
                    if target in self.blocks:
                        block.successors.append((target, "table"))
                continue
            if falls_through:
                block.successors.append((following, "fallthrough"))

    def successors(self, start: int) -> list[int]:
        return [target for target, _kind in self.blocks[start].successors]

    def predecessors(self, start: int) -> list[int]:
        return [source for source, target, _kind in self.edges if target == start]

    def reverse_postorder(self) -> list[int]:
        seen: set[int] = set()
        postorder: list[int] = []

        def visit(start: int) -> None:
            seen.add(start)
            for target in self.successors(start):
                if target not in seen:
                    visit(target)
            postorder.append(start)

        visit(self.entry)
        return list(reversed(postorder))

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
        reachable = self.reachable()
        exits = [start for start in reachable if not self.successors(start)]
        reverse_succ: dict[int, list[int]] = {EXIT: exits}
        reverse_pred: dict[int, list[int]] = {EXIT: []}
        for start in reachable:
            reverse_succ[start] = [p for p in self.predecessors(start) if p in reachable]
            reverse_pred[start] = list(self.successors(start)) + ([EXIT] if start in exits else [])
        seen: set[int] = set()
        postorder: list[int] = []

        def visit(node: int) -> None:
            seen.add(node)
            for target in reverse_succ.get(node, []):
                if target not in seen:
                    visit(target)
            postorder.append(node)

        visit(EXIT)
        order = list(reversed(postorder))
        return immediate_dominators(EXIT, order, lambda node: reverse_pred.get(node, []))

    def back_edges(self) -> list[tuple[int, int]]:
        reachable = self.reachable()
        return [(source, target) for source, target, _kind in self.edges if source in reachable and target in reachable and self.dominates(target, source)]

    def natural_loops(self) -> dict[int, set[int]]:
        loops: dict[int, set[int]] = {}
        for source, header in self.back_edges():
            body = {header}
            stack = [source]
            while stack:
                node = stack.pop()
                if node in body:
                    continue
                body.add(node)
                stack.extend(self.predecessors(node))
            loops.setdefault(header, set()).update(body)
        return loops

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
    number = {start: position for position, start in enumerate(order)}
    idom: dict[int, int] = {entry: entry}

    def intersect(first: int, second: int) -> int:
        while first != second:
            while number[first] > number[second]:
                first = idom[first]
            while number[second] > number[first]:
                second = idom[second]
        return first

    changed = True
    while changed:
        changed = False
        for start in order[1:]:
            processed = [p for p in predecessors(start) if p in idom]
            if not processed:
                continue
            candidate = processed[0]
            for other in processed[1:]:
                candidate = intersect(other, candidate)
            if idom.get(start) != candidate:
                idom[start] = candidate
                changed = True
    return idom


def dominates(idom: dict[int, int], dominator: int, start: int) -> bool:
    while True:
        if start == dominator:
            return True
        parent = idom.get(start, start)
        if parent == start:
            return False
        start = parent


def dominance_frontiers(idom: dict[int, int], predecessors: Callable[[int], list[int]]) -> dict[int, set[int]]:
    frontier: dict[int, set[int]] = {node: set() for node in idom}
    for node in idom:
        preds = [p for p in predecessors(node) if p in idom]
        is_root = idom[node] == node
        if len(preds) < 2 and not (is_root and preds):
            continue
        for pred in preds:
            runner = pred
            while is_root or runner != idom[node]:
                frontier[runner].add(node)
                if idom[runner] == runner:
                    break
                runner = idom[runner]
    return frontier


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
