# 11 · 音频生成

> 音频是采样率为 16-48 kHz 的一维信号。一段五秒的音频片段就有 8 万到 24 万个采样点。没有哪个 Transformer 能直接对这么长的序列做注意力计算。2026 年所有生产级音频模型的解决方案都一样：用一个神经编解码器（codec，如 Encodec、SoundStream、DAC）把音频压缩成 50-75 Hz 的离散 token，再用 Transformer 或扩散模型来生成这些 token。

**类型：** 实践构建
**语言：** Python
**前置：** 第 6 阶段 · 02（音频特征）、第 6 阶段 · 04（自动语音识别 ASR）、第 8 阶段 · 06（DDPM）
**时长：** 约 45 分钟

## 问题所在

三类音频生成任务：

1. **文本转语音（Text-to-speech，TTS）。** 给定文本，生成语音。干净的语音是窄带信号，且具有很强的音素结构——用「token 上的 Transformer」方法就能很好地解决。代表：VALL-E（微软）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成（Music generation）。** 给定提示（文本、旋律、和弦走向、流派），生成音乐。分布要宽广得多。代表：MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效 / 声音设计（Audio effects / sound design）。** 给定提示，生成环境音或拟音（Foley）。代表：AudioGen、AudioLDM 2、Stable Audio Open。

这三类任务都跑在同一套底座上：神经音频编解码器 + token 自回归（token-AR）或扩散生成器。

## 核心概念

〔图：音频生成——编解码器 token + Transformer 或扩散模型〕

### 神经音频编解码器

Encodec（Meta，2022）、SoundStream（Google，2021）、Descript Audio Codec（DAC，2023）。一个卷积编码器把波形压缩成「每时间步一个向量」；残差向量量化（Residual Vector Quantization，RVQ）把每个向量转换为一串 K 个码本（codebook）索引。解码器则逆向还原。以 24 kHz 音频、2 kbps 码率、8 层 RVQ 码本、75 Hz 计算 = 每秒 600 个 token。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 建立在其之上的两种生成范式

**Token 自回归（Token-autoregressive）。** 把 RVQ token 展平成一个序列，跑一个仅解码器（decoder-only）的 Transformer。MusicGen 用「延迟并行（delayed parallel）」方式，以每条流各自的偏移量并行地发出 K 条码本流。VALL-E 则从「文本提示 + 3 秒语音样本」生成语音 token。

**隐空间扩散（Latent diffusion）。** 把编解码器 token 打包成连续隐变量（latent），或用类别型扩散（categorical diffusion）建模。Stable Audio 2.5 在连续音频隐变量上使用流匹配（flow matching）。AudioLDM 2 则采用「文本→梅尔频谱→音频」的扩散流程。

2024-2026 年的趋势：流匹配在音乐领域胜出（推理更快、样本更干净），而 token-AR 仍在语音领域占主导，因为它天然具有因果性、流式输出表现好。

## 生产格局

| 系统 | 任务 | 主干架构 | 延迟 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + 神经声码器 | 首 token 约 300ms |
| OpenAI GPT-4o audio | 全双工语音 | 端到端多模态 AR | 约 200ms |
| NaturalSpeech 3 | TTS | 隐空间流匹配 | 非流式 |
| Stable Audio 2.5 | 音乐 / 音效 | DiT + 音频隐变量上的流匹配 | 1 分钟片段约 10s |
| Suno v4 | 完整歌曲 | 未公开；疑似 token-AR | 每首约 30s |
| Udio v1.5 | 完整歌曲 | 未公开 | 每首约 30s |
| MusicGen 3.3B | 音乐 | Encodec 32kHz 上的 token-AR | 实时 |
| AudioCraft 2 | 音乐 + 音效 | 流匹配 | 5s 片段约 5s |
| Riffusion v2 | 音乐 | 频谱图扩散 | 约 10s |

## 动手构建

`code/main.py` 模拟了核心思想：在两种不同「风格」生成的合成「音频 token」序列上训练一个微型的下一 token Transformer（风格 A 为高低 token 交替，风格 B 为单调递增的斜坡）。以风格为条件进行采样。

### 第 1 步：合成音频 token

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # “类语音”：交替
        return [i % vocab_size for i in range(length)]
    # “类音乐”：斜坡
    return [(i * 3) % vocab_size for i in range(length)]
```

### 第 2 步：训练一个微型 token 预测器

一个以风格为条件的二元（bigram）风格预测器。重点在于这个模式：编解码器 token → 交叉熵训练 → 自回归采样。

### 第 3 步：条件采样

给定风格 token 和一个起始 token，从预测分布中采样下一个 token。持续生成 20-40 个 token。

## 常见陷阱

- **编解码器质量是输出质量的上限。** 如果编解码器无法忠实地表示某种声音，无论生成器质量多高都无济于事。DAC 是目前最好的开源选择。
- **RVQ 误差累积。** 每一层 RVQ 都对前一层的残差建模。第 1 层的误差会向后传播。对更高层用温度 0 采样有帮助。
- **音乐结构。** 30 秒的 token 在 75 Hz 下就是 2 万多个 token。对 Transformer 来说很难。MusicGen 用滑动窗口 + 提示续写；Stable Audio 用更短的片段 + 交叉淡化（crossfading）。
- **边界处的瑕疵。** 在生成的片段之间做交叉淡化需要精细的重叠相加（overlap-add）。
- **对干净数据的胃口。** 音乐生成器需要数万小时的有版权授权的音乐。Suno / Udio 与 RIAA 的诉讼（2024）把这个问题摆上了台面。
- **声音克隆的伦理。** 一段 3 秒的样本加一条文本提示，就足以让 VALL-E / XTTS / ElevenLabs 克隆出一个声音。每个生产模型都需要滥用检测 + 退出（opt-out）名单。

## 如何使用

| 任务 | 2026 年技术栈 |
|------|------------|
| 商用 TTS | ElevenLabs、OpenAI TTS 或 Azure Neural |
| 声音克隆（已验证授权） | XTTS v2（开源）或 ElevenLabs Pro |
| 背景音乐，求快 | Stable Audio 2.5 API、Suno 或 Udio |
| 带歌词的音乐 | Suno v4 或 Udio v1.5 |
| 音效 / 拟音 | AudioCraft 2、ElevenLabs SFX 或 Stable Audio Open |
| 实时语音 agent | GPT-4o realtime 或 Gemini Live |
| 开放权重音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音 / 翻译 | HeyGen、ElevenLabs Dubbing |

## 交付落地

保存 `outputs/skill-audio-brief.md`。该技能接收一份音频需求说明（任务、时长、风格、声音、授权），并输出：模型 + 托管方案、提示格式（流派标签、风格描述符、结构标记）、编解码器 + 生成器 + 声码器链路、随机种子协议，以及评测方案（MOS / CLAP 分数 / TTS 的 CER / 用户 A/B 测试）。

## 练习

1. **简单。** 运行 `code/main.py` 并显式设置风格。验证生成的序列是否匹配该风格的模式。
2. **中等。** 加入延迟并行解码：模拟 2 条必须保持偏移 1 步的 token 流。训练一个联合预测器。
3. **困难。** 用 HuggingFace transformers 在本地运行 MusicGen-small。用三条不同的提示各生成一段 10 秒的片段；做 A/B 测试看风格贴合度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Codec（编解码器） | “神经压缩” | 音频的编码器 / 解码器；典型输出是 50-75 Hz 的 token。 |
| RVQ | “残差 VQ” | K 个量化器的级联；每个对前一个的残差建模。 |
| Token | “一个编解码器符号” | 指向码本的离散索引；通常为 1024 或 2048。 |
| Delayed parallel（延迟并行） | “错位码本” | 以交错偏移发出 K 条 token 流，以缩短序列长度。 |
| Flow matching（流匹配） | “2024 年音频领域的赢家” | 比扩散路径更直的替代方案；采样更快。 |
| Voice prompt（语音提示） | “3 秒样本” | 引导克隆声音的说话人嵌入或 token 前缀。 |
| Mel spectrogram（梅尔频谱图） | “可视化形态” | 对数幅度的感知频谱图；许多 TTS 系统都在用。 |
| Vocoder（声码器） | “梅尔转波形” | 把梅尔频谱图转换回音频的神经组件。 |

## 生产笔记：音频是一个流式问题

音频是唯一一种用户期望「边生成边到达」、而非一次性全部到达的输出模态。从生产角度讲，这意味着 TPOT（每 token 输出时间，Time Per Output Token）很重要，因为用户的「收听速度」才是目标吞吐量——而不是其阅读速度。对于以约 75 token/秒（Encodec）token 化的 16kHz 音频，服务端必须为每个用户生成 ≥75 token/秒，才能保证播放流畅。

由此带来两个架构上的后果：

- **流匹配音频模型无法轻易做流式输出。** Stable Audio 2.5 和 AudioCraft 2 一次性渲染固定长度的片段。要做流式，你得把片段切块并让边界重叠——可以理解为滑动窗口扩散——相比编解码器 AR 模型会额外增加 100-300ms 的延迟开销。

如果产品是「实时语音对话」或「实时音乐续写」，选编解码器 AR 路线。如果是「提交后渲染一段 30 秒的片段」，则流匹配在质量和总延迟上胜出。

## 延伸阅读

- [Défossez 等人（2022）。Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) —— 编解码器的标准。
- [Zeghidour 等人（2021）。SoundStream](https://arxiv.org/abs/2107.03312) —— 第一个被广泛使用的神经音频编解码器。
- [Kumar 等人（2023）。High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) —— DAC。
- [Wang 等人（2023）。Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) —— VALL-E。
- [Copet 等人（2023）。Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) —— MusicGen。
- [Liu 等人（2023）。AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) —— AudioLDM 2。
- [Stability AI（2024）。Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) —— 2025 年使用流匹配的文本转音乐。
