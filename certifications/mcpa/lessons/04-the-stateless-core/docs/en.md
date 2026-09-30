# The Stateless Core of MCP

> Every request carries everything a server needs to answer it; nothing carries over from the request before it, not even on the same connection.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 03
**Time:** ~45 minutes

## Learning Objectives

- Explain statelessness as a protocol invariant: every request is self-describing, and a server must not infer capabilities, version, or identity from any request that came before it on the same connection
- Explain why statelessness matters operationally: any replica can answer any request, retries are safe to route anywhere, and load balancers need no stickiness
- Distinguish a connection or a stdio process from a session or conversation, and state how list results relate to connection identity versus the authorization presented on a request
- Design cross-request state with an explicit, opaque, server-minted handle that the client passes back as an ordinary tool argument, following the SEP-2567 pattern
- Identify what 2026-07-28 removed to make statelessness the default, and name what replaced each removed piece

## The Problem

Before 2026-07-28, opening a connection to an MCP server meant sending an `initialize` request. That request negotiated a protocol version, exchanged capabilities, and recorded client and server identity, and the result was held as session state for as long as the connection lasted. Every later request on that connection leaned on what the handshake had established. The server never had to repeat "which version are we speaking" or "what can this client do" because it already knew, as long as it remembered.

That memory is the problem. A session tied to one connection is also tied to whichever process happens to be holding that connection open. Put a fleet of servers behind an ordinary load balancer and the second request from a client can land on a different replica than the first one did, a replica that never saw the handshake and has no idea what version or capabilities were agreed. The common fix was sticky routing: pin a client to one specific backend for the life of its session. Sticky routing works until that backend restarts, deploys a new version, or simply gets overloaded while its neighbors sit idle, at which point the client's session state is gone and it has to reconnect and redo the handshake from scratch. Every server author also had to write code to create, track, and eventually garbage collect that per client session state, and every client author had to write matching code to survive a dropped connection. None of this complexity was about the actual work the server did. It was overhead the session created and then made mandatory.

## The Concept

MCP 2026-07-28 is a stateless protocol: all the information needed to process a request is contained in the request itself. A server processes each request independently, and it must not infer capabilities, protocol version, or client identity from any request that arrived earlier, even one sent over the same connection or stream. Lesson 03 already showed the mechanism this depends on: every request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `params._meta`, so nothing about who is asking or what they support has to be remembered between requests.

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "add_item",
    "arguments": {"basket_id": "bsk_3f2a9c11", "sku": "tent"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

A server could answer that request having never seen this client before, on a process that has handled a thousand unrelated requests in between, and the answer would be identical. That is the whole point: the request is a complete, standalone description of what to do.

One consequence follows directly: an open connection is not a conversation. A stdio process or an HTTP connection is a transport, and a transport is not a session boundary. Clients may interleave unrelated requests belonging to different tasks, different users, or different conversations on the same transport, and a server must not treat connection or process identity as a stand in for conversation continuity. A single stdio process could carry a request for one user immediately followed by an unrelated request for a different user, and the server must handle both correctly without assuming they belong together just because they arrived on the same pipe.

The same rule shapes list results. `tools/list`, `resources/list`, and `prompts/list` must not vary depending on which connection asked, and a server must not mutate what those lists return as a side effect of some other request, the way a legacy-era server might have made `query` appear in `tools/list` only after `connect_database` had been called earlier on that connection. Lists are allowed to vary for a real reason: the authorization presented on the request itself. A server that returns fewer tools to a lower privileged token is reading that scope from the current request, which is exactly what statelessness asks for. What it may never do is read that scope from a memory of what an earlier request on the same connection declared.

Statelessness is worth the discipline because of what it buys operationally. Since no request depends on anything held in process memory, any replica behind a load balancer can answer any request, so ordinary round robin routing works and sticky sessions become unnecessary. A request that fails partway through is safe to retry against a different replica, because retrying does not require finding the one process that remembers the earlier state. A crashed or restarted replica loses nothing that mattered to the protocol, because nothing that mattered to the protocol was stored there in the first place.

None of this means a server can never remember anything. A shopping basket, an open browser context, or a long running job all need to survive across more than one tool call, and MCP handles that with explicit, server-minted handles instead of an implicit session. A creation tool mints an opaque identifier and returns it in `structuredContent`; the model carries that identifier forward and passes it back as an ordinary argument on every later call that needs it.

```json
// tools/call: create_basket
{"name": "create_basket", "arguments": {}}

// result
{
  "content": [{"type": "text", "text": "Created basket bsk_3f2a9c11"}],
  "structuredContent": {"basket_id": "bsk_3f2a9c11"},
  "resultType": "complete"
}
```

Nothing about `basket_id` is a protocol feature. It is an ordinary string in a tool result and an ordinary string in a tool argument, indistinguishable to the wire from any other piece of data a tool returns. The design guidance that makes handles work well is not enforced by the protocol, so it falls on the server author: keep the handle opaque rather than encoding structure a client could parse or guess, authorize the caller against the handle on every call since possession of a name is not the same as being allowed to use it, and state the handle's lifetime in the creation tool's description so the model can see the policy before it decides to create state. When a call arrives for a handle that has expired, never existed, or belongs to a different caller, the correct response is a tool execution error, a normal result with `isError: true` that names the problem, not a JSON-RPC protocol error. An expired or foreign handle is a business outcome the model can recover from by creating a new basket, not a malformed request.

This also answers a question that matters for orchestrators running several subagents: since list results cannot depend on which connection asked, a second connection belonging to the same authenticated principal, such as a subagent spun up by an orchestrator, sees exactly the same `tools/list` result the orchestrator saw and can safely reuse a cached copy instead of asking again. A session-scoped list result could never offer that guarantee, because the whole point of a session was that it was tied to one particular connection.

Making statelessness the default meant removing the machinery that statefulness depended on. There is no opening handshake: the `initialize` request and `notifications/initialized` are both gone, replaced by per-request `_meta` and the optional `server/discover` call from lesson 03. There is no `Mcp-Session-Id` header, because there is no session for a header to name. Capabilities are no longer scoped to a connection; they are declared fresh on every request, so a server never has to wonder whether a capability it remembers from three requests ago is still current.

```figure
mcpa-04-stateless-requests
```

## Interactive Lab

The figure shows two clients, alice and bob, sending requests through a round robin router to two replicas, A and B. Neither replica keeps basket state in memory. Both read and write the same shared store, keyed by the opaque handle a creation tool returned, so whichever replica the router happens to pick next answers correctly regardless of which replica handled the call before it. Follow one basket from creation through a call that lands on the other replica: the answer does not change, and nothing about the exchange reveals that two different processes were involved.

## Practice Lab

Open `code/main.py`. It builds two replicas that share one `SharedStore` and a `Router` that dispatches to them round robin, then runs three callers against that deployment: alice, a second connection for alice with the same principal, and bob, a different principal entirely.

```bash
python3 code/main.py
```

Read the printed exchanges against the concept section. Alice's first connection and her second connection call `tools/list` and get back an identical tool list, even though the round robin router answered them from two different replicas: read each result's `_meta` to see the `serverInfo.name` change between `basket-replica-A` and `basket-replica-B` while the `tools` array itself stays byte for byte the same. Watch alice create a basket on one replica and add an item to it through a call the router happens to route to the other replica; the item is added correctly because the basket lives in the shared store, not in either replica's memory. Then find the two deliberate failures. Bob tries to add an item to alice's basket and gets back a normal result with `isError: true` explaining that the basket belongs to a different principal. Later, after the clock in the scenario advances past the basket's lifetime, alice's second connection tries to check that same basket out and gets `isError: true` again, this time explaining that the basket expired. Neither failure is a JSON-RPC error, because both are outcomes the model can act on: create a new basket and continue.

## Shipped Artifact

`outputs/stateless-design-checklist.md` is a one-page checklist you can run a server design against before shipping it: the invariant itself, the difference between what may vary by connection and what may vary by authorization, five steps for designing a handle-based stateful tool, a pre-ship checklist, and the three pieces 2026-07-28 removed to make statelessness the default.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that two replicas sharing one store answer an identical `tools/list`, that a handle minted on one replica works when it is used against the other, that a handle used by a different principal comes back as a tool execution error, that a handle used after it expires comes back as a tool execution error, that two connections belonging to the same principal see an identical cacheable list result, that a request missing its `_meta` protocol fields is rejected with `-32602`, that interleaved requests from two principals never leak one principal's items into the other's basket, and that every request in the scenario's transcript carries its protocol version and capabilities. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/04-the-stateless-core
```

## Capstone Connection

The capstone's end to end exchange has to work no matter which replica answers which request, and its long running task and its consent flow both need to survive across more than one round trip. Both rest on this lesson: state that a server owns has to be either absent from the protocol layer entirely or referenced by an explicit handle the client threads through its own requests. When the capstone asks you to justify why a design is safe to scale horizontally, you will point back to the stateless core and to the handle pattern that lets state exist without a session to hold it.

## Key Terms

| Term | Meaning |
|------|---------|
| Statelessness | The protocol invariant that every request is self-describing and independent of earlier requests |
| Connection | A transport-level channel (a stdio process or an HTTP connection) that is not a session or conversation |
| Replica | One of several interchangeable server processes that can answer any request because none holds private state |
| Server-minted handle | An opaque identifier a creation tool returns, passed back as an ordinary argument to reference state across calls |
| Shared store | Durable storage every replica reads and writes, so state does not live inside any one process |
| Tool execution error | A normal result with `isError: true`, the correct channel for an expired, unknown, or foreign handle |
| `Mcp-Session-Id` | The legacy header that named a protocol-level session; removed in 2026-07-28 |

## Further Reading

- [Statelessness, MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic#statelessness)
- [Stateful Tools, MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#stateful-tools)
- [SEP-2575: Make MCP Stateless](https://modelcontextprotocol.io/seps/2575-stateless-mcp)
- [SEP-2567: Sessionless MCP via Explicit State Handles](https://modelcontextprotocol.io/seps/2567-sessionless-mcp)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 4
- `phases/13-tools-and-protocols/06-mcp-fundamentals`, which builds the per-request JSON-RPC model this lesson assumes
