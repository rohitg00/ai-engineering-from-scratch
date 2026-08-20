"""Phase 13 Lesson 22 - SKILL.md loader and agent bundle demo.

Lesson: ../docs/en.md
Reference: https://agentskills.io/specification
Parses frontmatter, discovers Skills, and loads bounded subresources.
Run: python3 main.py
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory


RELEASE_NOTES_SKILL = """\
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag.
2. Group by label: feature, fix, chore, docs.
3. For each PR, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

See style-guide.md for the house style rules.
"""

RELEASE_STYLE = """\
# Release notes style guide

- One line per PR. No prose.
- Feature entries first; fixes second; chores third; docs last.
- Skip chores from public changelog.
"""

PR_REVIEW_SKILL = """\
---
name: pr-reviewer
description: Review a PR diff against the project's style guide and open clarifying comments.
---

# PR reviewer

Steps:

1. Fetch the PR diff.
2. Identify rules from AGENTS.md that the diff touches.
3. Write one comment per clear violation.
"""

SKILL_NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    body: str
    root: Path


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    frontmatter: dict[str, str] = {}
    for line in text[4:end].splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip()
    return frontmatter, text[end + 5 :]


def load_skill(folder: Path) -> Skill | None:
    skill_path = folder / "SKILL.md"
    if not skill_path.is_file():
        return None
    frontmatter, body = parse_frontmatter(skill_path.read_text(encoding="utf-8"))
    name = frontmatter.get("name")
    description = frontmatter.get("description", "")
    if (
        not name
        or len(name) > 64
        or SKILL_NAME.fullmatch(name) is None
        or name != folder.name
        or not description
        or len(description) > 1024
    ):
        return None
    return Skill(
        name=name,
        description=description,
        body=body.strip(),
        root=folder,
    )


def discover_skills(root: Path) -> dict[str, Skill]:
    if not root.is_dir():
        return {}
    registry: dict[str, Skill] = {}
    for folder in sorted(root.iterdir()):
        if not folder.is_dir():
            continue
        skill = load_skill(folder)
        if skill is not None:
            registry[skill.name] = skill
    return registry


def read_subresource(skill: Skill, filename: str) -> str:
    root = skill.root.resolve()
    path = (root / filename).resolve()
    if path != root and root not in path.parents:
        return f"(subresource outside skill root: {filename})"
    if not path.is_file():
        return f"(no such subresource: {filename})"
    return path.read_text(encoding="utf-8")


def setup_fixtures(root: Path) -> None:
    release_notes = root / "release-notes-writer"
    release_notes.mkdir(parents=True)
    (release_notes / "SKILL.md").write_text(
        RELEASE_NOTES_SKILL, encoding="utf-8"
    )
    (release_notes / "style-guide.md").write_text(RELEASE_STYLE, encoding="utf-8")
    reviewer = root / "pr-reviewer"
    reviewer.mkdir()
    (reviewer / "SKILL.md").write_text(PR_REVIEW_SKILL, encoding="utf-8")


def agent_run(skill: Skill, user_task: str) -> str:
    print(f"  [loader] loading skill '{skill.name}'")
    prompt = f"""You are an assistant with the {skill.name} skill loaded.

Skill instructions:
{skill.body}

User task: {user_task}
"""
    if "style-guide" in skill.body.lower():
        style = read_subresource(skill, "style-guide.md")
        print(f"  [loader] subresource pulled ({len(style)} bytes)")
        prompt += f"\n\nAdditional style guide:\n{style}"
    return prompt


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 22 - SKILLS AND AGENT SDK LOADER")
    print("=" * 72)
    with TemporaryDirectory(prefix="lesson-22-skills-") as directory:
        root = Path(directory)
        setup_fixtures(root)
        print(f"\n--- discovery under {root} ---")
        skills = discover_skills(root)
        for name, skill in skills.items():
            print(f"  {name:25s} -> {skill.description}")
        prompt = agent_run(
            skills["release-notes-writer"], "draft the 1.4.0 release notes"
        )
        print("\n[the system prompt the agent would send to the model]")
        print("-" * 72)
        print(prompt[:600] + "...")
    print("\n--- AGENTS.md + SKILL.md + MCP: the three-layer stack ---")
    print("  AGENTS.md (repo root)       -> project conventions at session start")
    print("  SKILL.md (.agents/skills/)  -> reusable workflows on demand")
    print("  MCP server                  -> tools the skill invokes")


if __name__ == "__main__":
    demo()
