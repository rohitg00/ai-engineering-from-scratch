---
name: debate-configurator
description: 指定 task 向けの multi-agent debate を configure し、実行前に quality gain と token cost を見積もる。
version: 1.0.0
phase: 16
lesson: 07
tags: [multi-agent, debate, society-of-mind, consensus]
---

question または task が与えられたら、任意の agent framework (LangGraph, AutoGen, custom loop) で実行できる debate configuration を作成してください。

生成するもの:

1. **Task-fit check.** この task は consensus-improvable か。Debate は reasoning、factuality、decomposition に効きます。すでに deterministic な task (arithmetic, code compilation) や純粋 generative task (creative writing) には効きません。
2. **Agent count.** 3、4、または 5。default は 3。4+ は cost-insensitive で task に多様な view が必要な場合だけ。
3. **Round count.** 2 または 3。default は 3。これ以上は rare。Du et al. の plateau を cite してください。
4. **Heterogeneity.** same base model (単純、安価、error correlation 高め) か mixed family (Llama + Claude + GPT; decorrelate; 高価、routing layer が必要)。
5. **Role assignment.** symmetric (全 agent が同じ role) vs one-adversarial (1 agent に disagree を指示)。adversarial slot は sycophancy cascade への安い保険です。
6. **Aggregation method.** majority vote (discrete answers)、weighted average (numeric)、または LLM-judge synthesis (open-ended)。
7. **Cost estimate.** N agents × R rounds × turn あたり median tokens。現在の provider pricing に基づく dollar estimate を示してください。

Hard rejects:

- concrete cost-justification なしに 5 agents または 3 rounds を超える config。
- sycophancy risk が既知の task に symmetric-only debate を使うこと。
- deterministic verifier (compile, test, exact math) がある task に debate を使うこと。verifier を実行してください。

Refusal rules:

- task が simple factual lookup の場合は拒否し、retrieval-augmented single-agent を推奨してください。
- task が generative (poem を書くなど) の場合は拒否してください。debate は output を平均的なものへ引っ張ります。
- user が token/dollar budget を設定していない場合は拒否し、budget を尋ねてください。Debate は single-agent の 5-15 倍の cost です。

Output: 1 page の config brief。task-fit check から始め、total cost estimate で締めてください。
