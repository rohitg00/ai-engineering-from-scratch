# Flamingo と Few-Shot VLM のための Gated Cross-Attention

> DeepMind の Flamingo (2022) は、誰よりも早く 2 つのことを示しました。1 つは、単一の model が image、video、text を任意に interleave した sequence を処理できること。もう 1 つは、VLM が in-context に学習できることです。3 つの example (image, caption) pair を含む few-shot prompt を与えると、model は gradient step なしで新しい image に caption を付けます。mechanism は gated cross-attention layer です。frozen LLM の既存 layer の間に挿入され、learned tanh gate は 0 から始まるため、initialization 時に LLM の text capability が保たれます。この lesson では、Gemini の interleaved input と Idefics2 の visual token の祖先である Flamingo の Perceiver resampler と gated cross-attention architecture をたどります。

**種別:** 学習
**言語:** Python (stdlib、gated cross-attention + Perceiver resampler demo)
**前提条件:** Phase 12 · 03 (BLIP-2 Q-Former)
**所要時間:** ~120 分

## 学習目標

- gated cross-attention が tanh(gate) = 0 によって initialization 時に frozen LLM の text capability を保つ仕組みを説明する。
- Perceiver resampler をたどる: N image patches -> K fixed "latent" queries via cross-attention。
- Flamingo が image-text interleaved sequence を、image placement を尊重する causal masking で扱う方法を説明する。
- few-shot multimodal prompt structure (3 image-caption example の後に query image) を再現する。

## 問題

BLIP-2 は 32 visual token を frozen LLM の input layer に入れます。1 prompt あたり 1 image なら機能します。しかし、「ここに image A があるので caption せよ。ここに image B があるので caption せよ。今度は image C を caption せよ」のように、text と interleave された多数の image を入れたい場合はどうでしょうか。LLM の self-attention は image token と text token を 1 つの stream で扱う必要があり、どの position がどの image に attend できるかという問題が面倒になります。

Flamingo の答えは、LLM の input stream を変えないことでした。既存の LLM block の間に extra cross-attention layer を挿入します。text token はこれまで通り LLM の causal self-attention を流れます。数個の LLM block ごとに、text token は新しい gated layer を通して image feature にも cross-attend します。gate (zero initialized) により、step zero では新しい layer は no-op です。model は pretrained LLM とまったく同じ振る舞いをします。training が進むと gate が開き、visual information が流れ始めます。

Flamingo が答えた 2 つ目の問いは、prompt あたり variable number の image (0、1、多数) をどう扱うかです。Perceiver resampler は、任意個数の patch を受け取り、固定個数の visual latent token を生成する small cross-attention module です。LLM cross-attention layer は、prompt 内の image 数にかかわらず同じ shape を見ます。

## 概念

### The frozen LLM

Flamingo は frozen Chinchilla 70B LLM から始めます。70B weight はすべて untouched です。既存の text self-attention と FFN は通常通り動作します。

### Perceiver resampler

prompt 内の各 image について、ViT は N patch token を生成します。Perceiver resampler は K 個の fixed learnable latent を持ちます (Flamingo では K=64)。各 resampler block は 2 sub-step です。

1. Cross-attention: K latent が N patch token に attend する (Q は latent、K/V は patch)。
2. latent 内の self-attention + FFN。

6 resampler blocks の後、output は patch 数にかかわらず K=64 個、dim 1024 の visual token です。224x224 image (196 patches) も 480x480 image (900 patches) も、どちらも 64 resampler token として出ます。

video では resampler を temporal に適用します。各 frame の patch が 64 latent を生成し、temporal positional encoding が t=0 と t=N を区別します。full video は T * 64 visual token になります。

### Gated cross-attention

frozen LLM の M layers ごとに (Flamingo は M=4)、新しい gated cross-attention block を挿入します。

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` は zero initialized の learnable scalar。
- `tanh(0) = 0` なので、init 時には gated branch の寄与はゼロ。
- `alpha` が 0 から離れると、cross-attention contribution が滑らかに増える。
- residual connection により、gate が完全に開いても LLM の text representation は上書きされない。visual information を上乗せするだけ。

これは Flamingo で最も重要な design choice です。visual conditioning は additive、gated、initialization では zero。step 0 の Flamingo は text-only input に対して完全な Chinchilla 70B です。

### Masked cross-attention for interleaved inputs

`<image A> caption A <image B> caption B <image C> ?` のような prompt では、各 text token は sequence 内で自分より前に来た image だけを見るべきです。cross-attention mask はこれを強制します。position `t` の text token は、image index `i < i_t` の image resampler token だけに attend します。ここで `i_t` は position `t` より前の latest image です。「直前の image だけを見る」と「すべての preceding image を見る」はどちらも valid な choice で、Flamingo は前者を選びました。

### In-context few-shot learning

Flamingo prompt は次のような形です。

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

model は completion pattern を見て、"bird" (または image3 に写っているもの) を出力します。gradient step はありません。frozen LLM の in-context learning capability が gated cross-attention を通じて持ち越されます。これが論文の punchline であり、重要な理由です。

### Training data

Flamingo は 3 つの dataset で training しました。

1. MultiModal MassiveWeb (M3W): interleaved image と text を持つ 43M web pages。reading order を再構成。
2. Image-Text Pairs (ALIGN + LTIP): 4.4B pairs。
3. Video-Text Pairs (VTP): 27M short video clips。

OBELICS (2023) は interleaved web corpus の open reproduction で、Idefics、Idefics2、ほとんどの open "Flamingo-like" model が training に使います。

### OpenFlamingo and Otter

OpenFlamingo (2023) は open reproduction です。architecture は同一 (frozen LLaMA または MPT 上の Perceiver resampler + gated cross-attention)。3B、4B、9B checkpoints があります。smaller base LLM と少ない data のため、quality は Flamingo に遅れます。

Otter (2023) は OpenFlamingo の上に、multimodal instruction dataset である MIMIC-IT の instruction tuning を追加し、gated cross-attention が instruction following にも機能することを示しました。

### The descendants

- Idefics / Idefics2 / Idefics3: Hugging Face の gated cross-attention lineage。徐々に単純化し、Idefics2 は resampler を捨て、adaptive pooling 付きの direct patch token を採用。
- Flamingo-to-Chameleon transition: 2024 年までに多くの team が early-fusion (Lesson 12.11) へ移行。Flamingo-style gated cross-attention は、backbone freezing が必要な production では残る。
- Gemini の interleaved input: exact mechanism は proprietary だが、conceptually には Flamingo の interleaved-format flexibility を継承。

### Comparison to BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | input で 1 回 Q-Former | M layers ごとに gated cross-attention |
| Visual tokens | image あたり 32 | image あたり cross-attn layer ごとに 64 |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — paper の centerpiece |
| Interleaved inputs | native support なし | Yes、design target |
| Training data | 130M pairs | 1.3B pairs + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | 8 A100 で数日 | 数千 TPUv4 で数週間 |

single-image VQA を budget 内で行うなら BLIP-2。interleaved、few-shot、multi-image reasoning なら Flamingo/Idefics2 を選びます。

## 使ってみる

`code/main.py` は次を demonstrate します。

1. 36 個の fake patch token と 8 個の learnable latent に対する Perceiver resampler (pure Python cross-attention)。
2. `alpha = 0` の gated cross-attention step -> output は input と一致 (LLM unchanged)。その後 `alpha = 2.0` -> visual contribution が混ざる。
3. "(image 1) (text 1) (image 2) (text 2)" sequence の 2D attention mask を生成する interleaved-mask builder。

## 仕上げ

この lesson は `outputs/skill-gated-bridge-diagnostic.md` を作ります。open VLM の config (resampler Y/N、cross-attn frequency、gate scheme) が与えられると、Flamingo lineage element を識別し、freezing strategy を説明します。fine-tune が text performance を悪化させた理由を debug するのに有用です (答え: gate が速く開きすぎた)。

## 演習

1. Flamingo-9B の visual parameter count を計算してください。9B LLM + 1.4B gated cross-attention layers + 64M resampler。total params のうち train される fraction はどれだけですか。

2. PyTorch で gated residual `y = tanh(alpha) * cross + x` を実装してください。`alpha=0` のとき、init 時に `y==x` が厳密に成り立つことを実験で示してください。

3. OpenFlamingo Section 3.2 (arXiv:2308.01390) の、各 prompt の image count が異なる batch で multiple images を扱う方法を読んでください。padding strategy を説明してください。

4. Flamingo の cross-attention mask は、なぜ text token が preceding image すべてではなく、*only the most recent* preceding image に attend するようにするのでしょうか。Flamingo paper Section 2.4 を読み、tradeoff を説明してください。

5. In-context few-shot: 新しい Flamingo variant のために「image -> main object の color」の 4 examples を持つ prompt を構成してください。example 数を 0 から 8 まで変えたときの expected accuracy pattern を説明してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Perceiver resampler | 「Fixed-latent cross-attention」 | variable number の input patch から K fixed token を生成する module |
| Gated cross-attention | 「Tanh-gated bridge」 | residual layer `y = tanh(alpha)*cross + x`。learnable alpha、init 0 |
| Interleaved input | 「Mixed sequence」 | image と text を reading order で自由に混在させる prompt format |
| Frozen LLM | 「No LLM gradients」 | text LLM の weight は update しない。resampler + cross-attn layers だけを train |
| Few-shot | 「In-context examples」 | prompt 内に数個の (image, answer) pair を与える。model は finetuning なしで generalize |
| OBELICS | 「Interleaved web corpus」 | image と text を reading order で含む 141M web pages の open dataset |
| Chinchilla | 「70B frozen base」 | Flamingo の frozen text LLM。DeepMind の Chinchilla paper 由来 |
| Gate schedule | 「How alpha moves」 | training 中に cross-attention gate が開く速度 |
| Cross-attn frequency | 「Every M layers」 | gated cross-attention block を挿入する頻度。Flamingo は M=4 |
| OpenFlamingo | 「Open reproduction」 | MosaicML/LAION の 3-9B open checkpoint。architecture は Flamingo と同一 |

## 参考文献

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — original paper。
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — open reproduction。
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — interleaved web corpus。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — general Perceiver architecture。
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — instruction-tuned Flamingo descendant。
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — Flamingo approach の modern simplification。
