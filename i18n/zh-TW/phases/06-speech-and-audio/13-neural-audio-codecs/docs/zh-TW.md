# 神經音訊編解碼器：EnCodec、SNAC、Mimi、DAC，以及語意與聲學的分離

> 2026 年的音訊生成幾乎全是 token。EnCodec、SNAC、Mimi、DAC 把連續波形變成離散序列，讓 transformer 能預測。語意 token（semantic token）與聲學 token（acoustic token）的分離，第一本碼本是語意、其餘是聲學，對音訊來說是 Transformer 之後最重要的架構轉變。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## The Problem｜問題

語言模型吃離散 token。音訊是連續的。如果你要一個 LLM 風格的語音或音樂模型，MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus，你先需要一個**神經音訊編解碼器（neural audio codec）**：學來的編碼器把音訊離散成小詞彙的 token，配對的解碼器再把波形重建回來。

出現了兩個家族：

1. **重建優先的編解碼器**。EnCodec、DAC。目標是知覺音質（perceptual quality）。token 是「聲學的」，什麼都抓，包括說話人身分、音色、背景雜訊。
2. **語意優先的編解碼器**。Mimi（Kyutai）、SpeechTokenizer。強迫第一本碼本（codebook）編碼語言或音素內容（常常從 WavLM 蒸餾）。後面的碼本是聲學細節。

2024 到 2026 的洞見：**純重建編解碼器，從文字生成時語音會糊。** 編解碼器 token 上的 LLM 必須在同一本碼本裡同時學語言結構和聲學結構，難以擴展。把它們分開，語意碼本 0、聲學碼本 1 到 N，Moshi 和 Sesame CSM 才做得動。

## The Concept｜核心概念

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### 核心手法：殘差向量量化（RVQ）

不要一本需要數百萬個碼才能有好品質的大碼本。現代音訊編解碼器都用 **RVQ**：一串小碼本。第一本量化編碼器輸出。第二本量化殘差。依此類推。每本含 1024 個碼。8 本的有效詞彙是 1024^8，也就是 10^24。

推論時，解碼器把每一框選到的碼加起來重建。

### 2026 年要緊的四個編解碼器

**EnCodec（Meta，2022）。** 基準模型（baseline）。波形上的編碼器–解碼器，瓶頸是 RVQ。24 kHz，最多 32 本碼本，預設 4 本、1.5 kbps。架構是 `1D conv + transformer + 1D conv`。MusicGen 用它。

**DAC（Descript，2023）。** RVQ，碼本做 L2 正規化，週期活化函數，損失也改過。開放編解碼器裡重建保真最高。12 本碼本時，有時和原始語音分不出來。44.1 kHz 全頻。

**SNAC（Hubert Siuzdak，2024）。** 多尺度 RVQ。粗碼本的音框率（frame rate）比細的低。等於分層建模音訊：大約 12 Hz 的粗「草圖」，加上 50 Hz 的細節。Orpheus-3B 用它，因為階層結構對上以語言模型為基礎的生成。

**Mimi（Kyutai，2024）。** 2026 年改變局面的那個。音框率 12.5 Hz（極低），8 本碼本、4.4 kbps。碼本 0 **從 WavLM 蒸餾**，訓練去預測 WavLM 的語音內容特徵（feature）。碼本 1 到 7 是聲學殘差。這個分開撐起 Moshi（第 15 課）和 Sesame CSM。

### 音框率對語言模型要緊

音框率愈低，序列愈短，語言模型愈快。

| 編解碼器 | 音框率 | 1 秒等於幾個音框 | 適合 |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | 音樂、一般音訊 |
| DAC-44.1k | 86 Hz | 86 | 高傳真音樂 |
| SNAC-24k（粗） | 約 12 Hz | 12 | 自迴歸語言模型有效率 |
| Mimi | 12.5 Hz | 12.5 | 串流語音 |

12.5 Hz 時，10 秒語句只有 125 個編解碼器音框。transformer 很容易預測。

### 語意 token 與聲學 token

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **語意 token（Mimi 的碼本 0）。** 編碼說了什麼：音素、詞、內容。用輔助預測損失從 WavLM 蒸餾。
- **聲學 token（碼本 1 到 7）。** 編碼音色、說話人身分、韻律、背景雜訊、細節。

自迴歸語言模型先預測語意 token（條件是文字），再預測聲學 token（條件是語意加說話人參考）。這個分解就是現代 TTS 能零樣本仿製聲音的原因：語意模型管內容，聲學模型管音色。

### 2026 年的重建品質（每秒位元，位元率愈低愈好）

| 編解碼器 | 位元率 | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Opus 這類傳統編解碼器，每一個位元的知覺品質仍然贏。神經編解碼器贏在**離散 token**（Opus 不產出）和**生成模型的品質**（語言模型能用那些 token 做什麼）。

```figure
rvq-codec-cascade
```

## Build It｜動手實作

### 步驟 1：用 EnCodec 編碼

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

6 kbps 時 `n_codebooks=8`。每個碼是 0 到 1023（10 位元）。

### 步驟 2：解碼並量重建

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 步驟 3：語意和聲學分開（Mimi 風格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

語意碼本 0 和 WavLM 對齊。你可以訓練一個文字到語意的 transformer，詞彙比直接到音訊小很多。再讓分開的聲學到波形解碼器，條件設成說話人參考。

### 步驟 4：為什麼編解碼器 token 上的自迴歸語言模型行得通

10 秒語音，用 Mimi 的 12.5 Hz 乘 8 本碼本：

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 個 token 的上下文對 transformer 來說很短。2.56 億參數（parameter）的 transformer，在現代 GPU 上幾毫秒就能生成 10 秒語音。

## Use It｜實際應用

問題對上編解碼器：

| 任務 | 編解碼器 |
|------|-------|
| 一般音樂生成 | EnCodec-24k |
| 保真最高的重建 | DAC-44.1k |
| 語音上的自迴歸語言模型（TTS） | SNAC 或 Mimi |
| 串流全雙工語音 | Mimi（12.5 Hz） |
| 帶文字條件的音效庫 | EnCodec 加 T5 條件 |
| 細的音訊編輯 | DAC 加局部重畫 |

經驗法則：**如果你在做生成模型，從 Mimi 或 SNAC 開始。如果你在做壓縮管線（pipeline），用 Opus。**

## Pitfalls｜容易踩的坑

- **碼本太多。** 加碼本，保真線性增加，語言模型序列長度也線性增加。停在 8 到 12。
- **音框率不合。** 在 12.5 Hz 的 Mimi 上訓練語言模型，再 fine-tune 到 50 Hz 的 EnCodec，會靜默失敗。
- **假設所有碼本一樣。** 在 Mimi 裡，碼本 0 帶內容。弄丟它，可懂度就毀了。弄丟碼本 7，幾乎聽不出來。
- **只拿重建品質當指標。** 編解碼器重建可以很好，但語意結構差的話，對以語言模型為基礎的生成沒用。

## Ship It｜交付成果

存成 `outputs/skill-codec-picker.md`。依給定的生成或壓縮任務挑編解碼器。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它實作玩具的純量加殘差量化器，並在你加碼本時量重建誤差。
2. **中等。** 安裝 `encodec`，在留出的語音片段上比較 1、4、8、32 本碼本。畫 PESQ 或 MSE 對位元率。
3. **困難。** 載入 Mimi。編碼一段。把碼本 0 換成隨機整數再解碼。再同樣換碼本 7。比較兩種破壞。碼本 0 壞掉應該毀掉可懂度。碼本 7 壞掉應該幾乎沒變。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| RVQ | 殘差量化 | 一串小碼本。每一本量化前一本的殘差。 |
| 音框率 | 編解碼器速度 | 每秒幾個 token 音框。愈低，語言模型愈快。 |
| 語意碼本 | 碼本 0（Mimi） | 從自監督特徵蒸餾的碼本。編碼內容。 |
| 聲學碼本 | 其他全部 | 音色、韻律、雜訊、細節。 |
| PESQ／ViSQOL | 知覺品質 | 和 MOS 相關的客觀指標。 |
| EnCodec | Meta 的編解碼器 | RVQ 基準。MusicGen 在用。 |
| Mimi | Kyutai 的編解碼器 | 音框率 12.5 Hz。語意和聲學分開。撐起 Moshi。 |

## Further Reading｜延伸閱讀

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) ——RVQ 基準。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) ——開放裡保真最高。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) ——多尺度 RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) ——語意和聲學分開，WavLM 蒸餾。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) ——兩階段的語意／聲學典範。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) ——最早可串流的 RVQ 編解碼器。
