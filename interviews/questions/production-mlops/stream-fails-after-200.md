---
id: stream-fails-after-200
title: Half an answer and then silence
card: production-mlops
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, inference-engineer]
rounds: [debugging, coding]
tags: [sse, streaming, error-handling, demo]
minutes: 8
lessons: [phases/17-infrastructure-and-production/29-model-demo-interfaces]
manuals: []
practice: []
cheatsheet: [production-llm-app]
related: [production-mlops/checks-in-order-of-cost]
updated: 2026-11-03
---

Your demo streams tokens to the page over server-sent events. Users report that the page sometimes shows half an answer and then stops, with no message. The server log shows a model exception on exactly those requests. Why does the user see nothing, and how do you fix the protocol?

## Short answer

The server sends the status line with status 200 before the first token. When the model fails after that, the status cannot change, so the client sees a stream that ends early and nothing else. Send an `error` event inside the stream, and make the page show that event as an error. Also stop the generator when the client disconnects, so that a closed tab stops the model.

## Full answer

### The protocol problem

A streamed response has one status line, and it goes out first. Every token after it is a body chunk. An exception in the generator after the first token cannot turn a 200 into a 500. The connection closes, and the page has no way to tell a short answer from a failure.

### The fix in the lesson

The stream generator catches the exception and yields one more event:

```text
event: error
data: {"code":"model_error","message":"...","hint":"...","request_id":"..."}
```

Then it returns. The page reads each frame and handles three event names: `token` appends text, `done` ends the request and shows the totals, and `error` shows the message and the hint. The error carries a request id, so a user report maps to one log record without storing any input.

### Two details that make it hold

- The page buffers the incoming bytes and cuts frames at the blank line, because a network chunk can end in the middle of an event. A parser that treats each chunk as one event breaks on long answers.
- `json.dumps` escapes a newline inside a string, so each event has one data line. A raw newline inside the data would end the event early.

### Stop the model when the user leaves

When the user closes the tab, the next write fails with a broken pipe. The handler catches it and closes the generator, so the model stops and the request costs nothing more. The lesson also sets a socket timeout on the handler class, so a client that stops sending does not hold a server thread.

### Log the failure

The request handler records one log line for every request in its `finally` block, with the route, the status, the error code, the latency and the input length. A stream that failed with an error event appears there with its code, so the failures are countable.

## Follow-ups

- **Level 2:** Why can the server not send a 500 when the model fails halfway? Expected: the status line went out before the first token, and a response has one status.
- **Level 2:** A user closes the tab halfway through. What should the server do? Expected: the write fails with a broken pipe, the handler closes the generator, and the model stops.
- **Level 3:** Why does the page buffer the bytes instead of parsing each chunk as an event? Expected: a chunk can end in the middle of an event, so the reader keeps the partial text until the blank line arrives.
- **Level 3:** What goes into the error event besides the message? Expected: a stable code that tests can compare, a hint with one action, and the request id that joins the report to a log record.

## Wrong answers

- "Buffer the whole answer and return JSON instead." That removes streaming, and the user waits for the last token on every request.
- "Send the error text as another token." The page cannot tell an error from model output, and the done event never arrives.
- "Retry the request on the server when the model fails." The user already has half an answer. A retry duplicates output and doubles the cost.

## Taught in

The [model demo interfaces lesson](../../../phases/17-infrastructure-and-production/29-model-demo-interfaces/) writes the event stream by hand and sends the error event after the status line.
