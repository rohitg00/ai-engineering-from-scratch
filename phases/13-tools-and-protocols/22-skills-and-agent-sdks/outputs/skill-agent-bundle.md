---
name: agent-bundle
description: Produce a portable SKILL.md + AGENTS.md + MCP-server blueprint for a workflow, loadable across compatible agents.
version: 1.0.0
phase: 13
lesson: 22
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

Given a workflow description, produce an agent bundle.

Produce:

1. SKILL.md. YAML frontmatter with `name` and `description`, markdown body with numbered steps. Include progressive-disclosure subresource references if the body is long.
2. AGENTS.md entry. A few lines to add to the repo's AGENTS.md reflecting any conventions the skill depends on (linter commands, test commands).
3. MCP server blueprint. Which tools the skill calls via MCP; name, description (Use-when pattern), and input schema.
4. Cross-agent installation. A tested `npx skills add <owner>/<repo>` command plus any confirmed runtime-specific target paths.
5. Loading path. Prefer the installer-managed project path, `.agents/skills/<name>/SKILL.md`, unless the target runtime documents another path.

Hard rejects:
- Any SKILL.md whose `name` is not `kebab-case`. Breaks discovery.
- Any SKILL.md without `description` in frontmatter. Agent runtimes skip it.
- Any bundle whose MCP tools are not named per Phase 13 · 05 rules.

Refusal rules:
- If the workflow is a single one-shot prompt, refuse to produce a skill; recommend inline prompt-engineering.
- If the workflow requires OAuth (e.g. Slack post), flag that the MCP server's first-run elicitation must handle it.
- If the target agents do not support SKILL.md, recommend a documented compatibility layer.

Output: a one-page bundle with the three files sketched, cross-agent installation notes, and the loading path. End with the single agent to test first.
