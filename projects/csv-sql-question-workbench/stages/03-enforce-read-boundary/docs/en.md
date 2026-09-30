# Execute a proposal inside a read-only boundary

**Type:** Build
**Language:** Python
**Stage:** 3 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to CSV Question Workbench: ask a CSV a question, inspect the executed SQL, and keep a reproducible read-only answer receipt.

Your public contract is `run_query(data, sql, max_rows=100, max_steps=100000)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Checking whether a string starts with SELECT is insufficient: SQL can call functions, inspect internal tables, or hide expensive work inside a query. Build an isolated in-memory table, then install the SQLite authorizer before compiling the untrusted statement. Allow reads of that table and a small function set; reject other actions.

Two budgets answer different questions. Fetching at most limit plus one rows reveals truncation. An instruction callback interrupts excessive computation before a huge result exists. The original CSV is never opened for writing. This bounds a teaching database; it is not a multi-tenant database service.

| Proposal | Outcome |
|---|---|
| SELECT SUM(units) FROM data | Returns 40 |
| DELETE FROM data | Denied before effect |
| SELECT * FROM data with limit 2 | Two rows and truncated=true |

## Predict before running

Explain why a row limit alone cannot stop an expensive join that computes before returning its first row.

```figure
pj-csv-sql-question-workbench-3
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py csv-sql-question-workbench --init my-csv-sql-question-workbench
python3 scripts/project_test.py csv-sql-question-workbench --stage 3 --path my-csv-sql-question-workbench --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Create and populate the database before installing the authorizer.
2. Keep the callback active during execution and result fetching.
3. Return truncation as metadata rather than silently claiming completeness.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 3. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-csv-sql-question-workbench
python3 cli.py sample.csv --question "sum units by region" --output output/report.html
```

The final artifact is a self-contained HTML result table and JSON receipt containing the exact SQL and source fingerprint. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Use a deliberately expensive read and prove the instruction budget interrupts it.

Scope: The offline planner accepts a small explicit question grammar. The optional real model proposes SQL but receives only schema and question. SQLite authorization still controls execution. Source-level provenance does not imply inferred per-result-row lineage.

Primary reference: [SQLite authorization callbacks](https://www.sqlite.org/c3ref/set_authorizer.html). The implementation and exercise data are original teaching examples.
