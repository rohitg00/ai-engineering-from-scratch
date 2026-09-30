# Consent and Least Privilege Design Checklist

A one-page reference for the MCPA Security and Governance domain, aligned to MCP 2026-07-28. Use it to review a design, not just to memorize it. Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 7, 11, and 12.

## When to ask a human

- [ ] A call that only reads or reports (read-only, closed-world) may proceed without a prompt.
- [ ] A call that writes, deletes, sends, purchases, or otherwise changes something outside the conversation needs explicit, informed approval before it runs.
- [ ] A call that reaches into the open world (the public internet, a third-party system) is treated as needing approval even when it is read-only, because openWorldHint defaults to true.
- [ ] A tool that ships no annotations at all is treated as destructive and open-world by default, never as safe by default.

## How consent is collected

- [ ] Consent travels through a Multi Round-Trip Request: the server answers with `resultType: "input_required"`, an `inputRequests` entry whose method is `elicitation/create`, and usually a `requestState`.
- [ ] The client's retry uses a brand new JSON-RPC id, carries the answer under `inputResponses` keyed the way the server named it, and echoes `requestState` back exactly.
- [ ] The user's answer is one of three actions: `accept` (with matching `content` for form mode), `decline`, or `cancel`. Only `accept` is consent; the other two both block the call but are not the same event.
- [ ] `requestState` is treated as attacker-controlled input. When it matters, it is signed, bound to the specific call it was issued for, and accepted only once.
- [ ] A withheld or refused consent is reported as a normal tool result with `isError: true`, never as a JSON-RPC error and never as an invented error code.

## How consent is scoped

- [ ] A grant is recorded against one named tool, never against a server, a category, or a naming pattern.
- [ ] Approving one destructive tool never authorizes a different destructive tool, even on the same server, even moments later.
- [ ] A tool's `readOnlyHint`, `destructiveHint`, and `openWorldHint` inform when to prompt, but they are server-declared and untrusted unless the server itself is trusted. The client's own record of what a human actually approved is what enforces the boundary, not the server's claim about its tools.

## Step-up authorization (a separate, lower gate)

- [ ] Insufficient scope is answered with HTTP `403` and a `WWW-Authenticate` header naming every required scope in one challenge, not one scope per round trip.
- [ ] The client's next request uses the union of its previously held scopes and the challenged scopes, never a replacement of one set with the other.
- [ ] Choosing an initial scope (no prior grant yet) is a different rule: use the `scope` from the first challenge if one was given, otherwise fall back to `scopes_supported` as the minimal starting set.
- [ ] Step-up retries are capped at a small number of attempts; past the cap, treat the operation as a permanent authorization failure instead of looping.

## Least privilege in what a server admits

- [ ] `tools/list` (and similar list results) may vary by the authorization presented on the request, even though it must never vary as a side effect of some other, unrelated request.
- [ ] A list result that differs by caller authorization is cached with `cacheScope: "private"`, never `"public"`.
- [ ] A caller only sees the tools its current scopes actually permit, rather than seeing everything and being rejected only once it tries to call something out of reach.

## Failure patterns to reject in a design review

- A single "connect to this server" prompt that silently covers every tool the server will ever expose.
- A custom error code (for example something in the `-32000` to `-32019` legacy range, or an undefined code in `-32020` to `-32099`) invented to mean "consent required."
- A step-up retry that requests only the newly challenged scope and drops scopes the client already held.
- Scope challenges that trickle out one scope at a time across several round trips instead of naming everything the operation needs at once.
- A `tools/list` result that shows every tool to every caller regardless of granted scope.
- Trusting a tool's own annotations as the enforcement mechanism instead of treating them as a prompting hint.
- An unbounded step-up retry loop with no cap and no path to a permanent failure.

## Exam facts for this domain

- Security and Governance carries the largest single share of the MCPA blueprint.
- The exam is aligned to MCP specification 2026-07-28, a stateless protocol with no `initialize` handshake and no session.
- Two error channels exist for tools: a JSON-RPC error for a malformed request, and a result with `isError: true` for anything the model can read and act on, including a withheld consent.
