import csv, io, math, html


def parse_table(text, roles):
    """Return {rows,roles,missing}; roles requires group,value,unit strings naming CSV columns and a display unit. Rows retain raw values plus group and number (float or None for blanks). Reject duplicate headers, ragged rows, blank groups and non-finite numbers."""
    try:
        data = list(csv.reader(io.StringIO(text), strict=True))
    except csv.Error as error:
        raise ValueError("malformed CSV: " + str(error)) from error
    if not all(
        (isinstance(roles.get(k), str) and roles[k] for k in ("group", "value", "unit"))
    ):
        raise ValueError("roles and unit required")
    if (
        not data
        or len(set(data[0])) != len(data[0])
        or (not {roles["group"], roles["value"]} <= set(data[0]))
    ):
        raise ValueError("missing or duplicate columns")
    rows = []
    for cells in data[1:]:
        if len(cells) != len(data[0]):
            raise ValueError("ragged row")
        raw = dict(zip(data[0], cells))
        group = raw[roles["group"]].strip()
        v = raw[roles["value"]].strip()
        if not group:
            raise ValueError("blank group")
        number = float(v) if v else None
        if number is not None and (not math.isfinite(number)):
            raise ValueError("non-finite value")
        rows.append({"raw": raw, "group": group, "number": number})
    return {
        "rows": rows,
        "roles": dict(roles),
        "missing": sum((r["number"] is None for r in rows)),
    }


def aggregate(table, reducer="sum", periods=None, grammar="bar"):
    """Return chart spec {schema_version,grammar,reducer,unit,points,axis,source_rows,missing_values}. Reducers: sum,mean,count (nonblank values). Supplied unique periods define order and expose absent groups as null. Reject omitted observed groups. Axis always includes zero."""
    if reducer not in ("sum", "mean", "count") or grammar not in ("bar", "line"):
        raise ValueError("unknown chart operation")
    groups = {}
    for r in table["rows"]:
        groups.setdefault(r["group"], []).append(r["number"])
    order = list(periods) if periods is not None else sorted(groups)
    if len(set(order)) != len(order) or not set(groups) <= set(order):
        raise ValueError("periods omit data or duplicate a group")
    points = []
    for group in order:
        raw = groups.get(group, [])
        valid = [v for v in raw if v is not None]
        if valid:
            if reducer == "count":
                value = len(valid)
            else:
                value = sum(valid) if reducer == "sum" else sum(valid) / len(valid)
        else:
            value = None
        points.append(
            {
                "group": group,
                "value": value,
                "observed": len(raw),
                "missing": len(raw) - len(valid),
            }
        )
    values = [p["value"] for p in points if p["value"] is not None]
    low = min([0] + values)
    high = max([0] + values)
    return {
        "schema_version": 1,
        "grammar": grammar,
        "reducer": reducer,
        "unit": "records" if reducer == "count" else table["roles"]["unit"],
        "points": points,
        "axis": {"min": low, "max": high if high > low else low + 1},
        "source_rows": len(table["rows"]),
        "missing_values": table["missing"],
    }


def annotate(spec, requests):
    """Return a copied spec with annotations [{group,value,text}]. Requests {group,text} must identify a nonmissing point; generated text appends the exact plotted value and unit. Reject duplicate or unknown groups."""
    points = {p["group"]: p for p in spec["points"]}
    annotations = []
    seen = set()
    for r in requests:
        group = r["group"]
        if (
            group not in points
            or points[group]["value"] is None
            or group in seen
            or (not isinstance(r["text"], str))
        ):
            raise ValueError("annotation needs a unique plotted point")
        seen.add(group)
        v = points[group]["value"]
        annotations.append(
            {"group": group, "value": v, "text": f"{r['text']} ({v:g} {spec['unit']})"}
        )
    return {**spec, "annotations": annotations}


def render_svg(spec):
    """Render a standalone accessible SVG with title, desc, explicit zero baseline, values, unit and missing-point labels. Line charts break across missing points. All supplied text is XML-escaped; no JavaScript or external resources."""
    if spec.get("schema_version") != 1 or spec.get("grammar") not in ("bar", "line"):
        raise ValueError("invalid chart spec")
    esc = lambda x: html.escape(str(x), quote=True)
    points = spec["points"]
    lo, hi = (spec["axis"]["min"], spec["axis"]["max"])
    if (
        not math.isfinite(lo)
        or not math.isfinite(hi)
        or hi <= lo
        or (lo > 0)
        or (hi < 0)
    ):
        raise ValueError("axis must be finite and contain zero")
    width = max(640, len(points) * 95)
    height = max(430, 395 + len(spec.get("annotations", [])) * 20)
    top = 55
    bottom = 315
    step = (width - 100) / max(1, len(points))
    y = lambda v: bottom - (v - lo) / (hi - lo) * (bottom - top)
    zero = y(0)
    parts = [
        f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc"><title id="title">{esc(spec["reducer"])} by group</title><desc id="desc">Unit: {esc(spec["unit"])}. Missing values are gaps, not zeros. Axis {lo:g} to {hi:g}.</desc><rect width="100%" height="100%" fill="#fff"/><g font-family="system-ui" fill="#202837"><text x="30" y="28">{esc(spec["reducer"])} / {esc(spec["unit"])}</text><line x1="45" y1="{zero}" x2="{width - 20}" y2="{zero}" stroke="#687487"/>'''
    ]
    previous = None
    for i, p in enumerate(points):
        x = 65 + i * step + step / 2
        v = p["value"]
        parts.append(
            f'''<text x="{x}" y="345" text-anchor="middle">{esc(p["group"])}</text>'''
        )
        if v is None:
            parts.append(
                f'<text x="{x}" y="{bottom - 10}" text-anchor="middle">missing</text>'
            )
            previous = None
            continue
        if not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ValueError("invalid plotted value")
        yy = y(v)
        if spec["grammar"] == "bar":
            parts.append(
                f'<rect x="{x - step * 0.3}" y="{min(yy, zero)}" width="{step * 0.6}" height="{abs(yy - zero)}" fill="#386cb0"/>'
            )
        else:
            if previous:
                parts.append(
                    f'<line x1="{previous[0]}" y1="{previous[1]}" x2="{x}" y2="{yy}" stroke="#386cb0" stroke-width="3"/>'
                )
            parts.append(f'<circle cx="{x}" cy="{yy}" r="5" fill="#386cb0"/>')
            previous = (x, yy)
        parts.append(f'<text x="{x}" y="{yy - 9}" text-anchor="middle">{v:g}</text>')
    for i, a in enumerate(spec.get("annotations", [])):
        parts.append(
            f'''<text x="30" y="{375 + i * 20}">{esc(a["group"])}: {esc(a["text"])}</text>'''
        )
    parts.append("</g></svg>")
    return "".join(parts)
