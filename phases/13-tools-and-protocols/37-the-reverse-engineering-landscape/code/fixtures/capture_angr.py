import json
import logging
import sys
from pathlib import Path

for noisy in ("angr", "cle", "pyvex", "claripy"):
    logging.getLogger(noisy).setLevel(logging.CRITICAL)

import angr
import archinfo
import cle
import pyvex


def capture(path: Path) -> dict:
    project = angr.Project(str(path), auto_load_libs=False)
    main = project.loader.main_object
    cfg = project.analyses.CFGFast(normalize=True, data_references=True)
    symbol_names = {s.name for s in main.symbols if s.is_function}
    functions = []
    for function in sorted(cfg.kb.functions.values(), key=lambda f: f.addr):
        if function.is_simprocedure or function.is_plt:
            continue
        blocks = []
        for block in sorted(function.blocks, key=lambda b: b.addr):
            instructions = []
            for insn in block.capstone.insns:
                instructions.append({"addr": insn.address, "size": insn.size, "bytes": insn.bytes.hex(), "text": f"{insn.mnemonic} {insn.op_str}".strip()})
            blocks.append({"addr": block.addr, "size": block.size, "instructions": instructions, "vexStatements": len(block.vex.statements), "jumpkind": block.vex.jumpkind})
        edges = []
        for source, target, data in function.transition_graph.edges(data=True):
            edges.append({"from": source.addr, "to": target.addr, "type": str(data.get("type")), "outside": bool(data.get("outside", False)), "target": type(target).__name__})
        edges.sort(key=lambda e: (e["from"], e["to"], e["type"]))
        decompiled = None
        decompile_error = None
        if function.name in symbol_names:
            try:
                result = project.analyses.Decompiler(function, cfg=cfg.model)
                decompiled = result.codegen.text if result.codegen else None
            except Exception as error:
                decompile_error = f"{type(error).__name__}: {error}"
        functions.append({
            "name": function.name,
            "addr": function.addr,
            "size": function.size,
            "fromSymbol": function.name in symbol_names,
            "blocks": blocks,
            "edges": edges,
            "decompiled": decompiled,
            "decompileError": decompile_error,
        })
    memory_data = []
    for addr, item in sorted(cfg.model.memory_data.items()):
        memory_data.append({"addr": addr, "size": item.size, "sort": str(item.sort)})
    sections = {}
    for section in main.sections:
        if section.name in (".text", ".rodata", ".data", ".rodata.str1.1"):
            sections[section.name] = {"vaddr": section.vaddr, "size": section.memsize}
    return {
        "tool": "angr",
        "versions": {"angr": angr.__version__, "pyvex": pyvex.__version__, "cle": cle.__version__, "archinfo": archinfo.__version__},
        "fixture": path.name,
        "command": f"venv/bin/python capture_angr.py {path.name} OUT.json",
        "analysis": "angr.Project(path, auto_load_libs=False); project.analyses.CFGFast(normalize=True, data_references=True); project.analyses.Decompiler(function, cfg=cfg.model)",
        "loader": type(main).__name__,
        "arch": project.arch.name,
        "base": main.min_addr,
        "sections": sections,
        "relocations": len(main.relocs),
        "functions": functions,
        "memoryData": memory_data,
    }


if __name__ == "__main__":
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.write_text(json.dumps(capture(source), indent=1) + "\n")
    print(f"wrote {output}")
