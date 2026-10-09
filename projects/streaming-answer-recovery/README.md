# Streaming Answer Recovery

Build a browser answer view and local event stream for developers integrating assistant output. Handle split UTF-8 bytes, event IDs, reconnection, cancellation and partial citations. Preserve the difference between an interrupted draft and a completed answer, with a downloadable event trace to reproduce rendering failures.

Standard libraries only. Four stages, approximately eight hours. TypeScript, Go implementations are exercised by the grader.

## Build it

1. [Decode chunked bytes into complete events](stages/01-decode-sse/docs/en.md)
2. [Render text and citations by stable identity](stages/02-stable-answer-state/docs/en.md)
3. [Handle reconnect and cancellation](stages/03-reconnect-and-cancel/docs/en.md)
4. [Export and replay an interrupted-answer trace](stages/04-trace-and-component/docs/en.md)

```bash
python3 scripts/project_test.py streaming-answer-recovery --init /tmp/streaming-answer-recovery-work
python3 scripts/project_test.py streaming-answer-recovery --stage 1 --path /tmp/streaming-answer-recovery-work --strict
python3 scripts/project_test.py streaming-answer-recovery --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run the actual interrupted stream

```bash
cd projects/streaming-answer-recovery/solution
python3 demo.py
node --experimental-strip-types build-browser.ts /tmp/stream-browser
```

The demo builds the Go fixture, starts a finite loopback server, reads its URL and runs the TypeScript client twice. First output is interrupted Caf at event 1. Resume sends Last-Event-ID:1 and completes Café without duplicated text. The accepted-event trace is written to /tmp/aiefs-answer-trace.json and replayed by the actual state reducer.

For your own SSE endpoint: `node --experimental-strip-types cli.ts URL /tmp/trace.json`. The CLI makes at most two connections. For browser integration, import `mount` from the generated answer.js and mount it with a same-origin SSE URL, or configure CORS on your own server. For a complete local browser run, use `go run . --listen 127.0.0.1:8137 --seconds 120 --web /tmp/stream-browser` and open localhost:8137. The Go fixture serves the generated page and /events on one origin; it does not grant cross-origin access. The finite server exits after the requested lifetime.

The SSE parser supports UTF-8, CR/LF framing, comments, data fields, event type and persistent last ID. It ignores retry fields; reconnect policy belongs to the caller. The authored answer protocol requires contiguous positive numeric event IDs and payload type text/citation/complete. This is a teaching protocol, not an adapter for any specific LLM provider.

Trace schema version 1 contains accepted events and status. It reproduces rendering state, including interrupted or cancelled answers; it does not retain partial transport bytes. Status completed requires an explicit complete event. [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html) defines framing and resume fields.

## Completion evidence

```bash
python3 scripts/project_test.py streaming-answer-recovery --all --path /tmp/streaming-answer-recovery-work --strict --report /tmp/streaming-answer-recovery-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
