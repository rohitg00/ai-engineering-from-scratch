---
id: tool-resource-or-prompt
title: Pick the MCP primitive by who chooses it
card: protocols
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [mcp, tools, resources, prompts, primitives]
minutes: 6
lessons: [phases/13-tools-and-protocols/10-mcp-resources-and-prompts]
manuals: []
practice: []
cheatsheet: [mcp]
related: [protocols/two-error-layers]
updated: 2026-11-03
---

A team builds an MCP server for a project tracker. It has five capabilities: show the details of one issue, create an issue, a sprint review template, the project policy document, and close an issue. A developer proposes to publish each capability as a tool, a resource and a prompt at the same time, so that every client finds it. Which primitive do you give each capability, and why not all three?

## Short answer

Pick the primitive from who makes the choice. The model chooses a tool to perform an operation, so create and close are tools. A host or a user reads addressable content at a URI, so issue details and the policy are resources, and a user starts a prepared message workflow, so the review template is a prompt. Each extra surface costs discovery, authorization, caching, error handling, tests and documentation, so one capability gets one primitive.

## Full answer

### Three primitives, three choosers

| Primitive | Chooser | Intent | Result |
|---|---|---|---|
| Tool | model or application | perform an operation | structured action result |
| Resource | host, application or user | read content at a URI | text or binary content |
| Prompt | user, through the host UI | start a reusable message workflow | one or more messages |

### The five capabilities

- Issue details: content with a stable address, such as `tracker://issues/7`. A resource.
- Create issue: changes state. A tool.
- Sprint review template: a user picks it from a menu or a slash command and fills in arguments. A prompt.
- Project policy: a document the host reads into context. A resource.
- Close issue: changes state. A tool.

### Why the triple publication is wrong

A capability published three ways needs three discovery entries, three authorization checks, three cache policies, three error paths and three test sets. The model also sees a tool it should not call for content that the host reads. Begin with the consumer, then write the handler.

### Design rules that follow

- Design the resource URI before the handler. Namespace it to the server, keep it independent of a process or a connection, validate it before storage access, and authorize every read.
- `prompts/get` resolves arguments into messages. The host decides how those messages enter model context and keeps its own policy above them.
- Treat resource text and prompt templates as untrusted server output. The host keeps provenance and treats the content as data.

## Follow-ups

- **Level 1:** What makes a good resource URI? Expected: stable enough to bookmark, namespaced to the server, independent of a process id or connection, validated before storage access, and authorized on every read.
- **Level 2:** A client wants to know when the policy document changes. Which mechanism does the current revision use? Expected: a client-opened `subscriptions/listen` request that names the URI in `resourceSubscriptions`; the event says the resource changed, and the client reads it again with `resources/read`.
- **Level 2:** A client asks `resources/read` for a URI that does not exist. Do you return an empty document? Expected: no, return JSON-RPC `-32602`, so the client can tell absence from a valid empty document.
- **Level 3:** When would you publish a resource template instead of listing every issue? Expected: when the list is large or unbounded; the template tells the client how to form a valid URI, and the server still parses the variables, authorizes, and uses typed storage queries.

## Wrong answers

- "Make everything a tool so that the model can reach it." Content that a host reads is not an operation. It loses the URI contract, the cache hints and the user-controlled surface.
- "Store the template as a resource because it lives in a file." Where the data is stored does not decide the primitive. A user starts the review, so it is a prompt.
- "A prompt is policy that the host injects without the user knowing." Prompts exist for explicit user selection. Policy that the host enforces stays in the host at a higher priority.

## Taught in

The [resources and prompts lesson](../../../phases/13-tools-and-protocols/10-mcp-resources-and-prompts/) sorts the three primitives by the consumer's intent and shows the subscription flow.
