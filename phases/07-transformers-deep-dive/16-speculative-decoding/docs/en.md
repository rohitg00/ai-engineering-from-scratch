# Speculative Decoding — Draft, Verify, Repeat

> Autoregressive decoding は serial です。各 token は前の token を待ちます。Speculative decoding はこの連鎖を壊します。安価な model が N tokens を draft し、高価な model が 1 回の forward pass で N 個すべてを verify します。draft が正しければ、N 回分の generation に対して大きな forward を 1 回払っただけです。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**所要時間:** 約60分

## 課題

70B LLM が 1 token を sampling するには H100 で ~30 ms かかります。3B draft model は ~3 ms です。3B に 5 tokens 先まで draft させ、その 5 個を verify するために 70B を *一度だけ* 実行すると、合計は最大 5 accepted tokens に対して `5×3 + 30 = 45 ms` です。straight-line generation の `5×30 = 150 ms` と比べて大きく下がります。これが speculative decoding の要点です。少量の追加 GPU memory (draft model) と引き換えに decode latency を 2–4× 下げます。

この trick は distribution を保たなければなりません。Leviathan et al. (2023) と Chen et al. が同時期に導入した speculative sampling は、output sequence が big model 単独で生成した場合と **identically distributed** になることを保証します。quality tradeoff はありません。ただ速いだけです。

2026 年の inference では、4 つの draft-verifier pair 系統が主流です。

1. **Vanilla speculative (Leviathan 2023).** separate draft model (例: Llama 3 1B) + verifier (例: Llama 3 70B)。
2. **Medusa (Cai 2024).** verifier 上の multiple decoding heads が positions `t+1..t+k` を parallel に予測します。separate draft model は不要です。
3. **EAGLE family (Li 2024, 2025).** verifier の hidden states を再利用する lightweight draft。vanilla より acceptance rate が近く、typical に 3–4×。
4. **Lookahead decoding (Fu 2024).** Jacobi iteration。draft model がまったく不要です。Self-speculation。niche ですが dependency-free。

2026 年の production inference stack は、すべて speculative decoding を default で提供しています。vLLM、TensorRT-LLM、SGLang、llama.cpp は、少なくとも vanilla + EAGLE-2 を support します。

## コンセプト

### Core algorithm

verifier `M_q` とより安価な draft `M_p` があるとします。

1. `x_1..x_k` をすでに decode 済みの prefix とします。
2. **Draft**: `M_p` を使って `d_{k+1}, d_{k+2}, ..., d_{k+N}` を autoregressively に提案し、draft probabilities `p_1..p_N` を得ます。
3. **Verify in parallel**: `M_q` を `x_1..x_k, d_{k+1}, ..., d_{k+N}` 上で一度だけ実行し、positions `k+1..k+N+1` の verifier probabilities `q_1..q_{N+1}` を得ます。
4. **Accept/reject each draft token left to right**: 各 `i` について、probability `min(1, q_i(d_i) / p_i(d_i))` で accept します。
5. position `j` で最初に reject したら、normalized された "residual" distribution `(q_j - p_j)_+` から `t_j` を sample します。`j` 以降の drafts はすべて捨てます。
6. `N` 個すべてを accept したら、`q_{N+1}` から extra token `t_{N+1}` を 1 つ sample します (free bonus token)。

residual distribution trick が、output を `M_q` が scratch から sample した場合とまったく同じ分布に保つ数学的 insight です。

### Speedup を決めるもの

`α` = draft token ごとの expected acceptance rate、`c` = draft-to-verifier cost ratio とします。step ごとに:

- Naive generation は token ごとに big-model call を 1 回行います。
- Speculative は `α` が高いとき、`(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` tokens ごとに big-model call を 1 回行います。

`α = 0.75`、`N = 5` での typical rule of thumb は、big-model calls が 3× 少ないというものです。draft cost は 5× cheap。total wall-clock は ~2.5× 下がります。

**α が依存するもの:**

- draft が verifier をどれだけよく近似しているか。同じ family / 同じ training data は α を大きく上げます。
- Decoding strategy。greedy draft 対 greedy verifier では α が高いです。Temperature sampling は合わせにくく、acceptance が下がります。
- Task type。Code と structured output は predictable なので accept が多く、free-form creative writing は少なくなります。

### Medusa — drafts without a draft model

Medusa は draft model を verifier 上の extra output heads に置き換えます。position `t` では:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

各 head は独自の logits を出力します。inference では各 head から sample して candidate sequence を得て、すべての candidate continuations を一度に考慮する tree-attention scheme で 1 回の forward pass により verify します。

Pros: second model が不要。Cons: trainable parameters が増える。supervised fine-tuning stage (~1B tokens) が必要。acceptance rate は良い draft を使う vanilla speculative より少し低いです。

### EAGLE — better draft by reusing hidden states

EAGLE-1/2/3 (Li et al., 2024–2025) は、verifier の last-layer hidden states を入力として受け取る tiny transformer (通常 1 layer) を draft model にします。draft は verifier の feature representation を見るため、predictions が verifier の output distribution と強く相関します。acceptance rates は ~0.6 (vanilla) から 0.85+ に上がります。

EAGLE-3 (2025) は candidate continuations 上の tree search を追加しました。vLLM と SGLang は、Llama 3/4 と Qwen 3 向け default spec pathway として EAGLE-2/3 を提供しています。

### KV cache の扱い

Verification では `N` draft tokens を 1 回の forward pass で verifier に入力します。これにより verifier の KV cache は `N` entries だけ伸びます。一部の drafts が reject された場合、cache を accepted prefix length まで roll back しなければなりません。

Production implementations (vLLM の `--speculative-model`, TensorRT-LLM の LookaheadDecoder) は scratch KV buffers でこれを処理します。まず書き込み、acceptance 時に commit します。概念的には難しくありませんが、細部は厄介です。

## 作ってみる

`code/main.py` を参照してください。core speculative-sampling algorithm (rejection step + residual distribution) を次で実装します。

- "big model" は hand-coded distribution 上の deterministic-softmax です (acceptance math を解析的に verify できるようにするため)。
- "draft model" は big model の perturbation です。
- acceptance / rejection loop は direct sampling と同じ marginal distribution を生成します。

### Step 1: the rejection step

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` は uniform random number です。`q_prob` は drafted token に対する verifier の probability です。`p_prob` は draft model の probability です。Leviathan theorem は、この Bernoulli decision のあと rejection 時に residual から sampling することで、verifier の distribution が正確に保たれることを示します。

### Step 2: residual distribution

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

`p` を `q` から element-wise に引き、negative values を zero に clamp し、renormalize します。rejection が起きたらここから sample します。

### Step 3: one speculative step

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

5 個 accept されると、1 個 bonus が付き、1 回の verifier pass で 6 tokens が生成されます。

### Step 4: measure acceptance rate

draft-quality levels を変えながら 10,000 speculative steps を実行します。acceptance rate vs. draft と verifier distributions の KL divergence を plot します。きれいな monotone relationship が見えるはずです。

### Step 5: verify distribution equivalence

経験的には、speculative loop で生成した tokens の histogram は verifier から直接 sampling した histogram と一致するはずです。これは Leviathan theorem の実践です。chi-square test は sampling error の範囲内であることを確認します。

## 使ってみる

Production:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

mid-2026 時点で TensorRT-LLM は最速の Medusa path を持ちます。`faster-whisper` は small draft を使って Whisper-large 用の speculative decoding を wrap します。

**Draft の選び方:**

| Strategy | 選ぶタイミング | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | fast prototype、training なし | 1.8–2.3× |
| Medusa heads | verifier を fine-tune できる | 2–3× |
| EAGLE-2 / 3 | production、max speed | 3–4× |
| Lookahead | draft なし、training なし、extra params なし | 1.3–1.6× |

**spec-decode しない方がよい場合:**

- 1–5 tokens の single-sequence generation。overhead が支配的です。
- 極端に creative / high-temperature sampling (α が下がる)。
- memory-constrained deployments (draft model が VRAM を追加で使う)。

## 仕上げる

`outputs/skill-spec-decode-picker.md` を参照してください。この skill は新しい inference workload に対して speculative decoding strategy (vanilla / Medusa / EAGLE / lookahead) と tuning parameters (N, draft temperature) を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。50,000 tokens で speculative token distribution が verifier の direct-sample distribution と chi-square p > 0.05 の範囲で一致することを確認します。
2. **Medium.** `α = 0.5, 0.7, 0.85` について、`N` の関数として speedup (tokens per big-model forward) を plot してください。各 α の optimal `N` を特定します。(Hint: expected tokens per verify call = `(1 - α^{N+1}) / (1 - α)`.)
3. **Hard.** tiny Medusa を実装してください。Lesson 14 の capstone GPT に、positions t+2, t+3, t+4 を予測する extra LM heads を 3 つ追加します。joint multi-head loss で tinyshakespeare 上に学習します。同じ model を truncating して作った vanilla draft と acceptance rates を比較してください。
4. **Hard.** rollback を実装してください。10-token prefix KV cache から開始し、5 draft tokens を feed し、position 3 で rejection を simulate します。次 iteration で cache reads が "prefix + first 2 accepted drafts" と正しく一致することを確認してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Draft model | 「The cheap one」 | candidate tokens を提案する小さな model。通常 verifier より 10–50× cheap。 |
| Verifier | 「The big one」 | distribution を保つ target model。speculative step ごとに 1 回実行されます。 |
| Acceptance rate (α) | 「How often the draft is right」 | verifier が draft を accept する token ごとの probability。typical に 0.7–0.9。 |
| Residual distribution | 「The rejection fallback」 | normalized `(q - p)_+`。rejection 時にここから sampling すると verifier の distribution が保たれます。 |
| Bonus token | 「The free one」 | N drafts がすべて accepted のとき、verifier の next-step distribution からさらに 1 つ sample します。 |
| Medusa | 「Draft-less speculative」 | verifier 上の multiple LM heads が positions t+1..t+k を parallel に予測します。 |
| EAGLE | 「Hidden-state draft」 | verifier の last-layer hidden states で conditioned された tiny transformer draft。 |
| Lookahead decoding | 「Jacobi iteration」 | fixed-point iteration による self-speculation。draft model は不要。 |
| Tree attention | 「Verify many candidates at once」 | 複数の draft continuations を同時に考慮する branching verification。 |
| KV rollback | 「Undo rejected drafts」 | scratch KV buffer。accept 時に commit、reject 時に discard。 |

## 参考資料

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — core algorithm と equivalence theorem。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — 同時期の導入。clean Bernoulli-rejection proof。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa paper。tree-attention verification。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1。hidden-state-conditioned draft。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2。dynamic tree depth。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — draft なしの lookahead approach。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 4 つの strategies すべてを wired up した canonical production reference。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2/3 の reference code。
