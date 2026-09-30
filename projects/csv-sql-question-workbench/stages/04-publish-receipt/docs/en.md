# Publish an answer another developer can reproduce

**Type:** Build
**Language:** Python
**Stage:** 4 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to CSV Question Workbench: ask a CSV a question, inspect the executed SQL, and keep a reproducible read-only answer receipt.

Your public contract is `render_report(report)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

A useful data answer carries its query and input identity. Render the executed SQL above the table and preserve the machine-readable receipt beside the HTML. The report must disclose truncation and the scope of provenance. A database result is evidence about this file under this query, not evidence that the file is accurate.

Treat every cell and column heading as untrusted text when producing HTML. The browser should display a cell containing a script tag, never execute it. The same JSON receipt lets a notebook, CI check or another agent consume the answer without scraping the visual report.

| Region | SUM(units) |
|---|---|
| East | 10 |
| South | 9 |
| West | 21 |

## Predict before running

Change one West input from 4 to 6. Predict the changed aggregate and fingerprint, then compare both receipts.

```figure
pj-csv-sql-question-workbench-4
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py csv-sql-question-workbench --init my-csv-sql-question-workbench
python3 scripts/project_test.py csv-sql-question-workbench --stage 4 --path my-csv-sql-question-workbench --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Use html.escape for data inserted into markup.
2. Show the SQL that actually ran, not the original question alone.
3. Keep JSON and HTML derived from the same report object.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 4. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-csv-sql-question-workbench
python3 cli.py sample.csv --question "sum units by region" --output output/report.html
```

The final artifact is a self-contained HTML result table and JSON receipt containing the exact SQL and source fingerprint. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Integrate the JSON receipt into a simple regression check comparing a known aggregate.

Scope: The offline planner accepts a small explicit question grammar. The optional real model proposes SQL but receives only schema and question. SQLite authorization still controls execution. Source-level provenance does not imply inferred per-result-row lineage.

Primary reference: [SQLite authorization callbacks](https://www.sqlite.org/c3ref/set_authorizer.html). The implementation and exercise data are original teaching examples.
