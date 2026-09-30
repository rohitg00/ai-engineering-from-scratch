#!/usr/bin/env python3
"""Run each lesson's own test suite and report pass, skip, or fail.

CI installs no heavy scientific dependencies, so a lesson whose test needs one
(torch, numpy, and the rest of the allowlist below) is reported as skipped
rather than failed. Any other import error, including a lesson that cannot
import its own module, is a failure: that is the class of breakage this runner
exists to catch. Exit status is non-zero when any lesson fails.

Usage:
    python3 scripts/run_lesson_tests.py [--timeout SECONDS] [--phase NN-slug]
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PHASES = ROOT / "phases"

OPTIONAL_DEPS = {
    "torch", "torchvision", "torchaudio", "numpy", "scipy", "pandas",
    "matplotlib", "sklearn", "transformers", "datasets", "tokenizers",
    "safetensors", "h5py", "zstandard", "tiktoken", "sentencepiece",
    "sacrebleu", "nltk", "jax", "jaxlib", "flax", "diffusers", "accelerate",
    "umap", "optuna", "gymnasium", "gym", "faiss", "peft", "bitsandbytes",
    "einops", "wandb", "PIL", "cv2", "librosa", "soundfile", "networkx",
}

MISSING_MODULE = re.compile(r"No module named '([\w.]+)'")
IMPORT_LINE = re.compile(r"^\s*(?:import|from)\s+([\w.]+)", re.MULTILINE)


def missing_optional_dep(lesson: Path) -> str | None:
    """Return an optional dependency the lesson needs but cannot import.

    Some lessons import an optional package inside a try/except and degrade
    instead of raising, so scanning the source is more reliable than watching
    for a ModuleNotFoundError at run time.
    """
    seen: set[str] = set()
    for source in lesson.rglob("*.py"):
        try:
            text = source.read_text(encoding="utf-8")
        except OSError:
            continue
        for name in IMPORT_LINE.findall(text):
            seen.add(name.split(".")[0])
    for dep in sorted(seen & OPTIONAL_DEPS):
        if importlib.util.find_spec(dep) is None:
            return dep
    return None


def discover_targets(phase_filter: str | None):
    """Yield (label, cwd, argv) for each lesson test suite on disk."""
    for lesson in sorted(PHASES.glob("*/*")):
        if not lesson.is_dir() or lesson.name.startswith("."):
            continue
        if phase_filter and lesson.parent.name != phase_filter:
            continue
        code = lesson / "code"
        rel = lesson.relative_to(ROOT)
        if (code / "tests").is_dir() and list((code / "tests").glob("test_*.py")):
            yield f"{rel} (discover code/tests)", lesson, lesson, ["-m", "unittest", "discover", "-s", "code/tests"]
        for loose in sorted(code.glob("test_*.py")):
            yield f"{rel}/code/{loose.name}", lesson, code, ["-m", "unittest", loose.stem]
        if (code / "tests.py").is_file():
            yield f"{rel}/code/tests.py", lesson, code, ["-m", "unittest", "tests"]
        if (lesson / "tests").is_dir() and list((lesson / "tests").glob("*.py")):
            yield f"{rel} (discover tests)", lesson, lesson, ["-m", "unittest", "discover", "-s", "tests"]


def classify(output: str) -> tuple[str, str]:
    has_test_failure = "AssertionError" in output or "FAILED (failures=" in output
    if not has_test_failure:
        match = MISSING_MODULE.search(output)
        if match and match.group(1).split(".")[0] in OPTIONAL_DEPS:
            return "skip", f"needs {match.group(1)}"
    return "fail", ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--phase", default=None)
    args = parser.parse_args()

    passed, skipped, failed = [], [], []
    for label, lesson, cwd, argv in discover_targets(args.phase):
        dep = missing_optional_dep(lesson)
        if dep is not None:
            skipped.append((label, f"needs {dep}"))
            print(f"SKIP {label}: needs {dep}")
            continue
        try:
            proc = subprocess.run(
                [sys.executable, *argv],
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=args.timeout,
            )
        except subprocess.TimeoutExpired:
            failed.append((label, f"timed out after {args.timeout}s"))
            print(f"FAIL {label}: timed out after {args.timeout}s")
            continue
        if proc.returncode == 0:
            passed.append(label)
            print(f"PASS {label}")
            continue
        kind, reason = classify(proc.stderr + proc.stdout)
        if kind == "skip":
            skipped.append((label, reason))
            print(f"SKIP {label}: {reason}")
        else:
            tail = (proc.stderr.strip() or proc.stdout.strip()).splitlines()[-1:] or [""]
            failed.append((label, tail[0]))
            print(f"FAIL {label}: {tail[0]}")

    print(f"\n{len(passed)} passed, {len(skipped)} skipped, {len(failed)} failed")
    if failed:
        print("\nFailures:")
        for label, reason in failed:
            print(f"  {label}: {reason}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
