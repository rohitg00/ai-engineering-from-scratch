# MCPA Readiness Checklist

A pre exam checklist for MCP 2026-07-28, aligned to `certifications/mcpa/tracks/mcpa-f.json`. All 18 objectives across the five weighted domains are listed here, each one turned into something you can actually do, with a pointer to where this capstone's transcript (`code/main.py`, `docs/en.md`) exercises it or to the earlier lesson that first taught it. Work through it once right after this lesson, then again the night before the exam.

## MCP Fundamentals (16 percent)

- [ ] I can explain the integration problem MCP standardizes, N times M custom integrations collapsing to N plus M, and what the protocol deliberately leaves to the host application. First taught in lesson 02; this capstone assumes it as background for every exchange it runs.
- [ ] I can describe hosts, clients, servers, primitives, and the stateless JSON-RPC request model, including why no request may lean on anything an earlier request established. Lesson 04 builds this in depth; this capstone's server answers every call from a fresh, self contained request every time.
- [ ] I can reason about protocol versioning and why one open protocol beats per system custom integrations. Exercised directly: the transcript's first call uses protocol version 2025-11-25 and gets UnsupportedProtocolVersionError before the corrected call proceeds.
- [ ] I can read the specification, its revision history, and its feature lifecycle well enough to tell current, deprecated, and removed behavior apart. Lessons 01, 05, and 15 cover this; this capstone never uses a removed method and treats roots, sampling, and logging as deprecated rather than gone.

## Architecture and Components (14 percent)

- [ ] I can read the schemas and structured data that define MCP messages, tool definitions, capabilities, and server manifests. Exercised directly: restart_service's inputSchema is what turns a missing environment argument into an isError result instead of a silent success.
- [ ] I can distinguish host, client, and server responsibilities and how discovery and capability negotiation connect them. Exercised directly: server/discover advertises the tasks extension before any client tries to use it, and every later call still declares its own capabilities per request.
- [ ] I can trace the model interaction flow from a user request through the host, model, client, and server and back into model context. Lesson 10 builds the full loop; this capstone's restart_service sequence is one concrete pass through it, request, schema check, consent, result.

## Interactions and Execution (26 percent)

- [ ] I can apply the request, notification, subscription, and MRTR interaction patterns and handle each result type. Exercised directly: this transcript produces complete, input_required, and task results, plus notifications/progress, in one run.
- [ ] I can handle protocol errors and tool execution errors, including version, capability, header, and validation failures. Exercised directly: -32022 for version, -32021 for capability, -32020 territory covered in lesson 19's header checks, and isError true for a validation failure, all in one server.
- [ ] I can walk the tool invocation lifecycle from discovery and selection through call, user input, progress, cancellation, and result. Exercised directly: scan_fleet_health carries progress to a result, restart_service carries user input through MRTR to a result, and a second diagnostics task is cancelled before it reaches one.
- [ ] I can identify the protocol primitives and utilities: tools, resources, prompts, completion, caching, pagination, transports, and deprecated client features. This capstone's own transcript covers tools, caching hints, and both stdio style and Streamable HTTP transports; lessons 12, 13, 15, and 20 cover resources, prompts, completion, and pagination in the depth this lesson does not repeat.

## Security and Governance (24 percent)

- [ ] I can locate the trust boundaries between host, client, server, model, and the tools and content a server exposes. Lesson 22 names the boundary; this capstone's OAuth gate on acknowledge_incident is that boundary enforced at the wire.
- [ ] I can apply OAuth based authorization, client registration, scopes, and consent so a user approves what a server may see and do. Exercised directly: a bearer token minted for a different resource server audience is rejected with 401, and the correctly scoped token succeeds; lessons 23 and 24 build the full authorization and registration flow this call assumes.
- [ ] I can choose risk and safety controls against tool poisoning, injection, token misuse, and over broad access. Exercised directly: restart_service never executes on a caller's say so alone, it requires a declared capability, a signed requestState, and an explicit accept; lesson 26 covers the wider control catalog.
- [ ] I can design auditability and observability so protocol activity can be traced, attributed, and reviewed. Exercised directly: one W3C trace id threads every hop in this transcript, and the hash chained audit log records who did what and still verifies, or names the exact tampered entry when it does not.

## Use Cases and Ecosystem (20 percent)

- [ ] I can map the roles, responsibilities, governance, and adoption patterns of teams building and deploying MCP. Lesson 28 covers this in depth; this capstone's incident-console is one instance of an operational team's server, not a toy.
- [ ] I can select operational use cases and the primitives or extensions that fit each one. Exercised directly: a quick read only scan stays a plain call, a destructive restart gets MRTR consent, and a long diagnostic sweep gets the tasks extension, three different problems matched to three different mechanisms; lesson 29 catalogs more.
- [ ] I can reason about ecosystem portability across clients, servers, SDKs, extensions, gateways, and registries. Lessons 30 through 32 build this out; this capstone's extension negotiation, the tasks extension present in capabilities and only used when both sides declare it, is the portability mechanism those lessons describe, seen working.

## Final exam trap review

- An unknown tool is always -32602, never -32601; -32601 is reserved for a JSON-RPC method the server has genuinely never heard of.
- A schema invalid tool call is a tool execution error, isError true, never a protocol error.
- There is no initialize handshake and no session in 2026-07-28; every request carries its own protocol version and capabilities.
- An MRTR retry always uses a new JSON-RPC id and echoes requestState exactly; reusing the original id is wrong.
- Resource not found and a custom application error both sit outside -32000 to -32019 and -32020 to -32099 in a conformant 2026-07-28 server.
- Roots, sampling, and logging are deprecated, not removed; they still work, they are simply not where new designs should start.
- A token minted for one resource server audience must never be accepted by another; passthrough of a caller's token upstream is forbidden.
- cacheScope public means a response may be shared across users, never that it is safe to skip access control on.

Source: `certifications/mcpa/tracks/mcpa-f.json` for the domain objectives, `certifications/mcpa/research/mcp-2026-07-28-brief.md` for the protocol facts, and this lesson's own `code/main.py` transcript for every "exercised directly" line above.
