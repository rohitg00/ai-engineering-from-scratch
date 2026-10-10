# 生成模型——分類與歷史

> 每個影像模型、文字模型、影片模型和 3D 模型，都落在五種類型的其中一個。選錯桶，你會跟數學纏鬥好幾個星期。選對了，就能清楚掌握這個領域過去十二年的進展。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## The Problem｜問題

生成模型只做一件事：給定從某個未知分布（distribution）`p_data(x)` 抽出的訓練樣本，輸出看起來像來自同一分布的新樣本。臉、句子、MIDI 檔、蛋白質結構——粗略來看，都是同一題。

難處是 `p_data` 住在有幾百萬個維度（dimension）的空間裡（一張 512×512 的 RGB 影像大約 78.6 萬維），樣本坐在那個空間裡薄薄的一層流形（manifold）上，而你大概只有 1000 萬個例子。硬算密度（density）沒有希望。每個生成模型都是妥協，把一個難題換成稍微不那麼難的題。

過去十二年活下來的有五族。知道每一族做了哪種妥協，你就知道它為什麼在某些任務上贏、在另一些上垮。

## The Concept｜核心概念

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. 顯式密度，算得出來。** 把 `log p(x)` 寫成你真的能算的一個和。自迴歸（autoregressive）模型（PixelCNN、WaveNet、GPT）把聯合機率拆成 `p(x) = ∏ p(x_i | x_<i)`。正規化流（normalizing flow，RealNVP、Glow）把 `p(x)` 建成簡單基底分布的可逆變換。好處：精確概似（likelihood）、乾淨的訓練損失（loss）。壞處：自迴歸的推論（inference）是序列的，長序列很慢；流需要可逆架構，架構上很受限制。

**2. 顯式密度，近似。** 從下方框住 `log p(x)`，這個下界叫證據下界（ELBO），再最佳化這個下界。VAE（Kingma 2013）用編碼器–解碼器（encoder–decoder）配變分後驗（variational posterior）。擴散模型（DDPM，Ho 2020）訓練一個去噪器，隱含地調高一個加權的 ELBO。2026 年，擴散是影像、影片和 3D 的主要骨幹（backbone）。

**3. 隱式密度。** 完全跳過密度；學一個產生器（generator）`G(z)` 來產生樣本，和一個鑑別器（discriminator）`D(x)` 來分辨真假。GAN（Goodfellow 2014）。推論很快，一次前向傳遞（forward pass），但訓練時出了名地不穩。StyleGAN 1／2／3 到 2026 年仍是固定領域照片級寫實（臉、臥室）的前沿。

**4. 以分數為基礎／連續時間。** 直接學對數密度的梯度（gradient）`∇_x log p(x)`，也就是分數（score）。Song 與 Ermon（2019）指出分數匹配（score matching）把擴散推廣成一個 SDE。流匹配（flow matching，Lipman 2023）是 2024 到 2026 的熱門：訓練不用模擬、路徑更直、取樣（sampling）比 DDPM 快 4 到 10 倍。Stable Diffusion 3、Flux、AudioCraft 2 都用流匹配。

**5. 離散碼上的 token 自迴歸。** 用 VQ-VAE 或殘差量化器把高維資料壓成一串短的離散 token，再用 Transformer 建模 token 序列。Parti、MuseNet、AudioLM、VALL-E、Sora 的圖塊 tokenizer 都這樣。這是第 1 桶加上一個學來的 tokenizer。

## 簡史

| 年份 | 模型 | 為什麼要緊 |
|------|-------|-----------------|
| 2013 | VAE（Kingma） | 第一個有可用訓練損失的深度生成模型。 |
| 2014 | GAN（Goodfellow） | 隱式密度、沒有概似——樣本銳利得嚇人。 |
| 2015 | DRAW、PixelCNN | 序列式的影像生成。 |
| 2017 | Glow、RealNVP | 可逆流；模型有深度，概似仍然精確。 |
| 2017 | Progressive GAN | 第一批百萬像素的臉。 |
| 2019 | StyleGAN／StyleGAN2 | 那個領域的照片級寫實臉，到現在仍難打。 |
| 2020 | DDPM（Ho） | 擴散變得實用。 |
| 2021 | CLIP、DALL-E 1、VQGAN | 文字生影像走進主流。 |
| 2022 | Imagen、Stable Diffusion 1、DALL-E 2 | 潛在（latent）擴散加文字條件（conditioning），變成日常工具。 |
| 2022 | ControlNet、LoRA | 對已經預訓練（pretrained）過的擴散做精細控制。 |
| 2023 | SDXL、Midjourney v5、流匹配 | 規模，加上更好的訓練動態。 |
| 2024 | Sora、Stable Diffusion 3、Flux.1 | 影片擴散；流匹配勝出。 |
| 2025 | Veo 2、Kling 1.5、Runway Gen-3、Nano Banana | 生產級影片。 |
| 2026 | Consistency 加整流流（rectified flow） | 從擴散骨幹做一步取樣。 |

## 五個問題的分診

新的生成模型論文一出來，讀方法之前先回答這五題。

1. **在建模什麼？** 像素、潛在表示、離散 token、3D Gaussian、網格、波形？
2. **密度是顯式還是隱式？** 他們有沒有寫下 `log p(x)`？
3. **取樣：一次到位還是迭代？** 迭代表示推論較慢；一次到位通常是對抗，或蒸餾（distillation）。
4. **條件：無條件、類別、文字、影像、姿勢？** 這決定損失和架構的鷹架。
5. **評估：FID、CLIP score、IS、人類偏好、任務準確率（accuracy）？** 每一個都有已知的失敗模式（見第 14 課）。

這一階段的每一課，你都會再答一次這五題。到最後，它們會變成反射。

```figure
autoencoder-bottleneck
```

## Build It｜動手實作

這一課的程式是一個輕量視覺化：用三種玩具做法，核密度（kernel density）、離散直方圖、以及最近樣本的「有 GAN 味道」產生器，從樣本擬合一維高斯混合，讓你在一個螢幕印得出來的問題上看見顯式密度和隱式密度的差別。

跑 `code/main.py`。它從雙峰高斯混合抽 2000 個樣本，然後印出：

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

注意：前兩個讓你問「這一點有多可能？」第三個不能。這就是之後每一課都要緊的*顯式對隱式*分別。

## Use It｜實際應用

2026 年，哪一族配哪種任務？

| 任務 | 最好的一族 | 為什麼 |
|------|-------------|-----|
| 照片級寫實的臉、窄領域 | StyleGAN 2／3 | 仍然最銳，推論最快。 |
| 一般文字生影像 | 潛在擴散加流匹配 | SD3、Flux.1、DALL-E 3。 |
| 快速文字生影像 | 整流流加蒸餾 | SDXL-Turbo、SD3-Turbo、LCM。 |
| 文字生影片 | Diffusion Transformer 加流匹配 | Sora、Veo 2、Kling。 |
| 語音加音樂 | 以 token 為基礎的自迴歸（AudioLM、VALL-E、MusicGen），或流匹配（AudioCraft 2） | 離散 token 把規模做大很便宜。 |
| 3D 場景 | 高斯濺射擬合、擴散先驗 | 3D-GS 做重建，擴散做新視角。 |
| 密度估計（不取樣） | 流 | 唯一有精確 `log p(x)` 的一族。 |
| 模擬／物理 | 流匹配、分數 SDE | 直線路徑、平滑的向量場。 |

## Ship It｜交付成果

存成 `outputs/skill-model-chooser.md`。

這個 skill 吃一段任務描述，輸出：(1) 用哪一族，(2) 三個開源和三個託管選項的排序清單，(3) 你該盯的可能失敗模式，(4) 運算和時間預算。

## Exercises｜練習

1. **簡單。** 這五個產品各是哪一族、什麼骨幹：ChatGPT image、Midjourney v7、Sora、Runway Gen-3、ElevenLabs。證據要來自公開技術報告。
2. **中等。** 你明天要讀的論文宣稱取樣比擴散快 100 倍。寫下三個問題，檢查加上條件和高解析度之後，這個加速還在不在。
3. **困難。** 挑一個你在乎的領域，例如蛋白質結構、CAD、分子、軌跡。對那個領域目前最強的模型回答五個分診問題，並勾出更好的模型會改掉什麼。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 生成模型 | 「它做出新東西」 | 學一個 `p_data(x)` 的取樣器，可選地給出 `log p(x)`。 |
| 顯式密度 | 「你能把它算出來」 | 模型提供閉式或算得出來的 `log p(x)`。 |
| 隱式密度 | 「GAN 那種」 | 只有取樣器——沒辦法計算給定一點的 `p(x)`。 |
| ELBO | 「證據下界」 | `log p(x)` 上一個算得出來的下界；VAE 和擴散調的是它。 |
| 分數 | 「對數密度的梯度」 | `∇_x log p(x)`；擴散和 SDE 模型學的是這個場。 |
| 流形假設 | 「資料住在一個面上」 | 高維資料集中在低維流形上；這就是降維（dimensionality reduction）行得通的原因。 |
| 自迴歸 | 「預測下一塊」 | 把聯合機率拆成條件機率的乘積。 |
| 潛在表示 | 「壓縮過的碼」 | 低維表示，解碼器可以從它重建輸入。 |

## 正式環境筆記：五族、五種推論形狀

每一族對到不同的推論伺服器成本曲線。正式環境推論（production inference）的文獻把 LLM 推論框成預填（prefill）加解碼；同一套拆法在這裡也適用：

- **自迴歸（第 1 和第 5 桶）。** 序列解碼主導延遲（latency）；KV cache、連續批次（continuous batching）、推測解碼（speculative decoding）都直接適用。
- **VAE／擴散／流匹配（第 2 和第 4 桶）。** 沒有 LLM 那種解碼。成本 = `num_steps × step_cost`，而 `step_cost` 是 transformer 或 U-Net 在完整潛在解析度上的一次前向傳遞。正式環境的旋鈕是步數（DDIM／DPM-Solver／蒸餾）、批次（batch）大小、和精度（precision），也就是 bf16／fp8／int4。
- **GAN（第 3 桶）。** 一次前向傳遞。沒有雜訊排程，也沒有 KV cache。首 token 時間（TTFT）約等於總延遲。這就是為什麼 StyleGAN 在窄領域的使用體驗上仍然贏。

論文摘要裡看到「比擴散快」，把它讀成「步數更少乘上同樣的單步成本」，或「同樣的步數乘上更便宜的單步成本」。其他都是行銷。

## Further Reading｜延伸閱讀

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) ——GAN 那篇。
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) ——VAE 那篇。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) ——DDPM 那篇。
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) ——把擴散看成 SDE。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) ——流匹配那篇。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) ——Stable Diffusion 3。
