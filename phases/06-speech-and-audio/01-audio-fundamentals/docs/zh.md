# 01 · 音频基础 —— 波形、采样与傅里叶变换

> 波形是原始信号，频谱图是它的表示形式，梅尔特征则是对机器学习友好的形态。每一条现代 ASR 与 TTS 流水线都要拾级而上，而第一级台阶就是理解采样与傅里叶。

**类型：** 学习
**语言：** Python
**前置：** 阶段 1 · 06（向量与矩阵）、阶段 1 · 14（概率分布）
**时长：** 约 45 分钟

## 问题所在

麦克风产生的是「压强—时间」信号，而你的神经网络消费的是张量。两者之间横亘着一摞约定，一旦违反，就会产生悄无声息的 bug：模型训练得很顺利，但「词错误率（WER，Word Error Rate）」翻了一倍；或者 TTS 上线后带着嘶嘶噪声；又或者一个声音克隆系统记住的是麦克风而不是说话人。

语音系统里的每一个 bug，都可以追溯到以下三个问题之一：

1. 数据录制时用的是什么采样率，而模型期望的又是什么？
2. 信号是否发生了混叠？
3. 你操作的是原始采样点，还是某种频域表示？

把这些弄对，阶段 6 的其余部分就都好办了。弄错了，那么哪怕是 Whisper-Large-v4 也只会产出垃圾。

## 核心概念

〔图：波形、采样、DFT 与频率 bin 的可视化〕

**波形（Waveform）。** 一个一维浮点数组，取值范围为 `[-1.0, 1.0]`，以采样点序号作为索引。要换算成秒，将序号除以采样率即可：`t = n / sr`。一段 16 kHz 下时长 10 秒的片段，就是一个含 160,000 个浮点数的数组。

**采样率（sampling rate，sr）。** 每秒采集多少个样本。2026 年常见的采样率：

| 采样率 | 用途 |
|------|-----|
| 8 kHz | 电话通信、传统 VOIP。奈奎斯特频率仅 4 kHz，会把辅音抹掉。ASR 应避免使用。 |
| 16 kHz | ASR 标准。Whisper、Parakeet、SeamlessM4T v2 都消费 16 kHz。 |
| 22.05 kHz | 较旧模型的 TTS 声码器训练。 |
| 24 kHz | 现代 TTS（Kokoro、F5-TTS、xTTS v2）。 |
| 44.1 kHz | CD 音质、音乐。 |
| 48 kHz | 影视、专业音频、高保真 TTS（VALL-E 2、NaturalSpeech 3）。 |

**奈奎斯特—香农采样定理（Nyquist-Shannon）。** 采样率为 `sr` 时，可以无歧义地表示最高 `sr/2` 的频率。`sr/2` 这条边界称为「奈奎斯特频率（Nyquist frequency）」。高于奈奎斯特频率的能量会发生「混叠（aliasing）」——被折叠到更低的频率上——从而破坏信号。降采样前务必先做低通滤波。

**位深（bit depth）。** 16-bit PCM（有符号 int16，范围 ±32,767）是通用的交换格式。音乐用 24-bit，内部 DSP 用 32-bit 浮点。像 `soundfile` 这样的库读取的是 int16，但对外暴露的是取值在 `[-1, 1]` 的 float32 数组。

**傅里叶变换（Fourier Transform）。** 任何有限信号都是不同频率正弦波的叠加。「离散傅里叶变换（DFT，Discrete Fourier Transform）」对 `N` 个采样点计算出 `N` 个复系数——每个频率 bin 一个。`bin k` 对应频率 `k · sr / N` Hz，其幅值是该频率上的振幅，相角则是相位。

**FFT。** 快速傅里叶变换（Fast Fourier Transform）：当 `N` 为 2 的幂时，用于计算 DFT 的 `O(N log N)` 算法。每个音频库底层都在用 FFT。16 kHz 下一个 1024 点的 FFT 会给出 512 个可用频率 bin，覆盖 0–8 kHz，分辨率为 15.6 Hz。

**分帧 + 加窗（Framing + window）。** 我们不会对整段片段做 FFT，而是把它切成相互重叠的「帧（frame）」（通常为 25 ms，帧移 10 ms），将每帧乘以一个窗函数（Hann、Hamming）以消除边缘不连续，然后对每帧做 FFT。这就是「短时傅里叶变换（STFT，Short-Time Fourier Transform）」。第 02 课将从这里接着讲。

## 动手构建

### 第 1 步：读取片段并绘制波形

`code/main.py` 只用标准库的 `wave` 模块，以保持演示无外部依赖。在生产环境中你会使用 `soundfile` 或 `torchaudio.load`（二者都返回 `(waveform, sr)` 元组）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # 形状为 (T,)，sr 为 int
```

### 第 2 步：从第一性原理合成正弦波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

16 kHz 下时长 1 秒的 440 Hz 正弦波（标准音 A）就是 16,000 个浮点数。用 `wave.open(..., "wb")` 以 16-bit PCM 编码写出。

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

`O(N²)`——`N=256` 时用来验证正确性还行，但对真实音频毫无用处。真正的代码会调用 `numpy.fft.rfft` 或 `torch.fft.rfft`。

### 第 4 步：找出主频

幅值峰值所在的索引 `k_star` 对应频率 `k_star * sr / N`。对前面那个 440 Hz 正弦波运行此步，应当在 bin `440 * N / sr` 处返回一个峰值。

### 第 5 步：演示混叠

以 10 kHz 采样率（奈奎斯特频率 = 5 kHz）采样一个 7 kHz 正弦波。7 kHz 音调高于奈奎斯特频率，会折叠到 `10 − 7 = 3 kHz`。于是 FFT 峰值出现在 3 kHz 处。这就是经典的混叠演示，也是每个 DAC/ADC 都内置一个砖墙式低通滤波器的原因。

## 实际应用

2026 年你真正会上线的技术栈：

| 任务 | 库 | 原因 |
|------|---------|-----|
| 读写 WAV/FLAC/OGG | `soundfile`（libsndfile 封装） | 最快、稳定，返回 float32。 |
| 重采样 | `torchaudio.transforms.Resample` 或 `librosa.resample` | 内置了正确的抗混叠处理。 |
| STFT / 梅尔 | `torchaudio` 或 `librosa` | 对 GPU 友好；属于 PyTorch 生态。 |
| 实时流式处理 | `sounddevice` 或 `pyaudio` | 跨平台的 PortAudio 绑定。 |
| 检视文件 | `ffprobe` 或 `soxi` | 命令行、速度快，能报告 sr/声道数/编解码器。 |

决策法则：**在匹配其他任何东西之前，先匹配采样率**。Whisper 期望 16 kHz 单声道 float32。给它喂 44.1 kHz 立体声，你得到的就是看起来像模型 bug 的垃圾。

## 交付上线

保存为 `outputs/skill-audio-loader.md`。该技能帮助你检查音频输入是否符合下游模型的期望，并在不符合时正确地重采样。

## 练习

1. **简单。** 在 16 kHz 下合成一段时长 1 秒、混合了 220 Hz + 440 Hz + 880 Hz 的信号。运行 DFT，确认在预期的三个 bin 处出现三个峰值。
2. **中等。** 用 48 kHz 录制一段 3 秒的你本人声音的 WAV。先用 `torchaudio.transforms.Resample`（带抗混叠）降采样到 16 kHz，再用朴素抽取（每隔三个取一个样本）降采样到 16 kHz。对两者都做 FFT。混叠出现在哪里？
3. **困难。** 仅用 `math` 和第 3 步的 DFT，从零构建 STFT。帧长 400，帧移 160，Hann 窗。用 `matplotlib.pyplot.imshow` 绘制幅值图。这就是第 02 课里的频谱图。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| 采样率 | 每秒有多少个样本 | ADC 测量信号所用的频率（单位 Hz）。 |
| 奈奎斯特 | 你能表示的最高频率 | `sr/2`；高于它的能量会混叠折回。 |
| 位深 | 每个样本的分辨率 | `int16` = 65,536 个量化级；`float32` = 在 `[-1, 1]` 范围内的 24-bit 精度。 |
| DFT | 用于序列的傅里叶变换 | `N` 个样本 → `N` 个复频率系数。 |
| FFT | 快速版的 DFT | `O(N log N)` 算法，要求 `N` 为 2 的幂。 |
| Bin | 频率列 | `k · sr / N` Hz；分辨率 = `sr / N`。 |
| STFT | 频谱图的底层实现 | 沿时间的分帧 + 加窗 FFT。 |
| 混叠 | 诡异的频率幽灵 | 高于奈奎斯特的能量镜像折回到较低的 bin。 |

## 延伸阅读

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) —— 采样定理背后的论文。
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) —— 免费的、堪称经典的 DSP 教科书。
- [librosa docs — audio primer](https://librosa.org/doc/latest/tutorial.html) —— 配有代码的实战讲解。
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) —— 解释真实世界音频为何不是干净正弦波的参考书。
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) —— 10 分钟讲清频率 bin 的直觉。
