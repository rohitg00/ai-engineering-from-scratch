# Snapshot a local database and define invariants

Stage 1 of 4. Capture schema, row counts and content identities from a read-only source.

## Build the mechanism

Two attendees occupy the source table. A snapshot records the CREATE TABLE statement, count 2 and a hash of sorted row representations.

```figure
pj-database-migration-rehearsal-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement snapshot(source). Use SQLite backup into memory so WAL-visible committed state is included without opening the source writable.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py database-migration-rehearsal --stage 1 --path learning-artifacts/database-migration-rehearsal --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A row count alone cannot detect replacing Ada with another person. Content hashes detect equal-count data changes.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
