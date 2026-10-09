# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `load_plan`

```python
def load_plan(document):
```

Validate Terraform JSON format major 1 and return sanitized {format_version,resources,configuration}. Resource IDs combine address and optional deposed key. Keep masked before/after and actions only; omit variables, prior state and all other potentially secret raw fields.

### `classify`

```python
def classify(actions):
```

Return create,update,delete,replace,read,no-op or forget for supported exact action sequences. Both create/delete orders are replacements. Unknown sequences raise ValueError.

### `impact_graph`

```python
def impact_graph(plan):
```

Return {nodes,edges,unresolved}. Node is {id,address,action}; edge {from,to,reference} means from depends on to. Resolve expression references and depends_on by longest resource-address prefix, including static references to counted instances. Retain unresolved resource references; ignore var/local/path/count/each/terraform roots.

### `explain`

```python
def explain(plan):
```

Return schema_version=1 {graph,resources,markdown}. Markdown lists exact addresses with stable local anchors and escaped code data. Graph edges are declared dependencies, not a prediction of provider execution order or transitive downtime.

## Files and integration

Pass saved Terraform JSON directly: terraform show -json saved.plan > input.json, then python3 cli.py input.json --output review. Outputs change-brief.md, resource-impact.json, review.html. The downstream consumer loads resource-impact.json and follows graph.edges from/to into resources by id. No Terraform binary or provider credentials are needed to explain an existing JSON file.
