---
name: mcp-apps-spec
description: Interactive UI resourceが必要なtool向けに、full MCP Apps contractを作る。
version: 1.0.0
phase: 13
lesson: 14
tags: [mcp, apps, ui-resources, csp, iframe-sandbox]
---

Interactive UI（timeline、form、dashboard、map、chart）で価値が出るtoolを受け取り、MCP Apps contractを作る。

Produce:

1. `ui://` URI。UI resourceのcanonical nameを1つ（例: `ui://notes/timeline`）。
2. Tool result shape。`text` preambleと`ui_resource` blockを含む`content[]`、設定済み`_meta.ui`。
3. CSP。`default-src`、`script-src`、`connect-src`、`img-src`、`style-src`の最小allowlist。必要がない限り`'unsafe-inline'`は避ける。
4. Permissions list。必要ならcamera / mic / geolocation / network。不要ならempty。
5. postMessage entry points。UIが呼ぶ`host.*` callsと、そのreturn内容。
6. Security checklist。Hostとの視覚的区別、clickjackingなし、strict connect-src、user contentをrenderする場合のHTML sanitization。

Hard rejects:
- `default-src *`を含むCSP。Wide-openなsecurity risk。
- UIが実際に使う以上の`permissions` request。Minimum privilege。
- External scriptsをloadする`ui://` resource。Bundleするか拒否する。
- Sanitizationなしでuser-controlled HTMLをrenderするUI。XSS vector。

Refusal rules:
- UIがstatic resultにすぎない場合、App scaffoldingを拒否し、text contentを返す。
- Native host widgets（progress bars、confirmation dialogs）の方が適しているtoolなら、それを勧める。
- HostがまだMCP Appsをsupportしない場合（2026-04時点のVS Code stable、Zed、Windsurf）、fallback-to-text pathをflagする。

Output: `ui://` URI、tool result JSON、CSP、permissions、postMessage entry points、security checklistを含む1ページcontract。最後に、このUIをrenderできるminimum hostを1文で示す。
