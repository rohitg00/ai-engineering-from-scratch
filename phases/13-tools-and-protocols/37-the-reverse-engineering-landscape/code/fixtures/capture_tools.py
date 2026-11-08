"""Capture every external tool's output on the fixture objects, with the exact command and version.

Environment:
  LLVM_OBJDUMP   path to llvm-objdump (default: Apple Command Line Tools copy)
  R2             path to radare2 (default: r2 on PATH)
  RIZIN          path to rizin (default: rizin on PATH)
  ANGR_PYTHON    python interpreter of a venv with angr, pyvex, pypcode installed
  GHIDRA_INSTALL_DIR  Ghidra install root that holds support/analyzeHeadless
  JAVA_HOME      JDK 21 for Ghidra

Run from the fixtures directory: python3 capture_tools.py
"""

from __future__ import annotations

import json
import os
import platform
import shlex
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"]
IR_INSTRUCTIONS = ["4883ec10", "4863c7", "83f904"]

OBJDUMP = os.environ.get("LLVM_OBJDUMP", "/Library/Developer/CommandLineTools/usr/bin/llvm-objdump")
R2 = os.environ.get("R2", shutil.which("r2") or "r2")
RIZIN = os.environ.get("RIZIN", shutil.which("rizin") or "rizin")
ANGR_PYTHON = os.environ.get("ANGR_PYTHON", sys.executable)
GHIDRA = os.environ.get("GHIDRA_INSTALL_DIR", "")


def run(argv: list[str], env: dict[str, str] | None = None) -> str:
    completed = subprocess.run(argv, capture_output=True, text=True, check=True, env=env, cwd=HERE)
    return completed.stdout


def shown(argv: list[str]) -> str:
    return " ".join(shlex.quote(Path(a).name if i == 0 else a) for i, a in enumerate(argv))


def version_line(argv: list[str]) -> str:
    return run(argv).splitlines()[0].strip()


def capture_objdump(manifest: dict) -> None:
    version = version_line([OBJDUMP, "--version"])
    manifest["tools"]["llvm-objdump"] = {"binary": Path(OBJDUMP).name, "version": version}
    for name in OBJECTS:
        argv = [OBJDUMP, "-d", "-r", name]
        text = run(argv)
        target = HERE / name.replace(".o", ".objdump.txt")
        target.write_text(text)
        manifest["files"].append({"tool": "llvm-objdump", "fixture": name, "file": target.name, "command": shown(argv)})


def r2_like(binary: str, tool: str, manifest: dict, pseudo: str | None) -> None:
    version = version_line([binary, "-v"])
    manifest["tools"][tool] = {"binary": Path(binary).name, "version": version}
    for name in OBJECTS:
        record: dict = {"tool": tool, "version": version, "fixture": name, "commands": {}}

        def command(text: str, as_json: bool = True) -> object:
            argv = [binary, "-e", "scr.color=0", "-qc", text, name]
            output = run(argv)
            record["commands"][text] = {"command": shown(argv), "output": json.loads(output) if as_json else output}
            return record["commands"][text]["output"]

        command("iSj")
        functions = command("aaa; aflj")
        for function in functions:
            address = function.get("addr", function.get("offset"))
            command(f"aaa; afbj @ {address:#x}")
            command(f"aaa; pdfj @ {address:#x}")
            if pseudo:
                command(f"aaa; {pseudo} @ {address:#x}", as_json=False)
        target = HERE / name.replace(".o", f".{tool}.json")
        target.write_text(json.dumps(record, indent=1) + "\n")
        manifest["files"].append({"tool": tool, "fixture": name, "file": target.name, "command": f"{Path(binary).name} -e scr.color=0 -qc '<command>' {name}"})


def capture_angr(manifest: dict) -> None:
    version = run([ANGR_PYTHON, "-c", "import angr; print(angr.__version__)"]).strip()
    manifest["tools"]["angr"] = {"binary": Path(ANGR_PYTHON).name, "version": version}
    for name in OBJECTS:
        target = HERE / name.replace(".o", ".angr.json")
        run([ANGR_PYTHON, "-I", str(HERE / "capture_angr.py"), name, str(target)])
        manifest["files"].append({"tool": "angr", "fixture": name, "file": target.name, "command": f"python capture_angr.py {name} {target.name}"})


def capture_ghidra(manifest: dict) -> None:
    properties = (Path(GHIDRA) / "Ghidra" / "application.properties").read_text()
    version = next(line.split("=", 1)[1] for line in properties.splitlines() if line.startswith("application.version="))
    manifest["tools"]["ghidra"] = {"binary": "analyzeHeadless", "version": version}
    env = dict(os.environ)
    env.setdefault("JAVA_TOOL_OPTIONS", f"-Djava.io.tmpdir={tempfile.gettempdir()}")
    for name in OBJECTS:
        target = HERE / name.replace(".o", ".ghidra.json")
        with tempfile.TemporaryDirectory(prefix="ghidra-lesson37-") as project:
            argv = [str(Path(GHIDRA) / "support" / "analyzeHeadless"), project, "lesson37", "-import", name, "-scriptPath", str(HERE), "-postScript", "ExportAnalysis.java", str(target), "-deleteProject"]
            run(argv, env=env)
        manifest["files"].append({"tool": "ghidra", "fixture": name, "file": target.name, "command": f"analyzeHeadless PROJECT_DIR lesson37 -import {name} -scriptPath . -postScript ExportAnalysis.java {target.name} -deleteProject"})


def capture_ir(manifest: dict) -> None:
    target = HERE / "ir-lifts.json"
    run([ANGR_PYTHON, "-I", str(HERE / "capture_ir.py"), str(target)])
    report = json.loads(target.read_text())
    for item in report["instructions"]:
        esil_argv = [R2, "-a", "x86", "-b", "64", "-e", "scr.color=0", "-qc", f"e asm.esil=true; wx {item['hex']}; pd 1", "-"]
        esil_line = run(esil_argv).strip().splitlines()[-1]
        item["esil"] = esil_line.split()[-1]
        item["esilCommand"] = shown(esil_argv)
        rzil_argv = [RIZIN, "-a", "x86", "-b", "64", "-e", "scr.color=0", "-qc", f"wx {item['hex']}; aoi 1", "malloc://16"]
        rzil_line = run(rzil_argv).strip().splitlines()[-1]
        item["rzil"] = rzil_line.split(" ", 1)[1]
        item["rzilCommand"] = shown(rzil_argv)
    report["versions"]["radare2"] = manifest["tools"]["radare2"]["version"]
    report["versions"]["rizin"] = manifest["tools"]["rizin"]["version"]
    target.write_text(json.dumps(report, indent=1) + "\n")
    manifest["files"].append({"tool": "ir", "fixture": "raw bytes", "file": target.name, "command": "python capture_ir.py ir-lifts.json, then r2 and rizin commands recorded per instruction"})


def main() -> int:
    manifest: dict = {
        "captured": date.today().isoformat(),
        "host": {"platform": platform.platform(), "machine": platform.machine()},
        "compiler": version_line(["clang", "--version"]),
        "tools": {},
        "files": [],
    }
    capture_objdump(manifest)
    r2_like(R2, "radare2", manifest, "pdc")
    r2_like(RIZIN, "rizin", manifest, None)
    capture_angr(manifest)
    if GHIDRA:
        capture_ghidra(manifest)
    else:
        print("GHIDRA_INSTALL_DIR not set, skipping Ghidra", file=sys.stderr)
    capture_ir(manifest)
    (HERE / "captures.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(json.dumps(manifest["tools"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
