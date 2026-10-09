import json, re, hashlib


def _masked(value, sensitive=False, unknown=False):
    if sensitive is True:
        return "[sensitive]"
    if unknown is True:
        return "[unknown]"
    if (
        isinstance(value, dict)
        or isinstance(sensitive, dict)
        or isinstance(unknown, dict)
    ):
        v = value if isinstance(value, dict) else {}
        s = sensitive if isinstance(sensitive, dict) else {}
        u = unknown if isinstance(unknown, dict) else {}
        return {
            k: _masked(v.get(k), s.get(k, False), u.get(k, False))
            for k in sorted(set(v) | set(s) | set(u))
        }
    if (
        isinstance(value, list)
        or isinstance(sensitive, list)
        or isinstance(unknown, list)
    ):
        v = value if isinstance(value, list) else []
        s = sensitive if isinstance(sensitive, list) else []
        u = unknown if isinstance(unknown, list) else []
        return [
            _masked(
                v[i] if i < len(v) else None,
                s[i] if i < len(s) else False,
                u[i] if i < len(u) else False,
            )
            for i in range(max(len(v), len(s), len(u)))
        ]
    return value


def load_plan(document):
    """Validate Terraform JSON format major 1 and return sanitized {format_version,resources,configuration}. Resource IDs combine address and optional deposed key. Keep masked before/after and actions only; omit variables, prior state and all other potentially secret raw fields."""
    raise NotImplementedError("Implement load_plan using API.md and the stage lesson")


def classify(actions):
    """Return create,update,delete,replace,read,no-op or forget for supported exact action sequences. Both create/delete orders are replacements. Unknown sequences raise ValueError."""
    raise NotImplementedError("Implement classify using API.md and the stage lesson")


def impact_graph(plan):
    """Return {nodes,edges,unresolved}. Node is {id,address,action}; edge {from,to,reference} means from depends on to. Resolve expression references and depends_on by longest resource-address prefix, including static references to counted instances. Retain unresolved resource references; ignore var/local/path/count/each/terraform roots."""
    raise NotImplementedError(
        "Implement impact_graph using API.md and the stage lesson"
    )


def explain(plan):
    """Return schema_version=1 {graph,resources,markdown}. Markdown lists exact addresses with stable local anchors and escaped code data. Graph edges are declared dependencies, not a prediction of provider execution order or transitive downtime."""
    raise NotImplementedError("Implement explain using API.md and the stage lesson")
