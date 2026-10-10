# 音訊生成

> 音訊是 16 到 48 kHz 的一維訊號（1-D signal）。5 秒片段有 8 萬到 24 萬個取樣點。transformer 不會直接對整段音訊序列計算注意力。2026 年每一個生產級音訊模型的解法都一樣：神經編解碼器（neural codec）——Encodec、SoundStream、DAC——把音訊壓成 50 到 75 Hz 的離散 token，再由 transformer 或擴散模型生成 token。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## The Problem｜問題

三種音訊生成任務：

1. **文字轉語音（text-to-speech）。** 給文字，產出語音。乾淨語音是窄頻（narrow-band），音素結構（phonetic structure）也很強——用 token 上的 transformer 解得很好。VALL-E（Microsoft）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音樂生成。** 給一段 prompt（文字、旋律、和弦進行（chord progression）、曲風），產出音樂。分布（distribution）分布範圍廣得多。MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效／聲音設計（sound design）。** 給一段 prompt，產出環境音或擬音（Foley）。AudioGen、AudioLDM 2、Stable Audio Open。

三者都跑在同一層基底上：神經音訊編解碼器（neural audio codec），加上 token 自迴歸（token-AR）或擴散產生器。

## The Concept｜核心概念

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### 神經音訊編解碼器

Encodec（Meta，2022）、SoundStream（Google，2021）、Descript Audio Codec（DAC，2023）。卷積編碼器（encoder）把波形（waveform）壓成每個時間步（timestep）輸出一個向量；殘差向量量化（residual vector quantization，RVQ）把每個向量變成一連串 K 個碼本（codebook）索引。解碼器（decoder）把它還原。24 kHz、2 kbps、8 個 RVQ 碼本、75 Hz 的音訊，等於每秒 600 個 token。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 上面的兩種生成範式

**Token 自迴歸。** 將 RVQ token 攤平成一條序列，跑一個只有解碼器的 transformer。MusicGen 用「延遲平行（delayed parallel）」平行吐出 K 條碼本流，每條流各有偏移（offset）。VALL-E 用文字 prompt 加 3 秒聲音樣本，生成語音 token。

**潛在空間擴散。** 把 codec token 包成連續潛在表示（latent），或用類別擴散（categorical diffusion）來建模。Stable Audio 2.5 在連續音訊潛在表示上用流匹配（flow matching）。AudioLDM 2 用文字到 mel 再到音訊的擴散。

2024 到 2026 的趨勢：流匹配在音樂上勝出——推論（inference）更快、樣本更乾淨——而 token 自迴歸仍主導語音，因為它天然有因果性（causal），也適合串流（streaming）。

## 生產級系統概況

| 系統 | 任務 | 骨幹 | 延遲 |
|------|------|------|------|
| ElevenLabs V3 | 文字轉語音 | Token 自迴歸 + 神經聲碼器（vocoder） | 首 token 約 300 ms |
| OpenAI GPT-4o audio | 全雙工（full-duplex）語音 | 端到端多模態自迴歸 | 約 200 ms |
| NaturalSpeech 3 | 文字轉語音 | 潛在流匹配 | 非串流 |
| Stable Audio 2.5 | 音樂／音效 | DiT + 音訊潛在表示上的流匹配 | 1 分鐘片段約 10 秒 |
| Suno v4 | 整首歌 | 未公開；懷疑是 token 自迴歸 | 每首歌約 30 秒 |
| Udio v1.5 | 整首歌 | 未公開 | 每首歌約 30 秒 |
| MusicGen 3.3B | 音樂 | Encodec 32 kHz 上的 token 自迴歸 | 即時 |
| AudioCraft 2 | 音樂 + 音效 | 流匹配 | 5 秒片段約 5 秒 |
| Riffusion v2 | 音樂 | 頻譜圖（spectrogram）擴散 | 約 10 秒 |

```figure
score-matching
```

## Build It｜動手實作

`code/main.py` 模擬核心想法：在合成的「音訊 token」序列上訓練一個很小的下一個 token 預測模型。序列來自兩種不同「風格」（風格 A 是低高交錯的 token，風格 B 是單調上升）。以風格為條件，再取樣（sampling）。

### 步驟 1：合成音訊 token

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步驟 2：訓練一個很小的 token 預測器

一個以風格為條件、bigram 式（bigram-style）的預測器。重點是這個模式：codec token → 交叉熵（cross-entropy）訓練 → 自迴歸取樣。

### 步驟 3：有條件地取樣

給定風格 token 和一個起始 token，從預測出來的分布取樣下一個 token。繼續 20 到 40 個 token。

## 容易踩的坑

- **codec 品質封住輸出品質。** codec 如果不能忠實表示某個聲音，產生器品質再高也沒用。DAC 是目前開放權重裡最好的。
- **RVQ 誤差累積。** 每一層 RVQ 建模的是上一層的殘差。第 1 層的誤差會往下傳。較高層用溫度（temperature）0 取樣有幫助。
- **音樂結構。** 30 秒的 token，在 75 Hz 是 2 萬多個 token。這對 transformer 很難。MusicGen 用滑動視窗（sliding window）加 prompt 續寫；Stable Audio 用較短片段加交叉淡化（crossfade）。
- **邊界假影。** 生成片段之間的交叉淡化，重疊相加（overlap-add）要很小心。
- **對乾淨資料胃口很大。** 音樂產生器需要數萬小時、有授權的音樂。Suno／Udio 的 RIAA 訴訟（2024）把這件事抬到檯面上。
- **聲音克隆的倫理。** 3 秒樣本加上一段文字 prompt，就夠 VALL-E／XTTS／ElevenLabs 克隆一個聲音。每個生產級模型都需要濫用偵測，外加退出名單（opt-out）。

## Use It｜實際應用

| 任務 | 2026 年的組合 |
|------|----------------|
| 商用文字轉語音 | ElevenLabs、OpenAI TTS，或 Azure Neural |
| 聲音克隆（已確認同意） | XTTS v2（開放）或 ElevenLabs Pro |
| 背景音樂，要快 | Stable Audio 2.5 API、Suno，或 Udio |
| 帶歌詞的音樂 | Suno v4 或 Udio v1.5 |
| 音效／擬音 | AudioCraft 2、ElevenLabs SFX，或 Stable Audio Open |
| 即時語音 agent | GPT-4o realtime 或 Gemini Live |
| 開放權重的音樂研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音／翻譯 | HeyGen、ElevenLabs Dubbing |

## Ship It｜交付成果

存成 `outputs/skill-audio-brief.md`。這個 skill 吃一份音訊簡報（任務、時長、風格、聲音、授權），輸出：模型加託管、prompt 格式（曲風標籤、風格描述、結構標記）、codec 加產生器加聲碼器這條鏈、seed 協定，以及評估計畫（MOS／CLAP 分數／文字轉語音的 CER／使用者 A/B）。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`，並明確設定風格。確認生成的序列符合該風格的模式。
2. **中等。** 加上延遲平行解碼：模擬 2 條 token 流，必須維持相差 1 步。訓練一個聯合預測器。
3. **困難。** 用 HuggingFace transformers 在本機跑 MusicGen-small。用三個不同 prompt 各生成 10 秒片段，再以 A/B 看風格貼合。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| codec | 「神經壓縮」 | 音訊的編碼器／解碼器；典型輸出是 50 到 75 Hz 的 token。 |
| RVQ | 「殘差 VQ」 | 一連串 K 個量化器；每一個建模前一個的殘差。 |
| token | 「一個 codec 符號」 | 碼本裡的離散索引；常見是 1024 或 2048。 |
| 延遲平行 | 「錯開的碼本」 | 吐出 K 條 token 流，偏移互相錯開，藉此把序列變短。 |
| 流匹配 | 「2024 音訊的贏家」 | 比擴散更直的路徑；取樣更快。 |
| 聲音 prompt（voice prompt） | 「3 秒樣本」 | 說話者 embedding，或 token 前綴，用來把克隆的聲音帶往該方向。 |
| Mel 頻譜圖（mel spectrogram） | 「那張圖」 | 對數幅度的知覺頻譜圖；很多文字轉語音系統用它。 |
| 聲碼器 | 「mel 到波形」 | 把 mel 頻譜圖轉回音訊的神經元件（component）。 |

## 正式環境筆記：音訊是串流問題

音訊是使用者期待*邊生成邊送到*的那種輸出模態，不是一次到齊。用正式環境的框法，這表示 TPOT 要緊（每個輸出 token 的時間，Time Per Output Token），因為目標吞吐量（throughput）是使用者的聆聽速度——不是閱讀速度。16 kHz 音訊若 tokenization 成約每秒 75 個 token（Encodec），伺服器必須為每位使用者每秒產生至少 75 個 token，播放才順。

兩個架構上的後果：

- **流匹配的音訊模型不能直接串流。** Stable Audio 2.5 和 AudioCraft 2 一次前向傳遞就渲染固定長度的片段。要串流，就把片段切塊並讓邊界重疊——想成滑動視窗擴散——相較於 codec 自迴歸模型，延遲增加 100 到 300 ms。

如果產品是「即時語音聊天」或「即時的音樂續寫」，走 codec 自迴歸。如果是「送出後渲染一段 30 秒片段」，流匹配在生成品質與總延遲方面較有優勢。

## Further Reading｜延伸閱讀

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) ——codec 的標準。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) ——第一個廣泛使用的神經音訊編解碼器。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) ——DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) ——VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) ——MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) ——AudioLDM 2。
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) ——2025 的文字生音樂，用流匹配。
