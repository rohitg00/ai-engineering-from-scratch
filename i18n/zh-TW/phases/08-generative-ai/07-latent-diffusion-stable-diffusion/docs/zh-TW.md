# 潛在擴散與 Stable Diffusion

> 在 512×512 的影像上做像素空間擴散（pixel-space diffusion），運算成本高到離譜。Rombach 等人（2022）注意到，生成一張影像不需要所有 78.6 萬個維度（dimension）——你需要的是夠抓住語意結構的那些，其餘交給另外一個解碼器（decoder）。在 VAE 的潛在空間（latent）裡跑擴散。那一個想法就是 Stable Diffusion。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## The Problem｜問題

512² 的像素空間擴散，表示 U-Net 跑在形狀 `[B, 3, 512, 512]` 的張量上。5 億參數（parameter）的 U-Net，每個取樣（sampling）步驟大約 100 GFLOPS。50 步就是每張影像 5 TFLOPS。拿 10 億張影像來訓練，運算成本高得驚人。

那些 FLOPs 大多花在把知覺上不重要的細節推過網路（network）——高頻紋理，有損的 VAE 本來就能壓掉。Rombach 的想法：VAE 只訓練一次，這是*第一階段*，然後凍住，擴散完全跑在 4 通道、64×64 的潛在空間，這是*第二階段*。同一個 U-Net。像素數量為原來的 16 分之一。相近品質下，FLOPs 大約少到 64 分之一。

這就是 Stable Diffusion 的配方。SD 1.x／2.x 用 8.6 億參數的 U-Net，潛在表示是 `64×64×4`；SDXL 用 26 億參數的 U-Net，潛在表示是 `128×128×4`；SD3 把 U-Net 換成擴散 transformer（DiT），配流匹配（flow matching）。Flux.1-dev（Black Forest Labs，2024）出貨的是 120 億參數的 DiT-MMDiT。全部都建立在同一套兩階段架構上。

## The Concept｜核心概念

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**兩個階段，分開訓練。**

1. **第一階段——VAE。** 編碼器 `E(x) → z`，解碼器 `D(z) → x`。目標壓縮：每個空間軸下採樣 8 倍，再調整通道，讓潛在表示的總元素數約為像素數的 16 分之一。損失（loss）＝重建（L1 加 LPIPS 知覺）加 KL，KL 權重小，所以 `z` 不會被逼得太像高斯，因為我們不需要從 `z` 做精確取樣。常常再加對抗損失（adversarial loss），讓解碼出來的影像銳。
2. **第二階段——在 `z` 上擴散。** 把 `z = E(x_real)` 當成資料。訓練一個 U-Net 或 DiT 去噪 `z_t`。推論（inference）時：用擴散抽出 `z_0`，然後 `x = D(z_0)`。

**文字條件（text conditioning）。** 另外兩個元件（component）。一個凍住的文字編碼器：SD 1.x 用 CLIP-L，SD 2／XL 用 CLIP-L 加 OpenCLIP-G，SD3 和 Flux 用 T5-XXL。一個交叉注意力（cross-attention）注入：每個 U-Net 區塊吃 `[Q = image features, K = V = text tokens]`，並將兩者融合。這些 token 是文字影響影像的唯一途徑。

**損失函數和第 06 課相同。** 同樣是 DDPM 或流匹配對雜訊的均方誤差（MSE）。你只是換掉資料所在的領域。

## 架構變體

| 模型 | 年份 | 骨幹 | 潛在形狀 | 文字編碼器 | 參數 |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L，77 個 token | 8.6 億 |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 8.65 億 |
| SDXL | 2023 | U-Net 加精煉器（refiner） | 128×128×4 | CLIP-L 加 OpenCLIP-G | 26 億加 66 億 |
| SDXL-Turbo | 2023 | 蒸餾過的 | 128×128×4 | 相同 | 1 到 4 步取樣 |
| SD3 | 2024 | MMDiT，多模態 DiT | 128×128×16 | T5-XXL 加 CLIP-L 加 CLIP-G | 20 億／80 億 |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL 加 CLIP-L | 120 億 |
| Flux.1-schnell | 2024 | 蒸餾過的 MMDiT | 128×128×16 | T5-XXL 加 CLIP-L | 120 億，1 到 4 步 |

趨勢是：用 DiT 換掉 U-Net，也就是潛在圖塊上的 transformer；把文字編碼器做大，T5 在 prompt 遵循度上勝過 CLIP；潛在通道從 4 加到 16，細節的餘裕更大。

```figure
noise-schedule
```

## Build It｜動手實作

`code/main.py` 在第 06 課的 DDPM 上疊一個玩具一維「VAE」，恆等的編碼器加解碼器，只為示範；真的 VAE 會是卷積網路。再加上帶無分類器引導（classifier-free guidance）的類別條件。它顯示：同一份擴散損失，跑在原始一維數值上或編碼後的數值上都可以——這是關鍵。

### 步驟 1：編碼器／解碼器

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

真的 VAE 有訓練好的權重。教學上，這個線性映射就夠說明：擴散作用在 `z` 上，不依賴原本的資料空間。

### 步驟 2：在 `z` 空間裡擴散

和第 06 課同一個 DDPM。網路看到的資料是 `z = E(x)`。抽出 `z_0` 之後，用 `D(z_0)` 解碼。

### 步驟 3：無分類器引導

訓練時，10% 的時間丟掉類別標籤（label），換成空 token（null token）。推論時同時算 `ε_cond` 和 `ε_uncond`，然後：

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` 等於沒有引導，多樣性完整；`w = 3` 是預設；`w = 7+` 是飽和、過銳。

### 步驟 4：文字條件，概念，不是程式

用凍住的文字編碼器輸出換掉類別標籤。透過交叉注意力把文字 embedding 送進 U-Net：

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

這是類別條件擴散模型與 Stable Diffusion 之間唯一重要的差異。

## 容易踩的坑

- **VAE 縮放因子不一致。** SD 1.x 的 VAE 在編碼後有一個縮放常數，`scaling_factor ≈ 0.18215`。忘了這個，U-Net 訓練的潛在表示變異數（variance）會差很遠。每個檢查點都帶一個。
- **文字編碼器不聲不響地錯。** SD3 需要 T5-XXL，而且至少 128 個 token；退回只用 CLIP 會遺失資訊。一定要確認 `use_t5=True`，不然 prompt 忠實度會崩。
- **混用潛在空間。** SDXL、SD3、Flux 用的 VAE 都不同。在 SDXL 潛在表示上訓練的 LoRA，到 SD3 不會動。Hugging Face diffusers 0.30 以後拒絕載入對不上的檢查點。
- **CFG 太高。** `w > 10` 會產出飽和、油膩的影像，過度擬合（overfit）prompt，代價是多樣性。甜蜜點（sweet spot）是 `w = 3-7`。
- **負面 prompt 洩漏。** 空的負面 prompt 會變成空 token；填了內容的負面 prompt 會變成 `ε_uncond`。這兩件事不一樣。有些管線（pipeline）會不聲不響地預設成空 token。

## Use It｜實際應用

2026 年正式環境（production）的組合：

| 目標 | 建議的骨幹 |
|--------|----------------------|
| 窄領域、有配對資料、從零訓練一個模型 | SDXL fine-tune，LoRA 或全量——出貨速度最快 |
| 開放領域的文字生影像、開放權重 | Flux.1-dev，120 億，Apache／非商業；或 SD3.5-Large |
| 推論最快、開放權重 | Flux.1-schnell，1 到 4 步，Apache；或 SDXL-Lightning |
| prompt 貼合最好、託管的 | GPT-Image／DALL-E 3，目前仍是；Midjourney v7、Imagen 4 |
| 編輯工作流程 | Flux.1-Kontext（2024 年 12 月）——原生就吃影像加文字 |
| 研究、基準模型（baseline） | SD 1.5——老，但研究得很透 |

## Ship It｜交付成果

存成 `outputs/skill-sd-prompter.md`。這個 skill 吃一段文字 prompt 和目標風格，輸出：模型和檢查點、CFG 尺度、取樣器、負面 prompt、解析度、可選的 ControlNet／IP-Adapter 組合，以及逐步的品檢清單。

## Exercises｜練習

1. **簡單。** 用引導 `w ∈ {0, 1, 3, 7, 15}` 跑 `code/main.py`。記下每個類別的樣本平均。`w` 到多少，類別平均會超過真實資料的平均？
2. **中等。** 把玩具線性編碼器換成一對 tanh MLP 編碼器／解碼器，加上重建損失。在新的潛在表示上重訓擴散。樣本品質會變嗎？
3. **困難。** 用 diffusers 架一個真的 Stable Diffusion 推論：載入 `sdxl-base`，CFG＝7，跑 30 步 Euler，計時。再換成 `sdxl-turbo`，4 步、CFG＝0。同一個主題、品質不同——描述變了什麼、為什麼。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 第一階段 | 「那個 VAE」 | 訓練好的編碼器／解碼器對；把 512² 壓成 64²。 |
| 第二階段 | 「那個 U-Net」 | 在潛在空間上的擴散模型。 |
| CFG | 「引導尺度」 | `(1+w)·ε_cond - w·ε_uncond`；調條件的強度。 |
| 空 token | 「空的 prompt embedding」 | 無條件 embedding，用來算 `ε_uncond`。 |
| 交叉注意力 | 「文字怎麼進來」 | 每個 U-Net 區塊把文字 token 當 K 和 V 來注意。 |
| DiT | 「擴散 transformer」 | 用潛在圖塊上的 transformer 換掉 U-Net；規模拉大時比較好。 |
| MMDiT | 「多模態 DiT」 | SD3 的架構：文字流和影像流，用聯合注意力。 |
| VAE 縮放因子 | 「魔術數字」 | 把潛在表示除以大約 5.4，讓擴散在單位變異數的空間裡運作。 |

## 正式環境筆記：在 8 GB 的消費級 GPU 上跑 Flux-12B

參考用的 Flux 整合，是「我有一張消費級 GPU，能不能出貨」的標準配方。手法和正式環境推論文獻列的三個旋鈕一樣，用在擴散 DiT 上：

1. **錯開載入。** Flux 有三個從來不需要同時待在 VRAM 的網路：T5-XXL 文字編碼器（fp32 約 10 GB）、CLIP-L（小）、120 億參數的 MMDiT，以及 VAE。先把 prompt 編碼，*刪掉*編碼器，載入 DiT，去噪，*刪掉* DiT，載入 VAE，解碼。消費級 8 GB GPU 一次只裝得下一個階段。
2. **用 bitsandbytes 做 4 位元量化（quantization）。** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)` 加在 T5 編碼器和 DiT 上。記憶體（memory）砍到 8 分之一，文字生影像的品質落差依 Aritra 的基準幾乎看不出來，連結在 notebook 裡。
3. **CPU 卸載（CPU offload）。** `pipe.enable_model_cpu_offload()` 會在每次前向傳遞時，自動把模組在 CPU 和 GPU 之間對調。延遲（latency）多 10% 到 20%，但管線至少跑得起來。

記憶體帳是：量化後的 `10 GB T5 / 8 = 1.25 GB`，量化後的 DiT 是 `12 B params × 0.5 bytes = ~6 GB`，再加上活化（activation）。用 stas00 的說法，這是 TP＝1 推論的極端：沒有模型平行，量化拉到最大。正式環境會在 H100 上跑 TP＝2 或 TP＝4；單一開發筆電，這就是配方。

## Further Reading｜延伸閱讀

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) ——Stable Diffusion。
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) ——SDXL。
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) ——DiT。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) ——SD3、MMDiT。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) ——CFG。
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) ——Flux.1 家族。
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) ——上面每個檢查點的參考實作。
