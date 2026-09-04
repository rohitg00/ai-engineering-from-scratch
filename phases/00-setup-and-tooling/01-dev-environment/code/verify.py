"""Route-aware environment preflight for AI Engineering from Scratch.

Lesson: phases/00-setup-and-tooling/01-dev-environment/docs/en.md
Run this file from the repository root before starting a learning route.
"""

from __future__ import annotations

import argparse
import importlib.util
import platform
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Result:
    ok: bool
    detail: str


@dataclass(frozen=True)
class Probe:
    label: str
    run: Callable[[], Result]
    fix: str


@dataclass(frozen=True)
class Route:
    label: str
    required: tuple[str, ...]
    optional: tuple[str, ...]
    next_command: str
    manual: tuple[str, ...] = ()


def command_result(command: str, minimum_major: int | None = None) -> Result:
    path = shutil.which(command)
    if path is None:
        return Result(False, f"{command!r} was not found on PATH")

    try:
        process = subprocess.run(
            [path, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return Result(False, f"could not run {path}: {exc}")

    output = (process.stdout or process.stderr).strip().splitlines()
    detail = output[0] if output else f"exit code {process.returncode} with no version output"
    if process.returncode != 0:
        return Result(False, detail)

    if minimum_major is not None:
        digits = "".join(character if character.isdigit() else " " for character in detail)
        parts = digits.split()
        if not parts:
            return Result(False, f"could not parse a version from {detail!r}")
        major = int(parts[0])
        if major < minimum_major:
            return Result(False, f"found {detail}; need version {minimum_major}+")

    return Result(True, f"{detail} at {path}")


def python_result() -> Result:
    version = platform.python_version()
    executable = sys.executable
    if sys.version_info < (3, 11):
        return Result(False, f"found Python {version} at {executable}; need Python 3.11+")
    return Result(True, f"Python {version} at {executable}")


def module_result(module: str) -> Result:
    if importlib.util.find_spec(module) is None:
        return Result(False, f"{module!r} is not importable by {sys.executable}")
    return Result(True, f"importable by {sys.executable}")


def gpu_result() -> Result:
    if importlib.util.find_spec("torch") is None:
        return Result(False, "PyTorch is not installed, so no accelerator backend was checked")

    try:
        import torch
    except Exception as exc:
        return Result(False, f"PyTorch could not be imported: {type(exc).__name__}: {exc}")

    if torch.cuda.is_available():
        return Result(True, f"CUDA: {torch.cuda.get_device_name(0)}")
    mps = getattr(getattr(torch, "backends", None), "mps", None)
    if mps is not None and mps.is_available():
        return Result(True, "Apple MPS is available")
    return Result(True, "CPU only; a GPU is optional for the starting lessons")


def git_fix() -> str:
    system = platform.system()
    if system == "Darwin":
        return "Run `xcode-select --install`, then `git --version`."
    if system == "Windows":
        return "Run `winget install --id Git.Git -e`, then `git --version`."
    return "Run `sudo apt-get update && sudo apt-get install -y git`, then `git --version`."


PROBES = {
    "python": Probe(
        "Python 3.11+",
        python_result,
        "Install it with `uv python install 3.12`, activate that environment, and rerun with `python3`.",
    ),
    "git": Probe("Git", lambda: command_result("git"), git_fix()),
    "node": Probe(
        "Node.js 20+",
        lambda: command_result("node", minimum_major=20),
        "Run `fnm install 22 && fnm use 22`, then `node --version`.",
    ),
    "npx": Probe(
        "npx",
        lambda: command_result("npx"),
        "Install Node.js 22, then run `npm install -g npm` and `npx --version`.",
    ),
    "cargo": Probe(
        "Rust cargo",
        lambda: command_result("cargo"),
        "Install Rust with rustup, restart the shell, then run `cargo --version`.",
    ),
    "julia": Probe(
        "Julia",
        lambda: command_result("julia"),
        "Install Julia with juliaup, restart the shell, then run `julia --version`.",
    ),
    "numpy": Probe(
        "NumPy",
        lambda: module_result("numpy"),
        "Activate the course environment and run `python3 -m pip install numpy`.",
    ),
    "matplotlib": Probe(
        "Matplotlib",
        lambda: module_result("matplotlib"),
        "Activate the course environment and run `python3 -m pip install matplotlib`.",
    ),
    "jupyter": Probe(
        "Jupyter",
        lambda: module_result("jupyter"),
        "Activate the course environment and run `python3 -m pip install jupyter`.",
    ),
    "torch": Probe(
        "PyTorch",
        lambda: module_result("torch"),
        "Activate the course environment and run `python3 -m pip install torch`.",
    ),
    "gpu": Probe(
        "Accelerator backend",
        gpu_result,
        "A GPU is optional. Install PyTorch first if you want CUDA or Apple MPS detection.",
    ),
}


BASE_OPTIONAL = ("node", "npx", "numpy", "matplotlib", "jupyter", "torch", "gpu", "cargo", "julia")

ROUTES = {
    "beginner": Route(
        "Beginner course",
        ("python", "git"),
        BASE_OPTIONAL,
        "python3 phases/01-math-foundations/01-linear-algebra-intuition/code/vectors.py",
    ),
    "ml-foundations": Route(
        "Math and ML foundations",
        ("python", "git", "numpy"),
        ("matplotlib", "jupyter", "torch", "gpu", "julia"),
        "python3 phases/01-math-foundations/01-linear-algebra-intuition/code/vectors.py",
    ),
    "llm-engineering": Route(
        "LLM engineering",
        ("python", "git"),
        ("numpy", "torch", "gpu", "node", "npx", "cargo"),
        "python3 phases/11-llm-engineering/01-prompt-engineering/code/prompt_engineering.py",
    ),
    "agents": Route(
        "Agent engineering",
        ("python", "git"),
        ("node", "npx", "numpy", "torch"),
        "python3 phases/14-agent-engineering/01-the-agent-loop/code/main.py",
    ),
    "mcp": Route(
        "Model Context Protocol (MCP)",
        ("python", "git"),
        ("node", "npx"),
        "python3 phases/13-tools-and-protocols/06-mcp-fundamentals/code/main.py",
    ),
    "agent-skills": Route(
        "Agent Skills engineering",
        ("python", "git", "node", "npx"),
        (),
        "python3 phases/13-tools-and-protocols/22-skills-and-agent-sdks/code/main.py",
        (
            "Choose one skill-capable host and confirm it is installed.",
            "Choose a user or project skill scope and confirm it is writable.",
        ),
    ),
    "certification": Route(
        "Claude certification preparation",
        ("python", "git"),
        ("node", "npx"),
        "Open certifications/claude/GETTING_STARTED.md and choose a track.",
        ("If using the AI tutor, confirm your selected host can read repository skills.",),
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check only the tools needed to start a selected curriculum route."
    )
    parser.add_argument(
        "--route",
        choices=tuple(ROUTES),
        default="beginner",
        help="learning route to prepare for (default: beginner)",
    )
    parser.add_argument(
        "--show-later",
        action="store_true",
        help="also check tools that are optional now or required by later lessons",
    )
    return parser.parse_args()


def print_probe(key: str, required: bool) -> bool:
    probe = PROBES[key]
    result = probe.run()
    if result.ok:
        status = "PASS"
    elif required:
        status = "FAIL"
    else:
        status = "LATER"
    timing = "required now" if required else "optional or needed later"
    print(f"  [{status}] {probe.label} ({timing})")
    print(f"         {result.detail}")
    if not result.ok:
        print(f"         Fix: {probe.fix}")
    return result.ok


def main() -> int:
    args = parse_args()
    route = ROUTES[args.route]

    print("\n=== AI Engineering from Scratch: Environment Check ===\n")
    print(f"Route: {route.label} (`--route {args.route}`)\n")

    passed = 0
    for key in route.required:
        passed += int(print_probe(key, required=True))

    if route.optional and args.show_later:
        print("\nOptional or needed later:")
        for key in route.optional:
            print_probe(key, required=False)
    elif route.optional:
        print(
            f"\nLater checks skipped: {len(route.optional)} tools are not needed to start. "
            "Add `--show-later` when you want to inspect them."
        )

    if route.manual:
        print("\nManual checks:")
        for item in route.manual:
            print(f"  [MANUAL] {item}")

    total = len(route.required)
    print(f"\nResult: {passed}/{total} required checks passed")
    if passed == total:
        print(f"Ready to start {route.label}.")
        print(f"Next: {route.next_command}\n")
        return 0

    print("Not ready yet. Run each Fix command above, then repeat this preflight.\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
