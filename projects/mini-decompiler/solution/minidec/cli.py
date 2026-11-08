
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def cmd_disasm(args: argparse.Namespace) -> int:
    from .decoder import compare_with_objdump, disassemble
    from .elf import load_object

    elf = load_object(args.object)
    print(disassemble(elf))
    if args.oracle:
        comparison = compare_with_objdump(elf, Path(args.oracle).read_text(encoding="utf-8"))
        print(f"\noracle: {comparison.compared - len(comparison.mismatches)}/{comparison.compared} instructions agree with llvm-objdump", file=sys.stderr)
        for mismatch in comparison.mismatches:
            print(f"  {mismatch}", file=sys.stderr)
        return 0 if comparison.agree else 1
    return 0


def cmd_cfg(args: argparse.Namespace) -> int:
    from .cfg import build_cfg
    from .elf import load_object

    elf = load_object(args.object)
    names = [args.function] if args.function else [s.name for s in elf.functions()]
    report = {name: build_cfg(elf, name).to_dict() for name in names}
    print(json.dumps(report if len(names) > 1 else report[names[0]], indent=2))
    return 0


def cmd_decompile(args: argparse.Namespace) -> int:
    from .elf import load_object
    from .emit import decompile_all, translation_unit

    elf = load_object(args.object)
    results = decompile_all(elf, not args.no_division_idioms, [args.function] if args.function else None)
    if args.ir:
        for result in results.values():
            print(f"== {result.name}: IR before SSA ==\n{result.ir_text}\n-- SSA --\n{result.ssa_text}\n-- optimized --\n{result.optimized_text}\n")
    unit = translation_unit(results)
    if args.out:
        Path(args.out).write_text(unit, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(unit, end="")
    if args.json:
        print(json.dumps({name: result.to_dict() for name, result in results.items()}, indent=2))
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    from .verify import verify

    report = verify(args.object, args.source, args.opt, args.out, [args.function] if args.function else None, not args.no_division_idioms)
    print(json.dumps(summary(report), indent=2))
    return 0 if report["status"] in ("pass", "behaviour-only") else 1


def summary(report: dict) -> dict:
    functions = {}
    for name, entry in report["functions"].items():
        functions[name] = {
            "signature": entry["signature"]["declaration"],
            "behaviour": {k: v for k, v in entry["behaviour"].items() if k in ("status", "cells", "mismatchCount", "trapCells", "reason")},
            "bytes": {"status": entry["bytes"]["status"], "reasons": entry["bytes"].get("reasons", [])},
            "unknowns": entry["unknowns"],
        }
    return {
        "object": report["object"],
        "optimization": report["optimization"],
        "host": report["host"],
        "compiler": report["compiler"],
        "status": report["status"],
        "functions": functions,
        "outputs": report["outputs"],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="minidec", description="Decompile x86-64 ELF relocatable objects you compiled, then prove the output.")
    sub = parser.add_subparsers(dest="command", required=True)

    disasm = sub.add_parser("disasm", help="list every instruction with relocation targets")
    disasm.add_argument("object")
    disasm.add_argument("--oracle", help="llvm-objdump -d text to compare against")
    disasm.set_defaults(func=cmd_disasm)

    cfg = sub.add_parser("cfg", help="blocks, edges, dominators, loops and tables as JSON")
    cfg.add_argument("object")
    cfg.add_argument("function", nargs="?")
    cfg.set_defaults(func=cmd_cfg)

    decompile = sub.add_parser("decompile", help="emit C for every function or one function")
    decompile.add_argument("object")
    decompile.add_argument("--function")
    decompile.add_argument("--out", help="write the C unit here instead of stdout")
    decompile.add_argument("--ir", action="store_true", help="also print the IR, SSA and optimized IR")
    decompile.add_argument("--json", action="store_true", help="also print per-function metadata")
    decompile.add_argument("--no-division-idioms", action="store_true", help="keep the magic multiply instead of folding it")
    decompile.set_defaults(func=cmd_decompile)

    verify = sub.add_parser("verify", help="decompile, recompile, compare bytes, and run the differential grid")
    verify.add_argument("object")
    verify.add_argument("--source", help="the original C source, for the differential leg")
    verify.add_argument("--opt", default="O1", choices=["O0", "O1", "O2", "Os"], help="the optimization level the object was built with")
    verify.add_argument("--out", help="directory for decompiled.c, recompiled.o, report.json")
    verify.add_argument("--function")
    verify.add_argument("--no-division-idioms", action="store_true")
    verify.set_defaults(func=cmd_verify)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)
