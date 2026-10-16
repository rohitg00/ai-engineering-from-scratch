# 語音辨識（ASR）：CTC、RNN-T、注意力

> 語音辨識是每個時間步都在做音訊分類，再用一個了解英文與靜音的序列模型把它們串起來。CTC、RNN-T、注意力是三種做法。挑一個，並懂為什麼。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## The Problem｜問題

你有一段 10 秒、16 kHz 的片段。你想得到一串文字：「turn on the kitchen lights」。難在結構：音框（frame）和字元不是一對一。「okay」可能佔 200 毫秒，也可能佔 1200 毫秒。靜音把語句切開。有的音素比別的長。輸出 token 數事先不知道。

可用三種方式處理：

1. **CTC（連線時序分類，Connectionist Temporal Classification）。** 每一框發出 token 機率，含一個特殊的*空白*。解碼時把重複和空白收掉。非自迴歸、快。wav2vec 2.0、MMS 用這個。
2. **RNN-T（遞迴神經網路轉導器，Recurrent Neural Network Transducer）。** 聯合網路依編碼器音框和先前 token 預測下一個 token。可串流。Google 的裝置上 ASR、NVIDIA Parakeet 用這個。
3. **注意力編碼器–解碼器（attention encoder–decoder）。** 編碼器把音訊壓成隱藏狀態，解碼器交叉注意力、自迴歸生成 token。Whisper、SeamlessM4T 用這個。

2026 年，LibriSpeech test-clean 上目前最好的 WER 是 1.4%（Parakeet-TDT-1.1B，NVIDIA）和 1.58%（Whisper-Large-v3-turbo）。數字差很少。部署上的差別很大。

## The Concept｜核心概念

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC 的直覺。** 讓編碼器輸出 `T` 個音框級分布，在 `V+1` 個 token 上（V 個字元加空白）。目標字串 `y` 的長度是 `U < T`。任何合併之後等於 `y` 的音框對齊都算。CTC 損失把所有這種對齊加起來。推論：每一框取 argmax，收掉重複，拿掉空白。

優點：非自迴歸、可串流、不用往前看。缺點：*條件獨立假設（conditional independence assumption）*。每一框的預測和其他框獨立，所以沒有內部語言模型。用集束搜尋（beam search）或淺層融合接外部語言模型來補。

**RNN-T 的直覺。** 加上一個*預測器*網路，把 token 歷史嵌進去，以及一個*接合器*，把預測器狀態和編碼器音框合成 `V+1` 上的聯合分布（這個 `+1` 是空／不輸出）。CTC 忽略的條件相依，這裡明確建了模型。可串流，因為每一步只條件在過去的音框和過去的 token 上。

優點：可串流，而且有內部語言模型。缺點：訓練更複雜、更吃記憶體（三維的損失格子）。RNN-T 損失的核本身就是一整類函式庫。

**注意力編碼器–解碼器。** 編碼器（6 到 32 層 transformer）吃對數 mel 音框。解碼器（6 到 32 層 transformer）對編碼器輸出做交叉注意力，自迴歸生成 token。沒有對齊限制。注意力可以看音訊的任何地方。除非你限制注意力（切塊的 Whisper-Streaming，2024），否則不能串流。

優點：離線 ASR 品質最高，用標準的序列到序列工具也好訓練。缺點：自迴歸延遲和輸出長度成正比。不額外做工程就不能串流。

### WER：那一個數字

**詞錯誤率（Word Error Rate）** = `(S + D + I) / N`。S 是替換，D 是刪除，I 是插入，N 是參考詞數。對上詞級的 Levenshtein 編輯距離。愈低愈好。WER 高於 20% 通常不能用。低於 5% 是朗讀語音的人類水準。2026 年標準基準上的數字：

| 模型 | LibriSpeech test-clean | LibriSpeech test-other | 大小 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 11 億參數 |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 8.09 億 |
| Canary-1B Flash | 1.48% | 2.87% | 10 億 |
| Seamless M4T v2 | 1.7% | 3.5% | 23 億 |

這些都是編碼器–解碼器或 RNN-T。純 CTC 系統（wav2vec 2.0）在 test-clean 上大約 1.8% 到 2.1%。

```figure
ctc-collapse
```

## Build It｜動手實作

### 步驟 1：貪婪 CTC 解碼

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

兩條規則：收掉連續重複，丟掉空白。例子：`a a _ _ a b b _ c` 變成 `a a b c`。

### 步驟 2：集束搜尋 CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

正式環境用前綴樹集束搜尋，加上語言模型融合。這是概念上的骨架。

### 步驟 3：WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### 步驟 4：對 Whisper 做推論

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

一行，2026 年最強的通用 ASR。24 GB GPU 上大約 20 倍即時。

### 步驟 5：用 Parakeet 或 wav2vec 2.0 串流

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

串流 ASR 需要切塊的編碼器注意力，以及帶過去的狀態。用有支援的函式庫（Parakeet 用 NeMo，`transformers` 管線用 `chunk_length_s`）。

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 挑 |
|-----------|------|
| 英文、離線、品質優先 | Whisper-large-v3-turbo |
| 多語、要穩 | SeamlessM4T v2 |
| 串流、低延遲 | Parakeet-TDT-1.1B 或 Riva |
| 邊緣、手機、延遲低於 500 毫秒 | 量化過的 Whisper-Tiny，或 Moonshine（2024） |
| 長音訊 | Whisper 用 VAD 切塊（WhisperX） |
| 特定領域（醫學、法律） | fine-tune wav2vec 2.0，再融合領域語言模型 |

## 2026 年仍然會交付出去的坑

- **沒有 VAD。** 讓 Whisper 處理靜音會產生幻覺（「Thanks for watching!」）。一律先用 VAD 篩掉靜音。
- **字元、詞、子詞（subword）的 WER。** 正規化之後（小寫、去掉標點）再報詞級 WER。
- **語言辨識漂掉。** Whisper 的自動語言辨識會把吵的片段送去日文或威爾斯文。你知道語言時強制 `language="en"`。
- **長片段沒有切塊。** Whisper 的視窗是 30 秒。更長的用 `chunk_length_s=30, stride=5`。

## Ship It｜交付成果

存成 `outputs/skill-asr-picker.md`。依部署目標挑模型、解碼策略、切塊，以及語言模型融合。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它貪婪解碼一份手工做的 CTC 輸出，並對參考算 WER。
2. **中等。** 把步驟 2 的前綴樹集束搜尋做對（把空白合併規則算進去）。在 10 筆合成資料上和貪婪比。
3. **困難。** 在 [LibriSpeech test-clean](https://www.openslr.org/12) 上用 `whisper-large-v3-turbo`。算前 100 句的 WER。和公開的數字比。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| CTC | 空白 token 的損失 | 對所有音框到 token 的對齊做邊際化。非自迴歸。 |
| RNN-T | 串流的損失 | CTC 加下一個 token 的預測器。處理詞序。 |
| 注意力編碼–解碼 | Whisper 風格 | 編碼器加交叉注意力解碼器。離線品質最好。 |
| WER | 你要回報的那個數字 | 詞級的 `(S+D+I)/N`。 |
| 空白 | 空 | CTC 的特殊 token，表示這一框不輸出。 |
| 語言模型融合 | 外部語言模型 | 集束搜尋時加上加權的語言模型對數機率。 |
| VAD | 靜音閘 | 語音活動偵測器。把非語音切掉。 |

## Further Reading｜延伸閱讀

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) ——CTC 那篇論文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) ——RNN-T 那篇論文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) ——2022 年的標準論文。2024 年延伸到 v3-turbo。
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) ——2026 年 Open ASR 排行榜的領先者。
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) ——25 個以上模型的即時基準。
