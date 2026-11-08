import csv, io, unicodedata, re, json, hashlib


def import_catalog(text, source):
    """Parse CSV requiring nonempty unique id and title, optional creator and extra fields. Return records with source and source_id keys; preserve original fields. Reject ragged rows, duplicate headers and blank source names."""
    try:
        parsed = list(csv.reader(io.StringIO(text), strict=True))
    except csv.Error as error:
        raise ValueError("malformed CSV: " + str(error)) from error
    if (
        not source
        or not parsed
        or (not {"id", "title"} <= set(parsed[0]))
        or (len(set(parsed[0])) != len(parsed[0]))
    ):
        raise ValueError("source, id and title required")
    if {"source", "source_id"} & set(parsed[0]):
        raise ValueError("reserved column")
    seen = set()
    out = []
    for row in parsed[1:]:
        if len(row) != len(parsed[0]):
            raise ValueError("ragged row")
        r = dict(zip(parsed[0], row))
        if not r["id"].strip() or not r["title"].strip() or r["id"] in seen:
            raise ValueError("invalid or duplicate record id")
        seen.add(r["id"])
        out.append({**r, "source": source, "source_id": source + ":" + r["id"]})
    return out


def _tokens(text):
    return set(re.findall("\\w+", unicodedata.normalize("NFKC", text).casefold()))


def _score(a, b):
    x, y = (_tokens(a), _tokens(b))
    return len(x & y) / len(x | y) if x | y else 0.0


def candidates(left, right, threshold=0.25):
    """Return descending candidate pairs {left,right,score,title_score,creator_score}; title Jaccard contributes 0.8, creator Jaccard 0.2. Include scores >= threshold; use source IDs to break ties. Threshold must be finite in [0,1]."""
    if not isinstance(threshold, (int, float)) or not 0 <= threshold <= 1:
        raise ValueError("invalid threshold")
    out = []
    for a in left:
        for b in right:
            title = _score(a["title"], b["title"])
            creator = _score(a.get("creator", ""), b.get("creator", ""))
            score = 0.8 * title + 0.2 * creator
            if score >= threshold:
                out.append(
                    {
                        "left": a["source_id"],
                        "right": b["source_id"],
                        "score": round(score, 6),
                        "title_score": round(title, 6),
                        "creator_score": round(creator, 6),
                    }
                )
    return sorted(out, key=lambda p: (-p["score"], p["left"], p["right"]))


def reconcile(left, right, decisions):
    """Return merged entities with sources (complete original records), fields and unresolved conflicts. Decisions are [{left,right,match:bool,values:{field:chosen string}}]. Require one-to-one accepted links, known IDs and unique pair decisions. Unmatched records remain separate."""
    a = {r["source_id"]: r for r in left}
    b = {r["source_id"]: r for r in right}
    if set(a) & set(b):
        raise ValueError("catalog source IDs overlap")
    used_a = set()
    used_b = set()
    seen = set()
    result = []
    for d in decisions:
        x, y = (d["left"], d["right"])
        pair = (x, y)
        if (
            x not in a
            or y not in b
            or pair in seen
            or (type(d.get("match")) is not bool)
        ):
            raise ValueError("invalid decision")
        seen.add(pair)
        if not d["match"]:
            continue
        if x in used_a or y in used_b:
            raise ValueError("one-to-one match violated")
        used_a.add(x)
        used_b.add(y)
        fields = {}
        conflicts = []
        values = d.get("values", {})
        keys = (set(a[x]) | set(b[y])) - {"id", "source", "source_id"}
        if not set(values) <= keys or any(
            (not isinstance(v, str) for v in values.values())
        ):
            raise ValueError("invalid field resolution")
        for k in sorted(keys):
            av, bv = (a[x].get(k, ""), b[y].get(k, ""))
            fields[k] = values.get(k, av or bv)
            if av and bv and (av != bv) and (k not in values):
                conflicts.append({"field": k, "left": av, "right": bv})
        result.append(
            {
                "id": x + "|" + y,
                "sources": [a[x], b[y]],
                "fields": fields,
                "conflicts": conflicts,
            }
        )
    for records, used in [(left, used_a), (right, used_b)]:
        for r in records:
            if r["source_id"] not in used:
                result.append(
                    {
                        "id": r["source_id"],
                        "sources": [r],
                        "fields": {
                            k: v
                            for k, v in r.items()
                            if k not in ("id", "source", "source_id")
                        },
                        "conflicts": [],
                    }
                )
    return result


def export_catalog(left, right, review=None):
    """Return schema_version=1 {fingerprint,entities,crosswalk,ready}; crosswalk is CSV source_id,entity_id. Optional review {fingerprint,pairs:[decisions]} is bound to source records. ready means every accepted merge has resolved field conflicts, not that every candidate was reviewed."""
    fingerprint = hashlib.sha256(
        json.dumps([left, right], sort_keys=True).encode()
    ).hexdigest()
    if review is not None and review.get("fingerprint") != fingerprint:
        raise ValueError("stale review")
    entities = reconcile(left, right, (review or {}).get("pairs", []))
    buf = io.StringIO(newline="")
    w = csv.writer(buf)
    w.writerow(["source_id", "entity_id"])
    for e in entities:
        for s in e["sources"]:
            w.writerow([s["source_id"], e["id"]])
    return {
        "schema_version": 1,
        "fingerprint": fingerprint,
        "entities": entities,
        "crosswalk": buf.getvalue(),
        "ready": not any((e["conflicts"] for e in entities)),
    }
