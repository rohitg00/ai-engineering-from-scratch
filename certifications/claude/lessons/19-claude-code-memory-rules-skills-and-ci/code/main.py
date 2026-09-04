"""Companion validator for this lesson's docs/en.md configuration audit."""

from __future__ import annotations

import json
from pathlib import Path


ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "configuration-scope-audit.md"
SKILL_DIR = Path(__file__).resolve().parents[1] / "outputs" / "migration-review-skill"
SKILL_FILE = SKILL_DIR / "SKILL.md"
SCRIPT_FILE = SKILL_DIR / "scripts" / "check_scope.py"
REFERENCE_FILE = SKILL_DIR / "references" / "review-checklist.md"
REQUIRED_HEADINGS = (
    "## Instruction Hierarchy",
    "## Path Rule Fixtures",
    "## Skill and Command",
    "## Skill Package",
    "## Subagent Contract",
    "## Plugin Distribution",
    "## Hooks",
    "## Headless CI",
    "## Remediation",
)
REQUIRED_EVIDENCE = {
    "ci": ("fresh checkout", "read-only", "structured"),
    "fixtures": ("allow", "deny"),
    "enforcement": ("pre-write hook", "deterministic"),
    "skill": ("skill.md", "allowed-tools", "scripts/check_scope.py", "references/review-checklist.md"),
    "subagent": ("/agents", "maxturns", "isolation: worktree", "blockers", "next_step"),
    "distribution": (".claude/settings.json", "extraknownmarketplaces", "enabledplugins", "managed settings"),
    "hook protocol": ("exit 0", "exit 2", "permissionrequest", "pretooluse"),
    "official ci": ("code review", "anthropics/claude-code-action@v1"),
}


def validate_text(text: str) -> dict[str, object]:
    lowered = " ".join(text.lower().split())
    findings = [f"missing heading: {heading}" for heading in REQUIRED_HEADINGS if heading not in text]
    for label, terms in REQUIRED_EVIDENCE.items():
        missing = [term for term in terms if term not in lowered]
        if missing:
            findings.append(f"missing {label}: {', '.join(missing)}")
    if any(marker in lowered for marker in ("tbd", "todo", "[replace")):
        findings.append("unresolved placeholder")
    return {"status": "configuration_verified" if not findings else "blocked", "score": max(0, 100 - 12 * len(findings)), "findings": findings}


def validate_artifact(path: Path = ARTIFACT) -> dict[str, object]:
    result = validate_text(path.read_text(encoding="utf-8"))
    skill_result = validate_skill()
    findings = list(result["findings"]) + list(skill_result["findings"])
    return {
        "status": "configuration_verified" if not findings else "blocked",
        "score": max(0, 100 - 8 * len(findings)),
        "findings": findings,
    }


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        return {}
    raw = text[4:].split("\n---\n", 1)[0]
    values: dict[str, str] = {}
    for line in raw.splitlines():
        if ":" not in line:
            return {}
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()
    return values


def validate_skill(skill_dir: Path = SKILL_DIR) -> dict[str, object]:
    findings: list[str] = []
    paths = {
        "SKILL.md": skill_dir / "SKILL.md",
        "scripts/check_scope.py": skill_dir / "scripts" / "check_scope.py",
        "references/review-checklist.md": skill_dir / "references" / "review-checklist.md",
    }
    for label, path in paths.items():
        if not path.is_file():
            findings.append(f"missing skill file: {label}")
    if findings:
        return {"status": "blocked", "findings": findings}

    text = paths["SKILL.md"].read_text(encoding="utf-8")
    metadata = parse_frontmatter(text)
    if metadata.get("name") != "migration-review":
        findings.append("skill name must be migration-review")
    description = metadata.get("description", "").lower()
    if not all(term in description for term in ("migration", "when")):
        findings.append("skill description must state what it does and when to trigger")
    allowed_tools = metadata.get("allowed-tools", "")
    if "${CLAUDE_SKILL_DIR}/scripts/check_scope.py" not in allowed_tools:
        findings.append("allowed-tools must scope the bundled checker")
    if "Bash(*)" in allowed_tools:
        findings.append("allowed-tools must not grant broad Bash")
    for reference in ("scripts/check_scope.py", "references/review-checklist.md"):
        if reference not in text:
            findings.append(f"SKILL.md must route to {reference}")
    if any(marker in text.lower() for marker in ("tbd", "todo", "[replace")):
        findings.append("skill contains unresolved placeholder")
    return {"status": "valid" if not findings else "blocked", "findings": findings}


if __name__ == "__main__":
    print(json.dumps(validate_artifact(), indent=2))
