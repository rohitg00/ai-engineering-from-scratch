# Export and replay an interrupted-answer trace

> Ship the browser component with a replayable accepted-event artifact.

**Type:** Build
**Languages:** TypeScript, Go
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Serialize accepted events and terminal state as a version-1 trace. Replay rebuilds the answer by running apply on each event and checks that completion agrees with the event ledger. The reusable mount component provides resume, cancellation, citations and a trace download.

## Worked example

Download immediately after the first interruption. Replay yields text Caf and status interrupted. Download after resuming and replay yields the completed Unicode answer with one citation. A trace claiming completed without a complete event fails.

```figure
pj-streaming-answer-recovery-4
```

## Implement the contract

`trace(state):string`; `replay(text):Answer`; `mount(host:HTMLElement,url:string):()=>void`. The returned disposer aborts work and clears the host. build-browser.ts strips native TypeScript into an importable browser module; no framework runtime is required.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py streaming-answer-recovery --init /tmp/streaming-answer-recovery-work
python3 scripts/project_test.py streaming-answer-recovery --stage 4 --path /tmp/streaming-answer-recovery-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Store transport-level byte traces separately if you need to reproduce decoder failures. This exported trace records accepted application events and status, not discarded partial bytes.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
