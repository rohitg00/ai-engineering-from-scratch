---
name: parallel-inference-router
description: Reasoning workload を voting、tree-of-thought、multi-agent、Hogwild!、speculative decoding strategies の間で route する。
version: 1.0.0
phase: 10
lesson: 22
tags: [parallel-inference, hogwild, speculative-decoding, tree-of-thought, multi-agent, reasoning]
---

Reasoning workload profile (token budget per task, task parallelism characteristics, model family, deployment target, latency budget) が与えられたら、parallel-inference strategy またはその組み合わせを推奨してください。

出力するもの:

1. Task classification。Long reasoning (5k+ tokens)、medium chain-of-thought (1k-5k)、short chat (under 1k)、classification のいずれか。First-pass decision を決める軸です。
2. Parallelism axis。Within-sequence (speculative decoding) と across-sequence (voting, Hogwild!, multi-agent) を比較します。ほとんどの workloads はまず within-sequence axis から恩恵を受けます。
3. Strategy recommendation。次から選びます: speculative decoding only (100 tokens を超える任意の workload に対する safe default)、speculative + Hogwild! (parallelizable structure を持つ long reasoning)、tree-of-thought (explicit branch-and-prune problems)、multi-agent (role-specialization problems)、voting ensemble (high-stakes classification)。
4. Parameter settings。Speculative decoding では draft family (EAGLE-3 default) と `N` (Phase 10 · 15 skill)。Hogwild! では worker count N (2 to 4, rarely more)、coordination prompt template、single-node deployment confirmation。
5. Combined speedup estimate。Speculative decoding と Hogwild! を combine する場合は、multiplicative speedup を report してください (typical range: 3x spec * 1.5-2x Hogwild! = 4.5-6x)。

Hard rejects:
- 2000 tokens 未満の任意の workload に対する Hogwild!。Coordination overhead が支配します。
- Non-reasoning models 上の Hogwild! (emergent coordination がない)。
- Natural role decomposition を持たない problems に対する multi-agent framework。
- Explicit branch-and-prune logic なしの tree-of-thought (その場合 strategy は linear CoT に退化します)。
- Nodes をまたいだ Hogwild! の実行 (cross-node cache synchronization が遅すぎる)。

Refusal rules:
- Workload が experimental research の場合は、Hogwild! を production bet ではなく experiment として推奨してください。Speedups は task-dependent であり、April 2026 時点で real-world deployment は稀です。
- User が guaranteed speedup を求めた場合は拒否し、strong-guarantee property (output distribution preserved) を持つのは speculative decoding だけだと説明してください。Hogwild! は empirical です。
- User の VRAM が限られている場合は、Hogwild! N>2 を拒否してください。Cache は shared でも、各 worker は自分の activation memory を必要とします。

Output: task classification、parallelism axis、strategy、parameters、combined speedup estimate を列挙した 1 ページの recommendation。最後は "rollback trigger" paragraph で締め、最初の 100 production requests で Hogwild! が割に合わない場合に speculative decoding alone へ戻すべき specific latency または accuracy metric を挙げてください。
