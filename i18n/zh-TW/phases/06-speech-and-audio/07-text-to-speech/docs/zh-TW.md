# 文字轉語音（TTS）：從 Tacotron 到 F5 與 Kokoro

> ASR 將語音轉成文字。TTS 把文字倒成語音。2026 年的堆疊是三塊：文字到 token，token 到梅爾頻譜圖（mel-spectrogram），梅爾頻譜圖到波形。每一塊都有一個筆電放得下的預設模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## The Problem｜問題

你有一個字串：「Please remind me to water the plants at 6 pm.」。你要一段 3 秒的音訊，聽起來自然，韻律（prosody）正確（停頓、重音），「plants」的母音發對，而且即時語音助理在 CPU 上要在 300 毫秒以內跑完。你還要能換聲音、處理語碼轉換的輸入（「remind me at 6 pm, daijoubu?」），名字不能念得丟臉。

現代 TTS 管線（pipeline）長這樣：

1. **文字前端。** 正規化文字（日期、數字、電子郵件），轉成音素（phoneme）或子詞 token，預測韻律特徵（feature）。
2. **聲學模型。** 文字到梅爾頻譜圖。Tacotron 2（2017）、FastSpeech 2（2020）、VITS（2021）、F5-TTS（2024）、Kokoro（2024）。
3. **聲碼器（vocoder）。** 梅爾頻譜圖到波形。WaveNet（2016）、WaveRNN、HiFi-GAN（2020）、BigVGAN（2022）、2024 年之後的神經編解碼器聲碼器。

2026 年，端到端擴散和流匹配（flow matching）模型讓聲學模型和聲碼器之間的分界變得模糊。但除錯時，三塊的心智模型仍然成立。

## The Concept｜核心概念

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2（2017）。** 序列到序列：字元 embedding，到雙向 LSTM 編碼器，到對位置敏感的注意力，再到自迴歸 LSTM 解碼器，發出梅爾音框。慢（自迴歸），長文本上不穩。仍然被當成基準模型（baseline）引用。

**FastSpeech 2（2020）。** 非自迴歸。時長預測器輸出每個音素佔幾個梅爾音框。一輪就完成，比 Tacotron 快 10 倍。自然度少一些（單調對齊），但到處都在交付。

**VITS（2021）。** 編碼器、以流為基礎的時長、HiFi-GAN 聲碼器一起端到端訓練，用變分推論（variational inference）。品質高，單一模型。2022 到 2024 開放原始碼 TTS 的主力。變體：YourTTS（多說話人零樣本）、XTTS v2（2024，Coqui）。

**F5-TTS（2024）。** 流匹配上的擴散 transformer。韻律自然，5 秒參考音訊就能零樣本聲音仿製（voice cloning）。2026 年開放原始碼 TTS 排行榜的頂端。3.35 億參數（parameter）。

**Kokoro（2024）。** 小（8200 萬），CPU 跑得動，即時用途裡英文 TTS 同級最好。封閉詞彙、只有英文，Apache 2.0。

**OpenAI TTS-1-HD、ElevenLabs v2.5、Google Chirp-3。** 商業上的目前最好。ElevenLabs v2.5 的情緒標籤（「[whispered]」、「[laughing]」）和角色聲音，主導 2026 年的有聲書製作。

### 聲碼器的演進

| 年代 | 聲碼器 | 延遲 | 品質 |
|-----|---------|---------|---------|
| 2016 | WaveNet | 只能離線 | 發布時的目前最好 |
| 2018 | WaveRNN | 大約即時 | 好 |
| 2020 | HiFi-GAN | 100 倍即時 | 接近人類 |
| 2022 | BigVGAN | 50 倍即時 | 跨說話人和語言泛化 |
| 2024 | SNAC、DAC（神經編解碼器） | 和自迴歸模型整合 | 離散 token、位元效率高 |

到 2026 年，大多數「TTS」模型是從文字到波形的端到端。梅爾頻譜圖是內部表示。

### 評估

- **MOS（平均意見分數，Mean Opinion Score）。** 1 到 5 分，由群眾評分。仍然是黃金標準。慢得痛苦。
- **CMOS（比較式 MOS）。** A 對 B 的偏好。每筆標註的信賴區間較窄。
- **UTMOS、DNSMOS。** 無參考的神經 MOS 預測器。排行榜用。
- **CER（字元錯誤率），經由 ASR。** 把 TTS 輸出丟進 Whisper，對輸入文字算 CER。可懂度的代理。
- **SECS（說話人 embedding 的餘弦相似度）。** 聲音仿製的品質。

LibriTTS test-clean 上 2026 年的數字：

| 模型 | UTMOS | CER（經由 Whisper） | 大小 |
|-------|-------|-------------------|------|
| 真實音訊 | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 3.35 億 |
| XTTS v2 | 3.81 | 3.5% | 4.7 億 |
| VITS | 3.62 | 3.1% | 2500 萬 |
| Kokoro v0.19 | 3.87 | 1.8% | 8200 萬 |
| Parler-TTS Large | 3.76 | 2.8% | 23 億 |

```figure
sp-tts-stack
```

## Build It｜動手實作

### 步驟 1：把輸入轉成音素

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用的橋梁。品質低於 VITS 的東西，不要餵原始文字。

### 步驟 2：跑 Kokoro（2026 年 CPU 的預設）

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

離線跑、單一檔案、8200 萬參數。

### 步驟 3：用 F5-TTS 做聲音仿製

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

給一段 5 秒的參考片段和它的逐字稿。F5 仿韻律和音色。

### 步驟 4：從零做 HiFi-GAN 聲碼器

教學程式檔案放不下，但形狀是：

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

訓練：對抗（短視窗上的判別器）加梅爾頻譜圖重建損失加特徵匹配損失。已成為成熟商品。用 `hifi-gan` 儲存庫或 nvidia-NeMo 的預訓練檢查點。

### 步驟 5：完整管線（偽程式）

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 挑 |
|-----------|------|
| 即時英文語音助理 | Kokoro（CPU）或 XTTS v2（GPU） |
| 從 5 秒參考做聲音仿製 | F5-TTS |
| 商業角色聲音 | ElevenLabs v2.5 |
| 有聲書敘述 | ElevenLabs v2.5，或 XTTS v2 再 fine-tune |
| 低資源語言 | 在 5 到 20 小時目標語言資料上訓練 VITS |
| 有表現力／情緒標籤 | ElevenLabs v2.5，或 StyleTTS 2 fine-tune |

到 2026 年，開放原始碼的領先是：**品質用 F5-TTS，效率用 Kokoro**。除非你是語音合成史的研究者，否則不要去拿 Tacotron。

## Pitfalls｜容易踩的坑

- **沒有文字正規化器。** 「Dr. Smith」要念成 Doctor 還是 Drive？「2026」是 twenty twenty six 還是 two zero two six？在音素化之前先正規化。
- **詞彙外的專有名詞。** 「Ghumare」要念成 ghyu-mair 嗎？為未知 token 準備字素轉音素模型作為備援。
- **削波。** 聲碼器輸出很少削波，但推論時 mel 縮放不合，可能衝過 ±1.0。一定要 `np.clip(wav, -1, 1)`。
- **取樣率不合。** Kokoro 輸出 24 kHz。下游管線期望 16 kHz，就要重取樣，否則會混疊。

## Ship It｜交付成果

存成 `outputs/skill-tts-designer.md`。依給定的聲音、延遲和語言，設計一條 TTS 管線。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它從玩具詞彙建音素字典，估計每個音素的時長，並印出假的 mel 排程。
2. **中等。** 安裝 Kokoro，用聲音 `af_bella` 和 `am_adam` 合成同一句。比較音訊時長和主觀品質。
3. **困難。** 錄自己 5 秒的參考片段。用 F5-TTS 仿製。回報參考和仿製輸出之間的 SECS。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 音素 | 聲音單位 | 抽象的聲音類。英文有 39 個（ARPABet）。 |
| 時長預測器 | 每個音素多長 | 非自迴歸模型的輸出。每個音素幾個整數框。 |
| 聲碼器 | 梅爾頻譜圖到波形 | 把梅爾頻譜圖映到原始樣本的神經網路。 |
| HiFi-GAN | 標準聲碼器 | 以 GAN 為基礎。2020 到 2024 的主力。 |
| MOS | 主觀品質 | 人類評分者的 1 到 5 分平均意見分數。 |
| SECS | 聲音仿製指標 | 目標和輸出說話人 embedding 之間的餘弦相似度。 |
| F5-TTS | 2024 開放原始碼的目前最好 | 流匹配擴散。零樣本仿製。 |
| Kokoro | CPU 上的英文領先 | 8200 萬參數的模型，Apache 2.0。 |

## Further Reading｜延伸閱讀

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) ——序列到序列的基準模型。
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) ——端到端、以流為基礎。
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) ——目前開放原始碼的最好。
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) ——2026 年仍在交付的聲碼器。
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) ——2024 年對 CPU 友善的英文 TTS。
