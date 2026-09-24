# JSON-RPC Error Codes for a Tool Invocation

A one-page reference for the five JSON-RPC 2.0 errors a `tools/call` request can return, mapped to the lifecycle checkpoint that raises each one. Pair this with `docs/en.md` for the full walkthrough.

## The five codes

| Code | Name | Checkpoint | Fires when | Safe to retry unchanged? |
|------|------|------------|------------|---------------------------|
| -32700 | Parse error | parsed | The raw payload is not valid JSON; there is no id to key the response to, so `id` is `null` | No, fix the encoding first |
| -32600 | Invalid Request | parsed | The payload is valid JSON but not a well-formed JSON-RPC 2.0 request (missing `jsonrpc`, `method`, or `id`) | No, fix the envelope first |
| -32601 | Method not found | validated | The method is not `tools/call`, or `params.name` names a tool this server never registered | No, the target does not exist |
| -32602 | Invalid params | validated | The tool exists, but the supplied `arguments` fail its declared input schema | No, fix the arguments first |
| -32603 | Internal error | executed | The tool's handler raised while running; the server caught the exception instead of crashing | Sometimes, if the failure looks transient |

## The lifecycle in one line

`received -> parsed -> validated -> executed -> result`, with a JSON-RPC error able to branch off at `parsed`, `validated`, or `executed`, and a `result` reachable only by passing every checkpoint.

## The rule that never bends

Every response, a `result` or an `error`, carries the same `id` the request carried. A parse error is the one exception that proves the rule: since the id could not be read from the broken payload, the response reports `id: null` rather than omitting the field or leaving it to guesswork.

## Reading this table during code review

When reviewing a server's error handling, ask which checkpoint each catch block corresponds to. A catch block around JSON deserialization should only ever produce -32700. A catch block around schema validation should only ever produce -32602. A catch-all around the handler invocation should only ever produce -32603. A handler that returns its own -32601 or -32602 from inside the execution checkpoint is validating too late, after execution has already started.

## Source

MCP specification 2026-07-28; see `certifications/mcpa/research/source-verification-ledger.md` for the exam facts this track cites.
