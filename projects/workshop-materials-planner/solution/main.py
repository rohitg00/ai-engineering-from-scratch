import math, csv, io, copy
from decimal import Decimal, InvalidOperation


def _number(value):
    try:
        n = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("quantity must be numeric") from None
    if not n.is_finite() or n < 0:
        raise ValueError("quantity must be finite and nonnegative")
    return n


def _factor(source, target, conversions):
    graph = {}
    for c in conversions:
        factor = _number(c["factor"])
        if not factor:
            raise ValueError("conversion factor must be positive")
        graph.setdefault(c["from"], []).append((c["to"], factor))
        graph.setdefault(c["to"], []).append((c["from"], 1 / factor))
    known = {source: Decimal(1)}
    queue = [source]
    for unit in queue:
        for other, factor in graph.get(unit, []):
            value = known[unit] * factor
            if other in known:
                if abs(known[other] - value) > Decimal("0.000000001"):
                    raise ValueError("inconsistent conversion cycle")
            else:
                known[other] = value
                queue.append(other)
    return known.get(target)


def validate(document):
    """Return a deep-copied model. participants is a nonnegative integer; materials have unique id,name,kind,quantity,unit and shared materials need positive integer share. Inventory IDs must exist. Explicit positive conversion factors map from->to. Reject inconsistent conversion cycles."""
    d = copy.deepcopy(document)
    n = d.get("participants")
    if type(n) is not int or n < 0:
        raise ValueError("participants must be a nonnegative integer")
    seen = set()
    for m in d["materials"]:
        if (
            not all(
                (isinstance(m.get(k), str) and m[k] for k in ("id", "name", "unit"))
            )
            or m["id"] in seen
            or m.get("kind") not in ("consumable", "shared")
        ):
            raise ValueError("invalid material")
        seen.add(m["id"])
        _number(m["quantity"])
        if m["kind"] == "shared" and (
            type(m.get("share")) is not int or m["share"] <= 0
        ):
            raise ValueError("sharing group must be positive")
    for r in d.get("inventory", []):
        if (
            r.get("id") not in seen
            or not isinstance(r.get("unit"), str)
            or (not r["unit"])
        ):
            raise ValueError("invalid inventory item")
        _number(r["quantity"])
    conversions = d.get("conversions", [])
    for c in conversions:
        if not all((isinstance(c.get(k), str) and c[k] for k in ("from", "to"))):
            raise ValueError("invalid conversion unit")
        _factor(c["from"], c["to"], conversions)
    return d


def scale(model, participants=None):
    """Return [{id,name,kind,unit,groups,required}] using quantity*participants for consumables and quantity*ceil(participants/share) for reusable shared equipment. required is a decimal string; zero participants requires zero of both kinds."""
    n = model["participants"] if participants is None else participants
    if type(n) is not int or n < 0:
        raise ValueError("participants must be nonnegative integer")
    rows = []
    for m in model["materials"]:
        groups = n if m["kind"] == "consumable" else math.ceil(n / m["share"])
        rows.append(
            {k: m[k] for k in ("id", "name", "kind", "unit")}
            | {"groups": groups, "required": str(_number(m["quantity"]) * groups)}
        )
    return rows


def shortages(model, participants=None):
    """Return scaled rows plus available,shortage (decimal strings or None) and unresolved inventory entries. Sum compatible inventory through explicit reciprocal conversion paths. Any unconvertible inventory for an item leaves availability and shortage unknown; never silently infer density or package size."""
    rows = scale(model, participants)
    for r in rows:
        total = Decimal(0)
        unresolved = []
        for item in model.get("inventory", []):
            if item["id"] != r["id"]:
                continue
            factor = _factor(item["unit"], r["unit"], model.get("conversions", []))
            if factor is None:
                unresolved.append(item)
            else:
                total += _number(item["quantity"]) * factor
        r.update(
            available=None if unresolved else str(total),
            shortage=None
            if unresolved
            else str(max(Decimal(0), _number(r["required"]) - total)),
            unresolved=unresolved,
        )
    return rows


def export_plan(model, counts):
    """Return schema_version=1 {participants,packing,scenarios,csv,uncertain_items}. counts is a unique list of nonnegative integers for comparison. CSV contains id,name,required,available,shortage,unit,status; unknown quantities are blank with status=review."""
    if len(set(counts)) != len(counts):
        raise ValueError("duplicate scenario count")
    packing = shortages(model)
    scenarios = [{"participants": n, "packing": shortages(model, n)} for n in counts]
    buf = io.StringIO(newline="")
    keys = ["id", "name", "required", "available", "shortage", "unit", "status"]
    w = csv.DictWriter(buf, fieldnames=keys)
    w.writeheader()
    for row in packing:
        w.writerow(
            {k: row[k] for k in keys if k != "status"}
            | {"status": "review" if row["unresolved"] else "known"}
        )
    return {
        "schema_version": 1,
        "participants": model["participants"],
        "packing": packing,
        "scenarios": scenarios,
        "csv": buf.getvalue(),
        "uncertain_items": [r["id"] for r in packing if r["unresolved"]],
    }
