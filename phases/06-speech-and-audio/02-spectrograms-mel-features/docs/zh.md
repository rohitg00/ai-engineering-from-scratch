# 02 · 频谱图、梅尔刻度与音频特征

> 神经网络并不擅长直接消化原始波形。它们消化频谱图（spectrogram），消化梅尔频谱图（mel spectrogram）则更上一层楼。2026 年的每一个 ASR、TTS 与音频分类器，命运都系于这一个预处理选择。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 6 · 01（音频基础）
**时长：** 约 45 分钟

## 问题所在

取一段 10 秒、16 kHz 的音频。那是 160,000 个浮点数，全部落在 `[-1, 1]` 区间，却几乎与标签「狗叫」或「单词 cat」完全不相关。原始波形包含了信息，但其形式让模型难以轻易提取。同一个音素若间隔 100 毫秒说两遍，其原始采样值会完全不同。

频谱图解决了这个问题。它在人类感知会忽略的地方（微秒级抖动）压缩时间细节，同时在感知会关注的地方（哪些频率在约 10–25 毫秒的时间窗内能量充沛）保留结构。

梅尔频谱图更进一步。人类对音高的感知是对数式的：100 Hz 与 200 Hz 听起来「相差的距离」和 1000 Hz 与 2000 Hz 相同。梅尔刻度（mel scale）对频率轴做了相应的扭曲来匹配这一感知。从 2010 年到 2026 年，梅尔刻度化的频谱图都是语音机器学习中最重要的单一特征。

## 核心概念

〔图：从波形到 STFT 到梅尔频谱图再到 MFCC 的特征阶梯〕

**STFT（短时傅里叶变换，Short-Time Fourier Transform）。** 把波形切成相互重叠的帧（典型值：25 毫秒窗、10 毫秒帧移 = 在 16 kHz 下为 400 个采样 / 160 个采样）。每帧乘以一个窗函数（汉宁窗（Hann）是默认选择；汉明窗（Hamming）的折中略有不同）。对每帧做 FFT。把幅度谱堆叠成形状为 `(n_frames, n_freq_bins)` 的矩阵。这就是你的频谱图。

**对数幅度（Log-magnitude）。** 原始幅度跨越 5–6 个数量级。取 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 来压缩动态范围。每一条生产管线都使用对数幅度，而非原始幅度。

**梅尔刻度（Mel scale）。** 以 Hz 为单位的频率 `f` 通过 `m = 2595 * log10(1 + f / 700)` 映射到梅尔值 `m`。该映射在 1 kHz 以下大致线性，在 1 kHz 以上大致对数。覆盖 0–8 kHz 的 80 个梅尔频带是标准的 ASR 输入。

**梅尔滤波器组（Mel filterbank）。** 一组在梅尔刻度上等间距排布的三角滤波器。每个滤波器是相邻 FFT 频段的加权和。把 STFT 幅度乘以滤波器组矩阵，一次矩阵乘法即可得到梅尔频谱图。

**对数梅尔频谱图（Log-mel spectrogram）。** `log(mel_spec + 1e-10)`。这是 Whisper 的输入，是 Parakeet 的输入，是 SeamlessM4T 的输入。2026 年通用的音频前端。

**MFCC（梅尔频率倒谱系数，Mel-Frequency Cepstral Coefficients）。** 取对数梅尔频谱图，做一次 DCT（II 型），保留前 13 个系数。它对特征去相关并进一步压缩。直到 2015 年左右、当在原始对数梅尔上运行的 CNN/Transformer 赶上来之前，它一直是主导特征。如今仍用于说话人识别（x-vectors、ECAPA）。

**分辨率取舍。** FFT 更大 = 频率分辨率更好但时间分辨率更差。25 毫秒 / 10 毫秒是音频机器学习的默认值；音乐用 50 毫秒 / 12.5 毫秒；瞬态检测（鼓点、爆破音）用 5 毫秒 / 2 毫秒。

## 动手构建

### 第 1 步：对波形分帧

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

一段 10 秒、16 kHz 的音频，用 `frame_len=400, hop=160`，会产出 998 帧。

### 第 2 步：汉宁窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在 FFT 之前逐元素相乘。它消除了因在非零端点处截断而引起的频谱泄漏。

### 第 3 步：STFT 幅度

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产环境使用 `torch.stft` 或 `librosa.stft`（基于 FFT、已向量化）。这里的循环是为教学目的；它在 `code/main.py` 中针对短音频运行。

### 第 4 步：梅尔滤波器组

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

覆盖 0–8 kHz 的 80 个梅尔频带、配 `n_fft=400`，会得到一个 `(80, 201)` 矩阵。把 `(n_frames, 201)` 的 STFT 幅度乘以它的转置，即可得到 `(n_frames, 80)` 的梅尔频谱图。

### 第 5 步：对数梅尔

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见替代方案：`librosa.power_to_db`（以参考值归一化的 dB）、`10 * log10(power + eps)`。Whisper 使用了一套更复杂的裁剪 + 归一化流程（参见 Whisper 的 `log_mel_spectrogram`）。

### 第 6 步：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每个对数梅尔帧做 DCT，保留前 13 个系数。这就是你的 MFCC 矩阵。第一个系数通常会被丢弃（它编码的是整体能量）。

## 实际运用

2026 年的技术栈：

| 任务 | 特征 |
|------|----------|
| ASR（Whisper、Parakeet、SeamlessM4T） | 80 维对数梅尔，10 ms 帧移，25 ms 窗 |
| TTS 声学模型（VITS、F5-TTS、Kokoro） | 80 维梅尔，5–12 ms 帧移以实现精细的时间控制 |
| 音频分类（AST、PANNs、BEATs） | 128 维对数梅尔，10 ms 帧移 |
| 说话人嵌入（ECAPA-TDNN、WavLM） | 80 维对数梅尔，或原始波形自监督学习（SSL） |
| 音乐（MusicGen、Stable Audio 2） | EnCodec 离散 token（而非梅尔） |
| 关键词检测（Keyword spotting） | 面向微型设备的 40 维 MFCC |

经验法则：**如果你不是在做音乐，就从 80 维对数梅尔开始。** 任何偏离都需自行举证。

## 2026 年仍在上线的陷阱

- **梅尔数量不匹配。** 训练用 80 个梅尔，推理用 128 个梅尔。会无声失败。请在两端都记录特征形状。
- **上游采样率不匹配。** 在 22.05 kHz 下算出的梅尔与 16 kHz 下不同。请在做特征化*之前*修正采样率。
- **dB 与 log 之争。** Whisper 期望的是对数梅尔，而非 dB 梅尔。某些 HF 管线会自动检测；而你的自定义代码不会。
- **归一化漂移。** 训练时按单条语音归一化，推理时却用全局归一化。这是会让 WER 翻倍的生产 bug。
- **填充导致的泄漏。** 在音频末尾做零填充会让尾部帧产生平坦的频谱。请做对称填充或复制填充。

## 交付产物

保存为 `outputs/skill-feature-extractor.md`。这个 skill 会为给定的模型目标挑选特征类型、梅尔数量、帧长/帧移以及归一化方式。

## 练习

1. **简单。** 运行 `code/main.py`。它会合成一段啁啾信号（chirp，频率从 200 → 4000 Hz 扫过），并打印每帧的 argmax 梅尔频带。绘图（可选）并确认其与扫频相吻合。
2. **中等。** 用 `n_mels` 取 `{40, 80, 128}`、`frame_len` 取 `{200, 400, 800}` 重新运行。测量沿时间轴的尖峰带宽。哪种组合对该啁啾信号的分辨最好？
3. **困难。** 实现 `power_to_db`，并在 AudioMNIST 上用一个微型 CNN 分类器比较 ASR 准确率，分别使用：(a) 原始对数梅尔，(b) 以 `ref=max` 的 dB 梅尔，(c) MFCC-13 + delta + delta-delta。报告 top-1 准确率。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| Frame（帧） | 一个切片 | 喂给单次 FFT 的 25 ms 波形块。 |
| Hop（帧移） | 步幅 | 相邻帧之间的采样数；10 ms 是 ASR 默认值。 |
| Window（窗） | 汉宁/汉明那个东西 | 把帧边缘渐变收敛到零的逐点乘子。 |
| STFT | 频谱图生成器 | 分帧 + 加窗的 FFT；产出时间 × 频率矩阵。 |
| Mel（梅尔） | 扭曲后的频率 | 对数感知刻度；`m = 2595·log10(1 + f/700)`。 |
| Filterbank（滤波器组） | 那个矩阵 | 把 STFT 投影到梅尔频带的三角滤波器。 |
| Log-mel（对数梅尔） | Whisper 的输入 | `log(mel_spec + eps)`；2026 年的标准化做法。 |
| MFCC | 老派特征 | 对数梅尔的 DCT；13 个系数，已去相关。 |

## 延伸阅读

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) —— MFCC 的奠基论文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) —— 最初的梅尔刻度。
- [OpenAI —— Whisper 源码，log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) —— 阅读参考实现。
- [librosa 特征提取文档](https://librosa.org/doc/main/feature.html) —— `mfcc`、`melspectrogram` 以及帧移/窗的参考。
- [NVIDIA NeMo —— 音频预处理](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) —— 面向 Parakeet + Canary 模型的生产级管线。
