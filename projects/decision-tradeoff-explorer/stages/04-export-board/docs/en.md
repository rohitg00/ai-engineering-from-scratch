# Export the chosen scenario

> Make the board produce a reusable decision record.

**Type:** Build
**Languages:** TypeScript
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Export criteria.csv, decision-record.json and an interactive HTML board. Sliders recompute the scores. The user selects an eligible option and downloads the current weights, source notes and scored rows. Choosing the top-ranked option is a default, not a requirement.

## Worked example

Increase accessibility until open gallery wins, select it and download. The JSON weights must match the visible slider values. Its chosen field may differ from winner when a user deliberately selects another eligible option.

```figure
pj-decision-tradeoff-explorer-4
```

## Implement the contract

`record(data,weights={},chosen?):object`; `csv(data):string`; `html(data):string`. Version-1 records retain criteria, options, weights, scores, chosen, winner, dominated and assumptions. HTML payloads escape closing script tags; CSV quotes cells and prefixes formula-leading text.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --init /tmp/decision-tradeoff-explorer-work
python3 scripts/project_test.py decision-tradeoff-explorer --stage 4 --path /tmp/decision-tradeoff-explorer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Feed the downloaded record back into score using its options, criteria and weights, and compare every score before accepting it as review evidence.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
