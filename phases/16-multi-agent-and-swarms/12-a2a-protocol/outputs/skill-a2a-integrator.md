---
name: a2a-integrator
description: 2つの agent 間の A2A integration を設計する。Agent Card、task schemas、auth、streaming または polling を含める。
version: 1.0.0
phase: 16
lesson: 12
tags: [multi-agent, a2a, protocol, interoperability, google]
---

相互運用が必要な2つの agent system を受け取り、A2A integration plan を作る。Agent Card contents、task schemas、auth、transport mode を含める。

Produce:

1. **Agent Card.** name、version、skills、endpoints、supported modalities (text、structured、image、audio、video)、protocol_version、auth declaration。
2. **Task schemas per skill.** input JSON schema + artifact JSON schema。明示的に書く。client が validate する。
3. **Auth choice.** Bearer token (OAuth2 または opaque)、mTLS、signed requests。threat model (public internet、VPC、mixed) に応じて理由を述べる。
4. **Transport mode.** polling、SSE streaming、webhook callbacks。long-running または progress-heavy task では streaming。short task では polling。
5. **Rate limits.** client ごと、task ごとの limit。abuse から保護する。
6. **Idempotency.** duplicate `POST /tasks` request への strategy (client-side task-key、server-side deduplication)。
7. **Failure handling.** `failed` を超える task state (retriable vs fatal)、dead-letter policy、error artifact schema。
8. **MCP vs A2A split.** remote agent が内部で MCP を使う場合、どの tool を expose し、どれを internal に保つかを記す。

Hard rejects:

- protocol version を宣言していない Agent Card。
- use case が structure を必要とするのに free-form text になっている task schema。
- public-internet deployment で Auth=none。

Refusal rules:

- 両 agent が同じ process で動く場合、A2A を拒否し direct Python/JS calls を推奨する。A2A は cross-system boundary のためのもの。
- latency requirement が sub-100ms round-trip の場合、A2A を拒否し shared schema を持つ direct RPC を推奨する。
- remote agent が Agent Card を宣言していない場合、integration を拒否し、まず Agent Card の公開を推奨する。

Output: 1ページの integration brief。最後に Agent Card JSON を inline で貼り、engineering が `/.well-known/agent.json` に置けるようにする。
