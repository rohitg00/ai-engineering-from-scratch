# 視覺自迴歸建模（VAR）：下一尺度預測（next-scale prediction）

> 擴散模型在時間上迭代取樣（去噪步驟）。VAR 在按尺度逐步取樣——先預測 1×1 的 token，再 2×2，再 4×4，直到最終解析度，每一個尺度都以前一個為條件。2024 年的論文顯示，VAR 在影像生成上符合 GPT 式的縮放定律（scaling law），而且在同樣算力預算下打贏 DiT。這一課做的是核心機制。

**Type:** Build
**Languages:** Python (with PyTorch)
**Prerequisites:** Phase 7 Lesson 03 (Multi-Head Attention), Phase 8 Lesson 06 (DDPM)
**Time:** ~90 minutes

## The Problem｜問題

自迴歸生成（autoregressive generation）能主導語言模型發展，因為規模可預測：算力更多、參數更多、困惑度（perplexity）更低、輸出更好。2024 年以前，影像生成的自迴歸主要有兩次嘗試：PixelRNN／PixelCNN（逐像素），以及 DALL-E 1／Parti／MuseGAN（在 VQ-VAE 碼上逐 token）。

兩者都卡在生成順序。像素和 token 排成二維網格，自迴歸模型卻得用一維光柵順序（raster order）走訪它們。早生成的角落像素，不知道影像最後會變成什麼。隨規模放大時，生成品質比文字上的 GPT 提升得差，在對齊的算力下也從來沒到擴散模型的品質。

VAR 改的是「在生成什麼」，把順序問題修掉。不是在空間裡一個一個預測影像 token，而是用越來越高的解析度預測整張影像。第 1 步：預測一個 1×1 token（整張影像的「摘要」）。第 2 步：預測 2×2 的 token 網格（較粗的特徵（feature））。第 3 步：預測 4×4 網格。第 K 步：預測最終的 (H/8)x(W/8) 網格。

每一個尺度都注意先前所有尺度（在「尺度順序」上是因果的（causal）），自己這一尺度裡面則平行。順序問題消失：尺度 k 的整張影像，在一次 transformer 前向傳遞裡產生。

## The Concept｜核心概念

### 多尺度 VQ-VAE tokenizer

VAR 需要一個**多尺度的離散 tokenizer**。對一張影像 x，它產出一串解析度越來越高的 token 網格：

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

每個 z_k 用同一個碼本（codebook），常見大小是 4096 到 16384。各尺度的 tokenization 並不獨立——訓練目標是把各尺度的殘差（residual）加起來，重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

這是**殘差 VQ（residual VQ）**的一種變體。尺度 k 補的是尺度 1 到 k-1 漏掉的部分。解碼器（decoder）把加總所有尺度的 embedding，產出影像。

多尺度 VQ tokenizer 只訓練一次（跟 VQGAN 一樣），然後凍住。生成的工作全部由上面的自迴歸模型來做。

### 下一尺度預測

生成模型是一個 transformer。它看到先前所有尺度的 token，預測下一個尺度的 token。

輸入序列的排列方式：

```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置 embedding（position embedding）同時編進尺度索引，以及該尺度裡的空間位置。注意力（attention）在尺度順序上是因果的：尺度 k、位置 (i, j) 的 token，可以注意尺度 1 到 k 的所有 token，也可以注意尺度 k 裡面、在尺度內順序中較早的 token。VAR 用固定的位置注意力，尺度內沒有因果——一個尺度裡的所有位置一起預測。

訓練損失：在每個尺度 k，給定先前所有尺度的 token，預測 z_k 這些 token。對離散的 VQ 碼做交叉熵（cross-entropy）損失。結構跟 GPT 一樣，差別是「序列」現在按尺度排。

### 生成

推論（inference）時：

```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

K = 10 個尺度時，生成是 10 次 transformer 前向傳遞。每一次都平行產出整個尺度——尺度內沒有逐 token 的自迴歸。256×256 的影像大約是 10 次前向傳遞，對上 DiT 的 28 到 50 次。

### 為什麼下一尺度贏過下一個 token

三項結構性優勢：

1. **由粗到細，對上自然影像的統計。** 人類視覺和影像資料集都有隨尺度變化的規律：低頻結構穩定、可預測；高頻細節以低頻內容為條件。下一尺度預測用的就是這個。
2. **尺度內平行生成（intra-scale parallel generation）。** 不像 GPT 式的逐 token 自迴歸，VAR 一個步驟就產出一個尺度的全部 token。有效的生成長度是對數尺度，不是線性。
3. **沒有生成順序的偏差（bias）。** 尺度 k 的 token 看得到整個尺度 k-1；沒有「在左邊」或「在上面」的偏差，去逼較早的 token 在較晚的脈絡出現之前就先承諾。

### 縮放定律

Tian et al. 顯示，VAR 在 ImageNet 上的 FID 遵循冪律（power-law）縮放曲線，就像 GPT 的困惑度。參數或算力一加倍，誤差就可靠地減半。這是第一個把這種縮放行為表現得和語言模型一樣乾淨的影像生成模型。因此 VAR 的規模可以從算力預測出來，不必每個架構各猜一次。

### 和擴散的關係

VAR 和擴散講的是同一個資料壓縮故事：兩者都把生成問題拆成一連串比較容易的子問題。

- 擴散：逐步加雜訊，學會撤銷一步。
- VAR：逐步加解析度，學會預測下一個尺度。

它們是穿過這個問題的不同軸。兩者都得到可處理的條件分布（conditional distribution）。經驗上，VAR 推論更快（前向傳遞更少，尺度內全部平行），在類別條件（class-conditional）的 ImageNet 上打平或打贏 DiT。文字條件的 VAR（VARclip、HART）仍是活躍的研究方向。

```figure
gx-var-next-scale
```

## Build It｜動手實作

在 `code/main.py` 裡，你會：

1. 在合成的「影像」資料（二維高斯環）上，做一個很小的**多尺度 VQ tokenizer**。
2. 訓練一個 **VAR 風格的 transformer**，對 token 做下一尺度預測。
3. 呼叫 transformer 4 次（4 個尺度）來取樣，再解碼。
4. 驗證：按尺度排序的訓練，會讓生成在尺度內平行。

這是玩具實作。重點是看到按尺度組織的注意力遮罩（attention mask），以及尺度內的平行生成，真的在運作。

## Ship It｜交付成果

這一課產出 `outputs/skill-var-tokenizer-designer.md`——一個用來設計多尺度 tokenizer 的 skill：尺度數量（number of scales）、尺度比例、碼本大小、殘差共享、解碼器架構。

## Exercises｜練習

1. **尺度數量的消融（ablation）。** 用 4、6、8、10 個尺度訓練 VAR。量重建品質對上自迴歸前向傳遞的次數。尺度更多 = 殘差更細 = 品質更好，但前向傳遞也更多。

2. **碼本大小。** 用碼本大小 512、4096、16384 訓練 tokenizer。碼本越大，重建越好，預測越難。找出轉折點。

3. **尺度內平行的檢查。** 對一個訓練好的 VAR，明確量出注意力模式。在尺度 k 裡，模型是不是注意跨尺度的位置，而不應注意同一尺度內其他位置？驗證遮罩的實作。

4. **VAR 對上 DiT 的縮放。** 同一個 ImageNet 類別條件任務，用對齊的參數預算訓練 VAR 和 DiT（例如 3300 萬、1.3 億、4.58 億）。畫 FID 對上算力。VAR 應該在每個尺寸都領先 DiT——用小規模重現論文的結果。

5. **文字條件。** 把 VAR 擴成可以吃文字 embedding（CLIP 池化後的），經由 adaLN 當額外條件。這就是 HART 的配方。在對齊的文字條件取樣上，FID 會好多少？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| VAR | 「視覺自迴歸」 | 在一層層 VQ token 網格上，用下一尺度預測來生成影像。 |
| 下一尺度預測 | 「先較粗，再較細」 | 模型以越來越高的解析度預測 token，並以所有先前尺度為條件。 |
| 多尺度 VQ tokenizer | 「殘差 VQ」 | 產出 K 個解析度遞增的 token 網格的 VQ-VAE；解碼器把所有尺度加總。 |
| 尺度 k | 「金字塔第 k 層」 | K 個解析度層級之一，從 k=1 的 1x1，到 k=K 的 (H/p)x(W/p)。 |
| 尺度內平行 | 「每個尺度一次前向傳遞」 | 尺度 k 的全部 token 在一次 transformer 前向傳遞裡預測，不是自迴歸。 |
| 跨尺度因果 | 「按尺度排序的注意力」 | 尺度 k 的 token 可以注意 1 到 k 的全部尺度，但不能注意 k+1 到 K。 |
| 殘差 VQ | 「相加式 tokenization」 | 每個尺度的 token 編碼較低尺度留下的殘差；解碼器把加總所有尺度的 embedding。 |
| VAR 縮放定律 | 「影像版 GPT 縮放」 | FID 隨算力遵循可預測的冪律，就像語言模型的困惑度。 |
| HART | 「混合的 VAR 加文字」 | 文字條件的 VAR 變體，把 MaskGIT 式的迭代解碼和 VAR 的尺度結構合在一起。 |
| 尺度位置 embedding | 「（尺度、列、行）三元組」 | 位置編碼同時帶尺度索引，以及該尺度內的空間座標。 |

## Further Reading｜延伸閱讀

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) ——VAR 論文，正典參考。
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) ——DiT，拿來對照的擴散基準。
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) ——VQGAN，VAR 的多尺度 tokenizer 所延伸的那一族。
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) ——VQ-VAE，離散影像 tokenization 的基礎。
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) ——文字條件的 VAR。
