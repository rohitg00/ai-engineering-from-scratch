# 音訊 Transformer——Whisper 架構

> 音訊是頻率對時間的一張影像。Whisper 是以梅爾頻譜圖（mel-spectrogram）為輸入並產生語音的 ViT。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## The Problem｜問題

Whisper 之前（OpenAI，Radford et al. 2022），最前沿的自動語音辨識（ASR）是 wav2vec 2.0 和 HuBERT——自監督的特徵（feature）抽取器，加上一個 fine-tune 過的頭。品質高，資料管線（pipeline）貴，跨領域泛化能力弱。多語言語音辨識要每個語系各一個模型。

Whisper 下了三個賭注：

1. **什麼都拿來訓練。** 68 萬小時、從網路上抓來的弱標籤（label）音訊，跨 97 種語言。沒有乾淨的學術語料庫（corpus）。沒有音素標籤。
2. **多任務、單一模型。** 一個解碼器同時訓練轉錄、翻譯、語音活動偵測（voice activity detection）、語言辨識（language identification）、和時間戳記（timestamp），用任務 token 來切。
3. **標準的編碼器–解碼器（encoder–decoder）transformer。** 編碼器吃對數梅爾頻譜圖（log-mel spectrogram）。解碼器自迴歸（autoregressive）地產出文字 token。沒有聲碼器、沒有 CTC、沒有 HMM。

結果：Whisper large-v3 在口音、雜訊、以及完全沒有乾淨標籤資料的語言上都穩。它是 2026 年每一個開源語音助理、和大多數商業語音助理的預設語音前端。

## The Concept｜核心概念

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### 步驟 1——重取樣加開窗

音訊 16 kHz。裁或補到 30 秒。算對數梅爾頻譜圖：80 個梅爾頻率槽、10 毫秒跳躍長度（stride）→ 約 3000 個音框（frame）× 80 個特徵。這就是 Whisper 看到的「輸入影像」。

### 步驟 2——卷積 stem

兩層 Conv1D，核（kernel）3、步幅（stride）2，把 3000 個音框壓成 1500。序列長度減半，參數沒加多少。

### 步驟 3——編碼器

24 層（large）的 transformer 編碼器，蓋在 1500 個時間步上。正弦位置編碼、自注意力、GELU 的 FFN。產出 1500 × 1280 的隱藏狀態（hidden state）。

### 步驟 4——解碼器

24 層的 transformer 解碼器。它自迴歸地從 BPE 詞彙表產生 token，那個詞彙表是 GPT-2 的超集，再加幾個音訊專用的特殊 token。

### 步驟 5——任務 token

解碼器的 prompt 以控制 token 開頭，告訴模型要做什麼：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型是在這個慣例上訓練的。你用前綴控制任務。這就是 instruction tuning 的 2026 年對應物，只是套在語音上。

### 步驟 6——輸出

集束搜尋（beam search，寬度 5），帶一個對數機率閾值。沒有 `<|notimestamps|>` token 時，每 0.02 秒音訊預測一次時間戳記。

### Whisper 的大小

| 模型 | 參數 | 層數 | d_model | 頭 | VRAM（fp16） |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 3900 萬 | 4 | 384 | 6 | ~1 GB |
| Base | 7400 萬 | 6 | 512 | 8 | ~1 GB |
| Small | 2.44 億 | 12 | 768 | 12 | ~2 GB |
| Medium | 7.69 億 | 24 | 1024 | 16 | ~5 GB |
| Large | 15.5 億 | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 15.5 億 | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 8.09 億 | 32 | 1280 | 20 | ~6 GB（4 層解碼器） |

Large-v3-turbo（2024）把解碼器從 32 層砍到 4。解碼快 8 倍，WER 退步不到 1 個點。這個解碼速度就是為什麼 2026 年即時語音 agent 的預設是 Whisper-turbo。

### Whisper 不做的事

- 不做說話者分離（誰在說話）。那個配 pyannote。
- 原生不做即時串流——30 秒視窗是固定的。現代的包裝（`faster-whisper`、`WhisperX`）用 VAD 加上重疊，附加串流功能。
- 沒有外部切分，就沒有超過 30 秒的長文脈絡。實務上仍然好用，因為人說話做轉錄很少需要長程脈絡。

### 2026 年的版圖

| 任務 | 模型 | 備註 |
|------|-------|-------|
| 英文 ASR | Whisper-turbo、Moonshine | Moonshine 在邊緣上快 4 倍 |
| 多語 ASR | Whisper-large-v3 | 97 種語言 |
| 串流 ASR | faster-whisper 加 VAD | 150 毫秒的延遲（latency）目標達得到 |
| 語音合成 | Piper、XTTS-v2、Kokoro | 編碼器–解碼器的模式，但形狀像 Whisper |
| 音訊加語言 | AudioLM、SeamlessM4T | 文字 token 和音訊 token 在同一個 transformer 裡 |

```figure
n5-mel-decode
```

## Build It｜動手實作

見 `code/main.py`。我們不訓練 Whisper——我們做對數梅爾頻譜圖的管線，加上任務 token 的 prompt 格式化。這些才是正式環境（production）裡你真正會碰到的部分。

### 步驟 1：合成音訊

產生 1 秒、440 Hz 的正弦波，以 16 kHz 取樣。16000 個樣本。

### 步驟 2：對數梅爾頻譜圖（簡化）

完整的梅爾頻譜圖需要 FFT。我們做簡化的分框加每框能量，把管線秀出來，而且不用 `librosa`：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

音框 = 25 毫秒，跳躍長度 = 10 毫秒。對得上 Whisper 的開窗。教學上，每框能量代替梅爾頻率槽。

### 步驟 3：補到 30 秒

Whisper 永遠處理 30 秒的塊。把頻譜補（或裁）到 3000 個音框。

### 步驟 4：組 prompt token

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

那就是整個任務控制面。4 個 token 的前綴。

## Use It｜實際應用

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、和 OpenAI 相容：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026 年何時選 Whisper：**

- 一個模型做多語 ASR。
- 雜訊多、來源雜的音訊，仍然轉錄得穩。
- 研究／原型 ASR——最快的起點。

**何時選別的：**

- 邊緣上超低延遲的串流——同樣品質下 Moonshine 打贏 Whisper。
- 需要低於 200 毫秒的即時對話 AI——專用的串流 ASR。
- 說話者分離——Whisper 不做這個；接上 pyannote。

## Ship It｜交付成果

見 `outputs/skill-asr-configurator.md`。這個 skill 為新的語音應用挑 ASR 模型、解碼參數、和前處理（preprocessing）管線。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認 1 秒、16 kHz、跳躍長度 10 毫秒的訊號大約是 100 個音框。30 秒：約 3000 個音框。
2. **中等。** 用 `numpy.fft` 做完整的對數梅爾頻譜圖。確認 80 個梅爾頻率槽在數值誤差內對得上 `librosa.feature.melspectrogram(n_mels=80)`。
3. **困難。** 實作串流推論（inference）：把音訊切成 10 秒視窗、2 秒重疊，每一塊跑 Whisper，再把轉錄合併。在一段 5 分鐘的 podcast 樣本上，量詞錯誤率對上一次過完。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 梅爾頻譜圖 | 「音訊的影像」 | 二維表示：一軸是頻率帶，另一軸是時間音框；每一格是對數縮放的能量。 |
| 對數梅爾頻譜圖 | 「Whisper 看到的東西」 | 通過對數的梅爾頻譜圖；近似人對響度的知覺。 |
| 音框 | 「一個時間切片」 | 25 毫秒的樣本視窗；以 10 毫秒跳躍長度重疊。 |
| 任務 token | 「語音的 prompt 前綴」 | 解碼器 prompt 裡的特殊 token，像 `<\|transcribe\|>`／`<\|translate\|>`。 |
| 語音活動偵測（VAD） | 「找出語音」 | 在 ASR 之前拿掉靜音的閘；成本砍掉非常多。 |
| CTC | 「Connectionist Temporal Classification」 | 經典的 ASR 損失，訓練時不用對齊；Whisper 不用它。 |
| Whisper-turbo | 「小解碼器、完整編碼器」 | large-v3 編碼器加 4 層解碼器；解碼快 8 倍。 |
| Faster-whisper | 「正式環境的包裝」 | CTranslate2 重實作；int8 量化（quantization）；比 OpenAI 參考快 4 倍。 |

## Further Reading｜延伸閱讀

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) ——Whisper 論文。
- [OpenAI Whisper repo](https://github.com/openai/whisper) ——參考程式加模型權重。讀 `whisper/model.py`，從上到下看 Conv1D 莖、編碼器、解碼器，大約 400 行。
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) ——步驟 5 到 6 講的集束搜尋加任務 token 邏輯在這裡；500 行，完全讀得完。
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) ——前身；某些情境下特徵仍然最前沿。
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) ——正式環境包裝，比參考快 4 倍。
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) ——2024 年適合邊緣的 ASR，形狀像 Whisper 但更小。
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) ——標準的 fine-tuning 配方，包含梅爾頻譜圖前處理和 token 時間戳記的處理。
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) ——完整實作（編碼器、解碼器、交叉注意力、生成），對得上這一課的架構圖。
