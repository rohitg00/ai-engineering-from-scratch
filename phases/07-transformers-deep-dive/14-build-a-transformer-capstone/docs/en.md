# Build a Transformer from Scratch — The Capstone

> 13 lessons。1 つの model。近道なし。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 01 through 13。飛ばさないでください。
**所要時間:** 約120分

## 課題

あなたはすべての paper を読みました。attention, multi-head splits, positional encodings, encoder and decoder blocks, BERT and GPT losses, MoE, KV cache を実装しました。次は、それらを実タスク上で一緒に動かします。

capstone では、小さな decoder-only transformer を character-level language modeling task で end-to-end に学習します。Shakespeare を読み、新しい Shakespeare を生成します。laptop で 10 分以内に学習できるほど小さく、より大きな dataset と長い training に差し替えれば本物の LM になる程度には正しい実装です。

これは course の「nanoGPT」です。独自のものではありません。Karpathy の 2023 nanoGPT tutorial は、すべての student が少なくとも一度は書く reference implementation です。その形を借り、ここまで扱った内容に合わせて組み替えます。

## コンセプト

![Transformer-from-scratch block diagram](../assets/capstone.svg)

注釈付き architecture:

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── Lesson 04 (RoPE option)
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── Lesson 05
│  MultiHeadAttention (causal)      │  ◀── Lesson 03 + 07 (causal mask)
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── Lesson 05
│  residual                         │
└────────────────────────────────── ┘
   │
   ▼
final RMSNorm
   │
   ▼
lm_head (tied to token embedding)
   │
   ▼
logits (B, N, V)
   │
   ▼
shift-by-one cross-entropy            ◀── Lesson 07
```

### ここで提供するもの

- `GPTConfig` — すべての hyperparameters を設定する場所。
- `MultiHeadAttention` — causal, batched、optional Flash-style pathway (PyTorch の `scaled_dot_product_attention`) 付き。
- `SwiGLUFFN` — modern FFN。
- `Block` — pre-norm、residual で包んだ attention + FFN。
- `GPT` — embeddings、stacked blocks、LM head、generate()。
- AdamW、cosine LR、gradient clipping を備えた training loop。
- Shakespeare text 上の char-level tokenizer。

### ここで提供しないもの

- RoPE — Lesson 04 で概念的に実装済み。ここでは単純化のため learned positional embeddings を使います。exercises で RoPE に差し替えます。
- generation 中の KV cache — 各 generation step で full prefix に対して attention を再計算します。遅いですが単純です。exercises で KV cache を追加します。
- Flash Attention — PyTorch 2.0+ は inputs が一致すれば auto-dispatch します。ここでは `F.scaled_dot_product_attention` を使います。
- MoE — block ごとに single FFN です。MoE は Lesson 11 で見ました。

### 目標 metrics

Mac M2 laptop で、4-layer, 4-head, d_model=128 の GPT を `tinyshakespeare.txt` 上で 2,000 steps 学習すると、次のようになります。

- Training loss は ~4.2 (random) から約 6 分で ~1.5 に収束します。
- Sampled output は Shakespeare らしい形になります。古風な words、line breaks、"ROMEO:" のような proper names が現れます。
- Val loss (held-out final 10% of text) は training loss に近く追従します。この size/budget では overfitting はありません。

## 作ってみる

この lesson は PyTorch を使います。`torch` を install してください (CPU build で十分です)。`code/main.py` を参照してください。script は次を処理します。

- 見つからない場合は `tinyshakespeare.txt` を download (または local copy を読む)。
- Byte-level char tokenizer。
- 90/10 の train/val split。
- 対応 hardware で bf16 autocast を使う training loop。
- training 完了後の sampling。

### Step 1: data

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

unique characters は 65。tiny vocabulary です。4-byte の vocab_size に収まります。BPE も tokenizer drama もありません。

### Step 2: model

`code/main.py` を参照してください。block は Lesson 05 の textbook どおりです。pre-norm, RMSNorm, SwiGLU, causal MHA。4/4/128 の parameter count は ~800K です。

### Step 3: training loop

length-256 token windows の random batch を取得します。Forward。Shift-by-one cross-entropy。Backward。AdamW step。Log。繰り返します。

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

### Step 4: sample

prompt が与えられたら、forward を繰り返し、top-p logits から sample し、append して続けます。500 tokens 後に止めます。

### Step 5: read the output

2,000 steps 後:

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

Shakespeare ではありません。しかし Shakespeare-shaped です。~800K parameters と laptop で 6 分としては明確な成功です。

## 使ってみる

この capstone は reference architecture です。実用に近づける 3 つの extension:

1. **Tokenizer を差し替える。** BPE を使います (例: `tiktoken.get_encoding("cl100k_base")`)。Vocab size は 65 から ~50,000 に跳ね上がります。補うため model capacity も scale up する必要があります。
2. **より大きな corpus で学習する。** `OpenWebText` または `fineweb-edu` (HuggingFace) を使います。single A100 で 10B tokens は、125M-param GPT なら 約24時間 かかります。
3. **RoPE + KV cache + Flash Attention を追加する。** 以下の exercises でそれぞれ扱います。

最終的には fluent English を生成する 125M-parameter GPT になります。frontier model ではありません。しかし同じ code path を大きくしたものが、Karpathy, EleutherAI, Allen Institute が 2026 年に research checkpoints を学習する方法です。

## 仕上げる

`outputs/skill-transformer-review.md` を参照してください。この skill は、過去 13 lessons 全体に照らして transformer-from-scratch implementation の correctness を review します。

## 演習

1. **Easy.** `code/main.py` を実行してください。trained model の final-step validation loss が 2.0 未満であることを確認します。`max_steps` を 2,000 から 5,000 に変更してください。val loss は改善し続けますか。
2. **Medium.** learned positional embeddings を RoPE に置き換えてください。`MultiHeadAttention` 内で Q と K に rotation を適用します。学習し、val loss が少なくとも同等に低いことを確認してください。
3. **Medium.** sampling loop に KV cache を実装してください。cache あり/なしで 500 tokens を生成します。laptop で wall-clock は 5–20× 改善するはずです。
4. **Hard.** next-plus-one token を予測する second head を model に追加してください (MTP — Multi-Token Prediction from DeepSeek-V3)。jointly に学習します。効果はありますか。
5. **Hard.** block ごとの single FFN を 4-expert MoE に置き換えてください。Router + top-2 routing。matched active parameters で val loss がどう変わるか見てください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| nanoGPT | 「Karpathy's tutorial repo」 | minimal decoder-only transformer training code、~300 LOC。canonical reference。 |
| tinyshakespeare | 「The standard toy corpus」 | ~1.1 MB の text。2015 年以降、すべての character-LM tutorial が使っています。 |
| Tied embeddings | 「Share input/output matrix」 | LM head weight = token embedding matrix の転置。parameters を節約し、quality を改善します。 |
| bf16 autocast | 「Training precision trick」 | forward/back を bf16 で実行し、optimizer state は fp32 に保つ。2021 年以降の標準。 |
| Gradient clipping | 「Stops spikes」 | global grad norm を 1.0 に制限し、training blowups を防ぎます。 |
| Cosine LR schedule | 「The 2020+ default」 | LR は linearly に上がり (warmup)、その後 peak の 10% まで cosine-shaped に decay します。 |
| MFU | 「Model FLOP Utilization」 | achieved FLOPs / theoretical peak。2026 年では dense 40%、MoE 30% なら強い値です。 |
| Val loss | 「Held-out loss」 | model が見ていない data 上の cross-entropy。overfit detector。 |

## 参考資料

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) — 古典的な annotated implementation。
