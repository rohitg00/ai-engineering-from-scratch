# 频谱,梅尔尺度和音频特征

> 网络不用好使用原始波形.它们用光谱.它们用光谱更好. 2026年每一个ASR,TTS和音频分类器都会因这个单一的预处理选择而活着或死亡.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## 问题

拍摄10秒16千克Hz的剪辑,这相当于16万次,全部在`[-1, 1]`几乎完全不与标签"狗吠叫"或"猫"相关.原始波形有信息,但模型无法轻松提取. 100 ms 的距离之间讲述的两个相同音符完全不同原始样本.

频谱图解决了这一问题.它将人类感知忽视的时间细节 (微秒的) 崩,并保留了感知参与的结构 (这些频率是能量,在时间窗口中是1025ms).

梅尔谱程进一步推进.人类以逻辑方式感知音速:100Hz与200Hz的声音与1000Hz与2000Hz的距离相同.梅尔谱程扭曲频率轴以匹配.梅尔谱程是2010年至2026年语音ML中最重要的单一特征.

## 概念

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**切割波形成重叠的框架 (典型:25 ms窗口,10 ms跳 = 400 样本 / 16 样本在 16 kHz).乘以窗口函数 (汉是默认的; Hamming 略有不同的交易).FFT 每个框架.堆积大小谱到一个形状矩阵`(n_frames, n_freq_bins)`这是你的光谱.

**Log-magnitude.**度范围为5至6个级别.`log(|X| + 1e-6)`或`20 * log10(|X|)`每个生产管道都使用日志大小,而不是原始大小.

**Mel scale.**频率`f`在Hz地图中到MEL`m`通过$m = 2595 \cdot \log_{10}(1 + f / 700)$图表大致是线性低于1kHz,大致是高于高数. 80 melbin覆盖08kHz是标准ASR输入.

**Mel filterbank.**单个选器是单个选器,一个选器是单个选器,一个选器是单个选器.一个选器的选器是单个选器.一个选器的选器是单个选器.一个选器的选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.一个选器是单个选器.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`声输入,子输入,无M4T输入,通用2026音频前端.

**MFCCs.**采用日志谱,应用DCT (II类),保留第13个系数. 调节特征并进一步压缩. 在2015年左右,CNN/变压器在原始日志中被捕获.仍然用于扬声器识别 (x向量,ECAPA).

**Resolution trade.**较大的FFT =更好的频率分辨率,但更糟糕的时间分辨率. 25 ms / 10 ms是音频-ML默认; 50 ms / 12.5 ms为音乐; 5 ms / 2 ms为过渡检测 (鼓击,音).

```figure
spectrogram-window
```

## 建立它

### 步骤1:成波形

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

通过10秒16kHz的剪辑`frame_len=400, hop=160`结果是998个.

### 步骤2:汉窗

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

在FFT之前乘以元素智能. 消除在非零的终点中切断造成的光谱泄漏.

### 步骤3:STFT大小

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

生产用途`torch.stft`或`librosa.stft`循环是教学性的,它在短片中运行.`code/main.py`现在,我们要去.

### 步骤4:mel过银行

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

频率为 80 mels 覆盖08 kHz`n_fft=400`给了一个`(80, 201)`乘以一个矩阵.`(n_frames, 201)`转移值的STFT大小`(n_frames, 80)`光谱.

### 步骤5: 记录

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

共同的替代方案:`librosa.power_to_db`(参考标准化 dB),`10 * log10(power + eps)`语使用更有参与的剪辑 +正常化例程 (见语的图)`log_mel_spectrogram`)

### 步骤 6: 金融金融机构

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

按DCT对每一个日志格,保持第13个系数.这是你的MFCC矩阵.第一个系数通常会下降 (它编码总能量).

## 用它

现在,我们要做什么?

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

指规则:**if you are not working on music, start with 80 log-mels.**证明的责任是任何偏差.

## 陷在2026年仍存在

- **Mel count mismatch.**训练80米,推断128米,沉默失败,记录两端的特征形状.
- **Sample-rate mismatch upstream.**在22.05kHz计算的Mels看起来与16kHz不同.
- **dB vs log.**微信预计记录,而不是 dB-mel. 有些HF管道会自动检测,但你的定制代码不会.
- **Normalization drift.**训练期间的每次发出正常化,推断期间的全球正常化.
- **Leakage from padding.**片的末端以零制,在后面的框架中产生平面光谱.

## 运送它

保存如`outputs/skill-feature-extractor.md`技能选择特征类型,数量,框架/跳,和规范化给定的模型目标.

## 运动

1. **Easy.**跑步`code/main.py`通过选,将每一个图片的 argmax melbin 打印出来.
2. **Medium.**再运行`n_mels`在`{40, 80, 128}`其他`frame_len`在`{200, 400, 800}`时间轴上,测量尖峰带宽. 什么组合能解决声最好?
3. **Hard.**实施`power_to_db`通过使用 (a) 原始日志-mail, (b) dB-mel 进行对比,`ref=max`报告前一级准确性.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## 进一步阅读

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) 国际金融委员会论文.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/)原始的MEL尺度.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py)阅读参考实施.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html)参考`mfcc`现在`melspectrogram`跳/窗户.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers)生产规模的管道,用于Parakeet+加拿大车型.
