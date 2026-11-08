import logging
import sys

import angr

for name in ("angr", "cle", "pyvex", "claripy"):
    logging.getLogger(name).setLevel(logging.CRITICAL)

path = sys.argv[1]
project = angr.Project(path, auto_load_libs=False)
cfg = project.analyses.CFGFast(normalize=True, force_complete_scan=False)
project.analyses.CompleteCallingConventions(recover_variables=True, analyze_callsites=True, cfg=cfg)
print(f"angr {angr.__version__} {path} arch={project.arch.name}")
for name in ("leaf_add", "eight_args", "mixed", "by_value", "big_ret", "sum_varargs", "keeps"):
    function = project.kb.functions.function(name=name)
    if function is None:
        print(f"[cc {name}]\nmissing")
        continue
    convention = type(function.calling_convention).__name__ if function.calling_convention else "None"
    print(f"[cc {name}]\n{convention}")
    print(f"[prototype {name}]\n{function.prototype}")
