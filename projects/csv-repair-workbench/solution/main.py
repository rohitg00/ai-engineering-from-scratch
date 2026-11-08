import csv, io, datetime, copy, hashlib, json


def profile(text):
    """Parse CSV text into {columns, rows, profile}; profile maps each column to {missing, unique}. Reject empty/duplicate headers and ragged rows. Preserve cells exactly."""
    try:
        data = list(csv.reader(io.StringIO(text), strict=True))
    except csv.Error as error:
        raise ValueError("malformed CSV: " + str(error)) from error
    if (
        not data
        or not data[0]
        or any((not c.strip() for c in data[0]))
        or (len(set(data[0])) != len(data[0]))
    ):
        raise ValueError("unique nonempty headers required")
    cols = data[0]
    if any((len(r) != len(cols) for r in data[1:])):
        raise ValueError("ragged row")
    rows = [dict(zip(cols, r)) for r in data[1:]]
    return {
        "columns": cols,
        "rows": rows,
        "profile": {
            c: {
                "missing": sum((not r[c].strip() for r in rows)),
                "unique": len({r[c] for r in rows}),
            }
            for c in cols
        },
    }


def propose(table, aliases=None, date_columns=None):
    """Return schema_version=1 recipe with ordered trim, alias, date rules. aliases maps column to exact trimmed spelling->canonical spelling. Dates accept ISO or unambiguous DD/MM/YYYY; ambiguous dates await review."""
    aliases = aliases or {}
    date_columns = date_columns or []
    if any((c not in table["columns"] for c in [*aliases, *date_columns])):
        raise ValueError("unknown column")
    rules = []
    for c in table["columns"]:
        rules.append({"column": c, "operation": "trim"})
        if c in aliases:
            if not isinstance(aliases[c], dict) or any(
                (not isinstance(v, str) for v in aliases[c].values())
            ):
                raise ValueError("invalid alias map")
            rules.append({"column": c, "operation": "alias", "values": aliases[c]})
        if c in date_columns:
            rules.append({"column": c, "operation": "date"})
    return {"schema_version": 1, "rules": rules}


def preview(table, recipe):
    """Return {rows,changes,pending,fingerprint}; row numbers are CSV data rows starting at 1. Changes name row,column,before,after; ambiguous/invalid dates remain unchanged and appear in pending. Never mutate input."""
    if recipe.get("schema_version") != 1:
        raise ValueError("unsupported recipe")
    rows = copy.deepcopy(table["rows"])
    pending = []
    for rule in recipe["rules"]:
        col = rule.get("column")
        op = rule.get("operation")
        if col not in table["columns"] or op not in ("trim", "alias", "date"):
            raise ValueError("invalid rule")
        for n, row in enumerate(rows, 1):
            value = row[col]
            if op == "trim":
                row[col] = value.strip()
            elif op == "alias":
                row[col] = rule["values"].get(value, value)
            elif value:
                try:
                    if "/" in value:
                        a, b, y = map(int, value.split("/"))
                        if a <= 12 and b <= 12 and (a != b):
                            pending.append(
                                {
                                    "row": n,
                                    "column": col,
                                    "value": value,
                                    "reason": "ambiguous date",
                                }
                            )
                            continue
                        if a > 12:
                            parsed = datetime.date(y, b, a)
                        elif b > 12:
                            parsed = datetime.date(y, a, b)
                        else:
                            parsed = datetime.date(y, b, a)
                    else:
                        parsed = datetime.date.fromisoformat(value)
                    row[col] = parsed.isoformat()
                except (ValueError, TypeError):
                    pending.append(
                        {
                            "row": n,
                            "column": col,
                            "value": value,
                            "reason": "invalid date",
                        }
                    )
    changes = [
        {"row": n, "column": c, "before": old[c], "after": new[c]}
        for n, (old, new) in enumerate(zip(table["rows"], rows), 1)
        for c in table["columns"]
        if old[c] != new[c]
    ]
    digest = hashlib.sha256(
        json.dumps({"table": table, "recipe": recipe}, sort_keys=True).encode()
    ).hexdigest()
    return {"rows": rows, "changes": changes, "pending": pending, "fingerprint": digest}


def repair(table, recipe, decisions=None):
    """Return {csv,recipe,changes,pending,fingerprint}. Optional {fingerprint,cells:[{row,column,value}]} resolves pending cells only, rejecting stale fingerprints, duplicate edits and non-ISO replacement dates. Unresolved cells stay original."""
    result = preview(table, recipe)
    if decisions is not None:
        if decisions.get("fingerprint") != result["fingerprint"]:
            raise ValueError("stale review")
        allowed = {(p["row"], p["column"]) for p in result["pending"]}
        seen = set()
        for d in decisions.get("cells", []):
            key = (d["row"], d["column"])
            if key not in allowed or key in seen:
                raise ValueError("invalid review cell")
            datetime.date.fromisoformat(d["value"])
            seen.add(key)
            result["rows"][d["row"] - 1][d["column"]] = d["value"]
        result["pending"] = [
            p for p in result["pending"] if (p["row"], p["column"]) not in seen
        ]
        result["changes"] = [
            {"row": n, "column": c, "before": old[c], "after": new[c]}
            for n, (old, new) in enumerate(zip(table["rows"], result["rows"]), 1)
            for c in table["columns"]
            if old[c] != new[c]
        ]
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=table["columns"])
    writer.writeheader()
    writer.writerows(result["rows"])
    return {**result, "csv": out.getvalue(), "recipe": recipe}
