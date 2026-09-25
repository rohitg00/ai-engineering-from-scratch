# 神经音频编解码器 — EnCodec、SNAC、Mimi、DAC 与语义-声学分离

> 2026 年的音频生成几乎全部基于 token。EnCodec、SNAC、Mimi 和 DAC 将连续波形转换为 transformer 可以预测的离散序列。语义 token 与声学 token 的分离——首个 codebook 承载语义，其余承载声学——是音频领域自 Transformer 以来最重要的架构变革。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 02（频谱图）、Phase 10 · 11（量化）、Phase 5 · 19（子词分词）
**Time:** 约 60 分钟

## 问题所在

语言模型处理的是离散 token，而音频是连续的。如果你想要一个 LLM 风格的语音/音乐模型——MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus——你首先需要一个**神经音频编解码器**：一个学习得到的编码器，将音频离散化为小词表的 token，以及一个匹配的解码器来重建波形。

出现了两大流派：

1. **重建优先的编解码器** — EnCodec、DAC。优化感知音频质量。token 是“声学的”——它们捕捉一切，包括说话人身份、音色、背景噪声。
2. **语义优先的编解码器** — Mimi（Kyutai）、SpeechTokenizer。强制第一个 codebook 编码语言学/语音学内容（通常通过从 WavLM 蒸馏）。后续的 codebook 则是声学细节。

2024–2026 年的洞见是：**纯重建编解码器在你尝试从文本生成时会产生模糊的语音。** 基于 codec token 的 LLM 必须在同一个 codebook 中同时学习语言结构和声学结构，这无法扩展。将它们分离——语义 codebook 0，声学 codebook 1-N——正是 Moshi 和 Sesame CSM 得以工作的关键。

## 核心概念

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### 关键技巧：残差向量量化（RVQ）

与其使用一个巨大的 codebook（要获得高质量需要数百万个码字），所有现代音频编解码器都使用 **RVQ**：一串小型 codebook 的级联。第一个 codebook 对编码器输出进行量化；第二个对残差进行量化；以此类推。每个 codebook 有 1024 个码字。8 个 codebook = 有效词表大小为 1024^8 = 10^24。

在推理时，解码器将每帧选中的所有码字求和以进行重建。

### 2026 年举足轻重的四个编解码器

**EnCodec（Meta，2022）。** 基线模型。基于波形的编码器-解码器，RVQ 瓶颈。24 kHz，最多 32 个 codebook，默认 4 个 codebook @ 1.5 kbps。采用 `1D conv + transformer + 1D conv` 架构。被 MusicGen 使用。

**DAC（Descript，2023）。** 带 L2 归一化 codebook 的 RVQ，周期激活函数，改进的损失函数。在所有开源编解码器中重建保真度最高——使用 12 个 codebook 时有时与原始语音难以区分。44.1 kHz 全频带。

**SNAC（Hubert Siuzdak，2024）。** 多尺度 RVQ——粗粒度 codebook 以比细粒度 codebook 更低的帧率运行。实际上以层次化方式建模音频：约 12 Hz 的粗略“草图”加上 50 Hz 的细节。被 Orpheus-3B 使用，因为其层次化结构非常契合基于 LM 的生成。

**Mimi（Kyutai，2024）。** 2026 年的游戏规则改变者。12.5 Hz 帧率（极低），8 个 codebook @ 4.4 kbps。Codebook 0 **从 WavLM 蒸馏而来**——训练用于预测 WavLM 的语音内容特征。Codebook 1-7 是声学残差。这一分离支撑了 Moshi（第 15 课）和 Sesame CSM。

### 帧率对语言建模至关重要

帧率越低 = 序列越短 = LM 越快。

| 编解码器 | 帧率 | 1 秒 = N 帧 | 适用场景 |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | 音乐、通用音频 |
| DAC-44.1k | 86 Hz | 86 | 高保真音乐 |
| SNAC-24k（粗） | ~12 Hz | 12 | AR-LM 高效 |
| Mimi | 12.5 Hz | 12.5 | 流式语音 |

在 12.5 Hz 下，10 秒的话语只有 125 个 codec 帧——transformer 可以轻松预测它们。

### 语义 token 与声学 token

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **语义 token（Mimi 中的 codebook 0）。** 编码说了什么——音素、词语、内容。通过辅助预测损失从 WavLM 蒸馏而来。
- **声学 token（codebook 1-7）。** 编码音色、说话人身份、韵律、背景噪声、细节。

AR LM 先预测语义 token（以文本为条件），然后预测声学 token（以语义 + 说话人参考为条件）。这种因式分解正是现代 TTS 能够零样本克隆语音的原因：语义模型处理内容；声学模型处理音色。

### 2026 年重建质量（比特每秒，比特率越低越好）

| 编解码器 | 比特率 | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

像 Opus 这样的传统编解码器在每比特感知质量上仍然占优。神经编解码器的优势在于**离散 token**（Opus 无法生成）以及**生成模型质量**（LM 能用这些 token 做什么）。

```figure
rvq-codec-cascade
```

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

`n_codebooks=8` 在 6 kbps 下。每个码字范围是 0-1023（10 比特）。

### 第 2 步：解码并测量重建质量

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 第 3 步：语义-声学分离（Mimi 风格）

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义 codebook 0 与 WavLM 对齐。你可以训练一个文本到语义的 transformer——其词表远小于直接生成音频。然后，一个单独的声学到波形解码器以说话人参考为条件进行工作。

### 第 4 步：为什么基于 codec token 的 AR LM 有效

对于一段 10 秒的语音片段，按 Mimi 的 12.5 Hz × 8 个 codebook 计算：

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 个 token 对 transformer 来说是一个微不足道的上下文长度。一个 2.56 亿参数的 transformer 可以在现代 GPU 上于毫秒级生成 10 秒的语音。

## 实际应用

将问题映射到编解码器：

| 任务 | 编解码器 |
|------|-------|
| 通用音乐生成 | EnCodec-24k |
| 最高保真度重建 | DAC-44.1k |
| 语音上的 AR LM（TTS） | SNAC 或 Mimi |
| 流式全双工语音 | Mimi（12.5 Hz） |
| 带文本的声音效果库 | EnCodec + T5 条件 |
| 细粒度音频编辑 | DAC + inpainting |

经验法则：**如果你在构建生成模型，从 Mimi 或 SNAC 开始。如果你在构建压缩管线，使用 Opus。**

## 常见陷阱

- **Codebook 数量过多。** 增加 codebook 会线性提升保真度，但也会线性增加 LM 的序列长度。在 8-12 个处停止。
- **帧率不匹配。** 在 12.5 Hz 的 Mimi 上训练 LM，然后在 50 Hz 的 EnCodec 上微调，会静默失败。
- **假设所有 codebook 同等重要。** 在 Mimi 中，codebook 0 承载内容；丢失它会摧毁可懂度。丢失 codebook 7 几乎察觉不到。
- **将重建质量作为唯一指标。** 一个编解码器可能重建效果很好，但如果语义结构不佳，对于基于 LM 的生成就毫无用处。

## 上线交付

保存为 `outputs/skill-codec-picker.md`。为给定的生成或压缩任务选择一个编解码器。

## 练习

1. **简单。** 运行 `code/main.py`。它实现了一个玩具级的标量 + 残差量化器，并测量每增加一个 codebook 后的重建误差。
2. **中等。** 安装 `encodec`，在留出的语音片段上比较 1、4、8、32 个 codebook。绘制 PESQ 或 MSE 与比特率的关系图。
3. **困难。** 加载 Mimi。编码一段音频。用随机整数替换 codebook 0，然后解码。再用同样方式替换 codebook 7。比较两种破坏——codebook 0 的破坏应摧毁可懂度；codebook 7 的破坏几乎不会改变任何东西。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| RVQ | 残差量化 | 小型 codebook 的级联；每个对前一个残差进行量化。 |
| 帧率 | 编解码器速度 | 每秒多少个 token 帧。越低 = LM 越快。 |
| 语义 codebook | Codebook 0（Mimi） | 从 SSL 特征蒸馏而来的 codebook；编码内容。 |
| 声学 codebook | 其余所有 | 音色、韵律、噪声、细节。 |
| PESQ / ViSQOL | 感知质量 | 与 MOS 相关的客观指标。 |
| EnCodec | Meta 编解码器 | RVQ 基线；被 MusicGen 使用。 |
| Mimi | Kyutai 编解码器 | 12.5 Hz 帧率；语义-声学分离；支撑 Moshi。 |

## 延伸阅读

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) — RVQ 基线。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) — 保真度最高的开源方案。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) — 多尺度 RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) — 语义-声学分离，WavLM 蒸馏。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) — 两阶段语义/声学范式的开创者。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 最早的流式 RVQ 编解码器。