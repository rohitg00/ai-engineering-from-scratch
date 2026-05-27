# 神经音频编解码器 — EnCodec、SNAC、Mimi、DAC 与语义-声学拆分

> 2026年的音频生成几乎完全基于 Token。EnCodec、SNAC、Mimi 和 DAC 将连续的波形转化为离散序列，供 Transformer 预测。语义（Semantic）与声学（Acoustic）Token 的拆分——第一个码本作为语义，其余作为声学——是自 Transformer 以来最重要的音频架构变革。

**类型：** 学习  
**语言：** Python  
**前置知识：** 阶段6·02（语谱图）、阶段10·11（量化）、阶段5·19（子词分词）  
**时长：** 约60分钟

## 问题

语言模型基于离散的 Token 工作，而音频是连续的。如果你想要一个用于语音/音乐的 LLM 风格模型——如 MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus——你首先需要一个**神经音频编解码器（Neural Audio Codec）**：一个可学习的编码器，将音频离散化为一个小词汇表的 Token，以及一个匹配的解码器来重建波形。

目前出现了两类编解码器：

1. **重建优先编解码器**——EnCodec、DAC。优化感知音频质量。Token 是“声学的”——它们捕获所有信息，包括说话人身份、音色、背景噪声。
2. **语义优先编解码器**——Mimi（Kyutai）、SpeechTokenizer。强制第一个码本编码语言/语音内容（通常通过从 WavLM 蒸馏得到）。后续码本为声学细节。

2024-2026年的洞察：**纯重建编解码器在从文本生成时会产生模糊的语音。** 覆盖编解码器 Token 的 LLM 必须在同一个码本中同时学习语言结构和声学结构，这无法扩展。将两者分开——语义码本 0，声学码本 1-N——正是 Moshi 和 Sesame CSM 成功的原因。

## 概念

![四种编码器对比：EnCodec、DAC、SNAC（多尺度）、Mimi（语义+声学）](../assets/codec-comparison.svg)

### 核心技巧：残差向量量化（Residual Vector Quantization, RVQ）

现代音频编解码器不使用单个大型码本（为了高质量需要数百万个码字），而是采用**RVQ**：一系列小型码本的级联。第一个码本量化编码器的输出；第二个量化残差；以此类推。每个码本有 1024 个码字。8 个码本意味着有效词汇量为 1024^8 = 10^24。

在推理时，解码器将每帧选出的所有码字求和以重建信号。

### 2026年四种重要的编解码器

**EnCodec（Meta, 2022）。** 基线模型。基于波形的编码器-解码器结构，RVQ 瓶颈。支持 24 kHz，最多 32 个码本，默认 4 个码本 @ 1.5 kbps。使用 `1D卷积 + Transformer + 1D卷积` 架构。被 MusicGen 使用。

**DAC（Descript, 2023）。** 采用 L2 归一化码本、周期激活函数和改进的损失函数的 RVQ。在开源编解码器中重建保真度最高——使用 12 个码本时有时与原语音难以区分。支持 44.1 kHz 全频段。

**SNAC（Hubert Siuzdak, 2024）。** 多尺度 RVQ——粗糙码本以比精细码本更低的帧率运行。有效实现层次化音频建模：约 12 Hz 的粗略“草图”加上 50 Hz 的细节。被 Orpheus-3B 使用，因为其层次化结构能很好地映射到基于 LM 的生成。

**Mimi（Kyutai, 2024）。** 2026年的颠覆性创新。帧率 12.5 Hz（极低），8 个码本 @ 4.4 kbps。码本 0 **从 WavLM 蒸馏**——训练用于预测 WavLM 的语音内容特征。码本 1-7 为声学残差。这种拆分支撑了 Moshi（第15课）和 Sesame CSM。

### 帧率对语言建模的影响

帧率越低 = 序列越短 = 语言模型越快。

| 编解码器 | 帧率    | 1秒 = N帧 | 适用场景             |
| --------- | ------- | --------- | -------------------- |
| EnCodec-24k | 75 Hz   | 75        | 音乐、通用音频       |
| DAC-44.1k   | 86 Hz   | 86        | 高保真音乐           |
| SNAC-24k (粗糙) | ~12 Hz | 12        | 自回归LM高效性        |
| Mimi        | 12.5 Hz | 12.5      | 流式语音             |

在 12.5 Hz 下，10 秒的语音只有 125 个编解码器帧——Transformer 可以轻松预测。

### 语义 Token 与声学 Token

```
第 t 帧 → [语义_token_t, 声学_token_0_t, 声学_token_1_t, ..., 声学_token_6_t]
```

- **语义 Token（Mimi 中的码本 0）。** 编码所说的内容——音素、单词、语义。通过辅助预测损失从 WavLM 蒸馏得到。
- **声学 Token（码本 1-7）。** 编码音色、说话人身份、韵律、背景噪声、精细细节。

自回归 LM 先预测语义 Token（以文本为条件），然后预测声学 Token（以语义和说话人参考为条件）。这种分解是现代 TTS 能够零样本克隆声音的原因：语义模型处理内容；声学模型处理音色。

### 2026年重建质量（每秒比特数，低比特率更好）

| 编解码器    | 比特率  | PESQ | ViSQOL |
| ----------- | ------- | ---- | ------ |
| Opus-20kbps | 20 kbps | 4.0  | 4.3    |
| EnCodec-6kbps | 6 kbps | 3.2  | 3.8    |
| DAC-6kbps   | 6 kbps  | 3.5  | 4.0    |
| SNAC-3kbps  | 3 kbps  | 3.3  | 3.8    |
| Mimi-4.4kbps | 4.4 kbps | 3.1  | 3.7    |

传统的 Opus 等编解码器在每比特感知质量上仍然胜出。神经编解码器在**离散 Token**（Opus 不产生）和**生成模型质量**（LM 可以用这些 Token 做什么）上获胜。

## 动手实践

### 步骤1：使用 EnCodec 编码

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

在 6 kbps 下 `n_codebooks=8`。每个码字为 0-1023（10 位）。

### 步骤2：解码并测量重建质量

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 步骤3：语义-声学拆分（Mimi 风格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义码本 0 与 WavLM 对齐。你可以训练一个文本到语义 Transformer——词汇量比直接到音频小得多。然后一个独立的声学到波形解码器以说话人参考为条件。

### 步骤4：为什么自回归 LM 在编解码器 Token 上有效

对于 10 秒的语音片段，Mimi 的 12.5 Hz × 8 个码本：

```
N_tokens = 10 * 12.5 * 8 = 1000 个 token
```

1000 个 token 对 Transformer 来说是微不足道的上下文。一个 256M 参数的 Transformer 可以在现代 GPU 上毫秒级生成 10 秒的语音。

## 使用场景

将任务映射到编解码器：

| 任务                       | 编解码器      |
| -------------------------- | ------------- |
| 通用音乐生成               | EnCodec-24k   |
| 最高保真度重建             | DAC-44.1k     |
| 语音自回归 LM（TTS）       | SNAC 或 Mimi  |
| 流式全双工语音             | Mimi (12.5 Hz)|
| 带文本的音效库             | EnCodec + T5 条件 |
| 精细音频编辑               | DAC + 修补    |

经验法则：**如果你在构建生成模型，从 Mimi 或 SNAC 开始。如果你在构建压缩管道，使用 Opus。**

## 陷阱

- **码本过多。** 增加码本线性提高保真度，但也线性增加 LM 序列长度。控制在 8-12 个。
- **帧率不匹配。** 在 12.5 Hz 的 Mimi 上训练 LM，然后微调 50 Hz 的 EnCodec，会静默失败。
- **假设所有码本同等重要。** 在 Mimi 中，码本 0 携带内容；丢失它会破坏可懂度。丢失码本 7 几乎看不出。
- **仅用重建质量作为唯一指标。** 一个编解码器的重建可能很好，但如果语义结构糟糕，则对基于 LM 的生成毫无用处。

## 交付

保存为 `outputs/skill-codec-picker.md`。为给定的生成或压缩任务选择一个编解码器。

## 练习

1. **简单。** 运行 `code/main.py`。它实现了一个玩具标量 + 残差量化器，并测量添加码本时的重建误差。
2. **中等。** 安装 `encodec`，并在一个留出的语音片段上比较 1、4、8、32 个码本。绘制 PESQ 或 MSE 与比特率的关系图。
3. **困难。** 加载 Mimi。编码一个片段。将码本 0 替换为随机整数并解码。然后类似地替换码本 7。比较两种破坏——码本 0 破坏应摧毁可懂度；码本 7 破坏应几乎不改变任何东西。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| RVQ | 残差量化 | 小型码本级联；每个量化前一个的残差。 |
| 帧率 | 编解码器速度 | 每秒多少个 Token 帧。越低= LM 越快。 |
| 语义码本 | 码本 0（Mimi） | 从自监督学习特征中蒸馏得到的码本；编码内容。 |
| 声学码本 | 其他所有码本 | 音色、韵律、噪声、精细细节。 |
| PESQ / ViSQOL | 感知质量 | 与平均意见分（MOS）相关的客观指标。 |
| EnCodec | Meta 编解码器 | RVQ 基线；被 MusicGen 使用。 |
| Mimi | Kyutai 编解码器 | 12.5 Hz 帧率；语义-声学拆分；支撑 Moshi。 |

## 延伸阅读

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) — RVQ 基线。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) — 最高保真度开源。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) — 多尺度 RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) — 语义-声学拆分，WavLM 蒸馏。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) — 两阶段语义/声学范式。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 原始可流式 RVQ 编解码器。