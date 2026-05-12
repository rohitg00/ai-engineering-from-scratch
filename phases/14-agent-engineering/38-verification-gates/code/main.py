"""Deterministic verification gate.

Combines a task's scope_report, rule_report, and feedback_record.jsonl
into a single verification_report.json that says whether the task is
actually done. No LLM judges. No agent overrides.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent


@dataclass
class Finding:
    code: str
    severity: str
    detail: str


@dataclass
class Artifacts:
    task_id: str
    acceptance_commands: list[str]
    feedback: list[dict[str, object]]
    scope_report: dict[str, object]
    rule_report: list[dict[str, object]]


@dataclass
class VerdictReport:
    task_id: str
    passed: bool
    findings: list[Finding] = field(default_factory=list)


def _acceptance_findings(art: Artifacts) -> list[Finding]:
    findings: list[Finding] = []
    commands_run = [str(rec.get("command")) for rec in art.feedback]
    for cmd in art.acceptance_commands:
        if not any(cmd in c for c in commands_run):
            findings.append(Finding("acceptance.missing", "block", f"never ran: {cmd}"))
    for rec in art.feedback:
        if rec.get("exit_code") is None:
            findings.append(Finding("feedback.null_exit", "block", f"missing exit for {rec.get('command')}"))
        elif rec.get("exit_code") != 0 and any(
            ac in str(rec.get("command")) for ac in art.acceptance_commands
        ):
            findings.append(
                Finding("acceptance.failed", "block", f"acceptance exit {rec.get('exit_code')} on {rec.get('command')}")
            )
    return findings


def _scope_findings(art: Artifacts) -> list[Finding]:
    findings: list[Finding] = []
    if art.scope_report.get("forbidden_writes"):
        findings.append(
            Finding("scope.forbidden", "block", f"forbidden writes: {art.scope_report['forbidden_writes']}")
        )
    if art.scope_report.get("off_scope_writes"):
        findings.append(
            Finding("scope.off_scope", "warn", f"off-scope writes: {art.scope_report['off_scope_writes']}")
        )
    return findings


def _rule_findings(art: Artifacts) -> list[Finding]:
    findings: list[Finding] = []
    for row in art.rule_report:
        if not row.get("passed"):
            findings.append(Finding("rule.failed", "block", f"rule failed: {row.get('slug')}"))
    return findings


def verify(art: Artifacts) -> VerdictReport:
    findings = _acceptance_findings(art) + _scope_findings(art) + _rule_findings(art)
    blocking = [f for f in findings if f.severity == "block"]
    return VerdictReport(task_id=art.task_id, passed=not blocking, findings=findings)


def main() -> None:
    accept = ["pytest -x test_app.py::test_signup_rejects_short_password"]

    clean = Artifacts(
        task_id="T-001",
        acceptance_commands=accept,
        feedback=[{"command": accept[0], "exit_code": 0}],
        scope_report={"forbidden_writes": [], "off_scope_writes": []},
        rule_report=[{"slug": "done/tests-pass", "passed": True}],
    )
    creep = Artifacts(
        task_id="T-002",
        acceptance_commands=accept,
        feedback=[{"command": accept[0], "exit_code": 0}],
        scope_report={"forbidden_writes": ["scripts/release.sh"], "off_scope_writes": ["README.md"]},
        rule_report=[{"slug": "forbidden/no-release-script-edits", "passed": False}],
    )
    skipped = Artifacts(
        task_id="T-003",
        acceptance_commands=accept,
        feedback=[],
        scope_report={"forbidden_writes": [], "off_scope_writes": []},
        rule_report=[{"slug": "done/tests-pass", "passed": False}],
    )

    for case in (clean, creep, skipped):
        report = verify(case)
        path = HERE / f"verification_report_{case.task_id}.json"
        path.write_text(
            json.dumps({"task_id": report.task_id, "passed": report.passed, "findings": [asdict(f) for f in report.findings]}, indent=2) + "\n"
        )
        print(f"task {report.task_id}: passed={report.passed} findings={len(report.findings)}")
        for f in report.findings:
            print(f"  [{f.severity}] {f.code}: {f.detail}")
        print()


if __name__ == "__main__":
    main()
