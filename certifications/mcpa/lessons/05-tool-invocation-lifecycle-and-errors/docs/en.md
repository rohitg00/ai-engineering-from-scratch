# The Tool Call That Cannot Fail Silently

> A `tools/call` request does not just succeed or crash. It moves through four checkpoints, and at each one a specific, structured JSON-RPC error is ready to travel back, keyed to the exact request that failed.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 04
**Time:** ~45 minutes

## Learning Objectives

- Walk the tool invocation lifecycle from discovery through call to result, stage by stage
- Name the five JSON-RPC 2.0 error codes an MCP server can return and the lifecycle checkpoint each one maps to
- Distinguish a parse error and an invalid request from an unknown method and invalid params
- Explain why every response, a result or an error, is keyed to the request id and never dropped
- Apply the request-response interaction pattern to reason about a tool call that fails partway through

## The Problem

Say an agent calls a tool and gets nothing useful back: a closed connection, an empty object, or a message that just says "error." The agent cannot act on that. Should it retry with the same arguments? Pick a different tool? Ask the user to fix something? Give up and report failure upward? Each of those responses is correct for a different kind of failure, and an undifferentiated error hides which one applies.

A `tools/call` can fail for reasons that have nothing to do with each other. The payload itself might not be valid JSON, which is a transport problem the caller's serializer introduced. The request might be valid JSON but missing a field JSON-RPC requires, which is a protocol problem. The tool named in the call might not exist on this server, which is a discovery problem the caller should have caught earlier. The arguments might be missing a field the tool's schema marks required, which is a data problem the caller can fix immediately. Or the tool might exist, accept the arguments, and still fail while running, which is a runtime problem no amount of upfront checking would have caught. Collapsing all five of those into one generic failure forces the caller to guess, and a caller that guesses wrong either retries a request that will never succeed or gives up on one that would have worked with a single field corrected.

MCP does not leave this to guesswork. A conformant server places every `tools/call` on a fixed lifecycle, and every way that lifecycle can end is a named, numbered JSON-RPC 2.0 error, keyed to the id of the request that failed. "Error Handling" and "Tool Invocation Lifecycle" are two of the four published sub-competencies under Interactions and Execution, the largest single domain on the exam, so the distinctions in this lesson carry real weight on test day.

## The Concept

A `tools/call` message is an ordinary JSON-RPC 2.0 request: it carries `"jsonrpc": "2.0"`, a `method`, a `params` object, and an `id`. Because it carries an id, it is a request rather than a notification, and JSON-RPC's rule for a request is absolute: the server must send back exactly one response with that same id, either a `result` or an `error`. There is no third option where the server just stays quiet. Silence is not a valid outcome for a request that carried an id.

Between the moment a server receives that request and the moment it answers, the call passes through four checkpoints, and each one can fail in its own way.

The first checkpoint is parsing. Before the server can reason about methods or tools, it has to turn the raw bytes or text it received into a JSON-RPC envelope. If the payload is not even syntactically valid JSON, the server cannot read a method or an id out of it at all, so it returns Parse error, code `-32700`, with the id set to null, because there is no id to read yet. If the payload does parse as JSON but is not a well-formed JSON-RPC 2.0 request, missing `"jsonrpc": "2.0"`, missing `method`, or missing `id`, the server returns Invalid Request, code `-32600`.

The second checkpoint is validation. Once the envelope is sound, the server checks whether it recognizes what is being asked. If the method is not `tools/call`, or if `params.name` names a tool this server never registered, there is nothing to run, and the server returns Method not found, code `-32601`. If the tool does exist, the server checks the supplied `arguments` against that tool's declared input schema. A missing required field, or an argument of the wrong shape, returns Invalid params, code `-32602`, before the handler is ever invoked.

The third checkpoint is execution. Only a request that has passed both earlier checks reaches the tool's actual handler. This is where upfront validation runs out of reach: a handler can divide by zero, call a downstream service that times out, or hit a bug no schema could have caught. A well-built server wraps that call so an exception inside the handler cannot crash the process or leak a raw stack trace to the caller. It catches the exception and returns Internal error, code `-32603`, with a message that says something failed without exposing implementation detail the caller has no use for.

The fourth checkpoint is the result. A handler that runs to completion without raising hands its return value back to the server, which wraps it in a `result` object and sends it with the original id. This is the only path that produces a `result` instead of an `error`, and reaching it means every earlier checkpoint passed.

Five codes, four checkpoints, one rule that does not bend: whatever the outcome, the response carries the same id the request carried, so a caller juggling several calls at once always knows exactly which one just came back.

```figure
mcpa-05-lifecycle
```

## Interactive Lab

The figure traces the path above: a request enters at received, and at parsed, validated, or executed, a dashed branch can peel it off toward one of the five error codes instead of letting it continue to result. `code/main.py` builds a small server with two tools, one that converts a temperature and one that divides two numbers, and drives one request down each of those branches in turn. Run it and match each printed line to a checkpoint in the figure.

```bash
python3 code/main.py
```

Watch the divide tool closely. Its handler is ordinary Python; nothing in it knows about JSON-RPC. The error code `-32603` is not something the handler produces, it is something the server produces on the handler's behalf, by catching the exception the handler raised and translating it into the protocol's vocabulary for "something broke that we did not expect."

## Practice Lab

Start a Python shell in this lesson's directory and import the server:

```python
import sys; sys.path.insert(0, "code")
import main
server = main.build_lifecycle_server()
```

Before you run each line below, write down which of the five error codes you expect, then check yourself:

```python
server.handle_raw("{not valid json")
server.handle({"method": "tools/call", "params": {"name": "convert_temperature", "arguments": {"celsius": 0}}})
server.handle({"jsonrpc": "2.0", "id": "a1", "method": "tools/call", "params": {"name": "reticulate_splines", "arguments": {}}})
server.handle({"jsonrpc": "2.0", "id": "a2", "method": "tools/call", "params": {"name": "convert_temperature", "arguments": {}}})
server.handle({"jsonrpc": "2.0", "id": "a3", "method": "tools/call", "params": {"name": "divide", "arguments": {"a": 4, "b": 0}}})
```

Then send the same request twice with `id` set to the same value both times, and confirm both responses come back keyed to that value. That is the property the whole lesson rests on: the id is not decoration, it is how a caller with several calls in flight tells the answers apart.

## Shipped Artifact

`outputs/jsonrpc-error-codes.md` lists all five codes in one table: when each one fires, the checkpoint it belongs to, and whether a caller should ever retry after seeing it. Keep it next to a server implementation as a quick lookup while writing error handling.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They cover a parse failure, an invalid envelope, an unknown tool, a missing required argument, a non-object arguments value, a handler that raises, a successful call, and id preservation across every failing stage. If any of them fail, the lifecycle handler and this lesson have drifted apart, and the code is the source of truth for the message shapes.

## Capstone Connection

The MCPA capstone asks you to reason about a server design end to end, and a design that cannot explain its own failures does not pass that review. When you assemble the capstone readiness review, a claim like "the server handles errors" is not enough on its own; you will need to name the checkpoint a given failure occurs at and the exact code it returns, and point back to this lesson's lifecycle to justify it.

## Key Terms

| Term | Meaning |
|------|---------|
| Parse error (-32700) | The raw payload was not valid JSON; the id is null because none could be read |
| Invalid Request (-32600) | The payload was valid JSON but not a well-formed JSON-RPC 2.0 request |
| Method not found (-32601) | The method, or the tool named in params, is not one this server exposes |
| Invalid params (-32602) | The tool exists, but the supplied arguments fail its declared input schema |
| Internal error (-32603) | The tool's handler raised while executing; the server caught it rather than crashing |
| Lifecycle checkpoint | One of the four points, parsed, validated, executed, result, where a call can succeed or fail |
| Notification | A JSON-RPC message with no id, which by definition never receives a response |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at modelcontextprotocol.io/specification/2026-07-28, for the normative error and lifecycle behavior.
- `phases/13-tools-and-protocols/07-building-an-mcp-server`, for the server implementation this lifecycle runs inside.
- The MCPA certification page, training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/, for how this domain is weighted on the exam.
