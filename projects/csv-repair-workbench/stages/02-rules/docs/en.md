# Propose explicit normalization rules

Stage 2 of 4. Build an explicit ordered recipe from supplied policy.

## Build the mechanism

Trim happens before alias lookup, so " North Garden " can map to the canonical North Garden. No guessed synonym is applied.

```figure
pj-csv-repair-workbench-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement propose(table, aliases=None, date_columns=None). Each rule is an explicit trim, alias or date operation.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py csv-repair-workbench --stage 2 --path learning-artifacts/csv-repair-workbench --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

An unknown column is an error. Missing values remain missing; an imputation policy is a possible extension.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
