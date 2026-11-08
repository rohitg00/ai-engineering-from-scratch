# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `validate`

```python
def validate(document):
```

Return a deep-copied model. participants is a nonnegative integer; materials have unique id,name,kind,quantity,unit and shared materials need positive integer share. Inventory IDs must exist. Explicit positive conversion factors map from->to. Reject inconsistent conversion cycles.

### `scale`

```python
def scale(model, participants=None):
```

Return [{id,name,kind,unit,groups,required}] using quantity*participants for consumables and quantity*ceil(participants/share) for reusable shared equipment. required is a decimal string; zero participants requires zero of both kinds.

### `shortages`

```python
def shortages(model, participants=None):
```

Return scaled rows plus available,shortage (decimal strings or None) and unresolved inventory entries. Sum compatible inventory through explicit reciprocal conversion paths. Any unconvertible inventory for an item leaves availability and shortage unknown; never silently infer density or package size.

### `export_plan`

```python
def export_plan(model, counts):
```

Return schema_version=1 {participants,packing,scenarios,csv,uncertain_items}. counts is a unique list of nonnegative integers for comparison. CSV contains id,name,required,available,shortage,unit,status; unknown quantities are blank with status=review.

## Files and integration

Input JSON contains participants, materials, inventory, conversions and optional compare counts. Outputs packing-list.csv, shortages.json, planner.html. The slider supports 0 through 100 participants; the CLI supports arbitrary nonnegative integers. Download decisions.json to save the chosen count, rerun with --decisions decisions.json, then import packing-list.csv into a spreadsheet with csv.DictReader.
