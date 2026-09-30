# Parse explicit action records with line provenance

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Natural meeting prose contains suggestions, decisions, and commitments. Start with an explicit format: ACTION owner | YYYY-MM-DD | task. This conservative parser avoids inventing an owner from nearby names.

Keep the original line number and text on every parsed record. A later reviewer must be able to trace an action to exactly what someone wrote. Non-action lines stay outside the output.

## Work through one concrete case

Line 1 is a decision, line 2 is ACTION Mira |2026-10-01|Update guide, and line 3 says Maybe ask Ravi. Only line 2 becomes an explicit candidate. The separate proposal grammar can recognize "Priya will test login by2026-10-02" after spaces are supplied normally.

```figure
pj-meeting-notes-to-actions-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `parse_notes` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Enumerate original lines before filtering. Split ACTION on only the first two separators so the task body can contain another vertical bar without shifting owner and date.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py meeting-notes-to-actions --init learning-artifacts/meeting-notes-to-actions`. Then grade cumulatively:

```bash
python3 scripts/project_test.py meeting-notes-to-actions --stage 1 --path learning-artifacts/meeting-notes-to-actions --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/meeting-notes-to-actions
python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv
```

## Investigate the failure boundary

Move an action down two lines and rerun. The stored citation must move too, while unrelated prose remains unassigned.




## References

[Primary technical reference](https://docs.python.org/3/library/datetime.html)
