# GPT — Causal Language Modeling

> BERT は両側を見ます。GPT は過去だけを見ます。triangle mask は、現代 AI でもっとも影響の大きい 1 行の code です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**所要時間:** 約75分

## 問題

language model が答える問いは 1 つです。最初の `t-1` tokens が与えられたとき、token `t` の probability distribution は何か。この signal、つまり next-token prediction で学習すると、任意の text を 1 token ずつ生成できる model が得られます。

whole sequence を parallel に end-to-end 学習するには、各 position の prediction が earlier position だけに依存する必要があります。そうしないと model は答えを見て簡単にカンニングします。

causal mask はこれを実現します。softmax の前に attention score へ加える、`-inf` 値の upper-triangular matrix です。softmax 後、その position は 0 になります。各 position は自身とそれ以前の position だけに attend できます。そして sequence 全体に一度適用するため、1 回の forward pass で N 個の next-token prediction を parallel に得られます。

GPT-1 (2018)、GPT-2 (2019)、GPT-3 (2020)、GPT-4 (2023)、GPT-5 (2024)、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi はすべて、同じ core loop を持つ decoder-only causal transformers です。違いは、より大きく、より良い data と、より良い RLHF です。

## コンセプト

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### Mask

length `N` の sequence について、`N × N` matrix を作ります。

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

softmax の前に raw attention scores へ `M` を加えます。`exp(-inf) = 0` なので、masked position は zero weight になります。attention matrix の各 row は、previous positions だけに対する probability distribution です。

実装コストは `torch.tril()` 1 回です。計算時間は nanoseconds。分野への影響は、すべてです。

### Parallel training, serial inference

Training: whole `(N, d_model)` sequence を一度 forward pass し、N 個の cross-entropy losses (position ごとに 1 つ) を計算して合計し、backprop します。sequence 方向に parallel です。これが GPT training が scale する理由です。1 回の GPU pass で batch 内の 1M tokens を処理できます。

Inference: token by token に生成します。`[t1, t2, t3]` を入れて `t4` を得ます。`[t1, t2, t3, t4]` を入れて `t5` を得ます。`[t1, t2, t3, t4, t5]` を入れて `t6` を得ます。KV cache (Lesson 12) は `t1…tn` の hidden states を保存し、各 step で再計算しないようにします。それでも inference の serial depth = output length です。これが autoregressive tax であり、decoding がすべての LLM の latency bottleneck になる理由です。

### Loss — shift-by-one

tokens `[t1, t2, t3, t4]` があるとします。

- Input: `[t1, t2, t3]`
- Targets: `[t2, t3, t4]`

各 position `i` について `-log P(target_i | inputs[:i+1])` を計算し、合計します。これが whole sequence の cross-entropy です。

あなたが聞いたことのあるすべての transformer LM はこの loss で学習します。Pre-training、fine-tuning、SFT は、data が違うだけで同じ loss です。

### Decoding strategies

Training 後は、sampling の選び方が多くの人が思う以上に重要です。

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | 各 step で argmax | Deterministic tasks, code completion |
| Temperature | logits を T で割って sample | Creative tasks。高い T = 多様性が高い |
| Top-k | top-k tokens だけから sample | 低 probability の tail を切る |
| Top-p (nucleus) | cumulative prob ≥ p になる最小集合から sample | 2020+ の default。distribution shape に適応 |
| Min-p | `p > min_p * max_p` の token を残す | 2024+。long tail の拒否で top-p より良い |
| Speculative decoding | draft model が N tokens を提案し、big model が検証 | 同品質で latency を 2–3× 削減 |

2026 年時点では、open-weights model の妥当な default は min-p + temperature 0.7 です。Speculative decoding は production inference stack では必須要件です。

### 「GPT recipe」を機能させたもの

1. **Decoder-only.** encoder overhead がない。layer ごとに attention + FFN を 1 pass。
2. **Scaling.** 124M → 1.5B → 175B → trillions。Chinchilla scaling laws (Lesson 13) は compute の使い方を教えてくれる。
3. **In-context learning.** 6B–13B あたりで emergence。model は fine-tuning なしに few-shot examples に従える。
4. **RLHF.** human preferences による post-training が、raw pretrained text を chat assistants に変えた。
5. **Pre-norm + RoPE + SwiGLU.** scale した training を安定させた。

core architecture は GPT-2 以降あまり変わっていません。面白い変化は data、scale、post-training で起きています。

## 作ってみる

### Step 1: causal mask

`code/main.py` を見てください。1 行です。

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

softmax の前に attention scores へ加えます。仕組みはこれで全部です。

### Step 2: 2-layer GPT-ish model

2 つの decoder blocks (masked self-attention + FFN、cross-attention なし) を stack します。token embedding、positional encoding、unembedding を追加します。unembedding は token embedding matrix と tie します。これは GPT-2 以降の標準的な trick です。

### Step 3: next-token prediction, end-to-end

20-token toy vocab で、各 position の logits を生成します。shift-by-one target に対する cross-entropy loss を計算します。gradient は使いません。forward-pass sanity check です。

### Step 4: sampling

greedy、temperature、top-k、top-p、min-p を実装します。固定 prompt でそれぞれを走らせ、output を比較します。sampling function は 10 行です。

## 使ってみる

PyTorch、2026 年の idiom:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

内部では、`generate()` は forward pass を走らせ、final-position logits を取り、next token を sample し、それを append して繰り返します。すべての production LLM inference stack (vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX) は、batched prefill、continuous batching、KV cache paging、speculative decoding で強く最適化しつつ、同じ loop を実装しています。

**GPT vs BERT, それぞれ 1 行:** GPT は `P(x_t | x_{<t})` を予測します。BERT は `P(x_masked | x_unmasked)` を予測します。loss が、model が生成できるかどうかを決めます。

## Ship It

`outputs/skill-sampling-tuner.md` を見てください。この skill は、新しい generation task の sampling parameters を選び、deterministic decoding が必要な場合に flag します。

## 演習

1. **Easy.** `code/main.py` を実行し、softmax 後の causal attention matrix が lower-triangular であることを確認してください。spot-check: row 3 は columns 0–3 にだけ weight を持つはずです。
2. **Medium.** width 4 の beam search を実装してください。10 個の short prompts で beam-4 と greedy の perplexity を比較します。beam は常に勝ちますか。(Hint: 通常は translation では勝ちますが、open-ended chat ではそうとは限りません。)
3. **Hard.** speculative decoding を実装してください。tiny 2-layer model を draft、6-layer model を verifier として使います。length 64 の completion 100 個で wall-clock speedup を測ります。output が verifier の greedy と一致することを確認してください。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | 「triangle」 | attention score に加える upper-triangular `-inf` matrix。position `i` が positions `≤ i` だけを見るようにする。 |
| Next-token prediction | 「loss」 | 各 position で model distribution と true next token の cross-entropy を取る。 |
| Autoregressive | 「1 つずつ生成する」 | output を input として戻す。parallelism は training 中だけで、generation 中にはない。 |
| Logits | 「pre-softmax scores」 | softmax 前の LM head の raw output。sampling はこれに対して行う。 |
| Temperature | 「creativity knob」 | logits を T で割る。T→0 = greedy、T→∞ = uniform。 |
| Top-p | 「Nucleus sampling」 | 合計が ≥p になる最小集合まで distribution を切り詰め、残りから sample する。 |
| Min-p | 「Top-p より良い」 | `p ≥ min_p × max_p` の token を残す。distribution の鋭さに cutoff が適応する。 |
| Speculative decoding | 「Draft + verify」 | 安価な model が N tokens を提案し、大きな model が parallel に検証する。 |
| Teacher forcing | 「Training trick」 | training 中は model prediction ではなく true previous token を与える。すべての seq2seq LM の標準。 |

## 参考文献

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) — GPT-3 and in-context learning。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — speculative decoding paper。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — canonical causal-LM reference code。
