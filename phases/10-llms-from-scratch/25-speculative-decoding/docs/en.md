# Speculative Decoding and EAGLE

> 最先端の LLM が 1 トークンを生成するには、数十億個のパラメータ全体に対する完全な forward pass が必要です。この forward pass は大幅に過剰です。多くの場合、はるかに小さなモデルが次の 3-5 トークンを正しく推測でき、大きなモデルはその推測を *verify* するだけで済みます。推測が正しければ、1 回分のコストで 5 トークンを得られます。Speculative decoding (Leviathan et al. 2023) はこれを厳密な手法にし、EAGLE-3 (2025) は acceptance rate を verify 1 回あたり約 4.5 トークンまで押し上げ、出力分布を一致させたまま 4-5x の高速化を実現しました。

**種別:** 構築
**言語:** Python (with numpy)
**前提条件:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**所要時間:** 約75分

## 問題

H100 上の 70B クラスモデルの decode throughput は、通常 40-80 tokens/second です。各トークンは、HBM からモデル重み全体を読む完全な forward pass を必要とします。出力を変えずにモデルを小さくすることはできません。メモリを超えて batch size を増やすこともできません。行き詰まります。ただし、1 回の forward pass で複数トークンを出せるようにできれば話は別です。

Autoregressive generation は本質的に逐次的に見えます: `x_{t+1} = sample(p(· | x_{1:t}))`。しかし、ここには並行化の余地があります。安価な予測器が「次の 4 トークンはおそらく [a, b, c, d] だ」と言えれば、**大きなモデルの 1 回の forward pass** で 5 位置すべてを verify し、一致する最長 prefix を accept できます。

Leviathan, Kalai, Matias (2023, "Fast Inference from Transformers via Speculative Decoding") は、target model の sampling distribution を保つ巧妙な accept/reject ルールによって、これを厳密に成立させました。同じ出力分布のまま、2-4× 高速になります。

## コンセプト

### 2 モデル構成

- **Target model** `M_p`: 実際にサンプルを取りたい、大きく遅く高品質なモデル。Distribution: `p(x)`。
- **Draft model** `M_q`: 小さく高速で、品質は低めのモデル。Distribution: `q(x)`。5-30× 小さい。

各ステップでは次を行います。

1. Draft model が `K` トークンを autoregressive に提案する: `x_1, x_2, ..., x_K ~ q`。
2. Target model がすべての `K+1` 位置を並列に 1 回の forward pass で処理し、提案トークンごとの `p(x_k)` を出す。
3. 下の modified rejection-sampling rule で、左から右へ各トークンを accept/reject する。一致する最長 prefix を accept する。
4. いずれかのトークンが reject されたら、補正後の分布から replacement を sample して停止する。すべて accept された場合は、`p(· | x_1...x_K)` から bonus token を 1 つ sample する。

Draft が target と完全に一致していれば、target-forward 1 回あたり K+1 トークンを得られます。Draft が位置 1 で間違えれば、得られるのは 1 トークンだけです。

### 厳密性のルール

Speculative decoding は、**分布として p から sample することと証明可能に等価** です。Rejection rule は次の通りです。

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

ここで `(p - q)+` は pointwise difference の正の部分を表します。Draft と target が一致しているとき (`p ≈ q`)、acceptance はほぼ 1 です。一致しないときでも、全体の sample が厳密に `p` になるよう residual distribution が構成されます。

**Greedy case.** temperature=0 sampling では、`argmax(p) == x_t` を確認するだけです。真なら accept、偽なら `argmax(p)` を出力して停止します。

### 期待される高速化

Draft model の token-level acceptance rate が `α` のとき、target-forward pass 1 回あたりに生成される期待トークン数は次の通りです。

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

`α = 0.8, K = 4` では、`(1 - 0.8^5)/(1 - 0.8) = 3.36` tokens per forward です。1 回の target forward のコストは、おおよそ `cost_q * K + cost_p` です (K 回の draft step と 1 回の target verify)。`cost_p >> cost_q * K` なら、throughput の speedup ratio は `3.36× / 1 = 3.36×` になります。

実質的な唯一のパラメータは `α` で、これは draft-target alignment に完全に依存します。良い draft がすべてです。

### Draft の学習: Distillation

ランダムな小型モデルは、良い draft にはなりません。標準的なレシピは target から distill することです。

1. 小さな architecture を選ぶ (70B target なら約 1B、7B target なら約 500M)。
2. 大規模テキストコーパス上で target model を実行し、その next-token distributions を保存する。
3. Draft を ground-truth tokens ではなく target の distribution に対する KL divergence で学習する。

結果として、`α` は通常 coding で 0.6-0.8、natural-language chat で 0.7-0.85 になります。本番環境では 2-3× の高速化が一般的です。

### EAGLE: Tree Drafting + Feature Reuse

Li, Wei, Zhang, Zhang (2024, "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty") は、標準的な speculative decoding に 2 つの非効率があることを指摘しました。

1. Draft は K 回の逐次 step を行い、それぞれ full-stack です。しかし draft は直近の verify で得られた target の features (hidden states) を再利用できます。target はすでに豊かな表現を計算しており、draft はそれをゼロから再計算しているだけです。
2. Draft は線形 chain を出力します。もし draft が候補の *tree* を出力できれば (各 node に複数の推測)、target の 1 回の forward pass が tree attention mask によって複数の candidate paths を並列に verify し、最長の accepted branch を選べます。

EAGLE-1 の変更点:
- Draft input = 位置 t における target の final hidden state。raw tokens ではない。
- Draft architecture = 1 transformer decoder layer。別個の小型モデルではない。
- Output = depth ごとに K = 4-8 candidates、depth 4-6 の tree。

EAGLE-2 (2024) は dynamic tree topology を追加します。Draft が不確かな場所では tree を広げ、自信がある場所では狭く保ちます。Verify cost を増やさずに `α_effective` を高めます。

EAGLE-3 (Li et al. 2025, "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test") は、固定された top-layer feature 依存を取り除き、新しい "test-time simulation" loss で draft を学習します。Draft は teacher-forced training distribution ではなく、target の test-time distribution に一致する出力で学習されます。Acceptance rate は 0.75 (EAGLE-2) から 0.82 (EAGLE-3) に、mean tokens/verify は 3.0 から 4.5 に上がります。

### Tree Attention Verification

Draft が tree を出力するとき、target model は **tree attention mask** を使って 1 回の forward pass で verify します。これは純粋な line ではなく、tree topology を encode する causal mask です。各 token は tree 上の祖先だけに attend します。Verify pass は依然として 1 回の forward、1 回の matmul です。Topological mask のコストは、KV entries が少し増えるだけです。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

`a, b` が競合する first-token candidates で、`c, d, e, f` が second-token candidates なら、6 つの位置すべてを 1 回の forward pass で verify できます。出力は、accepted path の中で最長の prefix です。

### 勝つ場合、勝てない場合

**勝つ場合:**
- 予測しやすいテキストの chat / completion (code、一般的な English、structured output)。`α` が高い。
- Decode 中に未使用の GPU compute がある設定 (memory-bound phase)。Tree drafting が利用可能な FLOPs を使える。

**負ける、または効果がない場合:**
- 非常に stochastic な出力 (高 temperature の creative writing)。`α` は `1/|vocab|` に近づく。
- 非常に高い concurrency の batch serving。Batching がすでに FLOPs を埋めており、tree verification の余地が小さい。
- Draft がそれほど小さくない、ごく小さな target models。

本番環境では、chat で 2-3×、code generation で 3-5× の wall-clock speedup、creative writing ではほぼゼロ、という報告が一般的です。

## 作るもの

`code/main.py`:

- 厳密な rejection rule を実装し、target の distribution を保つことを検証する reference `speculative_decode(target, draft, prompt, K, temperature)` (plain target sampling との empirical KL < 0.01)。
- Top-p branching で depth-K tree を構築する EAGLE-style tree drafter。
- Verifier 用に正しい causal pattern を生成する tree attention mask builder。
- Tiny LM 上で両方を実行する acceptance-rate harness (GPT-2-medium target から GPT-2-small を 1 つ distill する)。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_probs[k]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_probs[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 使い方

- **vLLM** と **SGLang** は first-class speculative decoding を提供しています。Flags: `--speculative_model`, `--num_speculative_tokens`。EAGLE-2/3 support は `--spec_decoding_algorithm eagle` flag で利用できます。
- **NVIDIA TensorRT-LLM** は Medusa と EAGLE trees を native にサポートします。
- **Reference draft models**: `Qwen/Qwen3-0.6B-spec` (Qwen3-32B 用 draft)、`meta-llama/Llama-3.2-1B-Instruct-spec` (70B 用 draft)。
- **Medusa heads** (Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): draft model の代わりに、target 自体へ K 個の parallel prediction heads を追加します。デプロイは簡単ですが、acceptance は EAGLE よりやや低めです。

## Ship It

この lesson は `outputs/skill-speculative-tuning.md` を生成します。これは target model の workload を profile し、draft model、K (draft length)、tree width、temperature、plain decode に fallback する条件を選ぶ skill です。

## 演習

1. 厳密な rejection rule を実装し、経験的に検証してください。`speculative_decode` と plain target sampling で 10K samples を実行し、2 つの output distributions の TV distance を計算します。0.01 未満になるはずです。

2. Speedup formula を計算してください。固定された `α` と `K` に対して、target-forward あたりの expected tokens を plot します。α ∈ {0.5, 0.7, 0.9} について optimal K を見つけます。

3. Tiny draft を学習してください。124M GPT-2 target を使い、100M tokens 上で 30M GPT-2 draft を KL loss で distill します。Held-out text 上で `α` を測定します。期待値: 0.6-0.7。

4. EAGLE-style tree drafting を実装してください。Chain ではなく、draft が各 depth で top-3 branches を出力するようにします。Tree attention mask を構築します。Target が最長の correct branch を accept することを検証します。

5. Failure modes を測定してください。temperature=1.5 (high stochasticity) で speculative decode を実行します。Draft overhead によって、α が崩れ、アルゴリズムが plain decode より遅くなることを示します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | sample を取りたい、遅く高品質な大規模モデル (p distribution) |
| Draft model | "The speculator" | 小さく高速な予測器 (q distribution)。5-30x 小さい |
| K / draft length | "Look-ahead" | verify pass 1 回あたりに speculate するトークン数 |
| α / acceptance rate | "Hit rate" | draft の proposal が accept される token あたり確率 |
| Exact rejection rule | "The accept test" | target の distribution を保つ r < p/q の比較 |
| Residual distribution | "Corrected p-q" | reject 時に sample する distribution、(p - q)+ / ||(p - q)+||_1 |
| Tree drafting | "Branching speculation" | draft が候補 tree を出力し、tree-structured attention mask で 1 pass で verify する |
| Tree attention mask | "Topological mask" | 各 node が祖先だけに attend するよう tree topology を encode する causal mask |
| Medusa heads | "Parallel heads" | target 自体に追加する K 個の prediction heads。別の draft model は不要 |
| EAGLE feature reuse | "Hidden-state draft" | draft input を raw tokens ではなく target の last hidden state にして、draft を小さくする |
| Test-time simulation loss | "EAGLE-3 training" | teacher forcing ではなく target の test-time distribution に一致する出力で draft を学習する |

## 参考資料

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) — 厳密な rejection rule と理論的な speedup analysis
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) — DeepMind による concurrent speculative-sampling paper
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) — draft model に対する parallel-heads alternative
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) — feature reuse と tree drafting
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) — dynamic tree topology
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) — train-time test-time matching
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) — Jacobi/lookahead decoding。speculator-free alternative
