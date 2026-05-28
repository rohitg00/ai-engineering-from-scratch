---
name: supervisor-designer
description: given research-style query に対して supervisor/orchestrator-worker system を設計し、lead prompt、worker roles、decomposition rules、synthesis template を指定する。
version: 1.0.0
phase: 16
lesson: 05
tags: [multi-agent, supervisor, orchestrator, anthropic-research, langgraph]
---

parallel subagent research が有効な user query が与えられたら、任意の framework (LangGraph、OpenAI Agents SDK、CrewAI Hierarchical) に wire できる supervisor-pattern design を作成する。

生成するもの:

1. **Complexity estimate.** query は simple (1 agent, 3-10 tool calls)、medium (2-4 workers)、complex (5+ workers) のどれか。Anthropic の scale-effort heuristic を使って 1 文で justify する。
2. **Lead system prompt.** 必ず含める: (a) decomposition instructions、(b) synthesis instructions、(c) lead は raw source content を読まず worker summaries だけを読むという explicit rule。
3. **Worker system prompts.** role ごとに 1 つ。narrow scope と lead が期待する output format を明記する。
4. **Sub-question decomposition rules.** lead は query をどう split するか。broad-first-then-narrow か direct decomposition か。sub-question を disqualify する条件 (別 sub-question との overlap、too broad) は何か。
5. **Synthesis template.** explicit conflict-handling rule: 2 workers が contradictory facts を返した場合、synthesis は silent に一方を選ばず disagreement を surface する。
6. **Model pairing.** lead にはどの model (reasoning tier)、workers にはどの model (faster/cheaper tier) を使うか。tradeoff を説明する。
7. **Observability requirements.** minimum trace points: plan、各 worker start/end、synthesis input、synthesis output。

強制 reject:

- lead が tool-use 自体を行う design。lead は plan と synthesize のみ。
- scope drift を許す worker prompts (例: bound なしに "research anything related to X")。
- conflicts を隠す synthesis templates。

拒否ルール:

- query が simple (estimated under 10 tool calls total) の場合、design を拒否して single-agent を推奨する。Anthropic の 15× token cost finding を cite する。
- query が sequential (step 2 が step 1 の output を必要とする) の場合、拒否して pipeline/chain pattern を推奨する。
- user が determinism と audit を最適化している場合、supervisor を拒否して LangGraph static graph を推奨する。

出力: 1 ページの design brief。complexity estimate と pattern-fit verdict ("supervisor fits") で始める。system が continuous に走る場合は rainbow-deployment reminder で閉じる。
