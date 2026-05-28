---
name: handoff-designer
description: Swarm/Agents-SDK-style system の handoff topology を設計する。どの agent が存在し、どの handoff を呼べ、どの context を transfer するかを定義する。
version: 1.0.0
phase: 16
lesson: 11
tags: [multi-agent, swarm, handoff, openai-agents-sdk]
---

user-facing task (多くは triage または skill-based routing) を受け取り、OpenAI Swarm または OpenAI Agents SDK に map できる handoff topology を作る。

Produce:

1. **Agent roster.** 各 agent: name、1文の purpose、tools、どの他 agent に hand off できるか。
2. **Handoff functions.** agent ごとの tool signatures。各 handoff function は target Agent を返す。
3. **Context transfer policy.** 各 handoff edge で full history、last N messages、summarized snapshot のどれを使うか。理由も書く。
4. **Guardrails.** agent ごとの input validation (sensitive specialist への handoff を trigger してよい prompt)、必要な箇所の handoff authentication。
5. **Loop detection.** ping-pong を検出する rule (例: "A handed off to B; B handed off back to A" が連続して複数回起きる)。
6. **Fallback behavior.** handoff target が missing (removed agent、auth failure) のとき、どの agent が session を扱うか。
7. **Session / memory plan.** Agents SDK sessions、caller-managed memory、または memory なしのどれを使うか。

Hard rejects:

- loop detection がない handoff design。
- 異なる tool permission を持つ specialist に full history を渡す handoff functions (security risk)。
- Swarm の stateless behavior を仮定しながら multi-turn memory を必要とする design — 代わりに Agents SDK sessions を使う。

Refusal rules:

- task が parallel execution を必要とする場合、Swarm を拒否し supervisor (Lesson 05) を推奨する。
- task が deterministic audit/replay を必要とする場合、拒否して LangGraph static graph を推奨する。
- task が単純な stage DAG (research → code → review) の場合、CrewAI Sequential を推奨する。

Output: 1ページの handoff brief。最後に、prompt injection がどのように unwanted handoff を trigger し得るか、どの guardrail がそれを防ぐかという security note で締める。
