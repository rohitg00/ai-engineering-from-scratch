# 音频生成（Audio Generation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 音频是 16-48 kHz 的一维信号。一段 5 秒的片段就是 8 万到 24 万个采样点。没有哪个 transformer 会直接对这种序列做 attention。2026 年所有生产级音频模型给出的方案都一样：用一个神经 codec（Encodec、SoundStream、DAC）把音频压缩成 50-75 Hz 的离散 token，再让 transformer 或扩散模型来生成 token。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## 问题（The Problem）

三类音频生成任务：

1. **文本转语音（Text-to-speech）。** 给定文本，生成语音。干净的语音是窄带信号，且具有强烈的语音学结构 —— transformer-over-tokens 这条路解得很好。代表：VALL-E（Microsoft）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成（Music generation）。** 给定 prompt（文本、旋律、和弦进行、流派），生成音乐。分布要宽得多。代表：MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音效 / 拟音（Audio effects / sound design）。** 给定 prompt，生成环境音或 Foley（拟音）。代表：AudioGen、AudioLDM 2、Stable Audio Open。

这三类任务跑在同一套底座上：神经音频 codec + token-AR 或扩散生成器。

## 概念（The Concept）

![音频生成：codec token + transformer 或 diffusion](../assets/audio-generation.svg)

### 神经音频 codec

Encodec（Meta，2022）、SoundStream（Google，2021）、Descript Audio Codec（DAC，2023）。一个卷积 encoder 把波形压缩成逐时间步的向量；残差向量量化（residual vector quantization，RVQ）把每个向量转成一串 K 个 codebook 索引。decoder 反过来还原。24 kHz 音频以 2 kbps 编码、用 8 个 75 Hz 的 RVQ codebook = 600 token/秒。

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 上层的两种生成范式

**Token autoregressive（token 自回归）。** 把 RVQ token 拍平成一个序列，跑一个 decoder-only transformer。MusicGen 用「delayed parallel（延迟并行）」让 K 路 codebook 流并行发射，每路有一个偏移。VALL-E 从「文本 prompt + 3 秒人声样本」生成语音 token。

**Latent diffusion（潜空间扩散）。** 把 codec token 当作连续 latent 来打包，或者用 categorical diffusion 来建模。Stable Audio 2.5 在连续音频 latent 上做 flow matching。AudioLDM 2 走 text → mel → audio 的扩散链。

2024-2026 的趋势：在音乐上 flow matching 正在赢（推理更快、采样更干净），而 token-AR 在语音上仍占主导，因为它天然是因果的、流式效果好。

## 工业落地全景（Production landscape）

| 系统 | 任务 | 主干 | 延迟 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + 神经 vocoder | ~300ms 首 token |
| OpenAI GPT-4o audio | 全双工语音 | 端到端多模态 AR | ~200ms |
| NaturalSpeech 3 | TTS | 潜空间 flow matching | 非流式 |
| Stable Audio 2.5 | 音乐 / 音效 | 在音频 latent 上跑 DiT + flow matching | 1 分钟片段约 10 秒 |
| Suno v4 | 完整歌曲 | 未公开；疑似 token-AR | 每首约 30 秒 |
| Udio v1.5 | 完整歌曲 | 未公开 | 每首约 30 秒 |
| MusicGen 3.3B | 音乐 | 在 Encodec 32kHz 上的 token-AR | 实时 |
| AudioCraft 2 | 音乐 + 音效 | flow matching | 5 秒片段约 5 秒 |
| Riffusion v2 | 音乐 | 频谱图扩散 | ~10 秒 |

## 动手实现（Build It）

`code/main.py` 模拟核心想法：训练一个微型 next-token transformer，让它学习两种不同「风格」生成的合成「audio token」序列（风格 A：高低 token 交替；风格 B：单调上升斜坡）。以风格作为条件采样。

### Step 1：合成 audio token

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Step 2：训练一个微型 token 预测器

一个以风格为条件的 bigram 风格预测器。重点是模式：codec token → 交叉熵训练 → 自回归采样。

### Step 3：按条件采样

给定风格 token 和起始 token，从预测分布里采样下一个 token。继续 20-40 个 token。

## 坑点（Pitfalls）

- **Codec 的质量决定输出上限。** 如果 codec 没法忠实表达某个声音，再强的生成器也救不回来。DAC 是当前开源最好的。
- **RVQ 的误差累积。** 每个 RVQ layer 建模上一层的残差。layer 1 的误差会传递下去。在更高 layer 上用 temperature 0 采样会有帮助。
- **音乐结构。** 30 秒在 75 Hz 下就是 2 万多个 token，对 transformer 是个硬骨头。MusicGen 用滑窗 + prompt 续写；Stable Audio 用更短片段 + 交叉淡入淡出。
- **边界处的 artifacts。** 在生成片段之间做交叉淡化，需要小心处理 overlap-add（重叠相加）。
- **对干净数据的胃口。** 音乐生成器需要数万小时有授权的音乐。2024 年 Suno / Udio 的 RIAA 诉讼把这件事彻底搬上了台面。
- **声音克隆的伦理。** 3 秒样本加一段文本 prompt，VALL-E / XTTS / ElevenLabs 就能克隆一个人的声音。每个生产级模型都得带滥用检测 + opt-out 名单。

## 用起来（Use It）

| 任务 | 2026 技术栈 |
|------|------------|
| 商用 TTS | ElevenLabs、OpenAI TTS 或 Azure Neural |
| 经过授权的声音克隆 | XTTS v2（开源）或 ElevenLabs Pro |
| 快速生成背景音乐 | Stable Audio 2.5 API、Suno 或 Udio |
| 带歌词的音乐 | Suno v4 或 Udio v1.5 |
| 音效 / Foley | AudioCraft 2、ElevenLabs SFX 或 Stable Audio Open |
| 实时语音 agent | GPT-4o realtime 或 Gemini Live |
| 开源权重的音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音 / 翻译 | HeyGen、ElevenLabs Dubbing |

## 上线部署（Ship It）

保存到 `outputs/skill-audio-brief.md`。这个 skill 接受一份音频简报（任务、时长、风格、人声、授权），输出：模型 + 部署方案、prompt 格式（流派标签、风格描述词、结构标记）、codec + 生成器 + vocoder 链路、随机种子协议，以及评估方案（MOS / CLAP 分数 / TTS 的 CER / 用户 A/B 测试）。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py` 并显式设定 style。验证生成的序列符合该 style 的模式。
2. **中等。** 加上 delayed parallel 解码：模拟 2 路 token 流，要求二者保持 1 个时间步的偏移。训练一个联合预测器。
3. **困难。** 用 HuggingFace transformers 在本地跑 MusicGen-small。用 3 个不同 prompt 各生成 10 秒片段；做 A/B 比较风格契合度。

## 关键术语（Key Terms）

| 术语 | 大家的说法 | 它实际是什么 |
|------|-----------------|-----------------------|
| Codec | 「神经压缩」 | 音频的 encoder / decoder；典型输出是 50-75 Hz 的 token。 |
| RVQ | 「残差 VQ」 | K 个量化器级联；每一层建模上一层的残差。 |
| Token | 「一个 codec 符号」 | codebook 里的一个离散索引；典型大小 1024 或 2048。 |
| Delayed parallel | 「错开的 codebook」 | 让 K 路 token 流以错开的偏移发射，从而缩短序列长度。 |
| Flow matching | 「2024 年音频领域的赢家」 | 扩散的「直线版」替代品；采样更快。 |
| Voice prompt | 「3 秒样本」 | 用于操控克隆音色的说话人 embedding 或 token 前缀。 |
| Mel spectrogram | 「那张图」 | 对数幅度的感知频谱图；许多 TTS 系统都在用。 |
| Vocoder | 「mel 到波形」 | 把 mel 频谱图还原为音频的神经组件。 |

## 工程笔记：音频本质上是流式问题

音频是用户唯一期望「边生成边到达」、而非一次性吐出来的输出模态。换成工程语言：TPOT（Time Per Output Token，每个输出 token 的时间）很关键，因为目标吞吐是用户的「听速」—— 而不是阅读速度。对于 16 kHz、用 Encodec 切到约 75 token/秒 的音频，服务端必须为每个用户生成 ≥75 token/秒 才能保证播放流畅。

由此带来两个架构后果：

- **Flow-matching 音频模型没法轻松流式化。** Stable Audio 2.5 和 AudioCraft 2 都是一次性渲染固定长度的片段。要做流式，就得把片段切块、并在边界处重叠 —— 想象一下滑窗扩散 —— 相比 codec AR 模型，会多出 100-300ms 的延迟开销。

如果产品是「实时语音聊天」或「实时音乐续写」，选 codec AR 这条路。如果产品是「提交后渲染一段 30 秒的片段」，flow matching 在质量和总延迟上都会赢。

## 延伸阅读（Further Reading）

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) —— codec 的事实标准。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) —— 第一个被广泛使用的神经音频 codec。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) —— DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) —— VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) —— MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) —— AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) —— 用 flow matching 做的 2025 年文生音乐。
