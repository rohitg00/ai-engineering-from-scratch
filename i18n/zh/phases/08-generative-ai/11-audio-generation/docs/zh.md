# 音频生成

> 音频是 16-48 kHz 的一维信号。五秒钟的音频片段包含 8 万至 24 万个采样点。没有任何 Transformer 能直接对这样的序列做注意力。2026 年所有生产级音频模型的解决方案都是一样的：先用神经编解码器(Encodec、SoundStream、DAC)把音频压缩为 50-75 Hz 的离散 token,再由 Transformer 或扩散模型生成这些 token。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02(音频特征)、Phase 6 · 04(ASR)、Phase 8 · 06(DDPM)
**Time:** 约 45 分钟

## 问题

三类音频生成任务：

1. **文本转语音。** 给定文本，生成语音。干净语音频带窄、音位结构强——基于 token 的 Transformer 已解决得很好。VALL-E(Microsoft)、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成。** 给定提示(文本、旋律、和弦进行、流派)，生成音乐。分布要宽泛得多。MusicGen(Meta)、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效 / 声音设计。** 给定提示，生成环境音或拟音。AudioGen、AudioLDM 2、Stable Audio Open。

三者都运行在同一个基础上：神经音频编解码器 + 自回归 token 生成器或扩散生成器。

## 概念

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### 神经音频编解码器

Encodec(Meta,2022)、SoundStream(Google,2021)、Descript Audio Codec(DAC,2023)。卷积编码器把波形压缩为每个时间步的向量；残差向量量化(RVQ)把每个向量转换为 K 个码本索引的级联。解码器逆向还原。24 kHz 音频以 2 kbps 编码，使用 75 Hz 的 8 个 RVQ 码本 = 每秒 600 个 token。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 两种生成范式

**Token 自回归。** 把 RVQ token 展平成序列，运行一个 decoder-only Transformer。MusicGen 使用"delayed parallel"以每流偏移的方式并行输出 K 个码本流。VALL-E 从文本提示 + 3 秒语音样本生成语音 token。

**潜变量扩散。** 把编解码器 token 打包为连续潜变量，或用类别扩散对其建模。Stable Audio 2.5 在连续音频潜变量上使用 flow matching。AudioLDM 2 使用 text-to-mel-to-audio 扩散。

2024-2026 年的趋势：在音乐领域 flow matching 正在胜出(推理更快、样本更干净)，而在语音领域 token-AR 仍然占主导，因为它天然是因果的且易于流式输出。

## 生产环境格局

| 系统 | 任务 | 骨干 | 延迟 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + 神经声码器 | 首个 token 约 300ms |
| OpenAI GPT-4o audio | 全双工语音 | 端到端多模态 AR | 约 200ms |
| NaturalSpeech 3 | TTS | 潜变量 flow matching | 非流式 |
| Stable Audio 2.5 | 音乐 / 音效 | DiT + 音频潜变量上的 flow matching | 1 分钟片段约 10s |
| Suno v4 | 完整歌曲 | 未公开；疑似 token-AR | 每首歌约 30s |
| Udio v1.5 | 完整歌曲 | 未公开 | 每首歌约 30s |
| MusicGen 3.3B | 音乐 | Encodec 32kHz 上的 token-AR | 实时 |
| AudioCraft 2 | 音乐 + 音效 | Flow matching | 5 秒片段约 5s |
| Riffusion v2 | 音乐 | 频谱图扩散 | 约 10s |

```figure
score-matching
```

## 动手构建

`code/main.py` 模拟了核心思想：在从两种不同“风格”生成的合成“音频 token”序列上(风格 A 为低 token 与高 token 交替，风格 B 为单调递增)训练一个微型下一 token 预测 Transformer。以风格为条件并进行采样。

### 步骤 1:合成音频 token

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步骤 2:训练微型 token 预测器

一个以风格为条件的 bigram 式预测器。重点在于这个模式：编解码器 token → 交叉熵训练 → 自回归采样。

### 步骤 3:条件采样

给定风格 token 和起始 token,从预测分布中采样下一个 token。持续采样 20-40 个 token。

## 常见陷阱

- **编解码器质量决定输出上限。** 如果编解码器无法忠实表示某个声音，生成器再好也无济于事。DAC 是目前开源最佳。
- **RVQ 误差累积。** 每一层 RVQ 建模的是前一层的残差。第一层的误差会向后传播。在较高层使用 temperature 0 采样有帮助。
- **音乐结构。** 30 秒的 token 在 75 Hz 下是 2 万多个 token,对 Transformer 来说很难。MusicGen 使用滑动窗口 + 提示续写；Stable Audio 使用较短的片段 + 交叉淡化。
- **边界处的伪影。** 生成的片段之间做交叉淡化需要仔细的 overlap-add。
- **对干净数据的渴求。** 音乐生成器需要数万小时的正版音乐。Suno / Udio 与 RIAA 的诉讼(2024)让这一问题浮出水面。
- **声音克隆伦理。** 3 秒样本加一段文本提示就足以让 VALL-E / XTTS / ElevenLabs 克隆一个声音。每个生产级模型都需要滥用检测 + 退出名单。

## 应用

| 任务 | 2026 技术栈 |
|------|------------|
| 商用 TTS | ElevenLabs、OpenAI TTS 或 Azure Neural |
| 声音克隆(经同意验证) | XTTS v2(开源)或 ElevenLabs Pro |
| 背景音乐，快速 | Stable Audio 2.5 API、Suno 或 Udio |
| 带歌词的音乐 | Suno v4 或 Udio v1.5 |
| 音效 / 拟音 | AudioCraft 2、ElevenLabs SFX 或 Stable Audio Open |
| 实时语音代理 | GPT-4o realtime 或 Gemini Live |
| 开源权重音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音 / 翻译 | HeyGen、ElevenLabs Dubbing |

## 上线交付

保存 `outputs/skill-audio-brief.md`。Skill 接收音频简报(任务、时长、风格、声音、许可)，输出：模型 + 托管方案、提示格式(流派标签、风格描述符、结构标记)、编解码器 + 生成器 + 声码器链路、种子协议以及评估方案(MOS / CLAP score / CER(用于 TTS)/ 用户 A/B)。

## 练习

1. **简单。** 运行 `code/main.py` 并显式设置风格。验证生成的序列符合该风格的模式。
2. **中等。** 添加 delayed parallel 解码：模拟两个必须保持 1 步偏移的 token 流。训练一个联合预测器。
3. **困难。** 使用 HuggingFace transformers 在本地运行 MusicGen-small。用三个不同提示生成 10 秒片段；进行风格贴合度的 A/B 对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Codec | “神经压缩” | 音频的编码器/解码器；典型输出为 50-75 Hz 的 token。 |
| RVQ | “残差 VQ” | K 个量化器的级联；每个建模前一层的残差。 |
| Token | “一个编解码器符号” | 码本中的离散索引；典型为 1024 或 2048。 |
| Delayed parallel | “偏移码本” | 以交错偏移输出 K 个 token 流，以缩短序列长度。 |
| Flow matching | “2024 年音频领域的胜利” | 扩散的更直路径替代方案；采样更快。 |
| Voice prompt | “3 秒样本” | 引导克隆声音的说话人嵌入或 token 前缀。 |
| Mel spectrogram | “那张图” | 对数幅值感知频谱图；许多 TTS 系统使用它。 |
| Vocoder | “Mel 转波形” | 把 mel 频谱图转换回音频的神经组件。 |

## 生产提示：音频是流式问题

音频是唯一一种用户期望*边生成边到达*、而非一次性全部交付的输出模态。用生产术语来说，这意味着 TPOT(Time Per Output Token)很重要，因为用户的收听速度才是目标吞吐量——而不是他们的阅读速度。对于以约 75 token/秒(Encodec)分词的 16kHz 音频，服务器必须为每个用户生成 ≥75 token/秒，才能保证播放流畅。

两个架构上的推论：

- **Flow matching 音频模型无法简单地流式化。** Stable Audio 2.5 和 AudioCraft 2 一次性渲染固定长度的片段。要流式化，需要对片段分块并在边界处重叠——类似滑动窗口扩散——比编解码器 AR 模型增加 100-300ms 的延迟开销。

如果产品是“实时语音聊天”或“实时音乐续写”，选择编解码器 AR 路径。如果是“提交后渲染 30 秒片段”，flow matching 在质量和总延迟上更优。

## 延伸阅读

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — 编解码器标准。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 第一个被广泛使用的神经音频编解码器。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) — DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) — VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) — MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) — AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) — 2025 年基于 flow matching 的文本生成音乐。