# Render text and citations by stable identity

> Make duplicate delivery harmless while preserving incomplete state.

**Type:** Build
**Languages:** TypeScript, Go
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

The answer protocol adds contiguous positive integer IDs and JSON payloads to SSE. Text appends content, citation adds a labelled HTTP(S) URL and complete marks the answer done. Equal duplicate IDs are ignored; conflicting duplicate payloads, gaps and events after completion fail.

## Worked example

Event 1 appends Caf. Replaying event 1 changes nothing. Event 2 appends é and more text. A citation does not imply completion. The answer remains draft until a complete event arrives.

```figure
pj-streaming-answer-recovery-2
```

## Implement the contract

`initial():Answer`; `apply(state,event):Answer`. Answer contains text, citations, status, lastID and accepted events. `interrupt(state)` preserves text and marks interrupted. `cancel(state)` marks a noncompleted answer cancelled; cancelled answers ignore subsequent events.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py streaming-answer-recovery --init /tmp/streaming-answer-recovery-work
python3 scripts/project_test.py streaming-answer-recovery --stage 2 --path /tmp/streaming-answer-recovery-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Inject a javascript: citation and reject it before rendering. Citation text is content and is rendered with textContent.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
