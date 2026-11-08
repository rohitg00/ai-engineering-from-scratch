# Declare options and evidence

> Make ranges, constraints and uncertainty explicit.

**Type:** Build
**Languages:** TypeScript
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Create a table of criteria and options. Every criterion declares a fixed min/max range, cost or benefit direction and a nonnegative weight. Every option supplies a numeric value or null plus a source note for every criterion. Null means not measured, never zero.

## Worked example

Open gallery has access 9, setup 8 and flow 8. Exhibition pods has 6,2,7. The archive layout has unknown flow and stays visible but ineligible. All three fixtures are authored teaching data.

```figure
pj-decision-tradeoff-explorer-1
```

## Implement the contract

`parse(text:string):Decision`. Criteria: `{id,label,weight,direction,min,max,limit?}`. Options: `{id,label,values:{criterion:number|null},notes:{criterion:string}}`. Reject duplicate IDs, missing notes, out-of-range numbers, unknown criterion keys and zero or nonfinite total weight and nonfinite range widths. At most 30 criteria, 200 options and one MiB.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --init /tmp/decision-tradeoff-explorer-work
python3 scripts/project_test.py decision-tradeoff-explorer --stage 1 --path /tmp/decision-tradeoff-explorer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Replace the exhibition table with a decision from your work. Record which values are measured and which are estimates.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
