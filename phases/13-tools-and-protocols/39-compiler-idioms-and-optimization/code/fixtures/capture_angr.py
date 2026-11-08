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

FUNCTIONS = ["div10u", "div10s", "div7u", "mod10s", "mod8s", "mul9", "linear_switch", "table_switch", "sparse_switch", "two_cases", "clamp_max", "abs_int", "is_pos", "tail_caller", "twice_sum", "sum_n", "sum4", "fill", "copy16", "digest"]


def capture(path: Path) -> dict:
    project = angr.Project(str(path), auto_load_libs=False)
    cfg = project.analyses.CFGFast(normalize=True, data_references=True)
    wanted = {f.name: f for f in cfg.kb.functions.values() if f.name in FUNCTIONS}
    functions = []
    for name in FUNCTIONS:
        function = wanted.get(name)
        if function is None:
            functions.append({"name": name, "error": "not found"})
            continue
        entry = {"name": name, "addr": function.addr, "blocks": len(list(function.blocks))}
        try:
            result = project.analyses.Decompiler(function, cfg=cfg.model)
            entry["decompiled"] = result.codegen.text if result.codegen else None
        except Exception as error:
            entry["decompiled"] = None
            entry["error"] = f"{type(error).__name__}: {error}"
        functions.append(entry)
    return {
        "tool": "angr",
        "versions": {"angr": angr.__version__, "pyvex": pyvex.__version__, "cle": cle.__version__, "archinfo": archinfo.__version__},
        "fixture": path.name,
        "command": "venv/bin/python capture_angr.py FIXTURE.o OUT.json",
        "analysis": "angr.Project(path, auto_load_libs=False); project.analyses.CFGFast(normalize=True, data_references=True); project.analyses.Decompiler(function, cfg=cfg.model)",
        "arch": project.arch.name,
        "functions": functions,
    }


if __name__ == "__main__":
    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    target.write_text(json.dumps(capture(source), indent=2) + "\n")
    print(f"wrote {target}")
