# Audio Fundamentals — Waveforms, Sampling, Fourier Transform

> 波是原始信号。光谱图是表示。Mel功能是ML友好的形式。每一个现代的ASB和TTC管道都沿着这个阶梯前进，第一个台阶是理解采样和傅里叶。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段1 · 06（载体和矩阵）、阶段1 · 14（概率分布）
** 时间：** ~45分钟

## The Problem

麦克风产生压力与时间的信号。你的神经网络消耗张量。它们之间有一堆惯例，当违反时，会产生无声的错误：模型训练良好，但WER翻倍，或者TTC发出嘶嘶声，或者语音克隆系统记住麦克风而不是扬声器。

语音系统中的每个错误都可以追溯到三个问题之一：

1. 记录数据的采样率是多少？模型期望什么？
2. 信号是否存在别名？
3. 您是在原始样本还是在频率表示上操作？

把这些做好，第6阶段的其余部分就可以控制了。如果搞错了，甚至Whisper-Large-v4也会产生垃圾。

## The Concept

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

** 波浪形。** '[-1.0，1.0]'中的一维浮点数组。按样本号索引。要转换为秒数，请除以采样率：' t = n /Sec '。16 GHz的10秒剪辑是160，000个浮动的阵列。

** 采样率（SR）。**每秒有多少个样本。2026年常见费率：

| 率 | 使用 |
|------|-----|
| 8 kHz | 电话、传统的VOIP。Nyquist在4 GHz时会杀死辅音。避免发生ASO。 |
| 16 kHz | ASB标准。Whisper、Parakeet、Deliverless M4 T v2均消耗16 GHz。 |
| 22.05 GHz | 针对旧型号的TTC声码器培训。 |
| 24 kHz | 现代TTC（Kokoro、F5-TTC、xTTC v2）。 |
| 44.1 kHz | CD音频、音乐。 |
| 48 kHz | 电影、专业音频、高保真TTC（Wall-E 2、NaturalSpeech 3）。 |

** 尼奎斯特-香农。**采样率“SR”可以明确表示高达“SR/2”的频率。“Sec/2”边界是 * 奈奎斯特频率 *。奈奎斯特上方的能量会被“混淆”--折叠成较低的频率--并破坏信号。在下采样之前始终进行低通过滤。

** 有点深度。** 16-bit PCM（符号int 16，范围± 32，767）是通用交换格式。24-位用于音乐，32位浮点数用于内部DSP。像“soundfile”这样的库读取int 16，但在“[-1，1]'中公开float 32数组。

** 傅里叶变换。**任何有限信号都是不同频率的sin的总和。离散傅里叶变换（FT）为“N”个样本计算“N”个复系数-每个频率段一个复系数。' bin k '映射到频率' k · SR / N ' Hz。幅度是该频率下的幅度，角度是相。

** 快速傅里叶变换。**快速傅里叶变换：当“N”是2的乘方时，用于离散傅里叶变换的“O（N log N）”算法。每个音频库都在背后使用快速傅立叶变换。16 GHz下的1024个样本快速傅里叶变换可在15.6 Hz分辨率下提供跨越0-8 GHz的512个可用频率段。

** 框架+窗口。**我们不会对整个剪辑进行快速傅立叶变换。我们将其分割成重叠的 * 帧 *（通常为25 ms，跳数为10 ms），将每帧乘以窗口函数（Hann、Hamming）以消除边缘不连续性，然后对每帧进行快速傅里叶变换。这是短期傅里叶变换（STFT）。第02课从这里开始。

## Build It

### Step 1: read a clip and plot the waveform

' code/main.py '仅使用stdlib ' wave '模块来保持演示无依赖性。对于制作，您将使用“soundfile”或“torchaudio. add”（两者都返回“（wavenue，sson）' tupples）：

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Step 2: synthesize a sine wave from first principles

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

440 Hz的sin（音乐会A）在16 GHz下持续1秒相当于16，000个浮动。用' wave. Open（.，“RST”）'使用16位PCM编码。

### Step 3: compute the DFT by hand

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

' O（N²）'-对于' N=256 '可以确认正确性，对于真实音频无用。真实代码调用“numpy.fft.rfft”或“torch.fft.rfft”。

### Step 4: find the dominant frequency

幅度峰值指数“k_star”映射到频率“k_star * sor/ N”。在440 Hz sin上运行该操作应该会在bin ' 440 * N /Sec '处返回峰值。

### Step 5: demonstrate aliasing

以10 GHz（奈奎斯特= 5 GHz）对7 GHz的sin进行采样。7 GHz音调高于奈奎斯特，折叠为“10 - 7 = 3 GHz”。快速傅里叶变换峰值出现在3 GHz处。这是经典的混叠演示，也是每个ADC/ADC都配备砖墙低通过滤器的原因。

## Use It

您将在2026年实际发货的堆栈：

| 任务 | 图书馆 | 为什么 |
|------|---------|-----|
| 读/写AAC/FLAC/OGG | “soundfile”（libsndfile包装器） | 最快、稳定、返回浮动32。 |
| 重采样 | ' torchaudio.transforms.Resample '或' librosa.resample ' | 内置正确的抗锯齿功能。 |
| STFT / Mel | “火炬音频”或“Librosa” | 对图形处理器友好; PyTorch生态系统。 |
| 实时流 | “sounduser”或“pyaudio” | 跨平台PortAudio绑定。 |
| 检查文件 | `ffprobe`或`soxi` | CLI，快速，报告SR/channels/Codec。 |

决策规则：** 在匹配其他内容之前匹配样本率 **。Whisper预计16 GHz单频浮点32。传递44.1 GHz立体声，您会收到看起来像模型错误的垃圾。

## Ship It

另存为“输出/skill-audio-loader.md”。该技能可帮助您检查音频输入是否与下游模型的预期相匹配，并在不匹配时正确重新采样。

## Exercises

1. ** 简单。**在16 GHz下合成220 Hz + 440 Hz + 880 Hz的1秒混音。运行DF。确认预期箱处的三个峰值。
2. ** 中等。**以48 GHz的频率录制3秒的语音AAC。使用“torchaudio.transforms.Resample”（具有抗混叠功能）下采样至16 GHz，然后使用朴素抽取（每三个样本）下采样至16 GHz。两者都进行了傅里叶变换。别名出现在哪里？
3. ** 很难。**仅使用步骤3中的“数学”和FT从头开始构建STFT。帧大小400，跳跃160，Hann窗口。使用“matplotlib.pyplot.imshow”绘制震级。这是第02课的频谱图。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 采样率 | 每秒有多少个样本 | ADC测量信号的频率（Hz）。 |
| Nyquist | 您可以代表的最大频率 | ' Sec/2 ';上面的能量又往下别名。 |
| 位深度 | 每个样本的分辨率 | ' int 16 '= 65，536级;' float 32 '='[-1，1]'中的24位精度。 |
| DFT | 序列的傅里叶变换 | ' N '个样本'复频率系数。 |
| FFT | 快速的离散傅立叶 | “O（N log N）”算法需要“N”= 2的乘方。 |
| 斌 | 频率列 | ' k · SR / N ' Hz;分辨率=' ss/ N '。 |
| STFT | 引擎盖下的光谱图 | 随着时间的推移，成帧+窗口的快速傅里叶变换。 |
| 混叠 | 奇怪的频率鬼魂 | 奈奎斯特上方的能量向下反映到较低的垃圾箱。 |

## Further Reading

- [香农（1949）。存在噪音时的通信]（https：//people.math.harvard.edu/spectm/home/text/others/shannon/entropy/entropy.pdf）-采样定理背后的论文。
- [Smith -数字信号处理科学家和工程师指南]（https：//www.dspguide.com/ch8.html）-免费、规范的DSP教科书。
- [librosa docs - audio primer]（https：//librosa.org/doc/latest/tutorial.html）-实用代码演练。
- [Heinrich Kuttruff -房间声学（第6版）]（https：//www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434）-关于为什么现实世界的音频不是干净的sinus的参考。
- [Steve Eddins - FFT解释笔记本]（https：//blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/）-频率箱直觉在10分钟内清除。
