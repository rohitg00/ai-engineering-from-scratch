import json
import logging
import sys
import time
from pathlib import Path

for name in ("angr", "cle", "pyvex", "claripy"):
    logging.getLogger(name).setLevel(logging.CRITICAL)

import angr
from angr import claripy

HERE = Path(__file__).resolve().parent
OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o"]
VALUES_ADDRESS = 0x500000
VALUES = list(range(1, 10))
TOTAL_BOUNDS = [2, 4, 8]


def signed32(value):
    value &= 0xFFFFFFFF
    return value - (1 << 32) if value & 0x80000000 else value


def timed(action):
    start = time.perf_counter()
    result = action()
    return result, round(time.perf_counter() - start, 3)


def project_of(name):
    return angr.Project(str(HERE / name), auto_load_libs=False)


def address_of(project, symbol):
    return project.loader.find_symbol(symbol).rebased_addr


def loader_facts(project):
    main = project.loader.main_object
    return {
        "backend": type(main).__name__,
        "minAddress": hex(main.min_addr),
        "relocations": len(main.relocs),
        "symbols": {name: hex(address_of(project, name)) for name in ("percent_change", "grade", "total", "grade_label")},
    }


def percent_change_run(project):
    entry = address_of(project, "percent_change")
    before = claripy.BVS("before", 64)
    after = claripy.BVS("after", 64)
    state = project.factory.call_state(entry, before, after)
    manager = project.factory.simulation_manager(state)
    _, seconds = timed(manager.run)
    paths = []
    for leaf in manager.deadended:
        result = leaf.regs.eax
        record = {"constraints": [str(c) for c in leaf.solver.constraints]}
        wanted = leaf.copy()
        wanted.add_constraints(result == 50)
        if wanted.satisfiable():
            b = wanted.solver.eval(before[31:0])
            a = wanted.solver.eval(after[31:0], extra_constraints=[before[31:0] == b])
            record["returns50"] = {"before": signed32(b), "after": signed32(a)}
        else:
            record["returns50"] = None
        overflow = leaf.copy()
        overflow.add_constraints(result == claripy.BVV(0xFFFFFF7B, 32), before[31:0] == 3)
        record["before3ReturnsMinus133"] = signed32(overflow.solver.eval(after[31:0])) if overflow.satisfiable() else None
        paths.append(record)
    return {"deadended": len(manager.deadended), "seconds": seconds, "paths": paths}


def grade_classes(manager, score):
    low = score[31:0]
    classes = {}
    for value in range(5):
        hits = []
        for leaf in manager.deadended:
            wanted = leaf.copy()
            wanted.add_constraints(leaf.regs.eax == value)
            if not wanted.satisfiable():
                continue
            hits.append({
                "min": signed32(wanted.solver.min(low, signed=True)),
                "max": signed32(wanted.solver.max(low, signed=True)),
                "samples": sorted(signed32(v) for v in wanted.solver.eval_upto(low, 3)),
            })
        classes[str(value)] = hits
    return classes


def grade_cross_checks(manager, score):
    low = score[31:0]
    inside_zero = False
    above_nonzero = False
    for leaf in manager.deadended:
        probe = leaf.copy()
        probe.add_constraints(claripy.SGE(low, 60), claripy.SLE(low, 109), leaf.regs.eax == 0)
        inside_zero = inside_zero or probe.satisfiable()
        probe = leaf.copy()
        probe.add_constraints(claripy.SGE(low, 110), leaf.regs.eax != 0)
        above_nonzero = above_nonzero or probe.satisfiable()
    return {"scoreIn60to109ReturnsZero": "sat" if inside_zero else "unsat", "scoreAtLeast110ReturnsNonZero": "sat" if above_nonzero else "unsat"}


def grade_run(project, name):
    entry = address_of(project, "grade")
    score = claripy.BVS("score", 64)
    state = project.factory.call_state(entry, score)
    manager = project.factory.simulation_manager(state)
    _, seconds = timed(manager.run)
    record = {
        "deadended": len(manager.deadended),
        "seconds": seconds,
        "returns": grade_classes(manager, score),
        "crossChecks": grade_cross_checks(manager, score),
    }
    if name == "ledger-x86_64-O0.o":
        record["explore"] = grade_explore(project, entry)
    return record


def grade_explore(project, entry):
    cfg = project.analyses.CFGFast(normalize=True)
    function = cfg.kb.functions[entry]
    blocks = sorted(block.addr for block in function.blocks)
    target = None
    for block in function.blocks:
        for insn in block.capstone.insns:
            if insn.mnemonic == "mov" and insn.op_str == "dword ptr [rbp - 4], 4":
                target = block.addr
    score = claripy.BVS("score", 64)
    state = project.factory.call_state(entry, score)
    manager = project.factory.simulation_manager(state)
    _, seconds = timed(lambda: manager.explore(find=target))
    found = manager.found[0]
    low = score[31:0]
    return {
        "blocks": [hex(b) for b in blocks],
        "find": hex(target),
        "found": len(manager.found),
        "active": len(manager.active),
        "seconds": seconds,
        "min": signed32(found.solver.min(low, signed=True)),
        "max": signed32(found.solver.max(low, signed=True)),
        "samples": sorted(signed32(v) for v in found.solver.eval_upto(low, 5)),
    }


def total_run(project):
    entry = address_of(project, "total")
    results = []
    for bound in TOTAL_BOUNDS:
        count = claripy.BVS("count", 64)
        state = project.factory.call_state(entry, claripy.BVV(VALUES_ADDRESS, 64), count)
        for index, value in enumerate(VALUES):
            state.memory.store(VALUES_ADDRESS + 4 * index, claripy.BVV(value, 32), endness=state.arch.memory_endness)
        low = count[31:0]
        state.add_constraints(claripy.SGE(low, 0), claripy.SLE(low, bound))
        manager = project.factory.simulation_manager(state)
        _, seconds = timed(manager.run)
        pairs = sorted((leaf.solver.eval(low), signed32(leaf.solver.eval(leaf.regs.eax))) for leaf in manager.deadended)
        results.append({"bound": bound, "deadended": len(manager.deadended), "seconds": seconds, "countSum": pairs})
    return results


def main():
    report = {"angr": angr.__version__, "python": sys.version.split()[0], "claripy": claripy.__name__, "objects": {}}
    for name in OBJECTS:
        project = project_of(name)
        report["objects"][name] = {
            "loader": loader_facts(project),
            "percent_change": percent_change_run(project),
            "grade": grade_run(project, name),
            "total": total_run(project),
        }
    out = HERE / "angr-runs.json"
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
