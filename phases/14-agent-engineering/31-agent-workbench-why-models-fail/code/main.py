"""小さな repo task で prompt-only run と workbench-guided run を比較する。

agent は rule-based stub。主題は周辺 surface である。2 回目の run では各
surface を結線し、1 回目の run の各 failure をどの surface が検出できたかを数える。

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


WORKBENCH_SURFACES = [
    "instructions",
    "state",
    "scope",
    "feedback",
    "verification",
    "review",
    "handoff",
]


@dataclass
class RepoTask:
    description: str
    allowed_files: list[str]
    forbidden_files: list[str]
    acceptance: list[str]


@dataclass
class RunResult:
    label: str
    surfaces_present: list[str] = field(default_factory=list)
    files_touched: list[str] = field(default_factory=list)
    tests_run: bool = False
    declared_success: bool = False
    actually_passing: bool = False
    notes: list[str] = field(default_factory=list)

    def missing_surfaces(self) -> list[str]:
        return [s for s in WORKBENCH_SURFACES if s not in self.surfaces_present]


def stub_agent(task: RepoTask, surfaces: list[str]) -> RunResult:
    """LLM-backed coding agent の小さな deterministic 代役。"""
    result = RunResult(label="prompt-only" if not surfaces else "workbench")
    result.surfaces_present = list(surfaces)

    has_scope = "scope" in surfaces
    has_state = "state" in surfaces
    has_verification = "verification" in surfaces
    has_feedback = "feedback" in surfaces

    if has_scope:
        result.files_touched = [f for f in task.allowed_files]
    else:
        result.files_touched = [*task.allowed_files, "README.md", "scripts/release.sh"]
        result.notes.append("scope が欠けていたため無関係な files に触れた")

    if has_feedback:
        result.tests_run = True
        result.notes.append("test run の stdout/stderr/exit code を捕捉した")
    else:
        result.notes.append("test command を実行せず、output を推測した")

    if has_verification:
        result.actually_passing = True
        result.declared_success = True
        result.notes.append("verification gate が acceptance criteria の充足を証明した")
    else:
        result.declared_success = True
        result.actually_passing = False
        result.notes.append("acceptance checks を実行せずに success を宣言した")

    if not has_state:
        result.notes.append("state file が書かれず、次 session はゼロから再開する")

    return result


def failure_report(result: RunResult) -> dict[str, object]:
    return {
        "label": result.label,
        "missing_surfaces": result.missing_surfaces(),
        "off_scope_writes": [
            f for f in result.files_touched if f not in {"app.py", "test_app.py"}
        ],
        "tests_run": result.tests_run,
        "declared_success": result.declared_success,
        "actually_passing": result.actually_passing,
        "notes": result.notes,
    }


def main() -> None:
    task = RepoTask(
        description="/signup に input validation と passing test を追加する",
        allowed_files=["app.py", "test_app.py"],
        forbidden_files=["README.md", "scripts/release.sh"],
        acceptance=["test_app.py::test_signup_rejects_short_password passes"],
    )

    prompt_only = stub_agent(task, surfaces=[])
    workbench = stub_agent(task, surfaces=WORKBENCH_SURFACES)

    print("=== prompt only ===")
    for k, v in failure_report(prompt_only).items():
        print(f"  {k}: {v}")
    print()
    print("=== workbench ===")
    for k, v in failure_report(workbench).items():
        print(f"  {k}: {v}")

    out = Path(__file__).parent.parent / "outputs" / "failure_modes.json"
    out.write_text(json.dumps(failure_report(prompt_only), indent=2) + "\n")
    print(f"\n書き込み先: {out.relative_to(out.parent.parent.parent.parent.parent)}")


if __name__ == "__main__":
    main()
