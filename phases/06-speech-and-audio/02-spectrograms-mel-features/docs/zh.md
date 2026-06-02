# 频谱图、Mel 尺度与音频特征（Spectrograms, Mel Scale & Audio Features）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 神经网络消化不了原始波形，但很乐意吃频谱图（spectrogram），吃 mel 频谱图（mel spectrogram）就更香了。2026 年所有的 ASR、TTS 和音频分类器，命运都系在这一步预处理选择上。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## 问题（The Problem）

拿一段 10 秒、16 kHz 的音频，那就是 160,000 个浮点数，全部落在 `[-1, 1]` 区间，几乎和"狗叫"或"cat 这个词"的标签完全不相关。原始波形里信息是有的，但形式让模型很难提取。两个完全相同的音素，间隔 100 ms 说出口，原始采样值就完全不同了。

频谱图解决了这个问题。它把人类感知忽略的时间细节（微秒级抖动）压缩掉，同时保留感知关注的结构（在 ~10–25 ms 的时间窗里，哪些频率有能量）。

mel 频谱图更进一步。人类感知音高是对数式的：100 Hz 与 200 Hz 之间的"距离"，听起来和 1000 Hz 与 2000 Hz 之间一样。mel 尺度把频率轴扭曲了一下来匹配这种感知。从 2010 到 2026，mel 频谱图都是语音 ML 里最重要的单一特征。

## 概念（The Concept）

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT（Short-Time Fourier Transform，短时傅里叶变换）。** 把波形切成有重叠的帧（典型设置：25 ms 窗 + 10 ms hop = 16 kHz 下的 400 采样 / 160 采样）。每帧乘以一个窗函数（Hann 是默认；Hamming 取舍略有不同）。每帧做 FFT。把幅度谱堆叠成一个形状为 `(n_frames, n_freq_bins)` 的矩阵。这就是你的频谱图。

**Log-magnitude（对数幅度）。** 原始幅度跨越 5–6 个数量级，所以取 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 来压缩动态范围。所有生产流水线（pipeline）用的都是 log-magnitude，而不是原始幅度。

**Mel 尺度。** Hz 频率 `f` 通过 `m = 2595 * log10(1 + f / 700)` 映射到 mel 值 `m`。这个映射在 1 kHz 以下大致是线性的，1 kHz 以上则大致是对数的。覆盖 0–8 kHz 的 80 个 mel bin 是 ASR 的标准输入。

**Mel filterbank（mel 滤波器组）。** 一组在 mel 尺度上等距分布的三角形滤波器。每个滤波器是相邻 FFT bin 的加权和。把 STFT 幅度乘以 filterbank 矩阵，一次矩阵乘法就能得到 mel 频谱图。

**Log-mel 频谱图。** `log(mel_spec + 1e-10)`。Whisper 的输入。Parakeet 的输入。SeamlessM4T 的输入。2026 年通用的音频前端。

**MFCC。** 拿 log-mel 频谱图，做 DCT（type II），保留前 13 个系数。这一步把特征解相关，并进一步压缩。在 2015 年之前一直是主导特征，之后才被基于原始 log-mel 的 CNN/Transformer 追上。在说话人识别（speaker recognition）里仍在用（x-vectors、ECAPA）。

**分辨率取舍。** FFT 越大，频率分辨率越好，但时间分辨率越差。25 ms / 10 ms 是音频 ML 的默认值；音乐用 50 ms / 12.5 ms；瞬态检测（鼓点、爆破音）用 5 ms / 2 ms。

## 动手实现（Build It）

### Step 1: frame the waveform

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

10 秒 16 kHz 的音频，`frame_len=400, hop=160`，会得到 998 帧。

### Step 2: Hann window

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在 FFT 之前做逐元素相乘。这样可以消除在非零端点截断导致的频谱泄漏（spectral leakage）。

### Step 3: STFT magnitude

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产里用 `torch.stft` 或 `librosa.stft`（基于 FFT、向量化）。这里的循环只是讲解用的；它在 `code/main.py` 里跑短音频。

### Step 4: mel filterbank

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

覆盖 0–8 kHz 的 80 个 mel，配合 `n_fft=400`，得到一个 `(80, 201)` 的矩阵。把 `(n_frames, 201)` 的 STFT 幅度乘以它的转置，就得到 `(n_frames, 80)` 的 mel 频谱图。

### Step 5: log-mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见替代写法：`librosa.power_to_db`（基于参考值归一化的 dB）、`10 * log10(power + eps)`。Whisper 用了一套更复杂的 clip + 归一化流程（见 Whisper 的 `log_mel_spectrogram`）。

### Step 6: MFCCs

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每一帧 log-mel 做 DCT，保留前 13 个系数。这就是你的 MFCC 矩阵。第一个系数通常会丢掉（它编码的是整体能量）。

## 用起来（Use It）

2026 年的技术栈：

| 任务 | 特征 |
|------|----------|
| ASR（Whisper、Parakeet、SeamlessM4T） | 80 维 log-mel，10 ms hop，25 ms 窗 |
| TTS 声学模型（VITS、F5-TTS、Kokoro） | 80 维 mel，5–12 ms hop 以获得精细时间控制 |
| 音频分类（AST、PANNs、BEATs） | 128 维 log-mel，10 ms hop |
| 说话人 embedding（ECAPA-TDNN、WavLM） | 80 维 log-mel 或基于原始波形的 SSL |
| 音乐（MusicGen、Stable Audio 2） | EnCodec 离散 token（不是 mel） |
| 关键词检出（keyword spotting） | 40 维 MFCC，用于微型设备 |

经验法则：**如果你做的不是音乐，先从 80 维 log-mel 开始。** 任何偏离这个默认值的选择都需要拿出证据。

## 2026 年仍在出货的坑（Pitfalls that still ship in 2026）

- **Mel 数量不一致。** 训练用 80 维 mel，推理用 128 维 mel。会静默失败。在两端都把特征 shape 打到日志里。
- **上游采样率不一致。** 22.05 kHz 算出的 mel 和 16 kHz 算出的不一样。在做特征提取**之前**就把 SR 修好。
- **dB 还是 log？** Whisper 期望的是 log-mel，不是 dB-mel。某些 HF 流水线会自动检测；你自己写的代码不会。
- **归一化漂移。** 训练时按句归一化，推理时全局归一化。这是能把 WER 翻倍的生产事故。
- **Padding 泄漏。** 在音频末尾零填充会让尾部帧出现一段平坦频谱。改用对称填充或复制填充。

## 上线部署（Ship It）

保存为 `outputs/skill-feature-extractor.md`。这个 skill 会针对给定的模型目标，挑选特征类型、mel 数量、frame/hop 和归一化方式。

## 练习（Exercises）

1. **简单。** 跑一下 `code/main.py`。它会合成一段 chirp 信号（频率从 200 Hz 扫到 4000 Hz），并打印每帧 mel bin 的 argmax。画图（可选），确认结果与扫频曲线吻合。
2. **中等。** 用 `n_mels` 取 `{40, 80, 128}`、`frame_len` 取 `{200, 400, 800}` 重新跑。沿时间轴度量尖峰带宽。哪种组合对 chirp 的分辨最好？
3. **困难。** 实现 `power_to_db`，然后用一个小型 CNN 分类器在 AudioMNIST 上比较 ASR 准确率：(a) 原始 log-mel；(b) 用 `ref=max` 的 dB-mel；(c) MFCC-13 + delta + delta-delta。报告 top-1 准确率。

## 关键术语（Key Terms）

| 术语 | 大家怎么叫它 | 它实际是什么 |
|------|-----------------|-----------------------|
| Frame | 一片 | 喂给一次 FFT 的 25 ms 波形片段。 |
| Hop | 步幅（stride） | 相邻帧之间隔的采样数；ASR 默认 10 ms。 |
| Window | Hann / Hamming 那玩意儿 | 把帧两端逐渐压到 0 的逐点乘子。 |
| STFT | 频谱图生成器 | 分帧 + 加窗 + FFT；产出时间 × 频率矩阵。 |
| Mel | 扭曲过的频率 | 对数感知尺度；`m = 2595·log10(1 + f/700)`。 |
| Filterbank | 那个矩阵 | 把 STFT 投影到 mel bin 的三角形滤波器。 |
| Log-mel | Whisper 的输入 | `log(mel_spec + eps)`；2026 年的标准做法。 |
| MFCC | 老派特征 | 对 log-mel 做 DCT；13 个系数、相互解相关。 |

## 延伸阅读（Further Reading）

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) —— MFCC 论文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) —— 最初的 mel 尺度。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) —— 读一遍参考实现。
- [librosa feature extraction docs](https://librosa.org/doc/main/feature.html) —— `mfcc`、`melspectrogram` 以及 hop/window 的参考。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) —— Parakeet + Canary 模型的生产规模流水线。
