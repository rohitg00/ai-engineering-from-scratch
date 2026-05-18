# 神经音频编解码器- EnCodec、SNAC、Mimi、ADC和语义声学分离

> 2026年的音频生成几乎都是令牌。EnCodec、SNAC、Mimi和ADC将连续的波型转换为Transformer可以预测的离散序列。语义与声学标记的分离--首先码本为语义，其余为声学--是自音频Transformer以来最重要的架构转变。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段6 · 02（光谱图）、阶段10 · 11（量化）、阶段5 · 19（子字令牌化）
** 时间：** ~60分钟

## 问题

语言模型在离散的标记上工作。音频连续。如果你想要一个LLM风格的语音/音乐模型- MusicGen，Moshi，Sesame CSM，VibeVoice，Orpheus -你首先需要一个 ** 神经音频编解码器 **：一个学习的编码器，将音频离散化为一个小词汇表的令牌，以及一个匹配的解码器，重建波形。

出现了两个家庭：

1. ** 重建优先编解码器 ** - EnCodec，ADC。优化感知音频质量。代币是“声学的”--它们捕捉一切，包括说话者身份、音色、背景噪音。
2. ** 语义优先编解码器 ** - Mimi（Kyutai），SpeechTokenizer。强制第一个码本对语言/语音内容进行编码（通常通过从WavLM中提取）。随后的代码本是声学细节。

2024-2026年洞察：** 当您尝试从文本生成时，纯重建编解码器会为您提供模糊的语音。**编解码器令牌上的LLM必须学习同一码本中的语言结构和声学结构，该码本不可缩放。将它们分开--语义码本0，声学码本1-N --是Moshi和Sesame CSM发挥作用的原因。

## 概念

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### 核心技巧：残留量量化（RVQ）

所有现代音频编解码器都使用 **RVQ**：一系列小码本，而不是一个大码本（这需要数百万个代码才能获得良好的质量）。第一个码本量化编码器输出;第二个码本量化残余;等等。每个码本是1024个代码。8个码本=有效词汇量1024#8 = 1024。

在推理时，解码器将每帧所有选择的代码相加以进行重建。

### 2026年重要的四种编解码器

**EnCodec（Meta，2022）。**基线。编码器-解码器在波形上，RVQ瓶颈。24 GHz，可能有32个码本，默认4个码本@1.5 kMbps。采用“1D conv + Transformer + 1D conv”架构。由MusicGen使用。

** DA（描述，2023年）。** RVQ具有L2规范化码本、定期激活功能、改善损失。任何开放编解码器中的最高重建保真度-有时与具有12个码本的原始语音无法区分。44.1千赫兹全频段。

**SNAC（Hubert Siuzdak，2024）.**多尺度RVQ -粗略码本以比精细码本更低的帧速率操作。有效地分层建模音频：大约12 Hz的粗略“草图”加上50 Hz的细节。被Orpheus-3B使用，因为层次结构很好地映射到基于LM的生成。

**Mimi（Kyutai，2024）。** 2026年游戏规则改变者。12.5 Hz帧率（极低），8个码本@4.4 kps。Codebook 0是从WavLM** 中提炼出来的，经过训练以预测WavLM的语音内容特征。码本1-7是声学残留。这种分裂为Moshi（第15课）和Sesame CSM提供了动力。

### 帧率对于语言建模很重要

更低的帧速率=更短的序列=更快的LM。

| 编解码 | 帧速率 | 1 s = N帧 | 有利于 |
|-------|-----------|----------------|---------|
| EnCodec-24 k | 75 Hz | 75 | 音乐、一般音频 |
| DAC-44.1k | 86赫兹 | 86 | 高保真音乐 |
| SNAC-24 k（粗） | ~12赫兹 | 12 | AR-LM高效 |
| 咪咪 | 12.5 Hz | 12.5 | 流语音 |

在12.5 Hz下，10秒的话语只有125个编解码器帧-Transformer可以轻松预测它们。

### 语义标记与声学标记

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- ** 语义标记（Mimi中的码本0）。**编码所说的内容-音素、单词、内容。通过辅助预测损失从WavLM中提取。
- ** 声学令牌（码本1-7）。**编码音色、扬声器身份、韵律、背景噪音、精细细节。

AR LM首先预测语义标记（以文本为条件），然后预测声学标记（以语义+说话者引用为条件）。这种因子分解就是现代TTC可以零镜头克隆声音的原因：语义模型处理内容;声学模型处理音色。

### 2026重建质量（每秒比特数，比特率越低越好）

| 编解码 | 比特率 | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20 kMbps | 20 kps | 4.0 | 4.3 |
| EnCodec-6 kMbps | 6 kps | 3.2 | 3.8 |
| 数字转换器-6 kMbps | 6 kps | 3.5 | 4.0 |
| SNAC-3kMbps | 3 kMbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Opus等传统编解码器仍然在感知质量上获胜。神经编解码器在 ** 离散令牌 **（Opus不产生这些令牌）和 ** 生成模型质量 **（LM可以用这些令牌做什么）上获胜。

## 建设党

### 第1步：使用EnCodec编码

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

' n_Codebooks=8 '，速度为6 kps。每个代码为0-1023（10位）。

### 第2步：解码和测量重建

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 第3步：语义-声学分离（Mimi风格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义码本0是WavLM对齐的。你可以训练一个文本到语义的Transformer --比直接到音频的词汇量小得多。然后，单独的声到波解码器对扬声器基准进行条件处理。

### 第4步：为什么AR LM在编解码器令牌上有效

对于Mimi的12.5 Hz x 8码本上的10秒演讲片段：

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 对于Transformer来说，令牌是一个微不足道的上下文。256 M参数Transformer可以在现代图形处理器上以毫秒为单位生成10秒的语音。

## 使用它

映射问题→编解码器：

| 任务 | 编解码 |
|------|-------|
| 一般音乐一代 | EnCodec-24 k |
| 最高保真重建 | DAC-44.1k |
| 语音AR LM（TTC） | SNAC或Mimi |
| 流传输全速语音 | Mimi（12.5 Hz） |
| 带文字的音效库 | EnCodec + T5条件 |
| 细粒度音频编辑 | DAC +修复 |

经验法则：** 如果您正在构建生成模型，请从Mimi或SNAC开始。如果您正在构建压缩管道，请使用Opus。**

## 陷阱

- ** 代码本太多。**添加码本线性增加保真度，但LM序列长度也线性增加。停在8-12。
- ** 帧率不匹配。**在12.5 Hz Mimi上训练LM，然后在50 Hz EnCodec上微调，悄然失败。
- ** 假设所有码本相等。**在Mimi中，码本0携带内容;丢失它会破坏可理解性。丢失码本7几乎不引人注目。
- ** 使用重建质量作为唯一度量。**一个编解码器可以有很大的重建，但无用的LM为基础的生成，如果语义结构是坏的。

## 把它运

另存为“输出/skill-codec-picker.md”。为给定的生成或压缩任务选择编解码器。

## 演习

1. ** 简单。**运行'代码/main.py '。它实现了一个玩具标量+残差量化器，并在添加码本时测量重构误差。
2. ** 中等。**安装“encodec”并比较取出的语音剪辑上的1、4、8、32个代码本。绘制PESJ或SSE与比特率的关系。
3. ** 很难。**装咪咪编码剪辑。用随机整数替换码本0;解码。然后以类似方式替换码本7。比较这两种损坏-码本0损坏应该会破坏可理解性;码本7损坏应该几乎改变任何事情。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| RVQ | 残余量化 | 小代码本的级联;每个代码本量化之前的剩余值。 |
| 帧速率 | 编解码器速度 | 每秒有多少个令牌帧。更低=更快的LM。 |
| 语义码本 | 代码簿0（Mimi） | 代码本从SSL功能中提炼出来;对内容进行编码。 |
| 声学密码本 | 其他一切 | 音色，韵律，噪音，细节。 |
| PESK/ ViSQOL | 感知质量 | 与MOS相关的客观指标。 |
| EnCodec | Meta编解码器 | RVQ基线;由MusicGen使用。 |
| 咪咪 | Kyutai编解码器 | 12.5 Hz帧率;语义声学分离;为Moshi提供动力。 |

## 进一步阅读

- [Défossez等人（2023）。EnCodec]（https：//arxiv.org/abs/2210.13438）-RVQ基线。
- [库马尔等人（2023）。描述音频编解码器（DA）]（https：//arxiv.org/ab/2306.06546）-最高保真打开。
- [Siuzdak（2024）。SNAC]（https：//arxiv.org/abs/2410.14411）-多规模RVQ。
- [Kyutai（2024）。Mimi编解码器]（https：//kyutai.org/Codec-explainer）-语义声学拆分，WavLM蒸馏。
- [Borsos等人（2023）。AudioLM]（https：//arxiv.org/abs/2209.03143）-两阶段语义/声学范例。
- [Zeghidour等人（2021）。SoundStream]（https：//arxiv.org/abs/2107.03312）-原始的可流RVQ编解码器。
