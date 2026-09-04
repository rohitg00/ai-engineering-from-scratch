# CCAR-F Exact Mechanics Review

> Use this as a dated lookup drill after you understand the architecture. It is not a substitute for building the workflows.

**Guide:** Claude Certified Architect - Foundations, version 1.0
**Guide effective:** July 2026
**Verified:** 2026-08-09

The public CCAR-F guide tests durable judgment and exact operating mechanics.
This review collects the guide's named interfaces so you can distinguish a
correct design from a plausible-looking command, path, or field. Recheck every
item against the current official guide and documentation before release.

## Agent Loop and Session State

| Mechanic | What to recall | Decision boundary |
|---|---|---|
| `stop_reason: "tool_use"` | Execute the requested tool, append the matching result, and continue | Do not infer loop state from natural-language phrases |
| `stop_reason: "end_turn"` | The model has reached the normal terminal turn | Also handle errors, limits, cancellation, and other terminal states in production |
| Tool result identity | Return each result against the originating tool-use identifier | Never join concurrent results by array position |
| Conversation state | Preserve the content blocks required for the next request | Extract durable facts outside lossy summaries |
| `--resume <session-name>` | Continue a named prior session | Start fresh with an explicit summary when old tool observations are stale |
| `fork_session` | Branch independent exploration from a shared baseline | Use separate branches when approaches should not contaminate one another |

## Tool Selection and Structured Output

| Mechanic | Meaning |
|---|---|
| `tool_choice: "auto"` | The model may call a tool or return text |
| `tool_choice: "any"` | The model must call one of the supplied tools |
| `tool_choice: {"type":"tool","name":"..."}` | The named tool must be selected |
| Strict JSON Schema | Reduces syntax and shape failures; semantic validation remains required |
| Pydantic validation | A Python implementation option for shape and domain checks, not proof that extracted facts are true |

Use forced selection only when the workflow truly requires that first typed
operation. It is not a general replacement for orchestration, authorization,
or semantic verification.

## MCP Configuration

| Scope or behavior | Public-guide mechanic |
|---|---|
| Shared project server | `.mcp.json` under version control |
| Personal or experimental server | `~/.claude.json` |
| Secrets | Environment expansion such as `${GITHUB_TOKEN}`; never commit the value |
| Discovery | Tools from configured servers are discovered at connection time |
| Resources | Expose content catalogs and schemas when browsing them through repeated tool calls would be wasteful |

Current MCP transport and deployment details live in lesson 11. Treat stdio and
Streamable HTTP as current transports and legacy HTTP+SSE as deprecated.

## Claude Code Team Surfaces

| Surface | Exact review point |
|---|---|
| Project command | `.claude/commands/` |
| Personal command | `~/.claude/commands/` |
| Skill | `.claude/skills/<skill-name>/SKILL.md` |
| Skill frontmatter | `context: fork`, `allowed-tools`, and `argument-hint` are named in the guide |
| Conditional rule | Markdown under `.claude/rules/` with a `paths` glob in YAML frontmatter |
| Non-interactive run | `-p` or `--print` |
| Machine-readable CI | `--output-format json` with `--json-schema` |

Scope is part of the answer. A useful instruction in the wrong user, project,
or path-specific location is still a configuration failure.

## Message Batches

The July 2026 guide names these exam reference facts:

- 50 percent cost savings relative to standard processing.
- An up-to-24-hour processing window with no guaranteed latency SLA.
- `custom_id` for request/result reconciliation.
- No multi-turn tool execution inside one batch request.
- Resubmit only safe failed items after classifying the failure.

These are dated product facts. Check the current Message Batches documentation
before using them for an actual cost or SLA decision.

## Built-In Tool Choice

The guide explicitly names Read, Write, Edit, Bash, Grep, and Glob. Review the
boundary rather than memorizing a popularity order:

- Read before changing content you have not inspected.
- Edit requires a reliable match; use a whole-file write only when a controlled
  replacement is safer.
- Grep searches content; Glob finds paths by pattern.
- Bash crosses a powerful execution boundary and needs tighter permission,
  validation, and sandbox controls.

## Closed-Book Drill

For each row above:

1. Write the exact path, flag, field, or state from memory.
2. Give one scenario where it is the correct choice.
3. Give one plausible alternative and the constraint it violates.
4. Verify the exact mechanic in an official source.
5. Build or run the linked lesson artifact that exercises the decision.

Do not count a memorized string as mastery until you can explain its scope,
failure mode, and safer alternative.

## Official Sources

- [CCAR-F exam guide](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542750%2FClaude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf)
- [Claude Code documentation](https://code.claude.com/docs/en/overview)
- [Claude Agent SDK documentation](https://code.claude.com/docs/en/agent-sdk/overview)
- [Tool-use documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Message Batches documentation](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- [MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro)
