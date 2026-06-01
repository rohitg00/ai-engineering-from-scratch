# 13 · 神经音频编解码器——EnCodec、SNAC、Mimi、DAC 以及语义-声学分离

> 2026 年的音频生成几乎全部基于 token。EnCodec、SNAC、Mimi 和 DAC 把连续波形转换成 Transformer 可以预测的离散序列。语义 token 与声学 token 的分离——把第一个码本作为语义、其余作为声学——是继 Transformer 之后音频领域最重要的架构变革。

**类型：** 学习
**语言：** Python
**前置：** 阶段 6 · 02（频谱图）、阶段 10 · 11（量化）、阶段 5 · 19（子词分词）
**时长：** 约 60 分钟

## 问题所在

语言模型处理的是离散 token，而音频是连续的。如果你想为语音/音乐构建一个类 LLM 的模型——MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus——你首先需要一个**神经音频编解码器（neural audio codec）**：一个学习得到的编码器，把音频离散化为一个小词表的 token；以及一个配套的解码器，把波形重建出来。

目前出现了两大流派：

1. **重建优先编解码器（reconstruction-first codecs）**——EnCodec、DAC。优化感知音质。其 token 是「声学的」——它们捕获一切，包括说话人身份、音色、背景噪声。
2. **语义优先编解码器（semantic-first codecs）**——Mimi（Kyutai）、SpeechTokenizer。强制第一个码本编码语言/音素内容（通常通过从 WavLM 蒸馏得到）。后续码本则是声学细节。

2024-2026 年的洞见是：**纯重建编解码器在你尝试从文本生成时会给你模糊的语音。** 在编解码器 token 之上的 LLM 必须在同一个码本里同时学习语言结构和声学结构，这种方式无法扩展。把二者分开——语义码本 0、声学码本 1-N——正是让 Moshi 和 Sesame CSM 能跑通的原因。

## 核心概念

〔图：四种编解码器全景——EnCodec、DAC、SNAC（多尺度）、Mimi（语义+声学）〕

### 核心技巧：残差向量量化（Residual Vector Quantization, RVQ）

现代音频编解码器并不使用单个大码本（要达到好的质量需要数百万个码），而是全部采用 **RVQ**：一连串小码本的级联。第一个码本量化编码器输出；第二个量化残差；以此类推。每个码本有 1024 个码。8 个码本 = 等效词表大小 1024^8 = 10^24。

在推理时，解码器把每帧选中的所有码相加，从而完成重建。

### 2026 年最重要的四种编解码器

**EnCodec（Meta，2022）。** 基线方案。在波形上做编码器-解码器，带 RVQ 瓶颈。24 kHz，最多可用 32 个码本，默认 4 个码本 @ 1.5 kbps。采用 `1D conv + transformer + 1D conv` 架构。被 MusicGen 使用。

**DAC（Descript，2023）。** 带 L2 归一化码本、周期性激活函数和改进损失函数的 RVQ。在所有开源编解码器中重建保真度最高——用 12 个码本时有时与原始语音难以区分。44.1 kHz 全频带。

**SNAC（Hubert Siuzdak，2024）。** 多尺度 RVQ——粗码本以比细码本更低的帧率运行。本质上对音频做层级建模：约 12 Hz 的粗「草图」加上 50 Hz 的细节。被 Orpheus-3B 使用，因为其层级结构与基于 LM 的生成很好地对应。

**Mimi（Kyutai，2024）。** 2026 年的颠覆者。12.5 Hz 帧率（极低），8 个码本 @ 4.4 kbps。码本 0 是**从 WavLM 蒸馏**得到的——经过训练来预测 WavLM 的语音内容特征。码本 1-7 是声学残差。这一分离驱动了 Moshi（第 15 课）和 Sesame CSM。

### 帧率对语言建模至关重要

帧率越低 = 序列越短 = LM 越快。

| 编解码器 | 帧率 | 1 秒 = N 帧 | 适用于 |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | 音乐、通用音频 |
| DAC-44.1k | 86 Hz | 86 | 高保真音乐 |
| SNAC-24k（粗） | ~12 Hz | 12 | AR-LM 高效 |
| Mimi | 12.5 Hz | 12.5 | 流式语音 |

在 12.5 Hz 下，一段 10 秒的话语只有 125 个编解码器帧——Transformer 可以轻松预测它们。

### 语义 token 与声学 token

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **语义 token（Mimi 中的码本 0）。** 编码说了什么——音素、词、内容。通过辅助预测损失从 WavLM 蒸馏而来。
- **声学 token（码本 1-7）。** 编码音色、说话人身份、韵律、背景噪声、细节。

一个自回归（AR）LM 先预测语义 token（以文本为条件），然后预测声学 token（以语义 + 说话人参考为条件）。这种分解正是现代 TTS 能够零样本克隆嗓音的原因：语义模型负责内容，声学模型负责音色。

### 2026 年重建质量（比特每秒，码率越低越好）

| 编解码器 | 码率 | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

像 Opus 这样的传统编解码器在单位比特的感知质量上仍然占优。神经编解码器的优势在于**离散 token**（Opus 并不产生 token）和**生成模型质量**（即 LM 能用这些 token 做什么）。

## 动手构建

### 步骤 1：用 EnCodec 编码

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

在 6 kbps 时 `n_codebooks=8`。每个码取值 0-1023（10 比特）。

### 步骤 2：解码并测量重建质量

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 步骤 3：语义-声学分离（Mimi 风格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义码本 0 与 WavLM 对齐。你可以训练一个文本到语义的 Transformer——其词表比直接到音频要小得多。然后用一个单独的声学到波形解码器，以说话人参考为条件。

### 步骤 4：为什么在编解码器 token 上做 AR LM 行得通

对于一段 10 秒、采用 Mimi 的 12.5 Hz × 8 码本的语音片段：

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 个 token 对 Transformer 来说是微不足道的上下文。一个 256M 参数的 Transformer 在现代 GPU 上可以在毫秒级生成 10 秒语音。

## 实际运用

把问题映射到编解码器：

| 任务 | 编解码器 |
|------|-------|
| 通用音乐生成 | EnCodec-24k |
| 最高保真度重建 | DAC-44.1k |
| 语音上的 AR LM（TTS） | SNAC 或 Mimi |
| 流式全双工语音 | Mimi（12.5 Hz） |
| 带文本的音效库 | EnCodec + T5 条件 |
| 细粒度音频编辑 | DAC + 修补（inpainting） |

经验法则：**如果你在构建生成模型，从 Mimi 或 SNAC 开始。如果你在构建压缩管线，用 Opus。**

## 易踩的坑

- **码本过多。** 增加码本会线性提升保真度，但也会线性增加 LM 序列长度。在 8-12 个时打住。
- **帧率不匹配。** 在 12.5 Hz 的 Mimi 上训练 LM，然后在 50 Hz 的 EnCodec 上微调，会无声地失败。
- **假设所有码本同等重要。** 在 Mimi 中，码本 0 承载内容；丢失它会摧毁可懂度。丢失码本 7 几乎无法察觉。
- **只用重建质量作为唯一指标。** 一个编解码器可能重建效果很好，但如果语义结构很差，它对基于 LM 的生成毫无用处。

## 交付物

保存为 `outputs/skill-codec-picker.md`。为给定的生成或压缩任务挑选一个编解码器。

## 练习

1. **简单。** 运行 `code/main.py`。它实现了一个玩具级标量 + 残差量化器，并在你逐步增加码本时测量重建误差。
2. **中等。** 安装 `encodec`，在一段留出的语音片段上比较 1、4、8、32 个码本。绘制 PESQ 或 MSE 相对码率的曲线。
3. **困难。** 加载 Mimi。编码一段片段。把码本 0 替换为随机整数；解码。然后同样替换码本 7。比较这两种破坏——码本 0 的破坏应当摧毁可懂度；码本 7 的破坏应当几乎不改变任何东西。

## 关键术语

| 术语 | 人们的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| RVQ | 残差量化 | 小码本的级联；每个码本量化前一个的残差。 |
| 帧率 | 编解码器速度 | 每秒多少个 token 帧。越低 = LM 越快。 |
| 语义码本 | 码本 0（Mimi） | 从自监督（SSL）特征蒸馏的码本；编码内容。 |
| 声学码本 | 其余所有 | 音色、韵律、噪声、细节。 |
| PESQ / ViSQOL | 感知质量 | 与 MOS 相关的客观指标。 |
| EnCodec | Meta 编解码器 | RVQ 基线；被 MusicGen 使用。 |
| Mimi | Kyutai 编解码器 | 12.5 Hz 帧率；语义-声学分离；驱动 Moshi。 |

## 延伸阅读

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) —— RVQ 基线。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) —— 保真度最高的开源方案。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) —— 多尺度 RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) —— 语义-声学分离、WavLM 蒸馏。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) —— 两阶段语义/声学范式。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) —— 最初的可流式 RVQ 编解码器。
