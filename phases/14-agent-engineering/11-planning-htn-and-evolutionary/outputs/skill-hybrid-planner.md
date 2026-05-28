---
name: hybrid-planner
description: Hybrid planner を構築する。Provably-sound plans には ChatHTN、machine-checkable evaluator を持つ code search には AlphaEvolve を使い、問題に合う方を選ぶ。
version: 1.0.0
phase: 14
lesson: 11
tags: [planning, htn, chathtn, alphaevolve, evolutionary-search]
---

Problem class (policy-bound workflow vs code optimization vs open-ended task) が与えられたら、planner を選び、正しい scaffold を生成する。

Decision:

1. Problem に hard preconditions / policy / scheduling constraints があるか? -> HTN (ChatHTN)。
2. Problem に deterministic, machine-checkable fitness function があるか? -> Evolutionary (AlphaEvolve)。
3. どちらでもないか? -> 代わりに ReAct (Lesson 01) または ReWOO (Lesson 02) を使う。

HTN では、次を生成する:

1. `preconditions`, `effects_add`, `effects_remove` を持つ `Operator` type。
2. `task`, `preconditions`, `subtasks` を持つ `Method` type。
3. Methods を先に試し、LLM decomposition に fallback し、成功した LLM decompositions を cache する planner。
4. Unknown operators や methods を参照する LLM decompositions を reject する validation step。

Evolutionary では、次を生成する:

1. Candidate programs の seed population。
2. Scalar fitness を返す deterministic evaluator。
3. Mutation operator (LLM-driven または rule-based)。
4. Early stopping 付き selection loop (top-k を残し、mutate し、repeat)。

Hard rejects:

- LLM output を operator-schema validation なしで直接適用する ChatHTN。Soundness claim が壊れる。
- Evaluator が LLM judge を呼ぶ AlphaEvolve。Fitness は deterministic でなければならない。LLM judges は loop が回収できない stochastic noise を持ち込む。
- Open-ended tasks (「blog post を書く」) にどちらかの pattern を使うこと。Evaluator も preconditions もないなら ReAct を使う。

Refusal rules:

- Domain に明確な operator schema がない場合、ChatHTN を拒否する。ReWOO または plain ReAct を提案する。
- Domain に machine-checkable fitness がない場合、AlphaEvolve を拒否する。Self-Refine (Lesson 05) を提案する。
- User が「planner + LLM が final call をする」と望む場合は拒否する。Symbolic correctness と LLM exploration の分担は load-bearing。

Output: `operators.py`, `methods.py`, `planner.py` (HTN) または `evaluator.py`, `mutator.py`, `loop.py` (evolutionary)、そして decision rationale を記した `README.md`。最後に、debate-style verification が合うなら Lesson 25、実は ReWOO 形の task なら Lesson 02 への "what to read next" で締める。
