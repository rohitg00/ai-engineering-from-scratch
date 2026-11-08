# Public API contract

Define a small versioned data contract, check field types and bounds, find every row in duplicate groups, and export accepted records separately from quarantine. A CLI exit code gates ingestion while a source-line report explains failures.

## Validate an explicit quality contract

```text
validate_contract(contract) -> dict
```

Require version=1 and a nonempty fields object. Each field declares type string, integer, number or boolean; optional required is Boolean. Numeric min/max must be finite and ordered. enum is a nonempty list of the declared type. unique contains distinct declared field names. min_rows/max_rows are nonnegative integers. Unknown rules fail closed.

Reject unsupported version, unknown keys, missing fields, inverted bounds, incompatible enums and uniqueness rules targeting nonexistent columns.

## Check each record without coercion

```text
row_issues(row, contract) -> list[dict]
```

Consume a validated contract. Return ordered {field,rule} dictionaries. Missing required fields yield required; wrong scalar types yield type; numeric violations yield min or max; disallowed enum values yield enum. Unknown fields yield extra unless allow_extra=true. A non-object row yields {field:"",rule:"object"}.

Boolean true fails integer and number fields. Non-finite floats fail number fields. The contract preserves original records and never invents missing values.

## Find all rows in a duplicate group

```text
duplicate_rows(rows, contract) -> list[dict]
```

For each unique column, index valid typed values to one-based input row numbers. Emit {field,rows} only for groups containing at least two rows. Missing fields and values of the wrong type are left to row validation. Report every colliding member, including the first occurrence.

Do not attempt to hash invalid arrays or objects. Two missing optional values are not evidence of duplicate keys. The chosen rules are per-column, not composite uniqueness.

## Export partitions and enforce the dataset gate

```text
evaluate(rows, contract) -> dict; render_html(report) -> str
```

Return schema_version=1, passed, counts, dataset_issues, duplicates, accepted and quarantine. Quarantine records carry row_number, record and issues. Add a unique issue to every row in a duplicate group. A dataset passes only with no quarantined rows and no whole-dataset issues. CLI --check uses exit1 for rule failure and exit2 for invalid input.

Output partitions are evidence, not permission to discard records automatically. Multiple independent output files are not an atomic transaction; consumers should wait for the command to finish successfully before loading them.

## Boundaries

The version-1 contract is an original teaching format, not JSON Schema or the Open Data Contract Standard. It supports flat JSON objects, four scalar types, required fields, numeric bounds, enums, single-column uniqueness and row-count bounds. Missing optional unique fields do not collide. Duplicate detection uses memory proportional to the batch; the API caps input at one hundred thousand rows. It does not check semantic truth or cross-table foreign keys. Quarantine contains original records and must remain in an appropriate local location.
