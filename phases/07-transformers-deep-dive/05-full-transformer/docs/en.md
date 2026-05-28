# 完全な Transformer — Encoder + Decoder

> Attention は主役です。それ以外の residual、normalization、feed-forward、cross-attention は、Attention を深く積み重ねられるようにする足場です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention), Phase 7 · 04 (Positional Encoding)
**所要時間:** 約75分

## 問題

Attention 層を 1 つ置いただけでは、モデルではなく特徴抽出器にすぎません。1 層あたり 1 回の matmul だけでは、言語を扱うには容量が足りません。深さが必要です。そして正しい配管がないと、深くした瞬間に壊れます。

2017 年の Vaswani 論文は、1 つの Attention 層を積み重ね可能なブロックに変える 6 つの設計判断をまとめました。それ以降の Transformer は、encoder-only (BERT)、decoder-only (GPT)、encoder-decoder (T5) のどれであっても、同じ骨格を継承しています。2026 年時点ではブロックは洗練されていますが (RMSNorm、SwiGLU、pre-norm、RoPE)、骨格は同じです。

このレッスンではその骨格を扱います。次のレッスンではそれを特化します。06 は encoder、07 は decoder、08 は encoder-decoder です。

## コンセプト

![Encoder and decoder block internals, wired](../assets/full-transformer.svg)

### 6 つの部品

1. **Embedding + positional signal.** Token → vector。位置は RoPE (現代的) または sinusoidal (古典的) で注入します。
2. **Self-attention.** 各位置が他のすべての位置を参照します。decoder では mask されます。
3. **Feed-forward network (FFN).** 位置ごとの 2 層 MLP: `W_2 · activation(W_1 · x)`。既定の expansion ratio は 4× です。
4. **Residual connection.** `x + sublayer(x)`。これがないと、約 6 層を超えたあたりで勾配が消えます。
5. **Layer normalization.** `LayerNorm` または現代的な `RMSNorm`。residual stream を安定させます。
6. **Cross-attention (decoder only).** Query は decoder から、key と value は encoder output から来ます。

### Encoder block (BERT、T5 encoder で使用)

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

Encoder は双方向です。mask はありません。すべての位置がすべての位置を見ます。

### Decoder block (GPT、T5 decoder で使用)

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

Decoder は 1 ブロックあたり 3 つの sublayer を持ちます。中央の cross-attention だけが、encoder から decoder へ情報が流れる場所です。純粋な decoder-only architecture (GPT) では cross-attention を省き、masked self-attention + FFN だけにします。

### Pre-norm と post-norm

元論文の形式は `x + sublayer(LN(x))` と `LN(x + sublayer(x))` の対比でした。Post-norm は 2019 年ごろから主流ではなくなりました。丁寧な warmup なしに深く学習するのが難しいためです。Pre-norm (`LN` を sublayer の前に置く) が 2026 年の標準です。Llama、Qwen、GPT-3+、Mistral はすべてこれを使います。

### 2026 年版の現代的ブロック

Vaswani 2017 は LayerNorm + ReLU でした。現代の stack では両方が置き換えられています。実運用のブロックはだいたい次の形です。

| Component | 2017 | 2026 |
|-----------|------|------|
| Normalization | LayerNorm | RMSNorm |
| FFN activation | ReLU | SwiGLU |
| FFN expansion | 4× | 2.6× (SwiGLU は 3 つの行列を使い、総 parameter 数を合わせる) |
| Position | Sinusoidal absolute | RoPE |
| Attention | Full MHA | GQA (または MLA) |
| Bias terms | Yes | No |

RMSNorm は LayerNorm の mean-centering を落とします (減算が 1 回少ない)。そのため計算量を節約でき、経験的にも少なくとも同程度に安定します。SwiGLU (`Swish(W1 x) ⊙ W3 x`) は、Llama、PaLM、Qwen の論文で ReLU/GELU FFN を一貫して約 0.5 point ppl 上回っています。

### Parameter count

`d_model = d`、FFN expansion `r` の 1 ブロックについて:

- MHA: `4 · d²` (Q, K, V, O projections)
- FFN (SwiGLU): `3 · d · (r · d)` ≈ `3rd²`
- Norms: 無視できる程度

`d = 4096, r = 2.6, layers = 32` (おおよそ Llama 3 8B) では、合計は `32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = ~1.5B parameters per layer × 32 ≈ 7B` です (embedding と head は別)。公開値と合います。

## 作ってみる

### Step 1: building blocks

Lesson 03 の小さな `Matrix` class を使います (このファイルに独立性のためコピー済み)。

- `layer_norm(x, eps=1e-5)` — mean を引き、std で割る。
- `rms_norm(x, eps=1e-6)` — RMS で割る。mean subtraction はしない。
- `gelu(x)` と `silu(x) * W3 x` (SwiGLU)。
- `ffn_swiglu(x, W1, W2, W3)`。
- `encoder_block(x, params)` と `decoder_block(x, enc_out, params)`。

全体の配線は `code/main.py` を見てください。

### Step 2: 2-layer encoder と 2-layer decoder をつなぐ

積み重ねます。encoder output をすべての decoder cross-attention に渡します。output projection の前に final LN を追加します。

```python
def encode(tokens, params):
    x = embed(tokens, params.emb) + sinusoidal(len(tokens), params.d)
    for block in params.encoder_blocks:
        x = encoder_block(x, block)
    return x

def decode(target_tokens, encoder_out, params):
    x = embed(target_tokens, params.emb) + sinusoidal(len(target_tokens), params.d)
    for block in params.decoder_blocks:
        x = decoder_block(x, encoder_out, block)
    return x
```

### Step 3: toy example で forward を走らせる

6-token の source と 5-token の target を通します。output shape が `(5, vocab)` であることを確認します。training はしません。このレッスンの目的は architecture であり、loss ではありません。

### Step 4: RMSNorm + SwiGLU に差し替える

LayerNorm と ReLU-FFN を RMSNorm と SwiGLU に置き換えます。shape がまだ一致することを確認します。これは関数を 1 つ差し替えるだけでできる 2026 年版の modernization です。

## 使ってみる

PyTorch/TF の参照実装は `nn.TransformerEncoderLayer`、`nn.TransformerDecoderLayer` です。ただし 2026 年の production code の多くは独自 block を持ちます。理由は次のとおりです。

- Flash Attention は `nn.MultiheadAttention` 経由ではなく、attention 内部で呼ばれる。
- GQA / MLA は stdlib の参照実装にない。
- RoPE、RMSNorm、SwiGLU は PyTorch の default ではない。

HF `transformers` には読む価値のあるきれいな参照 block があります。`modeling_llama.py` は 2026 年時点の canonical な decoder-only block です。約 500 行なので、一度通読する価値があります。

**Encoder vs decoder vs encoder-decoder — いつ選ぶか:**

| Need | Pick | Example |
|------|------|---------|
| Classification, embeddings, QA over text | Encoder-only | BERT, DeBERTa, ModernBERT |
| Text generation, chat, code, reasoning | Decoder-only | GPT, Llama, Claude, Qwen |
| Structured input → structured output (translation, summarization) | Encoder-decoder | T5, BART, Whisper |

Decoder-only は、最も素直に scale し、理解と生成の両方を扱えるため、言語で勝ちました。入力に明確な「source sequence」としての性格がある場合 (translation、speech recognition、structured tasks) は、encoder-decoder が今でも最適です。

## Ship It

`outputs/skill-transformer-block-reviewer.md` を見てください。この skill は新しい transformer block 実装を 2026 年の default と照らして review し、不足している要素 (pre-norm、RoPE、RMSNorm、GQA、FFN expansion ratio) を指摘します。

## 演習

1. **Easy.** `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True` で `encoder_block` の parameter 数を数えてください。block を実装し、`sum(p.numel() for p in block.parameters())` で検証します。
2. **Medium.** post-norm から pre-norm に切り替えてください。両方を初期化し、random input に 12 層積んだ後の activation norm を測ります。post-norm の activation は爆発し、pre-norm は有界に保たれるはずです。
3. **Hard.** toy copy task (copy `x` reversed) で 4-layer encoder-decoder を実装してください。100 steps 学習し、loss を報告します。RMSNorm + SwiGLU + RoPE に差し替えると loss は下がりますか。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Block | 「1 つの transformer layer」 | norm + attention + norm + FFN の stack を residual connection で包んだもの。 |
| Residual | 「Skip connection」 | `x + f(x)` の output。深い stack を通る gradient flow を可能にする。 |
| Pre-norm | 「後ではなく前で normalize」 | 現代的な形式は `x + sublayer(LN(x))`。warmup の曲芸なしに深く学習できる。 |
| RMSNorm | 「mean のない LayerNorm」 | RMS で割る。演算が 1 つ少なく、経験的安定性は同等。 |
| SwiGLU | 「みんなが移行した FFN」 | `Swish(W1 x) ⊙ W3 x → W2`。LM ppl で ReLU/GELU を上回る。 |
| Cross-attention | 「decoder が encoder を見る方法」 | decoder 由来の Q、encoder output 由来の K/V を使う MHA。 |
| FFN expansion | 「middle MLP の幅」 | hidden-size と d_model の比。通常は 4 (LayerNorm) または 2.6 (SwiGLU)。 |
| Bias-free | 「+b term を落とす」 | 現代的な stack は linear layer の bias を省く。ppl が少し改善し、model も小さくなる。 |

## 参考文献

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — original block spec。
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745) — deep な設定で pre-norm が post-norm に勝つ理由。
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467) — RMSNorm。
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202) — SwiGLU paper。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — canonical な 2026 年版 decoder-only block。
