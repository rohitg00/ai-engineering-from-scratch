# Profile columns and declare their roles and units

Stage 1 of 4. Declare column meanings and keep blanks separate from zero.

## Build the mechanism

The authored attendance table has week 1 values 8 and 10, week 2 blank, and week 4 value 12. A blank has no numeric value.

```figure
pj-chart-storyboard-builder-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement parse_table(csv_text, roles), requiring group,value and unit.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py chart-storyboard-builder --stage 1 --path learning-artifacts/chart-storyboard-builder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

NaN and infinity do not belong on an axis. Refuse them before aggregation.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
