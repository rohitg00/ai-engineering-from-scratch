"""violation budgets、severity、multi-contract merge を持つ scope contract checker。

per-task scope_contract.json と RunSummary (touched files, commands, elapsed
minutes) を load し、severity tags 付きの typed Finding list を作り、runtime
が halt せずに耐えられる violation budget を適用し、複数 contracts
(project-wide + task-specific) を single effective contract に merge する。

Run: python3 code/main.py
"""

from __future__ import annotations

import fnmatch
import json
import time
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
    time_budget_minutes: int | None = None
    network_egress: list[str] | None = None  # None = no enforcement, [] = deny-all, [...] = allowlist
    violation_budget: int = 0
    docs_paths_soft: list[str] = field(default_factory=lambda: ["docs/**", "README.md", "**/*.md"])


@dataclass
class RunSummary:
    touched_files: list[str]
    commands_run: list[str]
    elapsed_minutes: float = 0.0
    network_hosts: list[str] = field(default_factory=list)


@dataclass
class Finding:
    code: str
    severity: str  # block | warn | info
    detail: str


@dataclass
class ScopeReport:
    task_id: str
    in_scope_writes: list[str]
    off_scope_writes: list[str]
    forbidden_writes: list[str]
    soft_off_scope_writes: list[str]
    missing_acceptance: list[str]
    findings: list[Finding]
    over_budget: bool

    def passed(self) -> bool:
        return not self.over_budget and not any(f.severity == "block" for f in self.findings)


def matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def merge_contracts(parent: ScopeContract, child: ScopeContract) -> ScopeContract:
    """least-privilege merge: allowed は intersect、forbidden は union、budget は最小。

    allowed_files は intersect (両方の contracts が path を permit する必要がある)、
    forbidden_files は union (どちらかが path を prohibit できる)、
    time_budget_minutes は min (most restrictive wins)、
    approvals_required は accumulate。
    network_egress: None は no enforcement、それ以外は intersect。empty list は
    deny-all を意味し、merge 後も deny-all のまま。
    """
    return ScopeContract(
        task_id=child.task_id,
        goal=child.goal or parent.goal,
        allowed_files=sorted(set(parent.allowed_files) & set(child.allowed_files)),
        forbidden_files=sorted(set(parent.forbidden_files) | set(child.forbidden_files)),
        acceptance_criteria=list(dict.fromkeys(parent.acceptance_criteria + child.acceptance_criteria)),
        rollback_plan=child.rollback_plan or parent.rollback_plan,
        approvals_required=list(dict.fromkeys(parent.approvals_required + child.approvals_required)),
        time_budget_minutes=_min_optional(parent.time_budget_minutes, child.time_budget_minutes),
        network_egress=_merge_egress(parent.network_egress, child.network_egress),
        violation_budget=min(parent.violation_budget, child.violation_budget),
        docs_paths_soft=sorted(set(parent.docs_paths_soft) | set(child.docs_paths_soft)),
    )


def _merge_egress(a: list[str] | None, b: list[str] | None) -> list[str] | None:
    if a is None and b is None:
        return None
    if a is None:
        return b
    if b is None:
        return a
    return sorted(set(a) & set(b))


def _min_optional(a: int | None, b: int | None) -> int | None:
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)


def scope_check(contract: ScopeContract, run: RunSummary) -> ScopeReport:
    in_scope: list[str] = []
    off_scope: list[str] = []
    soft_off_scope: list[str] = []
    forbidden: list[str] = []
    for path in run.touched_files:
        if matches_any(path, contract.forbidden_files):
            forbidden.append(path)
        elif matches_any(path, contract.allowed_files):
            in_scope.append(path)
        elif matches_any(path, contract.docs_paths_soft):
            soft_off_scope.append(path)
        else:
            off_scope.append(path)
    missing = [c for c in contract.acceptance_criteria if c not in run.commands_run]

    findings: list[Finding] = []
    if forbidden:
        findings.append(Finding("scope.forbidden", "block", f"禁止された writes: {forbidden}"))
    if off_scope:
        findings.append(Finding("scope.off_scope", "warn", f"scope 外 writes: {off_scope}"))
    if soft_off_scope:
        findings.append(Finding("scope.soft_off_scope", "info", f"docs/markdown の scope 外: {soft_off_scope}"))
    if missing:
        findings.append(Finding("acceptance.missing", "block", f"acceptance が未実行: {missing}"))
    if contract.time_budget_minutes is not None and run.elapsed_minutes > contract.time_budget_minutes:
        findings.append(Finding("time.over_budget", "block",
                                f"経過 {run.elapsed_minutes:.1f}m > budget {contract.time_budget_minutes}m"))
    if contract.network_egress is not None and run.network_hosts:
        bad_hosts = [h for h in run.network_hosts if h not in contract.network_egress]
        if bad_hosts:
            findings.append(Finding("network.unallowed_host", "block",
                                    f"allowlist 外 hosts への egress: {bad_hosts}"))

    warn_count = sum(1 for f in findings if f.severity == "warn")
    over_budget = warn_count > contract.violation_budget

    return ScopeReport(
        task_id=contract.task_id,
        in_scope_writes=in_scope,
        off_scope_writes=off_scope,
        forbidden_writes=forbidden,
        soft_off_scope_writes=soft_off_scope,
        missing_acceptance=missing,
        findings=findings,
        over_budget=over_budget,
    )


def archive(report: ScopeReport) -> Path:
    out = HERE / "closed" / f"{report.task_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"task_id": report.task_id, "findings": [asdict(f) for f in report.findings],
                    "in_scope": report.in_scope_writes, "off_scope": report.off_scope_writes,
                    "soft_off_scope": report.soft_off_scope_writes,
                    "passed": report.passed(), "closed_at": time.time()}, indent=2) + "\n"
    )
    return out


def main() -> None:
    project_wide = ScopeContract(
        task_id="P-PROJECT",
        goal="project-wide defaults",
        allowed_files=["app.py", "test_app.py", "lib/**/*.py"],
        forbidden_files=["scripts/release.sh", "config/prod.yaml"],
        acceptance_criteria=[],
        rollback_plan="revert して redeploy する",
        approvals_required=["新しい runtime dependency"],
        time_budget_minutes=60,
        violation_budget=1,
        network_egress=["api.openai.com", "api.anthropic.com"],
    )
    task = ScopeContract(
        task_id="T-001",
        goal="/signup に input validation を追加する",
        allowed_files=["app.py", "test_app.py"],
        forbidden_files=["migrations/**"],
        acceptance_criteria=["pytest -x test_app.py::test_signup_rejects_short_password"],
        rollback_plan="commit を revert し、previous build tag を redeploy する",
        approvals_required=[],
        time_budget_minutes=30,
        violation_budget=0,
        network_egress=["api.anthropic.com"],
    )
    effective = merge_contracts(project_wide, task)

    clean = RunSummary(
        touched_files=["app.py", "test_app.py"],
        commands_run=["pytest -x test_app.py::test_signup_rejects_short_password"],
        elapsed_minutes=12.4,
        network_hosts=["api.anthropic.com"],
    )
    creep = RunSummary(
        touched_files=["app.py", "README.md", "scripts/release.sh", "migrations/001_init.sql"],
        commands_run=[],
        elapsed_minutes=42.1,
        network_hosts=["api.anthropic.com", "evil.example"],
    )

    clean_report = scope_check(effective, clean)
    creep_report = scope_check(effective, creep)

    print("effective contract:", json.dumps(asdict(effective), indent=2))
    print("\nclean run findings:")
    for f in clean_report.findings:
        print(f"  [{f.severity}] {f.code}: {f.detail}")
    print(f"  passed={clean_report.passed()} over_budget={clean_report.over_budget}")

    print("\ncreep run findings:")
    for f in creep_report.findings:
        print(f"  [{f.severity}] {f.code}: {f.detail}")
    print(f"  passed={creep_report.passed()} over_budget={creep_report.over_budget}")

    archive(clean_report)
    archive(creep_report)
    print(f"\narchive 先: {(HERE / 'closed').name}/")


if __name__ == "__main__":
    main()
