# 音频生成

> 音频是16-48 kHz的一维信号。一段五秒的片段包含80-240k个采样点。没有任何Transformer会直接处理如此长的序列。2026年所有生产级音频模型的解决方案都是一样的：神经编解码器（Encodec、SoundStream、DAC）将音频压缩为50-75 Hz的离散token，然后由Transformer或扩散模型生成token。

**类型：** 构建
**语言：** Python
**先修知识：** 第6阶段 · 02（音频特征）、第6阶段 · 04（ASR）、第8阶段 · 06（DDPM）
**时间：** ~45分钟

## 问题

三种音频生成任务：

1. **文本转语音。** 给定文本，生成语音。干净语音是窄带信号，具有强烈的语音结构——通过基于token的Transformer可以很好地解决。VALL-E（Microsoft）、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **音乐生成。** 给定提示（文本、旋律、和弦进行、流派），生成音乐。分布范围更广。MusicGen（Meta）、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **音频效果/音效设计。** 给定提示，生成环境音或拟音。AudioGen、AudioLDM 2、Stable Audio Open。

这三种都基于相同的底层架构：神经音频编解码器 + token自回归或扩散生成器。

## 概念

![音频生成：编解码器token + Transformer或扩散](../assets/audio-generation.svg)

### 神经音频编解码器

Encodec（Meta，2022）、SoundStream（Google，2021）、Descript Audio Codec（DAC，2023）。卷积编码器将波形压缩为每时间步的向量；残差向量量化（RVQ）将每个向量转换为K个码本索引的级联。解码器将其反转。使用8个RVQ码本在75 Hz下压缩24 kHz音频至2 kbps = 600 token/秒。

```
波形 (16000 采样点/秒)
    └─ 编码器卷积 ─┐
                     ├─ RVQ 层 1 → 75 Hz 索引
                     ├─ RVQ 层 2 → 75 Hz 索引
                     ├─ ...
                     └─ RVQ 层 8
```

### 两种生成范式

**Token自回归。** 将RVQ token展平为序列，运行仅解码器Transformer。MusicGen使用"延迟并行"以每流偏移的方式并行发出K个码本流。VALL-E从文本提示 + 3秒语音样本生成语音token。

**潜在扩散。** 将编解码器token打包为连续潜在变量，或使用分类扩散建模。Stable Audio 2.5在连续音频潜在变量上使用流匹配。AudioLDM 2使用文本到mel到音频的扩散。

2024-2026趋势：流匹配在音乐领域获胜（推理更快、样本更干净），而token-AR仍主导语音，因为它天然因果且适合流式传输。

## 生产环境概览

| 系统 | 任务 | 骨干网络 | 延迟 |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + 神经声码器 | ~300ms 首个token |
| OpenAI GPT-4o audio | 全双工语音 | 端到端多模态AR | ~200ms |
| NaturalSpeech 3 | TTS | 潜在流匹配 | 非流式 |
| Stable Audio 2.5 | 音乐/音效 | DiT + 音频潜在变量流匹配 | ~10s 生成1分钟片段 |
| Suno v4 | 完整歌曲 | 未公开；疑似token-AR | ~30s 每首歌 |
| Udio v1.5 | 完整歌曲 | 未公开 | ~30s 每首歌 |
| MusicGen 3.3B | 音乐 | Encodec 32kHz上的Token-AR | 实时 |
| AudioCraft 2 | 音乐+音效 | 流匹配 | ~5s 生成5秒片段 |
| Riffusion v2 | 音乐 | 频谱图扩散 | ~10s |

## 构建

`code/main.py` 模拟核心思想：在由两种不同"风格"（风格A为交替高低token，风格B为单调递增）生成的合成"音频token"序列上训练一个微小的next-token Transformer。基于风格进行条件生成和采样。

### 步骤1：合成音频token

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "类语音"：交替
        return [i % vocab_size for i in range(length)]
    # "类音乐"：递增
    return [(i * 3) % vocab_size for i in range(length)]
```

### 步骤2：训练微小的token预测器

一个基于风格的二元预测器。重点是模式：编解码器token → 交叉熵训练 → 自回归采样。

### 步骤3：条件采样

给定风格token和起始token，从预测分布中采样下一个token。继续20-40个token。

## 陷阱

- **编解码器质量决定输出质量上限。** 如果编解码器无法忠实表示某种声音，无论生成器质量多高都无济于事。DAC是目前最好的开源选择。
- **RVQ误差累积。** 每个RVQ层建模前一层的残差。第1层的误差会传播。在更高层使用temperature 0采样有帮助。
- **音乐结构。** 30秒的token在75 Hz下超过20k个token。对Transformer来说很长。MusicGen使用滑动窗口 + 提示延续；Stable Audio使用更短片段 + 交叉淡入淡出。
- **边界伪影。** 生成片段之间的交叉淡入淡出需要仔细的叠加相加。
- **干净数据需求。** 音乐生成器需要数万小时的授权音乐。Suno/Udio的RIAA诉讼（2024）将这一问题浮出水面。
- **语音克隆伦理。** 3秒样本加文本提示就足以让VALL-E / XTTS / ElevenLabs克隆声音。每个生产模型都需要滥用检测 + 退出列表。

## 使用

| 任务 | 2026年技术栈 |
|------|------------|
| 商业TTS | ElevenLabs、OpenAI TTS或Azure Neural |
| 语音克隆（已验证同意） | XTTS v2（开源）或ElevenLabs Pro |
| 背景音乐，快速 | Stable Audio 2.5 API、Suno或Udio |
| 带歌词的音乐 | Suno v4或Udio v1.5 |
| 音效/拟音 | AudioCraft 2、ElevenLabs SFX或Stable Audio Open |
| 实时语音代理 | GPT-4o realtime或Gemini Live |
| 开源权重音乐研究 | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| 配音/翻译 | HeyGen、ElevenLabs Dubbing |

## 交付

保存 `outputs/skill-audio-brief.md`。技能接收音频简报（任务、时长、风格、语音、许可证）并输出：模型 + 托管、提示格式（流派标签、风格描述符、结构标记）、编解码器 + 生成器 + 声码器链、种子协议和评估计划（MOS / CLAP分数 / TTS的CER / 用户A/B）。

## 练习

1. **简单。** 运行 `code/main.py` 并显式设置风格。验证生成序列是否匹配该风格的模式。
2. **中等。** 添加延迟并行解码：模拟2个token流，必须保持1步偏移。训练联合预测器。
3. **困难。** 使用HuggingFace transformers本地运行MusicGen-small。用三个不同提示生成10秒片段；A/B测试风格遵循度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 编解码器 | "神经压缩" | 音频的编码器/解码器；典型输出为50-75 Hz的token。 |
| RVQ | "残差VQ" | K个量化器的级联；每个建模前一层的残差。 |
| Token | "一个编解码器符号" | 码本中的离散索引；典型大小1024或2048。 |
| 延迟并行 | "偏移码本" | 以交错偏移方式发出K个token流，减少序列长度。 |
| 流匹配 | "2024年音频领域的胜利" | 扩散的直线路径替代方案；采样更快。 |
| 语音提示 | "3秒样本" | 说话人嵌入或token前缀，引导克隆语音。 |
| Mel频谱图 | "可视化" | 对数幅度感知频谱图；许多TTS系统使用。 |
| 声码器 | "Mel到波形" | 将mel频谱图转换回音频的神经组件。 |

## 生产注意事项：音频是一个流式问题

音频是用户期望*边生成边接收*的输出模态，而非一次性全部输出。在生产环境中，这意味着TPOT（每个输出token的时间）很重要，因为用户的收听速度是目标吞吐量——而非阅读速度。对于16kHz音频在~75 token/秒（Encodec）下，服务器必须每用户每秒生成≥75个token以保持播放流畅。

两个架构后果：

- **流匹配音频模型不能简单地流式传输。** Stable Audio 2.5和AudioCraft 2以一次通过渲染固定片段长度。要流式传输，你需要分块并重叠边界——类似滑动窗口扩散——相比编解码器AR模型增加100-300ms延迟开销。

如果产品是"实时语音聊天"或"实时音乐续写"，选择编解码器AR路径。如果是"提交后渲染30秒片段"，流匹配在质量和总延迟上获胜。

## 延伸阅读

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — 编解码器标准。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 首个广泛使用的神经音频编解码器。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) — DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) — VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) — MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) — AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) — 2025年基于流匹配的文本到音乐。
