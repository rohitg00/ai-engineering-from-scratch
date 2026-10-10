# 修補、外補與影像編輯

> 文字生影像是做出新東西。修補（inpainting）是修好舊的。在正式環境（production），可計費的影像工作有 70% 是編輯——換背景、去掉標誌、把畫布延伸、把手重新生成。擴散在修補這裡才賺得回本。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## The Problem｜問題

客戶送來一張完美的產品照片，背景有一塊顯眼的招牌。你想把招牌擦掉，其他地方的像素保持完全相同。你不能從零跑文字生影像——顏色會不同、光線會不同、產品角度會不同。你只想重新生成被遮罩（mask）的那一塊，而且生成要尊重周圍的脈絡。

那就是修補。變體：

- **修補。** 在遮罩裡重新生成，外面的像素留著。
- **外補（outpainting）。** 在遮罩外面重新生成，或畫布之外，裡面留著。
- **影像編輯。** 整張重新生成，但對原圖保持語意或結構上的忠實，例如 SDEdit、InstructPix2Pix。

2026 年每條擴散管線（pipeline）都附修補模式。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit。原理相同。

## The Concept｜核心概念

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### 單純做法（naive），以及為什麼是錯的

帶著遮罩跑標準的文字生影像。每個取樣（sampling）步驟，用前向擴散（forward diffusion）過的乾淨影像，換掉帶噪潛在表示（latent）裡沒被遮罩的區域。它會動……但很差。邊界瑕疵會滲入生成結果，因為模型不知道遮罩區域裡有什麼。

### 正當的修補模型

訓練一個改過的 U-Net，輸入通道從 4 個變成 9 個：

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

多出來的通道，是 VAE 編碼過的來源影像，再加一個單通道遮罩。訓練時隨機遮住影像的一些區域，模型只對遮罩區域去噪，未遮罩區域作為乾淨的條件訊號（conditioning signal）。推論（inference）時，模型看得到遮罩周圍是什麼，補生成結果會與周圍內容連貫。

SD-Inpaint、SDXL-Inpaint、Flux-Fill 都用這種 9 通道，或類似的輸入。Diffusers 有 `StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit（Meng 等人，2022）——不用重訓的編輯

把來源影像加噪到某個中間的 `t`，再用新的 prompt 從 `t` 反向走到 0。不用重訓。起點 `t` 的選擇，是用忠實度換創作自由：

- `t/T = 0.3` → 幾乎和來源一樣，只有小的風格變化
- `t/T = 0.6` → 中等編輯，粗結構還在
- `t/T = 0.9` → 幾乎從雜訊生成，來源幾乎沒保住

### InstructPix2Pix（Brooks 等人，2023）

在 `(input_image, instruction, output_image)` 三元組上 fine-tune 一個擴散模型。推論時同時以輸入影像和文字指令為條件，例如「改成日落」、「加一條龍」。兩個 CFG 尺度：影像尺度和文字尺度。

### RePaint（Lugmayr 等人，2022）

留一個標準的無條件擴散模型。每個反向步驟重新取樣——偶爾跳回雜訊程度更高的狀態再生成。避開邊界假影（boundary artifacts）。沒有訓練好的修補模型時用這個。

```figure
inpaint-mask-reinject
```

## Build It｜動手實作

`code/main.py` 在 5 維（dimension）資料上實作玩具修補。我們在 5 維混合資料上訓練 DDPM，每個樣本是 5 個浮點數，來自兩個群集的其中一個。推論時遮住 5 個維度裡的 2 個，每一步把沒遮住的那 3 個注入前向加噪的版本，只重新生成被遮住的維度。

### 步驟 1：5 維 DDPM 資料

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 步驟 2：在全部 5 維上訓練去噪器

標準 DDPM。網路（network）對 5 維的帶噪輸入，輸出 5 維的雜訊預測。

### 步驟 3：推論時，推論時執行帶遮罩的反向過程（reverse process）

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

這是單純做法，玩具一維資料上它行得通。真的影像修補用 9 通道輸入，因為紋理連貫更要緊。

### 步驟 4：外補

外補就是把遮罩反過來的修補：遮住新的、原本不存在的畫布，其餘填原圖。訓練目標相同。

## 容易踩的坑

- **接縫。** 單純做法會留下看得到的邊界，因為梯度（gradient）資訊穿不過遮罩。修法：把遮罩膨脹（mask dilation）8 到 16 個像素，或用正當的修補模型。
- **遮罩外漏。** 條件影像裡沒遮住的區域如果品質差或很吵，會污染遮罩裡的生成。稍微去噪或模糊。
- **CFG 和遮罩大小會交互。** 小遮罩配高 CFG，等於一塊飽和的補丁。小編輯把 CFG 降下來。
- **SDEdit 的忠實度斷崖。** 從 `t/T = 0.5` 走到 `t/T = 0.6`，主體身份可能就沒了。要掃描，並留下檢查點。
- **prompt 對不上。** prompt 應該描述*整張*影像，不只是新內容。「一隻貓坐在椅子上」，不是「一隻貓」。

## Use It｜實際應用

| 任務 | 管線 |
|------|----------|
| 去掉物體，遮罩小 | SD-Inpaint 或 Flux-Fill，用標準 prompt |
| 換天空 | SD-Inpaint 加「日落時的藍天」 |
| 延伸畫布 | SDXL 的外補模式，8 像素羽化；或 Flux-Fill 配外補遮罩 |
| 把手或臉重新生成 | SD-Inpaint，prompt 重新描述主體，再加 ControlNet-Openpose |
| 改一個區域的風格 | 在遮罩區域上做 SDEdit，`t/T=0.5` |
| 「改成日落」 | InstructPix2Pix 或 Flux-Kontext |
| 換背景 | SAM 遮罩，再進 SD-Inpaint |
| 超高忠實度 | 最難的案例用 Flux-Fill，或託管的 GPT-Image |

SAM（Meta 的 Segment Anything，2023）加擴散修補，是 2026 年的去背管線。SAM 2（2024）在影片（video）上也能用。

## Ship It｜交付成果

存成 `outputs/skill-editing-pipeline.md`。這個 skill 吃原圖、編輯描述、可選的遮罩或 SAM prompt，輸出：遮罩怎麼產生、基模型、CFG 尺度（影像加文字）、SDEdit 的 t 或修補模式，以及品檢清單。

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 裡，把被遮住的維度比例從 0.2 變到 0.8。比例到多少，修補品質（遮罩維度上的殘差）會和無條件生成一樣？
2. **中等。** 實作 RePaint：每 10 個反向步驟，往回跳 5 步（加噪）再去噪。量它是否減少遮罩邊緣的遮罩邊界的殘差。
3. **困難。** 用 Hugging Face diffusers 比較：SD 1.5 Inpaint 加 ControlNet-Openpose，對上 Flux.1-Fill，做 20 個臉部重新生成任務。姿勢貼合和身份保留分開打分。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 修補 | 「把洞填上」 | 在遮罩裡重新生成；外面的像素留著。 |
| 外補 | 「把畫布延伸」 | 在畫布外面重新生成；裡面留著。 |
| 9 通道 U-Net | 「正當的修補模型」 | 輸入是 `noisy \| encoded-source \| mask` 的 U-Net。 |
| SDEdit | 「帶雜訊程度的圖生圖」 | 加噪到時間 `t`，再用新 prompt 去噪。 |
| InstructPix2Pix | 「只用文字的編輯」 | 在（影像、指令、輸出）三元組上 fine-tune 過的擴散。 |
| RePaint | 「不用重訓」 | 反向過程中定期再加噪，減少接縫。 |
| SAM | 「Segment Anything」 | 用點選或方框產生遮罩；和修補搭配。 |
| Flux-Kontext | 「帶脈絡的編輯」 | 接受參考影像加指令來編輯的 Flux 變體。 |

## 正式環境筆記：編輯管線對延遲很敏感

使用者編一張影像，期待來回不到 5 秒。1024² 上 30 步的 SDXL-Inpaint，在 L4 上是 3 到 4 秒，再加上 SAM 產生遮罩（約 200 ms）和 VAE 編碼／解碼（合計約 500 ms）。用正式環境的框法，這是被首 token 時間（TTFT）卡住，不是被吞吐量（throughput）卡住——批次（batch）是 1，並行度低，每個階段都要壓到最小：

- **慢的是 SAM-H。** 1024² 的 SAM-H 約 200 ms；SAM-ViT-B 約 40 ms，品質只掉一點。SAM 2（影片）多了時間軸的開銷；單張影像編輯不要用它。
- **能略過 VAE 編碼就跳過。** `pipe.image_processor.preprocess(img)` 把影像編碼成潛在表示。如果上一次生成的潛在表示還在——迭代編輯的介面通常留著——用 `latents=...` 直接傳，跳過一次 VAE 編碼。
- **遮罩膨脹也影響吞吐量。** 遮罩小，表示 U-Net 前向傳遞大多是浪費的，沒遮住的像素反正會被夾住。`diffusers` 的 `StableDiffusionInpaintPipeline` 無論如何都跑完整個 U-Net；只有 9 通道的正當修補變體才利用遮罩區域的運算。
- **Flux-Kontext 是 2025 的答案。** 對 `(source_image, instruction)` 做一次前向傳遞——沒有分開的遮罩，也沒有 SDEdit 的雜訊掃描。在 H100 上單次編輯約 1.5 秒。架構上的教訓：把合併處理階段。

## Further Reading｜延伸閱讀

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) ——不用訓練的修補。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) ——SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) ——文字指令編輯。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) ——SAM，遮罩的來源。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) ——影片版 SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) ——注意力層級的編輯。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) ——2024 的工具。
