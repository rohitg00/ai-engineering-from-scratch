---
name: swarm-optimizer
description: 指定された LLM または agent optimization problem に対し、PSO、ACO、genetic algorithms、gradient-based optimizers のどれを使うべきか選ぶ。Bio-inspired swarm algorithms は gradient-free で、search space が discrete だったり fitness function が black-box だったりする LLM 時代の workload に向く。
version: 1.0.0
phase: 16
lesson: 19
tags: [multi-agent, swarm-optimization, PSO, ACO, prompt-optimization, routing]
---

LLM または agent optimization problem が与えられたら、適切な optimizer を選ぶ。

作成するもの:

1. **Problem fingerprint。** Search space（continuous numeric、prompt string、model weights、routing graph）、fitness signal（automatic test、LLM judge、human rater、business KPI）、time-to-value（minutes、hours、days）。
2. **Optimizer choice。** PSO、ACO、genetic algorithm、DPO/RL、manual tuning。それぞれの default use case:
   - bounded space 上の continuous numeric → PSO
   - routing または path selection → ACO
   - discrete symbolic / programs → genetic algorithms
   - differentiable reward → DPO/RL
   - low-dimensional, fast eval → grid/random search
3. **Population sizing。** PSO/GA は 10-30、ACO は pheromone matrix size。Budget calculation: N × T × cost-per-eval。生成価値より高くつく swarm は走らせない。
4. **Fitness + quality gate。** candidate を採点する function は何か。ACO routing では、pheromone deposit を発火する quality threshold は何か。
5. **Convergence monitoring。** iteration ごとに g_best または pheromone stability を log する。divergence（catastrophic drift）と premature convergence（local optimum）を alert する。
6. **Decay / exploration tuning。** PSO inertia と cognitive/social weights。ACO pheromone decay rate と deposit amount。Trade-off: low decay → early winner に stuck、high decay → memory が残らない。
7. **Reset conditions。** eval distribution や deployment pattern が変わったら、g_best を reset するか pheromone を一時的に zero にする。stale memories は memory がないより悪い。

Hard rejects:

- fitness に human review が必要な task への swarm optimizer。cost-per-iteration が budget を圧倒する。
- 明確な budget justification なしの population size > 50。diminishing returns が支配する。
- quality gate なしの pheromone routing。fast-but-wrong agents が lock in する。
- 自然な continuous embedding を持たない discrete search spaces に PSO を使うこと。代わりに GA または simulated annealing を使う。

Refusal rules:

- clear fitness function がないものを最適化しようとしている場合、まず fitness を定義するよう推奨する。evaluator なしでは swarm optimizer は役に立たない。
- user budget が $100 未満なら、swarm ではなく manual tuning + caching を推奨する。
- distribution が daily に shift するなら、swarm optimizer ではなく online learning または bandits を推奨する。

Output: 1 ページの brief。1 文の recommendation（「Use ACO with quality-gated pheromone deposits on a 3-agent × 4-task-type routing problem. Decay 0.05, threshold 0.6, 200 warmup tasks.」）から始め、その後に上記 7 sections を続ける。最後に budget estimate と 1-week rollout plan を書く。
