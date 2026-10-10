import html
import ipaddress
import json
import re


EMAIL = re.compile(
    r"(?<![\w.!#$%&'*+/=?^_`{|}~-])[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}(?![\w-]|\.[\w-])"
)
IPV4 = re.compile(r"(?<![\w.])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?!\w|\.\w)")


def detect(text, literals=()):
    if not isinstance(text, str) or len(text) > 1_000_000:
        raise ValueError("text must be a string of at most 1000000 characters")
    if not isinstance(literals, (list, tuple)) or len(literals) > 100:
        raise ValueError("literals must contain at most 100 strings")
    if any(
        not isinstance(value, str) or not value or len(value) > 256
        for value in literals
    ):
        raise ValueError("each literal must contain 1 to 256 characters")
    found = []

    def add(start, end, kind):
        if len(found) >= 10000:
            raise ValueError("text exceeds the 10000-match limit")
        found.append({"start": start, "end": end, "kind": kind})

    for kind, pattern in (("EMAIL", EMAIL), ("IPV4", IPV4)):
        for match in pattern.finditer(text):
            if kind == "IPV4":
                try:
                    ipaddress.IPv4Address(match.group())
                except ValueError:
                    continue
            add(match.start(), match.end(), kind)
    for literal in sorted(set(literals)):
        offset = 0
        while True:
            start = text.find(literal, offset)
            if start < 0:
                break
            add(start, start + len(literal), "LITERAL")
            offset = start + 1
    return sorted(found, key=lambda span: (span["start"], span["end"], span["kind"]))


def merge_spans(spans, text_length):
    if type(text_length) is not int or text_length < 0 or not isinstance(spans, list):
        raise ValueError("invalid span collection")
    normalized = []
    for span in spans:
        if not isinstance(span, dict) or set(span) != {"start", "end", "kind"}:
            raise ValueError("span needs start, end and kind")
        start, end, kind = span["start"], span["end"], span["kind"]
        if (
            type(start) is not int
            or type(end) is not int
            or not 0 <= start < end <= text_length
        ):
            raise ValueError("span offsets are outside the text")
        if kind not in {"EMAIL", "IPV4", "LITERAL"}:
            raise ValueError("unknown detector kind")
        normalized.append({"start": start, "end": end, "kinds": [kind]})
    result = []
    for span in sorted(normalized, key=lambda item: (item["start"], item["end"])):
        if result and span["start"] < result[-1]["end"]:
            result[-1]["end"] = max(result[-1]["end"], span["end"])
            result[-1]["kinds"] = sorted(set(result[-1]["kinds"] + span["kinds"]))
        else:
            result.append(span)
    return result


def redact(text, literals=()):
    spans = merge_spans(detect(text, literals), len(text))
    parts, cursor, receipts = [], 0, []
    for number, span in enumerate(spans, 1):
        parts.extend([text[cursor : span["start"]], "[REDACTED]"])
        receipts.append(
            {
                "index": number,
                "start": span["start"],
                "end": span["end"],
                "kinds": span["kinds"],
            }
        )
        cursor = span["end"]
    parts.append(text[cursor:])
    return {
        "text": "".join(parts),
        "spans": receipts,
        "redacted_characters": sum(s["end"] - s["start"] for s in spans),
    }


def process(records, literals=()):
    if not isinstance(records, list) or len(records) > 10000:
        raise ValueError("records must be an array with at most 10000 rows")
    detect("", literals)
    result, ledger, seen = [], [], set()
    for number, record in enumerate(records, 1):
        if not isinstance(record, dict) or set(record) != {"id", "text"}:
            raise ValueError(f"row {number}: expected only id and text")
        identity = record["id"]
        if not isinstance(identity, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{1,64}", identity
        ):
            raise ValueError(f"row {number}: use a non-sensitive alphanumeric id")
        if identity in seen:
            raise ValueError(f"row {number}: duplicate id")
        seen.add(identity)
        redacted = redact(record["text"], literals)
        result.append({"id": identity, "text": redacted["text"]})
        ledger.append(
            {
                "id": identity,
                "spans": redacted["spans"],
                "redacted_characters": redacted["redacted_characters"],
            }
        )
    return {
        "schema_version": 1,
        "records": result,
        "ledger": ledger,
        "totals": {
            "records": len(records),
            "spans": sum(len(row["spans"]) for row in ledger),
            "redacted_characters": sum(row["redacted_characters"] for row in ledger),
        },
        "scope": "ASCII email patterns, valid IPv4 addresses and exact configured literals only; review remaining text before sharing.",
    }


def render_html(report):
    rows = "".join(
        f"<tr><td>{html.escape(row['id'])}</td><td>{html.escape(row['text'])}</td></tr>"
        for row in report["records"]
    )
    ledger = html.escape(json.dumps(report["ledger"], indent=2))
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sensitive text redaction gate</title>
<style>:root{{color-scheme:light dark}}body{{font:17px system-ui;max-width:960px;margin:32px auto;padding:0 18px;line-height:1.6}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;border-bottom:1px solid #888;text-align:left;overflow-wrap:anywhere}}th:first-child,td:first-child{{min-width:4.5em;overflow-wrap:normal}}pre{{white-space:pre-wrap;overflow-wrap:anywhere}}button{{font:inherit;padding:8px}}h1{{line-height:1.2}}</style>
<h1>Sensitive text redaction gate</h1><p>{html.escape(report["scope"])}</p><p id="counts">{report["totals"]["spans"]} spans replaced across {report["totals"]["records"]} records.</p>
<table><thead><tr><th>Record</th><th>Redacted text</th></tr></thead><tbody>{rows}</tbody></table><details><summary>Inspect offset receipts</summary><pre>{ledger}</pre></details>
<p>The original text and literal dictionary are absent from this page. Record IDs are caller-supplied and must be non-sensitive.</p></html>"""
