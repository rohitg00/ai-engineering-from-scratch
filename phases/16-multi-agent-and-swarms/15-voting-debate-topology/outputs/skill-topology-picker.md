---
name: topology-picker
description: 与えられた task に対して multi-agent debate topology (star / chain / tree / graph)、agent 数 N、heterogeneity profile、round bound を選ぶ。
version: 1.0.0
phase: 16
lesson: 15
tags: [multi-agent, debate, topology, voting, self-consistency]
---

task description を受け取り、multi-agent topology と sizing を推奨する。

Produce:

1. **Task fingerprint.** research (long-horizon、open-ended)、fast-factual (closed-form answer)、stepwise-refinement (staged pipeline)、opinion (ground truth なし) のどれかを選ぶ。2つにまたがる場合は dominant shape を選ぶ。
2. **Topology.** star、chain、tree、graph。fingerprint から理由を述べる:
   - research → graph (any-to-any critique)
   - fast-factual → star (hub aggregates)
   - stepwise-refinement → chain (または divide-and-conquer なら tree)
   - opinion → 上記なし。single agent + human decision を推奨
3. **N of agents.** 3 は最安の useful ensemble。5 は一般的な sweet spot。7+ は specialty。graph topology で 5 を超えるなら coordination tax を警告する。
4. **Heterogeneity profile.** monoculture が問題になる場合 (research、reasoning)、少なくとも1 agent は異なる base model family から来る必要がある。N=5 では3つの異なる base model を優先する。
5. **Round bound.** 1 round = vote。2 rounds = 1回の refinement。3 rounds = conformity が支配する前の最大値。unbounded は禁止。
6. **Aggregation.** plurality (安い)、confidence-weighted (Lesson 14 の CP-WBFT)、geometric median (DecentLLMs)、judge-scored。cost constraint が plurality を要求しない限り、default は confidence-weighted。
7. **Escalation.** below-threshold consensus はどこに escalate するか。human、異なる base model の別 ensemble、または abstention。

Hard rejects:

- graph topology で 10+ agents を推奨すること。coordination tax が支配する。先に測定する。
- open research question に star topology を使うこと。star は any-to-any critique の利益を失う。
- 同じ base model を N 回走らせて multi-agent と呼ぶ recommendation。それは self-consistency であり、正しく label する。
- unbounded rounds。conformity に報酬を与える。debate が長くなるほど、agent は論理ではなく pressure によって同意する。

Refusal rules:

- task に ground truth がない場合 (opinion、synthesis、creative)、voting は advisory だと述べる。single agent + human decision を推奨する。
- user が複数 base model に access できない場合、monoculture ceiling を flag し、fallback として temperature variation 付き self-consistency を推奨する。
- task が simple (single factual lookup、reasoning < 100 tokens) の場合、self-consistency N=5 付き single agent を推奨する。

Output: 1ページの brief。single-sentence recommendation ("Graph topology, N=5 agents from 3 different base models, 2 rounds, confidence-weighted aggregation, escalate to human on below-threshold.") で始め、上の7 section を続ける。最後に budget estimate を書く: query ごとの expected tokens と expected latency in seconds。
