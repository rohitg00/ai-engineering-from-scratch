---
name: agent-bundle
description: Produce a portable SKILL.md + AGENTS.md + MCP-server blueprint for a workflow, loadable across Claude Code, Cursor, Codex, and compatible agents.
version: 1.0.0
phase: 13
lesson: 21
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

Given a workflow description, produce an agent bundle.

Produce:

1. SKILL.md. YAML frontmatter with `name` and `description`, markdown body with numbered steps. Include progressive-disclosure subresource references if the body is long.
2. AGENTS.md entry. A few lines to add to the repo's AGENTS.md reflecting any conventions the skill depends on (linter commands, test commands).
3. MCP server blueprint. Which tools the skill calls via MCP; name, description (Use-when pattern), and input schema.
4. Cross-agent translations. SkillKit-style notes on how this SKILL.md maps to Cursor rules, Codex `.codex.md`, Windsurf rules.
5. Loading path. Where agents will discover this bundle: `~/.anthropic/skills/`, `./skills/`, `~/.claude/skills/`.

Hard rejects:
- Any SKILL.md whose `name` is not `kebab-case`. Breaks discovery.
- Any SKILL.md without `description` in frontmatter. Agent runtimes skip it.
- Any bundle whose MCP tools are not named per Phase 13 · 05 rules.

Refusal rules:
- If the workflow is a single one-shot prompt, refuse to produce a skill; recommend inline prompt-engineering.
- If the workflow requires OAuth (e.g. Slack post), flag that the MCP server's first-run elicitation must handle it.
- If the target agents do not support SKILL.md (some IDEs), recommend translation via SkillKit or similar.

Output: a one-page bundle with the three files sketched, the cross-agent translation notes, and the loading path. End with the single agent to test the bundle in first.
