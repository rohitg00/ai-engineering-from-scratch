# The Model Interaction Flow

> A tool call is not one message on the wire. It is a loop the host runs between a user, a model, and a server, and every turn of that loop decides what the model gets to see next.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 09
**Time:** ~45 minutes

## Learning Objectives

- Trace the full path from a user request through a host built model context, a tool selection, a confirmation gate, a `tools/call`, server execution, and the result returning to the model
- State exactly what the model sees at each turn: tool names, descriptions, and schemas before a call, and content or an `isError` flag after one
- Apply a confirmation gate that shows a tool's drafted inputs to a human before a destructive call ever reaches the wire, using the annotation defaults from the manifest reading lesson
- Explain why deterministic tool ordering protects both a client's own cache and the model provider's prompt cache
- Tell an `input_required` interruption, a tool execution error, and a protocol error apart by how each one changes what the loop does next

## The Problem

The last few lessons covered the documents a server hands a client: a discover result, a tool list, a manifest worth reading with suspicion. None of that explains what actually happens the moment a person types a request. A tool definition sitting in `tools/list` is inert until something turns it into a decision, a wire call, and an answer, and that something is a loop the host runs, not a single request. Skip studying the loop and you can still answer questions about message shapes, but you will miss the ones about behavior: does the client retry a malformed call, does it show a destructive action to a human before sending it, does re-sorting the tool array between turns quietly break a cache the model provider was relying on.

Two different kinds of mistake live in this loop, and the exam probes both. The first is protocol mistakes: sending a raw JSON-RPC error straight back into the model and expecting it to fix itself, or forgetting that a retry after an `input_required` result needs a new id and an exact echo of `requestState`. The second is host design mistakes that never touch the wire at all: skipping the confirmation prompt, hiding a tool's drafted arguments from the user before a sensitive call, or reshuffling the tool list every turn. A client can be perfectly spec conformant on the wire and still get this loop wrong, because half of it is host policy the specification only recommends.

## The Concept

Recall the split from the hosts, clients, and servers lesson: a host runs one client per server and owns the conversation with the model, while the client is only the thin layer that turns a decision into a request. The loop this lesson traces has five stages, and each one hands off to the next.

First, the host builds model context. It already holds a cached `tools/list` result (from the discovery lesson) and turns each entry into exactly what the model gets to see: `name`, `description`, `inputSchema`, and `annotations` when a server bothered to send them. Nothing about how the tool is implemented crosses this boundary. The model never sees server code, credentials, or the manifest's registry metadata, only the same fields a reviewer reads in the manifest lesson.

Second, the model, in this lab a small deterministic function standing in for an LLM, reads the context plus the user's request and drafts a tool name and arguments. Nothing here is a wire message yet. It is a decision inside the host.

Third, before the client sends anything, the host runs a confirmation gate. The specification says a human should be able to deny an invocation and that a client should show tool inputs before calling, and the annotation defaults from the manifest lesson decide when that gate fires: `readOnlyHint` defaults to false and `destructiveHint` defaults to true, so a tool with no `annotations` block at all is destructive by default and needs a yes before it goes anywhere. If the gate denies, the loop ends right there. The client never constructs a `tools/call`, so a denied action leaves no trace on the wire, only a note the host adds to its own state.

Fourth, an approved call becomes an ordinary `tools/call`, carrying `params._meta` with the protocol version and capabilities like every other request in this curriculum. The server can now answer three different ways, and each one routes the loop somewhere else.

```json
{"jsonrpc": "2.0", "id": 5, "result": {"resultType": "input_required", "inputRequests": {"priority": {"method": "elicitation/create", "params": {"mode": "form", "message": "What priority should this ticket have?", "requestedSchema": {"type": "object", "properties": {"priority": {"type": "string"}}, "required": ["priority"]}}}}, "requestState": "eyJ0aXRsZSI6IlZQTiBkcm9wcyJ9"}}
```

A `resultType` of `complete` with `isError` false is the easy path: the model reads `content` and, when the tool defines an `outputSchema`, `structuredContent`, and the host folds that straight into an answer. A `complete` result with `isError` true is a tool execution error, the two error channel split from the integration problem lesson applied inside the loop: the model reads the explanation and can retry with corrected arguments using a fresh id, no `inputResponses` involved, because this is just another ordinary call, not the multi round trip pattern. An `input_required` result is that pattern (brief section 7): the server needs something it does not have, delivered through `elicitation/create`, `sampling/createMessage`, or `roots/list`, and the host must gather the answer and retry the same call with a new JSON-RPC id, `inputResponses` keyed the way the server named them, and `requestState` echoed back exactly, byte for byte. The client never opens that string to read it. Last, a JSON-RPC error such as an unknown tool at `-32602` is a protocol error, and the loop should not retry it identically: nothing about the request changed, so nothing about the result will either.

Fifth, once the host has a `complete` result or has decided a branch is unsupported, it feeds the content back into the model's running context and the model produces an answer that should reference what the tool actually returned, not a guess made independently of it.

One more property spans every turn of this loop: `tools/list` should return the same order every time the underlying set has not changed. That is not cosmetic. The host typically builds the model context array once and reuses it across turns, and most model providers cache the prompt prefix that array sits inside. Reordering the array, even by inserting a newly discovered tool in the middle instead of appending it, invalidates that cache and can cost more tokens than the definitions themselves. Deterministic ordering is what lets a client trust its own cache and what keeps the model provider's cache warm turn after turn.

```figure
mcpa-10-interaction-flow
```

## Interactive Lab

The figure traces one request through all five stages. Follow the top row from a user's ask through the host building context, the model selecting a tool, and the confirmation gate. Two paths leave the gate: an approved call continues right to the server, a denied one drops straight into the dashed box below, held and never sent. Below the server, three outcomes fan out: a complete result flows down to the answer, while a tool execution error and an `input_required` result both loop back up to the model, dashed to mark them as retries rather than forward progress. Notice that the two retry paths look similar in the picture but are not the same mechanism: only one of them carries a new id and an echoed `requestState`.

## Practice Lab

Open `code/main.py` and run it from the lesson directory:

```bash
python3 code/main.py
```

The transcript prints nine request and response pairs. Read the first two `get_forecast` calls: the model drafts an empty argument set, the server answers with `isError: true` naming the missing field, and only then does the model fill in the city it already had in the user's own sentence and call again with a new id. Read the two `open_ticket` calls next: the first one has a valid `title` and still comes back `input_required`, because this server always asks a human to confirm priority rather than letting the model guess it, and the retry carries `inputResponses` plus the exact `requestState` string the server handed back, unread and unmodified. Then look at the confirmation gate section of the output: `close_ticket` ships with no `annotations` block at all, so the host treats it as destructive by the specification's own defaults and shows both proposed calls to a human before sending anything. One ticket is approved and reaches the wire; the other is denied because a low priority ticket needs a second reviewer, and it never becomes a `tools/call` at all. Last, the model tries a tool named `archive_ticket` that this server does not expose, gets back `-32602`, and does not try the identical call again. The final answer line at the bottom quotes real content from the successful calls rather than inventing a summary. Try changing `choose_priority` or `approve_close` and rerun to see a different path through the same loop.

## Shipped Artifact

`outputs/interaction-flow-trace.md` is a one-page trace and decision table: what the model sees before and after a call, the three ways a `tools/call` result routes the loop, and a checklist for building a host loop that shows inputs before calling and never retries a protocol error identically.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that `tools/list` returns tool definitions in the same deterministic order every time, that every request in the session carries the protocol version and capabilities in `_meta`, that a request missing `_meta` is rejected with `-32602`, that a tool with no `annotations` block defaults to destructive and needs confirmation while an explicitly read only or non destructive tool does not, that the confirmation gate keeps a denied `close_ticket` call off the wire while an approved one reaches it, that the `get_forecast` tool execution error is fed back and the corrected call succeeds with a new id, that the `open_ticket` `input_required` result actually interrupts the loop until it is answered, that the retry echoes `requestState` exactly on a new id, that the `archive_ticket` protocol error is never retried identically, and that the final answer quotes real result content. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/10-model-interaction-flow
```

## Capstone Connection

The capstone's end to end exchange is this loop run for real: build context, let the model choose, confirm before anything sensitive goes out, read whichever of the three outcomes comes back, and answer from what the tool actually said. When the capstone asks why a call was never sent, or why a retry used a new id, the answer comes from this lesson, not from the wire rules alone.

## Key Terms

| Term | Meaning |
|------|---------|
| Model context | The name, description, inputSchema, and annotations of each tool, exactly what the model is shown before it can select one |
| Confirmation gate | A host side check, never on the wire, that shows drafted inputs to a human before a sensitive call is sent |
| Tool execution error | A complete result with isError true; the model reads it and can retry with corrected arguments and a new id |
| input_required | An MRTR interruption; the host gathers the missing input and retries with a new id and an echoed requestState |
| Protocol error | A JSON-RPC error such as -32602; the loop should not retry the identical request |
| Deterministic ordering | tools/list returning the same order every call, protecting both client caching and the model provider's prompt cache |
| requestState | An opaque string the client echoes back exactly on an MRTR retry without reading or modifying it |
| Annotation defaults | readOnlyHint false and destructiveHint true when a tool ships no annotations, the rule the confirmation gate applies |

## Further Reading

- [MCP specification 2026-07-28: Tools, Message Flow and User Interaction Model](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP specification 2026-07-28: Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
- [MCP client best practices: interaction with prompt caching](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5, 7, and 10
- `phases/13-tools-and-protocols/02-function-calling-deep-dive`, for the model side of a tool call loop in more depth
