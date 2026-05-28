# Multi-Token Prediction (MTP)

> GPT-2 から Llama 3 まで、すべての autoregressive LLM は position ごとに 1 つの loss で訓練される。next token を予測する loss である。DeepSeek-V3 は position ごとに 2 つ目の loss を追加した。その次の token を予測するのだ。追加された 14B parameters (671B model 上) は gradient flow を通じて main model に蒸留され、訓練済みの MTP heads は inference で speculative-decoding drafters として再利用され、80%+ の acceptance を得た。1.8× の generation throughput が実質的に無料で得られた。このレッスンでは、DeepSeek technical report の sequential MTP module を構築し、loss と shared-head parameter layout を計算し、MTP が causal chain を保つ一方で Gloeckle et al. の original parallel MTP がそれを壊した理由を説明する。

**種類:** Build
**言語:** Python (stdlib)
**前提条件:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**所要時間:** 約60分

## 学習目標

- MTP training objective を述べ、prediction depths 全体の joint loss を導出する。
- Gloeckle et al. の parallel MTP heads (2024) と DeepSeek-V3 の sequential MTP modules の違い、および sequential design が causal chain を保持する理由を説明する。
- pre-training run に MTP modules を追加したときの parameter overhead と memory overhead を計算する。
- 1 つの MTP module をゼロから実装する。shared embedding、per-depth transformer block、projection、shared output head を含む。

## 問題

Next-token prediction は標準的な LLM training objective である。すべての hidden state は、ただ 1 つのもの、つまり直後の token を予測するよう supervised される。これは驚くほど弱い signal だ。sequence 内の情報の大半は 1 token を超えて広がる。structure、coherence、factuality、arithmetic flow などである。model は trillions of tokens にわたる多数の one-token signals を積み上げることで、それらを学ばなければならない。

MTP はこう問う。すべての hidden state が複数の future tokens を同時に予測するよう supervised されたらどうなるか。Gloeckle et al. (Meta, 2024) は、これが役立つことを示した。彼らの実装は、backbone の上に複数の independent output heads を置き、それぞれが異なる offset を予測するものだった。parallel で単純だが、heads は hierarchical refinement なしに同じ hidden state を見ていた。そして predictions は causally に chain しなかったため、speculative decoding に使えなかった。

DeepSeek-V3 (December 2024) は、各 prediction depth で causal chain を保つ sequential modules として MTP を再設計した。model は `h_i^(0)` から `t+1` を予測し、次に `h_i^(0)` と `E(t+1)` embedding を組み合わせた新しい hidden state `h_i^(1)` から `t+2` を予測する、という形で進む。各 depth は独自の小さな transformer block である。shared embedding と shared output head により、parameter overhead は控えめに保たれる。DeepSeek-V3 の scale では、671B main-model weights に対して MTP modules 全体で 14B extra parameters である。この 2% overhead によって、より dense な training signals と、inference でそのまま使える speculative-decoding draft が得られた。

このレッスンでは、single MTP module と D-depth loss をゼロから構築する。数学は整っている。実装は 150 lines である。

## コンセプト

### sequential MTP recipe

DeepSeek-V3 は main model の上に `D` 個の MTP modules を追加する。各 module `k` (`k = 1..D`) は depth `k` の token、つまり position `i` までの prefix が与えられたときの `t_{i+k}` を予測する。

Module `k` は次で構成される。

- 独自の attention と MLP を持つ transformer block `T_k`。
- previous-depth hidden state と next-depth ground-truth token の embedding を組み合わせる projection matrix `M_k`。
- shared embedding `E` (main model と同じ)。
- shared output head `Out` (main model と同じ)。

training では、position `i` までの prefix に対して、per-depth hidden state は次の通り。

```
h_i^(0) = main model backbone at position i
h_i^(k) = T_k( M_k * concat(RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k}))) )   for k >= 1
```

per-depth prediction は次の通り。

```
logits_{i+k} = Out(h_i^(k-1))   for k = 1..D
```

per-depth loss は ground-truth `t_{i+k}` に対する cross-entropy である。

```
L_k = CE(logits_{i+k}, t_{i+k})
```

depths 全体の joint loss は次の通り。

```
L_MTP = (lambda / D) * sum_{k=1..D} L_k
```

`lambda` は小さな weighting factor である。DeepSeek-V3 は training の最初の 10% で 0.3、その後は 0.1 を使う。total training loss は `L_main + L_MTP` である。

### parallel ではなく sequential である理由

Gloeckle の original parallel MTP には D 個の output heads があり、それぞれが `h_i^(0)` に直接適用される。各 head は同じ backbone hidden state から `t_{i+k}` を予測する。これは問題なく訓練できるが、predictions は互いに条件付けられていない。`head_1` の output を `head_2` の助けに使うことはできない。heads は parallel に発火する。

DeepSeek-V3 の sequential design は、`h_i^(k-1)` と実際の next-token embedding `E(t_{i+k})` から `h_i^(k)` を構築する。これにより causal chain が保たれる。`t_{i+k+1}` を予測するために、depth `k+1` の module は `t_{i+k}` にあったものを見る。この構造は、autoregressive decoder が自分自身の output を消費する方法と同一である。そのため、MTP modules は speculative-decoding drafters として直接使える。

inference では、`h_i^(k-1)` と drafted `t_{i+k}` を module `k+1` に入れ、`t_{i+k+1}` の prediction を得る。これを繰り返す。これは trained MTP module を draft network として使う、まさに EAGLE-style draft である。DeepSeek-V3 は first MTP module で 80%+ の acceptance と約 1.8× speedup を報告している。

### Parameter accounting

hidden `h`、vocabulary `V` の model について:

- Main model: billions of parameters に加え、size `V * h` の output head が 1 つ。
- Shared output head: main model の head を再利用する。extra params はない。
- Shared embedding: main model の embedding を再利用する。extra params はない。
- Per-MTP module:
  - Projection `M_k`: `(2h) * h = 2h^2`。
  - Transformer block `T_k`: attention (`4h^2` for MHA) plus MLP (typically `8h^2` for SwiGLU with ratio 8/3)。block あたり約 `12h^2`。

module あたりの total extra は `~14h^2`。DeepSeek-V3 の `h = 7168`、D = 1 module では、紙上では `~14 * 7168^2 = ~720M` parameters になる。DeepSeek-V3 は 14B と報告している。この差の大半は、MTP module 内の expert layers も MoE であることによる。

### speculative-decoding の payoff

pre-training 中、MTP modules は training を約 10% 遅くする (forward compute が増え、extra loss がある)。payoff は 2 つある。

1. より dense な training signal。各 hidden state は D+1 個の supervision targets を見る。DeepSeek-V3 の ablations では、MMLU、GSM8K、MATH、HumanEval で一貫して数 percentage points の改善が測定された。

2. inference で無料の speculative decoding draft。MTP module はすでに次の数 tokens を予測するよう訓練されている。draft network として再利用すると、80%+ の acceptance rates を達成する。その水準では、N=3 または N=5 の spec decoding が 1.8× throughput をもたらす。10% の training-time cost は、inference を走らせた最初の時点で回収される。

### EAGLE との関係

EAGLE は pre-training 後に小さな draft model を SEPARATELY に訓練する。MTP は draft を pre-training に焼き込む。2 つの approaches は似た accept rates に収束するが、pipeline が異なる。

| 観点 | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| 訓練タイミング | pre-training 後 | pre-training 中 |
| 既存 weights との backward compatibility | あり | なし (re-train が必要) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | depth 1 で 0.80+ |
| speedup 以外の利点 | speculative decoding のみ | より dense な training signal + speedup |

## 作る

`code/main.py` は single MTP module をエンドツーエンドで構築する。shared embedding、projection、transformer block、shared output head を含む。次に、短い synthetic sequence 上で per-depth cross-entropy loss を計算し、component ごとの parameter count を print する。toy vocabulary は 32 tokens なので、数字が読みやすい。

### Step 1: shared embedding table

single `vocab_size x hidden` table が main model と、すべての depth のすべての MTP module で使われる。2 つ目の copy ではない。文字通り同じ tensor である。

### Step 2: per-depth combination

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

実際の DeepSeek-V3 は、2 つの RMSNormed vectors を `[2h]` に concatenate し、`h x 2h` matrix で project する。toy は stdlib で短くするため vector addition を使う。

### Step 3: depth k の transformer block

Self-attention plus MLP。toy では、one-layer linear attention block と SwiGLU MLP により、numpy なしで structure を見えるままにしている。

### Step 4: shared output head

main model の output projection を再利用する。vocabulary 上の logits。

### Step 5: per-depth loss

offset `k` の ground-truth token に対する softmax(logits) の cross-entropy。`lambda / D` scaling factor で depths 全体に aggregate する。

### Step 6: parameter accounting

total parameter count、shared (embedding、head) count、per-module extra count を print する。MTP extra と main-model size の ratio を示す。

## 使う

MTP は DeepSeek-V3 (December 2024) と DeepSeek-R1 series に統合されている。inference では:

- DeepSeek 自身の serving stack は MTP modules を speculative decoders としてそのまま consume する。
- vLLM と SGLang は、2026 年 4 月時点で DeepSeek-V3 MTP の integration paths を持つ。
- AMD の ROCm SGLang tutorial は、V3 checkpoint 上で measured 1.8× speedup を示す具体的な MTP speculative-decoding config を示している。

新しい pre-training run で MTP を使うべき場合:

- full pre-training pipeline を制御しており、より dense な training signal を蓄えたい。
- model を scale して serving する予定があり、speculative decoding を無料で得たい。
- hidden size が少なくとも 4096。1B-scale では overhead の痛みが gain を上回る。

使うべきでない場合:

- 既存の pre-trained dense model を fine-tuning する場合。MTP module は訓練されていない。
- 比較用の clean baseline が必要な research models。MTP は architecture を変える。

## 出荷する

このレッスンは `outputs/skill-mtp-planner.md` を生成する。pre-training run specification (model size、data、compute) が与えられると、MTP を統合する plan を返す。depths D の数、`lambda` schedule、memory overhead、inference-time speculative-decoding wiring を含む。

## 演習

1. `code/main.py` を実行する。synthetic signal が強くなるにつれて per-depth loss が単調に下がることを示す。synthetic を fixed pattern を使うよう変更し、depth-1 と depth-2 の losses がどちらも収束することを検証する。

2. D=1 MTP module を持つ dense 70B model (hidden 8192、80 layers) の parameter overhead を計算する。DeepSeek-V3 が報告した 14B overhead と比較する。DeepSeek の数字が高い理由を説明する。MTP transformer block が同じ MoE structure を継承しており、per-module parameter count を膨らませるためである。

3. toy に D=2 を実装する。h^(1) を受け取り `t_{i+2}` を予測する second MTP module を追加する。joint loss と parameter accounting が DeepSeek paper の equations 19-21 と一致することを検証する。

4. toy を parallel MTP (Gloeckle-style) に切り替える。main hidden state の上に D 個の output heads を追加し、それぞれが異なる offset を予測する。同じ synthetic signal 上で、depth ごとの losses が sequential version とどう異なるかを測定する。sequential version は intermediate predictions に条件付けるため、k > 1 でより低い depth-k loss を出すはずである。

5. trained MTP module を EAGLE-style draft として使う。inference で module k を呼び、`t_{i+k}` を propose する。held-out sequence 上で、これらの draft tokens の acceptance rate を main model の predictions に対して測定する。toy で 50%+ に達したら、MTP-as-draft property を経験的に再現できている。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------------------|
| MTP module | 「extra loss block」 | main model の `k` positions 先の token を予測する、小さな transformer block と projection |
| Prediction depth | 「どの offset か」 | module `k` が position `i` までの prefix から `t_{i+k}` を予測する、その整数 `k` |
| Parallel MTP | 「Gloeckle-style」 | 同じ backbone hidden state 上の D 個の independent heads。conditional chain はない |
| Sequential MTP | 「DeepSeek-V3 style」 | 各 module が previous depth の hidden state と次 token の embedding に条件付けられる。causal chain を保つ |
| Shared output head | 「main head を再利用する」 | MTP modules は separate output projection ではなく main model の LM head を呼ぶ |
| Shared embedding | 「main table を再利用する」 | 同じ vocabulary embedding table があらゆる場所で使われる。duplicate parameters はない |
| Projection matrix M_k | 「hidden + next-token を組み合わせる」 | previous hidden state と target-token embedding を next depth の input に折り込む `h x 2h` linear layer |
| Joint loss L_MTP | 「平均された extra losses」 | per-depth cross-entropy losses の arithmetic mean を `lambda` で scale したもの |
| Acceptance rate at depth 1 | 「MTP draft がどれだけ当たるか」 | D=1 MTP module の top-1 prediction が main model の top-1 prediction と一致する rate。DeepSeek-V3 では 80%+ |
| Lambda weighting | 「extra-loss の重要度」 | per-depth scaling factor。DeepSeek-V3 では training 開始時に 0.3、後半は 0.1 |

## 参考文献

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — sequential MTP の完全な説明 (Section 2.2)。joint-loss equations と inference での 1.8× speedup を含む
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) — DeepSeek の design が改善する parallel MTP baseline
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 685B total (671B main + 14B MTP)、deployment notes
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) — MTP が当てはまる speculative-decoding framework
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — EAGLE の 2025 draft architecture。MTP と競合する counterpart
