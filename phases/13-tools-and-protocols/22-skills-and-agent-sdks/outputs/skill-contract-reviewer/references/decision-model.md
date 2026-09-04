# Primitive decision model

Select by responsibility. More than one primitive may be correct.

| Need | Primitive | Boundary |
|---|---|---|
| One-off instruction | Prompt | Exists for the current interaction |
| Repository-wide default | AGENTS.md | Applies while working in that repository scope |
| Reusable task method | Agent Skill | Loads procedural knowledge for a task |
| External operation or data | MCP tool | Exposes a callable capability with an input contract |
| Reaction to a runtime event | Hook | Runs at a host-defined lifecycle point |
| Deterministic transformation | Ordinary code | Produces repeatable output without model judgment |
| Isolated or parallel context | Subagent | Delegates a bounded task into a separate context window |

A release-review method that queries a remote service may use both an Agent Skill and an MCP tool. Repository test conventions may add AGENTS.md. A post-tool audit may add a hook. Stable parsing belongs in ordinary code. Independent research that benefits from context isolation may use a subagent.
