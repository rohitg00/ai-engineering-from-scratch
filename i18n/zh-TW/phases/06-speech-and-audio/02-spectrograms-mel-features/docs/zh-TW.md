# 頻譜圖、梅爾刻度與音訊特徵

> 神經網路吃原始波形吃不好。它們吃頻譜圖。吃梅爾頻譜圖（mel-spectrogram）更好。2026 年每一個 ASR、TTS、音訊分類器，成敗就看這一個前處理選擇。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## The Problem｜問題

拿一段 10 秒、16 kHz 的片段。那是 16 萬個浮點數，全在 `[-1, 1]`，和標籤「狗叫」或「cat 這個詞」幾乎完全不相關。資訊在原始波形裡，但模型不容易抽出來。相隔 100 毫秒的兩個相同音素，原始樣本完全不同。

頻譜圖解決了這個問題。人類知覺忽略的時間細節（微秒級的抖動）被它收掉，知覺在意的結構留著：哪些頻率有能量，時間視窗大約 10 到 25 毫秒。

梅爾頻譜圖再推一步。人類對音高的知覺是對數的：100 Hz 對 200 Hz，聽起來和 1000 Hz 對 2000 Hz「距離一樣」。梅爾刻度（mel scale）把頻率軸扭曲到符合這種感知。從 2010 到 2026，語音機器學習裡最重要的單一特徵（feature）就是梅爾頻譜圖。

## The Concept｜核心概念

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**短時傅立葉轉換（Short-Time Fourier Transform，STFT）。** 把波形切成重疊的音框（frame）。典型是 25 毫秒視窗、10 毫秒跳躍長度（hop size），16 kHz 下是 400 個樣本／160 個樣本。每一框乘上窗函數（window）。Hann 是預設。Hamming 的取捨稍微不同。每一框做 FFT。把幅度譜疊成形狀 `(n_frames, n_freq_bins)` 的矩陣。那就是頻譜圖。

**對數幅度。** 原始幅度跨 5 到 6 個數量級。取 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 來壓縮動態範圍。每一條正式環境管線（pipeline）用的是對數幅度，不是原始幅度。

**梅爾刻度。** 頻率 `f`（Hz）對應到梅爾值 `m`，公式是 `m = 2595 * log10(1 + f / 700)`。大約 1 kHz 以下接近線性，以上接近對數。80 個梅爾頻率槽（mel bin）、涵蓋 0 到 8 kHz，是 ASR 的標準輸入。

**梅爾濾波器組（mel filterbank）。** 一組在梅爾刻度上等距的三角濾波器。每個濾波器是相鄰 FFT 箱的加權和。STFT 幅度乘上濾波器組矩陣，一次矩陣乘法就得到梅爾頻譜圖。

**對數梅爾頻譜圖（log-mel spectrogram）。** `log(mel_spec + 1e-10)`。Whisper 的輸入。Parakeet 的輸入。SeamlessM4T 的輸入。2026 年通用的音訊前端。

**MFCC。** 取對數梅爾頻譜圖，做 DCT（第二型），留前 13 個係數。讓特徵彼此去相關，再壓得更小。大約到 2015 年都是主力，後來 CNN 和 transformer 直接吃原始對數梅爾特徵追上了。語者辨識（x-vector、ECAPA）仍在用。

**解析度的取捨。** FFT 愈大，頻率解析度愈好，時間解析度愈差。25 毫秒／10 毫秒是音訊機器學習的預設。音樂用 50 毫秒／12.5 毫秒。暫態偵測（鼓點、爆破音）用 5 毫秒／2 毫秒。

```figure
spectrogram-window
```

## Build It｜動手實作

### 步驟 1：把波形切成音框

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

10 秒、16 kHz、`frame_len=400, hop=160`，得到 998 框。

### 步驟 2：Hann 窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

FFT 之前逐元素相乘。消掉在非零端點截斷造成的頻譜洩漏。

### 步驟 3：STFT 幅度

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

正式環境用 `torch.stft` 或 `librosa.stft`（FFT 實作、向量化）。這裡的迴圈是拿來教學的。它在 `code/main.py` 裡跑短片段。

### 步驟 4：Mel 濾波器組

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

80 個梅爾頻率槽、涵蓋 0 到 8 kHz、`n_fft=400`，得到 `(80, 201)` 矩陣。`(n_frames, 201)` 的 STFT 幅度乘上轉置，得到 `(n_frames, 80)` 的梅爾頻譜圖。

### 步驟 5：對數梅爾

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常見替代：`librosa.power_to_db`（以參考值正規化的 dB）、`10 * log10(power + eps)`。Whisper 用更複雜的裁切加正規化（見 Whisper 的 `log_mel_spectrogram`）。

### 步驟 6：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

對每一框對數梅爾做 DCT，留前 13 個係數。那就是 MFCC 矩陣。第一個係數通常丟掉（它編碼的是整體能量）。

## Use It｜實際應用

2026 年的堆疊：

| 任務 | 特徵 |
|------|----------|
| ASR（Whisper、Parakeet、SeamlessM4T） | 80 個對數梅爾，10 毫秒跳躍長度，25 毫秒視窗 |
| TTS 聲學模型（VITS、F5-TTS、Kokoro） | 80 個梅爾頻率槽，5 到 12 毫秒跳躍長度，用來精細控制時間 |
| 音訊分類（AST、PANNs、BEATs） | 128 個對數梅爾，10 毫秒跳躍長度 |
| 說話人 embedding（ECAPA-TDNN、WavLM） | 80 個對數梅爾，或原始波形的自監督 |
| 音樂（MusicGen、Stable Audio 2） | EnCodec 離散 token（不是梅爾） |
| 關鍵字偵測（keyword spotting） | 很小的裝置用 40 個 MFCC |

經驗法則：**如果你不是在做音樂，從 80 個對數梅爾開始。** 要偏離，舉證責任在你。

## 2026 年仍會隨產品上線的陷阱

- **數量不一致。** 訓練用 80 個梅爾，推論用 128 個。靜默失敗。兩邊都把特徵形狀記下來。
- **上游取樣率不合。** 22.05 kHz 算出的梅爾特徵和 16 kHz 看起來不一樣。做特徵*之前*先把取樣率修好。
- **dB 對上對數。** Whisper 期望對數梅爾，不是 dB 梅爾。有些 Hugging Face 管線會自動偵測。你自己的程式不會。
- **正規化飄移。** 訓練時每一句正規化，推論時全域正規化。正式環境的 bug，WER 會變成兩倍。
- **填充造成的洩漏。** 片段尾端補零，尾端音框會出現平坦頻譜。對稱填充，或複製。

## Ship It｜交付成果

存成 `outputs/skill-feature-extractor.md`。這個 skill 依目標模型挑特徵種類、梅爾數量、音框／跳躍長度，以及正規化。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它合成一段啁啾訊號（chirp，頻率從 200 掃到 4000 Hz），並印出每一框 argmax 的梅爾頻率槽。可選：畫出來，確認和掃頻對得上。
2. **中等。** 用 `n_mels` 取 `{40, 80, 128}`、`frame_len` 取 `{200, 400, 800}` 再跑。沿時間軸量尖峰的頻寬。哪一組把啁啾分得最清楚？
3. **困難。** 實作 `power_to_db`，在 AudioMNIST 上用一個很小的 CNN 分類器比較 ASR 準確率：（a）原始對數梅爾，（b）`ref=max` 的 dB 梅爾，（c）MFCC-13 加 delta 加 delta-delta。回報 top-1 準確率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 音框 | 一片 | 送進一次 FFT 的 25 毫秒波形。 |
| Hop | 步幅 | 連續音框之間的樣本數。ASR 預設是 10 毫秒。 |
| 視窗 | Hann／Hamming 那件事 | 逐點相乘，把音框邊緣收到零。 |
| STFT | 頻譜圖產生器 | 切音框、加視窗的 FFT。得到時間乘頻率的矩陣。 |
| Mel | 扭過的頻率 | 對數知覺尺度。`m = 2595·log10(1 + f/700)`。 |
| 濾波器組 | 那個矩陣 | 三角濾波器，把 STFT 投影到梅爾頻率槽。 |
| 對數 mel | Whisper 的輸入 | `log(mel_spec + eps)`。2026 年的標準。 |
| MFCC | 老派特徵 | 對數梅爾的 DCT。13 個係數，去掉相關。 |

## Further Reading｜延伸閱讀

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) ——MFCC 那篇論文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) ——最早的 mel 尺度。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) ——讀參考實作。
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) ——`mfcc`、`melspectrogram`，以及 hop／視窗的參考。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) ——Parakeet 加 Canary 的正式環境規模管線。
