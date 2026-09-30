# Meeting Notes to Actions

A source-linked commitment inbox whose export requires an explicit review decision.

Python 3.10+; line-oriented parsing, dictionaries, ISO dates, escaping and JSON files. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py meeting-notes-to-actions --init learning-artifacts/meeting-notes-to-actions
python3 scripts/project_test.py meeting-notes-to-actions --stage 1 --path learning-artifacts/meeting-notes-to-actions --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --all --path learning-artifacts/meeting-notes-to-actions --strict
cd learning-artifacts/meeting-notes-to-actions
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --all --solution --strict
cd projects/meeting-notes-to-actions/solution
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

## Observe the change

The first run proposes three commitments and exports zero approved rows. Review actions.html, choose decisions and download decisions.json; rerun with --decisions decisions.json to export only approved complete actions.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Use the schema_version1 actions.json receipt with stable action ids and original source lines. CSV columns are id, owner, due and task, and contain approved actions only.

ACTION lines are authoritative candidates; NAME will TASK by YYYY-MM-DD is a conservative proposal grammar. Unstructured suggestions outside those grammars stay unassigned. HTML review does not post tasks or send messages.

## Stages

1. [Parse explicit action records with line provenance](stages/01-parse-lines/docs/en.md)
2. [Validate owners and calendar dates](stages/02-validate-commitments/docs/en.md)
3. [Deduplicate exact commitments without losing citations](stages/03-deduplicate-actions/docs/en.md)
4. [Publish an escaped HTML checklist and summary](stages/04-publish-checklist/docs/en.md)


## Primary references

[Mechanism and API reference](https://docs.python.org/3/library/datetime.html)
