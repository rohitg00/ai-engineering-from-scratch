# Lesson program: validates and renders a repository-backed task frame.
# Lesson: phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md
# Canonical source: Nuseibeh and Easterbrook, Requirements Engineering: A Roadmap.
# Canonical source: Yang et al., SWE-agent, arXiv:2405.15793.
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class RepositoryFact:
    claim: str
    evidence: str


@dataclass
class TaskFrame:
    goal: str
    allowed_paths: list[str]
    forbidden_paths: list[str]
    acceptance: list[str]
    facts: list[RepositoryFact] = field(default_factory=list)
    unknowns: list[str] = field(default_factory=list)


def validate(frame: TaskFrame) -> list[str]:
    issues: list[str] = []
    if not frame.goal.strip():
        issues.append("goal is empty")
    if not frame.allowed_paths:
        issues.append("allowed paths are empty")
    if not frame.forbidden_paths:
        issues.append("forbidden paths are empty")
    if not frame.acceptance:
        issues.append("acceptance evidence is empty")
    for fact in frame.facts:
        if not fact.evidence.strip():
            issues.append(f"unsupported fact: {fact.claim}")
    overlap = sorted(set(frame.allowed_paths) & set(frame.forbidden_paths))
    if overlap:
        issues.append(f"paths are both allowed and forbidden: {', '.join(overlap)}")
    return issues


def render(frame: TaskFrame) -> str:
    issues = validate(frame)
    status = "READY" if not issues else "BLOCKED"
    lines = [f"# Task Frame: {frame.goal}", "", f"Status: {status}", "", "## Repository facts"]
    lines.extend(f"- {fact.claim} (`{fact.evidence}`)" for fact in frame.facts)
    lines.extend(["", "## Allowed paths"])
    lines.extend(f"- `{path}`" for path in frame.allowed_paths)
    lines.extend(["", "## Forbidden paths"])
    lines.extend(f"- `{path}`" for path in frame.forbidden_paths)
    lines.extend(["", "## Acceptance evidence"])
    lines.extend(f"- `{item}`" for item in frame.acceptance)
    lines.extend(["", "## Unknowns"])
    lines.extend(f"- {item}" for item in frame.unknowns)
    if issues:
        lines.extend(["", "## Blocking issues"])
        lines.extend(f"- {item}" for item in issues)
    return "\n".join(lines) + "\n"


def example() -> TaskFrame:
    return TaskFrame(
        goal="Prevent duplicate email addresses during signup",
        allowed_paths=["app/accounts.py", "tests/test_accounts.py"],
        forbidden_paths=["migrations/**", "deploy/**"],
        acceptance=["python3 -m unittest tests.test_accounts"],
        facts=[
            RepositoryFact("Account writes use AccountStore", "app/accounts.py:18"),
            RepositoryFact("Duplicate errors use status 409", "tests/test_accounts.py:44"),
        ],
        unknowns=["Whether email comparison is case-insensitive"],
    )


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "task-frame.md"
    output.write_text(render(example()), encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
