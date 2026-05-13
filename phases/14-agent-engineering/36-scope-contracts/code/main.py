"""Scope contract checker.

Loads a per-task scope_contract.json and a RunSummary (touched files plus
acceptance command results), reports in-scope vs off-scope writes, and saves
a scope_report.json the verification gate can refuse on.

Run: python3 code/main.py
"""

from __future__ import annotations

import fnmatch
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent


@dataclass
class ScopeContract:
    task_id: str
    goal: str
    allowed_files: list[str]
    forbidden_files: list[str]
    acceptance_criteria: list[str]
    rollback_plan: str
    approvals_required: list[str] = field(default_factory=list)


@dataclass
class RunSummary:
    touched_files: list[str]
    commands_run: list[str]


@dataclass
class ScopeReport:
    task_id: str
    in_scope_writes: list[str]
    off_scope_writes: list[str]
    forbidden_writes: list[str]
    missing_acceptance: list[str]
    violations: list[str]

    def passed(self) -> bool:
        return not self.violations


def matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def scope_check(contract: ScopeContract, run: RunSummary) -> ScopeReport:
    in_scope: list[str] = []
    off_scope: list[str] = []
    forbidden: list[str] = []
    for path in run.touched_files:
        if matches_any(path, contract.forbidden_files):
            forbidden.append(path)
        elif matches_any(path, contract.allowed_files):
            in_scope.append(path)
        else:
            off_scope.append(path)
    missing = [c for c in contract.acceptance_criteria if c not in run.commands_run]
    violations: list[str] = []
    if forbidden:
        violations.append(f"forbidden writes: {forbidden}")
    if off_scope:
        violations.append(f"off-scope writes: {off_scope}")
    if missing:
        violations.append(f"acceptance not run: {missing}")
    return ScopeReport(
        task_id=contract.task_id,
        in_scope_writes=in_scope,
        off_scope_writes=off_scope,
        forbidden_writes=forbidden,
        missing_acceptance=missing,
        violations=violations,
    )


def main() -> None:
    contract = ScopeContract(
        task_id="T-001",
        goal="add input validation to /signup",
        allowed_files=["app.py", "test_app.py"],
        forbidden_files=["scripts/release.sh", "config/prod.yaml"],
        acceptance_criteria=["pytest -x test_app.py::test_signup_rejects_short_password"],
        rollback_plan="revert the commit and redeploy the previous build tag",
        approvals_required=["any new runtime dependency"],
    )

    clean = RunSummary(
        touched_files=["app.py", "test_app.py"],
        commands_run=["pytest -x test_app.py::test_signup_rejects_short_password"],
    )
    creep = RunSummary(
        touched_files=["app.py", "README.md", "scripts/release.sh"],
        commands_run=[],
    )

    clean_report = scope_check(contract, clean)
    creep_report = scope_check(contract, creep)

    print("contract:", json.dumps(asdict(contract), indent=2))
    print("\nclean run:", json.dumps(asdict(clean_report), indent=2))
    print("\ncreep run:", json.dumps(asdict(creep_report), indent=2))

    out = HERE / "scope_report.json"
    out.write_text(
        json.dumps({"clean": asdict(clean_report), "creep": asdict(creep_report)}, indent=2) + "\n"
    )
    print(f"\nwrote {out.name}")


if __name__ == "__main__":
    main()
