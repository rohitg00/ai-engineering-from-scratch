
from __future__ import annotations

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
    raise NotImplementedError("Stage 8: implement recompile")


def mask_relocations(data: bytes, relocations: list[Relocation] | tuple[Relocation, ...]) -> tuple[bytes, list[tuple[int, int]]]:
    raise NotImplementedError("Stage 8: implement mask_relocations")


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
    raise NotImplementedError("Stage 8: implement compare_function_bytes")


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
    raise NotImplementedError("Stage 8: implement classify")


def input_grid(signature: Signature, constants: list[int] | None = None, limit: int = 400) -> list[Cell]:
    raise NotImplementedError("Stage 8: implement input_grid")


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
    raise NotImplementedError("Stage 8: implement differential_test")


def aggregate(behaviour: dict[str, str], bytes_status: dict[str, str]) -> str:
    raise NotImplementedError("Stage 8: implement aggregate")


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
    raise NotImplementedError("Stage 8: implement evidence_report")


def verify(object_path: str | Path, source_path: str | Path | None = None, opt: str = "O1", out_dir: str | Path | None = None, functions: list[str] | None = None, recognize_division: bool = True) -> dict[str, Any]:
    raise NotImplementedError("Stage 8: implement verify")
