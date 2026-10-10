# ControlNet、LoRA 與條件（conditioning）

> 只有文字，是不夠精確的控制訊號。ControlNet 讓你複製一個預訓練的擴散模型，再用深度圖、姿勢骨架、塗鴉或邊緣影像來駕馭它。LoRA 讓你 fine-tune 一個 20 億參數（parameter）的模型，實際只訓練 1000 萬個參數。兩者合起來，把 Stable Diffusion 從玩具變成 2026 年每家代理商都在出貨的影像管線（pipeline）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## The Problem｜問題

像「一個穿紅裙子的女人，在熱鬧的街上遛狗」這種 prompt，沒告訴模型狗在*哪裡*、女人是*什麼姿勢*、街道是*什麼透視*。文字大約只能指定描述一張影像所需資訊的 10%。其餘是視覺的，沒辦法用文字有效描述。

每種訊號都從零訓練一個新的條件模型，姿勢、深度、Canny、分割，成本高到難以實行。你想把 26 億參數的 SDXL 骨幹（backbone）凍住，接上一個小的旁路網路（network）去讀取條件，並調整骨幹的中間特徵（feature）。那就是 ControlNet。

你也想教模型新概念（你的臉、你的產品、你的風格），卻不要重訓整個模型。你要一個小到 100 分之一的差值。那就是 LoRA——插進既有注意力（attention）權重的低秩配接器（low-rank adapter）。

ControlNet 加 LoRA 加文字，就是 2026 年實作者的工具箱。大多數正式環境（production）的影像管線，會在 SDXL／SD3／Flux 基模型（base model）上疊 2 到 5 個 LoRA、1 到 3 個 ControlNet，再加一個 IP-Adapter。

## The Concept｜核心概念

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet（Zhang 等人，2023）

拿一個預訓練的 SD。*複製* U-Net 的編碼器那一半。原版凍住。訓練複本去接受額外的條件輸入，邊緣、深度、姿勢。用*零卷積（zero convolution）*的跳躍連接（skip connection）把複本接回原版的解碼器那一半：1×1 卷積初始化成零——一開始是空操作，再學一個差值。

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

零卷積的初始化表示 ControlNet 一開始是恆等（identity）——訓練前也不會造成損害。用 100 萬組（prompt、條件、影像）三元組，配標準擴散損失（loss）來訓練。

每種模態的 ControlNet 都以小型旁路模型出貨，SDXL 大約 3.6 億，SD 1.5 大約 7000 萬。推論（inference）時可以把它們疊起來：

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA（Hu 等人，2021）

模型裡任何線性層（linear layer） `W ∈ R^{d×d}`，凍住 `W`，加上一個低秩（rank）差值：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

而且 `r << d`。注意力的標準是秩 4 到 16，高秩 fine-tuning是秩 64 到 128。新參數的數量是 `2 · d · r`，不是 `d²`。SDXL 的注意力 `d=640`、`r=16`：每個配接器 2 萬個參數，不是 41 萬——少到 20 分之一。放到整個模型，LoRA 通常是 20 到 200 MB，基模型是 5 GB。

推論時可以縮放 LoRA：`W' = W + α · B @ A`。`α = 0.5-1.5` 是正常範圍。多個 LoRA 以相加方式疊起來。但需注意，它們會以非線性方式互相影響。

### IP-Adapter（Ye 等人，2023）

一個很小的配接器，文字之外再接受一張*影像*當條件。用 CLIP 影像編碼器產出影像 token，和文字 token 一起注入交叉注意力（cross-attention）。每個基模型大約 20 MB。讓你做「照這張參考圖的風格生成」，不必先做 LoRA。

## 可組合矩陣

| 工具 | 控制什麼 | 大小 | 什麼時候用 |
|------|------------------|------|-------------|
| ControlNet | 空間結構，姿勢、深度、邊緣 | 70 到 360 MB | 要精確的版面和構圖 |
| LoRA | 風格、主體、概念 | 20 到 200 MB | 個人化、風格 |
| IP-Adapter | 從參考影像來的風格或主體 | 20 MB | 文字形容不了那個樣子 |
| Textual Inversion | 把單一概念做成新 token | 10 KB | 舊的，大多被 LoRA 換掉 |
| DreamBooth | 對一個主體做完整 fine-tune | 2 到 5 GB | 身份要很強、運算要很高 |
| T2I-Adapter | 更輕的 ControlNet 替代 | 70 MB | 邊緣裝置、推論預算緊 |

ControlNet 約等於空間。LoRA 約等於語意。兩個一起用。

```figure
v4-controlnet-zero
```

## Build It｜動手實作

`code/main.py` 在一維上模擬這兩個機制：

1. **LoRA。** 一個預訓練的線性層 `W`。凍住它。訓練低秩的 `B @ A`，讓 `W + BA` 配上目標線性層。顯示 `r = 1` 就夠把一個秩 1 的修正學到完美。
2. **精簡 ControlNet。** 一個「凍住的基模型」預測器，和一個讀額外信號的「旁路網路」。旁路網路的輸出乘上一個可學習的純量閘，初始化成零，這是我們版的零卷積。訓練，並觀察閘逐步升高。

### 步驟 1：LoRA 的數學

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### 步驟 2：零初始化的旁路網路

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

第 0 步的輸出和基模型相同。訓練早期 `gate` 更新很慢——不會災難性地漂。

## 容易踩的坑

- **把 LoRA 的強度拉太高。** `α = 2` 或 `α = 3` 是常見的「讓它更強」手法，會產出風格過重或直接壞掉的結果。保持 `α ≤ 1.5`。
- **ControlNet 權重打架。** 姿勢 ControlNet 權重 1.0，再加深度 ControlNet 權重 1.0，通常會衝過頭。權重和大約 1.0 是安全預設。
- **LoRA 配錯基模型。** SDXL 的 LoRA 在 SD 1.5 上會不聲不響地變成空操作，因為注意力維度（dimension）對不上。Diffusers 0.30 以後會警告。
- **Textual Inversion 會漂。** 在一個檢查點上訓練的 token，換到另一個會漂得很兇。LoRA 比較好搬。
- **LoRA 權重併進與存放。** 你可以把 LoRA 烤進基模型權重，推論更快，執行時不用再加，但你失去執行時縮放（runtime scaling） `α` 的能力。兩份都留。

## Use It｜實際應用

| 目標 | 2026 年的管線 |
|------|---------------|
| 重現一個品牌的畫風 | 用大約 30 張挑過的影像、秩 32，訓練 LoRA |
| 把我的臉放進生成影像 | DreamBooth，或 LoRA 加 IP-Adapter-FaceID |
| 指定姿勢加 prompt | ControlNet-Openpose 加 SDXL 加文字 |
| 有深度感的構圖 | ControlNet-Depth 加 SD3 |
| 參考圖加 prompt | IP-Adapter 加文字 |
| 精確的版面 | ControlNet-Scribble 或 ControlNet-Canny |
| 換背景 | ControlNet-Seg 加修補（第 09 課） |
| 快速的一步風格 | 在 SDXL-Turbo 上用 LCM-LoRA |

## Ship It｜交付成果

存成 `outputs/skill-sd-toolkit-composer.md`。這個 skill 吃一個任務，輸入素材是 prompt、可選的參考影像、可選的姿勢、可選的深度、可選的塗鴉，輸出工具堆疊、權重，和可重現的種子協議。

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 裡把 LoRA 的秩 `r` 從 1 變到 4。秩到多少，LoRA 能精確配上一個秩 2 的目標差值？
2. **中等。** 對兩個目標變換各訓練一個 LoRA。一起載入，顯示它們相加的交互。交互什麼時候不再是線性的？
3. **困難。** 用 diffusers 疊起來：SDXL-base、Canny-ControlNet（權重 0.8）、一個風格 LoRA（α 0.8）、IP-Adapter（權重 0.6）。堆疊權重變動時，量 FID 和 prompt 貼合的取捨。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| ControlNet | 「空間控制」 | 複製的編碼器加零卷積跳躍；讀一張條件影像。 |
| 零卷積 | 「一開始是恆等」 | 初始化成零的 1×1 卷積；ControlNet 一開始是空操作。 |
| LoRA | 「低秩配接器」 | `W + B @ A`，`r << d`；參數比完整 fine-tune 少到 100 分之一。 |
| 秩 r | 「那個旋鈕」 | LoRA 的壓縮；通常 4 到 16，重的個人化用 64 以上。 |
| α | 「LoRA 強度」 | 執行時縮放 LoRA 差值。 |
| IP-Adapter | 「參考影像」 | 小的影像條件配接器（image-conditioning adapter），用 CLIP 影像 token。 |
| DreamBooth | 「對主體做完整 fine-tune」 | 用大約 30 張某個主體的影像訓練整個模型。 |
| Textual Inversion | 「新 token」 | 只學一個新的 word embedding；舊的，大多被換掉。 |

## 正式環境筆記：LoRA 熱切換、ControlNet 通道、多租戶服務

真正的文字生影像 SaaS，會在同一個基模型檢查點上服務幾百個 LoRA 和十來個 ControlNet。這個服務問題很像 LLM 的多租戶（multi-tenancy）。正式環境文獻把 LLM 那一面放在連續批次（continuous batching）和 LoRAX／S-LoRA 底下講：

- **熱切換 LoRA，不要併進基模型。** 把 `W' = W + α·B·A` 併進基模型，每步推論大約快 3% 到 5%，但會凍住 `α` 和基模型。讓 LoRA 以秩 r 的差值熱著留在 VRAM；diffusers 提供 `pipe.load_lora_weights()` 加 `pipe.set_adapters([...], adapter_weights=[...])`，依請求啟用。切換成本是 `2 · d · r · num_layers` 那些權重——MB 級、不到一秒。
- **ControlNet 是第二條注意力通道。** 複製的編碼器和基模型平行跑。兩個 ControlNet 權重各 1.0，等於每步多兩次前向，不是併成一次。批次（batch）大小的餘裕按平方下降。每個啟用的 ControlNet，單步成本按大約 1.5 倍來預算。
- **LoRA 也要量化（quantization）。** 如果基模型已經量化（見第 07 課，8 GB 上的 Flux），LoRA 差值也可以乾淨地量化成 8 位元或 4 位元。QLoRA 式的載入，讓你在 4 位元 Flux 基模型上疊 5 到 10 個 LoRA，不會把記憶體（memory）撐爆。

Flux 專用：Niels 的 Flux-on-8GB notebook 把基模型量化成 4 位元；在那個量化基模型上疊一個風格 LoRA，`pipe.load_lora_weights("user/style-lora")`，`weight_name="pytorch_lora_weights.safetensors"`，仍然行得通。這是大多數 SaaS 代理商 2026 年出貨的配方。

## Further Reading｜延伸閱讀

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ——ControlNet。
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) ——LoRA，原本給 LLM，移植到擴散。
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) ——IP-Adapter。
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) ——比 ControlNet 更輕的替代。
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) ——DreamBooth。
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) ——參考管線。
