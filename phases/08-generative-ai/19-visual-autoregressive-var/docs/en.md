# Visual Autoregressive Modeling (VAR): Next-Scale Prediction

> Diffusion models は時間方向に反復して sample します（denoising steps）。VAR は scale 方向に反復して sample します。1x1 token を予測し、次に 2x2、4x4 と進み、最終解像度まで各 scale が前の scale に条件づけられます。2024 年の論文は、VAR が画像生成で GPT-style scaling laws に従い、同じ compute budget で DiT を上回ることを示しました。この lesson では core mechanism を構築します。

**種別:** 構築
**言語:** Python (with PyTorch)
**前提条件:** Phase 7 Lesson 03 (Multi-Head Attention), Phase 8 Lesson 06 (DDPM)
**所要時間:** 約90分

## 問題

Autoregressive generation は language modeling を支配しました。予測可能に scale するからです。compute と parameters を増やすほど perplexity は下がり、outputs は良くなります。Image generation では 2024 年以前に主な AR の試みが 2 つありました。PixelRNN/PixelCNN（pixel-by-pixel）と、DALL-E 1 / Parti / MuseGAN（VQ-VAE codes 上の token-by-token）です。

どちらも generation-order problem に苦しみました。Pixels と tokens は 2D grid に配置されていますが、AR model は 1D raster order でそれらを訪問しなければなりません。初期の corner pixel は、画像が最終的に何になるのかを知りません。Generation quality は GPT-on-text より悪い形で scale し、matched compute で diffusion-model quality に届きませんでした。

VAR は、何を生成するかを変えることで generation-order problem を解決します。空間内の image tokens を 1 つずつ予測する代わりに、VAR は解像度を上げながら画像全体を予測します。Step 1: 1x1 token（画像全体の "summary"）を予測します。Step 2: 2x2 grid of tokens（coarser features）を予測します。Step 3: 4x4 grid を予測します。Step K: 最終的な (H/8)x(W/8) grid を予測します。

各 scale はすべての previous scales に attend し（"scale order" では causal）、自身の scale 内では parallel です。Order problem は消えます。scale k の画像全体が 1 回の transformer pass で生成されます。

## The Concept

### VQ-VAE Multi-Scale Tokenizer

VAR には **multi-scale discrete tokenizer** が必要です。画像 x に対して、progressively higher-resolution token grids の sequence を生成します。

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

各 z_k は同じ codebook（典型的な size は 4096-16384）を使います。各 scale の tokenization は独立ではありません。各 scale の residuals を足し合わせることで f を再構成するように学習されます。

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

これは **residual VQ** variant です。Scale k は scales 1..k-1 が取り逃がしたものを捕捉します。Decoder は全 scale embeddings の和を受け取り、画像を生成します。

Multi-scale VQ tokenizer は一度だけ学習され（VQGAN と同様）、その後 freeze されます。生成の仕事はすべて、その上の autoregressive model が行います。

### Next-Scale Prediction

Generative model は、すべての previous scales の tokens を見て、next scale の tokens を予測する transformer です。

Input sequence structure:
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

Position embeddings は scale index と scale 内の spatial position の両方を encode します。Attention は scale order で causal です。scale k、position (i, j) の token は、scales 1..k のすべての tokens と、scale k 自身のうち何らかの intra-scale order で前に来る tokens に attend できます（VAR は fixed positional attention を使い、intra-scale causality はありません。scale 内のすべての positions は parallel に予測されます）。

Training loss: 各 scale k で、prior-scale tokens が与えられたときに tokens z_k を予測します。Discrete VQ codes に対する cross-entropy loss です。"sequence" が scale-structured になったことを除けば GPT と同じ構造です。

### Generation

推論時:
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

K = 10 scales なら、generation は 10 回の transformer forward passes です。各 pass はその scale 全体を parallel に生成します。scale 内に per-token autoregression はありません。256x256 image では、DiT の 28-50 回に対しておよそ 10 passes です。

### Why Next-Scale Wins Over Next-Token

構造的な勝因は 3 つあります。
1. **Coarse-to-fine aligns with natural image statistics.** 人間の視覚認知と画像 datasets はどちらも scale-dependent regularities を示します。low-frequency structure は安定して予測しやすく、high-frequency detail は low-frequency content に条件づけられます。Next-scale prediction はこれを活用します。
2. **Parallel generation within scale.** GPT-style token AR と異なり、VAR は 1 つの scale の全 tokens を 1 step で生成します。実効的な generation length は linear ではなく log-scale です。
3. **No generation order bias.** scale k の tokens は scale k-1 のすべてを見ます。早い tokens が遅い context を得る前に確定を強いられる "left-of" や "above" bias はありません。

### Scaling Law

Tian et al. は、VAR が ImageNet 上の FID について power-law scaling curve に従うことを示しました。GPT が perplexity でそうなるのと同じです。Parameters や compute を 2 倍にすると、error が信頼できる形で半減します。これは、この種の scaling behavior を language models と同じくらいきれいに示した最初の image-generative model でした。その結果、VAR-scale predictions は architecture ごとの経験的な当て推量ではなく、compute から予測可能になります。

### Relationship to Diffusion

VAR と diffusion は同じ data-compression story を共有しています。どちらも generation problem を、より簡単な subproblems の sequence に分解します。

- Diffusion: 徐々に noise を加え、1 step 戻す方法を学習する。
- VAR: 徐々に resolution を加え、next scale を予測する方法を学習する。

両者は問題を横切る軸が異なります。どちらも tractable conditional distributions を生みます。経験的には、VAR は inference が速く（passes が少なく、scale 内はすべて parallel）、class-conditional ImageNet で DiT と同等または上回ります。Text-conditional VAR（VARclip、HART）は活発な research direction です。

## 実装

`code/main.py` では次を行います。
1. synthetic "image" data（2D Gaussian rings）上で小さな **multi-scale VQ tokenizer** を構築する。
2. **VAR-style transformer** を学習し、tokens を next-scale-predict する。
3. Transformer を 4 回呼び出して sample し（4 scales）、decode する。
4. scale-ordered training により、scale 内の generation が parallel になることを検証する。

これは toy implementation です。重要なのは、scale-structured attention mask と parallel-within-scale generation が実際に動くことを見ることです。

## Ship It

この lesson は `outputs/skill-var-tokenizer-designer.md` を生成します。これは multi-scale tokenizer を設計する skill です。number of scales、scale ratios、codebook size、residual sharing、decoder architecture を扱います。

## Exercises

1. **Scale count ablation.** 4、6、8、10 scales で VAR を学習してください。Reconstruction quality と autoregressive passes 数の関係を測ります。Scales が多いほど residuals は細かくなり品質は良くなりますが、passes も増えます。

2. **Codebook size.** codebook sizes 512、4096、16384 で tokenizers を学習してください。大きい codebooks は reconstruction を改善しますが prediction は難しくなります。knee を見つけてください。

3. **Parallel-within-scale check.** 学習済み VAR で attention pattern を明示的に測ってください。scale k 内で、モデルは cross-scale positions に attend し、intra-scale には attend していないでしょうか。mask implementation を検証してください。

4. **VAR vs DiT scaling.** 同じ ImageNet class-conditional task で、matched param budgets（例: 33M、130M、458M）の VAR と DiT を学習してください。FID vs compute を plot します。VAR は各 size で DiT を上回るはずです。論文の結果を small scale で再現してください。

5. **Text conditioning.** VAR を拡張し、text embedding（CLIP pooled）を adaLN 経由の追加 conditioning input として受け取るようにしてください。これは HART recipe です。Text-aligned sampling で FID はどれだけ改善しますか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| VAR | "Visual AutoRegressive" | VQ token grids の pyramid 上で next-scale prediction する image generation。 |
| Next-scale prediction | "Predict coarser, then finer" | モデルが、すべての previous scales に条件づけて、解像度 scales を上げながら tokens を予測する。 |
| Multi-scale VQ tokenizer | "Residual VQ" | increasing resolution の K token grids を生成し、decoder が全 scales を合計する VQ-VAE。 |
| Scale k | "Pyramid level k" | K 個の resolution levels の 1 つ。k=1 の 1x1 から k=K の (H/p)x(W/p) まで。 |
| Parallel-within-scale | "One forward per scale" | scale k の全 tokens が、autoregressive ではなく 1 回の transformer pass で予測される。 |
| Causal-across-scales | "Scale-ordered attention" | scale k の token は scales 1..k のすべてに attend できるが、scales k+1..K にはできない。 |
| Residual VQ | "Additive tokenization" | 各 scale の tokens が lower scales の残した residual を encode し、decoder が全 scale embeddings を合計する。 |
| VAR scaling law | "Image GPT scaling" | FID が、language models の perplexity のように compute に対して予測可能な power law に従う。 |
| HART | "Hybrid VAR + text" | MaskGIT-style iterative decoding と VAR の scale structure を組み合わせた text-conditional VAR variant。 |
| Scale position embedding | "(scale, row, col) triple" | Positional encoding が scale index と scale 内の spatial coordinates の両方を持つ。 |

## 参考文献

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) — VAR paper、canonical reference。
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) — DiT、diffusion comparison baseline。
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) — VQGAN、VAR の multi-scale tokenizer が拡張する tokenizer family。
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) — VQ-VAE、discrete image tokenization の基盤。
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) — text-conditional VAR。
