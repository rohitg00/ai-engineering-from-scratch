# Import a table without guessing away errors

**Type:** Build
**Language:** Python
**Stage:** 1 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to CSV Question Workbench: ask a CSV a question, inspect the executed SQL, and keep a reproducible read-only answer receipt.

Your public contract is `load_csv(text, max_rows=10000)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Start with the file boundary. A CSV reader handles quoted commas and line breaks; splitting each line on commas cannot. Keep the original bytes fingerprint separate from parsed rows so the answer can identify the exact supplied file.

A column is numeric only when every nonempty cell is a finite decimal value within the safe integer magnitude of binary64, with no underflow to zero. Preserve integer-looking values with leading zeros as TEXT. Values above 9007199254740991 also stay TEXT so distinct identifiers cannot collapse into the same floating-point number. Decimal arithmetic remains approximate for REAL columns; use an explicit exact-number schema for that extension. Empty cells become SQL NULL later. This conservative rule keeps a mixed identifier column as text. Reject duplicate case-insensitive headers because SQLite treats their names as equivalent. Reject ragged records before creating a database.

| Input column | Nonempty values | Inferred type |
|---|---|---|
| region | West, East | TEXT |
| units | 12, 7 | REAL |
| ticket | 001, 002 | TEXT |
| item_id | 9007199254740992, 9007199254740993 | TEXT |

## Predict before running

Trace a quoted cell containing a comma. Explain why changing one source character changes the fingerprint even if a downstream aggregate stays equal.

```figure
pj-csv-sql-question-workbench-1
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py csv-sql-question-workbench --init my-csv-sql-question-workbench
python3 scripts/project_test.py csv-sql-question-workbench --stage 1 --path my-csv-sql-question-workbench --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Use csv.reader with strict parsing.
2. Infer each column from all nonempty values, not the first record.
3. Hash the input text before transformation.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 1. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-csv-sql-question-workbench
python3 cli.py sample.csv --question "sum units by region" --output output/report.html
```

The final artifact is a self-contained HTML result table and JSON receipt containing the exact SQL and source fingerprint. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Add a mixed numeric/text column and predict whether SUM should be allowed.

Scope: The offline planner accepts a small explicit question grammar. The optional real model proposes SQL but receives only schema and question. SQLite authorization still controls execution. Source-level provenance does not imply inferred per-result-row lineage.

Primary reference: [SQLite authorization callbacks](https://www.sqlite.org/c3ref/set_authorizer.html). The implementation and exercise data are original teaching examples.
