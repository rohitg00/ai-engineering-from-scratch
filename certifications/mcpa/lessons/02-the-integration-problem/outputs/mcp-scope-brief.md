# MCP Scope Brief

A one-page reference for the MCPA "MCP Fundamentals" domain, aligned to MCP 2026-07-28.

## The argument

Without a shared protocol, N AI applications and M systems need N times M custom integrations. With MCP, each application implements a client once and each system implements a server once: N plus M. Four applications and six systems drop from 24 integrations to 10, and every new system adds one implementation instead of four.

## What MCP standardizes

- How a server describes itself: `server/discover` returns supported versions, capabilities, and identity.
- How a client learns what a server offers: `tools/list`, `resources/list`, `prompts/list`.
- How a tool is invoked and how results and errors come back: `tools/call`, `CallToolResult`, JSON-RPC errors.
- The per-request metadata every request carries in `params._meta`: protocol version and client capabilities (required), client identity (recommended).

## What MCP leaves to the application

Which model the host uses, how it builds prompts, how it renders the conversation, and when it asks the user for approval.

## Participants and primitives

| Part | One sentence | Controlled by |
|------|--------------|---------------|
| Host | The application the user works in | the user |
| Client | Talks to one server on the host's behalf | the host |
| Server | Exposes tools, resources, and prompts | its operator |
| Tool | An action with a name, description, and input schema | the model |
| Resource | Readable data identified by a URI | the application |
| Prompt | A reusable template | the user |

## Two error channels

| Situation | Channel | Example |
|-----------|---------|---------|
| The request itself is wrong | JSON-RPC error | unknown tool: `-32602` |
| The tool hit a problem the model can fix | result with `isError: true` | missing or invalid argument |
| The request uses a version the server lacks | JSON-RPC error | `-32022` with `data.supported` |

## Remember for the exam

- There is no `initialize` handshake and no session in 2026-07-28.
- Every result carries `resultType`.
- An unknown tool is `-32602`, not `-32601`.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`.
