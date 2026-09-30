"""Audit a research report JSON payload and publish inspectable claim evidence."""

import argparse, html, json
from pathlib import Path
from metrics import score_report


def audit_payload(payload):
    if payload.get("schema_version") != 1:
        raise ValueError("report schema_version1 required")
    snippets = payload.get("snippets", {})
    documents = {d["id"]: d for d in payload.get("documents", [])}
    for key, s in snippets.items():
        doc = documents.get(s["doc_id"])
        if (
            doc is None
            or not all(
                isinstance(s[field], int) and not isinstance(s[field], bool)
                for field in ("start", "end")
            )
            or not 0 <= s["start"] <= s["end"] <= len(doc["text"])
            or doc["text"][s["start"] : s["end"]] != s["text"]
        ):
            raise ValueError("changed or missing source span: " + key)
    text = "\n".join(
        sentence["text"].rstrip(".!?")
        + " "
        + "".join("[" + c + "]" for c in sentence["cites"])
        + "."
        for section in payload["sections"]
        for sentence in section["sentences"]
    )
    return with_evidence(
        score_report(text, {key: s["text"] for key, s in snippets.items()}),
        {key: s["text"] for key, s in snippets.items()},
    )


def with_evidence(result, evidence):
    return {
        "schema_version": 1,
        **result,
        "verdicts": [
            {
                **v,
                "evidence": [
                    {"id": key, "text": evidence.get(key, "Missing source")}
                    for key in v["cites"]
                ],
            }
            for v in result["verdicts"]
        ],
    }


def render(result):
    rows = "".join(
        '<tr data-supported="'
        + str(v["supported"]).lower()
        + '"><td>'
        + html.escape(v["claim"])
        + "</td><td>"
        + "".join(
            "<details><summary>"
            + html.escape(e["id"])
            + "</summary><blockquote>"
            + html.escape(e["text"])
            + "</blockquote></details>"
            for e in v.get("evidence", [])
        )
        + "</td><td>"
        + html.escape(v["reason"])
        + "</td></tr>"
        for v in result["verdicts"]
    )
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Evidence audit</title>'
        "<style>body{max-width:1000px;margin:32px auto;padding:16px;font:17px/1.6 system-ui;color:#202020;background:#fafaf5}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #aaa;text-align:left;vertical-align:top;overflow-wrap:anywhere}blockquote{margin:8px 0}details{max-width:400px}label{display:block;margin:20px 0}@media(prefers-color-scheme:dark){body{background:#191919;color:#eee}}</style>"
        "<h1>Evidence audit</h1><p>Lexical checks identify review candidates; they do not establish truth.</p><p>State: "
        + html.escape(result["state"])
        + ". Claims: "
        + str(result["claims"])
        + ". Unavailable labels: "
        + html.escape(", ".join(result["unavailable"]))
        + "</p>"
        '<label><input id="review" type="checkbox"> Show only claims requiring review</label><table><tr><th>Claim</th><th>Expand cited evidence</th><th>Check</th></tr>'
        + rows
        + "</table>"
        '<script>document.getElementById("review").addEventListener("change",function(){document.querySelectorAll("tr[data-supported]").forEach(row=>{row.hidden=this.checked&&row.dataset.supported==="true"})});</script></html>'
    )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input")
    p.add_argument("--research-payload", action="store_true")
    p.add_argument("--out")
    p.add_argument("--html")
    a = p.parse_args()
    data = json.loads(Path(a.input).read_text())
    result = (
        audit_payload(data)
        if a.research_payload
        else with_evidence(
            score_report(
                data["text"],
                data["evidence"],
                data.get("expected_sources", []),
                data.get("facts", []),
            ),
            data["evidence"],
        )
    )
    text = json.dumps(result, indent=2)
    if a.out:
        Path(a.out).write_text(text + "\n")
    if a.html:
        Path(a.html).write_text(render(result))
    print(text)


if __name__ == "__main__":
    main()
