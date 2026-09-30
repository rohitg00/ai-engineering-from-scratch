# Translate a small question into an inspectable plan

**Type:** Build
**Language:** Python
**Stage:** 2 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to CSV Question Workbench: ask a CSV a question, inspect the executed SQL, and keep a reproducible read-only answer receipt.

Your public contract is `plan_question(question, data)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

A question planner proposes a query. It does not execute one. The baseline intentionally understands count rows, show rows, and grouped aggregates such as sum units by region. An unsupported question fails with examples rather than producing a plausible invented answer.

Resolve field names against the imported schema and quote the resolved identifiers. Do not insert an arbitrary user substring into SQL. For an optional model, make the same proposal/execution separation: a model response is untrusted text until the next stage authorizes it.

| Question part | Resolved meaning |
|---|---|
| sum | SQL aggregate SUM |
| units | Existing numeric column |
| by region | GROUP BY the existing region column |

## Predict before running

Predict the SQL for count by product. Then try sum region by product and explain the type rejection before execution.

```figure
pj-csv-sql-question-workbench-2
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py csv-sql-question-workbench --init my-csv-sql-question-workbench
python3 scripts/project_test.py csv-sql-question-workbench --stage 2 --path my-csv-sql-question-workbench --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Normalize only the question grammar.
2. Map accepted field tokens back to actual column names.
3. Keep query generation pure so tests require no database.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 2. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-csv-sql-question-workbench
python3 cli.py sample.csv --question "sum units by region" --output output/report.html
```

The final artifact is a self-contained HTML result table and JSON receipt containing the exact SQL and source fingerprint. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Add one new question form with an explicit ambiguity rule and tests.

Scope: The offline planner accepts a small explicit question grammar. The optional real model proposes SQL but receives only schema and question. SQLite authorization still controls execution. Source-level provenance does not imply inferred per-result-row lineage.

Primary reference: [SQLite authorization callbacks](https://www.sqlite.org/c3ref/set_authorizer.html). The implementation and exercise data are original teaching examples.
