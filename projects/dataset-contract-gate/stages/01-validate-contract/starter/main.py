import html
import json


def validate_contract(contract):
    raise NotImplementedError("Stage 1: implement validate_contract")


def row_issues(row, contract):
    raise NotImplementedError("Stage 2: implement row_issues")


def duplicate_rows(rows, contract):
    raise NotImplementedError("Stage 3: implement duplicate_rows")


def evaluate(rows, contract):
    raise NotImplementedError("Stage 4: implement evaluate")


def render_html(report):
    rows = "".join(
        f"<tr><td>{row['row_number']}</td><td>{html.escape(json.dumps(row['issues']))}</td></tr>"
        for row in report["quarantine"]
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dataset contract gate</title>
<style>:root{{color-scheme:light dark}}body{{font:17px system-ui;max-width:900px;margin:32px auto;padding:0 18px;line-height:1.6}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;border-bottom:1px solid #888;text-align:left;overflow-wrap:anywhere}}pre{{white-space:pre-wrap}}h1{{line-height:1.2}}</style>
<h1>Dataset contract gate</h1><p id="decision">Gate: {"PASS" if report["passed"] else "FAIL"}</p><p>{report["counts"]["accepted"]} accepted; {report["counts"]["quarantined"]} quarantined.</p><p>Dataset checks: {html.escape(", ".join(report["dataset_issues"]) or "pass")}</p>
<table><thead><tr><th>Source line</th><th>Reasons</th></tr></thead><tbody>{rows}</tbody></table><details><summary>Inspect duplicate groups</summary><pre>{html.escape(json.dumps(report["duplicates"], indent=2))}</pre></details>
<p>All members of a duplicate group are quarantined. Clean rows remain exportable even when a whole-dataset row-count rule fails; consult receipt.json before ingestion.</p></html>"""
