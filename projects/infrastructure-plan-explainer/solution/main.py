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
    version = document.get("format_version", "")
    if not re.fullmatch("1\\.\\d+", str(version)):
        raise ValueError("unsupported Terraform JSON format major")
    resources = []
    seen = set()
    for r in document.get("resource_changes", []):
        address = r.get("address")
        change = r.get("change")
        deposed = r.get("deposed")
        key = (
            address + ("#" + deposed if deposed else "")
            if isinstance(address, str)
            else None
        )
        if not key or key in seen or (not isinstance(change, dict)):
            raise ValueError("invalid or duplicate resource")
        seen.add(key)
        resources.append(
            {
                "id": key,
                "address": address,
                "actions": change.get("actions", []),
                "before": _masked(change.get("before"), change.get("before_sensitive")),
                "after": _masked(
                    change.get("after"),
                    change.get("after_sensitive"),
                    change.get("after_unknown"),
                ),
            }
        )
    config = []

    def refs(value):
        result = []
        if isinstance(value, dict):
            for k, v in value.items():
                if k == "references" and isinstance(v, list):
                    result.extend((x for x in v if isinstance(x, str)))
                else:
                    result.extend(refs(v))
        elif isinstance(value, list):
            for v in value:
                result.extend(refs(v))
        return result

    def walk(module, prefix=""):
        for r in module.get("resources", []):
            address = r.get("address", "")
            absolute = address if address.startswith(prefix) else prefix + address
            config.append(
                {
                    "address": absolute,
                    "references": sorted(
                        set(refs(r.get("expressions", {})) + r.get("depends_on", []))
                    ),
                    "module": prefix,
                }
            )
        for name, call in module.get("module_calls", {}).items():
            walk(call.get("module", {}), prefix + "module." + name + ".")

    walk(document.get("configuration", {}).get("root_module", {}))
    return {"format_version": version, "resources": resources, "configuration": config}


def classify(actions):
    """Return create,update,delete,replace,read,no-op or forget for supported exact action sequences. Both create/delete orders are replacements. Unknown sequences raise ValueError."""
    known = {
        ("create",): "create",
        ("update",): "update",
        ("delete",): "delete",
        ("delete", "create"): "replace",
        ("create", "delete"): "replace",
        ("read",): "read",
        ("no-op",): "no-op",
        ("forget",): "forget",
    }
    try:
        return known[tuple(actions)]
    except (KeyError, TypeError):
        raise ValueError("unsupported action sequence") from None


def impact_graph(plan):
    """Return {nodes,edges,unresolved}. Node is {id,address,action}; edge {from,to,reference} means from depends on to. Resolve expression references and depends_on by longest resource-address prefix, including static references to counted instances. Retain unresolved resource references; ignore var/local/path/count/each/terraform roots."""
    nodes = [
        {"id": r["id"], "address": r["address"], "action": classify(r["actions"])}
        for r in plan["resources"]
    ]
    edges = []
    unresolved = []
    strip = lambda s: re.sub("\\[[^\\]]*\\]", "", s)
    for config in plan["configuration"]:
        sources = [n for n in nodes if strip(n["address"]) == strip(config["address"])]
        for ref in config["references"]:
            if ref.split(".")[0] in (
                "var",
                "local",
                "path",
                "count",
                "each",
                "terraform",
                "self",
            ):
                continue
            qualified = (
                config["module"] + ref
                if config["module"] and (not ref.startswith(config["module"]))
                else ref
            )
            targets = [
                n
                for n in nodes
                if qualified == n["address"]
                or qualified.startswith(n["address"] + ".")
                or strip(qualified) == strip(n["address"])
                or strip(qualified).startswith(strip(n["address"]) + ".")
            ]
            if targets:
                best = max((len(strip(n["address"])) for n in targets))
                targets = [n for n in targets if len(strip(n["address"])) == best]
                for s in sources:
                    for t in targets:
                        if s["id"] != t["id"]:
                            edges.append(
                                {"from": s["id"], "to": t["id"], "reference": ref}
                            )
            else:
                unresolved.append({"address": config["address"], "reference": ref})
    unique = {json.dumps(e, sort_keys=True): e for e in edges}
    return {"nodes": nodes, "edges": list(unique.values()), "unresolved": unresolved}


def explain(plan):
    """Return schema_version=1 {graph,resources,markdown}. Markdown lists exact addresses with stable local anchors and escaped code data. Graph edges are declared dependencies, not a prediction of provider execution order or transitive downtime."""
    graph = impact_graph(plan)
    lines = [
        "# Infrastructure plan review",
        "",
        f"Format {plan['format_version']}. Saved-plan explanation only.",
        "",
    ]
    resources = []
    for r, n in zip(plan["resources"], graph["nodes"]):
        anchor = "resource-" + hashlib.sha256(r["id"].encode()).hexdigest()[:12]
        resources.append({**r, "action": n["action"], "anchor": anchor})
        label = r["id"].replace("`", "\\`").replace("\n", " ")
        lines.extend(
            [
                f'<a id="{anchor}"></a>',
                f"## `{label}`",
                f"Action: **{n['action']}**",
                "",
                "```json",
                json.dumps(
                    {"before": r["before"], "after": r["after"]}, indent=2
                ).replace("```", "\\u0060\\u0060\\u0060"),
                "```",
                "",
            ]
        )
    lines.extend(
        ["## Declared dependencies", ""]
        + [
            f"- `{e['from'].replace(chr(10), ' ')}` depends on `{e['to'].replace(chr(10), ' ')}`."
            for e in graph["edges"]
        ]
    )
    return {
        "schema_version": 1,
        "graph": graph,
        "resources": resources,
        "markdown": "\n".join(lines),
    }
