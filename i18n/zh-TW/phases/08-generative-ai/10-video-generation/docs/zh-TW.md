# 影片生成

> 影像是二維張量（tensor）。影片是三維張量。理論一樣；運算需求高出 10 到 100 倍。OpenAI 的 Sora（2024 年 2 月）證明這做得到。到了 2026 年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0 與 WAN 2.2 都能從文字出貨 1080p 的生產級影片——而開放權重（open weights）這一套（CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2）還落後 12 個月。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## The Problem｜問題

一段 10 秒、1080p、每秒 24 幀的影片，是 240 幀、每幀 1920×1080×3 個像素。每一支片段大約 1.5 GB 的原始資料。像素空間的擴散不可行。你需要：

1. **時空壓縮（spatiotemporal compression）。** 一個變分自編碼器（VAE），編碼的是影片而不是單幀，輸出一串時空圖塊（patch）。
2. **時間一致性（temporal consistency）。** 幀與幀要在幾秒內共享內容、光線和物體身份。網路（network）得把運動建模出來。
3. **算力預算。** 同樣的模型大小，影片訓練比影像貴上 10 到 100 倍。
4. **條件（conditioning）。** 文字、影像（第一幀）、音訊，或另一支影片。多數生產級模型四種都收。

解掉這件事的架構，是把 **Diffusion Transformer（DiT）** 用在時空圖塊上，拿巨大的（prompt、caption、影片）資料集（dataset）來訓練。擴散損失跟第 06 課一樣。

## The Concept｜核心概念

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### 切成圖塊

用 3D VAE（學來的時空壓縮）編碼影片。潛在表示（latent）的形狀是 `[T_latent, H_latent, W_latent, C_latent]`。再切成大小為 `[t_p, h_p, w_p]` 的圖塊。Sora 風格的模型裡，`t_p = 1`（逐幀圖塊）或 `t_p = 2`（每兩幀一塊）。一段 10 秒的 1080p 影片會壓成大約 2 萬到 10 萬個圖塊。

### 時空 DiT

transformer 處理攤平後的圖塊序列。每個圖塊有一個 3D 位置 embedding（positional embedding，時間 + y + x）。注意力（attention）通常拆開算：

- **空間注意力（spatial attention）**，只在同一幀的圖塊之間。
- **時間注意力（temporal attention）**，跨幀，但在同一個空間位置。
- **完整的 3D 注意力**貴上 16 到 100 倍；只用在低解析度，或只用在研究裡。

### 文字條件

用大型文字編碼器做交叉注意力（cross-attention）——Sora 用 T5-XXL，CogVideoX-5B 也用 T5-XXL。長 prompt 很重要——Sora 的訓練集有 GPT 生成的密集重新標註（re-caption），平均每支片段 200 個 token。

### 訓練

標準的擴散損失（預測 ε 或 v），算在時空潛在表示上。資料：網路上的影片，加上約 1 億支精選片段，再加上合成的文字 caption。算力：就算小型研究跑一次也要 1 萬 GPU 小時以上；Sora 的規模是 10 萬 GPU 小時以上。

## 2026 年的生產級版圖

| 模型 | 日期 | 最長時長 | 最高解析度 | 開放權重？ | 值得注意 |
|------|------|----------|------------|------------|----------|
| Sora (OpenAI) | 2024-02 | 60 秒 | 1080p | 否 | 第一個在規模上展現世界模擬器（world simulator）性質的模型 |
| Sora Turbo | 2024-12 | 20 秒 | 1080p | 否 | 生產級的 Sora，推論（inference）快 5 倍 |
| Veo 2 (Google) | 2024-12 | 8 秒 | 4K | 否 | 2025 年品質最高，物理也最好 |
| Veo 3 | 2025 Q3 | 15 秒 | 4K | 否 | 原生音訊，鏡頭控制更強 |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10 秒 | 1080p | 否 | 2025 年第一季人體動作最好 |
| Runway Gen-3 Alpha | 2024-06 | 10 秒 | 768p | 否 | 上面疊了專業的影片工具 |
| Pika 2.0 | 2024-10 | 5 秒 | 1080p | 否 | 角色一致性最強 |
| CogVideoX (THUDM) | 2024 | 10 秒 | 720p | 是（20 億、50 億） | 第一個開放的 50 億規模影片模型 |
| HunyuanVideo (Tencent) | 2024-12 | 5 秒 | 720p | 是（130 億） | 2024 年底的開放 SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4 秒 | 480p | 是（100 億） | 授權最寬鬆 |
| WAN 2.2 (Alibaba) | 2025-07 | 5 秒 | 720p | 是 | 2025 年中最強的開放模型 |

開放權重把差距縮小的速度，比在影像領域更快：到 2026 年中，HunyuanVideo 加上 WAN 2.2 的那些 LoRA 已經撐起多數開源工作流程。

```figure
video-diffusion-denoise
```

## Build It｜動手實作

`code/main.py` 模擬時空 DiT 的核心想法：把一小段合成影片切成圖塊，替每個圖塊加上位置 embedding，再用 transformer 風格的注意力把整段序列去噪。不用 numpy，純 Python。我們顯示：就算在一維，只要相鄰幀的圖塊共用一個去噪器（denoiser）和位置 embedding，時間一致性也會出現。

### 步驟 1：把合成的一維「影片」切成圖塊

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### 步驟 2：每一幀一個位置 embedding

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### 步驟 3：去噪器看整段序列

這個小網路不是逐幀獨立去噪，而是把所有幀的值加上它們的位置 embedding 接在一起，一次預測所有幀的雜訊。

### 步驟 4：時間一致性測試

訓練之後，取樣（sampling）一支影片。量相鄰幀的差值。如果模型學到了時間結構，這些差值會比逐幀獨立取樣更小。

## 容易踩的坑

- **逐幀獨立取樣 = 閃爍（flicker）。** 如果每一幀各自跑影像擴散，輸出會閃爍，因為每一幀的雜訊互相獨立。影片擴散用注意力或共享雜訊把幀耦合（coupling）起來，把這件事修掉。
- **單純（naive）的 3D 注意力 = 記憶體爆掉（OOM）。** 10 秒 1080p 的潛在表示若做完整 3D 注意力，是數千億次運算。拆成空間加時間。
- **資料的 caption 比規模更要緊。** Sora 相對先前工作的主要升級，是拿詳細程度大約 10 倍的 caption 來訓練（GPT-4 重新標註過的片段）。OpenAI 的技術報告把這點寫得很明白。
- **第一幀條件。** 多數生產級模型也接受一張影像當第一幀。這是「圖生影片（image-to-video）」模式；訓練包含這個變體。
- **物理漂移。** 長片段（超過 10 秒）會累積細微的不一致。滑動視窗（sliding window）生成，加上關鍵幀（keyframe）錨定，有幫助。

## Use It｜實際應用

| 用途 | 2026 年的選擇 |
|------|----------------|
| 品質最高、有人託管的文字生影片 | Veo 3 或 Sora |
| 鏡頭可控的電影感 | Runway Gen-3，搭配動作筆刷（motion brush） |
| 跨片段的角色一致性 | Pika 2.0 或 Kling 2.1 |
| 開放權重，快速 fine-tune | WAN 2.2 + LoRA |
| 圖生影片 | WAN 2.2-I2V、Kling 2.1 I2V，或 Runway |
| 音訊生影片的對嘴 | Veo 3（原生音訊），或專用的對嘴模型 |
| 影片編輯 | Runway Act-Two、Kling Motion Brush、Flux-Kontext（靜態幀） |

同等品質下，每秒影片的成本從 2024 到 2026 降到 20 分之一。

## Ship It｜交付成果

存成 `outputs/skill-video-brief.md`。這個 skill 吃一份影片簡報（時長、長寬比（aspect ratio）、風格、鏡頭計畫、主體一致性、音訊），輸出：模型加託管、prompt 鷹架（scaffolding，含鏡頭語言、主體描述、動作描述詞）、seed 加可重現協定，以及逐幀品檢清單。

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 裡，比較 (a) 逐幀獨立取樣、(b) 整段序列一起取樣的相鄰幀差值。回報差值的平均數（mean）與變異數（variance）。
2. **中等。** 加上第一幀條件：把第 0 幀釘在給定的值，其餘取樣。量這個釘住的值怎麼傳下去。
3. **困難。** 用 HuggingFace diffusers 在本機 GPU 上跑 CogVideoX-2B。為 6 秒、720p 的片段替 20 步推論計時。剖析時空注意力，找出瓶頸（bottleneck）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 影片 VAE | 「3-D VAE」 | 把 `(T, H, W, C)` 壓成時空潛在表示的編碼器。 |
| 圖塊 | 「那些 token」 | 潛在表示上固定大小的 3D 區塊；DiT 的輸入。 |
| 分解注意力（factorized attention） | 「空間加時間」 | 先沿空間做注意力，再沿時間做；跳過完整的 3D 注意力。 |
| 圖生影片（I2V） | 「把這張照片動起來」 | 模型收影像加文字，輸出一支從那張影像開始的影片。 |
| 關鍵幀條件（keyframe conditioning） | 「錨定幀」 | 釘住特定幀，控制影片的走向。 |
| 動作筆刷 | 「方向提示」 | 使用者在影像上畫運動向量的介面輸入。 |
| 重新標註 | 「密集 caption」 | 用 LLM 把訓練片段重新標上詳細 prompt。 |
| 閃爍 | 「時間性瑕疵」 | 幀與幀不一致；用耦合的去噪修掉。 |

## 正式環境筆記：影片潛在表示是記憶體頻寬（memory bandwidth）問題

一段 10 秒、1080p、每秒 24 幀的片段，是 240 幀 × 1920 × 1080 × 3 ≈ 1.5 GB 的原始像素。經過 4 倍的影片 VAE 壓縮（`2 × spatial × 2 × temporal`）之後，每次請求的潛在表示大約 100 MB。拿時空 DiT 跑 30 步、批次（batch）大小 1，每一步要在 HBM 上搬大約 3 GB——瓶頸是記憶體頻寬，不是 FLOPs。

三個正式環境旋鈕，全部直接取自正式環境推論文獻裡的推論章：

- **在 DiT 上做張量平行（TP）。** 文字生影片模型常常 ≥100 億參數。4 張 H100 上 TP=4 是標準做法；4050 億級的模型用 PP=2 × TP=2。每步延遲大致隨 TP 線性下降，直到撞上 all-reduce 的牆。
- **幀的批次化 = 連續批次（continuous batching）。** 生成的時候，影片在概念上是一批用注意力連起來的幀。連續批次用得上，也就是邊跑邊排（in-flight scheduling）：如果模型架構允許滑動視窗生成，就在回傳第 `t-1` 幀的同時，開始渲染第 `t+1` 幀。
- **片段級的 prefill 快取（cache）。** 對圖生影片來說，第一幀條件類似 LLM 的 prompt prefill：算一次，之後每一輪時間解碼都重用。這實質上就是影片版的 KV 快取（KV-cache）。

## Further Reading｜延伸閱讀

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) ——Sora 技術報告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) ——CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) ——HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) ——Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) ——2025 年中的開放 SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) ——影片擴散的開山論文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) ——Stable Video Diffusion 的前身。
