import json
import sys
from pathlib import Path

import capstone
import pypcode

FUNCTIONS = {"div10s": (0x10, 0x28), "mod8s": (0x90, 0xA0)}


def capture(path: Path) -> dict:
    data = path.read_bytes()
    text_offset = 0x40
    out = {"fixture": path.name, "capstone": {"version": capstone.__version__, "cs_version": list(capstone.cs_version()), "functions": {}}, "pypcode": {"version": pypcode.__version__, "language": "x86:LE:64:default", "functions": {}}}
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    md.syntax = capstone.CS_OPT_SYNTAX_ATT
    md.detail = True
    context = pypcode.Context("x86:LE:64:default")
    for name, (start, end) in FUNCTIONS.items():
        code = data[text_offset + start : text_offset + end]
        rows = []
        for insn in md.disasm(code, start):
            rows.append({"addr": insn.address, "bytes": insn.bytes.hex(" "), "text": f"{insn.mnemonic} {insn.op_str}".strip(), "groups": [insn.group_name(g) for g in insn.groups]})
        out["capstone"]["functions"][name] = rows
        translation = context.translate(code, base_address=start)
        out["pypcode"]["functions"][name] = [str(op) for op in translation.ops]
    return out


if __name__ == "__main__":
    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    target.write_text(json.dumps(capture(source), indent=2) + "\n")
    print(f"wrote {target}")
