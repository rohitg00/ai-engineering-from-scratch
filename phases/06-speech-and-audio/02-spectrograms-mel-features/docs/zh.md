# 频谱图、Mel 尺度与音频特征

> 神经网络不太擅长直接消费原始波形。它们消费的是频谱图。而 Mel 频谱图效果更好。2026 年的每个 ASR、TTS 和音频分类器，成败都系于这一个预处理选择。

**类型：** 动手构建
**语言：** Python
**前置知识：** 阶段 6 · 01（音频基础）
**时间：** ~45 分钟

## 问题

取一段 10 秒 16 kHz 的片段。那是 160,000 个浮点数，全都在 `[-1, 1]` 范围内，与"狗叫"或"猫这个词"的标签几乎完全不相关。原始波形包含信息，但形式使模型难以提取。相隔 100 ms 的两个相同音素，其原始样本完全不同。

频谱图解决了这个问题。它压缩了人类感知忽略的时间细节（微秒级抖动），保留了感知关注的结构（在约 10–25 ms 的时间窗口内，哪些频率能量较强）。

Mel 频谱图更进一步。人类对音高的感知是对数式的：100 Hz 与 200 Hz 的"距离感"和 1000 Hz 与 2000 Hz 相同。Mel 尺度将频率轴扭曲以匹配这种感知。从 2010 年到 2026 年，Mel 尺度频谱图一直是语音 ML 中最重要的单一特征。

## 概念

![波形到 STFT 到 Mel 频谱图到 MFCC 的阶梯](../assets/mel-features.svg)

**STFT（短时傅里叶变换）。** 将波形切片为重叠的帧（典型值：25 ms 窗口，10 ms 帧移 = 16 kHz 下 400 个样本 / 160 个样本）。每帧乘以窗函数（Hann 是默认值；Hamming 有略微不同的权衡）。对每帧做 FFT。将幅值谱堆叠成一个形状为 `(n_frames, n_freq_bins)` 的矩阵。这就是你的频谱图。

**对数幅值（Log-magnitude）。** 原始幅值跨越 5–6 个数量级。使用 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 压缩动态范围。每个生产流水线都使用对数幅值，而非原始幅值。

**Mel 尺度（Mel scale）。** 频率 `f`（Hz）到 mel `m` 的映射为 `m = 2595 * log10(1 + f / 700)`。该映射在 1 kHz 以下近似线性，1 kHz 以上近似对数。80 个覆盖 0–8 kHz 的 mel bin 是标准的 ASR 输入。

**Mel 滤波器组（Mel filterbank）。** 一组在 Mel 尺度上等间距分布的三角形滤波器。每个滤波器是相邻 FFT bin 的加权和。将 STFT 幅值与滤波器组矩阵相乘，一次 matmul 就得到 Mel 频谱图。

**对数 Mel 频谱图（Log-mel spectrogram）。** `log(mel_spec + 1e-10)`。Whisper 的输入。Parakeet 的输入。SeamlessM4T 的输入。2026 年通用的音频前端。

**MFCC。** 对对数 Mel 频谱图应用 DCT（II 型），保留前 13 个系数。去相关特征并进一步压缩。在约 2015 年之前占主导地位，之后 CNN/Transformer 在原始对数 Mel 上迎头赶上。仍用于说话人识别（x-vectors、ECAPA）。

**分辨率权衡。** 更大的 FFT = 更好的频率分辨率，但更差的时间分辨率。25 ms / 10 ms 是音频 ML 的默认值；50 ms / 12.5 ms 用于音乐；5 ms / 2 ms 用于瞬态检测（鼓点、爆破音）。

```figure
spectrogram-window
```

## 动手实现

### 第 1 步：对波形分帧

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

一段 10 秒 16 kHz 的片段，`frame_len=400, hop=160` 产生 998 帧。

### 第 2 步：Hann 窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在 FFT 之前逐元素相乘。消除因在非零端点截断引起的频谱泄漏。

### 第 3 步：STFT 幅值

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产环境使用 `torch.stft` 或 `librosa.stft`（基于 FFT，向量化）。这里的循环是教学性的；在 `code/main.py` 中对短片段运行。

### 第 4 步：Mel 滤波器组

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

80 个覆盖 0–8 kHz 的 mel，`n_fft=400`，得到一个 `(80, 201)` 矩阵。将 `(n_frames, 201)` 的 STFT 幅值乘以其转置，得到 `(n_frames, 80)` 的 Mel 频谱图。

### 第 5 步：对数 Mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见替代方案：`librosa.power_to_db`（参考归一化的 dB）、`10 * log10(power + eps)`。Whisper 使用更复杂的裁减+归一化流程（参见 Whisper 的 `log_mel_spectrogram`）。

### 第 6 步：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每个对数 Mel 帧应用 DCT，保留前 13 个系数。这就是你的 MFCC 矩阵。第一个系数通常被丢弃（它编码了整体能量）。

## 使用建议

2026 年技术栈：

| 任务 | 特征 |
|------|----------|
| ASR（Whisper、Parakeet、SeamlessM4T） | 80 个对数 Mel，10 ms 帧移，25 ms 窗口 |
| TTS 声学模型（VITS、F5-TTS、Kokoro） | 80 个 Mel，5–12 ms 帧移以实现精细时间控制 |
| 音频分类（AST、PANNs、BEATs） | 128 个对数 Mel，10 ms 帧移 |
| 说话人嵌入（ECAPA-TDNN、WavLM） | 80 个对数 Mel 或原始波形 SSL |
| 音乐（MusicGen、Stable Audio 2） | EnCodec 离散 token（非 Mel） |
| 关键词检测 | 小设备上用 40 个 MFCC |

经验法则：**如果你不是在处理音乐，从 80 个对数 Mel 开始。** 任何偏离都需要提供证据。

## 2026 年仍然常见的陷阱

- **Mel 数量不匹配。** 训练用 80 个 Mel，推理用 128 个 Mel。静默失败。在两端记录特征形状。
- **上游采样率不匹配。** 在 22.05 kHz 计算的 Mel 与 16 kHz 的不同。在特征化*之前*修复采样率。
- **dB 与 log 混淆。** Whisper 期望 log-mel，而非 dB-mel。某些 HF 流水线能自动检测；你的自定义代码不会。
- **归一化漂移。** 训练时逐段归一化，推理时全局归一化。导致 WER 翻倍的生产 bug。
- **填充泄漏。** 对片段末尾补零会在尾部帧产生平坦频谱。应使用对称填充或复制填充。

## 交付物

保存为 `outputs/skill-feature-extractor.md`。该技能针对给定模型目标选择特征类型、Mel 数量、帧/帧移和归一化方式。

## 练习

1. **简单。** 运行 `code/main.py`。它合成一个啁啾声（频率从 200 Hz 扫到 4000 Hz），并打印每帧的 argmax Mel bin。（可选）绘图确认其与扫频一致。
2. **中等。** 用 `n_mels` 取值 `{40, 80, 128}` 和 `frame_len` 取值 `{200, 400, 800}` 重新运行。在时间轴上测量尖峰带宽。哪种组合对啁啾声的分辨效果最好？
3. **困难。** 实现 `power_to_db`，并在 AudioMNIST 上比较一个小型 CNN 分类器的 ASR 准确率，分别使用 (a) 原始对数 Mel、(b) 以 `ref=max` 的 dB-Mel、(c) MFCC-13 + 一阶差分 + 二阶差分。报告 top-1 准确率。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| Frame（帧） | 一个切片 | 输入给一次 FFT 的 25 ms 波形块。 |
| Hop（帧移） | 步长 | 连续帧之间的样本数；ASR 默认 10 ms。 |
| Window（窗） | Hann/Hamming 之类 | 逐点乘法因子，将帧边缘渐变为零。 |
| STFT | 频谱图生成器 | 分帧加窗的 FFT；产生时间 × 频率矩阵。 |
| Mel | 扭曲的频率 | 对数感知尺度；`m = 2595·log10(1 + f/700)`。 |
| Filterbank（滤波器组） | 矩阵 | 将 STFT 投影到 Mel bin 的三角形滤波器。 |
| Log-mel | Whisper 的输入 | `log(mel_spec + eps)`；2026 年已标准化。 |
| MFCC | 老派特征 | 对数 Mel 的 DCT；13 个系数，去相关。 |

## 延伸阅读

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420)——MFCC 论文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/)——原始 Mel 尺度。
- [OpenAI——Whisper 源码, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py)——阅读参考实现。
- [librosa feature extraction docs](https://librosa.org/doc/main/feature.html)——`mfcc`、`melspectrogram` 和 hop/window 的参考文档。
- [NVIDIA NeMo——audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers)——Parakeet + Canary 模型的生产级流水线。
