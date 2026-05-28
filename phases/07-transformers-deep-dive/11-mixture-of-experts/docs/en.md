# Mixture of Experts (MoE)

> Dense 70B transformer は、すべての token で全 parameter を活性化します。671B MoE は token あたり 37B だけを活性化し、すべての benchmark でそれを上回ります。Sparsity はこの 10 年で最も重要な scaling idea です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**所要時間:** 約45分

## 課題

Dense transformer の inference FLOPs は parameter count と等しくなります。forward pass なので 2 倍を掛けます。Dense model を大きくすると、すべての token が全コストを払います。2024 年までに frontier は compute wall にぶつかっていました。意味のある賢さを増やすには、token あたり指数的に多い FLOPs が必要でした。

Mixture of Experts はこの結びつきを壊します。各 FFN を、`E` 個の独立した experts と、token ごとに `k` 個の experts を選ぶ router に置き換えます。Total parameters = `E × FFN_size`。Active parameters per token = `k × FFN_size`。2026 年の典型設定は `E=256`、`k=8` です。Storage は `E` に比例し、compute は `k` に比例します。

2026 年の frontier はほぼすべて MoE です。DeepSeek-V3 (671B total / 37B active)、Mixtral 8×22B、Qwen2.5-MoE、Llama 4、Kimi K2、gpt-oss などです。Artificial Analysis の独立 leaderboard では、open-source models の top 10 はすべて MoE です。

## コンセプト

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### FFN の置き換え

Dense transformer block:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE block:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

各 expert は独立した FFN、通常は SwiGLU です。router は単一の linear layer です。各 token は自分の `k` experts を選び、それらの出力を gated mixture として受け取ります。

### load-balancing problem

router が token の 90% を expert 3 に通すと、他の experts は学習機会を失います。これまで 3 つの修正が試されました。

1. **Auxiliary load-balancing loss** (Switch Transformer, Mixtral)。expert usage の variance に比例する penalty を加えます。動きますが、hyperparameter と 2 つ目の gradient signal が増えます。
2. **Expert capacity + token dropping** (初期 Switch)。各 expert は最大 `C × N/E` tokens だけを処理し、overflow tokens は layer を skip します。quality を損ねます。
3. **Auxiliary-loss-free balancing** (DeepSeek-V3)。router の top-k selection をずらす、学習可能な per-expert bias を加えます。bias は training loss の外側で更新されます。main objective への penalty はありません。2024 年の大きな unlock です。

DeepSeek-V3 の方法はこうです。各 training step の後、すべての expert について usage が target より上か下かを確認します。bias を `±γ` だけ動かします。Selection には `scores + bias` を使います。gating に使う expert probabilities は raw `scores` のままです。routing と expression を切り離します。

### Shared experts

DeepSeek-V2/V3 は experts を *shared* と *routed* にも分けます。すべての token は shared experts をすべて通ります。Routed experts は top-k で選ばれます。Shared experts は共通知識を捉え、routed experts は専門化します。V3 は 1 shared expert と 256 routed のうち top-8 を使います。

### Fine-grained experts

Classic MoE (GShard, Switch) では、各 expert は full FFN と同じ幅です。`E` は小さく (8–64)、`k` も小さい (1–2) です。

Modern fine-grained MoE (DeepSeek-V3, Qwen-MoE) では、各 expert はより狭く、FFN size の 1/8 です。`E` は大きく (256+)、`k` も大きい (8+) です。Total parameters は同じでも、組み合わせははるかに速く増えます。`C(256, 8) = 400 trillion` 通りの可能な「experts」が token ごとにあります。quality は上がり、latency は横ばいです。

### cost profile

token ごと、layer ごと:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 は、**token あたりの active FLOPs が少ない**にもかかわらず、ほぼすべての benchmark で Llama 3 70B (dense) を上回ります。More parameters = more knowledge。More active FLOPs = token あたりの compute 増加。MoE はこの 2 つを切り離します。

### 注意点: memory

どの experts が発火するかにかかわらず、すべての experts は GPU 上に存在します。671B model は fp16 weights だけで約 1.3 TB の VRAM が必要です。Frontier MoE deployment には expert parallelism が必要です。experts を GPUs に shard し、tokens を network 越しに route します。latency を支配するのは matmul ではなく all-to-all communication です。

## 作ってみる

`code/main.py` を見てください。pure stdlib の小さな MoE layer です。

- `n_experts=8` の SwiGLU-ish experts (説明用に linear を 1 つずつ)
- top-k=2 routing
- softmax-normalized gating weights
- per-expert bias による auxiliary-loss-free balancing

### Step 1: router

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Bias は selection に影響し、gate weight には影響しません。これが DeepSeek-V3 の trick です。bias は load imbalance を補正しますが、model の predictions は誘導しません。

### Step 2: router に 100 tokens を通す

どの experts が何回発火したかを追跡します。bias がないと usage は偏ります。bias update loop (`-γ` for over-used experts, `+γ` for under-used) を入れると、数 iteration で usage は一様分布に収束します。

### Step 3: param count comparison

MoE config の「dense equivalent」を出力します。DeepSeek-V3-shaped は 256 routed + 1 shared、8 active、d_model=7168 です。total parameter count は目を見張るほど大きいですが、active count は dense Llama 3 70B の 7 分の 1 です。

## 使ってみる

HuggingFace loading:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 年の production inference では、vLLM が MoE routing を native support します。SGLang は最速の expert-parallel path を持ちます。どちらも top-k selection と expert parallelism を自動的に扱います。

**MoE を選ぶ場面:**
- token あたり低い inference cost で frontier quality がほしい。
- VRAM / expert-parallel infrastructure がある。
- workload が context-heavy (long docs) ではなく token-heavy (chat, code) である。

**MoE を選ばない場面:**
- Edge deployment。active FLOP が少なくても full storage を払います。
- Latency-critical single-user serving。expert routing が overhead を加えます。
- Small models (<7B)。MoE の quality advantage は compute threshold、約 6B active params を超えて初めて現れます。

## Ship It

`outputs/skill-moe-configurator.md` を見てください。この skill は、新しい MoE について parameter budget、training tokens、deployment target から E、k、shared-expert layout を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。auxiliary-loss-free bias update が 50 iterations で expert usage を均す様子を観察します。
2. **Medium.** learned router を hash-based router (deterministic, no learning) に置き換えてください。quality と balance を比較します。なぜ learned router の方が良いのでしょうか。
3. **Hard.** GRPO-style の「rollout-matched routing」(DeepSeek-V3.2 trick) を実装してください。inference 中にどの experts が発火したかを記録し、gradient computation 中に同じ routing を強制します。toy policy-gradient setup で効果を測ります。

## 重要語句

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | 「One FFN among many」 | 独立した feed-forward network。FFN computation の sparse な一部に専用の parameters。 |
| Router | 「The gate」 | 各 token を各 expert に対して score する小さな linear layer。top-k selection を行う。 |
| Top-k routing | 「k active experts per token」 | 各 token の FFN computation が正確に k 個の experts を通り、gate で重み付けされる。 |
| Auxiliary loss | 「Load-balance penalty」 | skewed expert usage を罰する追加 loss term。 |
| Auxiliary-loss-free | 「DeepSeek-V3's trick」 | router の selection だけに per-expert bias を入れて balance する。追加 gradient はない。 |
| Shared expert | 「Always on」 | すべての token が通る追加 expert。共通知識を捉える。 |
| Expert parallelism | 「Shard by expert」 | 異なる experts を異なる GPUs に分散し、tokens を network 越しに route する。 |
| Sparsity | 「Active params < total params」 | `k × expert_size / (E × expert_size)` の比率。DeepSeek-V3 では 37/671 ≈ 5.5%。 |

## 参考資料

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) — このアイデア。
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) — Switch、古典的 MoE。
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) — Mixtral 8×7B。
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) — MLA + auxiliary-loss-free MoE + MTP。
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) — bias-based balancing paper。
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) — この lesson の router が使う fine-grained + shared-expert split。
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) — original shared-expert paper。
