# CSV Repair Workbench

Help a spreadsheet owner repair inconsistent labels, dates and missing values through an explicit sequence of transformations. Preview every changed cell, keep ambiguous cases for review, and export a cleaned CSV with a reusable transformation recipe and HTML comparison.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py csv-repair-workbench --init learning-artifacts/csv-repair-workbench
python3 scripts/project_test.py csv-repair-workbench --stage 1 --path learning-artifacts/csv-repair-workbench --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py csv-repair-workbench --all --path learning-artifacts/csv-repair-workbench --strict
cd learning-artifacts/csv-repair-workbench
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py csv-repair-workbench --all --solution --strict
cd projects/csv-repair-workbench/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

The JSON input contains csv text, aliases and date_columns. Outputs are cleaned.csv, recipe.json, receipt.json and review.html. Download decisions.json from the HTML, add {row,column,value} entries to cells, and run the same command with --decisions decisions.json. Replay the exported recipe on another compatible table with --recipe recipe.json. Read cleaned.csv with csv.DictReader as the downstream consumer.

## Worked example and limits

The sample has North Garden, north garden and N. Garden. Keep their original spelling and row numbers before changing anything.

Only slash dates and ISO dates are recognized. Reviews resolve pending date cells; no locale or semantic inference is claimed.

## Stages

1. [Profile columns and retain original cells](stages/01-profile/docs/en.md)
2. [Propose explicit normalization rules](stages/02-rules/docs/en.md)
3. [Preview changes and review ambiguous values](stages/03-preview/docs/en.md)
4. [Export a reusable repair recipe and cleaned table](stages/04-export/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
