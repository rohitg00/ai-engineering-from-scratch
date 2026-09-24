# The Tool Invocation Lifecycle

> A tool call is not one event. It is a fixed sequence of checkpoints, and exactly where a call stops tells you which of two error channels applies and what a caller should do next.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 16
**Time:** ~45 minutes

## Learning Objectives

- Walk a tool invocation through every checkpoint: discover, list, select, confirm, call, validate, execute, and result
- Tell which checkpoints exist only inside the host application versus which ones actually put a message on the wire
- Explain why an unknown tool is always a protocol error and why a bad argument is almost always a tool execution error instead
- Apply the retry rule for both an input_required result and a broken stream: a fresh JSON-RPC id every time, never the one that already failed
- Reason about idempotentHint as an untrusted hint, not a guarantee, when deciding whether a blind reissue is safe
- Distinguish a hard timeout that makes the client give up from an input_required result that only pauses the call

## The Problem

Picture an agent asking a server to poll a build, publish a release, or look something up. In the easy story, a tool call is a single event: you send it, you get an answer, done. Real calls do not work that way. Between the moment a model decides to use a tool and the moment the caller has something final to act on, the request passes through several distinct checkpoints, and each one can end the story differently. A caller that treats every failure the same way keeps making the wrong decision: it retries a call that will never succeed no matter how many times it is sent, or it gives up on one that only needed a corrected argument, or worse, it blindly repeats a side-effecting call whose first attempt might already have gone through.

The fix is not cleverness on the caller's part. It is knowing the fixed shape every tool invocation follows, so that "where did this stop" answers "what do I do now." A call that never got past checking whether the tool exists failed for a different reason, and needs a different response, than one that ran the tool's handler and hit a business rule. This is exactly the distinction the exam's Interactions and Execution domain, the largest single domain on the blueprint, tests over and over: protocol error or tool execution error, and at which checkpoint.

## The Concept

A tool invocation in the 2026-07-28 revision moves through eight checkpoints in a fixed order: discover, list, select, confirm, call, validate, execute, and result. Only some of them put a message on the wire. The other half live entirely inside the host application, and a client that only watches JSON-RPC traffic will never see them directly, but they still shape what the model is allowed to do.

**Discover and list** are wire checkpoints, and both are cacheable. A client calling `server/discover` learns the server's supported versions, its capabilities, and optional `instructions`, all carrying `ttlMs` and `cacheScope`. Calling it is optional for a client, though a server must implement it. `tools/list` returns each tool's name, description, `inputSchema`, and annotations, also cacheable, and it must not vary per connection (it may vary by the authorization on the request). A well-built client uses the cached list rather than asking again before every call, which is why "list" and "call" are separate checkpoints rather than one.

**Select and confirm** never touch the wire at all. Select is the model choosing which tool to invoke, based on the descriptions and schemas already in its context. Confirm is the host deciding whether to act on that choice immediately or ask a human first, something the specification frames as a SHOULD, not a protocol message: applications should make clear which tools are exposed, show inputs before calling, and gate sensitive operations behind a confirmation. Annotations such as `destructiveHint` inform that gate, but they are hints, untrusted unless the server itself is trusted, never an enforced guarantee. If the human declines, the lifecycle simply ends here. No `tools/call` is ever sent, so there is nothing for validate or execute to do.

**Call** is the moment a `tools/call` request actually goes out, and like every request in this revision it carries its own metadata rather than relying on a prior handshake:

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "get_build_status",
    "arguments": {"build_id": "bld_7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "progressToken": "pt-9"
    }
  }
}
```

**Validate** is the first checkpoint the server performs once that request arrives, and it asks exactly one question: is this tool one the server actually exposes? Nothing about the arguments matters yet. If the name does not match anything in the server's list, the call ends right here with a protocol error, and it is always `-32602`, never `-32601`, because the JSON-RPC method (`tools/call` itself) was perfectly well known; only the tool name inside it was not:

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "error": {"code": -32602, "message": "Unknown tool: delete_all_builds"}
}
```

A call that fails validate never reaches execute, and it never produces a `result` at all, only an `error`. That is worth sitting with: the full error taxonomy belongs to a later lesson, but the validate-versus-execute split is the one distinction almost every exam question about tool errors is really asking about.

**Execute** only starts once validate has confirmed the tool exists, and it covers everything from there: checking the supplied arguments against the tool's own `inputSchema`, and then actually running the handler. A missing or malformed argument is caught here, not at validate, and it comes back as a normal, complete result with `isError: true`, carrying content the model can read and act on:

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": {
    "resultType": "complete",
    "content": [{"type": "text", "text": "Missing required argument(s): environment."}],
    "isError": true
  }
}
```

That is the rule tested most often: an unknown tool is a protocol error at validate, but a schema violation, an upstream API failure, or a business rule violation are all tool execution errors produced during execute, because the model can self-correct on the second kind and cannot do anything useful with the first. There is one exception worth knowing: if execute hits a genuine, unexpected server fault rather than an input or business problem, that is still reported as a protocol error, `-32603`, precisely because it is not something the caller's next attempt could fix. If the request declared a `progressToken`, execute is also where `notifications/progress` may stream, each one carrying that same token, a strictly increasing `progress` value, and optional `total` and `message` fields, on the response stream for that request and nowhere else.

**Result** is where execute lands: `resultType` is `"complete"` (whether or not `isError` is set) or `"input_required"`, the only two values this lifecycle can return. `input_required` is not an ending. It carries `inputRequests`, `requestState`, or both, and the client answers by retrying the same logical call with a brand new JSON-RPC id, `inputResponses` keyed to match, and `requestState` echoed back exactly as given (the multi round-trip pattern from the previous lessons; protecting that state with something like HMAC is covered in depth in the elicitation lesson, and kept deliberately simple here so the lifecycle stays the focus). That retry runs call, validate, execute, and result all over again, which is why **retry** and **final** close the loop rather than standing apart from it: retry is just call with history, and final is whichever result actually sticks, `complete`, or the point where the caller gives up.

Giving up has its own shape. A server should let every request time out, with a hard maximum that applies even while progress notifications keep arriving, because progress proves work is happening, not that it will finish in time. Cancellation is transport-specific: on Streamable HTTP, closing the request's stream is the cancellation, no message needed; on stdio, the client sends `notifications/cancelled` naming the `requestId` and, optionally, why. Neither timeout nor cancellation ever produces a resultType of its own. There is no `"cancelled"` or `"timed_out"` value; the server simply never gets to send a result the caller still cares about, and a client that already gave up on a request should ignore any response that arrives for it afterward.

A broken stream is a related but separate failure: the request was sent, but the connection died before any response, success or error, ever arrived. Nothing about resumability survives into this revision (no `Last-Event-ID`, no SSE replay), so the caller's only option is to reissue the call with a new id. Whether that is safe to do blindly depends on `idempotentHint`, and because that annotation is only a hint, a careful client treats a non-idempotent tool differently: rather than repeating a side-effecting call on faith, well-designed servers hand back an explicit, opaque handle from the first step (the pattern from the stateless core lesson) so later checkpoints, including a reissue after a broken stream, can act on that handle instead of quietly repeating an action that may have already happened.

```figure
mcpa-17-lifecycle
```

## Interactive Lab

The figure lays the eight checkpoints out as a chain, top to bottom, with the two error branches peeling off exactly where they happen: validate branches to `-32602` (a protocol error, no execute, no result), and execute branches to `isError` (a tool execution error, still a complete result). Result itself branches twice: complete ends the story, and input_required loops back up to call with a new id, the only backward edge in the whole diagram. Notice that select and confirm sit in the chain but never appear on either error branch. They cannot fail with a protocol error or a tool execution error, because they never produce a JSON-RPC message in the first place; a denial at confirm simply ends the story before call.

## Practice Lab

Run the module from the lesson directory:

```bash
python3 code/main.py
```

Each printed line is one scenario's stage trace followed by how it ended. Match every arrow in the output against the figure: `happy_path` runs the full chain once with progress in the middle; `needs_input_then_retry` shows the loop back through call, validate, execute, and result a second time; `confirmation_denied` stops after confirm with no call at all; `unknown_tool` stops after validate; `invalid_arguments` reaches execute and comes back isError; `broken_stream_reissue` calls twice with two different ids for the same build handle; `timeout_then_cancel` gives up after progress that never reaches completion and then ignores a late response; `internal_fault` shows an unexpected server error surfacing at execute as a protocol error rather than isError.

Then open a shell in this directory and step through one scenario by hand:

```python
import sys; sys.path.insert(0, "code")
import main
server, client = main.LifecycleServer(), None
client = main.Client(server)
run = main.run_needs_input_then_retry(server, client)
print(run.stages)
print(run.final)
```

Change `publish_release`'s required arguments in `main.py`, or seed a build with more ticks than `run_timeout_then_cancel`'s polling budget allows, and rerun to see the stage trace change shape.

## Shipped Artifact

`outputs/tool-lifecycle-state-chart.md` is a one-page state chart: every checkpoint, whether it is wire-visible or host-only, which error channel it can end in, and the exact retry rule for each way a call can pause or break. Keep it next to a client or server implementation as a reference for "what should happen here."

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: the happy path's stages occur in the documented order, an input_required result is followed by a retry that completes with a new id, a confirmation denial stops before call, an unknown tool fails at validate with `-32602`, a schema violation lands as isError at execute, a broken stream is reissued with a fresh id against the same handle, a hard timeout cancels the request and a late response afterward is ignored, an unexpected server fault at execute is still a protocol error rather than isError, `tools/list` stays deterministically ordered, and every request and result carries the fields this revision requires. The repository's wire checker validates the lesson's transcript against the same rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/17-tool-invocation-lifecycle
```

## Capstone Connection

The capstone's end-to-end exchange is this lifecycle run for real: a discover and list up front, a call that needs schema-validated arguments, an input_required pause answered with a fresh id, progress and a possible cancellation, and a final result the audit trail can point back to. When the capstone asks you to justify why a design retried, gave up, or reported an error the way it did, the answer is always "which checkpoint was this at," the same question this lesson makes automatic.

## Key Terms

| Term | Meaning |
|------|---------|
| Checkpoint | One of the eight fixed points, discover through result, a tool invocation passes through |
| Validate | The checkpoint that only asks whether the named tool exists; failing it is always a protocol error |
| Execute | The checkpoint that checks arguments and runs the handler; failing it is almost always a tool execution error |
| Protocol error | A JSON-RPC `error`, never actionable content the model can retry against |
| Tool execution error | A complete result with `isError: true`, actionable content the model can read and correct |
| Retry | An MRTR continuation: a new JSON-RPC id, matching `inputResponses`, `requestState` echoed exactly |
| Reissue | Resending a call after a broken stream with a new id, since nothing on this transport is resumable |
| idempotentHint | An untrusted hint about whether repeating a call is safe, not an enforced guarantee |

## Further Reading

- [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), especially Error Handling and Stateful Tools
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation) and [Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5, 7, and 8
- `phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control`, which covers timeouts, cancellation, and flow control in depth
