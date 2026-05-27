"""Phase 13 Lesson 14 - MCP Apps (SEP-1724, 2026-01-26) ui:// resources.

visualize_timeline tool returns a ui://notes/timeline resource with inlined
HTML + SVG. The resources/read handler returns the full HTML bundle with a
CSP-sensible profile and a placeholder postMessage JSON-RPC client that calls
back to host.callTool.

Stdlib only. Run and inspect the emitted HTML.

Run: python code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable


NOTES = [
    {"id": "note-1", "title": "MCP primitives", "created": "2026-01-10"},
    {"id": "note-2", "title": "Transport",       "created": "2026-02-03"},
    {"id": "note-3", "title": "Sampling",        "created": "2026-02-15"},
    {"id": "note-4", "title": "Async Tasks",     "created": "2026-03-01"},
    {"id": "note-5", "title": "Apps ui://",     "created": "2026-04-22"},
]


TIMELINE_CSP = {
    "default-src": "'self'",
    "script-src": "'self' 'unsafe-inline'",
    "connect-src": "'self'",
    "img-src": "'self' data:",
    "style-src": "'self' 'unsafe-inline'",
}


def timeline_html(notes: list[dict]) -> str:
    """Generate a self-contained HTML timeline. SVG + inline JS only."""
    points = ""
    for i, n in enumerate(notes):
        x = 40 + i * 110
        points += f'''<g transform="translate({x},80)">
    <circle r="7" fill="#2e7d32" stroke="#1a1a1a"/>
    <text y="-14" text-anchor="middle" font-size="10">{n["created"]}</text>
    <text y="28" text-anchor="middle" font-size="11" font-weight="600">{n["title"]}</text>
    </g>'''
    return f"""<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Notes timeline</title>
<style>
 body {{ font-family: Georgia, serif; margin: 16px; }}
 h1 {{ font-size: 18px; }}
 .hint {{ color: #555; font-size: 11px; font-style: italic; }}
</style>
</head><body>
<h1>Notes timeline</h1>
<svg width="620" height="140" viewBox="0 0 620 140">
 <line x1="40" y1="80" x2="580" y2="80" stroke="#1a1a1a" stroke-width="1.5"/>
 {points}
</svg>
<p class="hint">click a node to call host.callTool("notes_open", {{id}})</p>
<script>
 // postMessage JSON-RPC client talking to the MCP host (Claude Desktop, etc.)
 let rid = 0;
 function hostCall(method, params) {{
   return new Promise(resolve => {{
     const id = ++rid;
     const handler = e => {{
       if (e.data && e.data.id === id) {{
         window.removeEventListener('message', handler);
         resolve(e.data.result);
       }}
     }};
     window.addEventListener('message', handler);
     window.parent.postMessage({{ jsonrpc: '2.0', id, method, params }}, '*');
   }});
 }}
 // host.callTool('notes_open', {{id: 'note-5'}}) would open note-5 in the host.
 // ui/initialize handshake
 window.parent.postMessage({{
   jsonrpc: '2.0', id: 0, method: 'ui/initialize',
   params: {{ theme: 'light', locale: 'en-US' }}
 }}, '*');
</script>
</body></html>
"""


def tool_visualize_timeline(args: dict) -> dict:
    return {
        "content": [
            {"type": "text", "text": "Notes timeline rendered below."},
            {"type": "ui_resource", "uri": "ui://notes/timeline"},
        ],
        "_meta": {
            "ui": {
                "resourceUri": "ui://notes/timeline",
                "csp": TIMELINE_CSP,
                "permissions": [],
            }
        },
        "isError": False,
    }


def resources_read(params: dict) -> dict:
    uri = params["uri"]
    if uri != "ui://notes/timeline":
        raise ValueError(f"unknown ui resource: {uri}")
    html = timeline_html(NOTES)
    return {
        "contents": [{
            "uri": uri,
            "mimeType": "text/html;profile=mcp-app",
            "text": html,
        }]
    }


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 14 - MCP APPS ui://")
    print("=" * 72)

    print("\n--- tools/call visualize_timeline ---")
    resp = tool_visualize_timeline({})
    print(json.dumps({k: v for k, v in resp.items() if k != "content"}, indent=2)[:400])
    for block in resp["content"]:
        kind = block["type"]
        summary = block.get("text") or block.get("uri")
        print(f"  content block [{kind}]: {summary}")

    print("\n--- resources/read ui://notes/timeline ---")
    r = resources_read({"uri": "ui://notes/timeline"})
    content = r["contents"][0]
    print(f"  mimeType: {content['mimeType']}")
    print(f"  html length: {len(content['text'])} bytes")
    print(f"  first 200 chars:\n{content['text'][:200]}")

    print("\n--- CSP applied ---")
    for k, v in TIMELINE_CSP.items():
        print(f"  {k:12s}: {v}")
    print("\n--- permissions: none requested ---")
    print("\n--- postMessage entrypoints available in the iframe ---")
    print("  host.callTool(name, args)")
    print("  host.readResource(uri)")
    print("  host.getPrompt(name, args)")
    print("  host.close()")


if __name__ == "__main__":
    demo()
