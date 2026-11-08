# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `parse_table`

```python
def parse_table(text, roles):
```

Return {rows,roles,missing}; roles requires group,value,unit strings naming CSV columns and a display unit. Rows retain raw values plus group and number (float or None for blanks). Reject duplicate headers, ragged rows, blank groups and non-finite numbers.

### `aggregate`

```python
def aggregate(table, reducer='sum', periods=None, grammar='bar'):
```

Return chart spec {schema_version,grammar,reducer,unit,points,axis,source_rows,missing_values}. Reducers: sum,mean,count (nonblank values). Supplied unique periods define order and expose absent groups as null. Reject omitted observed groups. Axis always includes zero.

### `annotate`

```python
def annotate(spec, requests):
```

Return a copied spec with annotations [{group,value,text}]. Requests {group,text} must identify a nonmissing point; generated text appends the exact plotted value and unit. Reject duplicate or unknown groups.

### `render_svg`

```python
def render_svg(spec):
```

Render a standalone accessible SVG with title, desc, explicit zero baseline, values, unit and missing-point labels. Line charts break across missing points. All supplied text is XML-escaped; no JavaScript or external resources.

## Files and integration

Input JSON contains csv, roles, optional periods, and charts [{grammar,reducer,annotations}]. Outputs chart-N.svg, chart-specs.json, storyboard.html. The consumer loads chart-specs.json, selects each charts entry and calls render_svg(spec); this reproduces the portable visual without the input CSV.
