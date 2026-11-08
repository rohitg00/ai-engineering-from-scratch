# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `catalog`

```python
def catalog(resources):
```

Validate and copy at most 18 resources {id,title,minutes,goals:[str],prerequisites:[id]}. IDs are unique; minutes positive integer. Known-resource cycles are rejected. Missing prerequisite IDs remain explicit for later feasibility checks.

### `path_for`

```python
def path_for(index, target, completed=None):
```

Return {target,steps,missing,minutes,feasible}, with prerequisites before target and completed IDs excluded from steps. completed can satisfy a prerequisite outside the catalog. Unknown targets are missing rather than fabricated resources.

### `rank_paths`

```python
def rank_paths(index, goals, budget, completed=None):
```

Return {best,alternatives,unmet_prerequisites}. Exact search combines prerequisite-closed routes for requested goals; rank by most distinct goals covered, then fewest minutes, then IDs. Budget is nonnegative integer. best includes steps,minutes,covered,uncovered; completed resources contribute goals without consuming budget. Keep top three distinct alternatives.

### `export_path`

```python
def export_path(index, goals, budget, completed=None, decisions=None):
```

Return schema_version=1 {fingerprint,path,alternatives,unmet_prerequisites,remaining_minutes}. path entries contain original resource fields, selected reasons and completed status. Review {fingerprint,completed:[selected IDs]} can mark progress only when all prerequisites are previously completed or included. Fingerprint binds catalog, goals, budget and previous completion.

## Files and integration

Input JSON contains resources, goals, budget and optional completed IDs. Outputs learning-map.html, path.json, unmet-prerequisites.json. Edit the HTML progress JSON and download decisions.json, then rerun with --decisions decisions.json. A course platform imports path.json path entries in array order, retaining id, prerequisites, minutes and completed fields.
