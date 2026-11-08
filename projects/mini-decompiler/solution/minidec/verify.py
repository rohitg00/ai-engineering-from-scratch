
from __future__ import annotations

import itertools
import json
import platform
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .elf import ElfObject, Relocation, load_object, relocation_target
from .emit import Decompiled, decompile_all, translation_unit
from .types import Signature

FIXTURE_TARGET = "x86_64-unknown-linux-gnu"
INT_MIN = -(2**31)
INT_MAX = 2**31 - 1
MEMORY_WORDS = 8
MEMORY_BUFFER_WORDS = 4096
SCALARS = (0, 1, -1, 2, 7, 10, -10, 100, INT_MAX, INT_MIN)
SCALARS_WITH_MEMORY = (0, 1, 3, 8, -1, 100)
MEMORY_PATTERNS = {
    "zeros": (0,) * MEMORY_WORDS,
    "ascending": (1, 2, 3, 4, 5, 6, 7, 8),
    "mixed": (3, -7, 11, -13, 17, -19, 23, -29),
    "limits": (INT_MAX, INT_MIN, 1, -1, INT_MAX, INT_MIN, 2, -2),
    "minus_one": (-1,) * MEMORY_WORDS,
}
TRAP = "trap"
DRIVER_TIMEOUT_SECONDS = 60


class VerifyError(RuntimeError):
    pass


def fixture_flags(opt: str) -> list[str]:
    if opt not in ("O0", "O1", "O2", "Os"):
        raise ValueError(f"unsupported optimization level {opt!r}")
    return ["-target", FIXTURE_TARGET, f"-{opt}", "-fno-asynchronous-unwind-tables", "-c"]


def find_clang() -> str | None:
    return shutil.which("clang")


def host_description() -> str:
    return f"{platform.machine()} {platform.system()}"


def recompile(source: Path, opt: str, out: Path) -> Path:
    clang = find_clang()
    if clang is None:
        raise VerifyError("clang is not on PATH; the recompile leg cannot run")
    completed = subprocess.run([clang, *fixture_flags(opt), str(source), "-o", str(out)], capture_output=True, text=True)
    if completed.returncode != 0:
        raise VerifyError(f"recompile failed:\n{completed.stderr}")
    return out


def mask_relocations(data: bytes, relocations: list[Relocation] | tuple[Relocation, ...]) -> tuple[bytes, list[tuple[int, int]]]:
    masked = bytearray(data)
    ranges: list[tuple[int, int]] = []
    for relocation in relocations:
        for index in range(relocation.offset, min(relocation.offset + relocation.width, len(masked))):
            masked[index] = 0
        ranges.append((relocation.offset, relocation.width))
    return bytes(masked), ranges


@dataclass
class ByteComparison:
    function: str
    original_size: int
    candidate_size: int
    masked_equal: bool
    differing_offsets: list[int]
    masked_ranges: list[tuple[int, int]]
    relocations_match: bool
    relocation_detail: list[dict[str, Any]]
    constants: list[dict[str, Any]]
    missing: str | None = None

    @property
    def constants_equal(self) -> bool | None:
        if not self.constants:
            return None
        return all(entry["equal"] for entry in self.constants)

    @property
    def status(self) -> str:
        if self.missing:
            return "unknown"
        if self.original_size == self.candidate_size and self.masked_equal and self.relocations_match and self.constants_equal is not False:
            return "pass"
        return "differs"

    def reasons(self) -> list[str]:
        reasons: list[str] = []
        if self.missing:
            return [self.missing]
        if self.original_size != self.candidate_size:
            reasons.append(f"size {self.original_size} vs {self.candidate_size} bytes")
        elif not self.masked_equal:
            reasons.append(f"{len(self.differing_offsets)} unmasked bytes differ, first at offset 0x{self.differing_offsets[0]:x}")
        if not self.relocations_match:
            reasons.append("relocation records differ in count, offset, type or target section")
        if self.constants_equal is False:
            reasons.append("referenced constants differ: " + "; ".join(f"{e['original']} vs {e['candidate']}" for e in self.constants if not e["equal"]))
        return reasons

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "originalSize": self.original_size,
            "candidateSize": self.candidate_size,
            "maskedEqual": self.masked_equal,
            "differingOffsets": [f"0x{o:x}" for o in self.differing_offsets[:16]],
            "maskedRanges": [{"offset": o, "width": w} for o, w in self.masked_ranges],
            "relocationsMatch": self.relocations_match,
            "relocations": self.relocation_detail,
            "constants": self.constants,
            "reasons": self.reasons(),
        }


def read_referenced(obj: ElfObject, relocation: Relocation, length: int) -> list[int] | None:
    if not relocation.pc_relative or relocation.symbol.section in (".text", ""):
        return None
    target = relocation_target(relocation, relocation.offset + relocation.width)
    if not obj.has_section(target.section):
        return None
    data = obj.section(target.section).data
    raw = data[target.offset : target.offset + length]
    return [int.from_bytes(raw[i : i + 4], "little", signed=True) for i in range(0, len(raw) - len(raw) % 4, 4)]


def compare_function_bytes(original: ElfObject, candidate: ElfObject, name: str, tables: dict[str, dict[str, Any]] | None = None) -> ByteComparison:
    left = original.function(name)
    try:
        right = candidate.function(name)
    except Exception as error:
        return ByteComparison(name, left.size, 0, False, [], [], False, [], [], missing=f"{name} is not a function in the recompiled object: {error}")
    masked_left, ranges = mask_relocations(left.data, left.relocations)
    masked_right, _ = mask_relocations(right.data, right.relocations)
    differing = [index for index, (a, b) in enumerate(zip(masked_left, masked_right)) if a != b]
    relocations_match = len(left.relocations) == len(right.relocations)
    detail: list[dict[str, Any]] = []
    constants: list[dict[str, Any]] = []
    lengths = {(info["section"], info["offset"]): len(info["values"]) * info["width"] // 8 for info in (tables or {}).values()}
    for reloc_left, reloc_right in zip(left.relocations, right.relocations):
        same = reloc_left.offset == reloc_right.offset and reloc_left.type == reloc_right.type and reloc_left.symbol.section == reloc_right.symbol.section
        relocations_match = relocations_match and same
        detail.append(
            {
                "offset": reloc_left.offset,
                "type": reloc_left.type_name,
                "originalTarget": reloc_left.describe(),
                "candidateTarget": reloc_right.describe(),
                "sameShape": same,
            }
        )
        if not same or not reloc_left.pc_relative:
            continue
        target = relocation_target(reloc_left, reloc_left.offset + reloc_left.width)
        length = lengths.get((target.section, target.offset), 16)
        original_words = read_referenced(original, reloc_left, length)
        candidate_words = read_referenced(candidate, reloc_right, length)
        if original_words is not None and candidate_words is not None:
            constants.append({"at": target.describe(), "original": original_words, "candidate": candidate_words, "equal": original_words == candidate_words})
    return ByteComparison(name, left.size, right.size, left.size == right.size and not differing, differing, ranges, relocations_match, detail, constants)


@dataclass(frozen=True)
class Cell:
    function: str
    args: tuple[Any, ...]
    kind: str

    def tokens(self) -> list[str]:
        out: list[str] = []
        for arg in self.args:
            if isinstance(arg, tuple):
                out.extend(str(v) for v in arg)
            else:
                out.append(str(arg))
        return out

    def line(self) -> str:
        return " ".join([self.function, *self.tokens()])


def classify(args: tuple[Any, ...], constants: list[int]) -> str:
    scalars = [a for a in args if not isinstance(a, tuple)]
    memories = [a for a in args if isinstance(a, tuple)]
    edges = {c + d for c in constants for d in (-1, 0, 1)}
    if any(a in (INT_MAX, INT_MIN) for a in scalars) or any(INT_MAX in m or INT_MIN in m for m in memories):
        return "limit"
    if any(a in edges for a in scalars) and constants:
        return "compare-edge"
    if any(a == 0 for a in scalars):
        return "zero"
    if any(a < 0 for a in scalars) or any(v < 0 for m in memories for v in m):
        return "negative"
    return "plain"


def input_grid(signature: Signature, constants: list[int] | None = None, limit: int = 400) -> list[Cell]:
    constants = list(constants or [])
    has_memory = any(p.ctype.endswith("*") for p in signature.params)
    scalar_values = list(SCALARS_WITH_MEMORY if has_memory else SCALARS)
    for constant in constants:
        for delta in (-1, 0, 1):
            if constant + delta not in scalar_values and INT_MIN <= constant + delta <= INT_MAX:
                scalar_values.append(constant + delta)
    choices: list[list[Any]] = []
    for param in signature.params:
        if param.ctype.endswith("*"):
            choices.append(list(MEMORY_PATTERNS.values()))
        else:
            choices.append(scalar_values)
    return [Cell(signature.name, combo, classify(combo, constants)) for combo in itertools.islice(itertools.product(*choices), limit)]


def driver_source(signatures: dict[str, Signature]) -> str:
    lines = [
        "#include <setjmp.h>",
        "#include <signal.h>",
        "#include <stdio.h>",
        "#include <stdlib.h>",
        "#include <string.h>",
        "",
        f"#define WORDS {MEMORY_WORDS}",
        f"#define BUFFER {MEMORY_BUFFER_WORDS}",
        "static sigjmp_buf trap_env;",
        "static void on_fpe(int sig) { (void)sig; siglongjmp(trap_env, 1); }",
        "",
    ]
    for signature in signatures.values():
        params = ", ".join("void *" if p.ctype.endswith("*") else ("long" if p.width == 64 else "int") for p in signature.params) or "void"
        result = "void" if signature.return_type == "void" else ("long" if signature.return_width == 64 else "int")
        lines.append(f"{result} {signature.name}({params});")
        lines.append(f"{result} cand_{signature.name}({params});")
    lines.append("")
    for signature in signatures.values():
        name = signature.name
        result = "void" if signature.return_type == "void" else ("long" if signature.return_width == 64 else "int")
        lines.append(f"static void run_{name}(long *v) {{")
        position = 0
        call_args_a: list[str] = []
        call_args_b: list[str] = []
        memories: list[str] = []
        for index, param in enumerate(signature.params):
            if param.ctype.endswith("*"):
                lines.append(f"  static int m{index}a[BUFFER], m{index}b[BUFFER];")
                lines.append(f"  memset(m{index}a, 0, sizeof m{index}a);")
                lines.append(f"  memset(m{index}b, 0, sizeof m{index}b);")
                lines.append(f"  for (int i = 0; i < WORDS; i++) m{index}a[i] = m{index}b[i] = (int)v[{position} + i];")
                call_args_a.append(f"m{index}a")
                call_args_b.append(f"m{index}b")
                memories.append(f"m{index}")
                position += MEMORY_WORDS
            else:
                cast = "" if param.width == 64 else "(int)"
                lines.append(f"  {'long' if param.width == 64 else 'int'} a{index} = {cast}v[{position}];")
                call_args_a.append(f"a{index}")
                call_args_b.append(f"a{index}")
                position += 1
        for tag, callee, args in (("a", name, call_args_a), ("b", f"cand_{name}", call_args_b)):
            lines.append("  if (sigsetjmp(trap_env, 1) == 0) {")
            if result == "void":
                lines.append(f"    {callee}({', '.join(args)});")
                lines.append('    printf(" | void");')
            else:
                lines.append(f"    {result} r = {callee}({', '.join(args)});")
                lines.append(f'    printf(" | %{"ld" if result == "long" else "d"}", r);')
            for memory in memories:
                lines.append(f'    for (int i = 0; i < WORDS; i++) printf(" %d", {memory}{tag}[i]);')
            lines.append("  } else {")
            lines.append('    printf(" | trap");')
            lines.append("  }")
        lines.append("}")
        lines.append("")
    lines.extend(
        [
            "int main(void) {",
            "  struct sigaction action;",
            "  char line[1024];",
            "  memset(&action, 0, sizeof action);",
            "  action.sa_handler = on_fpe;",
            "  sigemptyset(&action.sa_mask);",
            "  action.sa_flags = SA_NODEFER;",
            "  sigaction(SIGFPE, &action, 0);",
            "  while (fgets(line, sizeof line, stdin)) {",
            "    char name[128];",
            "    long values[64];",
            "    int count = 0;",
            "    char *cursor = line;",
            '    if (sscanf(cursor, "%127s", name) != 1) continue;',
            "    cursor = strstr(cursor, name) + strlen(name);",
            "    while (count < 64) {",
            "      char *end;",
            "      long value = strtol(cursor, &end, 10);",
            "      if (end == cursor) break;",
            "      values[count++] = value;",
            "      cursor = end;",
            "    }",
            "    line[strcspn(line, \"\\n\")] = 0;",
            '    printf("%s", line);',
        ]
    )
    for signature in signatures.values():
        lines.append(f'    if (strcmp(name, "{signature.name}") == 0) run_{signature.name}(values);')
    lines.extend(['    printf("\\n");', "  }", "  return 0;", "}", ""])
    return "\n".join(lines)


@dataclass
class Harness:
    binary: Path
    compiler: str
    host: str
    original_kind: str


def build_harness(original_source: Path, candidate_source: Path, signatures: dict[str, Signature], opt: str, workdir: Path) -> Harness:
    clang = find_clang()
    if clang is None:
        raise VerifyError("clang is not on PATH; the differential leg cannot run")
    workdir.mkdir(parents=True, exist_ok=True)
    driver = workdir / "driver.c"
    driver.write_text(driver_source(signatures), encoding="utf-8")
    original = workdir / "original.o"
    candidate = workdir / "candidate.o"
    binary = workdir / "differential"
    renames = [f"-D{name}=cand_{name}" for name in signatures]
    steps = [
        [clang, f"-{opt}", "-c", str(original_source), "-o", str(original)],
        [clang, f"-{opt}", *renames, "-c", str(candidate_source), "-o", str(candidate)],
        [clang, "-O0", str(driver), str(original), str(candidate), "-o", str(binary)],
    ]
    for argv in steps:
        completed = subprocess.run(argv, capture_output=True, text=True)
        if completed.returncode != 0:
            raise VerifyError(f"harness build failed: {' '.join(argv)}\n{completed.stderr}")
    return Harness(binary, clang, host_description(), "source recompiled on the host")


def parse_result(text: str) -> Any:
    tokens = text.split()
    if not tokens:
        return None
    if tokens[0] == TRAP:
        return TRAP
    if tokens[0] == "void":
        return ["void", *map(int, tokens[1:])] if len(tokens) > 1 else "void"
    values = list(map(int, tokens))
    return values[0] if len(values) == 1 else values


def run_cells(harness: Harness, cells: list[Cell]) -> list[dict[str, Any]]:
    feed = "".join(cell.line() + "\n" for cell in cells)
    try:
        completed = subprocess.run([str(harness.binary)], input=feed, capture_output=True, text=True, timeout=DRIVER_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as error:
        raise VerifyError(f"driver did not finish within {DRIVER_TIMEOUT_SECONDS} s") from error
    if completed.returncode != 0:
        raise VerifyError(f"driver exited with {completed.returncode}: {completed.stderr[:400]}")
    rows: list[dict[str, Any]] = []
    for cell, line in zip(cells, completed.stdout.splitlines()):
        parts = line.split(" | ")
        if len(parts) != 3:
            raise VerifyError(f"driver printed an unexpected line: {line!r}")
        original, candidate = parse_result(parts[1]), parse_result(parts[2])
        rows.append({"function": cell.function, "args": list(cell.args), "kind": cell.kind, "original": original, "candidate": candidate, "match": original == candidate})
    if len(rows) != len(cells):
        raise VerifyError("driver printed fewer rows than cells")
    return rows


@dataclass
class BehaviourReport:
    function: str
    cells: int
    mismatches: list[dict[str, Any]]
    kinds: dict[str, int]
    rows: list[dict[str, Any]] = field(default_factory=list, repr=False)
    reason: str | None = None

    @property
    def status(self) -> str:
        if self.reason:
            return "unknown"
        return "pass" if not self.mismatches else "fail"

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "cells": self.cells,
            "kinds": dict(sorted(self.kinds.items())),
            "mismatches": self.mismatches[:12],
            "mismatchCount": len(self.mismatches),
            "trapCells": sum(1 for row in self.rows if row["original"] == TRAP),
            "reason": self.reason,
        }


def differential_test(original_source: Path, candidate_source: Path, decompiled: dict[str, Decompiled], opt: str, workdir: Path) -> tuple[dict[str, BehaviourReport], Harness]:
    signatures = {name: result.signature for name, result in decompiled.items()}
    harness = build_harness(original_source, candidate_source, signatures, opt, workdir)
    reports: dict[str, BehaviourReport] = {}
    for name, result in decompiled.items():
        cells = input_grid(result.signature, result.compare_constants)
        rows = run_cells(harness, cells)
        kinds: dict[str, int] = {}
        for cell in cells:
            kinds[cell.kind] = kinds.get(cell.kind, 0) + 1
        reports[name] = BehaviourReport(name, len(cells), [row for row in rows if not row["match"]], kinds, rows)
    return reports, harness


def aggregate(behaviour: dict[str, str], bytes_status: dict[str, str]) -> str:
    statuses = list(behaviour.values())
    if "fail" in statuses:
        return "fail"
    if not statuses or "unknown" in statuses or "unknown" in bytes_status.values():
        return "unknown"
    if all(status == "pass" for status in bytes_status.values()):
        return "pass"
    return "behaviour-only"


def evidence_report(
    object_path: Path,
    opt: str,
    decompiled: dict[str, Decompiled],
    behaviour: dict[str, BehaviourReport],
    byte_compare: dict[str, ByteComparison],
    harness: Harness | None,
    recompile_error: str | None,
    outputs: dict[str, str],
) -> dict[str, Any]:
    functions: dict[str, Any] = {}
    unknowns: list[str] = []
    for name, result in decompiled.items():
        behaviour_entry = behaviour[name].to_dict() if name in behaviour else {"status": "unknown", "reason": "no differential run"}
        bytes_entry = byte_compare[name].to_dict() if name in byte_compare else {"status": "unknown", "reasons": [recompile_error or "no recompiled object"]}
        function_unknowns = list(result.unknowns)
        if behaviour_entry["status"] == "unknown":
            function_unknowns.append(f"behaviour of {name} was not compared: {behaviour_entry.get('reason')}")
        if bytes_entry["status"] == "unknown":
            function_unknowns.append(f"bytes of {name} were not compared: {'; '.join(bytes_entry.get('reasons', []))}")
        functions[name] = {
            "signature": result.signature.to_dict(),
            "blocks": len(result.function.blocks),
            "phis": result.phis,
            "divisions": result.function.divisions,
            "tables": result.tables,
            "behaviour": behaviour_entry,
            "bytes": bytes_entry,
            "unknowns": function_unknowns,
        }
        unknowns.extend(f"{name}: {text}" for text in function_unknowns)
    status = aggregate({name: entry["behaviour"]["status"] for name, entry in functions.items()}, {name: entry["bytes"]["status"] for name, entry in functions.items()})
    return {
        "object": object_path.name,
        "optimization": opt,
        "host": host_description(),
        "compiler": harness.compiler if harness else find_clang(),
        "originalKind": harness.original_kind if harness else None,
        "status": status,
        "functions": functions,
        "unknowns": unknowns,
        "outputs": outputs,
        "limits": [
            "Behaviour pass covers the declared grid on this host; it is not global equivalence.",
            "A byte pass is a statement about one compiler with one set of flags.",
            "Pointer parameters are passed as void * in the driver; the psABI puts every pointer in an INTEGER register.",
        ],
    }


def verify(object_path: str | Path, source_path: str | Path | None = None, opt: str = "O1", out_dir: str | Path | None = None, functions: list[str] | None = None, recognize_division: bool = True) -> dict[str, Any]:
    object_path = Path(object_path)
    out = Path(out_dir) if out_dir else object_path.parent / "verify-out"
    out.mkdir(parents=True, exist_ok=True)
    elf = load_object(object_path)
    decompiled = decompile_all(elf, recognize_division, functions)
    unit = translation_unit(decompiled)
    decompiled_path = out / "decompiled.c"
    decompiled_path.write_text(unit, encoding="utf-8")
    outputs = {"decompiled": str(decompiled_path)}
    byte_compare: dict[str, ByteComparison] = {}
    recompile_error: str | None = None
    try:
        recompiled = recompile(decompiled_path, opt, out / "recompiled.o")
        outputs["recompiled"] = str(recompiled)
        candidate = load_object(recompiled)
        for name, result in decompiled.items():
            byte_compare[name] = compare_function_bytes(elf, candidate, name, result.tables)
    except VerifyError as error:
        recompile_error = str(error).splitlines()[0]
    behaviour: dict[str, BehaviourReport] = {}
    harness: Harness | None = None
    if source_path is not None and find_clang() is not None:
        try:
            behaviour, harness = differential_test(Path(source_path), decompiled_path, decompiled, opt, out / "harness")
        except VerifyError as error:
            behaviour = {name: BehaviourReport(name, 0, [], {}, reason=str(error).splitlines()[0]) for name in decompiled}
    else:
        reason = "no original source was given" if source_path is None else "clang is not on PATH"
        behaviour = {name: BehaviourReport(name, 0, [], {}, reason=reason) for name in decompiled}
    report_path = out / "report.json"
    outputs["report"] = str(report_path)
    report = evidence_report(object_path, opt, decompiled, behaviour, byte_compare, harness, recompile_error, outputs)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report
