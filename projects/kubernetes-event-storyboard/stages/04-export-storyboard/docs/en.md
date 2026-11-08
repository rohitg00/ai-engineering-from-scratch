# Export a redacted assistant context pack

> Consume the Go pack in a TypeScript timeline.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Export a version-1 pack with rows, observedAt and explicit redaction notes. Drop raw event messages and workload spec/status, labels and unrelated annotations. TypeScript checks the pack and renders an HTML timeline with a Warning filter and a downloadable JSON pack.

## Worked example

The fixture message contains a fake credential. It must not appear in the Go JSON or generated HTML. The timeline still displays Warning/Failed, count 4, pod-old and revision 7, making the retained evidence inspectable.

```figure
pj-kubernetes-event-storyboard-4
```

## Implement the contract

Go `Export(Bundle)(Pack,error)` composes grouping and connection. TypeScript `parsePack(text)` validates version, rows, positive counts and ordered occurrence times; `timeline(pack)` returns escaped standalone HTML.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 4 --path /tmp/kubernetes-event-storyboard-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Download the filtered page context and parse it again. The filter changes visibility, while the download retains the complete redacted pack.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
