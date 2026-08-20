# Skills and Agent SDKs — Anthropic Skills, AGENTS.md, OpenAI Apps SDK

> MCP says "what tools exist." Skills say "how to do a task." The 2026 stack layers both. Agent Skills ship as SKILL.md bundles with progressive disclosure. OpenAI's Apps SDK adds widget metadata to MCP. AGENTS.md supplies project context. This lesson builds a minimal bundle and installs it through the same cross-agent workflow used by this course.

**Type:** Learn
**Languages:** Python (stdlib, SKILL.md parser and loader)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45 minutes

## Learning Objectives

- Distinguish the three layers: AGENTS.md (project context), SKILL.md (reusable know-how), MCP (tools).
- Write a SKILL.md with YAML frontmatter and progressive disclosure.
- Load skills filesystem-style into an agent runtime.
- Install one Skill source for Claude Code, Cursor, Codex, Hermes Agent, and OpenClaw.

## The Problem

An engineer distills a release-notes-writing workflow into a multi-step prompt: "Read the latest merged PRs. Group by area. Summarize each. Write a changelog entry following the team's style. Post to Slack draft." They put it in a Notion doc for their team.

Now they want to use this workflow from Claude Code, Cursor, Codex, Hermes Agent, and OpenClaw. Each runtime has its own discovery paths. The engineer copies the workflow five times and maintains five copies.

AGENTS.md and SKILL.md together fix this:

- **AGENTS.md** sits at the repo root. Every compatible agent reads it on session start. "How does this project work? What are the conventions? Which commands run tests?"
- **SKILL.md** is a portable bundle: YAML frontmatter (name, description) + markdown body + optional resources. Agents that support skills load them by name on demand.
- **MCP** (Phase 13 · 06-14) handles the tools the skill needs to invoke.

Three layers, one portable artifact.

## The Concept

### AGENTS.md (agents.md)

Launched late 2025, adopted by 60,000+ repos by April 2026. One file at repo root. Format:

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

Agents read this on session start and use it to calibrate their behavior for that project. Every coding agent in 2026 supports AGENTS.md: Claude Code, Cursor, Codex, Copilot Workspace, opencode, Windsurf, Zed.

### SKILL.md format

Anthropic's Agent Skills (released as an open standard December 2025):

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

Frontmatter declares the skill's identity. The body is the prompt shown to the model when the skill loads.

### Progressive disclosure

Skills can reference sub-resources that the agent fetches only when needed. Example:

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md says "see style-guide.md for the style rules." The agent pulls style-guide.md only when the skill is actively running. This avoids bloating the prompt with detail the model may not need.

### Filesystem discovery and installation

Skill sources commonly keep bundles under `./skills/<name>/SKILL.md`. An installer then links or copies each selected bundle into the target runtime. The installer used by this repository supports one source and several agents:

```bash
npx skills add rohitg00/ai-engineering-from-scratch
npx skills list --json
```

Project installs can share `.agents/skills/<name>/SKILL.md` across compatible runtimes. Claude Code also reads `.claude/skills/`; Hermes Agent reads `~/.hermes/skills/`; OpenClaw can read `~/.config/openclaw/skills/`. Treat these paths as runtime contracts, not portable source layout. Let the installer select them when possible.

Loading is by folder name and frontmatter `name`. Verify the result with `npx skills list --json`, then review the installed files before invoking the Skill.

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` (TypeScript) and `claude-agent-sdk` (Python) load skills at session start, expose them as callable "agents" inside the runtime. The agent loop dispatches to a skill when the user invokes it.

### OpenAI Apps SDK

Launched October 2025; built directly on MCP. Unifies OpenAI's prior Connectors and Custom GPT Actions under a single developer surface. An Apps SDK app is:

- An MCP server (tools, resources, prompts).
- Plus widget metadata for ChatGPT's UI.
- Plus an optional MCP Apps `ui://` resource for interactive surfaces.

Same protocol, richer UX.

### Cross-agent portability through one source

Cross-agent installers link or copy a single SKILL.md bundle into each runtime's discovery path. Keep one source of truth, select explicit agent targets, and verify the installed inventory. Do not hand-maintain translated instruction copies when each target already reads SKILL.md.

### The three-layer stack

| Layer | File | Loaded when | Purpose |
|-------|------|-------------|---------|
| AGENTS.md | repo root | session start | project-level conventions |
| SKILL.md | skills directory | skill invoked | reusable workflow |
| MCP server | external process | tools needed | callable actions |

All three compose: the agent reads AGENTS.md on session start, the user invokes a skill, the skill's instructions include MCP tool calls, the agent dispatches via an MCP client.

```figure
t3-skill-layers
```

## Use It

`code/main.py` ships a stdlib SKILL.md parser and loader. It discovers Skills under a supplied root, parses the YAML frontmatter plus markdown body, and produces a dict keyed by Skill name. It then simulates an agent loop that invokes `release-notes-writer` by name.

What to look at:

- YAML frontmatter parsed with a minimal stdlib parser (no `pyyaml` dependency).
- Skill body stored verbatim; agent prepends it to the system prompt on invocation.
- Progressive disclosure through a `read_subresource` function that rejects paths outside the Skill root.
- Temporary fixtures that leave no project or user files behind.

## Ship It

This lesson produces `outputs/skill-agent-bundle.md`. Given a workflow, the skill produces the combined SKILL.md + AGENTS.md + MCP-server-blueprint bundle, portable across agents.

## Exercises

1. Run `code/main.py`. Add a second skill under `skills/` and confirm the loader picks it up.

2. Write an AGENTS.md for this course repo. Include testing commands, style conventions, and the Phase 13 mental model.

3. Port a multi-step workflow from your team's internal docs into a SKILL.md. Verify it loads in Claude Code.

4. Install the Skill into two compatible agents. Compare `npx skills list --json` with the files each runtime reads.

5. Read the Anthropic Agent Skills blog post. Identify one feature in the Claude Agent SDK that this lesson's loader does not cover. (Hint: agent sub-invocation.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SKILL.md | "The skill file" | YAML frontmatter plus markdown body, loaded by agent runtime |
| AGENTS.md | "Repo-root agent context" | Project-level conventions file read on session start |
| Progressive disclosure | "Lazy-load sub-resources" | Skill body references files pulled only when needed |
| Frontmatter | "YAML block at top" | Metadata (name, description) in `---` delimiters |
| Claude Agent SDK | "Anthropic's skill runtime" | `@anthropic-ai/claude-agent-sdk`, loads skills and routes |
| OpenAI Apps SDK | "MCP + widget meta" | OpenAI's dev surface built on MCP plus ChatGPT UI hooks |
| Skill discovery | "Filesystem scan" | Walk known dirs for SKILL.md, key by name |
| Cross-agent portability | "One skill many agents" | Install one reviewed SKILL.md source into compatible runtime paths |
| Agent Skill | "Portable know-how" | Reusable task template outside MCP's tool concept |
| Apps SDK | "MCP plus ChatGPT UI" | Connectors and Custom GPTs unified on MCP |

## Further Reading

- [Anthropic — Agent Skills announcement](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — December 2025 launch
- [Anthropic — Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md format reference
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — MCP-based developer platform for ChatGPT
- [agents.md](https://agents.md/) — AGENTS.md format and adoption list
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — official skill examples
- [Agent Skills specification](https://agentskills.io/specification) — portable SKILL.md bundle contract
- [skills CLI](https://github.com/vercel-labs/skills) — installer used by this repository
