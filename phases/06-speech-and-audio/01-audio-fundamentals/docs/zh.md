# 音频基础——波形、采样、傅里叶变换

> 波形是原始信号。频谱图是它的表示形式。梅尔特征是机器学习友好的形式。每一个现代自动语音识别（ASR）和文本转语音（TTS）流程都会沿着这条阶梯向上攀登，而第一级台阶正是理解采样与傅里叶变换。

**类型：** 学习  
**语言：** Python  
**前置知识：** 第一阶段 · 06（向量与矩阵），第一阶段 · 14（概率分布）  
**时长：** ~45分钟  

## 问题

麦克风产生一个压力随时间变化的信号。你的神经网络消费的是张量。在二者之间有一整套约定，一旦违反，就会产生沉默的 bug：模型训练正常但词错误率（WER）翻倍，或 TTS 输出嘶嘶声，或语音克隆系统记住了麦克风而不是说话人。

语音系统中的每个 bug 都可以追溯到以下三个问题之一：

1. 数据录制时的采样率是多少？模型期望的采样率是多少？
2. 信号是否存在混叠（Aliasing）？
3. 你是在原始采样点上操作，还是在频域表示上操作？

把这些搞对了，第六阶段的其余部分就是可处理的。搞错了，即使 Whisper-Large-v4 也会输出垃圾。

## 概念

![波形、采样、离散傅里叶变换（DFT）和频率区间可视化](../assets/audio-fundamentals.svg)

**波形（Waveform）。** 一个一维浮点数数组，范围在 `[-1.0, 1.0]`。按采样序号索引。要转换为秒，除以采样率：`t = n / sr`。一段 10 秒、16 kHz 的音频片段是一个 160,000 个浮点数的数组。

**采样率（Sampling Rate, sr）。** 每秒的采样数。2026 年的常见速率：

| 速率 | 用途 |
|------|------|
| 8 kHz | 电话通信、传统 VoIP。奈奎斯特频率 4 kHz 会丢失辅音。不适用于 ASR。 |
| 16 kHz | ASR 标准。Whisper、Parakeet、SeamlessM4T v2 都使用 16 kHz。 |
| 22.05 kHz | 旧模型的 TTS 声码器训练。 |
| 24 kHz | 现代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音频、音乐。 |
| 48 kHz | 电影、专业音频、高保真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**奈奎斯特-香农（Nyquist-Shannon）。** 采样率 `sr` 可以无歧义地表示高达 `sr/2` 的频率。`sr/2` 边界称为**奈奎斯特频率（Nyquist frequency）**。高于奈奎斯特频率的能量会发生**混叠（Aliasing）**——折叠到较低的频率上——从而污染信号。在下采样之前务必进行低通滤波。

**位深（Bit Depth）。** 16 位脉冲编码调制（PCM）（有符号 int16，范围 ±32,767）是通用的交换格式。音乐使用 24 位，内部数字信号处理（DSP）使用 32 位浮点数。像 `soundfile` 这样的库读取 int16 但输出 `[-1, 1]` 范围内的 float32 数组。

**傅里叶变换（Fourier Transform）。** 任何有限信号都可以表示为不同频率的正弦波之和。离散傅里叶变换（Discrete Fourier Transform, DFT）对 `N` 个样本计算出 `N` 个复数系数——每个频率区间（Bin）一个。`bin k` 对应频率 `k · sr / N` Hz。幅度是该频率的振幅，角度是相位。

**快速傅里叶变换（FFT）。** 快速傅里叶变换（Fast Fourier Transform）：当 `N` 是 2 的幂时，DFT 的一个 `O(N log N)` 算法。每个音频库底层都使用 FFT。在 16 kHz 下，一个 1024 样本的 FFT 给出 512 个可用的频率区间，覆盖 0–8 kHz，分辨率为 15.6 Hz。

**分帧 + 加窗（Framing + window）。** 我们不会对整个片段做 FFT。而是将其切分成重叠的**帧（frame）**（通常 25 ms，步长 10 ms），用窗函数（Hann、Hamming）乘以每一帧以消除边缘不连续性，然后对每一帧进行 FFT。这就是短时傅里叶变换（Short-Time Fourier Transform, STFT）。第 02 课将从此处继续。

## 动手实现

### 第 1 步：读取片段并绘制波形

`code/main.py` 仅使用标准库的 `wave` 模块，以保持演示无外部依赖。在生产环境中你会使用 `soundfile` 或 `torchaudio.load`（两者都返回 `(waveform, sr)` 元组）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # 形状 (T,)，sr 为整数
```

### 第 2 步：从零合成正弦波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

一个 440 Hz 的正弦波（音乐会 A）在 16 kHz 下持续 1 秒，共 16,000 个浮点数。使用 `wave.open(..., "wb")` 并以 16 位 PCM 编码写入。

### 第 3 步：手动计算 DFT

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

`O(N²)`——对于 `N=256` 验证正确性没问题，但对真实音频无用。实际代码调用 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### 第 4 步：找到主频率

幅度峰值索引 `k_star` 对应频率 `k_star * sr / N`。对 440 Hz 正弦波运行此函数，应返回位于 bin `440 * N / sr` 的峰值。

### 第 5 步：演示混叠

在 10 kHz 下采样一个 7 kHz 的正弦波（奈奎斯特频率 = 5 kHz）。7 kHz 音调高于奈奎斯特频率，折叠到 `10 − 7 = 3 kHz`。FFT 峰值出现在 3 kHz。这是经典的混叠演示，也是每个数模转换器/模数转换器（DAC/ADC）都带有砖墙低通滤波器的原因。

## 实际使用

2026 年你实际交付的栈：

| 任务 | 库 | 原因 |
|------|---------|-----|
| 读写 WAV/FLAC/OGG | `soundfile`（libsndfile 封装） | 最快、稳定、返回 float32。 |
| 重采样 | `torchaudio.transforms.Resample` 或 `librosa.resample` | 内置正确的抗混叠。 |
| STFT / 梅尔 | `torchaudio` 或 `librosa` | 支持 GPU；PyTorch 生态。 |
| 实时流 | `sounddevice` 或 `pyaudio` | 跨平台 PortAudio 绑定。 |
| 检查文件 | `ffprobe` 或 `soxi` | 命令行、快速、报告采样率/通道数/编解码器。 |

决策规则：**在匹配任何其他东西之前，先匹配采样率**。Whisper 期望 16 kHz 单声道 float32。传入 44.1 kHz 立体声，你得到的结果看起来就像模型出了 bug。

## 交付

保存为 `outputs/skill-audio-loader.md`。此技能帮助你检查音频输入是否满足下游模型的期望，并在不匹配时正确重采样。

## 练习

1. **简单。** 在 16 kHz 下合成一段 1 秒的混合音：220 Hz + 440 Hz + 880 Hz。运行 DFT。确认三个峰值位于预期的区间。
2. **中等。** 用 48 kHz 录制一段 3 秒的 WAV（你自己的声音）。使用 `torchaudio.transforms.Resample`（带抗混叠）下采样到 16 kHz，然后使用朴素抽取（每三个样本取一个）下采样到 16 kHz。对两者进行 FFT。混叠出现在哪里？
3. **困难。** 仅使用 `math` 和第 3 步的 DFT，从头构建 STFT。帧大小为 400，步长为 160，Hann 窗。使用 `matplotlib.pyplot.imshow` 绘制幅度图。这就是第 02 课的频谱图。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 采样率（Sample rate） | 每秒多少个样本 | ADC 测量信号的频率（Hz）。 |
| 奈奎斯特（Nyquist） | 你能表示的最大频率 | `sr/2`；高于此频率的能量会混叠回来。 |
| 位深（Bit depth） | 每个样本的分辨率 | `int16` = 65,536 个等级；`float32` = `[-1, 1]` 内的 24 位精度。 |
| 离散傅里叶变换（DFT） | 针对序列的傅里叶变换 | `N` 个样本 → `N` 个复数频率系数。 |
| 快速傅里叶变换（FFT） | 快速 DFT | `O(N log N)` 算法，要求 `N` 是 2 的幂。 |
| 区间（Bin） | 频率列 | `k · sr / N` Hz；分辨率 = `sr / N`。 |
| 短时傅里叶变换（STFT） | 频谱图的底层实现 | 随时间分帧加窗的 FFT。 |
| 混叠（Aliasing） | 奇怪的频率鬼影 | 高于奈奎斯特的能量镜像到低频区间。 |

## 延伸阅读

- [Shannon (1949). 存在噪声时的通信](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) —— 采样定理背后的论文。
- [Smith — 科学家与工程师的数字信号处理指南](https://www.dspguide.com/ch8.htm) —— 免费、权威的 DSP 教科书。
- [librosa 文档 — 音频入门](https://librosa.org/doc/latest/tutorial.html) —— 带代码的实践教程。
- [Heinrich Kuttruff — 室内声学（第 6 版）](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) —— 解释为什么真实世界中的音频不是干净的正弦波。
- [Steve Eddins — FFT 解读笔记本](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) —— 10 分钟理清频率区间直觉。