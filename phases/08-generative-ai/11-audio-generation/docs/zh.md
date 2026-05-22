# 音频生成

> 音频是以16-48 kHz采样的1维信号。一段五秒的片段包含80-240k个样本。没有Transformer架构能够直接处理如此长的序列。2026年所有生产级音频模型的解决方案都是相同的：神经编解码器（Neural Codec）（Encodec、SoundStream、DAC）将音频压缩为50-75 Hz的离散令牌（Token），然后由Transformer架构或扩散模型（Diffusion Model）生成令牌。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段6 · 02（音频特征）、阶段6 · 04（自动语音识别）、阶段8 · 06（去噪扩散概率模型）
**时间：** 约45分钟

## 问题

三种音频生成任务：

1. **文本转语音（Text-to-Speech，TTS）。** 给定文本，生成语音。干净语音是窄带的且具有强烈的语音学结构——通过令牌上的Transformer架构已得到良好解决。代表：VALL-E（微软）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成。** 给定提示（文本、旋律、和弦进行、风格），生成音乐。分布更广。代表：MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效/声音设计。** 给定提示，生成环境音或拟音。代表：AudioGen、AudioLDM 2、Stable Audio Open。

三者都运行在相同的基础架构上：神经音频编解码器 + 令牌自回归（Token-AR）或扩散生成器。

## 概念

![音频生成：编解码器令牌 + Transformer或扩散模型](../assets/audio-generation.svg)

### 神经音频编解码器（Neural Audio Codecs）

Encodec（Meta，2022）、SoundStream（谷歌，2021）、描述音频编解码器（Descript Audio Codec，DAC，2023）。卷积编码器（Convolutional Encoder）将波形压缩为每个时间步的向量；残差向量量化（Residual Vector Quantization，RVQ）将每个向量转换为K个码本索引的级联。解码器反向操作。24 kHz音频以2 kbps速率、使用8个RVQ码本（75 Hz） = 600令牌/秒。

```
波形（16000 样本/秒）
    └─ 编码器卷积 ─┐
                     ├─ RVQ层1 → 索引（75 Hz）
                     ├─ RVQ层2 → 索引（75 Hz）
                     ├─ ...
                     └─ RVQ层8
```

### 其上的两种生成范式

**令牌自回归（Token-autoregressive）。** 将RVQ令牌展平成序列，运行一个仅解码器的Transformer架构。MusicGen使用"延迟并行"（Delayed Parallel）以每个流偏移的方式并行输出K个码本流。VALL-E从文本提示 + 3秒语音样本生成语音令牌。

**潜在扩散（Latent Diffusion）。** 将编解码器令牌打包为连续潜在变量或使用分类扩散建模。Stable Audio 2.5在连续音频潜在变量上使用流匹配（Flow Matching）。AudioLDM 2使用文本到梅尔频谱到音频扩散。

2024-2026趋势：流匹配在音乐领域占优（推理更快、样本更干净），而令牌自回归仍然主导语音领域，因为它天然是因果的且便于流式传输。

## 生产环境概览

| 系统 | 任务 | 骨干网络 | 延迟 |
|------|------|----------|---------|
| ElevenLabs V3 | 文本转语音 | 令牌自回归 + 神经声码器 | 首令牌约300ms |
| OpenAI GPT-4o音频 | 全双工语音 | 端到端多模态自回归 | 约200ms |
| NaturalSpeech 3 | 文本转语音 | 潜在流匹配 | 非流式 |
| Stable Audio 2.5 | 音乐/音效 | DiT + 音频潜在变量的流匹配 | 1分钟片段约10s |
| Suno v4 | 完整歌曲 | 未公开；疑似令牌自回归 | 每首歌约30s |
| Udio v1.5 | 完整歌曲 | 未公开 | 每首歌约30s |
| MusicGen 3.3B | 音乐 | 基于Encodec 32kHz的令牌自回归 | 实时 |
| AudioCraft 2 | 音乐+音效 | 流匹配 | 5s片段约5s |
| Riffusion v2 | 音乐 | 频谱图扩散 | 约10s |

## 动手构建

`code/main.py`模拟核心思想：在由两种不同"风格"（风格A交替使用低和高令牌，风格B使用单调斜坡）生成的合成"音频令牌"序列上训练一个微型下一个令牌预测Transformer。以风格为条件进行采样。

### 步骤1：合成音频令牌

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "类语音"：交替
        return [i % vocab_size for i in range(length)]
    # "类音乐"：斜坡
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步骤2：训练一个微型令牌预测器

一个以风格为条件的二元语法风格预测器。关键在于模式：编解码器令牌 → 交叉熵训练 → 自回归采样。

### 步骤3：有条件采样

给定风格令牌和起始令牌，从预测分布中采样下一个令牌。持续20-40个令牌。

## 陷阱

- **编解码器质量限制输出质量。** 如果编解码器无法忠实地表示声音，再好的生成器质量也无济于事。DAC是目前最优秀的开源方案。
- **RVQ误差累积。** 每个RVQ层对前一层的残差建模。第一层的误差会传播。对较高层使用温度0采样有助于缓解。
- **音乐结构。** 30秒的令牌在75 Hz下超过20k个令牌。对Transformer架构来说很困难。MusicGen使用滑动窗口 + 提示延续；Stable Audio使用较短的片段 + 交叉淡入淡出。
- **边界伪影。** 在生成片段之间进行交叉淡入淡出需要仔细的叠加-相加处理。
- **干净数据的胃口。** 音乐生成器需要数万小时的授权音乐。Suno/Udio与RIAA的诉讼（2024年）使这一问题浮现。
- **语音克隆伦理。** 3秒样本加上文本提示就足以让VALL-E / XTTS / ElevenLabs克隆声音。每个生产模型都需要滥用检测 + 退出列表。

## 使用指南

| 任务 | 2026年推荐技术栈 |
|------|------------|
| 商业文本转语音 | ElevenLabs、OpenAI TTS 或 Azure Neural |
| 语音克隆（经同意验证） | XTTS v2（开源）或 ElevenLabs Pro |
| 背景音乐，快速生成 | Stable Audio 2.5 API、Suno 或 Udio |
| 带歌词的音乐 | Suno v4 或 Udio v1.5 |
| 音效/拟音 | AudioCraft 2、ElevenLabs SFX 或 Stable Audio Open |
| 实时语音代理 | GPT-4o实时或 Gemini Live |
| 开源权重音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音/翻译 | HeyGen、ElevenLabs Dubbing |

## 交付

保存 `outputs/skill-audio-brief.md`。技能接受一份音频需求（任务、时长、风格、声音、许可证）并输出：模型 + 托管方式、提示格式（风格标签、风格描述符、结构标记）、编解码器 + 生成器 + 声码器链路、种子协议、评估计划（平均意见得分/CLAP得分/文本转语音的词错误率/用户A/B测试）。

## 练习

1. **简单。** 运行 `code/main.py` 并显式设置风格。验证生成的序列符合该风格的模式。
2. **中等。** 添加延迟并行解码：模拟2个令牌流，它们必须保持1步偏移。训练一个联合预测器。
3. **困难。** 使用HuggingFace Transformers库在本地运行MusicGen-small。用三个不同的提示生成一个10秒片段；对风格一致性进行A/B测试。

## 关键术语

| 术语 | 人们通常怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Codec（编解码器） | "神经压缩" | 音频的编码器/解码器；典型输出是50-75 Hz的令牌。 |
| RVQ（残差向量量化） | "残差VQ" | K个量化器的级联；每个对前一个的残差建模。 |
| Token（令牌） | "一个编解码器符号" | 码本中的离散索引；典型大小为1024或2048。 |
| Delayed parallel（延迟并行） | "偏移码本" | 以交错偏移的方式发出K个令牌流，以减少序列长度。 |
| Flow matching（流匹配） | "2024年音频领域的赢家" | 比扩散更直的路径替代方案；采样更快。 |
| Voice prompt（声音提示） | "3秒样本" | 说话人嵌入或令牌前缀，用于引导克隆的声音。 |
| Mel spectrogram（梅尔频谱图） | "可视化" | 对数幅度感知频谱图；被许多文本转语音系统使用。 |
| Vocoder（声码器） | "梅尔转波形" | 将梅尔频谱图转换回音频的神经组件。 |

## 生产注意事项：音频是一个流式传输问题

音频是用户期望*边生成边到达*的输出模态，而不是一次性全部给出。在生产层面，这意味着TPOT（每输出令牌时间）至关重要，因为用户的收听速度就是目标吞吐量——而不是他们的阅读速度。对于以约75令牌/秒（Encodec）令牌化的16kHz音频，服务器必须为每个用户生成≥75令牌/秒，才能保持播放流畅。

两个架构性后果：

- **流匹配音频模型无法轻易实现流式传输。** Stable Audio 2.5和AudioCraft 2一次性渲染固定长度的片段。要实现流式传输，你需要将片段分块并重叠边界——类似于滑动窗口扩散——这会比编解码器自回归模型增加100-300ms的延迟开销。

如果产品是"实时语音聊天"或"实时音乐延续"，选择编解码器自回归路径。如果是"提交后渲染一个30秒片段"，流匹配在质量和总延迟方面更优。

## 延伸阅读

- [Défossez et al. (2022). Encodec: 高保真神经音频压缩](https://arxiv.org/abs/2210.13438) —— 编解码器标准。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) —— 首个广泛使用的神经音频编解码器。
- [Kumar et al. (2023). 使用改进的RVQGAN实现高保真音频压缩 (DAC)](https://arxiv.org/abs/2306.06546) —— DAC。
- [Wang et al. (2023). 神经编解码器语言模型是零样本文本到语音合成器 (VALL-E)](https://arxiv.org/abs/2301.02111) —— VALL-E。
- [Copet et al. (2023). 简单且可控的音乐生成 (MusicGen)](https://arxiv.org/abs/2306.05284) —— MusicGen。
- [Liu et al. (2023). AudioLDM 2：通过自监督预训练学习整体音频生成](https://arxiv.org/abs/2308.05734) —— AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) —— 2025年基于流匹配的文本到音乐。