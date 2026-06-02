# 音频基础——波形、采样与傅里叶变换（Audio Fundamentals — Waveforms, Sampling, Fourier Transform）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 波形是原始信号。Spectrogram（声谱图）是它的表示方式。Mel 特征是对 ML 友好的形式。每一个现代 ASR 与 TTS 流水线都要爬这道阶梯，而第一级台阶就是理解采样与傅里叶。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## 问题（The Problem）

麦克风输出的是「压力对时间」的信号。你的神经网络吃的是张量。两者之间夹着一摞约定俗成的规矩，一旦违反就会冒出沉默的 bug：模型训得好好的但 WER 翻倍，或者 TTS 上线后带着嘶嘶声，又或者声音克隆系统记住的不是说话人而是麦克风。

语音系统里所有的 bug，归根到底都来自三个问题之一：

1. 数据是用什么 sample rate（采样率）录的？模型期望的又是多少？
2. 信号有没有发生混叠（alias）？
3. 你处理的是原始采样点，还是某种频域表示？

把这三件事弄对，Phase 6 剩下的内容就好办了。弄错了，连 Whisper-Large-v4 都会输出一堆垃圾。

## 概念（The Concept）

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**波形（Waveform）。** 一个一维 float 数组，取值在 `[-1.0, 1.0]`，按采样点编号索引。要换算成秒，除以采样率即可：`t = n / sr`。一段 16 kHz 下 10 秒的片段就是一个 160,000 个 float 的数组。

**采样率（Sampling rate, sr）。** 每秒采样多少个点。2026 年常见的几档：

| Rate | 用途 |
|------|-----|
| 8 kHz | 电话、传统 VOIP。Nyquist 在 4 kHz，会吃掉辅音。ASR 不要用。 |
| 16 kHz | ASR 的标准。Whisper、Parakeet、SeamlessM4T v2 全部吃 16 kHz。 |
| 22.05 kHz | 老一代 TTS vocoder 训练用。 |
| 24 kHz | 现代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音频、音乐。 |
| 48 kHz | 影视、专业音频、高保真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**Nyquist-Shannon 定理。** 采样率为 `sr` 时，可以无歧义地表示最高 `sr/2` 的频率。`sr/2` 这条边界叫 *Nyquist 频率*。高于 Nyquist 的能量会发生 *混叠*（aliasing）——被「折叠」到更低的频率上——把信号搞坏。下采样前一定要先低通滤波。

**位深（Bit depth）。** 16-bit PCM（有符号 int16，范围 ±32,767）是通用的交换格式。音乐用 24-bit，DSP 内部计算用 32-bit float。`soundfile` 这类库读进来的是 int16，但暴露给你的是 `[-1, 1]` 区间内的 float32 数组。

**傅里叶变换（Fourier Transform）。** 任何有限信号都可以写成不同频率正弦波的和。离散傅里叶变换（DFT）对 `N` 个采样点计算出 `N` 个复系数——每个频率 bin 一个。`bin k` 对应频率 `k · sr / N` Hz。模长是该频率上的振幅，幅角是相位。

**FFT（快速傅里叶变换）。** 当 `N` 是 2 的幂时，DFT 有一个 `O(N log N)` 的算法。每个音频库底下都用 FFT。16 kHz 下做一次 1024 点 FFT，会得到 512 个可用的频率 bin，覆盖 0–8 kHz，分辨率 15.6 Hz。

**分帧 + 加窗（Framing + window）。** 我们不会对一整段片段做 FFT，而是把它切成有重叠的 *帧*（典型是 25 ms 帧、10 ms hop），每帧乘以一个 window 函数（Hann、Hamming）以消除边界突变，再对每帧做 FFT。这就是短时傅里叶变换（STFT）。Lesson 02 会从这里继续讲。

## 动手实现（Build It）

### Step 1：读一段片段并画出波形

`code/main.py` 只用了标准库 `wave` 模块，让 demo 不依赖任何第三方包。生产环境你会用 `soundfile` 或 `torchaudio.load`（两者都返回 `(waveform, sr)` 元组）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Step 2：从第一性原理合成一个正弦波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

16 kHz 下 1 秒的 440 Hz 正弦波（音乐会 A 音）就是 16,000 个 float。用 `wave.open(..., "wb")` 以 16-bit PCM 编码写出去。

### Step 3：手写一份 DFT

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

`O(N²)`——`N=256` 时拿来验证正确性可以，处理真实音频就别想了。生产代码会调 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### Step 4：找出主频

模长峰值的索引 `k_star` 对应频率 `k_star * sr / N`。把它跑在 440 Hz 正弦波上，应该在 bin `440 * N / sr` 处看到峰值。

### Step 5：演示混叠

用 10 kHz 采样率（Nyquist = 5 kHz）去采一个 7 kHz 的正弦波。7 kHz 高于 Nyquist，会折叠到 `10 − 7 = 3 kHz`。FFT 的峰值会出现在 3 kHz 处。这就是教科书级别的混叠演示，也是为什么所有 DAC/ADC 都会带一个砖墙式低通滤波器。

## 用起来（Use It）

2026 年你真正会上线的那一套：

| 任务 | 库 | 为什么 |
|------|---------|-----|
| 读写 WAV/FLAC/OGG | `soundfile`（libsndfile 的封装） | 最快、稳定、返回 float32。 |
| 重采样（Resample） | `torchaudio.transforms.Resample` 或 `librosa.resample` | 内置正确的反混叠（anti-aliasing）。 |
| STFT / Mel | `torchaudio` 或 `librosa` | GPU 友好；PyTorch 生态。 |
| 实时流式处理 | `sounddevice` 或 `pyaudio` | 跨平台 PortAudio 绑定。 |
| 检查文件 | `ffprobe` 或 `soxi` | CLI、快、能报告 sr / 声道数 / 编码。 |

决策原则：**先把 sample rate 对齐，再去对齐别的任何东西**。Whisper 期望的是 16 kHz 单声道 float32。喂它 44.1 kHz 立体声，你拿到的会是看起来像「模型 bug」的垃圾输出。

## 上线部署（Ship It）

保存为 `outputs/skill-audio-loader.md`。这个 skill 帮你检查音频输入是否符合下游模型的期望，并在不符合时正确地重采样。

## 练习（Exercises）

1. **Easy。** 在 16 kHz 下合成 1 秒的 220 Hz + 440 Hz + 880 Hz 混合波。跑 DFT。确认在期望的三个 bin 上有峰值。
2. **Medium。** 用 48 kHz 录一段 3 秒的自己的语音 WAV。先用 `torchaudio.transforms.Resample`（带反混叠）下采样到 16 kHz，再用朴素抽取（每隔三个取一个）下采样到 16 kHz。两者都做 FFT。混叠出现在哪儿？
3. **Hard。** 只用 `math` 和 Step 3 的 DFT，从零搭一份 STFT。帧长 400，hop 160，Hann window。用 `matplotlib.pyplot.imshow` 画出模长。这就是 Lesson 02 的 spectrogram。

## 关键术语（Key Terms）

| Term | 大家嘴上说的 | 实际含义 |
|------|-----------------|-----------------------|
| Sample rate | 每秒多少个采样点 | ADC 测量信号的频率（Hz）。 |
| Nyquist | 你能表示的最大频率 | `sr/2`；高于它的能量会混叠回来。 |
| Bit depth | 每个采样点的分辨率 | `int16` = 65,536 个等级；`float32` = `[-1, 1]` 区间内 24-bit 精度。 |
| DFT | 序列的傅里叶变换 | `N` 个采样点 → `N` 个复频率系数。 |
| FFT | 快速版 DFT | `O(N log N)` 算法，要求 `N` 是 2 的幂。 |
| Bin | 频率列 | `k · sr / N` Hz；分辨率 = `sr / N`。 |
| STFT | Spectrogram 的底层 | 在时间上做分帧 + 加窗 FFT。 |
| Aliasing | 奇怪的频率鬼影 | 高于 Nyquist 的能量被镜像折回较低 bin。 |

## 延伸阅读（Further Reading）

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)——采样定理背后的论文。
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm)——免费、经典的 DSP 教科书。
- [librosa docs — audio primer](https://librosa.org/doc/latest/tutorial.html)——带代码的实战走读。
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434)——为什么真实世界的音频不是一条干净的正弦波，参考它。
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)——10 分钟讲清楚 frequency bin 的直觉。
