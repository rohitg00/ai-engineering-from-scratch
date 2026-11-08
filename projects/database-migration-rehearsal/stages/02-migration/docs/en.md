# Apply migrations only to the disposable copy

Stage 2 of 4. Run the supplied SQL on a disposable in-memory copy.

## Build the mechanism

ALTER TABLE attendees ADD COLUMN city TEXT changes the copy. Reading the original file afterward still returns its original schema and rows.

```figure
pj-database-migration-rehearsal-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement rehearse(source,migration), retaining evidence even when a multi-statement script partially succeeds and then errors.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py database-migration-rehearsal --stage 2 --path learning-artifacts/database-migration-rehearsal --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

ATTACH and dangerous PRAGMAs can undermine copy-only behavior. Deny them and extension/file functions. The policy is not an operating-system sandbox.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
