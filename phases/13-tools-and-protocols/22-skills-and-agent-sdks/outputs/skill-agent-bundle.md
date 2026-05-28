---
name: agent-bundle
description: Claude Code、Cursor、Codex、互換agentでloadできるportableなSKILL.md + AGENTS.md + MCP-server blueprintをworkflowから作る。
version: 1.0.0
phase: 13
lesson: 21
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

Workflow descriptionを受け取り、agent bundleを作る。

Produce:

1. SKILL.md。`name`と`description`を含むYAML frontmatter、numbered stepsを含むmarkdown body。Bodyが長い場合はprogressive-disclosure subresource referencesを含める。
2. AGENTS.md entry。Skillが依存するconvention（linter commands、test commands）をrepoのAGENTS.mdへ追加するための数行。
3. MCP server blueprint。SkillがMCP経由で呼ぶtools。name、description（Use-when pattern）、input schema。
4. Cross-agent translations。SkillKit風に、このSKILL.mdがCursor rules、Codex `.codex.md`、Windsurf rulesへどうmapされるかを書く。
5. Loading path。Agentsがこのbundleを発見する場所: `~/.anthropic/skills/`、`./skills/`、`~/.claude/skills/`。

Hard rejects:
- `name`が`kebab-case`ではないSKILL.md。Discoveryを壊す。
- Frontmatterに`description`がないSKILL.md。Agent runtimesがskipする。
- MCP toolsがPhase 13 · 05のrulesに沿って命名されていないbundle。

Refusal rules:
- Workflowがsingle one-shot promptなら、skill化を拒否し、inline prompt-engineeringを勧める。
- WorkflowがOAuthを必要とする場合（例: Slack post）、MCP serverのfirst-run elicitationで扱う必要があるとflagする。
- Target agentsがSKILL.mdをsupportしない場合（一部IDE）、SkillKitまたは類似toolによるtranslationを勧める。

Output: 3つのfile sketch、cross-agent translation notes、loading pathを含む1ページbundle。最後に、まずどのsingle agentでbundleをtestするかを1つだけ示す。
