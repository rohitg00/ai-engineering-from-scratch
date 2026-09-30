# CSV Question Workbench

Ask a CSV a question, inspect the executed SQL, and keep a reproducible read-only answer receipt.

You finish with a self-contained HTML result table and JSON receipt containing the exact SQL and source fingerprint.

## Run the finished tool

From the repository root:

```bash
cd projects/csv-sql-question-workbench/solution
python3 cli.py sample.csv --question "sum units by region" --output output/report.html
```

The sample is authored for this project. Substitute your own input through the same CLI. No model key is needed for the baseline. See the command help before enabling an optional external adapter.

## Build it yourself

Start with [development setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md). You should be able to read a JSON object, call a function, run a terminal command and interpret a failing test before starting.

```bash
python3 scripts/project_test.py csv-sql-question-workbench --init my-csv-sql-question-workbench
python3 scripts/project_test.py csv-sql-question-workbench --stage 1 --path my-csv-sql-question-workbench --strict
python3 scripts/project_test.py csv-sql-question-workbench --all --path my-csv-sql-question-workbench --strict --report completion.json
```

The fresh workspace intentionally fails until you implement the functions. The CLI, input files and public types are supplied so completion does not require copying a reference entry point. Work through the stages in order:

1. [Import a table without guessing away errors](stages/01-import-table/docs/en.md)
2. [Translate a small question into an inspectable plan](stages/02-plan-question/docs/en.md)
3. [Execute a proposal inside a read-only boundary](stages/03-enforce-read-boundary/docs/en.md)
4. [Publish an answer another developer can reproduce](stages/04-publish-receipt/docs/en.md)

## Reuse the artifact

The CLI and importable functions consume ordinary local files and return structured output. Keep input identity and explicit failure metadata when integrating with another program. The HTML output has no third-party scripts and can be shared after inspecting the included source data.

## Verification and scope

```bash
python3 scripts/project_test.py csv-sql-question-workbench --all --solution --strict
```

The offline planner accepts a small explicit question grammar. The optional real model proposes SQL but receives only schema and question. SQLite authorization still controls execution. Source-level provenance does not imply inferred per-result-row lineage.

Grading validates the supplied deterministic contracts. A learner certificate is a self-attested completion record; it does not claim live-provider verification or professional certification. Read the JSON receipt and test at least one new input before treating the tool as integrated.

Primary reference: [SQLite authorization callbacks](https://www.sqlite.org/c3ref/set_authorizer.html).
