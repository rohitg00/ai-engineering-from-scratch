# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `snapshot`

```python
def snapshot(source):
```

Read an existing SQLite file through a read-only connection and backup into memory. Return schema definitions, table row counts, order-independent row-content SHA-256 hashes and AUTOINCREMENT sequences. Source is never opened writable.

### `rehearse`

```python
def rehearse(source, migration):
```

Apply SQL only to an in-memory backup. Return {before,after,schema_diff,error,applied}; after records even partially applied scripts when an error occurs. ATTACH, DETACH, PRAGMA, virtual-table creation and extension/file functions are denied; long statements are interrupted after a two-second progress deadline. This is SQLite policy, not OS isolation.

### `test_rollback`

```python
def test_rollback(source, migration, rollback):
```

Reapply migration and declared rollback to one disposable backup. Return migration evidence plus {rollback_error,restored,reversible}. restored is the post-rollback snapshot; reversible requires successful forward and rollback scripts and exact equality of schema, row content and sequences to before. No automatic rollback SQL is invented.

### `receipt`

```python
def receipt(source, migration, rollback, invariants):
```

Return schema_version=1 rehearsal with invariant_results and release_ready. invariants is [{table,min_rows?,max_rows?,same_rows?,preserve_data?}]. Missing tables fail. preserve_data compares full row hashes, intended for unchanged-schema tables. Release readiness requires all invariants, successful forward SQL and demonstrated exact rollback; this is evidence for a human release decision.

## Files and integration

Input JSON contains database (path relative to the JSON), migration SQL, rollback SQL, and invariants. Without database, the demo creates an authored SQLite fixture inside the output folder. Outputs rehearsal.json, schema-diff.json, review.html. A release gate consumes rehearsal.json and requires release_ready=true while retaining individual invariant and rollback evidence for human review.
