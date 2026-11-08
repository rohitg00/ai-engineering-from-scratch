import json
import sys
from pathlib import Path

import archinfo
import pypcode
import pyvex

INSTRUCTIONS = [
    {"name": "sub-rsp-16", "hex": "4883ec10", "intel": "sub rsp, 0x10", "att": "subq $0x10, %rsp"},
    {"name": "movsxd-rax-edi", "hex": "4863c7", "intel": "movsxd rax, edi", "att": "movslq %edi, %rax"},
    {"name": "cmp-ecx-4", "hex": "83f904", "intel": "cmp ecx, 4", "att": "cmpl $0x4, %ecx"},
]


def lift_vex(code: bytes) -> list:
    irsb = pyvex.lift(code, 0x1000, archinfo.ArchAMD64())
    return [str(statement) for statement in irsb.statements]


def lift_pcode(code: bytes) -> list:
    context = pypcode.Context("x86:LE:64:default")
    translation = context.translate(code, base_address=0x1000)
    lines = []
    for op in translation.ops:
        lines.append(pypcode.PcodePrettyPrinter.fmt_op(op))
    return lines


if __name__ == "__main__":
    output = Path(sys.argv[1])
    report = {
        "versions": {"pyvex": pyvex.__version__, "pypcode": pypcode.__version__, "sleigh": "x86:LE:64:default"},
        "command": "venv/bin/python capture_ir.py OUT.json",
        "calls": {
            "vex": "pyvex.lift(code, 0x1000, archinfo.ArchAMD64()).statements",
            "pcode": "pypcode.Context('x86:LE:64:default').translate(code, base_address=0x1000).ops",
        },
        "instructions": [],
    }
    for item in INSTRUCTIONS:
        code = bytes.fromhex(item["hex"])
        report["instructions"].append({**item, "vex": lift_vex(code), "pcode": lift_pcode(code)})
    output.write_text(json.dumps(report, indent=1) + "\n")
    print(f"wrote {output}")
