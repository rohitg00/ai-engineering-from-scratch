# Compute aggregates and choose a chart grammar

Stage 2 of 4. Compute the plotted data and expose missing periods.

## Build the mechanism

Week 1 totals 18 people and averages 9. Supplying weeks 1 through 4 adds week 3 as an explicit absent period.

```figure
pj-chart-storyboard-builder-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement aggregate(table,reducer="sum",periods=None,grammar="bar"). Empty groups return null, never fabricated zero.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py chart-storyboard-builder --stage 2 --path learning-artifacts/chart-storyboard-builder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Do not accept a period list that drops observed data. Both bar and line axes include zero.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
