# Building an MCP Server: Stateless Python and TypeScript

> A modern MCP server does not remember a handshake. It validates the metadata on every request, runs one handler, and returns one typed result.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 06
**Time:** ~85 minutes

## Learning Objectives

- Implement mandatory `server/discover` for MCP `2026-07-28`.
- Validate protocol version and client capabilities on every request.
- Expose tools, resources, and prompts with deterministic list ordering.
- Return `resultType`, server identity, and cache hints on the correct results.
- Serve the same stateless contract over newline-delimited stdio in Python and TypeScript.

## The Problem

A server that stores client capabilities after the first message is easy to build and hard to operate. The same process may serve sequential clients. A remote request may land on a different worker. A stale capability declaration can leak behavior across authorization boundaries.

MCP `2026-07-28` solves the protocol part of that problem by making every request self-describing. Your application can still keep durable notes, jobs, or explicit state handles. What it cannot keep is hidden protocol state that changes how a later request is decoded.

This lesson builds a notes server twice. The Python and TypeScript versions use only their standard libraries for the protocol core. Both expose the same methods and enforce the same wire contract.

## The Concept

### The modern dispatch loop

```text
read one JSON-RPC line
parse the envelope
if it is a notification, do not respond
validate params._meta for this request
route by method
wrap success with resultType and serverInfo
write one JSON-RPC response line
forget request-scoped metadata
```

Three stdio rules still matter:

- Write only JSON-RPC messages to stdout. Send diagnostics to stderr.
- Delimit messages with a newline and flush each response.
- Exit promptly when stdin reaches EOF.

The process lifetime is a transport lifetime. It is not a modern MCP session.

### Request validation

Every request must have:

```json
{
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "notes-client",
        "version": "1.0.0"
      }
    }
  }
}
```

The first two fields are required. `clientInfo` is recommended. Validate a present identity shape, but do not treat it as authentication.

If the version is unsupported, return code `-32022` with `requested` and `supported`. Missing request metadata is invalid params, code `-32602`. Never fill missing fields from a previous call.

### Mandatory discovery

Modern servers must implement `server/discover`. A complete discovery result includes supported modern versions, capabilities, optional instructions, cache hints, and server identity in result `_meta`:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": false},
    "resources": {"listChanged": false, "subscribe": false},
    "prompts": {"listChanged": false}
  },
  "ttlMs": 3600000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

Discovery does not unlock the server. A client may call `tools/list` without calling discovery because `tools/list` already carries the same request metadata.

### Tools

`tools/list` returns a deterministic list of tool descriptors. Stable ordering improves response caching and keeps model context stable. The result also requires `ttlMs` and `cacheScope`.

`tools/call` returns content blocks and `isError`. Use a JSON-RPC error when the protocol envelope or method parameters are invalid. Use `isError: true` when a valid tool invocation runs but the tool itself fails.

Tool annotations remain hints, not enforcement:

- `readOnlyHint`
- `destructiveHint`
- `idempotentHint`
- `openWorldHint`

The host should use them for confirmation and presentation. The server must still enforce real authorization.

### Resources

`resources/list` returns stable URI descriptors. `resources/read` returns typed contents. Both are cacheable in `2026-07-28`, so both include `ttlMs` and `cacheScope`.

Use `cacheScope: "private"` for user-specific note data. A shared cache must not reuse a private response across authorization contexts.

Modern change delivery does not use `resources/subscribe`. A client opens `subscriptions/listen` and requests `resourceSubscriptions` or list-change categories. Lesson 10 builds that flow.

### Prompts

`prompts/list` is cacheable and deterministic. `prompts/get` renders a named prompt with arguments. The rendered prompt result is complete, but it is not one of the cacheable list or read results that requires cache hints.

### Every successful result is typed

The examples use one wrapper for every success:

```python
def complete(payload):
    return {
        "resultType": "complete",
        **payload,
        "_meta": {SERVER_INFO_KEY: SERVER_INFO},
    }
```

List, read, and discovery handlers add `ttlMs` plus `cacheScope`. Centralizing this wrapper prevents one handler from silently omitting modern result fields.

### No server-initiated requests

A modern server may send notifications related to a client request, or notifications on a client-opened `subscriptions/listen` stream. It must not send its own JSON-RPC request.

When a handler needs sampling, elicitation, or roots input, it returns an `input_required` result. The client fulfills the embedded input requests and retries the original method with a new request id. Lesson 11 covers that Multi Round-Trip Request pattern.

### Explicit legacy compatibility

A dual-era server may also implement the `2025-11-25` handshake on a clearly separate legacy branch. It chooses modern behavior when required modern `_meta` fields are present and legacy behavior when it receives `initialize`.

Do not put a `2026-07-28` request through the legacy handshake path. Do not stamp modern `resultType` fields onto legacy initialization results. The code in this lesson is deliberately modern-only so its invariants stay visible.

```figure
t3-dispatch-loop
```

## Use It

Run the Python server's finite demo and tests:

```bash
cd code
python3 main.py --demo
python3 -m unittest discover tests -v
```

Run the TypeScript port with a TypeScript runner:

```bash
npx tsx main.ts --demo
```

The demo sends `server/discover`, lists each primitive, invokes tools, and shows an unsupported-version error. Every modern request repeats metadata. Every success includes server identity.

## Ship It

This lesson ships `outputs/skill-mcp-server-scaffolder.md`. It produces a modern server plan with a discovery contract, per-request validation, deterministic cacheable lists, and an optional isolated legacy adapter.

## Exercises

1. Remove capabilities from one request and prove the server does not reuse the previous request's declaration.
2. Reverse the `TOOLS`, `PROMPTS`, and note insertion order. Confirm all list results remain stable.
3. Add a destructive `notes_delete` tool and require an authorization check inside the executor. Keep `destructiveHint` as a UX hint only.
4. Add `resources/templates/list` with `ttlMs`, `cacheScope`, and deterministic ordering.
5. Build a separate legacy adapter for `2025-11-25`. Add tests proving a modern request never enters it.

## Key Terms

| Term | Meaning |
|------|---------|
| Stateless server | Handles each request from its own metadata without protocol-session memory |
| `server/discover` | Mandatory modern method that advertises versions and capabilities |
| Complete result | Successful modern result with `resultType: "complete"` |
| Cacheable result | Discovery, list, or resource-read result with `ttlMs` and `cacheScope` |
| Deterministic list | Same logical registry produces the same item order |
| Server identity | Recommended `io.modelcontextprotocol/serverInfo` in result `_meta` |
| Tool error | Valid tool call that returns content with `isError: true` |
| Protocol error | Invalid JSON-RPC or MCP request returned through `error` |

## Further Reading

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
