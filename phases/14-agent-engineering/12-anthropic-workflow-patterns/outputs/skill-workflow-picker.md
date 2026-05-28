---
name: workflow-picker
description: 与えられた task に対し、prompt chain、router、parallel、orchestrator-workers、evaluator-optimizer、または full agent のうち適切な最小 pattern を選び、実装を生成する。
version: 1.0.0
phase: 14
lesson: 12
tags: [anthropic, workflows, agents, patterns, minimal]
---

Task description が与えられたら、fit する最小 pattern を選び、最小の正しい implementation を生成する。

Decision tree:

1. Steps を enumerate できるか? -> **prompt chain** または **routing**。
2. Independent runs の output を aggregate する必要があるか? -> **parallelization** (sectioning または voting)。
3. Task ごとに membership が変わる specialist pool が必要か? -> **orchestrator-workers**。
4. Judge が pass するまで iterative refinement が必要か? -> **evaluator-optimizer** (Self-Refine shape)。
5. どれでもない、または step count が intermediate results に依存するか? -> **agent loop** (Lesson 01)。

生成するもの:

- Workflows: LLM + tool calls を compose する pure functions。Framework は使わない。
- Agents: Lesson 01 の ReAct loop と、task に必要な tool registry。
- Decision rationale、step count、expected token cost、observable success criterion を含む `README.md`。

Hard rejects:

- Task が 3-step prompt chain なのに framework (LangGraph, AutoGen, CrewAI) に手を伸ばすこと。Over-engineering は実際の問題を隠す。
- 3-worker orchestrator-worker を "multi-agent" と説明すること。Workers は agents ではなく LLM calls です。Clarity のため "orchestrator-workers" と呼ぶ。
- Stop condition のない evaluator-optimizer。`max_iter` と "fail-pass-through" fallback がなければ loop は無期限に回る可能性がある。

Refusal rules:

- User が「multi-agent」と求めても task が実際には router である場合、拒否して名前を変える。Multi-agent label は routing には不要な operational cost (coordination, debugging, evals) を持ち込む。
- User が open-ended research task に workflows を求める場合、拒否して turn budget 付き agent を提案する。Workflows は predictable trajectories 用。
- User が 2-step task に agent を求める場合、拒否して prompt chaining を提案する。Agents は latency と failure modes を増やす。必要なときだけ使う。

Output: pattern choice + minimal code + README。最後に、durable state が重要なら Lesson 13 (LangGraph)、handoffs と guardrails には Lesson 16 (OpenAI Agents SDK)、結局 agent を選ぶなら Lesson 01 への "what to read next" で締める。
