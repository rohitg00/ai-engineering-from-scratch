# Stateless Design Checklist

A one-page checklist for the MCPA "MCP Fundamentals" domain, aligned to MCP 2026-07-28.

## The invariant

Every request carries everything a server needs to answer it. A server must not infer capabilities, protocol version, or identity from any earlier request, even one sent over the same connection.

## Why statelessness pays for itself

- Any replica can answer any request: no sticky sessions, no per-instance memory to keep in sync.
- A dropped connection is safe to retry against a different replica, because nothing was stored there.
- Load balancers route on ordinary rules instead of session affinity.

## Connection versus session

| Question | Answer |
|---|---|
| Does an open stdio process or HTTP connection form a session? | No. Clients may interleave unrelated requests on one transport. |
| May tools/list, resources/list, or prompts/list vary per connection? | No. |
| May those same lists vary by the authorization presented on a request? | Yes, that is a per-request input, not connection state. |
| Can a server mutate its tool list as a side effect of an earlier call? | No. Expose the tool unconditionally and gate it with a handle argument instead. |

## Designing a stateful tool with server-minted handles (SEP-2567)

1. Expose a creation tool (for example create_basket) that returns an opaque handle in structuredContent.
2. Accept that handle as an ordinary argument on every tool that operates on the state it names.
3. Authorize the caller against the handle on every call; a handle is a name, not a capability.
4. State the handle's lifetime in the creation tool's description, so the model sees the policy before it creates state.
5. Return a tool execution error (isError: true) that names the handle when it is expired, unknown, or owned by someone else, so the model can recover by creating a new one.

## Checklist before you ship

- [ ] Every request handler reads params._meta for protocolVersion and clientCapabilities; nothing is read from earlier requests on the connection.
- [ ] tools/list, resources/list, and prompts/list return the same result regardless of which connection asked, holding authorization constant.
- [ ] No tool call mutates what a later list call returns; conditional tools are exposed unconditionally and gated by a handle argument.
- [ ] Cross-call state is referenced by an explicit, opaque, server-minted handle passed back as an ordinary argument, never inferred from connection identity.
- [ ] The handle's authorization, opacity, and lifetime policy are documented on the creation tool.
- [ ] Expired, unknown, and foreign-principal handles return isError: true with an explanation, not a JSON-RPC error.
- [ ] The server never uses clientInfo, serverInfo, or any other self-reported field to make an authorization decision.
- [ ] Two connections belonging to the same authenticated principal, such as an orchestrator and one of its subagents, see identical list results and can share a cache.

## What 2026-07-28 removed

- The initialize request and notifications/initialized: there is no opening handshake.
- The Mcp-Session-Id header and protocol-level sessions.
- Capabilities scoped to a connection: capabilities now travel per request in _meta.

## Remember for the exam

- Statelessness is the default behavior of the protocol, not an opt-in mode.
- A handle is a plain string in a tool result and a plain string in a tool argument; the protocol itself defines no handle type or wire format for one.
- Session language in older material describes a removed concept, not current behavior.

Source: certifications/mcpa/research/mcp-2026-07-28-brief.md, section 4.
