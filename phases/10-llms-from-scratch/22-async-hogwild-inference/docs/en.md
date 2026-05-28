# Async and Hogwild! Inference

> Speculative decoding (Phase 10 · 15) は、1 つの sequence 内の tokens を並列化します。Multi-agent frameworks は sequence 全体をまたいで並列化しますが、voting や sub-task splitting などの明示的な coordination を強制します。Hogwild! Inference (Rodionov et al., arXiv:2504.06261) は別のことをします。同じ LLM の N 個の instances を、SHARED key-value cache に対して並列に走らせます。各 worker は、他の worker が生成した tokens を即座に見ます。現代の reasoning models、たとえば QwQ や DeepSeek-R1 は、fine-tuning なしでその shared cache を通じて self-coordinate できます。この approach は experimental ですが、spec decode と直交する inference parallelism のまったく新しい軸を開きます。このレッスンでは stdlib Python で two-worker Hogwild! simulator を実装し、shared-cache collaboration が既存 model の reasoning abilities からなぜ emerge するのかを説明します。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**所要時間:** 約60分

## Learning Objectives

- 3 つの一般的な parallel-LLM topologies (voting, sub-task, Hogwild!) を説明し、それぞれが対象とする問題を挙げられる。
- Hogwild! の core setup、つまり multiple workers、one shared KV cache、self-prompting による emergent coordination を述べられる。
- Worker count `N`、task-level parallelism `p`、coordination overhead `c` の関数として、Hogwild! の wall-time speedup を計算できる。
- Toy problem 上で two-worker Hogwild! simulator を実装し、emergent task division を観察できる。

## 問題

現代の LLMs は、長い reasoning chain を生成して難しい問題を解きます。5000 tokens の step-by-step logic は珍しくなく、深い数学問題では数万 tokens になることもあります。70B model が 35 tokens/sec で decode する場合、50k tokens は 24 分です。これでは interactive とは言えません。

Speculative decoding (Phase 10 · 15) は、1 つの sequence 内を並列化することで 3-5x speedup を得ます。それを超えると、autoregressive decoding の sequential dependency が hard ceiling になります。各 new token はすべての prior token に依存します。

自然な問いは、sequences をまたいで並列化できるか、です。同じ problem に対して同じ model の複数 copies を走らせ、協調させ、作業を分割させられるでしょうか。

Prior work には、voting ensembles (N models を走らせて majority answer を選ぶ)、tree-of-thought (reasoning paths を分岐させて再結合する)、multi-agent frameworks (各 agent に sub-task を割り当て coordinator を使う) があります。これらは特定の task domains では役立ちます。しかし、いずれも voting rules、branch-and-prune logic、agent-to-agent messaging protocols といった explicit coordination machinery を導入します。

Hogwild! Inference は異なる approach を取ります。N workers が single KV cache を共有します。各 worker は、他の worker が生成した tokens を、自分の context であるかのように即座に見ます。Workers は training や fine-tuning なしで、作業の分け方を見つけます。Modern reasoning models (QwQ, DeepSeek-R1, Claude-family reasoning mode) は shared cache を読み、"I see worker 2 already handled the base case, so I'll work on the inductive step." のように言えます。

Speedup は workload-dependent であり、April 2026 時点では experimental です。それでも、この idea は inference parallelism の新しい軸を開くため、知っておく価値があります。

## The Concept

### The setup

同じ LLM を走らせる N worker processes を初期化します。Per-worker KV caches の代わりに、ONE shared cache を維持します。Worker `i` が token `t_j` を生成すると、その token は shared cache の next position に書き込まれます。Worker `k` が次の step を取るとき、現在の cache state を読みます。そこには全 N workers がここまで生成したすべてが含まれます。

Step time では、workers が tokens の書き込みを競います。Per-worker position index はありません。Cache は 1 つの growing sequence です。順序は write arrival time によって決まります。

### Why coordination emerges

Workers は prompt を共有します。典型的には "You are one of N instances working together on this problem. Each instance reads the shared memory and can see what other instances have written. Avoid redundant work." のようなものです。Prompt と shared cache だけで十分です。Reasoning models は cache を読み、問題のどの部分がすでに試されたかに気づき、未探索の部分へ pivot します。常にではありませんが、多くの場合そうなります。

Hogwild! paper (Rodionov et al., 2025) は次のような観察を報告しています。

- Workers は plans を作り、cache を通じて他の workers に伝える。
- Workers は他の workers の reasoning errors に気づき、指摘する。
- Workers は plan が失敗したときに適応し、alternatives を提案する。
- Redundancy を確認するよう prompt されると、workers はそれを検出して pivot する。

これには fine-tuning は不要です。Emergent behavior は、model がすでに持つ reasoning capabilities から生まれます。

### The naming

Paper 名は Hogwild! SGD (Recht et al., 2011) への言及です。これは asynchronous-update optimizer です。Analogy は、SGD の asynchronous workers が shared parameter vector に書き込み、Hogwild! Inference の workers が shared KV cache に書き込む、というものです。どちらも synchronization guarantees ではなく empirical convergence に依存します。

### RoPE makes this tractable

Rotary Position Embeddings (RoPE, Su et al. 2021) は、Q と K vectors の rotation によって position information を encode します。Positions は rotations であり baked-in offsets ではないため、token の position が shift しても KV cache entry を recompute する必要がありません。Worker `i` が shared cache の position `p` に書き込むと、他の workers はその position を読むときに cached entry をそのまま使えます。Re-rotation は不要です。

Learned-position または absolute-position model では、Hogwild! は concurrent write のたびに cache invalidation を必要とします。RoPE により cache を stable に保てます。

### Wall-time math

`T_serial` を 1 worker が単独で問題を解く時間とします。`p` を task-level parallelizable fraction とします。`c` を per-step coordination overhead (extended cache を読み、何を書くか決める cost) とします。

Single-worker time: `T_serial`。
Coordination が free の場合の N-worker Hogwild! time: `T_serial * ((1 - p) + p / N)`。Classic Amdahl です。
Coordination overhead を含めると: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`。

Worker が productive であるには、`c` が per-step decode time に比べて小さくなければなりません。5k+ tokens を生成する reasoning models では、workers は hundreds of tokens の coordination overhead を払ってもなお得をする余地があります。Short chat tasks では coordination が支配的になり、Hogwild! は serial より悪くなります。

### Concrete example

Reasoning problem: 10k tokens の chain-of-thought。Problem に `p = 0.7` の parallelizable content (different proof strategies, different case analyses) があり、`c = 200` tokens の coordination overhead per worker があるとします。`N = 4` workers では次の通りです。

- Serial time: 10000 decode steps。
- Hogwild! time: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 decode steps。
- Speedup: 10000 / 5550 = 1.8x。

これは控えめです。しかし、より長い reasoning problems (50k tokens) では coordination overhead が amortize され、speedup は 2.5-3x に近づきます。Hogwild! は、multi-threaded code を自然に書ける言語における thread-level parallelism に相当する inference 手法です。

### When to reach for Hogwild!

- Task が independent sub-goals に分解できる、数千 tokens 以上の long reasoning problems。
- Step by step に考えるよう training された reasoning models。Non-reasoning models はうまく self-coordinate しません。
- Shared cache と N worker processes を保持するのに十分な VRAM がある single-node deployments。Cache は shared ですが、各 worker は自分の activation memory を持ちます。

### When not to

- Short interactive chat。Coordination overhead が支配します。
- Parallelize できない tasks (single linear proof, single compilation)。N=1 が最大です。
- Non-reasoning models。Coordination は emerge しません。
- Multi-node deployments。Shared cache には非常に高速な cross-worker synchronization が必要です。Intra-node は問題ありませんが、cross-node は latency disaster です。

### The experimental status

April 2026 時点で、Hogwild! は open-source PyTorch implementation を持つ research method です。Production adoption はまだ起きていません。Blocker は 3 つあります。

1. Concurrent processes をまたいだ shared KV cache management は non-trivial engineering です。
2. Emergent coordination は task-dependent で、benchmarks はまだ構築中です。
3. Speedups は speculative decoding がすでに提供するものに比べると控えめです。2 つは combine できますが、combined engineering はさらに 1 layer 増えます。

知っておく価値はあります。Experiment する価値もあります。まだ product を賭ける段階ではありません。

## 実装

`code/main.py` は toy Hogwild! simulator を実装します。

- 2 つの worker processes。それぞれは deterministic "LLM" で、既知の probabilities に従って token categories (work-token, observe-token, coordinate-token) のいずれかを生成します。
- 両方の workers が読み書きする shared cache (単なる tokens の list)。
- 単純な coordination logic。Worker が、他方がある category で十分な work tokens をすでに生成していることを見たら、別の category を選びます。

Simulator は fixed step budget で実行され、次を report します。

- 生成された total work-tokens。
- Total wall time (number of worker steps)。
- Single worker に対する effective speedup。
- どの worker がどの token を書いたかの trace。

### Step 1: the shared cache

両方の workers が append する list です。Real implementation では単純な locking (Python `threading.Lock`) を使いますが、ここでは counter で simulate します。

### Step 2: the worker loop

各 worker は各 step で次を行います。

- Current shared cache を読む。
- すでに存在するものに基づき、どの category の token を書くか決める。
- 1 token を書く。

### Step 3: the coordination heuristic

Category X が cache 内にすでに K tokens あり、worker の intended category が X である場合、worker は category Y に切り替えます。これは「これはすでに covered されているので、別のことをしよう」と気づく reasoning-model behavior の toy stand-in です。

### Step 4: measured speedup

N=1 worker と N=2 workers で、同じ total step budget で simulator を実行します。Work-tokens を数えます。N=2 は、coordination-driven task division によって、おおむね 1.5-1.8x 多い work-tokens を生成するはずです。

### Step 5: stress the coordination

Coordination heuristic の sensitivity を下げてください。再実行してください。Good coordination がないと、N=2 は同じ tokens を redundant に生成し、speedup が 1 未満に落ちることを観察してください。これは paper の観察と一致します。この trick は workers に self-coordinate する reasoning capacity がある場合にのみ機能します。

## Use It

April 2026 時点で、production における Hogwild! integration は research-grade です。Yandex/HSE/IST の reference implementation は PyTorch-based で、DeepSeek-R1 と QwQ models 上の single-node multi-process setups を対象にしています。

Pragmatic adoption path:

1. Reasoning-task workload を profile してください。Tokens のうち、exploratory (multiple strategies, case analyses, search) なものと linear なものの割合を測定します。
2. Exploration が支配的なら、two-worker Hogwild! experiment を実行してください。Wall-time improvement を測定します。
3. Improvement が 1.3x 未満なら、coordination-dominated regime です。Single-worker に戻してください。
4. Improvement が 1.5x を超えるなら、N=4 へ進めて再測定してください。Diminishing returns は通常 N=4-8 あたりで効きます。

Speculative decoding と combine できます。各 Hogwild! worker は独立に spec decode を使えます。2 つの speedups はおおむね multiply し、3x spec decode と 1.8x Hogwild! は naive single-worker decoding に対して effective 5.4x になります。

## Ship It

このレッスンは `outputs/skill-parallel-inference-router.md` を生成します。Reasoning workload profile (token budget, task parallelism profile, model family, deployment target) が与えられると、voting、tree-of-thought、multi-agent、Hogwild!、speculative decoding strategies のどれを使うかに route します。

## Exercises

1. Default settings で `code/main.py` を実行してください。同じ wall time で、N=2 Hogwild! configuration が N=1 baseline より多くの work-tokens を生成することを確認してください。

2. Coordination heuristic の strength を下げてください (`coordination_weight=0.1` に設定)。再実行してください。Speedup が collapse することを示してください。理由を説明してください。Workers が coordinate できないと effort が duplicate されるからです。

3. `p=0.8, c=500`、N=4 workers の 50k-token reasoning task について、期待される Hogwild! speedup を計算してください。同じことを `p=0.3, c=200`、N=4 の 1k-token chat task でも行ってください。なぜ一方は勝ち、もう一方は負けるのでしょうか。

4. Hogwild! paper の Section 4 (preliminary evaluation) を読んでください。Authors が報告する 2 つの failure modes を特定してください。より良い coordination prompt がそれぞれをどのように緩和できるか説明してください。

5. Toy の中で Hogwild! と speculative decoding を combine してください。各 worker が内部で 2-token spec-decode を使います。Multiplicative speedup を report してください。2 workers が同じ shared-cache prefix を extend したがるとき、どのような bookkeeping problem が発生しますか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | 1 つの shared KV cache を使って同じ LLM の N instances を同時に走らせること。Self-prompting によって emergent coordination が起きる |
| Shared KV cache | "The coordination medium" | 全 workers が読み書きする single growing KV buffer。Workers 間で token visibility を即時にする |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs が shared cache を読み、fine-tuning や explicit protocol なしで作業を分割できること |
| Coordination overhead (c) | "Tokens spent orienting" | Extended cache を読み、何をするか決める per-worker cost。Total decode time に比べて小さく保つ必要がある |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism。Total work のうち intrinsically sequential ではない割合 |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Positions が rotations であるため、shared cache への書き込みで prior tokens の recompute が不要になる |
| Voting ensemble | "Run N, pick the majority" | 最も単純な parallel inference topology。Classification には有用だが、long-form reasoning には弱い |
| Tree of thought | "Branch and prune" | 複数 branches を探索して prune する reasoning strategy。Explicit coordination logic を持つ |
| Multi-agent framework | "Assign sub-tasks" | 各 agent が role を持ち、coordinator が orchestrate する。Protocol overhead が大きい |

## 参考文献

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) — Hogwild! paper、QwQ と DeepSeek-R1 上の preliminary evaluation
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) — original Hogwild!、naming origin
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) — RoPE、shared-cache inference を tractable にする property
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — Hogwild! と直交する tree-of-thought reasoning strategy
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) — speculative decoding、Hogwild! と合成できる within-sequence parallelism
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) — paper の experiments に関する single source of truth
