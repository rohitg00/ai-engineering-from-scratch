# 神经音频编解码器——EnCodec、SNAC、Mimi、DAC 与语义-声学分拆

> 2026 年的音频生成几乎全部基于 token。EnCodec、SNAC、Mimi 和 DAC 将连续波形转化为 Transformer 可以预测的离散序列。语义 vs 声学 token 的分拆——第一个码本作为语义，其余作为声学——是自 Transformer 应用于音频以来最重要的架构转变。

**类型：** 学习
**语言：** Python
**前置知识：** 阶段 6 · 02（频谱图），阶段 10 · 11（量化），阶段 5 · 19（子词分词）
**时间：** ~60 分钟

## 问题

语言模型在离散 token 上工作。音频是连续的。如果你想为语音/音乐构建 LLM 风格的模型——MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus——你首先需要**神经音频编解码器**：一个学习型编码器，将音频离散化为一个小词汇表的 token，以及一个匹配的解码器来重建波形。

两个家族已经出现：

1. **重建优先的编解码器**——EnCodec、DAC。优化感知音频质量。Token 是"声学的"——它们捕捉一切，包括说话者身份、音色、背景噪音。
2. **语义优先的编解码器**——Mimi（Kyutai）、SpeechTokenizer。强制第一个码本编码语言/音韵内容（通常通过从 WavLM 蒸馏）。后续码本为声学细节。

2024-2026 年的洞见是：**纯重建编解码器在尝试从文本生成时会产生模糊的语音。** 基于编解码器 token 的 LLM 必须在同一个码本中同时学习语言结构和声学结构，这无法规模化。将它们分离——语义码本 0，声学码本 1-N——正是 Moshi 和 Sesame CSM 能够工作的原因。

## 概念

![四种编解码器概览：EnCodec、DAC、SNAC（多尺度）、Mimi（语义+声学）](../assets/codec-comparison.svg)

### 核心技巧：残差向量量化（RVQ）

所有现代音频编解码器不使用一个大的码本（那样需要数百万个码才能达到良好质量），而是使用 **RVQ**：一系列小码本的级联。第一个码本量化编码器输出；第二个量化残差；依此类推。每个码本有 1024 个码。8 个码本 = 有效词汇表大小为 1024^8 = 10^24。

推理时，解码器对每帧将所有选中的码求和进行重建。

### 2026 年重要的四种编解码器

**EnCodec（Meta，2022）。** 基线。波形上的编码器-解码器，RVQ 瓶颈。24 kHz，最多 32 个码本，默认 4 个码本 @ 1.5 kbps。使用 `1D conv + transformer + 1D conv` 架构。MusicGen 使用此方案。

**DAC（Descript，2023）。** 带 L2 归一化码本、周期激活函数和改进损失的 RVQ。任何开源编解码器中重建保真度最高——12 个码本时有时与原始语音无法区分。44.1 kHz 全频带。

**SNAC（Hubert Siuzdak，2024）。** 多尺度 RVQ——粗略码本以比精细码本更低的帧率运行。有效层次化建模音频：约 12 Hz 的粗略"草图"加上 50 Hz 的细节。Orpheus-3B 使用此方案，因为层次结构很好地映射到基于 LM 的生成上。

**Mimi（Kyutai，2024）。** 2026 年的游戏规则改变者。12.5 Hz 帧率（极低），8 个码本 @ 4.4 kbps。码本 0 **从 WavLM 蒸馏**——训练以预测 WavLM 的语音内容特征。码本 1-7 是声学残差。这种分拆支撑了 Moshi（第 15 课）和 Sesame CSM。

### 帧率对语言建模至关重要

更低的帧率 = 更短的序列 = 更快的 LM。

| 编解码器 | 帧率 | 1 秒 = N 帧 | 适用 |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | 音乐、通用音频 |
| DAC-44.1k | 86 Hz | 86 | 高保真音乐 |
| SNAC-24k（粗略） | ~12 Hz | 12 | AR-LM 高效 |
| Mimi | 12.5 Hz | 12.5 | 流式语音 |

在 12.5 Hz 下，10 秒的话语只有 125 个编解码器帧——Transformer 可以轻松预测它们。

### 语义 vs 声学 token

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **语义 token（Mimi 中的码本 0）。** 编码说了什么——音素、词、内容。通过辅助预测损失从 WavLM 蒸馏。
- **声学 token（码本 1-7）。** 编码音色、说话者身份、韵律、背景噪音、精细细节。

AR LM 首先预测语义 token（以文本为条件），然后预测声学 token（以语义 + 说话者参考为条件）。这种分解是现代 TTS 能够零样本克隆语音的原因：语义模型处理内容；声学模型处理音色。

### 2026 年重建质量（每秒比特数，比特率越低越好）

| 编解码器 | 比特率 | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

像 Opus 这样的传统编解码器在每比特感知质量上仍然胜出。神经编解码器胜在**离散 token**（Opus 不产生）和**生成模型质量**（LM 可以用这些 token 做什么）。

## 动手实现

### 第 1 步：使用 EnCodec 编码

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

6 kbps 时 `n_codebooks=8`。每个码是 0-1023（10 位）。

### 第 2 步：解码并测量重建质量

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 第 3 步：语义-声学分拆（Mimi 风格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义码本 0 与 WavLM 对齐。你可以训练一个文本到语义的 Transformer——词汇表比直接到音频小得多。然后一个单独的声学到波形解码器以说话者参考为条件。

### 第 4 步：为什么基于编解码器 token 的 AR LM 能工作

对于 Mimi 的 12.5 Hz × 8 码本的 10 秒语音片段：

```
N_tokens = 10 * 12.5 * 8 = 1000 个 token
```

1000 个 token 对 Transformer 来说是微不足道的上下文。一个 2.56 亿参数的 Transformer 可以在现代 GPU 上毫秒级生成 10 秒语音。

## 使用建议

问题 → 编解码器映射：

| 任务 | 编解码器 |
|------|-------|
| 通用音乐生成 | EnCodec-24k |
| 最高保真重建 | DAC-44.1k |
| 基于 AR LM 的语音（TTS） | SNAC 或 Mimi |
| 流式全双工语音 | Mimi（12.5 Hz） |
| 带文本的音效库 | EnCodec + T5 条件 |
| 精细音频编辑 | DAC + 修补 |

经验法则：**如果你在构建生成模型，从 Mimi 或 SNAC 开始。如果你在构建压缩流水线，使用 Opus。**

## 常见陷阱

- **太多码本。** 增加码本线性提高保真度，但也线性增加 LM 序列长度。最多 8-12 个。
- **帧率不匹配。** 在 12.5 Hz Mimi 上训练 LM，然后在 50 Hz EnCodec 上微调会静默失败。
- **假设所有码本相等。** 在 Mimi 中，码本 0 承载内容；丢失它会破坏可懂度。丢失码本 7 几乎注意不到。
- **仅用重建质量作为唯一指标。** 编解码器可以有很好的重建质量，但如果语义结构差，对基于 LM 的生成是无用的。

## 交付物

保存为 `outputs/skill-codec-picker.md`。针对给定的生成或压缩任务选择编解码器。

## 练习

1. **简单。** 运行 `code/main.py`。它实现了一个玩具标量 + 残差量化器，并测量随着添加码本时重建误差的变化。
2. **中等。** 安装 `encodec`，在留出的语音片段上比较 1、4、8、32 个码本。绘制 PESQ 或 MSE 与比特率的关系图。
3. **困难。** 加载 Mimi。编码一个片段。将码本 0 替换为随机整数；解码。然后类似地替换码本 7。比较两种损坏——码本 0 损坏应破坏可懂度；码本 7 损坏应几乎没有变化。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| RVQ | 残差量化 | 小码本的级联；每个量化前一个的残差。 |
| Frame rate（帧率） | 编解码器速度 | 每秒多少 token 帧。越低 = LM 越快。 |
| Semantic codebook（语义码本） | 码本 0（Mimi） | 从 SSL 特征蒸馏的码本；编码内容。 |
| Acoustic codebooks（声学码本） | 其他所有 | 音色、韵律、噪音、精细细节。 |
| PESQ / ViSQOL | 感知质量 | 与 MOS 相关的客观指标。 |
| EnCodec | Meta 编解码器 | RVQ 基线；MusicGen 使用。 |
| Mimi | Kyutai 编解码器 | 12.5 Hz 帧率；语义-声学分拆；支撑 Moshi。 |

## 延伸阅读

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438)——RVQ 基线。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546)——最高保真开源方案。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411)——多尺度 RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer)——语义-声学分拆，WavLM 蒸馏。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143)——两阶段语义/声学范式。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312)——原始可流式 RVQ 编解码器。
