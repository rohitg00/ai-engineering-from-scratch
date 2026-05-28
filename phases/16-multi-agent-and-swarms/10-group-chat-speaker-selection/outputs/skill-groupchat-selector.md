---
name: groupchat-selector
description: task 向けに AutoGen/AG2-style GroupChat selector を設定し、selector variant、termination、anti-hot-speaker rule を定義する。
version: 1.0.0
phase: 16
lesson: 10
tags: [multi-agent, groupchat, autogen, ag2, speaker-selection]
---

task と agent roster を受け取り、GroupChat configuration を作る。selector choice、selector input、termination rule、guardrail を含める。

Produce:

1. **Selector variant.** round-robin (安い、公平、context-blind)、LLM-selected (context-aware、高価)、custom (LLM + rule-based fallback)。
2. **Selector inputs.** LLM-selected なら recent N messages、agent specialties、turn counts。custom なら explicit rules。
3. **Termination rules.** max rounds、TERMINATE token、goal-reached verifier、またはその組み合わせ。
4. **Hot-speaker mitigation.** agent ごとの turn cap、selector input 内の speaker-balance score、K consecutive turns 後の forced rotation。
5. **Context bloat mitigation.** projection plan (role ごとの scoped view)、summarization checkpoints、agent ごとの context cap。
6. **Observability.** selector の input、selector の choice、turn ごとの agent latency を log する。

Hard rejects:

- selector の input/output logging がない LLM-selected config。debugging が不可能になる。
- max_rounds cap がない config。
- reasoning task に対する symmetric chats (specialization なし) — 代わりに debate (Lesson 07) を使う。

Refusal rules:

- task が既知の DAG structure を持つ場合、GroupChat を拒否し、determinism のため LangGraph static graph を推奨する。
- task が strict audit trail を必要とする場合、GroupChat を拒否し、checkpointer 付き LangGraph を推奨する。
- agent 数が 5-6 を超える場合、flat GroupChat を拒否し、nested groups または hierarchical pattern を推奨する。

Output: 1ページの GroupChat config brief。最後に cost estimate を書く (LLM-selected は turn ごとに1回の selector call が発生する)。
