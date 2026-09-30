# Deduplicate exact commitments without losing citations

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Repeated notes can duplicate a task. Group by normalized owner, due date, and normalized task text, then merge all source line numbers. Two people assigned the same task are still two commitments.

This is exact normalization, not semantic deduplication. Avoid merging paraphrases automatically because their deadlines or scope may differ. Human review is safer than quietly deleting a distinct obligation.

## Work through one concrete case

Two identical commitments on lines 2 and 8 collapse to one row with citations[2,8]. Changing either the owner or the due date creates a second commitment even if the task text remains identical.

```figure
pj-meeting-notes-to-actions-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `deduplicate` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Build the key from normalized owner, due and task, while preserving the displayed text. Merge citation sets in sorted order so repeated imports produce deterministic output.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py meeting-notes-to-actions --init learning-artifacts/meeting-notes-to-actions`. Then grade cumulatively:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --stage 3 --path learning-artifacts/meeting-notes-to-actions --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/meeting-notes-to-actions
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

## Investigate the failure boundary

Write a paraphrase with a later deadline. Explain why an automatic semantic merge could delete an actual obligation.




## References

[Primary technical reference](https://docs.python.org/3/library/datetime.html)
