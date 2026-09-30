# 音樂生成 —— MusicGen、Stable Audio、Suno，以及授權的大地震

> 2026 年的音樂生成：商業端由 Suno v5 與 Udio v4 主導；開源端由 MusicGen、Stable Audio Open 與 ACE-Step 領先。技術問題大致上已經解決了。法律問題（華納音樂 5 億美元和解、環球音樂和解）則在 2025–2026 年重塑了整個領域。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 02（頻譜圖）、階段 4 · 10（擴散模型）
**時間：** 約 75 分鐘

## 問題所在

文字 → 一段 30 秒到 4 分鐘的音樂，要有歌詞、人聲和結構。分成三個子問題：

1. **純樂器生成。** 像「lo-fi hip-hop drums with warm keys」這樣的文字 → 音訊。MusicGen、Stable Audio、AudioLDM。
2. **歌曲生成（含人聲 + 歌詞）。** 「Country song about rainy Texas nights」→ 一首完整的歌。Suno、Udio、YuE、ACE-Step。
3. **條件控制／可控生成。** 延長一段既有片段、重新生成一段過門、換掉曲風、做分軌分離，或做局部重繪。Udio 的局部重繪 + 分軌分離就是 2026 年大家要追上的功能。

## 核心概念

![音樂生成：詞元語言模型與擴散模型的對比，以及 2026 年的模型地圖](../assets/music-generation.svg)

### 在神經編解碼器詞元上的詞元語言模型

Meta 的 **MusicGen**（2023，MIT）以及許多衍生版：以文字／旋律嵌入為條件，自迴歸地預測 EnCodec 詞元（32 kHz，4 個編碼簿），再用 EnCodec 解碼。3 億到 33 億參數。基準線很強；超過 30 秒就吃力了。

**ACE-Step**（開源，40 億參數的 XL 版於 2026 年 4 月發布）把這條路擴展到以歌詞為條件的完整歌曲生成。是開源社群最接近 Suno 的東西。

### 在梅爾或潛在空間上的擴散

**Stable Audio（2023）** 與 **Stable Audio Open（2024）**：在壓縮過的音訊上做潛在擴散。擅長循環樂段、音效設計、環境音氛。不太擅長有結構的完整歌曲。

**AudioLDM／AudioLDM2**：以 T2I 風格的潛在擴散做文字到音訊，並推廣到音樂、音效與語音。

### 混合式（生產環境）—— Suno、Udio、Lyria

權重不公開。很可能是自迴歸編解碼器語言模型 + 基於擴散的聲碼器，再加上專門的人聲／鼓組／旋律預測頭。Suno v5（2026）是 ELO 1293 的品質領先者。Udio v4 加上了局部重繪 + 分軌分離（貝斯、鼓、人聲可分別下載）。

### 評估

- **FAD（Fréchet 音訊距離）。** 用 VGGish 或 PANNs 特徵，量測生成音訊與真實音訊分布在嵌入層級的距離。越低越好。MusicGen small 在 MusicCaps 上是 4.5 FAD；SOTA 約 3.0。
- **音樂性（主觀）。** 人類偏好。Suno v5 以 ELO 1293 領先。
- **文字—音訊對齊。** 提示詞與輸出之間的 CLAP 分數。
- **音樂性瑕疵。** 沒踩在拍點上的轉折、人聲樂句漂移、超過 30 秒後結構潰散。

## 2026 年的模型地圖

| 模型 | 參數量 | 長度 | 人聲 | 授權 |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability 非商業 |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5（不公開） | ? | 4 min | yes, ELO 1293 | 商業 |
| Udio v4（不公開） | ? | 4 min | yes + stems | 商業 |
| Google Lyria 3（不公開） | ? | real-time | yes | 商業 |
| MiniMax Music 2.5 | ? | 4 min | yes | 商業 API |

## 法律版圖（2025–2026）

- **華納音樂訴 Suno 的和解。** 5 億美元。WMG 現在對 Suno 上的 AI 肖似度、音樂權利與使用者生成曲目擁有監督權。環球音樂與 Udio 也有類似的和解。
- **歐盟 AI Act** + **加州 SB 942**：AI 生成的音樂必須揭露。
- **Riffusion／MusicGen** 採 MIT 授權，沒有合規包袱，但也沒有可商用的人聲。

可安全交付的做法：

1. 只生成純樂器（MusicGen、Stable Audio Open，輸出走 MIT/CC0）。
2. 使用商業 API（Suno、Udio、ElevenLabs Music），逐次生成付授權。
3. 用自有或已取得授權的曲庫訓練（多數企業最後都落在這裡）。
4. 給生成結果標上浮水印 + 詮釋資料。

```figure
sp-codec-tokens
```

## 動手實作

### 步驟 1：用 MusicGen 生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三種尺寸：`small`（3 億，快）、`medium`（15 億）、`large`（33 億）。要判斷「這個點子行不行」，small 就夠了。

### 步驟 2：旋律條件控制

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody 吃一份色度圖，會保留旋律但換掉音色。拿來做「把這段旋律改成弦樂四重奏」很好用。

### 步驟 3：FAD 評估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

計算 VGGish 嵌入的距離。做曲風層級的迴歸測試很有用；但不能取代真人聽眾。

### 步驟 4：接進 LLM 音樂工作流

把第 7–8 課的想法組合起來：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 框架應用

| 目標 | 技術組合 |
|------|-------|
| 純樂器的音效設計 | Stable Audio Open |
| 遊戲／自適應音樂 | Google Lyria RealTime（不公開） |
| 含人聲的完整歌曲（商業） | Suno v5 或 Udio v4，並取得明確授權 |
| 含人聲的完整歌曲（開源） | ACE-Step XL 或 YuE |
| 短廣告配樂 | 以哼唱的參考音訊做旋律條件控制的 MusicGen |
| 音樂影片背景 | MusicGen + Stable Video Diffusion |

## 2026 年還在交付的陷阱

- **洗版權的提示詞。** 「Song in the style of Taylor Swift」—— 商業的 Suno／Udio 現在會過濾這種，開源模型不會。自己加一份過濾清單。
- **超過 30 秒後的重複／漂移。** 自迴歸模型會繞圈。把多次生成交叉淡接起來，或改用 ACE-Step 取得結構連貫性。
- **速度漂移。** 模型會偏離 BPM。在提示詞裡加上 BPM 標記，並用 librosa 的 `beat_track` 做事後過濾。
- **人聲可理解度。** Suno 很出色；開源模型的咬字常常糊成一團。如果歌詞很重要，就用商業 API 或做微調。
- **單聲道輸出。** 開源模型生成的是單聲道或假立體聲。用真正的立體聲重建來升級（ezst、Cartesia 的立體聲擴散）。

## 產出交付

存成 `outputs/skill-music-designer.md`。為一次音樂生成的部署挑選模型、授權策略、長度／結構規劃，以及揭露用的詮釋資料。

## 練習

1. **簡單。** 跑 `code/main.py`。它會用 ASCII 符號產出一段「生成式」和弦進行 + 鼓組節奏型 —— 一個音樂生成的簡筆漫畫。想聽的話可以丟進任何 MIDI 渲染器播放。
2. **中等。** 安裝 `audiocraft`，用 MusicGen-small 針對 4 種曲風提示詞各生成 10 秒的片段，對照一組參考曲風量測 FAD。
3. **困難。** 用 ACE-Step（或 MusicGen-melody），對同一段旋律搭配不同音色提示詞生成三個版本。計算與提示詞的 CLAP 相似度來驗證對齊程度。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| FAD | 音訊版的 FID | 真實與生成的嵌入分布之間的 Fréchet 距離。 |
| 色度圖 | 用音高表示旋律 | 每幀 12 維的向量；旋律條件控制的輸入。 |
| 分軌 | 樂器軌 | 分離出來的貝斯／鼓／人聲／旋律，各自一個 WAV。 |
| 局部重繪 | 重生成某一段 | 遮罩一個時間視窗；模型只重新生成那一段。 |
| CLAP | 文字—音訊版的 CLIP | 對比式的音訊—文字嵌入；用來評估文字與音訊的對齊。 |
| EnCodec | 音樂編解碼器 | MusicGen 用的 Meta 神經編解碼器；32 kHz，4 個編碼簿。 |

## 延伸閱讀

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) —— 開源的自迴歸基準。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) —— 音效設計的預設選擇。
- [ACE-Step](https://github.com/ace-step/ACE-Step) —— 開源的 40 億參數完整歌曲生成器，2026 年 4 月。
- [Suno v5 platform docs](https://suno.com) —— 商業端的品質領先者。
- [AudioLDM2](https://arxiv.org/abs/2308.05734) —— 用於音樂 + 音效的潛在擴散。
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) —— 2025 年 11 月的判例。
