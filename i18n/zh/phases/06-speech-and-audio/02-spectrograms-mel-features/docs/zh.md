# 频谱图、Mel 刻度与音频特征

> 神经网络无法很好地直接消费原始波形。它们消费的是频谱图。而消费 mel 频谱图效果更佳。2026 年的每一个 ASR、TTS 和音频分类器的成败都取决于这一项预处理选择。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 01 (音频基础)
**Time:** ~45 分钟

## 问题所在

取一段 10 秒、16 kHz 的音频片段。那是 160,000 个浮点数，全部在 `[-1, 1]` 中，与标签“狗叫”或“单词 cat”几乎完全不相关。原始波形包含信息，但其形式是模型难以提取的。相隔 100 ms 发出的两个相同音素，其原始样本完全不同。

频谱图解决了这个问题。它在人类感知忽略时间细节的地方（微秒级抖动）将其压缩，而在感知关注的地方（哪些频率在约 10–25 ms 的时间窗口内具有能量）保留结构。

Mel 频谱图更进一步。人类以对数方式感知音高：100 Hz 与 200 Hz 之间的“距离感”和 1000 Hz 与 2000 Hz 之间相同。mel 刻度正是为了匹配这一点而对频率轴进行扭曲。从 2010 年到 2026 年，mel 刻度频谱图一直是语音机器学习中最重要的单一特征。

## 核心概念

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT（短时傅里叶变换）。** 将波形切分为重叠的帧（典型参数：25 ms 窗口，10 ms 帧移 = 16 kHz 下 400 个样本 / 160 个样本）。将每一帧乘以窗函数（默认使用 Hann 窗；Hamming 窗的权衡稍有不同）。对每一帧做 FFT。将幅度谱堆叠成形状为 `(n_frames, n_freq_bins)` 的矩阵。这就是你的频谱图。

**对数幅度。** 原始幅度跨越 5-6 个数量级。取 `log(|X| + 1e-6)` 或 `20 * log10(|X|)` 来压缩动态范围。所有生产级流水线都使用对数幅度，而非原始幅度。

**Mel 刻度。** 以 Hz 为单位的频率 `f` 通过 `m = 2595 * log10(1 + f / 700)` 映射到 mel `m`。该映射在 1 kHz 以下近似线性，在 1 kHz 以上近似对数。覆盖 0–8 kHz 的 80 个 mel 频带是标准的 ASR 输入。

**Mel 滤波器组。** 一组在 mel 刻度上等间距分布的三角滤波器。每个滤波器是相邻 FFT 频带的加权和。将 STFT 幅度乘以滤波器组矩阵，一次矩阵乘法即可得到 mel 频谱图。

**对数 mel 频谱图。** `log(mel_spec + 1e-10)`。Whisper 的输入。Parakeet 的输入。SeamlessM4T 的输入。2026 年通用的音频前端。

**MFCC。** 对对数 mel 频谱图应用 DCT（II 型），保留前 13 个系数。它对特征去相关并进一步压缩。在约 2015 年之前一直是主导特征，此后基于原始对数 mel 的 CNN/Transformer 追平了它。目前在说话人识别（x-vectors、ECAPA）中仍在使用。

**分辨率权衡。** 更大的 FFT = 更好的频率分辨率，但时间分辨率更差。25 ms / 10 ms 是音频机器学习的默认值；音乐用 50 ms / 12.5 ms；瞬态检测（鼓点、爆破音）用 5 ms / 2 ms。

```figure
spectrogram-window
```

## 动手构建

### 第 1 步：分帧

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

一段 10 秒、16 kHz 的音频片段在 `frame_len=400, hop=160` 下可得到 998 帧。

### 第 2 步：Hann 窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在 FFT 之前进行逐元素相乘。可消除因在非零端点处截断而导致的频谱泄漏。

### 第 3 步：STFT 幅度

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产环境使用 `torch.stft` 或 `librosa.stft`（基于 FFT、向量化）。这里的循环仅用于教学；它在 `code/main.py` 内可以处理短片段。

### 第 4 步：mel 滤波器组

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

覆盖 0–8 kHz 的 80 个 mel，配合 `n_fft=400`，得到一个 `(80, 201)` 矩阵。将 `(n_frames, 201)` 的 STFT 幅度乘以其转置，即得到 `(n_frames, 80)` 的 mel 频谱图。

### 第 5 步：对数 mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见的替代方案：`librosa.power_to_db`（参考归一化的 dB）、`10 * log10(power + eps)`。Whisper 使用更复杂的裁剪 + 归一化流程（见 Whisper 的 `log_mel_spectrogram`）。

### 第 6 步：MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每一帧对数 mel 应用 DCT，保留前 13 个系数。这就是你的 MFCC 矩阵。第一个系数通常被丢弃（它编码整体能量）。

## 实际应用

2026 年的技术栈：

| 任务 | 特征 |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 对数 mel，10 ms 帧移，25 ms 窗口 |
| TTS 声学模型 (VITS, F5-TTS, Kokoro) | 80 mel，5–12 ms 帧移以实现精细的时间控制 |
| 音频分类 (AST, PANNs, BEATs) | 128 对数 mel，10 ms 帧移 |
| 说话人嵌入 (ECAPA-TDNN, WavLM) | 80 对数 mel 或原始波形的 SSL |
| 音乐 (MusicGen, Stable Audio 2) | EnCodec 离散 token（非 mel） |
| 关键词检测 | 面向微型设备的 40 维 MFCC |

经验法则：**如果你不做音乐相关的工作，就从 80 维对数 mel 开始。** 任何偏离都需要给出充分理由。

## 2026 年仍然会出现的坑

- **Mel 数量不匹配。** 训练时用 80 mel，推理时用 128 mel。静默失败。在两端都记录特征形状。
- **上游采样率不匹配。** 在 22.05 kHz 下计算的 mel 与 16 kHz 下的不同。在特征提取*之前*先固定采样率。
- **dB 与 log 的混淆。** Whisper 期望的是对数 mel，而不是 dB mel。某些 HF 流水线会自动检测；你自己的代码不会。
- **归一化漂移。** 训练时逐句归一化，推理时全局归一化。这个生产级 bug 会使 WER 翻倍。
- **填充带来的泄漏。** 对片段末尾补零会在末尾帧产生平坦的频谱。要么对称填充，要么复制填充。

## 上线交付

保存为 `outputs/skill-feature-extractor.md`。该技能会针对给定的模型目标选择特征类型、mel 数量、帧/帧移和归一化方式。

## 练习

1. **简单。** 运行 `code/main.py`。它合成一个扫频信号（频率从 200 → 4000 Hz 扫描）并打印每帧的 argmax mel 频带。绘图（可选）并确认与扫频一致。
2. **中等。** 在 `{40, 80, 128}` 中使用 `n_mels`、在 `{200, 400, 800}` 中使用 `frame_len` 重新运行。沿时间轴测量尖峰带宽。哪种组合最能分辨扫频信号？
3. **困难。** 实现 `power_to_db`，并在 AudioMNIST 上使用微型 CNN 分类器比较以下方法的 ASR 准确率：(a) 原始对数 mel，(b) 使用 `ref=max` 的 dB mel，(c) MFCC-13 + delta + delta-delta。报告 top-1 准确率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Frame（帧） | 一段切片 | 送入一次 FFT 的 25 ms 波形块。 |
| Hop（帧移） | 步长 | 相邻帧之间的样本数；ASR 默认 10 ms。 |
| Window（窗） | Hann/Hamming 那种东西 | 将帧边缘渐变为零的逐点乘子。 |
| STFT | 频谱图生成器 | 分帧 + 加窗的 FFT；得到时间 × 频率矩阵。 |
| Mel | 扭曲的频率 | 对数感知刻度；`m = 2595·log10(1 + f/700)`。 |
| Filterbank（滤波器组） | 那个矩阵 | 将 STFT 投影到 mel 频带上的三角滤波器。 |
| Log-mel | Whisper 的输入 | `log(mel_spec + eps)`；2026 年已标准化。 |
| MFCC | 老式特征 | 对数 mel 的 DCT；13 个系数，已去相关。 |

## 延伸阅读

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) — MFCC 的原始论文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) — mel 刻度的原始文献。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) — 阅读参考实现。
- [librosa feature extraction docs](https://librosa.org/doc/main/feature.html) — `mfcc`、`melspectrogram` 以及帧移/窗口的参考文档。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) — 面向 Parakeet + Canary 模型的生产级流水线。