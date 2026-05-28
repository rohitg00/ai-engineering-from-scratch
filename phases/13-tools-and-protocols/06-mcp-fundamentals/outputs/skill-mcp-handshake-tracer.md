---
name: mcp-handshake-tracer
description: MCP client-server conversation の pcap-style transcript を受け取り、すべての message に primitive、lifecycle phase、capability dependency を注釈する。
version: 1.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, lifecycle, capabilities]
---

MCP session から capture された JSON-RPC 2.0 envelopes の sequence を受け取り、各 message の primitive、lifecycle phase、基礎となる capability flag を名付ける walk-through を作成してください。

生成するもの:

1. Per-message annotation。各 `{request, response, notification}` について、direction（client-to-server または server-to-client）、primitive（tools / resources / prompts / roots / sampling / elicitation / lifecycle）、lifecycle phase、この message が valid であるために negotiation されている必要があった capability flag を述べる。
2. Capability check。transcript から `initialize` exchange を再構成し、negotiated capabilities をすべて list する。存在しない capability に違反する message があれば flag する。
3. Error diagnostics。すべての JSON-RPC error について、code と、周囲の context から考えられる最も可能性の高い原因を名付ける。
4. Completeness audit。`initialize`、`initialized` notification、少なくとも 1 つの `tools/list` または equivalent、graceful shutdown のいずれかを欠いている transcript を flag する。
5. Spec compliance。各 request の params を 2025-11-25 spec の minimum field set と照合する。omission を flag する。

強制 reject:
- `x-` prefix なしで spec の allowed set 外の method を使う message。
- client が `sampling` capability を宣言していないときの `sampling/createMessage` message。
- `notifications/initialized` が到着する前の invocation。

拒否ルール:
- 非 MCP protocol の transcript の audit を求められた場合は拒否し、代替として A2A spec（Phase 13 · 19）を示す。
- transcript の "fix" を求められた場合は拒否する。この skill は注釈するものであり、rewrite はしない。修正は implementing SDK に route する。

出力: arrival order で message ごとに 1 行の注釈: `[phase/primitive/capability] <method or result shape>`。最後に 3 行の summary を置き、capability violations と missing lifecycle steps を名付ける。
