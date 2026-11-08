import hashlib
import importlib.util
import json
import platform
import sys
import timeit
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LESSONS = ROOT / "phases" / "13-tools-and-protocols"
OUT = HERE / "fixture.mjs"
TIMING = HERE / "timing.mjs"


def lesson(folder: str, alias: str):
    path = LESSONS / folder / "code" / "main.py"
    spec = importlib.util.spec_from_file_location(alias, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)
    return module


L32 = lesson("32-program-anatomy-elf-from-scratch", "re_l32")
L33 = lesson("33-disassembly-and-control-flow", "re_l33")
L34 = lesson("34-lifting-to-pseudocode", "re_l34")

FIXTURES = LESSONS / "33-disassembly-and-control-flow" / "code" / "fixtures"
PROGRAMS = {
    "ledger-O0": ("ledger-x86_64-O0.o", "percent_change"),
    "ledger-O2": ("ledger-x86_64-O2.o", "percent_change"),
    "trap": ("sweep-trap.o", "lookup"),
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def hexa(value: int) -> str:
    return f"0x{value:x}"


def instructions(listing):
    return [{"a": i.address, "n": i.length, "hex": i.hex, "text": " ".join(i.text.split()), "flow": i.flow} for i in listing]


def graph(entry, listing):
    cfg = L33.ControlFlowGraph(entry, listing)
    reach = cfg.reachable()
    layer = {entry: 0}
    for start in cfg.reverse_postorder()[1:]:
        before = [p for p in cfg.predecessors(start) if p in layer]
        layer[start] = 1 + max(layer[p] for p in before) if before else 0
    blocks = []
    for block in sorted(cfg.blocks.values(), key=lambda b: b.start):
        blocks.append({"s": block.start, "e": block.end, "n": len(block.instructions), "live": block.start in reach, "layer": layer.get(block.start)})
    edges = [{"f": f, "t": t, "k": k} for f, t, k in cfg.edges]
    return {"blocks": blocks, "edges": edges}


def decode(code, entry, end, method):
    if method == "linear":
        result = L33.linear_sweep(code, entry, end)
        listing = result.instructions
        order = [i.address for i in listing]
    else:
        result = L33.recursive_descent(code, [entry], end)
        listing = result.sorted_instructions()
        order = result.order
    return {"range": [entry, end], "order": order, "insns": instructions(listing), **graph(entry, listing)}


def lifted(path: Path, name: str):
    obj = L34.read_object(path)
    try:
        result = L34.lift_function(obj, name)
    except L34.DecodeError as error:
        return {"error": str(error)}
    fn = result.function
    count = lambda text: sum(1 for line in text.splitlines() if line.startswith("  "))
    phis = sum(1 for line in result.ssa_text.splitlines() if "= phi(" in line)
    names = sorted({key[0] for key in fn.def_width})
    return {
        "ir": result.ir_text.strip("\n").splitlines(),
        "ssa": result.ssa_text.strip("\n").splitlines(),
        "irCount": count(result.ir_text),
        "ssaCount": count(result.ssa_text),
        "phis": phis,
        "registers": names,
        "params": [{"name": f"param_{i + 1}", "register": reg, "type": fn.web_types.get(f"param_{i + 1}", "long")} for i, reg in enumerate(fn.params)],
        "locals": [{"name": label, "type": kind} for label, kind in sorted(fn.web_types.items()) if not label.startswith("param_")],
        "returns": fn.return_type,
        "pseudocode": result.pseudocode.splitlines(),
    }


def program(key: str):
    file, name = PROGRAMS[key]
    path = FIXTURES / file
    data = path.read_bytes()
    elf32 = L32.ElfFile(data)
    elf33 = L33.ElfObject(data)
    text = elf33.section(".text")
    start, end, gap = elf33.function_extent(name)
    h = elf32.header
    sections = [{"name": s.name, "type": s.type_name, "offset": s.sh_offset, "size": s.sh_size} for s in elf32.sections if s.index]
    functions = [{"name": s.name, "value": s.st_value, "size": s.st_size, "bind": s.bind} for s in elf32.symbols if s.type == "FUNC"]
    named = [s.name for s in elf32.symbols if s.name]
    out = {
        "file": file,
        "path": rel(path),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "ident": data[:16].hex(" "),
        "header": {"type": h.e_type, "typeName": elf32.header.type_name, "machine": h.e_machine, "machineName": elf32.header.machine_name, "shoff": h.e_shoff, "shnum": h.e_shnum, "shstrndx": h.e_shstrndx},
        "sections": sections,
        "symbolCount": len(named),
        "functions": functions,
        "relocations": len(elf32.relocations_for(".text")),
        "text": {"offset": text.offset, "size": text.size},
        "target": {"name": name, "start": start, "end": end, "gap": gap},
        "fileBytes": data[text.offset + start : text.offset + gap].hex(" "),
        "decode": {},
        "lift": lifted(path, name),
    }
    for symbols, bound in (("named", gap), ("stripped", text.size)):
        out["decode"][symbols] = {method: decode(text.data, start, bound, method) for method in ("descent", "linear")}
    if key == "trap":
        out["trap"] = L33.trap_report(elf33)
    return out


def build() -> str:
    data = {key: program(key) for key in PROGRAMS}
    return "export const FIXTURE = " + json.dumps(data, separators=(",", ":"), sort_keys=True) + ";\n"


def seconds(call) -> float:
    timer = timeit.Timer(call)
    loops, _ = timer.autorange()
    best = min(timer.repeat(repeat=5, number=loops)) / loops
    return float(f"{best:.2g}")


def lift_call(path: Path, name: str):
    def call():
        try:
            L34.lift_function(L34.read_object(path), name)
        except L34.DecodeError:
            pass
    return call


def timing(key: str):
    file, name = PROGRAMS[key]
    path = FIXTURES / file
    data = path.read_bytes()
    elf33 = L33.ElfObject(data)
    text = elf33.section(".text")
    start, end, gap = elf33.function_extent(name)
    out = {"parse": seconds(lambda: L32.ElfFile(data)), "decode": {}, "cfg": {}, "lift": seconds(lift_call(path, name))}
    for symbols, bound in (("named", gap), ("stripped", text.size)):
        out["decode"][symbols] = {
            "descent": seconds(lambda: L33.recursive_descent(text.data, [start], bound)),
            "linear": seconds(lambda: L33.linear_sweep(text.data, start, bound)),
        }
        out["cfg"][symbols] = {}
        for method in ("descent", "linear"):
            if method == "linear":
                listing = L33.linear_sweep(text.data, start, bound).instructions
            else:
                listing = L33.recursive_descent(text.data, [start], bound).sorted_instructions()
            out["cfg"][symbols][method] = seconds(lambda: L33.ControlFlowGraph(start, listing).reachable())
    return out


def write_timing() -> int:
    data = {"machine": f"{platform.system()} {platform.machine()}, Python {platform.python_version()}", "method": "best of 5 timeit repeats", "programs": {key: timing(key) for key in PROGRAMS}}
    TIMING.write_text("export const TIMING = " + json.dumps(data, separators=(",", ":"), sort_keys=True) + ";\n", encoding="utf-8")
    print("wrote", rel(TIMING))
    return 0


def main(argv):
    if "--time" in argv:
        return write_timing()
    text = build()
    if "--check" in argv:
        same = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("fixture.mjs matches the lesson tools" if same else "fixture.mjs differs from the lesson tools")
        return 0 if same else 1
    OUT.write_text(text, encoding="utf-8")
    print("wrote", rel(OUT), len(text), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
