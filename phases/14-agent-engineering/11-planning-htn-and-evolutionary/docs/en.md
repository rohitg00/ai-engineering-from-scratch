# Planning with HTN and Evolutionary Search

> Symbolic planning は plan が provably correct であるべき case を扱います。Evolutionary code search は fitness function が machine-checkable な case を扱います。ChatHTN (2025) と AlphaEvolve (2025) は、LLM と組み合わせたときにそれぞれ何が unlock されるかを示しています。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**所要時間:** 約75分

## Learning Objectives

- Hierarchical Task Networks を説明する: tasks、methods、operators、preconditions、effects。
- ChatHTN の hybrid loop — symbolic search と LLM fallback decomposition — を説明する。
- AlphaEvolve の evolutionary loop と、programmatic evaluator がある場合にしか機能しない理由を説明する。
- Toy HTN planner と toy evolutionary search を stdlib で実装する。

## 問題

ReWOO (Lesson 02)、Plan-and-Execute、ReAct は多くの agent planning を cover します。ただし 2 つの case はうまく cover しません。

1. **Plans with provable correctness.** Scheduling、flight pathing、compliance workflows では、plan は construction によって sound でなければなりません。ときどき step を hallucinate する fluent LLM plan は受け入れられません。
2. **Optimizations with a machine-checkable fitness function.** Matrix multiplication、scheduling heuristics、compiler passes では、goal は「correct plan」ではなく「best plan」です。

HTN planning と AlphaEvolve は 2 つの別問題を解きます。どちらも LLM を replacement ではなく amplifier として使います。

## The Concept

### Hierarchical Task Networks

HTN は次から成ります。

- **Tasks** — compound (decompose されるもの) と primitive (直接実行可能なもの)。
- **Methods** — compound task を subtasks に decompose する方法。Preconditions を持つ。
- **Operators** — preconditions と effects を持つ primitive actions。
- **State** — facts の集合。

Planning: goal task と initial state が与えられたら、preconditions が順に満たされる primitive operators への decomposition を見つける。

HTN は LLM より古い技術であり、provably-correct plans の reference であり続けています。

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) は symbolic HTN と LLM query を interleave します。

1. 既存 methods で current compound task を decompose しようとする。
2. 適用可能な method がない場合、LLM に「state `s` において `task` をどう decompose するか」と尋ねる。
3. LLM response を candidate subtasks に translate する。
4. Operator schema に対して validate し、invalid decompositions を reject する。
5. Recurse する。

Paper の central claim: 生成される plan はすべて provably sound です。LLM suggestions は candidate decompositions としてだけ入り、direct plan edits にはなりません。Symbolic layer が correctness を所有し、LLM は method library を拡張します。

Online method learning (OpenReview `gwYEDY9j2x`, 2025 follow-up) は、LLM-produced decompositions を regression で一般化する learner を追加し、LLM query frequency を最大 75% 削減します。

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, June 2025) は別物です。Gemini 2.0 Flash/Pro ensemble によって orchestration される evolutionary code search です。

Loop:

1. Seed program + programmatic evaluator (fitness score を返す) から始める。
2. LLM ensemble が mutations を propose する。
3. Mutations を evaluator に通す。
4. Best を残し、再度 mutate する。

Published wins:

- 4x4 complex matrix multiplication で 56 年ぶりに Strassen を上回る改善 (48 scalar multiplications)。
- Borg scheduling heuristic により Google compute の 0.7% を回収。
- Frontier workload 上の FlashAttention を 32% speedup。

Hard constraint: fitness function は machine-checkable でなければなりません。Prose answer 上の evolutionary search は converge しません。

### When to use which

| Problem class | Use | Why |
|---------------|-----|-----|
| Hard constraints 付き scheduling | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Tests 付き code improvement | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Where this pattern goes wrong

- **HTN without operators.** Precondition/effect schema がなければ soundness claim は崩れます。ChatHTN の「LLM が decomposition を提案する」形では、schema が invalid moves を reject しなければなりません。
- **AlphaEvolve without a real evaluator.** 「code が良くなったか LLM に聞く」は fitness function ではありません。Evaluator は deterministic かつ fast でなければなりません。
- **Over-engineering.** ほとんどの agent tasks はどちらも必要としません。まず ReAct または ReWOO を使います。

## 実装

`code/main.py` は 2 つの toy を実装します。

- Operators、methods、preconditions、effects と、compound task に method が match しないときに入る `LLMFallback` を持つ stdlib HTN planner。Planner を offline で走らせるため、"LLM" は scripted decomposer です。
- Arithmetic programs 上の stdlib evolutionary search: test set 上で `|f(x) - target|` を最小化する expression を育てます。Evaluator は deterministic です。

実行:

```
python3 code/main.py
```

Trace は HTN planner が compound task を decompose し、途中で LLM fallback を使う様子と、evolutionary loop が target expression に converge する様子を示します。

## Use It

- **HTN planners** — `pyhop`, `SHOP3`、または domain-specific policy enforcement 向けに自作。
- **ChatHTN** — research code。Pattern (symbolic + LLM fallback) は任意の HTN planner にきれいに port できます。
- **AlphaEvolve** — DeepMind paper。Pattern (ensemble + evaluator) は再現可能です。OpenEvolve などの open-source forks が出始めています。
- **Agent frameworks** — first-class HTN や AlphaEvolve はまだ ship されていません。Subagent または background worker として build します。

## Ship It

`outputs/skill-hybrid-planner.md` は、LLM の role を明示的に scoped した hybrid planner scaffold (HTN または evolutionary) を生成します。

## Exercises

1. HTN planner に backtracking を追加する。Operator の postcondition が runtime で fail したとき、rollback して次の method を試す。
2. ChatHTN に LLM-method cache を追加する。LLM が state pattern `P` における task `T` を decompose したら、結果を保存する。次回はまず method library を re-check する。
3. Evolutionary search evaluator を real test suite に差し替える。20 test cases を pass する sort function を evolve し、convergence までの generations を報告する。
4. AlphaEvolve の evaluator design notes を読む。関心のある domain (SQL query optimization, test-suite minimization, deployment YAML) の evaluator を設計する。
5. Combine: HTN で compound task を subtasks に decompose し、各 subtask の primitive operator に evolutionary search を使う。どこで光り、どこで over-engineer になるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | 「Hierarchical planner」 | Operators、preconditions、effects を持つ task decomposition |
| Method | 「Decomposition rule」 | Compound task を subtasks に分解する方法 |
| Operator | 「Primitive action」 | Precondition と effect を持つ concrete step |
| ChatHTN | 「LLM + HTN」 | Method が match しないとき symbolic planner が LLM に尋ねる |
| AlphaEvolve | 「Evolutionary code search」 | Ensemble LLMs が code を mutate し deterministic evaluator が select する |
| Fitness function | 「Evaluator」 | Outputs に対する deterministic, machine-checkable score |
| Online method learning | 「Cached LLM decomposition」 | LLM plans を保存・一般化して query cost を下げる |

## 参考文献

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) — symbolic + LLM hybrid planner
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — LLM mutations を使う evolutionary code search
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — planner と simple loop の使い分け
