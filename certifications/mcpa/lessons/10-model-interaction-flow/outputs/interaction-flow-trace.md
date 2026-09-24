# Model Interaction Flow Trace

A one-page reference for the MCPA "Architecture and Components" domain, aligned to MCP 2026-07-28.
Keep it next to a host implementation while you decide what a tool call should do at each turn.

## The five stages, in order

| Stage | Who acts | What happens | Ever on the wire |
|-------|----------|---------------|-------------------|
| 1. Build context | Host | Cached tools/list entries become the model's view: name, description, inputSchema, annotations | No, this is a host side read of a cached result |
| 2. Select and draft | Model | The model picks a tool and drafts arguments from the running conversation | No, this is a decision inside the host |
| 3. Confirm | Host | A human sees the drafted inputs; a destructive tool needs a yes before anything is sent | No, unless approved |
| 4. Call | Client | An approved decision becomes tools/call, carrying protocol version and capabilities in params._meta | Yes |
| 5. Answer | Host, then model | The result's content feeds back into context; the model answers from what the tool actually said | The result is on the wire, the answer is not |

## What the model sees, before and after

Before a call, the model sees only `name`, `description`, `inputSchema`, and `annotations` when a
server sent them. It does not see server code, credentials, or registry metadata. After a call, the
model sees `content`, `structuredContent` when the tool defines an `outputSchema`, and the `isError`
flag. It never sees a raw transport detail such as an HTTP status code or a header.

## Three ways a tools/call result routes the loop

| Result | resultType | isError | What the loop does next |
|--------|------------|---------|---------------------------|
| Success | complete | false | Feed content (and structuredContent) to the model; answer |
| Tool execution error | complete | true | Feed content to the model; it retries with corrected arguments and a new id, no inputResponses |
| Needs more input | input_required | not present | Host gathers the answer (elicitation/create, sampling/createMessage, or roots/list) and retries with a new id, inputResponses, and requestState echoed exactly |

A JSON-RPC error, such as an unknown tool at `-32602`, is a fourth outcome and is not a `tools/call`
result at all. It carries nothing the model can act on, so a well built loop does not resend the
identical request.

## The confirmation gate

```text
read annotations from the cached tool definition
read_only  = annotations.readOnlyHint     (default false)
destructive = annotations.destructiveHint (default true, meaningful only when not read only)
gate fires when: (not read_only) and destructive
```

A tool shipped with no `annotations` block at all is destructive under these defaults. Show the
drafted inputs to a human before the client sends anything. If denied, the client never constructs
the request, so the denial leaves nothing on the wire, only a note in the host's own state.

## Worked example (from code/main.py)

- `get_forecast({})` returns a tool execution error naming the missing `city`; the retry,
  `get_forecast({"city": "Pune"})`, uses a new id and succeeds.
- `open_ticket({"title": "..."})` returns `input_required` asking a human to confirm priority; the
  retry carries `inputResponses` and the exact `requestState` string the server issued, unread by the
  client, and only then does the ticket exist.
- `close_ticket` ships with no `annotations`, so it is destructive by default. One proposed call is
  approved and reaches the wire; a second is denied and never becomes a request.
- `archive_ticket` does not exist on the server. The call is sent once, comes back `-32602`, and is
  not retried with the same name and arguments.

## Checklist for a host loop

- Build the model context from a cached, deterministically ordered tools/list result; never re-sort
  the array between turns, since most model providers cache the prompt prefix it sits inside.
- Apply the annotation defaults, not just the annotations a server bothered to send, before deciding
  whether a call needs a human's yes.
- Show the drafted inputs, not just the tool name, before a sensitive call is confirmed.
- Treat isError true as a signal to retry with corrections, never as a reason to stop the loop.
- Treat input_required as a different mechanism from isError: it always retries with a new id and an
  exact requestState echo, using inputResponses keyed the way the server named them.
- Treat a JSON-RPC error as a signal to stop retrying that exact request, not as a reason to hide the
  failure from the model entirely.
- Answer from the content a tool actually returned, not from a summary invented independently of it.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5, 7, and 10.
