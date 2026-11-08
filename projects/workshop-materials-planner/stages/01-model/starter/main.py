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
    raise NotImplementedError("Implement validate using API.md and the stage lesson")


def scale(model, participants=None):
    """Return [{id,name,kind,unit,groups,required}] using quantity*participants for consumables and quantity*ceil(participants/share) for reusable shared equipment. required is a decimal string; zero participants requires zero of both kinds."""
    raise NotImplementedError("Implement scale using API.md and the stage lesson")


def shortages(model, participants=None):
    """Return scaled rows plus available,shortage (decimal strings or None) and unresolved inventory entries. Sum compatible inventory through explicit reciprocal conversion paths. Any unconvertible inventory for an item leaves availability and shortage unknown; never silently infer density or package size."""
    raise NotImplementedError("Implement shortages using API.md and the stage lesson")


def export_plan(model, counts):
    """Return schema_version=1 {participants,packing,scenarios,csv,uncertain_items}. counts is a unique list of nonnegative integers for comparison. CSV contains id,name,required,available,shortage,unit,status; unknown quantities are blank with status=review."""
    raise NotImplementedError("Implement export_plan using API.md and the stage lesson")
