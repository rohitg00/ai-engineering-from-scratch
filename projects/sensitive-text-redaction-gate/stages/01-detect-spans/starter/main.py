import html
import json


def detect(text, literals=()):
    raise NotImplementedError("Stage 1: implement detect")


def merge_spans(spans, text_length):
    raise NotImplementedError("Stage 2: implement merge_spans")


def redact(text, literals=()):
    raise NotImplementedError("Stage 3: implement redact")


def process(records, literals=()):
    raise NotImplementedError("Stage 4: implement process")


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
