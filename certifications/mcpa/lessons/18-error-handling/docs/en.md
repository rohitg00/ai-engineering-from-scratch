# Two Ways for a Request to Fail

> A failed request does not get to invent its own vocabulary. MCP 2026-07-28 fixes a small set of numbers, splits every failure into one of two channels, and puts a firm list of numbers permanently out of reach.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 17
**Time:** ~45 minutes

## Learning Objectives

- Tell a protocol error from a tool execution error and know which channel a server must use for a given failure
- Name the three MCP-reserved error codes, -32020, -32021, and -32022, and the data each one carries
- Apply the 2026-07-28 error code allocation policy: the legacy sub-range, the reserved sub-range, and where an application-defined code belongs
- Map a JSON-RPC error code to the HTTP status a Streamable HTTP server must return alongside it
- Explain why -32002 and -32042 must never be emitted by a 2026-07-28 implementation, and what replaced each one

## The Problem

A server that has never thought hard about failure tends to invent its own error vocabulary as it goes. A missing argument gets one ad hoc code, a downstream timeout gets another, a permission problem becomes a made up string buried in a message field. None of that travels. A client built by a different team has no way to know what a number some other server picked on a Tuesday actually means, and two servers that both reach for the same convenient number, say -32001, can mean two unrelated things by it. This is not hypothetical: before the 2026-07-28 allocation policy existed, official MCP SDKs disagreed on the code for a missing resource alone. Four used -32002, one used -32602, one used -32603, and one used a generic zero. A client that wanted to reliably detect "resource not found" across servers had to special-case every SDK.

The cost lands hardest on the participant with the least room to guess: the model deciding what to do next. A tool call that fails and returns as an opaque JSON-RPC error the client swallows before it reaches the model's context gives the model nothing to learn from. It repeats the same broken call, or it gives up on a task that a single corrected argument would have finished. The lifecycle checkpoints from lesson 17 already drew the outline: validation, capability checks, and execution can each fail, and treating every failure the same way throws away information a caller could have used to recover. This lesson fills in the exact numbers, the exact channel each one travels on, and the numbers that are permanently off the table.

## The Concept

Every MCP failure travels back on exactly one of two channels, and picking the right one is, per the specification's own framing, the most tested distinction in the whole error model.

A **protocol error** means the request itself was wrong: the method does not exist, the named tool is not one this server exposes, a required field is missing, or the server hit an internal fault. It is a standard JSON-RPC error object, and a client typically handles it itself rather than showing it to the model:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "error": {
    "code": -32602,
    "message": "Unknown tool: delete_everything"
  }
}
```

A **tool execution error** means the request was fine, the server ran the tool, and the tool hit a problem the caller can fix: a missing or badly shaped argument, a downstream API failure, a business rule the input violated, an expired handle. It is a normal `complete` result with `isError: true`, and it is exactly the content a model can read and correct itself on:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "complete",
    "content": [{"type": "text", "text": "resolution is required for close_ticket"}],
    "isError": true
  }
}
```

Before 2026-07-28, the specification's own guidance on this split was ambiguous: an early revision described "invalid arguments" as a protocol error and "invalid input data" as a tool execution error, without drawing a clean line between them. SEP-1303 closed the gap by merging both under tool execution errors. A missing required field, a wrong type, an out-of-range value: all of it is `isError: true`, never `-32602`. An unknown tool is the one case that stays a protocol error, because there is nothing about the arguments to correct; the tool itself does not exist.

The standard JSON-RPC 2.0 codes carry the base protocol failures: `-32700` parse error (the body was not valid JSON, so `id` is reported as `null` because none could be read), `-32600` invalid request (valid JSON, but not a well-formed JSON-RPC object), `-32601` method not found (the method itself is not one this server implements), `-32602` invalid params (an unknown tool, a request missing required `_meta`, a resource that does not exist, an invalid prompt argument, an invalid pagination cursor), and `-32603` internal error (the server itself failed). The gap between `-32601` and `-32602` is worth memorizing on its own: `-32601` is about the *method*, `-32602` is about *everything else wrong with the request*, including a tool name the server has never heard of.

JSON-RPC reserves `-32000` to `-32099` for implementation-defined server errors, and the 2026-07-28 allocation policy partitions that space cleanly. `-32000` to `-32019` is legacy: codes implementations picked before this policy existed. New implementations must not allocate anything there, and should avoid the whole sub-range. `-32020` to `-32099` is reserved for the specification itself, and only three codes in it are defined:

```json
{"code": -32020, "message": "Header mismatch: Mcp-Name header value 'foo' does not match body value 'bar'"}
```

`-32020` is `HeaderMismatch`: an HTTP header disagrees with the request body, or a required header is missing. `-32021` is `MissingRequiredClientCapability`: the server needed a capability this specific request's `clientCapabilities` did not declare, and the error carries `data.requiredCapabilities` naming what was missing, echoing the per-request negotiation from lesson 07. `-32022` is `UnsupportedProtocolVersion`: the requested protocol version is not one the server supports, carrying `data.supported` (a list) and `data.requested`, the version-negotiation shape lesson 05 introduced. Emitting any other code in `-32020` to `-32099` that is not one of these three is forbidden outright.

Two codes are explicitly retired and must never appear in a 2026-07-28 response. `-32002` was the resource-not-found code through 2025-11-25; SEP-2164 replaced it with `-32602` once the inconsistency across SDKs made the old recommendation unworkable. `-32042` was a narrower code for URL-mode elicitation being required, and it existed only in the 2025-11-25 revision; it has no direct replacement because URL-mode elicitation is now negotiated through the ordinary MRTR flow instead of a dedicated error. A client built to be permissive can still accept `-32002` from an older server for backward compatibility, but a 2026-07-28 server must not produce it.

Application-defined codes that fit neither a defined MCP code nor `isError` should sit entirely outside `-32768` to `-32000`, the whole JSON-RPC reserved range. In practice this case should be rare: SEP-1303 exists precisely so an implementation reaches for `isError` before it reaches for a new number.

On Streamable HTTP, several of these codes come with a documented HTTP status. A header mismatch, a missing capability, an unsupported version, and a malformed request missing `_meta` all pair with `400 Bad Request`:

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/list

```

If the header on that request had disagreed with the body, or if `_meta` had been missing from the body entirely, the response is `400` with the matching JSON-RPC error inside it. An unknown method gets `404 Not Found` instead, since that failure is about the endpoint's own routing, not the message shape. Beyond the JSON-RPC layer entirely, a few transport and authorization events carry HTTP statuses with no JSON-RPC error at all: a notification the server accepts returns `202 Accepted` with no body, a `GET` or `DELETE` sent to the modern MCP endpoint returns `405 Method Not Allowed`, a missing or invalid bearer token returns `401 Unauthorized`, and insufficient OAuth scope returns `403 Forbidden`.

Finally, one narrow exception to a rule you can otherwise treat as absolute: an error response always echoes the request's `id`, except when the id could not be read at all, such as a body that failed to parse as JSON in the first place. That response reports `id: null`, because there was never an id to echo.

```figure
mcpa-18-error-taxonomy
```

## Interactive Lab

The figure lays the two channels side by side. The left column lists the five codes a protocol error can carry in this lesson's scenarios, each one a small box a client reads and handles on its own. The right column is a single card: every tool-level problem, regardless of what caused it, becomes the same `isError: true` shape, which is the one channel that reaches the model as ordinary content. The dashed band at the bottom is the forbidden zone: the legacy sub-range and the two explicitly retired codes, a boundary a conformant implementation never crosses in either direction.

## Practice Lab

`code/main.py` builds a small helpdesk server with two tools and a client that drives it through every scenario this lesson describes: a clean discovery and tool call, a missing argument, an invalid enum value, a call to a tool that does not exist, a call that needs a capability the request never declared, an unsupported protocol version, and a request missing `_meta` entirely. Run it from the repository root:

```bash
python3 certifications/mcpa/lessons/18-error-handling/code/main.py
```

Read the guard first: `is_forbidden_error_code` implements the allocation policy as a pure function, and `safe_error` calls it before constructing any error response at all. Every error this server ever returns goes through `safe_error`, so a forbidden code cannot reach a socket by accident. Near the end of the transcript are two entries marked `violation`: they show what a non-conformant server would have wrongly returned for a legacy "tool call failed" code and for the retired resource-not-found code, each one wrapped so it is unmistakably a counter-example, never live protocol behavior. Try calling `main.safe_error(1, -32050, "made up")` yourself in a shell; watch it raise `ForbiddenErrorCode` before anything resembling a response even gets built. Then try `main.safe_error(1, -32021, "fine")`, one of the three defined reserved codes, and watch it succeed.

## Shipped Artifact

`outputs/error-code-decision-table.md` is a four-step decision table: pick the channel, pick the code, confirm it is not on the forbidden list, then place an application-defined code correctly if nothing else fits. It also carries the HTTP status mapping and the transport events that never carry a JSON-RPC error at all. Keep it open while reviewing a server's error handling.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: an unknown tool is `-32602`, an unknown method is `-32601` mapped to HTTP 404, a missing or invalid argument is `isError: true` rather than a protocol error, a request missing `_meta` is `-32602` mapped to HTTP 400, an unsupported version carries `data.supported` and `data.requested`, a missing capability carries `data.requiredCapabilities`, a declared capability lets the call through, the guard refuses `-32001`, `-32002`, `-32042`, and an arbitrary undefined reserved code while allowing the three defined ones and codes outside the reserved range entirely, a parse failure reports a null id, and the full transcript never carries a forbidden code outside a `violation` wrapper. The repository's wire checker validates the same transcript against the 2026-07-28 rules directly:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/18-error-handling
```

## Capstone Connection

The capstone's end-to-end exchange leans on this lesson every time something goes wrong inside it: a schema-invalid tool call must come back as `isError` so the model can correct itself before the run continues, a tampered MRTR `requestState` must be refused without inventing a new code for the occasion, and a token issued for the wrong audience must be rejected the way lesson 23 describes, not folded into some ad hoc protocol error. When the capstone asks you to justify a failure response, the answer is always one of two channels and a code from this lesson's table, never a number you made up for the occasion.

## Key Terms

| Term | Meaning |
|------|---------|
| Protocol error | A JSON-RPC error object for a request that was itself wrong: unknown method, unknown tool, malformed envelope, server fault |
| Tool execution error | A normal `complete` result with `isError: true`, content the model can read and correct itself on |
| Allocation policy | The 2026-07-28 rule that splits `-32000` to `-32099` into a legacy sub-range and a sub-range reserved for the specification |
| `HeaderMismatch` | `-32020`, returned when an HTTP header disagrees with the request body or a required header is missing |
| `MissingRequiredClientCapabilityError` | `-32021`, returned with `data.requiredCapabilities` when a request needs a capability its own `clientCapabilities` did not declare |
| `UnsupportedProtocolVersionError` | `-32022`, returned with `data.supported` and `data.requested` when a request names a version the server does not implement |
| Retired code | A code a past revision defined that 2026-07-28 forbids emitting, such as `-32002` or `-32042` |
| `safe_error` | This lesson's guard: refuses to construct a forbidden code before any response is built |

## Further Reading

- [Base protocol: Error Codes](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#error-codes)
- [Tools: Error Handling](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling)
- [Streamable HTTP: Server Validation and header requirements](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#server-validation)
- [SEP-1303: Input Validation Errors as Tool Execution Errors](https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors)
- [SEP-2164: Standardize Resource Not Found Error Code](https://modelcontextprotocol.io/seps/2164-resource-not-found-error)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 5
