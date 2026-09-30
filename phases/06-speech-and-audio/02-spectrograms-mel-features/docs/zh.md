# 頻譜圖、梅爾刻度與音訊特徵

> 神經網路吃原始波形吃得不好。它吃頻譜圖。它吃梅爾頻譜圖吃得更好。2026 年每一套 ASR、TTS 與音訊分類器的成敗，都押在這一個前處理決定上。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 01（音訊基礎）
**時間：** 約 45 分鐘

## 問題所在

拿一段 10 秒、16 kHz 的片段。那是 160,000 個浮點數，全都落在 `[-1, 1]`，而且跟「狗在叫」或「cat 這個詞」這種標籤幾乎毫無相關性。原始波形有那個資訊，但形式讓模型很難萃取出來。同一個音素相隔 100 ms 說兩次，原始樣本會完全不同。

頻譜圖解決了這件事。它在人類感知不在意的地方（微秒級的抖動）壓掉時間細節，並在感知會注意的地方（在約 10–25 ms 的時間窗內，哪些頻率有能量）保留結構。

梅爾頻譜圖更進一步。人類對音高的感知是對數的：100 Hz 對 200 Hz 聽起來「距離一樣遠」，就像 1000 Hz 對 2000 Hz 一樣。梅爾刻度把頻率軸扭曲成符合這種感知。從 2010 到 2026，梅爾刻度化的頻譜圖都是語音 ML 裡最重要的單一特徵。

## 核心概念

![從波形到 STFT 到梅爾頻譜圖再到 MFCC 的階梯](../assets/mel-features.svg)

**STFT（短時傅立葉轉換）。** 把波形切成一段段重疊的幀（典型設定：窗長 25 ms、幀移 10 ms，在 16 kHz 下就是 400 個樣本 / 160 個樣本）。每一幀乘上一個窗函數（預設是 Hann；Hamming 則是稍微不同的取捨）。對每一幀做 FFT。把大小頻譜疊成形狀為 `(n_frames, n_freq_bins)` 的矩陣。那就是你的頻譜圖。

**對數大小。** 原始大小值橫跨 5 到 6 個數量級。取 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 來壓縮動態範圍。每一套正式環境的流程都用對數大小，不用原始大小。

**梅爾刻度。** 頻率 `f`（Hz）依 `m = 2595 * log10(1 + f / 700)` 對應到梅爾值 `m`。這個對應在 1 kHz 以下大致是線性的，以上則大致是對數的。涵蓋 0–8 kHz 的 80 個梅爾 bin，是 ASR 的標準輸入。

**梅爾濾波器組。** 一組在梅爾刻度上等距排列的三角形濾波器。每個濾波器都是相鄰 FFT bin 的加權總和。把 STFT 大小乘上濾波器組矩陣，一次矩陣乘法就得到梅爾頻譜圖。

**對數梅爾頻譜圖。** `log(mel_spec + 1e-10)`。Whisper 的輸入。Parakeet 的輸入。SeamlessM4T 的輸入。2026 年通用的音訊前端。

**MFCC。** 拿對數梅爾頻譜圖做一次 DCT（type II），保留前 13 個係數。這會把特徵去相關並進一步壓縮。它是主流特徵，一直到大約 2015 年直接吃原始對數梅爾的 CNN／Transformer 追上為止。在說話人辨識（x-vectors、ECAPA）中仍然在用。

**解析度取捨。** FFT 越大 = 頻率解析度越好，但時間解析度越差。25 ms / 10 ms 是音訊 ML 的預設；音樂用 50 ms / 12.5 ms；暫態偵測（鼓點、爆破音）用 5 ms / 2 ms。

```figure
spectrogram-window
```

## 動手實作

### 步驟 1：把波形切成幀

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

一段 10 秒、16 kHz 的片段，用 `frame_len=400, hop=160` 會得到 998 幀。

### 步驟 2：Hann 窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在 FFT 之前逐點相乘。這會消掉在非零端點處截斷所造成的頻譜洩漏。

### 步驟 3：STFT 大小

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

正式環境用 `torch.stft` 或 `librosa.stft`（底層是 FFT、向量化）。這裡的迴圈是教學用的；它在 `code/main.py` 裡跑的是短片段。

### 步驟 4：梅爾濾波器組

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 個梅爾涵蓋 0–8 kHz、`n_fft=400` 時，會得到一個 `(80, 201)` 的矩陣。把 `(n_frames, 201)` 的 STFT 大小乘上它的轉置，就得到 `(n_frames, 80)` 的梅爾頻譜圖。

### 步驟 5：對數梅爾

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常見的替代做法：`librosa.power_to_db`（以參考值正規化的 dB）、`10 * log10(power + eps)`。Whisper 用的是一套更複雜的裁切 + 正規化流程（見 Whisper 的 `log_mel_spectrogram`）。

### 步驟 6：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

對每一個對數梅爾幀做 DCT，保留前 13 個係數。那就是你的 MFCC 矩陣。第一個係數通常會丟掉（它編的是整體能量）。

## 框架應用

2026 年的那一套：

| 任務 | 特徵 |
|------|----------|
| ASR（Whisper、Parakeet、SeamlessM4T） | 80 維對數梅爾，幀移 10 ms，窗長 25 ms |
| TTS 聲學模型（VITS、F5-TTS、Kokoro） | 80 維梅爾，幀移 5–12 ms 以取得細緻的時間控制 |
| 音訊分類（AST、PANNs、BEATs） | 128 維對數梅爾，幀移 10 ms |
| 說話人嵌入（ECAPA-TDNN、WavLM） | 80 維對數梅爾，或直接對原始波形做自監督學習 |
| 音樂（MusicGen、Stable Audio 2） | EnCodec 離散詞元（不是梅爾） |
| 關鍵詞偵測 | 給微型裝置用的 40 維 MFCC |

經驗法則：**如果你不是在做音樂，就從 80 維對數梅爾開始。** 任何偏離都得自己舉證。

## 到了 2026 年還是常被交付出去的陷阱

- **梅爾數量不一致。** 訓練用 80 個梅爾，推論用 128 個。無聲的失敗。兩端都要記錄特徵形狀。
- **上游取樣率不一致。** 在 22.05 kHz 算出來的梅爾跟 16 kHz 的長得不一樣。取樣率要在*特徵化之前*修好。
- **dB 與 log 混用。** Whisper 要的是對數梅爾，不是 dB 梅爾。有些 HF pipeline 會自動偵測；你自己寫的程式碼不會。
- **正規化漂移。** 訓練時用單句正規化，推論時用全域正規化。這種正式環境的 bug 會讓 WER 翻倍。
- **補零造成的洩漏。** 在片段結尾補零，會讓尾端那幾幀出現平坦的頻譜。要對稱地補，或是複製邊界值。

## 產出交付

存成 `outputs/skill-feature-extractor.md`。這個 skill 會針對指定的目標模型，挑選特徵類型、梅爾數量、幀長／幀移與正規化方式。

## 練習

1. **簡單。** 跑 `code/main.py`。它會合成一段啾聲（頻率從 200 掃到 4000 Hz），並印出每一幀的 argmax 梅爾 bin。（選做）畫出來，確認它符合那道掃頻。
2. **中等。** 用 `n_mels` 取 `{40, 80, 128}`、`frame_len` 取 `{200, 400, 800}` 重跑一遍。沿時間軸量測尖峰的頻寬。哪一組把啾聲解析得最好？
3. **困難。** 實作 `power_to_db`，並在 AudioMNIST 上比較一個小型 CNN 分類器分別用（a）原始對數梅爾、（b）`ref=max` 的 dB 梅爾、（c）MFCC-13 + delta + delta-delta 時的 ASR 準確率。報告 top-1 準確率。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 幀 | 一小段 | 餵給一次 FFT 的 25 ms 波形區塊。 |
| 幀移 | 步幅 | 相鄰兩幀之間相隔的樣本數；ASR 預設 10 ms。 |
| 窗函數 | Hann／Hamming 那個東西 | 逐點相乘的乘數，把幀的邊緣收斂到零。 |
| STFT | 頻譜圖產生器 | 分幀 + 加窗的 FFT；產出時間 × 頻率矩陣。 |
| 梅爾 | 被扭曲的頻率 | 符合對數感知的刻度；`m = 2595·log10(1 + f/700)`。 |
| 濾波器組 | 那個矩陣 | 把 STFT 投影到梅爾 bin 的三角形濾波器。 |
| 對數梅爾 | Whisper 的輸入 | `log(mel_spec + eps)`；2026 年的標準做法。 |
| MFCC | 老派特徵 | 對數梅爾的 DCT；13 個係數，已去相關。 |

## 延伸閱讀

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) —— MFCC 那篇論文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) —— 最原始的梅爾刻度。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) —— 讀一下參考實作。
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) —— `mfcc`、`melspectrogram` 以及幀移／窗長的參考文件。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) —— Parakeet + Canary 模型正式規模的流程。
