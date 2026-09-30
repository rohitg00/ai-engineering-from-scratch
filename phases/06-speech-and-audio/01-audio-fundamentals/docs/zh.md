# 音訊基礎 —— 波形、取樣與傅立葉轉換

> 波形是原始訊號。頻譜圖是表示法。梅爾特徵是適合 ML 的形式。每一套現代 ASR 與 TTS 流程都在爬這道梯子，而第一階就是搞懂取樣與傅立葉。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 1 · 06（向量與矩陣）、階段 1 · 14（機率分布）
**時間：** 約 45 分鐘

## 問題所在

麥克風產生的是壓力隨時間變化的訊號。你的神經網路吃進去的是張量。兩者之間夾著一疊慣例，一旦違反就會生出無聲的 bug：模型訓練看起來很正常，但 WER 翻倍；或者 TTS 上線後帶著嘶聲；或者一套語音複製系統記住的是麥克風，而不是說話的人。

語音系統裡的每個 bug，都能追回這三個問題之一：

1. 資料錄製時的取樣率是多少，而模型預期的又是多少？
2. 訊號有沒有疊頻？
3. 你操作的是原始樣本，還是某種頻率表示法？

把這些弄對，階段 6 剩下的部分都好辦。弄錯的話，就算是 Whisper-Large-v4 也只會吐出垃圾。

## 核心概念

![以視覺呈現波形、取樣、DFT 與頻率 bin](../assets/audio-fundamentals.svg)

**波形。** 一個一維的浮點數陣列，數值落在 `[-1.0, 1.0]`，以樣本編號索引。要換算成秒就除以取樣率：`t = n / sr`。16 kHz 下 10 秒的片段，就是一個有 160,000 個浮點數的陣列。

**取樣率（sr）。** 每秒取幾個樣本。2026 年常見的取樣率：

| 取樣率 | 用途 |
|------|-----|
| 8 kHz | 電話語音、舊式 VOIP。奈奎斯特只到 4 kHz，子音全毀。ASR 別用。 |
| 16 kHz | ASR 標準。Whisper、Parakeet、SeamlessM4T v2 全都吃 16 kHz。 |
| 22.05 kHz | 舊款模型的 TTS 聲碼器訓練。 |
| 24 kHz | 現代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音訊、音樂。 |
| 48 kHz | 電影、專業音訊、高保真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**奈奎斯特-夏農取樣定理。** 取樣率為 `sr` 時，能無歧義表示的頻率上限是 `sr/2`。`sr/2` 這條界線就是*奈奎斯特頻率*。高於奈奎斯特的能量會產生*疊頻*——被折回到較低的頻率——並破壞訊號。降採樣之前一定要先做低通濾波。

**位元深度。** 16-bit PCM（有號 int16，範圍 ±32,767）是通用的交換格式。音樂用 24-bit，內部 DSP 用 32-bit 浮點。像 `soundfile` 這類函式庫讀進來的是 int16，但對外提供的是落在 `[-1, 1]` 的 float32 陣列。

**傅立葉轉換。** 任何有限長度的訊號都是不同頻率正弦波的總和。離散傅立葉轉換（DFT）會為 `N` 個樣本算出 `N` 個複數係數——每個頻率 bin 一個。`bin k` 對應到 `k · sr / N` Hz 的頻率。大小是該頻率上的振幅，角度是相位。

**FFT。** 快速傅立葉轉換：當 `N` 是 2 的次方時，用 `O(N log N)` 算出 DFT 的演算法。每個音訊函式庫底層都用 FFT。16 kHz 下做 1024 點的 FFT，會得到 512 個可用的頻率 bin，涵蓋 0–8 kHz，解析度 15.6 Hz。

**分幀 + 加窗。** 我們不會對整段片段做 FFT，而是把它切成一段段重疊的*幀*（通常幀長 25 ms、hop 10 ms），每一幀乘上一個窗函數（Hann、Hamming）來消掉邊界的不連續，然後對每一幀各做一次 FFT。這就是短時傅立葉轉換（STFT）。單元 02 會從這裡接下去。

```figure
mel-scale
```

## 動手實作

### 步驟 1：讀入一段片段並畫出波形

`code/main.py` 只用標準函式庫的 `wave` 模組，讓這個示範不依賴任何外部套件。上到正式環境你會用 `soundfile` 或 `torchaudio.load`（兩者都回傳 `(waveform, sr)` 元組）：

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

16 kHz 下 1 秒的 440 Hz 正弦波（標準音 A）就是 16,000 個浮點數。用 `wave.open(..., "wb")` 以 16-bit PCM 編碼寫出檔案。

### 步驟 3：手算 DFT

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

`O(N²)` —— 在 `N=256` 時拿來確認正確性還可以，對真實音訊則毫無用處。真正在跑的程式碼會呼叫 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### 步驟 4：找出主頻率

大小的峰值索引 `k_star` 對應到頻率 `k_star * sr / N`。拿 440 Hz 的正弦波跑這一段，應該會在 bin `440 * N / sr` 出現峰值。

### 步驟 5：示範疊頻

用 10 kHz 去對一個 7 kHz 的正弦波取樣（奈奎斯特 = 5 kHz）。7 kHz 這個音高於奈奎斯特，會折到 `10 − 7 = 3 kHz`。FFT 的峰值就出現在 3 kHz。這是經典的疊頻示範，也是每顆 DAC/ADC 都內建陡峭低通濾波器的原因。

## 框架應用

2026 年你真正會拿去上線的那一套：

| 任務 | 函式庫 | 為什麼 |
|------|---------|-----|
| 讀寫 WAV/FLAC/OGG | `soundfile`（libsndfile 的包裝） | 最快、穩定，回傳 float32。 |
| 重新取樣 | `torchaudio.transforms.Resample` 或 `librosa.resample` | 內建正確的抗疊頻處理。 |
| STFT／梅爾 | `torchaudio` 或 `librosa` | 對 GPU 友善；PyTorch 生態系。 |
| 即時串流 | `sounddevice` 或 `pyaudio` | 跨平台的 PortAudio 綁定。 |
| 檢查檔案 | `ffprobe` 或 `soxi` | CLI、快，會報出取樣率／聲道／編碼器。 |

決策原則：**先對上取樣率，其他都排在後面**。Whisper 要的是 16 kHz 單聲道 float32。餵它 44.1 kHz 立體聲，你只會拿到一堆看起來像模型 bug 的垃圾。

## 產出交付

存成 `outputs/skill-audio-loader.md`。這個 skill 幫你檢查音訊輸入是否符合下游模型的預期，不符合時就正確地重新取樣。

## 練習

1. **簡單。** 在 16 kHz 下合成 1 秒的 220 Hz + 440 Hz + 880 Hz 混合訊號。跑 DFT。確認在預期的 bin 上出現三個峰。
2. **中等。** 用 48 kHz 錄一段 3 秒你自己聲音的 WAV。先用 `torchaudio.transforms.Resample`（含抗疊頻）降到 16 kHz，再用天真的抽取法（每三個樣本取一個）降到 16 kHz。兩者都做 FFT。疊頻出現在哪裡？
3. **困難。** 只用 `math` 與步驟 3 的 DFT，從零把 STFT 做出來。幀長 400、hop 160、Hann 窗。用 `matplotlib.pyplot.imshow` 把大小畫出來。這就是單元 02 的頻譜圖。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 取樣率 | 每秒有幾個樣本 | ADC 量測訊號的頻率，單位為 Hz。 |
| 奈奎斯特 | 你能表示的最高頻率 | `sr/2`；高於它的能量會疊頻折回來。 |
| 位元深度 | 每個樣本的解析度 | `int16` = 65,536 個階；`float32` = `[-1, 1]` 區間內 24-bit 的精度。 |
| DFT | 給序列用的傅立葉轉換 | `N` 個樣本 → `N` 個複數頻率係數。 |
| FFT | 快速版的 DFT | `O(N log N)` 的演算法，要求 `N` 是 2 的次方。 |
| Bin | 頻率的一欄 | `k · sr / N` Hz；解析度 = `sr / N`。 |
| STFT | 頻譜圖的底層做法 | 沿時間軸做分幀 + 加窗的 FFT。 |
| 疊頻 | 詭異的頻率鬼影 | 高於奈奎斯特的能量鏡射到較低的 bin。 |

## 延伸閱讀

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) —— 取樣定理背後的那篇論文。
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) —— 免費的 DSP 經典教科書。
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) —— 附程式碼的實用導覽。
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) —— 解釋真實世界的音訊為何不是乾淨正弦波的參考書。
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) —— 10 分鐘講清楚頻率 bin 的直覺。
