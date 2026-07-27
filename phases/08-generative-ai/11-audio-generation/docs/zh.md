# 音频生成

> 音频是 16-48 kHz 的 1-D 信号。一个五秒的片段是 80-240k 个样本。没有 Transformer 能直接处理那个序列。2026 年每个生产级音频模型的解决方案都是相同的：神经编解码器（Encodec、SoundStream、DAC）将音频压缩为 50-75 Hz 的离散令牌，然后 Transformer 或扩散模型生成令牌。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 6 · 02（音频特征）、阶段 6 · 04（ASR）、阶段 8 · 06（DDPM）
**时间：** ~45 分钟

## 问题

三个音频生成任务：

1. **文生语音（TTS）。** 给定文本，生成语音。干净语音是窄带的，具有强烈的语音结构——通过令牌上的 Transformer 很好地解决。VALL-E（微软）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成。** 给定提示（文本、旋律、和弦进行、流派），生成音乐。分布宽得多。MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效 / 声音设计。** 给定提示，生成环境音或拟音。AudioGen、AudioLDM 2、Stable Audio Open。

三者都在相同的基础上运行：神经音频编解码器 + 令牌 AR 或扩散生成器。

## 概念

![音频生成：编解码器令牌 + Transformer 或扩散](../assets/audio-generation.svg)

### 神经音频编解码器

Encodec（Meta、2022）、SoundStream（Google、2021）、Descript Audio Codec（DAC、2023）。卷积编码器将波形压缩为每个时间步的向量；残差向量量化（RVQ）将每个向量转换为 K 个码本索引的级联。解码器反转此过程。24 kHz 音频，2 kbps，使用 8 个 RVQ 码本在 75 Hz = 600 令牌/秒。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 其上的两种生成范式

**令牌自回归。** 将 RVQ 令牌展平为序列，运行仅解码器 Transformer。MusicGen 使用"延迟并行"以每流偏移的方式并行发出 K 个码本流。VALL-E 从文本提示 + 3 秒语音样本生成语音令牌。

**潜在扩散。** 将编解码器令牌打包为连续潜在表示或用分类扩散建模。Stable Audio 2.5 在连续音频潜在表示上使用流匹配。AudioLDM 2 使用文本到梅尔到音频的扩散。

2024-2026 年趋势：流匹配在音乐方面胜出（推理更快、样本更干净），而令牌 AR 在语音方面仍然占主导地位，因为它天然是因果的且流式传输好。

## 生产格局

| 系统 | 任务 | 骨干 | 延迟 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | 令牌-AR + 神经声码器 | ~300ms 首个令牌 |
| OpenAI GPT-4o audio | 全双工语音 | 端到端多模态 AR | ~200ms |
| NaturalSpeech 3 | TTS | 潜在流匹配 | 非流式 |
| Stable Audio 2.5 | 音乐 / 音效 | DiT + 音频潜在流匹配 | 1 分钟片段约 10s |
| Suno v4 | 完整歌曲 | 未公开；疑似令牌-AR | 每首歌曲约 30s |
| Udio v1.5 | 完整歌曲 | 未公开 | 每首歌曲约 30s |
| MusicGen 3.3B | 音乐 | Encodec 32kHz 上的令牌-AR | 实时 |
| AudioCraft 2 | 音乐 + 音效 | 流匹配 | 5s 片段约 5s |
| Riffusion v2 | 音乐 | 频谱图扩散 | ~10s |

## 动手实现

`code/main.py` 模拟核心思想：在从两种不同"风格"（风格 A 交替的低和高令牌，风格 B 单调斜坡）生成的合成"音频令牌"序列上训练一个微小的下一个令牌 Transformer。以风格为条件并采样。

### 步骤 1：合成音频令牌

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步骤 2：训练微小的令牌预测器

一个以风格为条件的二元语法风格预测器。重点是模式：编解码器令牌 → 交叉熵训练 → 自回归采样。

### 步骤 3：条件采样

给定风格令牌和起始令牌，从预测分布中采样下一个令牌。继续 20-40 个令牌。

## 陷阱

- **编解码器质量限制输出质量。** 如果编解码器不能忠实地表示声音，再多的生成器质量也无济于事。DAC 是目前开放最好的。
- **RVQ 误差累积。** 每个 RVQ 层对前一层的残差建模。第 1 层上的错误会传播。在更高层使用温度 0 采样有帮助。
- **音乐结构。** 30 秒的令牌在 75 Hz 下是 20k+ 个令牌。对 Transformer 来说很困难。MusicGen 使用滑动窗口 + 提示延续；Stable Audio 使用更短的片段 + 交叉淡入淡出。
- **边界伪影。** 生成的片段之间的交叉淡入淡出需要仔细的重叠相加。
- **干净数据的胃口。** 音乐生成器需要数万小时的许可音乐。Suno / Udio RIAA 诉讼（2024）将这一点浮出水面。
- **声音克隆伦理。** 3 秒样本加文本提示就足以让 VALL-E / XTTS / ElevenLabs 克隆一个声音。每个生产模型都需要滥用检测 + 退出名单。

## 应用

| 任务 | 2026 年技术栈 |
|------|------------|
| 商业 TTS | ElevenLabs、OpenAI TTS 或 Azure Neural |
| 声音克隆（已验证同意） | XTTS v2（开放）或 ElevenLabs Pro |
| 背景音乐，快速 | Stable Audio 2.5 API、Suno 或 Udio |
| 带歌词的音乐 | Suno v4 或 Udio v1.5 |
| 音效 / 拟音 | AudioCraft 2、ElevenLabs SFX 或 Stable Audio Open |
| 实时语音代理 | GPT-4o realtime 或 Gemini Live |
| 开放权重音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音 / 翻译 | HeyGen、ElevenLabs Dubbing |

## 交付

保存为 `outputs/skill-audio-brief.md`。技能接受音频简介（任务、时长、风格、声音、许可）并输出：模型 + 托管、提示格式（流派标签、风格描述符、结构标记）、编解码器 + 生成器 + 声码器链、种子方案和评估计划（MOS / CLAP 分数 / TTS 的 CER / 用户 A/B）。

## 练习

1. **简单。** 运行 `code/main.py` 并显式设置风格。验证生成的序列是否匹配风格的模式。
2. **中等。** 添加延迟并行解码：模拟 2 个令牌流，必须保持偏移 1 步。训练一个联合预测器。
3. **困难。** 使用 HuggingFace transformers 在本地运行 MusicGen-small。用三个不同的提示生成 10 秒片段；A/B 测试风格遵循度。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Codec | "神经压缩" | 音频的编码器/解码器；典型输出为 50-75 Hz 令牌。 |
| RVQ | "残差 VQ" | K 个量化器的级联；每个对前一个的残差建模。 |
| Token | "一个编解码器符号" | 码本中的离散索引；典型为 1024 或 2048。 |
| Delayed parallel | "偏移码本" | 以错位偏移发出 K 个令牌流以减少序列长度。 |
| Flow matching | "2024 年音频的胜利" | 比扩散更直的路径替代方案；采样更快。 |
| Voice prompt | "3 秒样本" | 引导克隆声音的说话人嵌入或令牌前缀。 |
| Mel spectrogram | "可视化" | 对数幅度感知频谱图；许多 TTS 系统使用。 |
| Vocoder | "梅尔到波形" | 将梅尔频谱图转换回音频的神经组件。 |

## 生产说明：音频是一个流式问题

音频是用户期望*在生成的同时*到达、而非一次性全部到达的唯一输出模态。在生产术语中，这意味着 TPOT（每输出令牌时间）很重要，因为用户的收听速度是目标吞吐量——而不是他们的阅读速度。对于以约 75 令牌/秒（Encodec）令牌化的 16kHz 音频，服务器必须为每个用户生成 ≥75 令牌/秒才能保持播放流畅。

两个架构后果：

- **流匹配音频模型不能简单地流式传输。** Stable Audio 2.5 和 AudioCraft 2 一次渲染固定长度的片段。要流式传输，你需要将片段分块并重叠边界——想象滑动窗口扩散——与编解码器 AR 模型相比，增加了 100-300ms 的延迟开销。

如果产品是"实时语音聊天"或"实时音乐续写"，选择编解码器 AR 路径。如果是"提交后渲染 30 秒片段"，流匹配在质量和总延迟上胜出。

## 延伸阅读

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — 编解码器标准。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 首个广泛使用的神经音频编解码器。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) — DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) — VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) — MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) — AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) — 2025 年使用流匹配的文生音乐。
