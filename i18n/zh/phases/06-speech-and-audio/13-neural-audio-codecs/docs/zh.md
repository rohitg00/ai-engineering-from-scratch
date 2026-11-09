# 神经音频代码器 EnCodec,SNAC,Mimi,DAC和语音分区

> 2026年音频生成几乎是所有代币.EnCodec,SNAC,Mimi和DAC将连续波形转化为变压器可以预测的分离序列.语义与音响代币分为语义,休息为音响,这是自变压器以来最重要的建筑转变.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## 问题

语言模型在单独的代币上工作.音频是连续的.如果你想要一个语音/音乐的LLM样式模型,首先你需要一个**neural audio codec**编码器可以将音频分为小的代币词汇,

两个家庭出现了:

1. **Reconstruction-first codecs** EnCodec,DAC. 优化感知音频质量. 代币是"音响"它们捕捉到包括扬声器身份,音调,背景噪音等所有内容.
2. **Semantic-first codecs**米米 (九泰),语音托克尼泽. 强迫第一本代码书编码语言/音响内容 (通常通过从WavLM蒸).随后的代码书是音响细节.

2024-2026年的见解:**a pure reconstruction codec gives you blurry speech when you try to generate from text.**编码代码代码的LLM必须在同一代码书中学习语言结构和声学结构,这不会扩展.分离它们的语义代码书0,声学代码书1-N 是使莫西和芝麻CSM工作的原因.

## 概念

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### 核心技巧:残留向量定量化 (RVQ)

而不是一个大代码书 (需要数百万代码才能达到高质量),**RVQ**编码书的数量量:一个小编码书.第一本编码书量化编码器输出;第二本量化残余;等.每个编码书为1024个代码.$1024^8 = 10^{24}$现在,我们要去.

在推断时,解码器将每个框架中所选的所有代码总和起来,以重建.

### 2026年有关键的四个编程器

**EnCodec (Meta, 2022).**基线. 波形加码器-解码器,RVQ瓶. 24 kHz,32个代码库可能,默认4个代码库 @ 1.5 kbps. 使用 `1D conv + transformer + 1D conv`建筑,由音乐Gen使用.

**DAC (Descript, 2023).**随着L2标准化的代码簿,定期激活功能,损失改善. 任何开放代码的最高重建忠实度有时无法与原始语音区分,有12个代码簿. 44.1 kHz 频段.

**SNAC (Hubert Siuzdak, 2024).**多尺度RVQ 粗代码书在较细的图像速度下运行.有效地以语音层次模型:粗的"sketch"在 ~ 12 Hz 加上50 Hz 细节.Orpheus-3B使用,因为层次结构很好地映射到基于LM的生成.

**Mimi (Kyutai, 2024).**游戏变化器2026年. 12.5Hz的框架速度 (极低), 8个代码书 @ 4.4 kbps.**distilled from WavLM**训练以预测WavLM的语音内容特性.编码书1-7是声学残留物.这分类支持Moshi (课 15) 和芝麻CSM.

### 框架速度对于语言建模是重要的

低的图像速度 = 短的序列 = 快的LM.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

在12.5Hz,一个10秒的发言量只有125个编程框架一个变压器可以轻松预测它们.

### 语义与声学代币

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**通过辅助预测损失从WavLM蒸.
- **Acoustic tokens (codebooks 1-7).**编码音调,扬声器身份,音声,背景噪音,细节.

亚尔LM首先预测语义代币 (基于文字),然后预测声义代币 (基于语义 +扬声器参考).这种因素化是现代TTS可以零射击克隆声音的原因:语义模型处理内容;声义模型处理音调.

### 2026重建质量 (每秒位,比特速率较低更好)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

传统的编码器,如Opus,仍然在感知质量上获胜.**discrete tokens**(Opus不生产) 和**generative-model quality**(LM可以用这些代币做什么).

```figure
rvq-codec-cascade
```

## 建立它

### 步骤1:使用EnCodec编码

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

`n_codebooks=8`每个代码是0-1023 (10位).

### 步骤2:解码和测量重建

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### 步骤3:语义音分离 (Mimi式)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

语义代码簿0是与WavLM一致的.你可以训练一个文本到语义变换器比直接到音频更小的词汇.然后在扬声器参考上设置一个单独的声态到波形解码器.

### 步骤4:为什么AR LM超过代码代码符号工作

对于米米的12.5Hz × 8码书的10秒语音剪辑:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000代币对于变压器来说是一个微不足道的背景. 256M参数变压器可以在现代GPU上在毫秒内产生10秒的语音.

## 用它

图片问题 → 编程:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

指规则:**if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## 陷

- **Too many codebooks.**添加代码书则将线性增强,但LM序列长度也会线性增长.
- **Frame-rate mismatch.**训练LM在12.5Hz米米然后细调在50HzEnCodec默默失败.
- **Assuming all codebooks equal.**在米米中,代码书0带有内容;失去它破坏了理解性.失去代码书7几乎是不明显的.
- **Using reconstruction quality as the only metric.**如果语义结构不好,则编程器可以进行很好的重建,

## 运送它

保存如`outputs/skill-codec-picker.md`选择一个代码器用于特定的生成或压缩任务.

## 运动

1. **Easy.**跑步`code/main.py`它实现了玩具的尺度量化器+残余量化器,并测量了重建错误,
2. **Medium.**安装`encodec`通过使用一个长时间的语音片段,将1,4,8,32个代码簿进行比较.
3. **Hard.**装载米米.编码一段片段.用随机整数取代代代码书0;解码.然后类似地取代代码书7.比较两种腐败代码书0腐败应该破坏理解性;代码书7腐败几乎不应该改变任何东西.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## 进一步阅读

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) RVQ基线.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546)最高忠诚度开放.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411)多尺度的RVQ.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer)语音分离,波蒸.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143)两阶段的语义/音声范式.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312)原始可播放的RVQ编程.
