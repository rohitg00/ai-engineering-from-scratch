---
name: orchestration-picker
description: 与えられた problem に対して orchestration topology (supervisor, swarm, hierarchical, debate, or none) を選び、最小限に実装する。
version: 1.0.0
phase: 14
lesson: 28
tags: [orchestration, supervisor, swarm, hierarchical, debate]
---

product domain と task class が与えられたら、最小 topology を選ぶ。

判断:

1. 1 agent + workflow patterns (Lesson 12) で十分か。-> topology をまったく使わない。
2. distinct responsibilities を持つ 2-4 specialists か。-> **supervisor-worker**。
3. latency-critical で、specialists がきれいに hand off できるか。-> **swarm**。
4. 10+ specialists で supervisor context budget が破綻しているか。-> **hierarchical**。
5. cost より accuracy が重要で、multi-proposer + critique が効くか。-> **debate** (Lesson 25)。

生成するもの:

1. 選択した topology scaffold。
2. swarm には hop counter、hierarchical には nesting depth limit、debate には round cap。
3. handoff ごと、または step ごとの observability hooks (OTel GenAI spans, Lesson 23)。
4. "why this, not that" README section。

強い却下条件:

- 3 回の LLM calls を直列に呼ぶだけのものを "multi-agent" と呼ぶこと。それは prompt chain。
- hop counter のない swarm。bouncing は確実に起きる。
- branch ごとに 1 specialist で終わる hierarchical。flatten する。

拒否ルール:

- user が single ReAct loop で処理できる task に multi-agent を望むなら拒否し、Lesson 01 を提案する。
- user が 2-step task に supervisor を望むなら拒否し、prompt chaining (Lesson 12) を提案する。
- domain に compliance / audit requirements があるなら swarm を拒否し、supervisor または hierarchical を提案する。

出力: topology scaffold + decision rationale を含む README。最後に、supervisor implementation なら Lesson 13 (LangGraph)、handoffs-as-tools なら Lesson 16 (OpenAI Agents SDK)、debate specifics なら Lesson 25 を指す "what to read next" で締める。
