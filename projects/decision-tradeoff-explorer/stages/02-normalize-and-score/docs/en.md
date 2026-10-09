# Compute comparable scores

> Normalize units without hiding missing values or hard constraints.

**Type:** Build
**Languages:** TypeScript
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Benefit normalization is (value-min)/(max-min); cost normalization is (max-value)/(max-min). Normalize the active weights to sum to one. A cost limit is a maximum; a benefit limit is a minimum. Any missing value or limit violation makes the aggregate score null.

## Worked example

Open gallery normalizes to access .9, setup .2, flow .8. At weights .5,.3,.2 the score is .67. Pods scores .68 and ranks first. An unknown archive flow produces null rather than a renormalized score.

```figure
pj-decision-tradeoff-explorer-2
```

## Implement the contract

`normalize(c:Criterion,v:number):number`; `score(data,weights={}):Row[]` sorted by descending score then ID. A row has `{id,label,score,missing,violations,normalized}`. Weight overrides are raw nonnegative magnitudes; invalid, overflowed or all-zero weights throw. Read weight overrides only from own properties; criterion IDs such as constructor are valid data.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --init /tmp/decision-tradeoff-explorer-work
python3 scripts/project_test.py decision-tradeoff-explorer --stage 2 --path /tmp/decision-tradeoff-explorer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Why would rescaling each criterion from the current options change the answer when an irrelevant option is added?

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
