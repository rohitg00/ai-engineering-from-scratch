# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `import_catalog`

```python
def import_catalog(text, source):
```

Parse CSV requiring nonempty unique id and title, optional creator and extra fields. Return records with source and source_id keys; preserve original fields. Reject ragged rows, duplicate headers and blank source names.

### `candidates`

```python
def candidates(left, right, threshold=0.25):
```

Return descending candidate pairs {left,right,score,title_score,creator_score}; title Jaccard contributes 0.8, creator Jaccard 0.2. Include scores >= threshold; use source IDs to break ties. Threshold must be finite in [0,1].

### `reconcile`

```python
def reconcile(left, right, decisions):
```

Return merged entities with sources (complete original records), fields and unresolved conflicts. Decisions are [{left,right,match:bool,values:{field:chosen string}}]. Require one-to-one accepted links, known IDs and unique pair decisions. Unmatched records remain separate.

### `export_catalog`

```python
def export_catalog(left, right, review=None):
```

Return schema_version=1 {fingerprint,entities,crosswalk,ready}; crosswalk is CSV source_id,entity_id. Optional review {fingerprint,pairs:[decisions]} is bound to source records. ready means every accepted merge has resolved field conflicts, not that every candidate was reviewed.

## Files and integration

Input has left_csv, right_csv and optional threshold. Outputs are crosswalk.csv, merged-catalog.json, review.html. Download decisions.json, add {left,right,match,values} entries in pairs, then pass --decisions decisions.json. A fingerprint rejects reviews for different source inputs.
