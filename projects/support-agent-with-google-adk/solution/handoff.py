"""Record allowed handoff state transitions.

Lesson: projects/support-agent-with-google-adk/stages/03-handoff/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from routing import route


def begin(ticket):
    return {
        "ticket_id": ticket["id"],
        "state": "received",
        "route": None,
        "history": [],
    }


def transition(session, event, payload=None):
    allowed = {
        "received": {"classify": "routed"},
        "routed": {"respond": "answered", "escalate": "escalated"},
        "answered": {},
        "escalated": {},
    }
    if event not in allowed.get(session["state"], {}):
        raise ValueError("invalid ticket transition")
    next_state = {**session, "history": list(session["history"])}
    if event == "classify":
        next_state["route"] = route(payload or "")
    if event == "respond" and session["route"] == "human":
        raise ValueError("human route requires escalation")
    if event == "respond" and (not isinstance(payload, str) or not payload.strip()):
        raise ValueError("response text required")
    if event == "respond":
        next_state["response"] = payload.strip()
    if event == "escalate":
        next_state["escalation_reason"] = payload or "Human review required"
    next_state["state"] = allowed[session["state"]][event]
    next_state["history"].append({"event": event, "state": next_state["state"]})
    return next_state
