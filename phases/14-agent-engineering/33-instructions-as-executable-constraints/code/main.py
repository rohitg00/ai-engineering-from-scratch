"""agent-rules.md を parse し、fake agent turn を rules に対して採点する。

markdown 内の各 rule は slug、category、one-line description、そして
`RuleChecker` 上の function 名を示す `check:` field を持つ。new rule を
追加するとは check を追加することで、checker は workbench とともに育つ。

Run: python3 code/main.py
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
RULES_PATH = HERE / "agent-rules.md"
REPORT_PATH = HERE / "rule_report.json"


SEED_RULES = """\
# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent は tool call の前に agent_state.json を読まなければならない。

## forbidden/no-release-script-edits
- category: forbidden
- check: no_release_script_edits
approved release task の外で scripts/release.sh を編集してはならない。

## done/tests-pass
- category: definition_of_done
- check: tests_pass
task は acceptance command が exit zero のときだけ done になる。

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
confidence が threshold 未満なら、推測せず question note を書く。

## approval/new-dependency
- category: approval
- check: new_dependency_approved
runtime dependency の追加には explicit human approval が必要。
"""


@dataclass
class Rule:
    slug: str
    category: str
    check: str
    description: str


@dataclass
class TurnTrace:
    read_state_file: bool
    edited_files: list[str]
    confidence: float
    asked_for_help: bool
    tests_exit_code: int | None
    added_dependencies: list[str]
    approvals: list[str] = field(default_factory=list)


def write_seed_rules() -> None:
    if not RULES_PATH.exists():
        RULES_PATH.write_text(SEED_RULES)


def parse_rules() -> list[Rule]:
    text = RULES_PATH.read_text()
    rules: list[Rule] = []
    for block in re.split(r"\n## ", text)[1:]:
        head, *rest = block.split("\n", 1)
        slug = head.strip()
        body = rest[0] if rest else ""
        cat_match = re.search(r"-\s*category:\s*(\S+)", body)
        check_match = re.search(r"-\s*check:\s*(\S+)", body)
        non_empty = [ln.strip() for ln in body.splitlines() if ln.strip()]
        desc = non_empty[-1] if non_empty else ""
        if not cat_match or not check_match:
            continue
        rules.append(
            Rule(
                slug=slug,
                category=cat_match.group(1),
                check=check_match.group(1),
                description=desc,
            )
        )
    return rules


class RuleChecker:
    def state_file_fresh(self, trace: TurnTrace) -> bool:
        return trace.read_state_file

    def no_release_script_edits(self, trace: TurnTrace) -> bool:
        return "scripts/release.sh" not in trace.edited_files

    def tests_pass(self, trace: TurnTrace) -> bool:
        return trace.tests_exit_code == 0

    def opened_question_when_unsure(self, trace: TurnTrace) -> bool:
        return trace.confidence >= 0.7 or trace.asked_for_help

    def new_dependency_approved(self, trace: TurnTrace) -> bool:
        if not trace.added_dependencies:
            return True
        return all(dep in trace.approvals for dep in trace.added_dependencies)


def score(rules: list[Rule], checker: RuleChecker, trace: TurnTrace) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for rule in rules:
        check_fn = getattr(checker, rule.check, None)
        passed = bool(check_fn(trace)) if check_fn else False
        results.append({"slug": rule.slug, "category": rule.category, "passed": passed})
    return results


def main() -> None:
    write_seed_rules()
    rules = parse_rules()

    bad_trace = TurnTrace(
        read_state_file=False,
        edited_files=["app.py", "scripts/release.sh"],
        confidence=0.4,
        asked_for_help=False,
        tests_exit_code=1,
        added_dependencies=["fastapi"],
    )

    good_trace = TurnTrace(
        read_state_file=True,
        edited_files=["app.py", "test_app.py"],
        confidence=0.9,
        asked_for_help=False,
        tests_exit_code=0,
        added_dependencies=[],
    )

    checker = RuleChecker()
    bad = score(rules, checker, bad_trace)
    good = score(rules, checker, good_trace)

    print("parsed rules:", [r.slug for r in rules])
    print()
    print("bad trace:")
    for r in bad:
        print(f"  {r['slug']:42} {'PASS' if r['passed'] else 'FAIL'}")
    print("\ngood trace:")
    for r in good:
        print(f"  {r['slug']:42} {'PASS' if r['passed'] else 'FAIL'}")

    REPORT_PATH.write_text(
        json.dumps(
            {"bad": bad, "good": good, "trace_bad": asdict(bad_trace), "trace_good": asdict(good_trace)},
            indent=2,
        )
        + "\n"
    )
    print(f"\n書き込み先: {REPORT_PATH.name}")


if __name__ == "__main__":
    main()
