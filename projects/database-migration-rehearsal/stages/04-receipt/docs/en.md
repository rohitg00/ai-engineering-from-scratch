# Export evidence for an explicit release decision

Stage 4 of 4. Combine schema diffs, invariants and rollback into release evidence.

## Build the mechanism

The sample adds a column then deletes one attendee. same_rows fails and the rollback cannot restore the missing person, so release_ready remains false.

```figure
pj-database-migration-rehearsal-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains database (path relative to the JSON), migration SQL, rollback SQL, and invariants. Without database, the demo creates an authored SQLite fixture inside the output folder. Outputs rehearsal.json, schema-diff.json, review.html. A release gate consumes rehearsal.json and requires release_ready=true while retaining individual invariant and rollback evidence for human review.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py database-migration-rehearsal --stage 4 --path learning-artifacts/database-migration-rehearsal --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

The tool does not apply migrations to the original database or approve a deployment. Rehearsal can consume substantial memory for large tables; use small local snapshots. The two-second SQL progress deadline bounds statements, not all backup or hashing work.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
