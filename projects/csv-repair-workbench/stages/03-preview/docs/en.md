# Preview changes and review ambiguous values

Stage 3 of 4. Show every changed cell and quarantine uncertain dates.

## Build the mechanism

14/03/2026 becomes 2026-03-14. Both 03/04/2026 and 04/03/2026 remain pending because either ordering is plausible.

```figure
pj-csv-repair-workbench-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement preview(table, recipe), returning rows, changes, pending and a SHA-256 review fingerprint.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py csv-repair-workbench --stage 3 --path learning-artifacts/csv-repair-workbench --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A date like 31/02/2026 is invalid, not merely ambiguous. Keep it visible instead of coercing it.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
