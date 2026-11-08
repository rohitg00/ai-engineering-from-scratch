# Exercise rollback and detect data loss

Stage 3 of 4. Exercise the declared reverse operation and compare all captured state.

## Build the mechanism

Deleting attendee 2 and then dropping a newly added column does not restore the attendee. A syntactically successful rollback still fails reversibility.

```figure
pj-database-migration-rehearsal-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement test_rollback(source,migration,rollback). Compare schema, content hashes, counts and sequence values with the original snapshot.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py database-migration-rehearsal --stage 3 --path learning-artifacts/database-migration-rehearsal --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

This checks the supplied rollback against this input snapshot. It does not prove recovery for every production dataset or preserve connection-level configuration.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
