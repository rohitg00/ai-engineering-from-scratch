# Publish an escaped HTML checklist and summary

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A checklist becomes useful when it is readable and reviewable outside the parser. Validate source line citations before rendering owners, dates, tasks, and source lines into HTML, escaping every rendered field. Mark overdue items only relative to an explicit supplied date.

The HTML is a static review artifact. It sends no messages and creates no tasks in other systems. Its counters separate ready actions, incomplete actions, and overdue actions so the reader can prioritize review.

## Work through one concrete case

The first inbox run exports zero rows because ready is not approved. The HTML selects explicit decisions, downloads a JSON decision file and the next CLI run exports only approved complete rows to CSV.

```figure
pj-meeting-notes-to-actions-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `publish` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Stable ids bind review choices to owner, due, task and source lines. The supplied driver assigns every current id before validating decisions, then rejects any unknown or stale id before writing outputs. A decision file from changed source lines must be reviewed again. Selectors retain current approved and rejected choices when downloading decisions. Escape every imported field; the only executable script in the HTML is the authored decision-file downloader.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py meeting-notes-to-actions --init learning-artifacts/meeting-notes-to-actions`. Then grade cumulatively:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --stage 4 --path learning-artifacts/meeting-notes-to-actions --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/meeting-notes-to-actions
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

## Investigate the failure boundary

Paste a script tag into a task. It must render as source text, and downloading decisions must contain only action ids and allowed decision values.

ACTION lines are authoritative candidates; NAME will TASK by YYYY-MM-DD is a conservative proposal grammar. Unstructured suggestions outside those grammars stay unassigned. HTML review does not post tasks or send messages.


## References

[Primary technical reference](https://docs.python.org/3/library/datetime.html)
