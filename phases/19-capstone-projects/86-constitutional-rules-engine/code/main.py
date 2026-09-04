"""Constitutional rules engine.

Loads a YAML constitution, evaluates rules against a candidate text, and
produces structured violations with rule name, severity, explanation, and
matched span. The Fixer applies declarative repairs per rule; diff produces
a structured change list between draft and revised.

Run: python3 main.py
"""

from __future__ import annotations

import difflib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from yaml_subset import load_yaml

HERE = Path(__file__).parent
OUTPUTS = HERE.parent / "outputs"
DEFAULT_RULES_PATH = HERE / "rules.yml"

SEVERITY_ORDER = ("low", "medium", "high")


@dataclass
class Violation:
    rule_name: str
    severity: str
    explanation: str
    matched_span: str | None = None


@dataclass
class RuleResult:
    rule_name: str
    severity: str
    status: str
    explanation: str
    matched_span: str | None = None


@dataclass
class EngineReport:
    text: str
    results: list[RuleResult] = field(default_factory=list)

    def violations(self) -> list[Violation]:
        return [
            Violation(
                rule_name=r.rule_name,
                severity=r.severity,
                explanation=r.explanation,
                matched_span=r.matched_span,
            )
            for r in self.results
            if r.status == "violation"
        ]

    def max_severity(self) -> str | None:
        sevs = [v.severity for v in self.violations()]
        if not sevs:
            return None
        return max(sevs, key=lambda s: SEVERITY_ORDER.index(s))


@dataclass
class Change:
    op: str
    text: str


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def _eval_predicate(node: dict[str, Any] | None, text: str) -> tuple[bool, str | None]:
    if node is None or node == {}:
        return True, None
    if "all_of" in node:
        spans = []
        for child in node["all_of"]:
            ok, span = _eval_predicate(child, text)
            if not ok:
                return False, span
            spans.append(span)
        first = next((s for s in spans if s), None)
        return True, first
    if "any_of" in node:
        last_span = None
        for child in node["any_of"]:
            ok, span = _eval_predicate(child, text)
            if ok:
                return True, span
            last_span = span
        return False, last_span
    if "not_" in node:
        ok, span = _eval_predicate(node["not_"], text)
        return (not ok), span
    if "contains_regex" in node:
        m = re.search(node["contains_regex"], text, flags=re.IGNORECASE | re.DOTALL)
        return (m is not None), (m.group(0) if m else None)
    if "not_contains_regex" in node:
        m = re.search(node["not_contains_regex"], text, flags=re.IGNORECASE | re.DOTALL)
        return (m is None), (m.group(0) if m else None)
    if "ends_with_regex" in node:
        m = re.search(node["ends_with_regex"] + r"\Z", text, flags=re.IGNORECASE | re.DOTALL)
        return (m is not None), (m.group(0) if m else None)
    if "starts_with_regex" in node:
        m = re.match(node["starts_with_regex"], text, flags=re.IGNORECASE | re.DOTALL)
        return (m is not None), (m.group(0) if m else None)
    if "max_words" in node:
        wc = _word_count(text)
        return (wc <= int(node["max_words"])), (f"word count {wc}" if wc > int(node["max_words"]) else None)
    if "min_words" in node:
        wc = _word_count(text)
        return (wc >= int(node["min_words"])), (f"word count {wc}" if wc < int(node["min_words"]) else None)
    raise ValueError(f"unknown predicate: {list(node.keys())}")


class Engine:
    def __init__(self, rules: list[dict[str, Any]] | None = None, path: Path | None = None) -> None:
        if rules is not None:
            self._rules = rules
        else:
            target = path or DEFAULT_RULES_PATH
            data = load_yaml(target.read_text())
            if not isinstance(data, dict) or "rules" not in data:
                raise ValueError("constitution must be a mapping with a 'rules' key")
            self._rules = data["rules"]
        for r in self._rules:
            if r.get("severity") not in SEVERITY_ORDER:
                raise ValueError(f"rule {r.get('name')} has bad severity {r.get('severity')}")
            if "name" not in r or "explanation" not in r or "must" not in r:
                raise ValueError(f"rule {r.get('name')} missing required field")

    def rules(self) -> list[dict[str, Any]]:
        return list(self._rules)

    def evaluate(self, text: str) -> EngineReport:
        report = EngineReport(text=text)
        for rule in self._rules:
            name = str(rule["name"])
            sev = str(rule["severity"])
            expl = str(rule["explanation"])
            applies, _ = _eval_predicate(rule.get("applies_when"), text)
            if not applies:
                report.results.append(
                    RuleResult(rule_name=name, severity=sev, status="not_applicable", explanation=expl)
                )
                continue
            satisfied, span = _eval_predicate(rule["must"], text)
            if satisfied:
                report.results.append(
                    RuleResult(rule_name=name, severity=sev, status="pass", explanation=expl)
                )
            else:
                report.results.append(
                    RuleResult(
                        rule_name=name,
                        severity=sev,
                        status="violation",
                        explanation=expl,
                        matched_span=span,
                    )
                )
        return report


class Fixer:
    def __init__(self, rules: list[dict[str, Any]]) -> None:
        self._by_name = {str(r["name"]): r for r in rules if "fix" in r}

    def apply(self, text: str, violations: list[Violation]) -> str:
        out = text
        for v in violations:
            spec = self._by_name.get(v.rule_name)
            if not spec:
                continue
            fix = spec.get("fix")
            if not isinstance(fix, dict):
                continue
            if "append_if_missing" in fix:
                suffix = str(fix["append_if_missing"])
                if suffix.strip() and suffix.strip() not in out:
                    out = out.rstrip() + suffix
            elif "prepend_if_missing" in fix:
                prefix = str(fix["prepend_if_missing"])
                if prefix.strip() and prefix.strip() not in out:
                    out = prefix + out.lstrip()
            elif "replace_regex" in fix:
                rr = fix["replace_regex"]
                out = re.sub(str(rr["pattern"]), str(rr["replacement"]), out, flags=re.IGNORECASE)
        return out


def diff(draft: str, revised: str) -> list[Change]:
    draft_lines = draft.splitlines()
    revised_lines = revised.splitlines()
    sm = difflib.SequenceMatcher(a=draft_lines, b=revised_lines)
    out: list[Change] = []
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            continue
        if op == "delete":
            for line in draft_lines[a1:a2]:
                out.append(Change(op="remove", text=line))
        elif op == "insert":
            for line in revised_lines[b1:b2]:
                out.append(Change(op="add", text=line))
        elif op == "replace":
            for line in draft_lines[a1:a2]:
                out.append(Change(op="edit-removed", text=line))
            for line in revised_lines[b1:b2]:
                out.append(Change(op="edit-added", text=line))
    return out


_DEMO_DRAFTS = [
    {
        "case": "refusal-without-redirect",
        "draft": "I cannot help with that question.",
    },
    {
        "case": "code-without-assumption",
        "draft": "Here is the code:\n```python\ndef add(a, b):\n    return a + b\n```\nLet me know if this works.",
    },
    {
        "case": "pii-in-example",
        "draft": "Example user: lee@example.com. Here is how to look them up.",
    },
    {
        "case": "internal-library-leak",
        "draft": "Use the internal-only adapter for the database call.",
    },
    {
        "case": "clean-response",
        "draft": "Here is a haiku about autumn leaves drifting onto a still pond surface.",
    },
]


def write_report(payload: dict[str, object]) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS / "rules_report.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return path


def demo() -> int:
    engine = Engine()
    fixer = Fixer(engine.rules())
    print("Constitutional rules engine demo")
    print()
    print(f"  rules loaded: {len(engine.rules())}")
    print()
    payload: dict[str, object] = {"cases": []}
    for fixture in _DEMO_DRAFTS:
        draft = fixture["draft"]
        report = engine.evaluate(draft)
        violations = report.violations()
        revised = fixer.apply(draft, violations)
        report2 = engine.evaluate(revised)
        post_violations = report2.violations()
        change_list = diff(draft, revised)
        case_name = fixture["case"]
        print(f"  case: {case_name}")
        if violations:
            print(f"    violations on draft: {len(violations)}  max severity: {report.max_severity()}")
            for v in violations:
                print(f"      [{v.severity:6}] {v.rule_name}: {v.explanation}")
        else:
            print("    draft passes all applicable rules")
        if change_list:
            print(f"    fixer applied {len(change_list)} change(s)")
        if post_violations:
            print(f"    revised still has {len(post_violations)} violation(s)")
        print()
        payload["cases"].append(
            {
                "case": case_name,
                "draft": draft,
                "revised": revised,
                "draft_violations": [asdict(v) for v in violations],
                "revised_violations": [asdict(v) for v in post_violations],
                "diff": [asdict(c) for c in change_list],
            }
        )
    path = write_report(payload)
    print(f"  artifact written to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(demo())
