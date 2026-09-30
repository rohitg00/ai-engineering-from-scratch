# Validate owners and calendar dates

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

An action list is operational data. Reject impossible calendar dates rather than accepting a shape that merely resembles a date. A missing owner or date is not a parser crash; it is a review flag.

Use the literal ? marker for unknown fields. This keeps uncertainty visible in structured output. Date parsing uses ISO calendar dates without inventing a timezone for all-day commitments.

Require source citations to be a nonempty list of positive integers. Reject booleans even though Python treats them as integers. Invalid or missing citations cannot become trustworthy evidence in the published checklist.

## Work through one concrete case

2026-02-30 has the right digit pattern but is not a calendar date. The marker ? means a missing commitment field and creates needs_date or needs_owner instead of guessing a value.

```figure
pj-meeting-notes-to-actions-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validate_action` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Parse dates with date.fromisoformat after enforcing the intended ISO shape. Validate source lines as positive integers and explicitly reject bool, empty lists and HTML-like values.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py meeting-notes-to-actions --init learning-artifacts/meeting-notes-to-actions`. Then grade cumulatively:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --stage 2 --path learning-artifacts/meeting-notes-to-actions --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/meeting-notes-to-actions
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

## Investigate the failure boundary

Try approving an action whose owner is?. The inbox must reject approval, leaving the incomplete commitment for review.




## References

[Primary technical reference](https://docs.python.org/3/library/datetime.html)
