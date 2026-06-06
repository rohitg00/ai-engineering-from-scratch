"""Phase 13 Lesson 10 - MCP resources and prompts in the notes server.

Extends the Lesson 07 server with:
  - resources/list, resources/read for per-note URIs
  - resources/subscribe + notifications/resources/updated
  - prompts/list, prompts/get with argument rendering
  - a dynamic notes://recent resource

Stdlib; in-process dispatch (no transport), focuses on the new messages.

Run: python code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Callable


NOTES: dict[str, dict] = {
    "note-1": {"title": "MCP primitives", "body": "tools, resources, prompts"},
    "note-2": {"title": "Transport layer", "body": "stdio and Streamable HTTP"},
    "note-3": {"title": "Sampling loop", "body": "server asks client for LLM"},
    "note-4": {"title": "Tasks", "body": "call-now fetch-later async"},
    "note-5": {"title": "Apps", "body": "ui:// interactive resources"},
}


SUBSCRIPTIONS: set[str] = set()
NOTIFICATIONS: list[dict] = []


def emit_notification(method: str, params: dict) -> None:
    NOTIFICATIONS.append({"jsonrpc": "2.0", "method": method, "params": params})


def update_note(nid: str, new_body: str) -> None:
    if nid in NOTES:
        NOTES[nid]["body"] = new_body
        if f"notes://{nid}" in SUBSCRIPTIONS:
            emit_notification("notifications/resources/updated",
                              {"uri": f"notes://{nid}"})
        if "notes://recent" in SUBSCRIPTIONS:
            emit_notification("notifications/resources/updated",
                              {"uri": "notes://recent"})


def handle_resources_list(params: dict) -> dict:
    res = [
        {"uri": f"notes://{nid}", "name": n["title"],
         "mimeType": "text/markdown", "description": n["body"][:60]}
        for nid, n in NOTES.items()
    ]
    res.append({
        "uri": "notes://recent",
        "name": "Recent notes",
        "mimeType": "application/json",
        "description": "Latest five notes (dynamic)",
    })
    return {"resources": res}


def handle_resources_read(params: dict) -> dict:
    uri = params["uri"]
    if uri == "notes://recent":
        recent = list(NOTES.items())[-5:]
        return {"contents": [{"uri": uri, "mimeType": "application/json",
                              "text": json.dumps([{"id": k, **v} for k, v in recent])}]}
    nid = uri.replace("notes://", "")
    if nid not in NOTES:
        raise ValueError(f"not found: {uri}")
    n = NOTES[nid]
    return {"contents": [{"uri": uri, "mimeType": "text/markdown",
                          "text": f"# {n['title']}\n\n{n['body']}"}]}


def handle_resources_subscribe(params: dict) -> dict:
    SUBSCRIPTIONS.add(params["uri"])
    return {}


def handle_resources_unsubscribe(params: dict) -> dict:
    SUBSCRIPTIONS.discard(params["uri"])
    return {}


PROMPTS = [
    {
        "name": "review_note",
        "description": "Produce a critique of a note with concrete improvements.",
        "arguments": [
            {"name": "note_id", "description": "Id of the note to review", "required": True},
            {"name": "style", "description": "'concise' or 'thorough'", "required": False},
        ],
    },
    {
        "name": "summarize_tag",
        "description": "Write a one-paragraph summary of all notes with a given tag.",
        "arguments": [
            {"name": "tag", "description": "Tag to aggregate", "required": True},
        ],
    },
]


def handle_prompts_list(params: dict) -> dict:
    return {"prompts": PROMPTS}


def handle_prompts_get(params: dict) -> dict:
    name = params["name"]
    args = params.get("arguments", {})
    if name == "review_note":
        nid = args.get("note_id", "")
        style = args.get("style", "thorough")
        note = NOTES.get(nid, {"title": "?", "body": "(missing)"})
        return {
            "description": f"Review note {nid} ({style})",
            "messages": [
                {"role": "user", "content": {"type": "text",
                    "text": f"You are reviewing a note ({style} mode). Title: {note['title']}.\nBody:\n{note['body']}\n\nProduce improvements."}},
            ],
        }
    if name == "summarize_tag":
        tag = args.get("tag", "")
        return {
            "description": f"Summarize notes tagged {tag!r}",
            "messages": [
                {"role": "user", "content": {"type": "text",
                    "text": f"Summarize the notes tagged {tag!r} in one paragraph."}},
            ],
        }
    raise ValueError(f"unknown prompt: {name}")


HANDLERS: dict[str, Callable] = {
    "resources/list": handle_resources_list,
    "resources/read": handle_resources_read,
    "resources/subscribe": handle_resources_subscribe,
    "resources/unsubscribe": handle_resources_unsubscribe,
    "prompts/list": handle_prompts_list,
    "prompts/get": handle_prompts_get,
}


def dispatch(method: str, params: dict) -> dict:
    if method not in HANDLERS:
        raise ValueError(f"unknown method: {method}")
    return HANDLERS[method](params)


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 10 - RESOURCES AND PROMPTS")
    print("=" * 72)

    print("\n1) resources/list")
    r = dispatch("resources/list", {})
    for item in r["resources"][:3]:
        print(f"  {item['uri']:22s}  {item['name']}")

    print("\n2) resources/read notes://note-1")
    r = dispatch("resources/read", {"uri": "notes://note-1"})
    print(f"  mimeType: {r['contents'][0]['mimeType']}")
    print(f"  body: {r['contents'][0]['text'][:60]}...")

    print("\n3) resources/read notes://recent (dynamic)")
    r = dispatch("resources/read", {"uri": "notes://recent"})
    print(f"  count: {len(json.loads(r['contents'][0]['text']))}")

    print("\n4) subscribe to note-1 and update")
    dispatch("resources/subscribe", {"uri": "notes://note-1"})
    print(f"  subscriptions: {list(SUBSCRIPTIONS)}")
    update_note("note-1", "UPDATED body content")
    print(f"  notifications emitted: {len(NOTIFICATIONS)}")
    print(f"  last = {NOTIFICATIONS[-1]}")

    print("\n5) prompts/list")
    r = dispatch("prompts/list", {})
    for p in r["prompts"]:
        print(f"  /{p['name']:15s}  args={[a['name'] for a in p['arguments']]}")

    print("\n6) prompts/get review_note note_id=note-1 style=concise")
    r = dispatch("prompts/get", {"name": "review_note",
                                 "arguments": {"note_id": "note-1", "style": "concise"}})
    print(f"  description: {r['description']}")
    print(f"  user msg: {r['messages'][0]['content']['text'][:80]}...")

    print("\n--- decision rule recap ---")
    print("  tool      -> user wants to search / filter / mutate")
    print("  resource  -> user wants to include data as context")
    print("  prompt    -> user wants a re-runnable multi-step workflow")


def main() -> None:
    demo()


if __name__ == "__main__":
    main()
