# 音訊生成

> 音訊是 16 到 48 kHz 的 1 維訊號。一段五秒的片段就是 8 萬到 24 萬個取樣點。沒有哪個 Transformer 有辦法直接對那種長度的序列做注意力。2026 年每一個生產級音訊模型的解法都一樣：用一個神經音訊編解碼器（Encodec、SoundStream、DAC）把音訊壓成 50 到 75 Hz 的離散詞元，再讓 Transformer 或擴散模型去生成詞元。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 02（音訊特徵）、階段 6 · 04（ASR）、階段 8 · 06（DDPM）
**時間：** 約 45 分鐘

## 問題所在

音訊生成有三類任務：

1. **文字到語音。** 給定文字，產出語音。乾淨的語音頻帶窄、音韻結構強 —— 用「Transformer 跑在詞元上」這條路解得很好。VALL-E（Microsoft）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音樂生成。** 給定提示詞（文字、旋律、和弦進行、曲風），產出音樂。分布廣得多。MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效／音效設計。** 給定提示詞，產出環境音氛或擬音（Foley）。AudioGen、AudioLDM 2、Stable Audio Open。

三者跑在同一套底層上：神經音訊編解碼器 + 詞元自迴歸或擴散生成器。

## 核心概念

![音訊生成：編解碼器詞元 + Transformer 或擴散模型](../assets/audio-generation.svg)

### 神經音訊編解碼器

Encodec（Meta, 2022）、SoundStream（Google, 2021）、Descript Audio Codec（DAC, 2023）。一個卷積編碼器把波形壓成每個時間步一個向量；殘差向量量化（RVQ）再把每個向量轉成一串 K 個編碼簿索引。解碼器把這一切反過來。24 kHz 音訊在 2 kbps 下用 8 個 RVQ 編碼簿、75 Hz＝每秒 600 個詞元。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 疊在上面的兩種生成範式

**詞元自迴歸。** 把 RVQ 詞元攤平成一串序列，跑一個 decoder-only 的 Transformer。MusicGen 用「延遲平行」（delayed parallel）的方式，讓 K 條編碼簿串流以各自的偏移量平行輸出。VALL-E 則從一段文字提示詞 + 3 秒的聲音樣本生成語音詞元。

**潛在擴散。** 把編解碼器詞元打包成連續的潛在表示，或直接用類別式擴散去建模。Stable Audio 2.5 在連續的音訊潛在表示上用 flow matching。AudioLDM 2 走的是文字→梅爾→音訊的擴散路線。

2024 到 2026 年的趨勢：在音樂上 flow matching 逐漸勝出（推論更快、樣本更乾淨），而語音仍由詞元自迴歸主導，因為它天生是因果的，也很適合串流。

## 生產版圖

| 系統 | 任務 | 骨幹 | 延遲 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | 詞元自迴歸 + 神經聲碼器 | 首個詞元約 300ms |
| OpenAI GPT-4o audio | 全雙工語音 | 端到端多模態自迴歸 | 約 200ms |
| NaturalSpeech 3 | TTS | 潛在 flow matching | 不支援串流 |
| Stable Audio 2.5 | 音樂／音效 | 音訊潛在表示上的 DiT + flow matching | 1 分鐘片段約 10 秒 |
| Suno v4 | 完整歌曲 | 不公開；推測是詞元自迴歸 | 每首約 30 秒 |
| Udio v1.5 | 完整歌曲 | 不公開 | 每首約 30 秒 |
| MusicGen 3.3B | 音樂 | Encodec 32kHz 上的詞元自迴歸 | 即時 |
| AudioCraft 2 | 音樂 + 音效 | Flow matching | 5 秒片段約 5 秒 |
| Riffusion v2 | 音樂 | 頻譜圖擴散 | 約 10 秒 |

```figure
score-matching
```

## 動手實作

`code/main.py` 模擬核心想法：在合成的「音訊詞元」序列上訓練一個很小的 next-token Transformer，序列來自兩種不同的「風格」（風格 A 是低詞元與高詞元交替，風格 B 是單調遞增的斜坡）。以風格為條件並取樣。

### 步驟 1：合成音訊詞元

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步驟 2：訓練一個極小的詞元預測器

一個以風格為條件的 bigram 式預測器。重點在於這個模式：編解碼器詞元 → 交叉熵訓練 → 自迴歸取樣。

### 步驟 3：條件式取樣

給定風格詞元與一個起始詞元，從預測出來的分布取樣下一個詞元。持續 20 到 40 個詞元。

## 常見陷阱

- **編解碼器的品質就是輸出品質的天花板。** 如果編解碼器沒辦法忠實表示某個聲音，生成器再好也救不回來。DAC 是目前開源裡最好的。
- **RVQ 的誤差累積。** 每一層 RVQ 建模的是前一層的殘差。第 1 層的誤差會往後傳。在較高層用溫度 0 取樣會有幫助。
- **音樂結構。** 30 秒的詞元在 75 Hz 下超過 2 萬個。對 Transformer 來說很吃力。MusicGen 用滑動視窗 + 提示詞續寫；Stable Audio 則用較短的片段 + 交叉淡接。
- **邊界處的瑕疵。** 在生成片段之間交叉淡接時，重疊相加要處理得很小心。
- **對乾淨資料的胃口。** 音樂生成器需要數萬小時已授權的音樂。Suno／Udio 遭 RIAA 提告（2024）就把這件事攤到了檯面上。
- **聲音複製的倫理。** 3 秒的樣本加一段文字提示詞，就足以讓 VALL-E／XTTS／ElevenLabs 複製一個人的聲音。每個生產模型都必須配上濫用偵測 + 退出名單。

## 框架應用

| 任務 | 2026 年的技術組合 |
|------|------------|
| 商用 TTS | ElevenLabs、OpenAI TTS，或 Azure Neural |
| 聲音複製（已驗證同意） | XTTS v2（開源）或 ElevenLabs Pro |
| 背景音樂，要快 | Stable Audio 2.5 API、Suno，或 Udio |
| 有歌詞的音樂 | Suno v4 或 Udio v1.5 |
| 音效／擬音 | AudioCraft 2、ElevenLabs SFX，或 Stable Audio Open |
| 即時語音代理程式 | GPT-4o realtime 或 Gemini Live |
| 開放權重的音樂研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音／翻譯 | HeyGen、ElevenLabs Dubbing |

## 產出交付

存成 `outputs/skill-audio-brief.md`。這項技能吃一份音訊需求（任務、時長、風格、聲音、授權），輸出：模型 + 託管方式、提示詞格式（曲風標籤、風格描述詞、結構標記）、編解碼器 + 生成器 + 聲碼器這條鏈、種子協定，以及評估計畫（MOS／CLAP 分數／TTS 的 CER／使用者 A/B）。

## 練習

1. **簡單。** 執行 `code/main.py` 並明確指定風格。驗證生成出來的序列符合該風格的模式。
2. **中等。** 加上延遲平行解碼：模擬兩條必須維持相差 1 步的詞元串流。訓練一個聯合預測器。
3. **困難。** 用 HuggingFace transformers 在本機跑 MusicGen-small。用三個不同的提示詞各生成一段 10 秒的片段；做 A/B 比較風格遵循度。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 編解碼器 | 「神經壓縮」 | 音訊用的編碼器／解碼器；輸出通常是 50 到 75 Hz 的詞元。 |
| RVQ | 「殘差 VQ」 | K 個量化器串成的階梯；每一個都建模前一個的殘差。 |
| 詞元 | 「一個編解碼器符號」 | 指向編碼簿的離散索引；常見是 1024 或 2048。 |
| 延遲平行 | 「錯開的編碼簿」 | 以交錯的偏移量輸出 K 條詞元串流，藉此縮短序列長度。 |
| Flow matching | 「2024 年音訊這邊的贏家」 | 擴散的替代方案，路徑更直；取樣更快。 |
| 聲音提示 | 「3 秒樣本」 | 引導複製聲音的語者嵌入或詞元前綴。 |
| 梅爾頻譜圖 | 「那張圖」 | 對數幅度的感知頻譜圖；很多 TTS 系統都在用。 |
| 聲碼器 | 「梅爾轉波形」 | 把梅爾頻譜圖轉回音訊的神經元件。 |

## 產品筆記：音訊是串流問題

音訊是唯一一種使用者期待「*邊生成邊送達*」而不是一次全部送到的輸出模態。用生產環境的話來說，這代表 TPOT（每個輸出詞元的時間）很要緊，因為目標吞吐量是使用者的**聆聽**速度，而不是閱讀速度。以 16kHz 音訊、約 75 詞元／秒（Encodec）來算，伺服器每個使用者都必須生成 ≥75 詞元／秒，播放才不會卡。

這帶來兩個架構上的後果：

- **flow matching 的音訊模型無法輕易串流。** Stable Audio 2.5 與 AudioCraft 2 是一次算完一段固定長度的片段。要串流，你就得把片段切塊、讓邊界重疊 —— 想成滑動視窗式的擴散 —— 相對於編解碼器自迴歸模型，這會多出 100 到 300ms 的延遲開銷。

如果產品是「即時語音對話」或「即時音樂續寫」，就選編解碼器自迴歸這條路。如果是「按下送出後算出一段 30 秒的片段」，那 flow matching 在品質與總延遲上都勝出。

## 延伸閱讀

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) —— 編解碼器的標準。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) —— 第一個被廣泛使用的神經音訊編解碼器。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) —— DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) —— VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) —— MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) —— AudioLDM 2。
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) —— 2025 年用 flow matching 做的文字到音樂。
