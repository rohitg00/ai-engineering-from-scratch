import html
import json
from pathlib import Path
from intake import ticket
from routing import authorize, TOOLS
from handoff import begin, transition

KNOWLEDGE = {
    "billing": (
        "billing-receipts",
        "Find the invoice reference on the receipt. Include that reference when asking the billing team to review a charge.",
    ),
    "access": (
        "access-recovery",
        "Use the account recovery page to request a reset link. Support never needs your password or API key.",
    ),
    "platform": (
        "platform-status",
        "Check the service status page and record the failing request time and error code before opening an incident.",
    ),
}


def prepare_support(raw, requested_tool=None):
    clean = ticket(raw)
    session = transition(begin(clean), "classify", clean["text"])
    if session["route"] == "human":
        return {
            "ticket": clean,
            "session": transition(
                session, "escalate", "Ambiguous or unsupported topic"
            ),
            "tool": None,
            "evidence": None,
        }
    tool = requested_tool or sorted(TOOLS[session["route"]])[0]
    if not authorize(session["route"], tool):
        raise PermissionError("Selected specialist cannot use that tool")
    source_id, text = KNOWLEDGE[session["route"]]
    return {
        "ticket": clean,
        "session": session,
        "tool": tool,
        "evidence": {"source_id": source_id, "text": text},
    }


def support_ticket(raw, requested_tool=None):
    prepared = prepare_support(raw, requested_tool)
    if prepared["session"]["state"] == "escalated":
        return {**prepared, "method": "offline routing and authored support guidance"}
    session = transition(prepared["session"], "respond", prepared["evidence"]["text"])
    return {
        **prepared,
        "session": session,
        "method": "offline routing and authored support guidance",
    }


def export_support(result, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "support.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    session = result["session"]
    response = (
        session.get("response")
        or "A person must review this ticket before a reply is drafted."
    )
    evidence = result.get("evidence") or {}
    page = (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Support review</title><style>body{font:18px system-ui;max-width:800px;margin:3rem auto;padding:0 1rem}pre{white-space:pre-wrap}blockquote{border-left:3px solid #368;padding:1rem}</style><h1>Support review</h1><p>State: '
        + html.escape(session["state"])
        + " | Route: "
        + html.escape(session["route"])
        + "</p><h2>Redacted ticket</h2><pre>"
        + html.escape(result["ticket"]["text"])
        + "</pre><h2>Draft response</h2><blockquote>"
        + html.escape(response)
        + "</blockquote><p>Source: "
        + html.escape(evidence.get("source_id", "human review"))
        + "</p><p>Review before sending. No email or account changes were performed.</p></html>"
    )
    (out / "index.html").write_text(page, encoding="utf-8")
    return result
