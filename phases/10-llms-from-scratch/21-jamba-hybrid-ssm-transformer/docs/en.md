# Jamba — Hybrid SSM-Transformer

> State space models (SSMs) と Transformers は、得意にしたいものが違います。Transformers は attention によって品質を稼ぎますが、計算コストは二乗で増えます。SSMs は recurrence によって線形時間の推論と定数メモリを得ますが、品質では遅れがちです。AI21 の Jamba (March 2024) と Jamba 1.5 (August 2024) は、この 2 つを同じモデルに入れました。7 個の Mamba layer ごとに 1 個の Transformer layer、1 つおきの block に MoE、そして 1 枚の 80GB GPU に収まる 256k context window です。Mamba-3 (ICLR 2026) は、複素数値の state spaces と MIMO projections によって SSM 側をさらに強化します。このレッスンでは両方の architecture を端から端まで読み、pure-SSM や pure-Transformer の long-context 試行が伸び悩む中で、hybrid recipe が 3 年間の scaling を生き残った理由を説明します。

**種別:** 学習
**言語:** Python (stdlib, layer-mix calculator)
**前提条件:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**所要時間:** 約60分

## Learning Objectives

- Jamba block の 3 つの primitive、つまり Transformer layers、Mamba layers、MoE と、1:7:even の interleaving recipe を説明できる。
- SSM の recurrence が大まかにどのような形か、そしてなぜ定数メモリ推論を可能にするのかを述べられる。
- 256k context における Jamba model の KV cache footprint を計算し、pure-Transformer model が必要とする量と比較できる。
- Mamba-3 の 3 つの innovation (exponential-trapezoidal discretization、complex-valued state update、MIMO) と、それぞれが狙う問題を挙げられる。

## 問題

Attention は sequence length に対して二乗で増えます。State space models は線形です。この違いは積み重なると大きくなります。256k tokens では、Transformer attention map は head ごとに 65B entries になります。一方、SSM の recurrent state は sequence length に関係なく固定サイズです。

Pure-SSM models (Mamba, Mamba-2) は小規模では Transformer perplexity に並びますが、state-tracking tasks では遅れ、in-context retrieval の一部カテゴリでは失敗します。直感的には、SSMs は履歴を固定 state に圧縮するため、履歴が長いと情報が漏れます。Attention はすべてを正確に覚えますが、二乗コストを払います。

明らかな修正は、両方を使うことです。正確な recall が重要な場所には Transformer layers を置きます。それ以外では SSM layers を使います。比率を調整します。Jamba は、この hybrid recipe を scale させて production-grade model として出荷した最初の例です (52B total, 12B active, 256k context, single 80GB GPU)。Jamba 1.5 は family を 398B total / 94B active まで広げます。Mamba-3 (ICLR 2026) は、hybrids を組み直す際の現在最良の pure-SSM baseline です。

このレッスンでは 3 本の paper を読み、「適切な比率を選ぶ」ための mental model を作ります。

## The Concept

### An SSM in one page

State space model は、固定サイズの state `h` を使って sequence `x_1, ..., x_N` を処理します。

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

各 step で state は linear dynamics `A` によって進み、input `B x_t` を受け取り、output `C h_t` を出します。`A, B, C` は学習できます。重要な性質は、`y_t` の計算に必要なのが `h_{t-1}` と `x_t` だけで、それ以前の `x` は不要だという点です。Memory は定数です。Inference は token あたり O(1) です。

Modeling quality のための trick は `A` の構造です。S4 (Gu 2021) は、training 中に long convolution として効率よく評価できる高度に構造化された matrix を使いました。Mamba (Gu, Dao 2023) は固定の `A, B, C` を data-dependent なものに置き換えました (これが "selective" な部分です)。Mamba-2 (2024) は構造をさらに単純化しました。Mamba-3 (2026) は、特定の場所に複雑さを戻します。

重要な性質は、decoder LLM において SSM layer は attention layer の drop-in replacement であり、増え続ける KV cache の代わりに固定サイズの per-layer state を持つことです。

### The Jamba block

Jamba block は 2 つの数値に従って layers を interleave します。

- `l`: attention-to-Mamba ratio。Jamba は `l = 8` を使います。つまり 7 Mamba layers ごとに 1 Transformer layer です (7 Mamba + 1 Attention = 8 layers per group)。
- `e`: MoE frequency。Jamba は `e = 2` を使います。つまり 1 つおきの layer に MoE を適用します。

Block 内の layer sequence は次の通りです。

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

各 Jamba block は 8 layers です。4 blocks deep (32 layers total) では、28 Mamba layers と 4 Attention layers になります。そのうち 16 layers が MoE を使います。

### Why the 1:7 ratio

AI21 は ablations を行いました。attention-to-Mamba のどの比率が、perplexity-per-parameter と long-context evals における in-context recall の両方で最良になるか、という実験です。

- Attention が多すぎる (1:1): quality は上がりますが、memory と speed が悪化します。
- Attention が少なすぎる (1:15): memory は優秀ですが、in-context retrieval が失敗します。
- Sweet spot: 1:7 または 1:8。

直感的には、Transformer layers が exact recall と state tracking を担当します。Mamba layers は安価な大量処理を担当します。

### Positional encoding

Mamba layers は recurrence によって、それ自体が position-aware です。初期の Mamba-based hybrids の attention layers は RoPE を使っていませんでした。SSM layers が position info を提供していたからです。Jamba 1.5 は、longer-context generalization のために attention layers に RoPE を追加しました。これは empirical long-context evaluation に基づく post-hoc refinement です。

### The memory budget

Jamba-1 shape (32 layers: 28 Mamba + 4 Attention, hidden 4096, 32 attention heads) では次のようになります。

- KV cache (attention layers only): 256k BF16 で `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`。4 個の attention layers だけが寄与します。
- SSM state: `28 * hidden * state_size` per token prefix ですが、これは layer ごとの固定サイズであり、sequence length には比例しません。典型的な Mamba state は feature ごとに 16、hidden 4096 なので、合計で `28 * 4096 * 16 * 2 = 3.7 MB` です。

同じ hidden、32 layers、32 heads の full MHA pure Transformer と比べると、256k BF16 で `2 * 32 * 32 * 128 * 256k * 2 = 128 GB` です。KV cache が 8x 削減されます。2024 年の多くの models が使う GQA(8) baseline (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`) と比べても、Jamba の 1:7 hybrid は 16 GB で、まだ 2x 小さいです。

これが、AI21 が言う "256k context on a single 80GB GPU" の意味です。Full-MHA pure Transformer の KV cache は収まりません。GQA baseline でさえ weights と activations の余地をほとんど残しません。Jamba なら収まります。

### Mamba-3: the pure-SSM baseline in 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) は pure-SSM 側に 3 つの innovation を導入します。

1. **Exponential-trapezoidal discretization.** Mamba-2 の Euler-method discretization を、より表現力のある recurrence に置き換えます。`x_t` に対する外側の convolution ではなく、core recurrence 内の state-input に convolution-like operation を適用します。

2. **Complex-valued state update.** 以前の Mambas は state matrix を complex (S4) から real diagonal (Mamba)、さらに scaled identity (Mamba-2) へ単純化していました。Mamba-3 は complex values を戻します。これは state に対する data-dependent rotary embedding と等価です。以前の real-valued simplifications で失われた state-tracking capabilities を回復します。

3. **Multi-input multi-output (MIMO) projections.** Per-feature scalar projections ではなく matrix-valued projections を使います。Decode latency を増やさずに modeling power と inference-time hardware utilization を改善します。

1.5B parameters では、Mamba-3 は Gated DeltaNet より downstream accuracy average を 0.6 points 改善します。MIMO variant はさらに 1.2 points を加え、合計 1.8-point gain になります。同じ state size では、Mamba-3 は Mamba-2 の半分の state で同等になります。

Mamba-3 はまだ production hybrid として scale して出荷されていません。ただし、次の Jamba-class model の SSM 側として最も自然な候補です。

### When to reach for a hybrid

Hybrids が勝つのは次のような場合です。

- Context が十分長く、pure Transformer KV cache が重くなる (64k+)。
- Tasks が short-range structure (SSM が得意) と long-range recall (Transformer が必要) を混ぜている。
- Transformer KV cache だけでは収まらない single-GPU memory budgets で deploy したい。

Hybrids が負けるのは次のような場合です。

- Context が短い (16k 未満)。SSM overhead が無駄になり、pure Transformer で十分です。
- Tasks が everywhere-to-everywhere attention を必要とする (deep reasoning, multi-document cross-reference)。Hybrid の attention layers の疎さが不利になります。
- Trillion-parameter frontier models へ scale している。現在の capability race では pure-Transformer + MLA + MoE (DeepSeek-V3 style) が勝っています。

### The competitive landscape

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

2026 年の landscape では、frontier は pure-Transformer MoE が支配していますが、256k-plus context niche は hybrids が握っています。Mamba-3 の state-tracking 改善によって、次世代では hybrid ratios がより低く (more SSM, less attention) なる可能性があります。

## Use It

`code/main.py` は hybrid architectures の memory calculator です。SSM-Transformer ratio と hidden-size / layer-count config を与えると、次を計算します。

- Target context における KV cache。
- SSM state memory。
- さまざまな model shapes について、context N での total memory。

Calculator は次をサポートします。

- Pure-Transformer baseline (KV cache は N とともに増える)。
- Jamba-style 1:7 hybrid。
- Pure-SSM (KV cache なし)。

数値は published shapes については Jamba-1 と Jamba-1.5 papers から直接取り、hypothetical variants については extrapolate しています。

実際の deployment での integration considerations:

- 多くの production inference servers (vLLM, SGLang) は Jamba と Mamba をサポートしています。具体的な version を確認してください。
- 256k context では、Jamba の memory advantage は concurrent-request throughput に現れます。同じ VRAM で Transformer sequences より多くの Jamba sequences を載せられます。
- Standalone model としての Mamba-3 はまだ production で出荷されていません。1.5B の research preview です。

## Ship It

このレッスンは `outputs/skill-hybrid-picker.md` を生成します。Workload specification (context length profile, task mix, memory budget) が与えられると、pure Transformer、Jamba-style hybrid、pure SSM のどれを選ぶべきかを、memory と quality の tradeoffs に関する明示的な理由とともに推奨します。

## Exercises

1. `code/main.py` を実行し、32-layer pure Transformer (hidden 4096, 32 heads) と同じ shape の Jamba-1 hybrid について、256k context の KV cache を計算してください。AI21 paper が主張する約 8x の memory reduction を確認してください。

2. Calculator を変更して、1:3 hybrid (4 Mamba : 1 Attention) と 1:15 hybrid (14 Mamba : 1 Attention) を model 化してください。KV cache vs ratio を plot してください。どの ratio で KV cache が SSM state memory と等しくなりますか。

3. Jamba paper (arXiv:2403.19887) の Section 3 を読んでください。Mamba-2 のほうが速いにもかかわらず、AI21 がなぜ Mamba-1 を使うのかを説明してください。Hint: hybrid ablation section に記録されています。

4. Jamba 1.5 Large (398B total, 94B active) において、MoE-every-other-layer の parameter overhead を計算してください。Active ratio を DeepSeek-V3 (37B/671B) と比較し、Jamba の architecture が active ratio を高く押し上げる理由を説明してください。

5. Mamba-3 paper (arXiv:2603.15569) の Section 3 を読んでください。Complex-valued state update が data-dependent rotary embedding と等価である理由を 3 文で説明してください。答えを Phase 7 · Lesson 04 の RoPE derivation に結び付けてください。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | Learned recurrence `h_t = A h_{t-1} + B x_t` を持つ layer。Token あたり定数メモリ |
| Selective SSM | "Mamba's trick" | Data-dependent な A, B, C parameters により、linear time で gating-like selectivity を model に与える仕組み |
| Attention-to-Mamba ratio | "How many attention layers" | Jamba では `l = 8` が 7 Mamba layers ごとに 1 attention layer を意味する |
| Jamba block | "The 8-layer group" | 1 attention + 7 Mamba + alternate positions の MoE |
| SSM state | "The hidden buffer" | Mamba layers で KV cache を置き換える fixed-size per-layer state |
| 256k context | "Jamba's flagship number" | Jamba-1 が single 80GB GPU に収める sequence length。Pure Transformer はこのサイズでは収まらない |
| Mamba-3 | "2026 pure SSM" | Complex state + MIMO を持つ現在最良の pure-SSM architecture。Hybrids が組み直す基準 |
| MIMO | "Multi-input multi-output" | Scalar per-feature ではなく matrix-valued projections を使う Mamba-3 innovation |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | Mamba-2 の Euler-method discretization を包含する、より表現力のある recurrence |
| Hybrid architecture | "Mix attention and SSM" | Transformer と SSM layers を interleave する任意の model。Jamba は production archetype |

## 参考文献

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) — original Jamba paper、ratio ablations、256k context claim
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) — scaled-up family、398B/94B と 12B/52B public releases
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) — Jamba が基にしている selective SSM paper
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) — simplified structured-state-space successor
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) — complex-valued state、MIMO、2026 pure-SSM frontier
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) — S4 paper、LLMs における SSM genealogy の出発点
