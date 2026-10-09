# Handle reconnect and cancellation

> Resume after the last accepted event, not the last partial byte.

**Type:** Build
**Languages:** TypeScript, Go
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Go serves an authored SSE stream in three-byte writes and deliberately closes the first request halfway through é. TypeScript connect sends Last-Event-ID on the next request, creates a fresh decoder, preserves accepted answer state and handles AbortSignal cancellation.

## Worked example

First connection accepts event 1 then ends with a truncated UTF-8 error: text Caf, status interrupted, lastID 1. Reconnect sends Last-Event-ID:1. Go emits complete event 2 onward, producing Café once, one citation and completed state.

```figure
pj-streaming-answer-recovery-3
```

## Implement the contract

TypeScript `connect(url,state,onState,signal?):Promise<Answer>` bounds each connection to one MiB and marks failures interrupted. Cancel and release the response reader after malformed data, cancellation or application completion so failed streams cannot remain open. Go `Encode(StreamEvent)([]byte,error)`, `After(events,last)([]StreamEvent,error)`, `Handler(events)http.Handler`. No automatic reconnect loop is hidden; the caller chooses each connection.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py streaming-answer-recovery --init /tmp/streaming-answer-recovery-work
python3 scripts/project_test.py streaming-answer-recovery --stage 3 --path /tmp/streaming-answer-recovery-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Abort between two events. A cancelled answer must keep its draft text and must not reconnect when the user clicks resume.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
