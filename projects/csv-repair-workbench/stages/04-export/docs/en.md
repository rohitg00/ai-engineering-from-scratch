# Export a reusable repair recipe and cleaned table

Stage 4 of 4. Replay the recipe and validate human cell decisions.

## Build the mechanism

A decision for row 2 date=2026-04-03 is accepted only for the matching input and recipe fingerprint. Every accepted edit enters the change ledger.

```figure
pj-csv-repair-workbench-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

The JSON input contains csv text, aliases and date_columns. Outputs are cleaned.csv, recipe.json, receipt.json and review.html. Download decisions.json from the HTML, add {row,column,value} entries to cells, and run the same command with --decisions decisions.json. Replay the exported recipe on another compatible table with --recipe recipe.json. Read cleaned.csv with csv.DictReader as the downstream consumer.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py csv-repair-workbench --stage 4 --path learning-artifacts/csv-repair-workbench --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Only slash dates and ISO dates are recognized. Reviews resolve pending date cells; no locale or semantic inference is claimed.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
