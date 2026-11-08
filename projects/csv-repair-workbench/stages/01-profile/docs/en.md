# Profile columns and retain original cells

Stage 1 of 4. Retain exact source cells while counting missing and distinct values.

## Build the mechanism

The sample has North Garden, north garden and N. Garden. Keep their original spelling and row numbers before changing anything.

```figure
pj-csv-repair-workbench-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement profile(text): rows preserve strings and profile counts whitespace-only cells as missing.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py csv-repair-workbench --stage 1 --path learning-artifacts/csv-repair-workbench --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Quoted commas belong inside one cell. Reject duplicate headers and rows with a different width.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
