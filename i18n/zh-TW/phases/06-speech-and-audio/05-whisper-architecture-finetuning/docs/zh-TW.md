# Whisper：架構與 fine-tuning

> Whisper 是 30 秒視窗（window）的 transformer 編碼器–解碼器，在 68 萬小時的多語、弱監督（weakly supervised）音訊和文字配對上訓練。一個架構、多個任務、99 種語言都穩。2026 年的 ASR 參考。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## The Problem｜問題

Whisper 由 OpenAI 在 2022 年 9 月發布，是第一個能像一般商品般使用的 ASR 模型：貼上音訊就拿到文字，99 種語言，對雜訊穩，筆電跑得動。到 2024 年，OpenAI 已經交付 Large-v3 和 Turbo。到 2026 年，從 podcast 轉錄到語音助理到 YouTube 字幕，Whisper 是預設基準模型（baseline）。

但 Whisper 不能永遠當黑盒。領域偏移（domain shift）會使它的表現大幅下降：技術行話、說話人口音、專有名詞、短片段、靜音。你需要知道：

1. 它裡面實際是什麼。
2. 怎麼正確餵切塊、串流或長音訊。
3. 什麼時候 fine-tune、怎麼做。

## The Concept｜核心概念

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**架構。** 標準的 transformer 編碼器–解碼器。

- 輸入：30 秒的對數梅爾頻譜圖（log-mel spectrogram），80 個梅爾，10 毫秒跳躍長度（hop size），得到 3000 框。較短的片段補零，較長的切塊。
- 編碼器：卷積降採樣（步幅 2）加 `N` 個 transformer 區塊。Large-v3 是 32 層、1280 維、20 頭。
- 解碼器：`N` 個 transformer 區塊，帶因果自注意力，以及對編碼器輸出的交叉注意力。大小和編碼器相同。
- 輸出：51,865 個 token 詞彙上的 BPE token。

Large-v3 有 15.5 億參數（parameter）。Turbo 的解碼器從 32 層改成 4 層，延遲降成八分之一，WER 代價不到 1 個百分點。

**Prompt 格式。** Whisper 是多任務模型，由解碼器 prompt 裡的特殊 token 來轉：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`。語言標籤。決定是翻譯還是逐字轉錄。
- `<|transcribe|>` 或 `<|translate|>`。把任何語言的輸入翻成英文輸出，或逐字轉錄。
- `<|notimestamps|>`。跳過詞級時間戳（timestamp），速度較快。

一個模型能做很多任務，靠的就是這個 prompt。把 `<|en|>` 改成 `<|fr|>`，它就轉錄法文。

**30 秒視窗。** 輸入長度固定為 30 秒。較長的片段要切塊。較短的要填充（padding）。視窗原生不能串流。這就是 WhisperX、Whisper-Streaming、faster-whisper 存在的原因。

**對數梅爾正規化。** `(log_mel - mean) / std`，統計量來自 Whisper 自己的訓練語料。你一定要用 Whisper 的前處理（`whisper.audio.log_mel_spectrogram`），不要用 `librosa.feature.melspectrogram`。

### 2026 年的變體

| 變體 | 參數 | 延遲（A100） | WER（LibriSpeech-clean） |
|---------|--------|----------------|------------------------|
| Tiny | 3900 萬 | 1 倍即時 | 5.4% |
| Base | 7400 萬 | 1 倍 | 4.1% |
| Small | 2.44 億 | 1 倍 | 3.0% |
| Medium | 7.69 億 | 1 倍 | 2.7% |
| Large-v3 | 15.5 億 | 2 倍 | 1.8% |
| Large-v3-turbo | 8.09 億 | 8 倍 | 1.58% |
| Whisper-Streaming（2024） | 15.5 億 | 串流 | 2.0% |

### Fine-tuning

2026 年的標準流程：

1. 蒐 10 到 100 小時目標領域的音訊，附對齊的逐字稿。
2. 用 `transformers.Seq2SeqTrainer`，加上 `generate_with_loss` 回呼。
3. 參數效率：注意力層的 `q_proj`、`k_proj`、`v_proj` 上做 LoRA，GPU 記憶體少到四分之一，WER 代價不到 0.3。
4. 不到 10 小時就凍結編碼器。只調解碼器。
5. 用 Whisper 自己的 tokenizer 和 prompt 格式。絕不要換 tokenizer。

社群結果：在 20 小時醫學口述上 fine-tune Medium，醫學詞彙的 WER 從 12% 降到 4.5%。在 4 小時冰島文上 fine-tune Turbo，WER 從 18% 降到 6%。

```figure
sp-asr-attention
```

## Build It｜動手實作

### 步驟 1：開箱就跑 Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

你應該一律改掉的預設：`temperature=0.0`（抽樣預設是 0.0，然後 0.2、0.4 的退路鏈）、`condition_on_previous_text=False`（避免連鎖幻覺）、`no_speech_threshold=0.6`（靜音偵測）。

### 步驟 2：切塊的長音訊

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX 加上（1）Silero VAD 閘、（2）用 wav2vec 2.0 做詞級對齊、（3）用 `pyannote.audio` 做說話人分離。這是 2026 年正式環境轉錄的主力。

### 步驟 3：用 LoRA 做 fine-tune

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

然後是標準的 Trainer 迴圈。每 1000 步存檢查點。在留出集上用 WER 評估。

### 步驟 4：看每一層學到什麼

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

用熱圖來看。解碼器一步步掃過編碼器音框時，你會看到對角對齊。那條對角線就是 Whisper 對詞級時間戳的想法。

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 挑 |
|-----------|------|
| 一般英文、離線 | 用 `whisperx` 跑 Large-v3-turbo |
| 手機／邊緣 | 量化成 int8 的 Whisper-Tiny，或 Moonshine |
| 多語長音訊 | 用 `whisperx` 跑 Large-v3，加上說話人分離 |
| 低資源語言 | 用 LoRA fine-tune Medium 或 Turbo |
| 串流（2 秒延遲） | Whisper-Streaming 或 Parakeet-TDT |
| 詞級時間戳 | WhisperX（用 wav2vec 2.0 做強制對齊） |

`faster-whisper`（CTranslate2 後端）是 2026 年最快的 CPU 加 GPU 推論執行環境。比原版快 4 倍，輸出相同。

## 2026 年仍然會交付出去的坑

- **靜音上的幻覺文字。** Whisper 在字幕上訓練，裡面有「Thanks for watching!」、「Subscribe!」、歌詞。呼叫之前一律先用 VAD 篩掉靜音。
- **`condition_on_previous_text` 的連鎖。** 一次幻覺會污染後面的視窗。除非你需要跨塊的流暢，否則設 `False`。
- **短片段填充。** 2 秒的片段填到 30 秒，尾端靜音可能幻覺。用 `pad=False`，或先用 VAD 篩掉靜音。
- **錯的 mel 統計量。** 用 librosa 的 mel 而不是 Whisper 的，輸出幾乎是亂的。用 `whisper.audio.log_mel_spectrogram`。

## Ship It｜交付成果

存成 `outputs/skill-whisper-tuner.md`。依給定領域設計 Whisper 的 fine-tune 或推論管線（pipeline）。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它把 Whisper 風格的 prompt 切成 token，算解碼形狀的預算，並印出 10 分鐘片段的切塊排程。
2. **中等。** 安裝 `faster-whisper`，轉錄 10 分鐘的 podcast，和人手逐字稿比 WER。試 `language="auto"` 對上強制的 `language="en"`。
3. **困難。** 用 HF 的 `datasets`，挑一個 Whisper 做不好的語言（例如烏爾都文），在 2 小時資料上用 LoRA fine-tune Medium、2 個 epoch，回報 WER 差多少。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 30 秒視窗 | Whisper 的上限 | 硬的輸入上限。更長的音訊要切塊。 |
| SOT | 轉錄開始 | `<\|startoftranscript\|>` 啟動解碼器 prompt。 |
| 時間戳 token | 時間對齊 | 每 0.02 秒的偏移是 5.1 萬詞彙裡的一個特殊 token。 |
| Turbo | 快的變體 | 4 層解碼器，快 8 倍，WER 退步不到 1%。 |
| WhisperX | 長音訊的包裝 | VAD 加 Whisper 加 wav2vec 對齊加說話人分離。 |
| LoRA fine-tune | 高效率調校 | 在注意力上加低秩適配器（low-rank adapter）。大約訓練 0.3% 的參數。 |
| 幻覺 | 靜默的失敗 | Whisper 從雜訊或靜音產出流利英文。 |

## Further Reading｜延伸閱讀

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) ——原始架構和訓練配方。
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) ——4 層解碼器，快 8 倍。
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) ——長音訊、詞級對齊、說話人分離。
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) ——CTranslate2 後端，快 4 倍。
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) ——標準的 LoRA 和完整 fine-tuning 導覽。
