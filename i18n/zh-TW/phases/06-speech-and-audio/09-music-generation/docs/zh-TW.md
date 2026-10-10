# 音樂生成：MusicGen、Stable Audio、Suno，以及授權地震

> 2026 年的音樂生成：商業由 Suno v5 和 Udio v4 主導。開放原始碼由 MusicGen、Stable Audio Open、ACE-Step 領先。技術問題大致解了。法律問題（Warner Music 5 億美元和解、UMG 和解）在 2025 到 2026 重塑了這個領域。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## The Problem｜問題

文字，到一段 30 秒至 4 分鐘的音樂，帶歌詞、人聲和結構。三個子問題：

1. **器樂生成。** 「帶暖鍵盤的 lo-fi hip-hop 鼓」這類文字，到音訊。MusicGen、Stable Audio、AudioLDM。
2. **歌曲生成（帶人聲和歌詞）。** 「下雨的德州夜晚，一首鄉村歌」，到完整的歌。Suno、Udio、YuE、ACE-Step。
3. **有條件、可控制。** 把現有片段延長、重做橋段、換類型、分軌（stems），或局部重畫（inpainting）。Udio 的局部重畫加分軌，是 2026 年值得對照的功能。

## The Concept｜核心概念

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### 神經編解碼器 token 上的 token 語言模型

Meta 的 **MusicGen**（2023，MIT）和許多衍生：以文字或旋律 embedding 為條件，自迴歸預測 EnCodec token（32 kHz、4 個碼本），再用 EnCodec 解碼。3 億到 33 億參數（parameter）。強的基準模型（baseline）。超過 30 秒就撐不住。

**ACE-Step**（開放原始碼，40 億的 XL 在 2026 年 4 月發布）把這條路延伸到以歌詞為條件的完整歌曲。開放社群中最接近 Suno 的模型。

### Mel 或潛在上的擴散

**Stable Audio（2023）** 和 **Stable Audio Open（2024）**：壓縮音訊上的潛在擴散。循環、聲音設計、環境紋理很強。完整結構的歌不行。

**AudioLDM／AudioLDM2**：文字到音訊，用文字到影像風格的潛在擴散，推廣到音樂、音效、語音。

### 混合（正式環境）：Suno、Udio、Lyria

權重不公開。很可能是自迴歸編解碼器語言模型，加擴散聲碼器，再加專門的人聲、鼓、旋律頭。Suno v5（2026）是 ELO 1293 的品質領先。Udio v4 加上局部重畫和分軌（bass、鼓、人聲分開下載）。

### 評估

- **FAD（Fréchet Audio Distance）。** 用 VGGish 或 PANNs 特徵（feature），量生成音訊和真實音訊分布在 embedding 上的距離。愈低愈好。MusicGen small 在 MusicCaps 上是 4.5 FAD。目前最好大約 3.0。
- **音樂性（主觀）。** 人的偏好。Suno v5 的 ELO 1293 領先。
- **文字和音訊的對齊。** prompt 和輸出之間的 CLAP 分數。
- **音樂性的瑕疵。** 拍子不對的轉折、人聲樂句漂掉、超過 30 秒結構就散。

## 2026 年的模型版圖

| 模型 | 參數 | 長度 | 人聲 | 授權 |
|-------|--------|--------|--------|---------|
| MusicGen-large | 33 億 | 30 秒 | 無 | MIT |
| Stable Audio Open | 12 億 | 47 秒 | 無 | Stability 非商業 |
| ACE-Step XL（2026 年 4 月） | 40 億 | 超過 2 分鐘 | 有 | Apache-2.0 |
| YuE | 70 億 | 超過 2 分鐘 | 有，多語 | Apache-2.0 |
| Suno v5（不公開） | ? | 4 分鐘 | 有，ELO 1293 | 商業 |
| Udio v4（不公開） | ? | 4 分鐘 | 有，加分軌 | 商業 |
| Google Lyria 3（不公開） | ? | 即時 | 有 | 商業 |
| MiniMax Music 2.5 | ? | 4 分鐘 | 有 | 商業 API |

## 法律版圖（2025 到 2026）

- **Warner Music 對 Suno 的和解。** 5 億美元。WMG 現在監督 Suno 上的 AI 相似度、音樂權利，以及使用者生成的曲目。UMG 和 Udio 有類似的和解。
- **歐盟 AI Act** 加 **加州 SB 942**：AI 生成的音樂必須揭露。
- **Riffusion／MusicGen** 在 MIT 下沒有合規包袱，但也沒有可商用的人聲。

可安心部署的做法：

1. 只生成器樂（MusicGen、Stable Audio Open、MIT／CC0 輸出）。
2. 用商業 API（Suno、Udio、ElevenLabs Music），每次生成均附授權。
3. 在自己擁有或已授權的曲庫上訓練（大多數企業最後走這條）。
4. 給生成結果打浮水印（watermark），並寫上中繼資料（metadata）。

```figure
sp-codec-tokens
```

## Build It｜動手實作

### 步驟 1：用 MusicGen 生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三種大小：`small`（3 億，快）、`medium`（15 億）、`large`（33 億）。Small 夠用來問「點子聽不聽得過去」。

### 步驟 2：旋律條件

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody 吃色度圖（chromagram），保住旋律、換音色。適合「把這段旋律做成弦樂四重奏」。

### 步驟 3：FAD 評估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

算 VGGish embedding 的距離。適合類型層級的回歸測試。不能取代人耳。

### 步驟 4：加進 LLM 和音樂的工作流程

和第 7、8 課的想法合在一起：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Use It｜實際應用

| 目標 | 堆疊 |
|------|-------|
| 器樂聲音設計 | Stable Audio Open |
| 遊戲／可調的音樂 | Google Lyria RealTime（不公開） |
| 帶人聲的完整歌曲（商業） | Suno v5 或 Udio v4，授權要寫明 |
| 帶人聲的完整歌曲（開放） | ACE-Step XL 或 YuE |
| 短廣告配樂 | MusicGen，用哼唱的參考做旋律條件 |
| 音樂影片的背景 | MusicGen 加 Stable Video Diffusion |

## 2026 年仍然會交付出去的坑

- **試圖規避著作權限制的 prompt。** 「Song in the style of Taylor Swift」。商業的 Suno／Udio 現在會擋。開放模型不會。自己加一份過濾清單。
- **超過 30 秒就重複、就漂掉。** 自迴歸模型會繞圈。把多次生成交叉淡化，或用 ACE-Step 維持結構。
- **速度飄移。** 模型的速度會偏離 BPM。prompt 裡寫 BPM 標籤，再用 librosa 的 `beat_track` 事後過濾。
- **人聲可懂度。** Suno 很好。開放模型常無法清楚唱出歌詞。歌詞要緊就用商業 API，或 fine-tune。
- **單聲道輸出。** 開放模型產出單聲道或假立體聲。再以正式的立體聲重建升級（ezst、Cartesia 的立體聲擴散）。

## Ship It｜交付成果

存成 `outputs/skill-music-designer.md`。為音樂生成的部署挑模型、授權策略、長度與結構計畫，以及揭露用的中繼資料。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它用 ASCII 符號產出「生成式」和弦進行加鼓型，是音樂生成的卡通。想聽就用任何 MIDI 播放器播。
2. **中等。** 安裝 `audiocraft`，用 MusicGen-small 對 4 個類型 prompt 各生成 10 秒。對參考類型集合量 FAD。
3. **困難。** 用 ACE-Step（或 MusicGen-melody），同一段旋律用不同音色 prompt 生成三個變體。算和 prompt 的 CLAP 相似度，確認對齊。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| FAD | 音訊版的 FID | 真實和生成的 embedding 分布之間的 Fréchet 距離。 |
| 色度圖 | 旋律當成音高 | 每一框 12 維向量。旋律條件的輸入。 |
| 分軌 | 樂器軌 | 分開的 bass、鼓、人聲、旋律，各自是 WAV。 |
| 局部重畫 | 重做一段 | 遮住一個時間視窗。模型只重做那一段。 |
| CLAP | 文字和音訊的 CLIP | 對比式的音訊和文字 embedding。用來評估文字和音訊的對齊。 |
| EnCodec | 音樂編解碼器 | Meta 的神經編解碼器，MusicGen 在用。32 kHz、4 個碼本。 |

## Further Reading｜延伸閱讀

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) ——開放的自迴歸基準。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) ——聲音設計的預設。
- [ACE-Step](https://github.com/ace-step/ACE-Step) ——開放的 40 億完整歌曲生成器，2026 年 4 月。
- [Suno v5 platform docs](https://suno.com) ——商業品質的領先者。
- [AudioLDM2](https://arxiv.org/abs/2308.05734) ——音樂和音效的潛在擴散。
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) ——2025 年 11 月的先例。
