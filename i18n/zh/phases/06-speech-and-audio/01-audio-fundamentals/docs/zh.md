# 音频基础 —— 波形、采样、傅里叶变换

> 波形是原始信号。频谱图是中间表示。Mel 特征是适合机器学习的形式。每个现代 ASR 和 TTS 流水线都要沿着这个阶梯逐级而上，而第一级就是理解采样和傅里叶变换。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06（向量与矩阵）、Phase 1 · 14（概率分布）
**Time:** ~45 分钟

## 问题所在

麦克风产生的是压力随时间变化的信号，而你的神经网络消费的是张量。两者之间隔着一系列约定，一旦违反就会产生无声的 bug：模型训练正常但 WER 翻倍，或 TTS 输出嘶嘶声，或语音克隆系统记住的是麦克风而不是说话人。

语音系统中的每一个 bug 都可以追溯到以下三个问题之一：

1. 数据是以什么采样率录制的，模型期望什么采样率？
2. 信号是否发生了混叠？
3. 你操作的是原始样本还是频率表示？

把这些问题搞对，Phase 6 的其余内容就迎刃而解。搞错了，即使是 Whisper-Large-v4 也会产生垃圾输出。

## 核心概念

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**波形。** 一个以 `[-1.0, 1.0]` 存储的一维浮点数组。按样本编号索引。换算为秒，需要除以采样率：`t = n / sr`。一段 16 kHz 的 10 秒音频片段是包含 160,000 个浮点数的数组。

**采样率（sr）。** 每秒采集多少个样本。2026 年的常见采样率：

| 采样率 | 用途 |
|------|-----|
| 8 kHz | 电话、旧式 VOIP。4 kHz 的 Nyquist 极限会损失辅音。ASR 应避免使用。 |
| 16 kHz | ASR 标准。Whisper、Parakeet、SeamlessM4T v2 都使用 16 kHz 输入。 |
| 22.05 kHz | 旧模型的 TTS 声码器训练。 |
| 24 kHz | 现代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音频、音乐。 |
| 48 kHz | 电影、专业音频、高保真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**Nyquist-Shannon。** 采样率 `sr` 能够无歧义地表示最高至 `sr/2` 的频率。`sr/2` 边界称为 *Nyquist 频率*。超过 Nyquist 的能量会发生 *混叠* —— 被折叠到较低的频率上 —— 从而破坏信号。降采样前务必先做低通滤波。

**位深。** 16-bit PCM（有符号 int16，范围 ±32,767）是通用的交换格式。音乐用 24-bit，内部 DSP 用 32-bit 浮点。诸如 `soundfile` 之类的库读取 int16，但以 `[-1, 1]` 的形式暴露 float32 数组。

**傅里叶变换。** 任何有限信号都是不同频率正弦波的叠加。离散傅里叶变换（DFT）针对 `N` 个样本计算 `N` 个复系数 —— 每个频率 bin 一个。第 `bin k` 个 bin 对应频率 `k · sr / N` Hz。幅值是该频率处的振幅，角度是相位。

**FFT。** 快速傅里叶变换：当 `N` 为 2 的幂时计算 DFT 的 `O(N log N)` 算法。所有音频库底层都使用 FFT。在 16 kHz 下做 1024 点 FFT 可得到 512 个可用的频率 bin，覆盖 0–8 kHz，分辨率为 15.6 Hz。

**分帧 + 加窗。** 我们不会对整个片段做 FFT。而是把它切成重叠的 *帧*（通常 25 ms 帧长、10 ms 帧移），每帧乘以窗函数（Hann、Hamming）以消除边缘不连续，然后对每帧做 FFT。这就是短时傅里叶变换（STFT）。第 02 课将从此处展开。

```figure
mel-scale
```

## 动手实现

### 步骤 1：读取音频片段并绘制波形

`code/main.py` 只使用标准库的 `wave` 模块，以保持演示零依赖。生产环境中你会使用 `soundfile` 或 `torchaudio.load`（两者都返回 `(waveform, sr)` 元组）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### 步骤 2：从第一性原理合成正弦波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

在 16 kHz 采样率下生成 1 秒的 440 Hz 正弦波（音乐会标准音 A）即 16,000 个浮点数。使用 `wave.open(..., "wb")` 以 16-bit PCM 编码写入。

### 步骤 3：手工计算 DFT

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

`O(N²)` —— 用于 `N=256` 以验证正确性没问题，但对真实音频毫无用处。真正的代码会调用 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### 步骤 4：找出主频

幅值峰值索引 `k_star` 对应频率 `k_star * sr / N`。对 440 Hz 正弦波运行此代码，应返回位于第 `440 * N / sr` 个 bin 的峰值。

### 步骤 5：演示混叠

以 10 kHz 采样率对 7 kHz 正弦波采样（Nyquist = 5 kHz）。7 kHz 的音调高于 Nyquist，会折叠为 `10 − 7 = 3 kHz`。FFT 峰值出现在 3 kHz。这是经典的混叠演示，也是每个 DAC/ADC 都配有砖墙式低通滤波器的原因。

## 实际使用

你在 2026 年实际会用到的工具栈：

| 任务 | 库 | 理由 |
|------|---------|-----|
| 读取/写入 WAV/FLAC/OGG | `soundfile`（libsndfile 封装） | 最快、稳定、返回 float32。 |
| 重采样 | `torchaudio.transforms.Resample` 或 `librosa.resample` | 内置正确的抗混叠。 |
| STFT / Mel | `torchaudio` 或 `librosa` | GPU 友好；属于 PyTorch 生态。 |
| 实时流式处理 | `sounddevice` 或 `pyaudio` | 跨平台的 PortAudio 绑定。 |
| 检查文件 | `ffprobe` 或 `soxi` | 命令行工具、快速、报告 sr/声道/编码格式。 |

决策规则：**先匹配采样率，再匹配其他一切**。Whisper 期望 16 kHz 单声道 float32。传入 44.1 kHz 立体声，你会得到看起来像模型 bug 的垃圾输出。

## 上线使用

保存为 `outputs/skill-audio-loader.md`。该技能帮助你检查音频输入是否满足下游模型的期望，并在不满足时正确重采样。

## 练习

1. **简单。** 在 16 kHz 下合成 1 秒的 220 Hz + 440 Hz + 880 Hz 混合信号。运行 DFT。确认在预期的 bin 位置出现三个峰值。
2. **中等。** 以 48 kHz 录制 3 秒的语音 WAV。使用 `torchaudio.transforms.Resample`（带抗混叠）降采样到 16 kHz，再用朴素抽取（每三个样本取一个）降采样到 16 kHz。对两者做 FFT。混叠出现在哪里？
3. **困难。** 仅使用 `math` 和步骤 3 中的 DFT，从零构建 STFT。帧长 400、帧移 160、Hann 窗。用 `matplotlib.pyplot.imshow` 绘制幅值图。这就是第 02 课的频谱图。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 采样率 | 每秒多少个样本 | ADC 测量信号的频率，单位 Hz。 |
| Nyquist | 能表示的最高频率 | `sr/2`；超过它的能量会混叠折回低频。 |
| 位深 | 每个样本的分辨率 | `int16` = 65,536 个量化级；`float32` = 在 `[-1, 1]` 中实现 24-bit 精度。 |
| DFT | 序列的傅里叶变换 | `N` 个样本 → `N` 个复频率系数。 |
| FFT | 快速 DFT | `O(N log N)` 算法，要求 `N` 为 2 的幂。 |
| Bin | 频率列 | `k · sr / N` Hz；分辨率 = `sr / N`。 |
| STFT | 频谱图的底层实现 | 随时间进行分帧 + 加窗的 FFT。 |
| 混叠 | 诡异的频率幻影 | 高于 Nyquist 的能量镜像折叠到较低的 bin。 |

## 延伸阅读

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) —— 采样定理背后的论文。
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) —— 免费、权威的 DSP 教科书。
- [librosa docs — audio primer](https://librosa.org/doc/latest/tutorial.html) —— 带代码的实践入门。
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) —— 解释真实世界音频为何不是干净正弦波的参考。
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) —— 10 分钟讲清频率 bin 的直觉。