# 频谱图、梅尔刻度与音频特征

> 神经网络无法很好地处理原始波形。它们需要频谱图。它们处理梅尔频谱图效果更好。2026年的每一个ASR（自动语音识别）、TTS（文本转语音）和音频分类器的成败，都取决于这一预处理选择。

**类型：** 动手实践  
**语言：** Python  
**前置条件：** 阶段6 · 01（音频基础）  
**时长：** 约45分钟

## 问题

以一段10秒的16 kHz音频片段为例。它包含160,000个浮点数，全部在`[-1, 1]`范围内，且与标签"狗叫"或"单词cat"几乎完全不相关。原始波形包含信息，但模型难以从中提取。两个相同的音素，相隔100毫秒发音，其原始采样值完全不同。

频谱图解决了这个问题。它将人类感知忽略的时域细节（微秒级抖动）压缩，同时保留感知关注的频率结构（在约10–25毫秒的时间窗口内，哪些频率具有能量）。

梅尔频谱图更进一步。人类对音高的感知是对数性的：100 Hz与200 Hz之间的"距离感"与1000 Hz与2000 Hz之间的相同。梅尔刻度对频率轴进行扭曲以匹配这种感知。从2010年到2026年，梅尔刻度频谱图是语音机器学习中最重要的特征。

## 概念

![波形到STFT到梅尔频谱图到MFCC的阶梯图](../assets/mel-features.svg)

**STFT（短时傅里叶变换）。** 将波形切分为重叠的帧（典型设置：25 ms窗口，10 ms步进 = 400个采样点 / 160个采样点，在16 kHz下）。每帧乘以一个窗函数（默认是汉宁窗；汉明窗略有不同折衷）。对每帧进行FFT。将幅度谱堆叠成形状为`(n_frames, n_freq_bins)`的矩阵。这就是你的频谱图。

**对数幅度。** 原始幅度跨越5-6个数量级。取`log(|X| + 1e-6)`或`20 * log10(|X|)`来压缩动态范围。每个生产流水线都使用对数幅度，而不是原始幅度。

**梅尔刻度。** 频率`f`（单位Hz）通过`m = 2595 * log10(1 + f / 700)`映射为梅尔`m`。该映射在1 kHz以下近似线性，在1 kHz以上近似对数。80个梅尔频带覆盖0–8 kHz是标准的ASR输入。

**梅尔滤波器组。** 一组在梅尔刻度上均匀间隔的三角形滤波器。每个滤波器是相邻FFT频带的加权和。将STFT幅度乘以滤波器组矩阵，通过一次矩阵乘法即可得到梅尔频谱图。

**对数梅尔频谱图。** `log(mel_spec + 1e-10)`。Whisper的输入。Parakeet的输入。SeamlessM4T的输入。2026年通用的音频前端。

**MFCC（梅尔频率倒谱系数）。** 取对数梅尔频谱图，应用DCT（类型II），保留前13个系数。去相关特征并进一步压缩。在约2015年之前占据主导地位，之后基于原始对数梅尔频谱图的CNN/Transformer模型迎头赶上。目前在说话人识别（x-vectors、ECAPA）中仍在使用。

**分辨率权衡。** 更大的FFT = 更好的频率分辨率，但更差的时间分辨率。25 ms / 10 ms是音频机器学习的默认设置；音乐中常用50 ms / 12.5 ms；瞬态检测（鼓点、爆破音）用5 ms / 2 ms。

## 动手实现

### 步骤1：分帧

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

一段10秒的16 kHz音频片段，`frame_len=400, hop=160`，产生998帧。

### 步骤2：汉宁窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在FFT之前逐元素相乘。消除因在非零端点截断导致的频谱泄漏。

### 步骤3：STFT幅度

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产环境使用`torch.stft`或`librosa.stft`（基于FFT，向量化）。这里的循环仅为教学目的；它在`code/main.py`中对短音频片段运行。

### 步骤4：梅尔滤波器组

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

80个梅尔频带覆盖0–8 kHz，`n_fft=400`，得到形状为`(80, 201)`的矩阵。将形状为`(n_frames, 201)`的STFT幅度乘以它的转置，得到`(n_frames, 80)`的梅尔频谱图。

### 步骤5：对数梅尔

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见替代方案：`librosa.power_to_db`（基于参考值的分贝归一化）、`10 * log10(power + eps)`。Whisper使用了更复杂的裁剪+归一化流程（见Whisper的`log_mel_spectrogram`）。

### 步骤6：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每个对数梅尔帧应用DCT，保留前13个系数。这就是你的MFCC矩阵。第一个系数通常被丢弃（它编码了整体能量）。

## 使用场景

2026年的技术栈：

| 任务 | 特征 |
|------|------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80个对数梅尔频带，10 ms步进，25 ms窗口 |
| TTS声学模型 (VITS, F5-TTS, Kokoro) | 80个梅尔频带，5–12 ms步进以实现精细时间控制 |
| 音频分类 (AST, PANNs, BEATs) | 128个对数梅尔频带，10 ms步进 |
| 说话人嵌入 (ECAPA-TDNN, WavLM) | 80个对数梅尔频带 或 原始波形自监督学习 |
| 音乐 (MusicGen, Stable Audio 2) | EnCodec离散标记（非梅尔频带） |
| 关键词检测 | 40个MFCC用于小型设备 |

经验法则：**如果你不是在处理音乐，从80个对数梅尔频带开始。** 任何偏离此设置的做法都需要提供充分的证明。

## 2026年仍会出现的陷阱

- **梅尔计数不匹配。** 训练时使用80个梅尔频带，推理时使用128个。静默失败。在两端记录特征形状。
- **上游采样率不匹配。** 在22.05 kHz下计算的梅尔频谱图与16 kHz下的不同。在特征化*之前*固定采样率。
- **分贝与对数混淆。** Whisper期望的是对数梅尔，而不是分贝梅尔。某些Hugging Face流水线会自动检测，但你的自定义代码不会。
- **归一化偏移。** 训练时按语句归一化，推理时使用全局归一化。这种生产环境下的错误会使WER（词错误率）加倍。
- **填充导致的泄漏。** 在音频片段末尾补零会在尾部帧产生平坦的频谱。应采用对称填充或复制填充。

## 导出

保存为`outputs/skill-feature-extractor.md`。该技能需要根据给定的模型目标选择特征类型、梅尔计数、帧长/步进和归一化方式。

## 练习

1. **简单。** 运行`code/main.py`。它会合成一个扫频信号（频率从200 Hz扫到4000 Hz），并打印每帧中梅尔频带的最大值对应的索引。可选：绘制图形，确认其与扫频一致。
2. **中等。** 分别使用`n_mels`为`{40, 80, 128}`和`frame_len`为`{200, 400, 800}`重新运行。测量时间轴上尖锐峰值的带宽。哪种组合能最好地解析扫频信号？
3. **困难。** 实现`power_to_db`，并比较一个小型CNN分类器在AudioMNIST上的ASR准确率，分别使用：(a) 原始对数梅尔，(b) 以`ref=max`归一化的分贝梅尔，(c) MFCC-13 + 一阶差分 + 二阶差分。报告top-1准确率。

## 关键术语

| 术语 | 通常含义 | 实际含义 |
|------|----------|----------|
| 帧 | 一个切片 | 输入到一次FFT的25 ms波形块。 |
| 步进 | 步长 | 连续帧之间的采样数；10 ms是ASR默认值。 |
| 窗 | 汉宁/汉明窗 | 逐点乘法器，将帧边缘渐变为零。 |
| STFT | 频谱图生成器 | 分帧+加窗的FFT；产生时间×频率矩阵。 |
| 梅尔 | 扭曲的频率 | 对数感知刻度；`m = 2595·log10(1 + f/700)`。 |
| 滤波器组 | 矩阵 | 将STFT投影到梅尔频带的三角形滤波器。 |
| 对数梅尔 | Whisper的输入 | `log(mel_spec + eps)`；2026年标准化。 |
| MFCC | 老派特征 | 对数梅尔频谱图的DCT；13个系数，去相关。 |

## 进一步阅读

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) — MFCC论文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) — 原始梅尔刻度。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) — 阅读参考实现。
- [librosa feature extraction docs](https://librosa.org/doc/main/feature.html) — `mfcc`、`melspectrogram`和步进/窗口的参考。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) — Parakeet + Canary模型的生产级流水线。