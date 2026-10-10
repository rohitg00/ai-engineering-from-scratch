# 音訊基礎：波形、取樣、傅立葉轉換

> 波形是原始訊號（signal）。頻譜圖是表示法。Mel 特徵（feature）是對機器學習友善的形式。每一條現代 ASR 和 TTS 管線（pipeline）都走這座梯子，第一階是先搞懂取樣與傅立葉轉換。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## The Problem｜問題

麥克風產出壓力對時間的訊號。神經網路吃的是張量（tensor）。中間有一疊慣例，違反了就會產生不易察覺的 bug：模型訓練看起來正常，但 WER 變成兩倍；或 TTS 交付時帶嘶聲；或聲音仿製系統把麥克風背下來，而不是說話的人。

語音系統的每個 bug 都追得到這三個問題之一：

1. 資料是用什麼取樣率（sample rate）錄的，模型期望的又是什麼？
2. 訊號有沒有混疊（aliasing）？
3. 你操作的是原始樣本，還是頻率表示？

這三個對了，第 6 階段剩下的才走得動。錯了，連 Whisper-Large-v4 都會產出垃圾。

## The Concept｜核心概念

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**波形。** 一維浮點陣列，範圍 `[-1.0, 1.0]`。用樣本編號當索引。要換成秒，除以取樣率：`t = n / sr`。16 kHz 的 10 秒片段，是 16 萬個浮點數的陣列。

**取樣率（sr）。** 每秒幾個樣本。2026 年常見的速率：

| 速率 | 用途 |
|------|-----|
| 8 kHz | 電話、舊的 VOIP。奈奎斯特（Nyquist）在 4 kHz，子音被切掉。ASR 不要用。 |
| 16 kHz | ASR 標準。Whisper、Parakeet、SeamlessM4T v2 都吃 16 kHz。 |
| 22.05 kHz | 舊模型的 TTS 聲碼器訓練。 |
| 24 kHz | 現代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音訊、音樂。 |
| 48 kHz | 電影、專業音訊、高傳真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**奈奎斯特–香農。** 取樣率 `sr` 可明確表示至 `sr/2` 的頻率。`sr/2` 這條邊界是*奈奎斯特頻率*。高於奈奎斯特的能量會*混疊*，折進較低的頻率，把訊號弄壞。降採樣（downsampling）之前一定要先低通濾波。

**位元深度（bit depth）。** 16 位元 PCM（有號 int16，範圍 ±32,767）是通用的交換格式。音樂用 24 位元，內部 DSP 用 32 位元浮點。`soundfile` 這類函式庫讀的是 int16，回傳的是 `[-1, 1]` 的 float32 陣列。

**傅立葉轉換。** 任何有限訊號都是不同頻率正弦的和。離散傅立葉轉換（DFT）對 `N` 個樣本算出 `N` 個複係數，每個頻率槽（frequency bin）一個。`bin k` 對到頻率 `k · sr / N` Hz。模（magnitude）是那個頻率的振幅，角度是相位。

**FFT。** 快速傅立葉轉換：當 `N` 是 2 的冪，DFT 的 `O(N log N)` 演算法（algorithm）。每個音訊函式庫底下都用 FFT。16 kHz 的 1024 點 FFT 給出 512 個可用頻率槽，涵蓋 0 到 8 kHz，解析度 15.6 Hz。

**切音框加視窗。** 我們不會對整段做 FFT。把它切成重疊的*音框*（frame），通常 25 毫秒、跳躍長度（hop size） 10 毫秒。每一框乘上窗函數（window），Hann 或 Hamming，消掉邊緣不連續，再對每一框做 FFT。這就是短時傅立葉轉換（STFT）。第 02 課從這裡接下去。

```figure
mel-scale
```

## Build It｜動手實作

### 步驟 1：讀一段片段，畫出波形

`code/main.py` 只用標準函式庫的 `wave` 模組，示範不需安裝額外套件。正式環境會用 `soundfile` 或 `torchaudio.load`（兩者都回 `(waveform, sr)` 元組）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### 步驟 2：從第一原理合成正弦波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

440 Hz 正弦（音樂會的 A），16 kHz、1 秒，是 16,000 個浮點數。用 16 位元 PCM 編碼，以 `wave.open(..., "wb")` 寫出。

### 步驟 3：用手算 DFT

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)`。`N=256` 用來確認正確還可以，實際音訊則不適用。真正的程式呼叫 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### 步驟 4：找出主頻率

振幅頻譜峰值的索引 `k_star` 對到頻率 `k_star * sr / N`。在 440 Hz 正弦上跑，峰應該在頻率槽 `440 * N / sr`。

### 步驟 5：示範混疊

用 10 kHz 取樣 7 kHz 正弦（奈奎斯特是 5 kHz）。7 kHz 高於奈奎斯特，折成 `10 − 7 = 3 kHz`。FFT 的峰出現在 3 kHz。這是經典的混疊示範，也是每個 DAC／ADC 都附磚牆式低通濾波器的原因。

## Use It｜實際應用

2026 年你真正會交付的堆疊：

| 任務 | 函式庫 | 為什麼 |
|------|---------|-----|
| 讀寫 WAV／FLAC／OGG | `soundfile`（libsndfile 的包裝） | 最快、穩定、回 float32。 |
| 重取樣 | `torchaudio.transforms.Resample` 或 `librosa.resample` | 內建正確的抗混疊。 |
| STFT／Mel | `torchaudio` 或 `librosa` | 對 GPU 友善。PyTorch 生態。 |
| 即時串流 | `sounddevice` 或 `pyaudio` | 跨平台的 PortAudio 綁定。 |
| 檢查檔案 | `ffprobe` 或 `soxi` | 命令列、快、回報取樣率／聲道／編解碼器。 |

決策規則：**先把取樣率對上，再對其他東西**。Whisper 期望 16 kHz、單聲道、float32。丟給它 44.1 kHz 立體聲，你會拿到看起來像模型 bug 的垃圾。

## Ship It｜交付成果

存成 `outputs/skill-audio-loader.md`。這個 skill 幫你檢查音訊輸入是否符合下游模型的期望，不符合時正確重取樣。

## Exercises｜練習

1. **簡單。** 在 16 kHz 合成 1 秒的 220 Hz 加 440 Hz 加 880 Hz。跑 DFT。確認預期的頻率槽上有三個峰。
2. **中等。** 用 48 kHz 錄 3 秒自己的聲音 WAV。用 `torchaudio.transforms.Resample`（帶抗混疊）降到 16 kHz，再用單純抽取（每三個樣本取一個）降到 16 kHz。兩邊都做 FFT。混疊出現在哪？
3. **困難。** 只用 `math` 和第 3 步的 DFT，從零做 STFT。音框大小 400、跳躍長度（hop size） 160、Hann 窗。用 `matplotlib.pyplot.imshow` 畫振幅頻譜。這就是第 02 課的頻譜圖。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 取樣率 | 每秒幾個樣本 | ADC 量訊號的頻率，單位 Hz。 |
| 奈奎斯特 | 你能表示的最高頻率 | `sr/2`。高於它的能量會混疊折回去。 |
| 位元深度 | 每個樣本的解析度 | `int16` 是 65,536 階。`float32` 在 `[-1, 1]` 裡是 24 位元精度。 |
| DFT | 序列的傅立葉轉換 | `N` 個樣本 → `N` 個複數頻率係數。 |
| FFT | 快速的 DFT | `O(N log N)` 演算法，需要 `N` 為 2 的冪。 |
| 頻率槽 | 頻率欄 | `k · sr / N` Hz。解析度是 `sr / N`。 |
| STFT | 頻譜圖底下的東西 | 沿時間做切音框、加視窗的 FFT。 |
| 混疊 | 奇怪的頻率鬼影 | 高於奈奎斯特的能量，鏡射到較低的頻率槽。 |

## Further Reading｜延伸閱讀

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) ——取樣定理背後的論文。
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) ——免費、標準的 DSP 教科書。
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) ——帶程式的實作導覽。
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) ——為什麼真實世界的音訊不是乾淨正弦的參考。
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) ——十分鐘把頻率槽的直覺講清楚。
