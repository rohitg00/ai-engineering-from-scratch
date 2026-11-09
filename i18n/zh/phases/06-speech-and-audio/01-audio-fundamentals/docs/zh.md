# 音频基础 波形,样本,福利尔转换

> 波形是原始信号.谱谱是表示.MEL特征是ML友好的形式.每一个现代ASR和TTS管道都走在这个梯子上,第一步是理解采样和Fourier.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## 问题

电话产生压力与时间信号.你的神经网络消耗了器.它们之间有堆积的规则,如果被违反,会产生沉默的错误:模型运行得很好,但WER翻倍,或者TTS发出声,或者语音克隆系统记忆起电话而不是扬声器.

语音系统中的每一个错误都追溯到三个问题之一:

1. 数据记录的样本率是多少,模型预期什么?
2. 信号是个别名吗?
3. 你是用原始样本或频率表示操作?

错误的,甚至是声大型v4也会产生垃圾.

## 概念

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**的一个维度的浮动阵列`[-1.0, 1.0]`为了将其转换为秒,按样本速率划分:`t = n / sr`十秒钟的 16 kHz 剪辑是 160,000 个浮动的阵列.

**Sampling rate (sr).**2026年常见率:

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**样本率`sr`能明确表示高达 `sr/2`现在,我们要去.`sr/2`边界是尼奎斯特频率. 尼奎斯特上方的能量被*aliased* 折叠到较低频率,并破坏信号.

**Bit depth.**16位PCM (签名int16,范围±32,767) 是通用交换格式. 24位为音乐, 32位为内部DSP.`soundfile`读 int16,但在 显示 float32 阵列中`[-1, 1]`现在,我们要去.

**Fourier Transform.**任何有限的信号是不同频率的突体的总和.`N`样本`N`复杂系数 每频段一个. `bin k`频率地图`k · sr / N`度是频率的宽度,角度是相.

**FFT.**快速福利尔转换:一个`O(N log N)`对于DFT的算法`N`每个音频库都使用FFT在罩杯下. 1024样本FFT在16kHz时提供512个可用频段,范围为08kHz在15.6Hz分辨率.

**Framing + window.**我们不把整个剪辑 FFT. 我们将它切成重叠的 * 框架* (通常是25 ms和10 ms跳),乘以窗口函数 (汉,汉明) 来消除边缘不连续性,然后将每个框 FFT.这是短时间福利尔转换 (STFT).课程02从这里开始.

```figure
mel-scale
```

## 建立它

### 步骤1:阅读一个剪辑,绘制波形

`code/main.py`仅使用SDLIB`wave`为了保持演示的无依赖性.`soundfile`或`torchaudio.load`(两者都回来了)`(waveform, sr)`双:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### 步骤2:从第一原则合成一个鼻波

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

按16kHz的440Hz音节 (音乐会A) 速度,在1秒钟内,是16000个浮动.`wave.open(..., "wb")`使用16位PCM编码.

### 步骤3:手动计算DFT

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

`O(N²)`罚款`N=256`为了确认正确性,对真正的音频无用.`numpy.fft.rfft`或`torch.fft.rfft`现在,我们要去.

### 步骤4:找到主导频率

极度峰值指数`k_star`频率地图`k_star * sr / N`运行这个440Hz的阴影应该返回一个峰值`440 * N / sr`现在,我们要去.

### 步骤5:证明名

采样一个7kHz的弦在10kHz (Nyquist = 5kHz). 7kHz的音调是在 Nyquist 上,并折叠到`10 − 7 = 3 kHz`子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子

## 用它

实际上你将在2026年发送的堆:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

决策规则:**match sample rate before you match anything else**通过44.1千克Hz的立体音频,你会得到像模型 bug 的垃圾.

## 运送它

保存如`outputs/skill-audio-loader.md`技术帮助您检查音频输入是否符合下游模型的预期,并且在不符合时,可以正确复制.

## 运动

1. **Easy.**在16kHz时合成220Hz+440Hz+880Hz的1秒混合.运行DFT.确认预期的垃圾桶的三个峰值.
2. **Medium.**记录你的声音的3秒 WAV48kHz. 下样子到16kHz使用`torchaudio.transforms.Resample`通过每三样子进行简单的十度测量, FFT 两者.
3. **Hard.**仅使用 创建STFT从零开始`math`图像大小与 图像大小与 图像大小与 图像大小与 图像大小与 图像大小`matplotlib.pyplot.imshow`这是第二课的光谱.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## 进一步阅读

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)样本定理背后的论文.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm)免费的法典DSP教科书.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html)实用程序.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff)为什么现实世界音频不是一个清洁的阴影.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)频率桶直觉在10分钟内清除了.
