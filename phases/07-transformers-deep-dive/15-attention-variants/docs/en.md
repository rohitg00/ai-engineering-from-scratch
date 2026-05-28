# Attention Variants — Sliding Window, Sparse, Differential

> Full attention は円です。すべての token がすべての token を見て、memory がその代償を払います。4 つの variant は円の形を曲げ、cost の半分を取り戻します。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**所要時間:** 約60分

## 課題

Full attention は sequence length に対して memory が `O(N²)`、compute が `O(N²)` かかります。128K-context の Llama 3 70B では、layer あたり 16 billion attention entries、それが 80 layers あります。Flash Attention (Lesson 12) は `O(N²)` activation memory を隠しますが、算術コストは変えません。すべての token は今も他のすべての token に attend します。

3 種類の variants は attention matrix 自体の topology を変えます。

1. **Sliding window attention (SWA).** 各 token は full prefix ではなく、固定された近傍 window に attend します。Memory と compute は `O(N · W)` に下がります。ここで `W` は window です。Gemma 2/3、Mistral 7B の first layers、Phi-3-Long。
2. **Sparse / block attention.** 選ばれた `(i, j)` pairs だけが score され、残りは weight 0 に強制されます。Longformer、BigBird、OpenAI sparse transformer。
3. **Differential attention.** 別々の Q/K projections で 2 つの attention maps を計算し、一方からもう一方を差し引きます。weight が最初の数 tokens に流れ込む "attention sink" を消します。Microsoft の DIFF Transformer (2024)。

これらは共存します。2026 年の frontier model は、しばしばそれらを混ぜます。ほとんどの layers は SWA-1024、5 層ごとに global full attention、そして retrieval をきれいにする differential heads が少数。Gemma 3 の 5:1 SWA-to-global ratio が現在の textbook default です。

## コンセプト

### Sliding Window Attention (SWA)

position `i` の各 query は、`[i - W, i]` (causal SWA) または `[i - W/2, i + W/2]` (bidirectional) の positions だけに attend します。window 外の tokens は score matrix で `-inf` になります。

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

`N = 8192`、`W = 1024` では、score matrix は期待値で 1024 × 8192 の non-zero rows を持ちます。これは 8× reduction です。

**SWA では KV cache が縮みます。** layer ごとに K と V の最後の `W` tokens だけを保持すれば十分です。Gemma-3-ish config (1024 window, 128K context) では、KV cache は 128× 下がります。

**Quality cost。** SWA-only transformers は long-range retrieval が苦手です。対策は、SWA layers と full-attention layers を interleave することです。Gemma 3 は 5:1 SWA:global を使います。Mistral 7B は causal-SWA stack を使い、overlapping windows を通じて information が「forward に流れる」ようにしました。各 layer は effective receptive field を `W` だけ伸ばし、`L` layers 後には model が `L × W` tokens 前まで attend できます。

### Sparse / Block Attention

`N × N` sparsity pattern を事前に選びます。標準的な形は 3 つあります。

- **Local + strided (OpenAI sparse transformer).** 直近 `W` tokens に加え、それ以前の every `stride`-th token に attend します。local と long-range の両方を `O(N · sqrt(N))` compute で捉えます。
- **Longformer / BigBird.** Local window + everyone に attend し、everyone から attend される少数の global tokens (例: `[CLS]`) + random-sparse links。matched quality で 2× context を経験的に実現します。
- **Native Sparse Attention (DeepSeek, 2025).** `(Q, K)` のどの blocks が重要かを学習し、kernel level で zero blocks を skip します。FlashAttention-compatible。

Sparse attention は kernel-engineering の話です。math は単純です (score matrix を mask する)。win は zero entries を SRAM に読み込まないことから来ます。FlashAttention-3 と 2026 年の FlexAttention API により、custom sparse patterns は PyTorch の first-class になりました。

### Differential Attention (DIFF Transformer, 2024)

通常の attention には "attention sink" 問題があります。softmax はすべての row の和を 1 に強制するため、特に何にも attend したくない tokens は weight を first token (または最初の数 tokens) に捨てます。これにより、本来 real content に使われるべき capacity が奪われます。

Differential attention は **2 つ** の attention maps を計算して差し引くことでこれを直します。

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

ここで `λ` は learned scalar (通常 0.5–0.8) です。A1 は real content weights を捉え、A2 は sink を捉えます。差し引きにより sink が打ち消され、weight が relevant tokens に再配分されます。

報告結果 (Microsoft 2024): perplexity が 5–10% 低下、同じ trained length で effective context が 1.5–2× 長くなり、needle-in-haystack retrieval が鋭くなります。

### Variant の比較

| Variant | Compute | KV cache | full との品質差 | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | O(N²) | layer ごとに O(N) | baseline | すべての model の default layer |
| SWA (window 1024) | O(N·W) | layer ごとに O(W) | -0.1 ppl、global layers と組み合わせると良い | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | O(N·√N) | mixed | SWA に近い | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | O(N) approx | mixed | 2× context で full と同等 | 初期の long-context BERT |
| Native Sparse (DeepSeek-V3.2) | O(N · active fraction) | O(N) | 0.05 ppl 以内 | DeepSeek-V3.2, 2025 |
| Differential | O(2·N²) | O(2N) | -5 to -10% ppl | DIFF Transformer, early 2026 models |

## 作ってみる

`code/main.py` を参照してください。toy sequence 上で full, SWA, local+strided, differential attention を side by side で示す causal mask comparator を実装します。

### Step 1: full causal mask (baseline)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Lesson 07 からの baseline です。lower triangular で、diagonal より上は zero weight です。

### Step 2: sliding window causal mask

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

parameter は 1 つ、`window` です。`window >= n` なら full causal attention が復元されます。`window = 1` なら、各 token は自分自身だけに attend します。

### Step 3: local + strided sparse mask

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

dense local window に加えて、sequence の先頭まで every `stride`-th token を含めます。追加 layers により receptive field は log steps で広がります。

### Step 4: differential attention

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

2 回の attention pass を行い、learned mixing coefficient で差し引きます。code では single と differential の attention-sink heatmap を比較し、sink が collapse する様子を観察します。

### Step 5: KV cache sizes

各 variant について `N = 131072` で layer ごとの cache size を出力します。SWA と sparse variants は 10–100× 下がります。Differential は 2 倍になります。memory bill を意識して支払ってください。

## 使ってみる

2026 production patterns:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ の FlexAttention は mask function を受け取ります。

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

これは custom Triton kernel に compile されます。common patterns では FlashAttention-3 speed の 10% 以内で、mask function は Python callable です。

**どれを選ぶべきか:**

- **Pure full attention** — ~16K context までのすべての layer、または retrieval quality が最重要の場合。
- **SWA + global mix** — long context (>32K)、training と inference が memory-bound。32K を超える 2026 年の default。
- **Sparse block attention** — custom kernel、custom pattern。specialized workloads (retrieval, audio) 向け。
- **Differential attention** — attention-sink contamination が痛い workload (long-context RAG, needle-in-haystack)。

## 仕上げる

`outputs/skill-attention-variant-picker.md` を参照してください。この skill は target context length, retrieval demands, training/inference compute profile から、新しい model の attention topology を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。`window=4` の SWA が各 row で最後の 4 tokens 外をすべて zero にすることを確認します。`window=n` が full causal attention を bit-identically に再現することを確認してください。
2. **Medium.** Lesson 07 capstone の上に `window=1024` の causal SWA を実装してください。tinyshakespeare で 1,000 steps 学習します。full attention に比べて val loss はどれだけ悪化しますか。peak memory はどれだけ下がりますか。
3. **Hard.** capstone model に Gemma-3-style の 5:1 layer mix (5 SWA, 1 global) を実装してください。matched parameters で pure-SWA と pure-global baselines に対し、loss, memory, generation quality を比較します。
4. **Hard.** head ごとに learned `λ` を持つ differential attention を実装してください。synthetic retrieval task (one needle, 2,000 distractors) で学習します。matched parameters の single-attention baseline と retrieval accuracy を比較してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | 「Local attention」 | 各 query は最後の `W` tokens に attend します。KV cache は `O(W)` に縮みます。 |
| Effective receptive field | 「How far back the model sees」 | window `W` の `L`-layer SWA stack では、最大 `L × W` tokens。 |
| Longformer / BigBird | 「Local + global + random」 | 常に attend する少数の global tokens を持つ sparse patterns。初期の long-context approach。 |
| Native Sparse Attention | 「DeepSeek's kernel trick」 | block-level sparsity を学習し、quality を保ちながら kernel level で zero blocks を skip します。 |
| Differential attention | 「Two maps, one subtracts」 | DIFF Transformer。attention sinks を打ち消すため、2 つ目の attention map に learned `λ` を掛けて 1 つ目から差し引きます。 |
| Attention sink | 「Weight bleeds to token 0」 | Softmax normalization は rows の和を 1 に強制します。uninformative queries は position 0 に weight を捨てます。 |
| FlexAttention | 「Mask-as-Python」 | arbitrary mask functions を FlashAttention-shape kernels に compile する PyTorch 2.5+ API。 |
| Layer type mix | 「5:1 SWA-to-global」 | stack 内で sparse と full attention layers を interleave し、低 memory で quality を保ちます。 |

## 参考資料

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — canonical sliding-window + global-token paper。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) — local + global + random。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) — OpenAI の local+strided pattern。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) — 1:1 SWA:global mix。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) — window=1024 の 5:1 mix。現在の textbook default。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) — DIFF Transformer paper。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) — DeepSeek-V3.2 の learned-sparsity attention。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) — Use It の mask-as-callable pattern の API reference。
