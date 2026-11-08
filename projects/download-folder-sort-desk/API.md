# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `inventory`

```python
def inventory(folder):
```

Return sorted {path,size,sha256,suffix} records for regular files beneath folder. Reject symbolic links; paths are root-relative POSIX paths. Stream SHA-256 in 64 KiB chunks.

### `categorize`

```python
def categorize(record):
```

Return {category,scores,evidence}. A recognized extension earns 3 points; workshop/handout name words earn documents 1 point each. Highest positive score wins, alphabetic tie-break; no evidence means other.

### `plan_moves`

```python
def plan_moves(records, occupied=None):
```

Return schema_version=1 moves and duplicate_groups. Moves preserve original path/hash and choose category/basename, appending -2, -3 before suffix for case-insensitive collisions. occupied contains existing destination paths. No filesystem mutation.

### `review_plan`

```python
def review_plan(folder, plan, decisions=None):
```

Validate current source bytes and optional {fingerprint,approved:[source paths]}; return plan with approved booleans plus fingerprint. Reject missing/changed files, traversal and unknown/duplicate approvals. This is the file-manager integration gate; it never moves files.

## Files and integration

Input JSON contains folder relative to the JSON file and optional occupied destination strings. Outputs: moves.json, duplicates.json, review.html. Download and edit decisions.json with the retained fingerprint and an approved array of source paths, then rerun with --decisions decisions.json. A file manager imports review_plan(folder, json.load(open("moves.json")), decisions) and executes only its approved moves after checking destination availability.
