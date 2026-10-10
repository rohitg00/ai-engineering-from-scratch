# 條件 GAN 與 Pix2Pix

> 2014 到 2017 年的第一個大突破，是控制 GAN 造什麼。提供標籤、影像或句子作為條件。Pix2Pix 做的是影像那一版，在窄的影像到影像任務上，到現在仍打得過每個通用的文字生影像模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## The Problem｜問題

取樣。展示很好用，正式環境（production）裡沒用。你要的是：*素描映成照片*、*地圖映成航照*、*白天場景映成夜晚*、*把灰階上色*。這些全都是：給你一張輸入影像 `x`，你必須輸出語意對得起來的 `y`。每個 `x` 都有很多說得通的 `y`。均方誤差（MSE）把它們壓成糊。對抗損失（loss）不會，因為「看起來像真的」是銳的。

條件 GAN（Mirza 與 Osindero，2014）把條件 `c` 同時送進 `G` 和 `D`。Pix2Pix（Isola 等人，2017）把它特化：條件是一整張輸入影像，產生器是 U-Net，鑑別器是*以圖塊為基礎*的分類器，也就是 PatchGAN，損失是對抗加 L1。這個配方在 2026 年的窄影像到影像領域，仍然打得過從零訓練的文字生影像模型，因為它用*配對資料（paired data）*訓練——你所需的訊號正好齊備。

## The Concept｜核心概念

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**條件產生器。** `G(x, z) → y`。在 Pix2Pix 裡，`z` 是 G 內部的 dropout，沒有輸入雜訊——Isola 發現明確給的雜訊會被無視。

**條件鑑別器。** `D(x, y) → [0, 1]`。輸入是*一對*，條件和輸出。關鍵差別在這：D 要判斷 `y` 和 `x` 一不一致，不只是 `y` 看起來像不像真的。

**U-Net 產生器。** 編碼器–解碼器，瓶頸兩側有跳躍連接（skip connection）。輸入和輸出共享低層結構的任務很需要它，例如邊緣、輪廓。沒有跳躍連接，高頻細節就會流失。

**PatchGAN 鑑別器。** D 不輸出單一的真假分數，而輸出一張 `N×N` 的格子，每一格判斷大約 70×70 像素的感受野（receptive field），再平均。這是馬可夫隨機場（Markov random field）假設：像真的是局部的。訓練快很多，參數（parameter）更少，輸出更銳。

**損失。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 項讓訓練穩，並把 G 推向已知目標。L1 的邊緣比 L2 銳，因為它要的是中位數，不是平均數。`λ = 100` 是 Pix2Pix 的預設。

## CycleGAN——沒有配對的時候

Pix2Pix 需要配對的 `(x, y)` 資料。CycleGAN（Zhu 等人，2017）拿掉這個要求，代價是多一個損失：*循環一致（cycle consistency）*損失。兩個產生器，`G: X → Y` 和 `F: Y → X`。訓練到 `F(G(x)) ≈ x`，而且 `G(F(y)) ≈ y`。這樣沒有配對範例，也能把馬變成斑馬、夏天變成冬天。

2026 年，不成對的影像到影像大多改走擴散，例如 ControlNet、IP-Adapter，而不是 CycleGAN。但循環一致這個想法，幾乎每篇不成對領域調適（domain adaptation）的論文都還在。

```figure
gx-patchgan
```

## Build It｜動手實作

`code/main.py` 在一維資料上實作迷你條件 GAN。條件 `c` 是類別標籤（label），0 或 1。任務：給定類別，從那個條件分布（distribution）產生一個樣本。

### 步驟 1：條件接到 G 和 D 的輸入

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

獨熱編碼（one-hot）是最簡單的做法。較大的模型用學來的 embedding、FiLM 調變，或交叉注意力（cross-attention）。

### 步驟 2：訓練條件模型

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

產生器必須貼合*給定條件下*的真實分布，不是邊際分布（marginal）。

### 步驟 3：逐類別檢查輸出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 容易踩的坑

- **條件被無視。** G 學的是邊際，D 從不懲罰，因為條件信號太弱。修法：更積極地把條件送進 D，放在早層，不只是晚層；或用投影鑑別器（projection discriminator，Miyato 與 Koyama 2018）。
- **L1 權重太低。** G 漂向任意看起來像真的輸出，不忠於目標。Pix2Pix 風格的任務從 λ≈100 開始。
- **L1 權重太高。** G 的輸出會糊，因為 L1 仍是 L_p 範數。訓練一穩就把權重退火降下來。
- **D 的輸入漏了真實配對。** 把 `(x, y)` 串起來當 D 的輸入，不能只有 `y`。沒有這個，D 查不了一致性。
- **各類別各自的模式崩塌。** 每個類別都可能獨立崩塌。要跑類別條件的多樣性檢查。

## Use It｜實際應用

2026 年影像到影像任務的現況：

| 任務 | 最好的做法 |
|------|---------------|
| 素描 → 照片，同一領域、有配對 | Pix2Pix／Pix2PixHD，仍然快、仍然銳 |
| 素描 → 照片，沒配對 | ControlNet，配塗鴉條件模型 |
| 語意分割 → 照片 | SPADE／GauGAN2，或 SD 加 ControlNet-Seg |
| 風格轉換 | 擴散配 IP-Adapter 或 LoRA；GAN 做法已經舊了 |
| 深度 → 照片 | Stable Diffusion 上的 ControlNet-Depth |
| 超解析度 | Real-ESRGAN（GAN）、ESRGAN-Plus，或 SD-Upscale（擴散） |
| 上色 | ColTran、以擴散為基礎的上色器，或 Pix2Pix-color |
| 白天 → 夜晚、季節、天氣 | CycleGAN，或以 ControlNet 為基礎 |

Pix2Pix 仍然是對的工具，當 (a) 你有幾千對配對範例，(b) 任務窄而且可重複，(c) 你需要快速推論（inference）。在通用的開放領域任務上，擴散較佔優勢。

## Ship It｜交付成果

存成 `outputs/skill-img2img-chooser.md`。這個 skill 吃任務描述、資料情況，配對或不成對、樣本數 N，以及延遲（latency）和品質預算，然後輸出：做法，Pix2Pix、CycleGAN、ControlNet 變體，或 SDXL 加 IP-Adapter；訓練資料需求；推論成本；和評估協議，LPIPS、FID、任務專用的。

## Exercises｜練習

1. **簡單。** 改 `code/main.py`，加上第三個類別。確認 G 仍把每個類別的雜訊映到正確的模式。
2. **中等。** 在一維設定裡用知覺式損失換掉 L1，例如一個凍住的小 D 當特徵（feature）抽取器。條件分布的銳利程度會變嗎？
3. **困難。** 在一維設定裡勾一個 CycleGAN：兩個分布、兩個產生器、循環損失。展示在沒有配對資料的情況下，它也能學到兩者之間的映射。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 條件 GAN | 「帶標籤的 GAN」 | G(z, c)、D(x, c)。兩個網路（network）都看得到條件。 |
| Pix2Pix | 「影像到影像的 GAN」 | 配對的 cGAN，U-Net 產生器、PatchGAN 鑑別器，加 L1 損失。 |
| U-Net | 「帶跳躍的編碼器–解碼器」 | 對稱的卷積網路；跳躍保住高頻。 |
| PatchGAN | 「局部像真的分類器」 | D 輸出的是每個圖塊的分數，不是全域分數。 |
| CycleGAN | 「不成對的影像轉譯」 | 兩個 G，加上循環一致損失；不需要配對資料。 |
| SPADE | 「GauGAN」 | 用語意地圖正規化（normalization）中間的活化（activation）；從分割到影像。 |
| FiLM | 「逐特徵線性調變」 | 用條件對每個特徵做仿射變換；加條件很便宜。 |

## 正式環境筆記：延遲卡死時，Pix2Pix 是基準（baseline）

有配對資料、任務又窄的時候，素描到成圖、語意地圖到照片、白天到夜晚，Pix2Pix 的一次到位推論，延遲比擴散快上一個數量級。正式環境的比較通常是：

| 路徑 | 步數 | 單張 L4 上 512² 的典型延遲 |
|------|-------|----------------------------------------|
| Pix2Pix，U-Net 前向傳遞 | 1 | 約 30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | 約 1.2 s |
| SDXL-Turbo Img2Img | 1 到 4 | 約 0.15 到 0.35 s |
| ControlNet 加 SDXL 基模型 | 20 到 30 | 約 3 到 5 s |

Pix2Pix 在靜態批次（batch）上的吞吐量（throughput）贏，每個請求的 FLOPs 都一樣。擴散在品質和泛化（generalization）上贏。現在常見的打法，是窄任務出貨一個 Pix2Pix 風格的蒸餾模型，對少數邊界輸入則退回擴散。

## Further Reading｜延伸閱讀

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) ——cGAN 那篇。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) ——Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) ——CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) ——Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) ——SPADE／GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) ——投影鑑別器。
