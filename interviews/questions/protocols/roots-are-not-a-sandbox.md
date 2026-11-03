---
id: roots-are-not-a-sandbox
title: A root is a hint, not a permission
card: protocols
kind: concept
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [ml-depth, design-review]
tags: [mcp, roots, authorization, path-containment, scope]
minutes: 8
lessons: [phases/13-tools-and-protocols/12-mcp-roots-and-elicitation]
manuals: []
practice: []
cheatsheet: [mcp-security-auth]
related: [protocols/mrtr-confirmation-state]
updated: 2026-11-03
---

A filesystem MCP server reads the client's Roots list once and treats any path under a root as authorized for deletion. The client advertises one workspace directory. Two delete requests arrive: one for a sibling directory whose name starts with the workspace name, and one that reaches the parent through an encoded dot-dot segment. What is wrong with this design, and how do you replace it?

## Short answer

Roots were informational guidance, never authorization and never a sandbox, and the current revision deprecates them. A string-prefix check accepts both hostile paths, because both begin with the workspace text. Replace the root with an explicit `workspaceUri` argument or a resource URI, then enforce three layers: authorize the principal for that workspace, normalize the URI and check containment by path components, and run the server under an operating-system sandbox.

## Full answer

### What roots were

Earlier revisions let a client advertise Roots and send `notifications/roots/list_changed`. A root told the server where the user was working. It did not constrain what the server process could read, did not authorize the caller, and created no operating-system boundary. The current revision deprecates `roots/list` for new designs.

### The explicit replacements

| Situation | Replacement |
|---|---|
| scope varies per call | a `workspaceUri` or `directory` tool argument |
| the operation already targets a resource | the resource URI |
| one deployment owns one fixed workspace | server configuration |
| code must be unable to escape | a process sandbox or jailed filesystem |

The model can see and repeat an explicit handle. Hidden session scope is harder to inspect, replay, audit and route.

### Three layers, every time

1. Authorization: may this authenticated principal use this workspace?
2. Containment: does the normalized target stay inside the workspace boundary?
3. Sandbox: can the operating system stop a compromised server anyway?

### Why the prefix check fails

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

Both hostile paths start with the allowed text. Normalize percent-encoded segments first, then compare path components. Re-check containment right before the mutation, because a target can move after the request was validated. A real filesystem server also needs a symbolic-link policy and platform-specific path handling.

### The migration adapter

If a peer still needs `roots/list` during the deprecation window, the server embeds that request in an MRTR `input_required` result. It never sends a live reverse request. Label the adapter legacy, and never let a legacy root list bypass server authorization.

## Follow-ups

- **Level 2:** When is server configuration the right replacement? Expected: when one deployment owns one fixed workspace; per-call scope belongs in a `workspaceUri` argument.
- **Level 3:** Why re-check containment immediately before the deletion? Expected: the live record can move outside the workspace between validation and mutation, and a race must not delete the wrong target.
- **Level 3:** Why does lexical containment alone not stop a symlink escape? Expected: a link inside the boundary resolves to a path outside it, so the filesystem layer needs a symlink policy and resolution of the real path.
- **Level 4:** A pinned legacy peer still sends `roots/list`. How do you serve it without weakening the modern handler? Expected: an isolated adapter that embeds the request in MRTR input requests, labelled legacy, with authorization and containment still enforced on the server.

## Wrong answers

- "The client declared the root, so the server can trust the scope." A root is a self-reported hint. Authorization comes from the authenticated principal and server policy.
- "Check `startswith` on the allowed URI." A sibling directory and an encoded traversal both pass. Normalize, then compare path components.
- "An operating-system sandbox makes the authorization check unnecessary." The sandbox is the third layer for a compromised process. It does not decide which principal may touch which workspace.

## Taught in

The [roots and elicitation lesson](../../../phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/) states the three-layer rule and shows both hostile paths failing containment.
