# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `profile`

```python
def profile(text):
```

Parse CSV text into {columns, rows, profile}; profile maps each column to {missing, unique}. Reject empty/duplicate headers and ragged rows. Preserve cells exactly.

### `propose`

```python
def propose(table, aliases=None, date_columns=None):
```

Return schema_version=1 recipe with ordered trim, alias, date rules. aliases maps column to exact trimmed spelling->canonical spelling. Dates accept ISO or unambiguous DD/MM/YYYY; ambiguous dates await review.

### `preview`

```python
def preview(table, recipe):
```

Return {rows,changes,pending,fingerprint}; row numbers are CSV data rows starting at 1. Changes name row,column,before,after; ambiguous/invalid dates remain unchanged and appear in pending. Never mutate input.

### `repair`

```python
def repair(table, recipe, decisions=None):
```

Return {csv,recipe,changes,pending,fingerprint}. Optional {fingerprint,cells:[{row,column,value}]} resolves pending cells only, rejecting stale fingerprints, duplicate edits and non-ISO replacement dates. Unresolved cells stay original.

## Files and integration

The JSON input contains csv text, aliases and date_columns. Outputs are cleaned.csv, recipe.json, receipt.json and review.html. Download decisions.json from the HTML, add {row,column,value} entries to cells, and run the same command with --decisions decisions.json. Replay the exported recipe on another compatible table with --recipe recipe.json. Read cleaned.csv with csv.DictReader as the downstream consumer.
