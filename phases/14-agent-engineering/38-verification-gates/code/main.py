"""coverage floor、--strict mode、signed overrides を備えた deterministic verification gate。

task の scope_report、rule_report、feedback log、optional な coverage_report を
単一の verification_report.json に統合する。LLM judge は使わない。LLM judgment
は reviewer 側 (Phase 14 · 39) に置く。override には reason、user、HEAD commit
を持つ overrides.jsonl の signed entry が必要。

Run: python3 code/main.py
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
OVERRIDES_PATH = HERE / "overrides.jsonl"
COVERAGE_FLOOR_DEFAULT = 0.80
COVERAGE_REGRESSION_DELTA = 0.01

# override entry への署名に使う audit secret。production では secrets manager から読む。
# fail closed: VERIFY_DEMO_MODE=1 が明示された場合だけ demo secret に fallback し、
# 誤って CI に入らないよう大きく警告する。
_OVERRIDE_SECRET_ENV = "VERIFY_OVERRIDE_SECRET"
_DEMO_MODE_ENV = "VERIFY_DEMO_MODE"


def _load_override_secret() -> str:
    secret = os.environ.get(_OVERRIDE_SECRET_ENV)
    if secret:
        return secret
    if os.environ.get(_DEMO_MODE_ENV) == "1":
        print(
            f"WARNING: {_OVERRIDE_SECRET_ENV} unset and {_DEMO_MODE_ENV}=1; "
            "insecure demo secret を使います。この mode で real overrides を記録しないでください。",
            file=sys.stderr,
        )
        return "demo-override-secret-do-not-ship"
    raise RuntimeError(
        f"start を拒否しました: {_OVERRIDE_SECRET_ENV} が未設定です。"
        f"env var を設定するか、lesson demo 専用で {_DEMO_MODE_ENV}=1 を渡してください。"
    )


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
    coverage_report: dict[str, float] | None = None  # {"current": 0.84, "previous": 0.85}
    head_commit: str = ""


@dataclass
class VerdictReport:
    task_id: str
    passed: bool
    strict: bool
    findings: list[Finding] = field(default_factory=list)
    coverage: dict[str, float] | None = None
    head_commit: str = ""


def _acceptance_findings(art: Artifacts) -> list[Finding]:
    findings: list[Finding] = []
    commands_run = [str(rec.get("command")) for rec in art.feedback]
    accept_set = set(art.acceptance_commands)
    for cmd in art.acceptance_commands:
        if cmd not in commands_run:
            findings.append(Finding("acceptance.missing", "block", f"未実行: {cmd}"))
    for rec in art.feedback:
        cmd_str = str(rec.get("command"))
        if rec.get("exit_code") is None:
            findings.append(Finding("feedback.null_exit", "block", f"{cmd_str} の exit が欠落"))
        elif rec.get("exit_code") != 0 and cmd_str in accept_set:
            findings.append(
                Finding("acceptance.failed", "block", f"{cmd_str} で acceptance exit {rec.get('exit_code')}")
            )
    return findings


def _scope_findings(art: Artifacts) -> list[Finding]:
    findings: list[Finding] = []
    if art.scope_report.get("forbidden_writes"):
        findings.append(Finding("scope.forbidden", "block",
                                f"forbidden writes がある: {art.scope_report['forbidden_writes']}"))
    if art.scope_report.get("off_scope_writes"):
        findings.append(Finding("scope.off_scope", "warn",
                                f"off-scope writes がある: {art.scope_report['off_scope_writes']}"))
    return findings


def _rule_findings(art: Artifacts) -> list[Finding]:
    return [Finding("rule.failed", "block", f"rule failed: {row.get('slug')}")
            for row in art.rule_report if not row.get("passed")]


def _coverage_findings(art: Artifacts, floor: float) -> list[Finding]:
    """Anthropic Hybrid Norm: verifiable rewards (tests + coverage) と rubric judging を組にする。

    floor failure は block。previous merge から COVERAGE_REGRESSION_DELTA を超える
    regression は block。それより小さい低下は warning。
    """
    findings: list[Finding] = []
    if not art.coverage_report:
        findings.append(Finding("coverage.missing", "warn",
                                "coverage_report.json がないため floor を enforce できない"))
        return findings
    current = float(art.coverage_report.get("current", 0.0))
    previous = float(art.coverage_report.get("previous", current))
    if current < floor:
        findings.append(Finding("coverage.below_floor", "block",
                                f"coverage {current:.2%} が floor {floor:.0%} 未満"))
    delta = previous - current
    if delta > COVERAGE_REGRESSION_DELTA:
        findings.append(Finding("coverage.regression", "block",
                                f"coverage が {delta:.2%} 低下 (prev {previous:.2%} -> {current:.2%})"))
    elif delta > 0:
        findings.append(Finding("coverage.minor_regression", "warn",
                                f"coverage が {delta:.2%} 低下"))
    return findings


def verify(
    art: Artifacts,
    strict: bool = False,
    coverage_floor: float = COVERAGE_FLOOR_DEFAULT,
) -> VerdictReport:
    findings = (
        _acceptance_findings(art)
        + _scope_findings(art)
        + _rule_findings(art)
        + _coverage_findings(art, coverage_floor)
    )
    if strict:
        # --strict はすべての warning を block に昇格する。release branch だけの opt-in。
        findings = [Finding(f.code, "block" if f.severity == "warn" else f.severity, f.detail)
                    for f in findings]
    blocking = [f for f in findings if f.severity == "block"]
    return VerdictReport(
        task_id=art.task_id,
        passed=not blocking,
        strict=strict,
        findings=findings,
        coverage=art.coverage_report,
        head_commit=art.head_commit,
    )


def _sign(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hmac.new(_load_override_secret().encode(), canonical, hashlib.sha256).hexdigest()[:32]


def record_override(
    task_id: str, finding_code: str, reason: str, user_id: str, head_commit: str
) -> dict[str, object]:
    """signed override entry を append する。5つの field が揃わなければ拒否する。"""
    if not all([task_id, finding_code, reason, user_id, head_commit]):
        raise ValueError("override には task_id, finding_code, reason, user_id, head_commit が必要")
    payload = {
        "task_id": task_id,
        "finding_code": finding_code,
        "reason": reason,
        "user_id": user_id,
        "head_commit": head_commit,
        "ts": time.time(),
    }
    payload["signature"] = _sign({k: v for k, v in payload.items() if k != "signature"})
    with OVERRIDES_PATH.open("a") as fh:
        fh.write(json.dumps(payload) + "\n")
    return payload


def verify_signature(entry: dict[str, object]) -> bool:
    expected = entry.get("signature")
    payload = {k: v for k, v in entry.items() if k != "signature"}
    return hmac.compare_digest(_sign(payload), str(expected))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="すべての warn を block に昇格する")
    ap.add_argument("--floor", type=float, default=COVERAGE_FLOOR_DEFAULT)
    args = ap.parse_args()

    accept = ["pytest -x test_app.py::test_signup_rejects_short_password"]
    cases = [
        Artifacts(
            task_id="T-001",
            acceptance_commands=accept,
            feedback=[{"command": accept[0], "exit_code": 0}],
            scope_report={"forbidden_writes": [], "off_scope_writes": []},
            rule_report=[{"slug": "done/tests-pass", "passed": True}],
            coverage_report={"current": 0.84, "previous": 0.85},
            head_commit="a1b2c3d",
        ),
        Artifacts(
            task_id="T-002",
            acceptance_commands=accept,
            feedback=[{"command": accept[0], "exit_code": 0}],
            scope_report={"forbidden_writes": ["scripts/release.sh"], "off_scope_writes": ["README.md"]},
            rule_report=[{"slug": "forbidden/no-release-script-edits", "passed": False}],
            coverage_report={"current": 0.62, "previous": 0.80},
            head_commit="b2c3d4e",
        ),
        Artifacts(
            task_id="T-003",
            acceptance_commands=accept,
            feedback=[],
            scope_report={"forbidden_writes": [], "off_scope_writes": []},
            rule_report=[{"slug": "done/tests-pass", "passed": False}],
            head_commit="c3d4e5f",
        ),
    ]

    for art in cases:
        report = verify(art, strict=args.strict, coverage_floor=args.floor)
        path = HERE / f"verification_report_{art.task_id}.json"
        path.write_text(json.dumps(
            {"task_id": report.task_id, "passed": report.passed, "strict": report.strict,
             "head_commit": report.head_commit, "coverage": report.coverage,
             "findings": [asdict(f) for f in report.findings]},
            indent=2) + "\n")
        flag = " (strict)" if report.strict else ""
        print(f"task {report.task_id}{flag}: passed={report.passed} findings={len(report.findings)}")
        for f in report.findings:
            print(f"  [{f.severity}] {f.code}: {f.detail}")
        print()

    # T-002 が実際に emit する off-scope warning で signed override を demo する。
    try:
        entry = record_override(
            task_id="T-002",
            finding_code="scope.off_scope",
            reason="reviewer が新しい signup contract の README update を承認した",
            user_id="rohitg00",
            head_commit="b2c3d4e",
        )
        print(f"override を記録しました: signature={entry['signature']} verified={verify_signature(entry)}")
    except RuntimeError as exc:
        print(f"override demo を skip しました: {exc}")


if __name__ == "__main__":
    main()
