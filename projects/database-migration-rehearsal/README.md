# Database Migration Rehearsal

Let a developer or coding agent propose SQLite migrations against a disposable database copy. Record schema and row-count invariants before and after, test declared rollback steps, and expose irreversible changes. Export a machine-readable rehearsal receipt and review page without touching the source database.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py database-migration-rehearsal --init learning-artifacts/database-migration-rehearsal
python3 scripts/project_test.py database-migration-rehearsal --stage 1 --path learning-artifacts/database-migration-rehearsal --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py database-migration-rehearsal --all --path learning-artifacts/database-migration-rehearsal --strict
cd learning-artifacts/database-migration-rehearsal
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py database-migration-rehearsal --all --solution --strict
cd projects/database-migration-rehearsal/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input JSON contains database (path relative to the JSON), migration SQL, rollback SQL, and invariants. Without database, the demo creates an authored SQLite fixture inside the output folder. Outputs rehearsal.json, schema-diff.json, review.html. A release gate consumes rehearsal.json and requires release_ready=true while retaining individual invariant and rollback evidence for human review.

## Worked example and limits

Two attendees occupy the source table. A snapshot records the CREATE TABLE statement, count 2 and a hash of sorted row representations.

The tool does not apply migrations to the original database or approve a deployment. Rehearsal can consume substantial memory for large tables; use small local snapshots. The two-second SQL progress deadline bounds statements, not all backup or hashing work.

## Stages

1. [Snapshot a local database and define invariants](stages/01-snapshot/docs/en.md)
2. [Apply migrations only to the disposable copy](stages/02-migration/docs/en.md)
3. [Exercise rollback and detect data loss](stages/03-rollback/docs/en.md)
4. [Export evidence for an explicit release decision](stages/04-receipt/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
