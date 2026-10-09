# Explore sensitivity and dominance

> Find when a preference change reverses the ranking.

**Type:** Build
**Languages:** TypeScript
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Sweep one weight from zero to one. Distribute the remaining weight proportionally across the other baseline weights. An eligible option is dominated if another is no worse on every normalized criterion and strictly better on at least one. Dominance is independent of the active preference weights.

## Worked example

At accessibility weight .5, pods wins .68 versus .67. At .6, open gallery wins. The archive stays ineligible across the sweep because missing evidence cannot be repaired by changing preferences.

```figure
pj-decision-tradeoff-explorer-3
```

## Implement the contract

`dominated(data):string[]`; `sensitivity(data,id,steps=10)` returns steps+1 `{weight,weights,winner,scores}` records. Require 1..100 integer steps and another positive baseline criterion weight.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --init /tmp/decision-tradeoff-explorer-work
python3 scripts/project_test.py decision-tradeoff-explorer --stage 3 --path /tmp/decision-tradeoff-explorer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Inspect the exact boundary with a finer sweep. The sampled crossover interval is not an analytic proof of a single crossing.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
