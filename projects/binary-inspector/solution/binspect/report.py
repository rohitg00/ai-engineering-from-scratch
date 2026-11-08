import hashlib
import html
import zlib

from .discovery import extract_strings, function_starts, score_starts
from .formats import parse_header
from .layout import sections, segments, shannon_entropy
from .linkage import chained_fixups, exports, imports, relocations
from .symbols import symbols

REPORT_SCHEMA = "binary-inspector/report/v1"
DIFF_SCHEMA = "binary-inspector/diff/v1"
REPORT_FIELDS = {
    "schema": str, "file": dict, "header": dict, "sections": list, "segments": list, "symbols": list,
    "imports": list, "exports": list, "relocations": list, "fixups": list, "strings": list,
    "function_starts": dict, "byte_map": list, "summary": dict,
}
ITEM_FIELDS = {
    "sections": ("name", "offset", "size", "file_size", "perms", "entropy"),
    "segments": ("name", "offset", "size", "file_size", "perms", "entropy"),
    "symbols": ("name", "value", "kind", "binding", "section", "defined"),
    "imports": ("name", "library", "slots"),
    "exports": ("name", "address"),
    "relocations": ("section", "offset", "type", "symbol"),
    "fixups": ("offset", "address", "kind", "raw"),
    "strings": ("offset", "text", "encoding", "section"),
    "byte_map": ("offset", "length", "region", "entropy"),
}


def _covering(items, start, end):
    best, best_overlap = None, 0
    for item in items:
        if not item["file_size"]:
            continue
        overlap = min(end, item["offset"] + item["file_size"]) - max(start, item["offset"])
        if overlap > best_overlap or (overlap == best_overlap and overlap > 0 and item["file_size"] < best["file_size"]):
            best, best_overlap = item, overlap
    return best


def byte_map(data, section_list, segment_list=(), cells=128):
    if cells < 1:
        raise ValueError("cells must be at least 1")
    cells = min(cells, len(data)) or 1
    first = min((s["offset"] for s in section_list if s["file_size"]), default=len(data))
    result = []
    for index in range(cells):
        start = index * len(data) // cells
        end = (index + 1) * len(data) // cells
        section = _covering(section_list, start, end)
        if section:
            region = section["name"]
        elif end <= first:
            region = "headers"
        else:
            segment = _covering(segment_list, start, end)
            region = segment["name"] if segment else "unmapped"
        result.append({"index": index, "offset": start, "length": end - start, "region": region,
                       "entropy": shannon_entropy(data[start:end])})
    return result


def build_report(data, name="input", truth=None, min_string=4, cells=128):
    header = parse_header(data)
    section_list = sections(data)
    segment_list = segments(data)
    symbol_list = symbols(data)
    starts = function_starts(data)
    if truth is not None:
        expected = function_starts(truth)["symbols"]
        starts["truth"] = expected
        starts["scores"] = {method: score_starts(found, expected)
                            for method, found in starts.items() if method not in ("truth", "scores")}
    fixups = chained_fixups(data)
    report = {
        "schema": REPORT_SCHEMA,
        "file": {"name": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()},
        "header": header,
        "sections": section_list,
        "segments": segment_list,
        "symbols": symbol_list,
        "imports": imports(data),
        "exports": exports(data),
        "relocations": relocations(data),
        "fixups": fixups["fixups"],
        "strings": extract_strings(data, section_list, segment_list, min_string),
        "function_starts": starts,
        "byte_map": byte_map(data, section_list, segment_list, cells),
    }
    report["summary"] = {
        "format": header["format"], "arch": header["arch"], "kind": header["kind"],
        "sections": len(section_list), "segments": len(segment_list), "symbols": len(symbol_list),
        "defined_functions": len(starts["symbols"]), "imports": len(report["imports"]),
        "exports": len(report["exports"]), "relocations": len(report["relocations"]),
        "fixups": len(report["fixups"]), "strings": len(report["strings"]),
        "recovered_starts": len(starts["recovered"]), "file_entropy": shannon_entropy(data),
    }
    return report


def validate_report(report):
    errors = []
    if not isinstance(report, dict):
        return ["report must be an object"]
    for key, kind in REPORT_FIELDS.items():
        if key not in report:
            errors.append(f"missing key {key}")
        elif not isinstance(report[key], kind):
            errors.append(f"{key} must be {kind.__name__}")
    if report.get("schema") not in (None, REPORT_SCHEMA) and isinstance(report.get("schema"), str):
        errors.append(f"schema must be {REPORT_SCHEMA}")
    for key, fields in ITEM_FIELDS.items():
        for position, item in enumerate(report.get(key) or []):
            if not isinstance(item, dict):
                errors.append(f"{key}[{position}] must be an object")
                continue
            for field in fields:
                if field not in item:
                    errors.append(f"{key}[{position}] missing {field}")
    for field in ("name", "size", "sha256"):
        if isinstance(report.get("file"), dict) and field not in report["file"]:
            errors.append(f"file missing {field}")
    for field in ("format", "arch", "kind"):
        if isinstance(report.get("header"), dict) and field not in report["header"]:
            errors.append(f"header missing {field}")
    return errors


def region_color(region):
    if region == "headers":
        return "hsl(220 10% 55%)"
    if region == "unmapped":
        return "hsl(0 0% 40%)"
    hue = zlib.crc32(region.encode()) % 360
    return f"hsl({hue} 65% 50%)"


def _hex(value):
    return "" if value is None else f"0x{value:x}"


def _table(columns, rows):
    head = "".join(f"<th>{html.escape(c)}</th>" for c in columns)
    body = "".join("<tr>" + "".join(f"<td>{html.escape(str(cell))}</td>" for cell in row) + "</tr>" for row in rows)
    if not rows:
        body = f'<tr><td colspan="{len(columns)}">none</td></tr>'
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


STYLE = """
:root{--bg:#f7f6f2;--fg:#1d1f24;--muted:#5b6170;--line:#d9d6cc;--card:#ffffff}
@media (prefers-color-scheme: dark){:root{--bg:#14161b;--fg:#e8e9ec;--muted:#a2a8b5;--line:#2c313b;--card:#1b1e25}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
.muted{color:var(--muted)}code,td{font-family:ui-monospace,Menlo,monospace;font-size:13px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.fact{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px}
.fact b{display:block;font-size:1.1rem}
.map{display:grid;grid-template-columns:repeat(32,1fr);gap:2px;background:var(--card);padding:8px;border:1px solid var(--line);border-radius:6px}
.cell{aspect-ratio:1;border-radius:2px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13px}
.swatch{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
th{position:sticky;top:0;background:var(--card)}
"""


def render_html(report):
    summary = report["summary"]
    cells = []
    regions = []
    for cell in report["byte_map"]:
        if cell["region"] not in regions:
            regions.append(cell["region"])
        opacity = 0.25 + 0.75 * cell["entropy"] / 8
        title = f"{cell['region']} @ 0x{cell['offset']:x} +{cell['length']} entropy {cell['entropy']}"
        cells.append(f'<div class="cell" title="{html.escape(title)}" '
                     f'style="background:{region_color(cell["region"])};opacity:{opacity:.2f}"></div>')
    legend = "".join(f'<span><i class="swatch" style="background:{region_color(r)}"></i>{html.escape(r)}</span>' for r in regions)
    facts = "".join(f'<div class="fact"><span class="muted">{html.escape(k)}</span><b>{html.escape(str(v))}</b></div>'
                    for k, v in summary.items())
    starts = report["function_starts"]
    score_rows = [[method, s["found"], s["true_positives"], len(s["false_positives"]), len(s["missed"]), s["precision"], s["recall"]]
                  for method, s in starts.get("scores", {}).items()]
    method_rows = [[method, len(values), " ".join(_hex(v) for v in values[:12])]
                   for method, values in starts.items() if method not in ("scores",)]
    parts = [
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
        f"<title>{html.escape(report['file']['name'])} inspection</title><style>{STYLE}</style></head><body><main>",
        f"<h1>{html.escape(report['file']['name'])}</h1>",
        f"<p class=\"muted\">{report['file']['size']} bytes, sha256 <code>{report['file']['sha256']}</code>, schema {html.escape(report['schema'])}</p>",
        f"<div class=\"facts\">{facts}</div>",
        "<h2>Byte map</h2><p class=\"muted\">One cell per file slice. Color names the region; brightness rises with Shannon entropy.</p>",
        f"<div class=\"map\">{''.join(cells)}</div><div class=\"legend\">{legend}</div>",
        "<h2>Sections</h2><div class=\"scroll\">" + _table(
            ["#", "segment", "name", "type", "addr", "offset", "size", "perms", "entropy"],
            [[s["index"], s["segment"] or "", s["name"], s["type"], _hex(s["addr"]), _hex(s["offset"]), s["size"], s["perms"], s["entropy"]]
             for s in report["sections"]]) + "</div>",
        "<h2>Segments</h2><div class=\"scroll\">" + _table(
            ["name", "addr", "size", "offset", "file size", "perms", "entropy"],
            [[s["name"], _hex(s["addr"]), s["size"], _hex(s["offset"]), s["file_size"], s["perms"], s["entropy"]]
             for s in report["segments"]]) + "</div>",
        "<h2>Function starts</h2><div class=\"scroll\">" + _table(["method", "count", "addresses"], method_rows) + "</div>",
    ]
    if score_rows:
        parts.append("<h2>Scores against the unstripped build</h2><div class=\"scroll\">" + _table(
            ["method", "found", "true", "false", "missed", "precision", "recall"], score_rows) + "</div>")
    parts += [
        "<h2>Symbols</h2><div class=\"scroll\">" + _table(
            ["name", "demangled", "value", "kind", "binding", "section", "table"],
            [[s["name"], s["demangled"] or "", _hex(s["value"]), s["kind"], s["binding"], s["section"] or "UND", s["table"]]
             for s in report["symbols"]]) + "</div>",
        "<h2>Imports</h2><div class=\"scroll\">" + _table(
            ["name", "library", "slots"],
            [[i["name"], i["library"] or "", " ".join(_hex(v) for v in i["slots"])] for i in report["imports"]]) + "</div>",
        "<h2>Exports</h2><div class=\"scroll\">" + _table(
            ["name", "address"], [[e["name"], _hex(e["address"])] for e in report["exports"]]) + "</div>",
        "<h2>Relocations</h2><div class=\"scroll\">" + _table(
            ["section", "offset", "type", "symbol", "addend"],
            [[r["section"] or "", _hex(r["offset"]), r["type"], r["symbol"] or "", "" if r["addend"] is None else r["addend"]]
             for r in report["relocations"]]) + "</div>",
        "<h2>Chained fixups</h2><div class=\"scroll\">" + _table(
            ["address", "section", "kind", "target", "raw"],
            [[_hex(f["address"]), f["section"] or "", f["kind"],
              f"{f['library']}/{f['name']}" if f["kind"] == "bind" else _hex(f["target"]), f"0x{f['raw']:016x}"]
             for f in report["fixups"]]) + "</div>",
        "<h2>Strings</h2><div class=\"scroll\">" + _table(
            ["offset", "section", "encoding", "text"],
            [[_hex(s["offset"]), s["section"] or s["segment"] or "", s["encoding"], s["text"]] for s in report["strings"]]) + "</div>",
        "</main></body></html>\n",
    ]
    return "".join(parts)


def _section_totals(report):
    totals = {}
    for section in report["sections"]:
        label = f"{section['segment']},{section['name']}" if section.get("segment") else section["name"]
        entry = totals.setdefault(label, {"size": 0, "count": 0, "entropy": section["entropy"]})
        entry["size"] += section["size"]
        entry["count"] += 1
    return totals


def _names(items):
    return {item["name"] for item in items if item["name"]}


def _defined_values(report):
    return {symbol["name"]: symbol["value"] for symbol in report["symbols"]
            if symbol["defined"] and symbol["name"] and symbol["kind"] not in ("section", "file")}


def _set_diff(old, new):
    return {"added": sorted(new - old), "removed": sorted(old - new)}


def diff_reports(old, new):
    for label, report in (("old", old), ("new", new)):
        problems = validate_report(report)
        if problems:
            raise ValueError(f"{label} report is invalid: {problems[0]}")
    before, after = _section_totals(old), _section_totals(new)
    changed = []
    for label in sorted(set(before) & set(after)):
        if before[label]["size"] != after[label]["size"]:
            changed.append({"name": label, "old_size": before[label]["size"], "new_size": after[label]["size"],
                            "delta": after[label]["size"] - before[label]["size"],
                            "old_entropy": before[label]["entropy"], "new_entropy": after[label]["entropy"]})
    old_values, new_values = _defined_values(old), _defined_values(new)
    moved = [{"name": name, "old": old_values[name], "new": new_values[name]}
             for name in sorted(set(old_values) & set(new_values)) if old_values[name] != new_values[name]]
    return {
        "schema": DIFF_SCHEMA,
        "old": {"name": old["file"]["name"], "sha256": old["file"]["sha256"], "size": old["file"]["size"]},
        "new": {"name": new["file"]["name"], "sha256": new["file"]["sha256"], "size": new["file"]["size"]},
        "identical": old["file"]["sha256"] == new["file"]["sha256"],
        "header_changes": {key: [old["header"].get(key), new["header"].get(key)]
                           for key in ("format", "arch", "kind", "entry") if old["header"].get(key) != new["header"].get(key)},
        "sections": {**_set_diff(set(before), set(after)), "changed": changed},
        "symbols": {**_set_diff(set(old_values), set(new_values)), "moved": moved},
        "imports": _set_diff(_names(old["imports"]), _names(new["imports"])),
        "exports": _set_diff(_names(old["exports"]), _names(new["exports"])),
        "strings": _set_diff({s["text"] for s in old["strings"]}, {s["text"] for s in new["strings"]}),
        "function_starts": {"old": len(old["function_starts"]["recovered"]), "new": len(new["function_starts"]["recovered"])},
    }


def render_diff_text(diff):
    lines = [f"{diff['old']['name']} -> {diff['new']['name']}"]
    if diff["identical"]:
        lines.append("identical bytes")
    for key, (before, after) in diff["header_changes"].items():
        lines.append(f"header {key}: {before} -> {after}")
    for item in diff["sections"]["changed"]:
        lines.append(f"section {item['name']}: {item['old_size']} -> {item['new_size']} ({item['delta']:+d})")
    for item in diff["symbols"]["moved"]:
        lines.append(f"symbol {item['name']}: 0x{item['old']:x} -> 0x{item['new']:x}")
    for group in ("sections", "symbols", "imports", "exports", "strings"):
        for name in diff[group]["added"]:
            lines.append(f"+ {group[:-1]} {name}")
        for name in diff[group]["removed"]:
            lines.append(f"- {group[:-1]} {name}")
    starts = diff["function_starts"]
    lines.append(f"recovered function starts: {starts['old']} -> {starts['new']}")
    return "\n".join(lines) + "\n"
