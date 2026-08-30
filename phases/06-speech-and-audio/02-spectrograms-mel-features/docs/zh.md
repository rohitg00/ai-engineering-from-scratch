# Spectrograms, Mel Scale & Audio Features

> 神经网络不能很好地消耗原始波形。他们消耗光谱图。他们更好地消耗梅尔光谱图。2026年的每一个ASB、TTC和音频分类器都取决于这一单一预处理选择。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 01（音频基础知识）
** 时间：** ~45分钟

## The Problem

拍摄一段10秒的16 GHz片段。这是160，000个花车，全部以“[-1，1]'形式，几乎与“狗叫声”或“猫这个词”的标签完全无关。原始波具有信息，但模型无法轻易提取的形式。相隔100 ms的两个相同音素具有完全不同的原始样本。

频谱图解决了这个问题。它瓦解了人类感知忽略它的时间细节（微秒抖动），并保留了感知所涉及的结构（在~10-25 ms的时间窗口内，频率是充满活力的）。

梅尔光谱图进一步推动。人类以数学方式感知音调：100赫兹与200赫兹的声音“距离相同”，与1000赫兹与2000赫兹的声音“距离相同”。梅尔标度扭曲频率轴以匹配。梅尔缩放的频谱图是2010年至2026年语音ML中最重要的特征。

## The Concept

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT（短期傅里叶变换）。**将波形切片为重叠的帧（典型情况：25 ms窗口，10 ms跳跃= 400个样本/ 160个样本，16 GHz）。将每个帧乘以窗口函数（Hann是默认值; Hamming的权衡略有不同）。每帧进行快速傅里叶变换。将幅度谱堆叠到形状为“（n_frames，n_freq_bins）”的矩阵中。这是你的光谱图。

** 对数值。**原始震级跨越5-6个数量级。拿' log（|X| + 1 e-6）'或' 20 * log 10（|X|）'以压缩动态范围。每条生产管道都使用对数量级，而不是原始量级。

** 梅尔规模。**频率“f”（以赫兹为单位）通过“m = 2595 * log 10（1 + f / 700）”映射到mel“m”。该映射在1 GHz以下大致呈线性，在1 GHz以上大致呈线性。覆盖0-8 GHz的80个梅尔箱是标准的ASB输入。

** 梅尔过滤银行。**一组在梅尔标度上等间距的三角形过滤器。每个过滤器都是相邻傅里叶变换器的加权和。将STFT幅度乘以过滤器组矩阵即可得到一个矩阵中的梅尔谱图。

**Log-mel光谱图。** ' log（mel_spec +1 e-10）'。低语者的输入。长尾鹦鹉的输入。无条件M4 T的输入。2026年通用音频前端。

** MFCC。**获取log-mel频谱图，应用离散像素（II型），保留前13个系数。对功能进行关联并进一步压缩。直到2015年左右，原始原木上的CNN/Transformers才开始占据主导地位。仍用于说话人识别（x-vector、EAPA）。

** 决议交易。**更大的傅里叶变换=频率分辨率更好，但时间分辨率更差。音频ML默认值为25 ms / 10 ms;音乐为50 ms / 12.5 ms;瞬时检测（击鼓、爆破音）为5 ms / 2 ms。

## Build It

### Step 1: frame the waveform

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

“Frame_len=400，hop=160”的10秒16 GHz剪辑产生998个帧。

### Step 2: Hann window

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在快速傅立叶变换之前按元素相乘。删除因非零端点截断而导致的频谱泄漏。

### Step 3: STFT magnitude

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

制作使用“torch.stft”或“librosa.stft”（受FT支持，载体化）。这里的循环是教学性的;它在“code/main.py”中的短剪辑上运行。

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

80 覆盖0-8 GHz且“n_fft=400”的梅尔给出了“（80，201）”矩阵。将“（n_frames，201）”STFT幅度乘以转置，即可获得“（n_frames，80）”梅尔频谱图。

### Step 5: log-mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

常见替代方案：“librosa.power_to_DB”（参考标准化分贝）、“10 * log 10（power + eps）”。Whisper使用更复杂的剪辑+规范化例程（请参阅Whisper的“log_mel_spectrogram”）。

### Step 6: MFCCs

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

对每个log-mel帧应用DLC，保留前13个系数。这是您的MFCC矩阵。第一个系数通常被丢弃（它编码总能量）。

## Use It

2026年堆栈：

| 任务 | 特征 |
|------|----------|
| ASB（耳语、长尾鹦鹉、无菌M4 T） | 80 log-mels，10 ms跳，25 ms窗口 |
| TTC声学模型（VITS、F5-TTC、Kokoro） | 80梅尔，5-12 ms跳跃，可实现精细时间控制 |
| 音频分类（AST、PANN、BEAT） | 128个日志梅尔，10 ms跳频 |
| 扬声器嵌入（ECAPA-TDNN、WavLM） | 80个log梅尔或原始波SSL |
| 音乐（MusicGen、稳定音频2） | EnCodec离散代币（不是Melel） |
| 关键词检出 | 40个用于微型设备的MFCC |

经验法则：** 如果您不从事音乐工作，请从80个log梅尔开始。**任何偏差都有举证责任。

## Pitfalls that still ship in 2026

- ** 梅尔计数不匹配。**用80个梅尔进行训练，用128个梅尔进行推理。无声的失败。记录两端的要素形状。
- ** 上游样本率不匹配。**在22.05 GHz下计算的熔点看起来与16 GHz下计算的熔点不同。在 * 特征化之前修复SR *。
- **dB vs log.** Whisper需要log-mel，而不是dB-mel。一些HF管道会自动检测;您的自定义代码不会。
- ** 归一化漂移。**训练期间的每话语归一化，推理期间的全局归一化。使WER翻倍的生产缺陷。
- ** 衬垫泄漏。**剪辑结束的补零会在尾部帧中产生平坦的光谱。对称垫或复制。

## Ship It

另存为“输出/skill-feature-extractor.md”。该技能为给定模型目标选择特征类型、梅尔计数、帧/跳数和规范化。

## Exercises

1. ** 简单。**运行'代码/main.py '。它合成啁啾（扫频200 - 4000 Hz）并打印每帧的argmax梅尔bin。绘制（可选）并确认其与扫描匹配。
2. ** 中等。**使用“{40，80，128}”中的“n_mels”和“{200，400，800}”中的“frage_len”重新运行。测量时间轴上的尖峰带宽。哪种组合最能解决吱吱声？
3. ** 很难。**使用（a）原始log-mel、（b）dB-mel和“ref=max”、（c）MFCC-13 + delta + delta-delta，在AudioMNIST上使用“power_to_DB”来比较小型CNN分类器的ASB准确性。报告前一名的准确性。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 帧 | 一片 | 25 ms的波形块被反馈到一个快速傅里叶变换。 |
| 跳 | 步幅 | 在连续帧之间采样; ASR默认值为10 ms。 |
| 窗口 | 汉恩/海明的事情 | 逐点乘数，将帧边缘逐渐缩小到零。 |
| STFT | 谱图生成器 | 成帧+加窗口的快速傅里叶变换;产生时间x频率矩阵。 |
| Mel | 弯曲频率 | 日志知觉量表;' m = 2595·log 10（1 + f/700）'。 |
| 滤波器 | 矩阵 | 三角形过滤器将STFT投影到梅尔箱上。 |
| 洛梅尔 | 低语者的输入 | “log（mel_spec + eps）”; 2026年标准化。 |
| MFCC | 老派特色 | log-mel的DLC; 13个系数，去相关。 |

## Further Reading

- [Davis，Mermelstein（1980）.单音节词识别的参数表示比较]（https：//ieeeexplore.ieee.org/document/1163420）-MFCC论文。
- [史蒂文斯、艾斯曼、纽曼（1937）。心理强度音调测量量表]（https：//pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/）-原始梅尔量表。
- [OpenAI - Whisper源，log_mel_spectrogram]（https：//github.com/openai/whisper/blob/main/whisper/audio.py）-阅读参考实现。
- [librosa特征提取文档]（https：//librosa.org/doc/main/feature.html）-“mfcc”、“melspectrogram”和hop/窗口的参考。
- [NVIDIA NeMo -音频预处理]（https：//docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers）-鹦鹉+金丝雀模型的生产规模管道。
