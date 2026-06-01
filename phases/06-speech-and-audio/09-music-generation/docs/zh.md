# 09 · 音乐生成——MusicGen、Stable Audio、Suno 与版权大地震

> 2026 年的音乐生成格局：Suno v5 和 Udio v4 主导商业市场；MusicGen、Stable Audio Open 和 ACE-Step 领跑开源阵营。技术问题基本已被攻克，而法律问题（华纳音乐 5 亿美元和解案、环球音乐和解案）在 2025-2026 年间重塑了整个领域。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 6 · 02（频谱图）、阶段 4 · 10（扩散模型）
**时长：** 约 75 分钟

## 问题所在

文本 → 一段 30 秒到 4 分钟的音乐片段，包含歌词、人声与结构。可拆解为三个子问题：

1. **器乐生成。** 像「lo-fi hip-hop drums with warm keys」这样的文本 → 音频。代表：MusicGen、Stable Audio、AudioLDM。
2. **歌曲生成（带人声 + 歌词）。** 「Country song about rainy Texas nights」 → 完整歌曲。代表：Suno、Udio、YuE、ACE-Step。
3. **条件 / 可控生成。** 延长一段已有片段、重新生成桥段、切换曲风、分离音轨（stem），或局部重绘（inpaint）。Udio 的局部重绘 +「音轨分离（stem separation）」是 2026 年值得对标的功能。

## 核心概念

〔图：音乐生成的两条技术路线（token 语言模型 vs 扩散模型）与 2026 年模型版图〕

### 在神经编解码 token 上的 token 语言模型

Meta 的 **MusicGen**（2023，MIT 许可证）及众多衍生模型：以文本/旋律「嵌入（embedding）」为条件，「自回归（autoregressive）」地预测 EnCodec token（32 kHz，4 个码本），再用 EnCodec 解码。参数量 300M - 3.3B。基线表现强劲；但超过 30 秒后表现吃力。

**ACE-Step**（开源，4B XL 版本于 2026 年 4 月发布）将这一路线扩展到完整歌曲的歌词条件生成，是开源社区目前最接近 Suno 的方案。

### 在梅尔频谱或潜变量上的扩散模型

**Stable Audio（2023）** 与 **Stable Audio Open（2024）**：在压缩音频上做「潜在扩散（latent diffusion）」。擅长循环段（loop）、音效设计和环境氛围纹理，但不擅长结构化的完整歌曲。

**AudioLDM / AudioLDM2**：通过类似文生图（T2I）的潜在扩散实现文本到音频，并泛化到音乐、音效和语音。

### 混合方案（生产级）——Suno、Udio、Lyria

闭源权重。很可能是「自回归编解码语言模型（AR codec LM）+ 基于扩散的声码器（vocoder）」，并配有专门的人声 / 鼓点 / 旋律生成头。Suno v5（2026）以 ELO 1293 的成绩成为质量领跑者。Udio v4 新增了局部重绘 + 音轨分离（贝斯、鼓、人声可分别下载）。

### 评测

- **FAD（Fréchet Audio Distance，弗雷歇音频距离）。** 使用 VGGish 或 PANNs 特征，衡量生成音频分布与真实音频分布在嵌入层面的距离。数值越低越好。MusicGen small 在 MusicCaps 上为 4.5 FAD；当前最优（SOTA）约 3.0。
- **音乐性（主观）。** 人类偏好打分。Suno v5 以 ELO 1293 领先。
- **文本-音频对齐。** 提示词与输出之间的 CLAP 分数。
- **音乐性瑕疵。** 节拍切换错位、人声乐句漂移、超过 30 秒后结构丢失。

## 2026 年模型版图

| 模型 | 参数量 | 长度 | 人声 | 许可证 |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | 否 | MIT |
| Stable Audio Open | 1.2B | 47 s | 否 | Stability 非商业 |
| ACE-Step XL（2026 年 4 月） | 4B | &gt; 2 min | 是 | Apache-2.0 |
| YuE | 7B | &gt; 2 min | 是，多语言 | Apache-2.0 |
| Suno v5（闭源） | ? | 4 min | 是，ELO 1293 | 商业 |
| Udio v4（闭源） | ? | 4 min | 是 + 音轨分离 | 商业 |
| Google Lyria 3（闭源） | ? | 实时 | 是 | 商业 |
| MiniMax Music 2.5 | ? | 4 min | 是 | 商业 API |

## 法律格局（2025-2026）

- **华纳音乐诉 Suno 和解案。** 金额 5 亿美元。华纳音乐（WMG）现已取得对 Suno 平台上 AI 仿真形象、音乐版权及用户生成曲目的监管权。环球音乐（UMG）与 Udio 也达成了类似的和解。
- **欧盟《AI 法案》（EU AI Act）** + **加州 SB 942 法案**：AI 生成的音乐必须予以披露。
- 采用 MIT 许可证的 **Riffusion / MusicGen** 没有合规负担，但也无法生成商业可用的人声。

可安全发布的模式：

1. 仅生成器乐（MusicGen、Stable Audio Open，输出为 MIT/CC0）。
2. 使用带「按次生成授权」的商业 API（Suno、Udio、ElevenLabs Music）。
3. 在自有或已授权的曲库上训练（多数企业最终走向这一条）。
4. 为生成结果打上水印 + 元数据标签。

## 动手构建

### 第 1 步：用 MusicGen 生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三种规格：`small`（300M，快速）、`medium`（1.5B）、`large`（3.3B）。要验证「这个创意能否成立」，small 已经够用。

### 第 2 步：旋律条件生成

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody 接收一个「色度图（chromagram）」，在替换音色的同时保留旋律。适用于「把这段旋律改编成弦乐四重奏」这类需求。

### 第 3 步：FAD 评测

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

计算 VGGish 嵌入距离。适合做曲风级别的回归测试；但不能替代人类听众。

### 第 4 步：接入 LLM-音乐工作流

结合第 7-8 课中的思路：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 实际运用

| 目标 | 技术栈 |
|------|-------|
| 器乐音效设计 | Stable Audio Open |
| 游戏 / 自适应音乐 | Google Lyria RealTime（闭源） |
| 带人声的完整歌曲（商业） | Suno v5 或 Udio v4，需明确授权 |
| 带人声的完整歌曲（开源） | ACE-Step XL 或 YuE |
| 短广告 jingle | 以哼唱参考做旋律条件的 MusicGen melody |
| 音乐视频背景乐 | MusicGen + Stable Video Diffusion |

## 2026 年依然会踩的坑

- **版权洗白式提示词。** 「Song in the style of Taylor Swift」——商业版 Suno/Udio 现在会过滤掉这类提示，但开源模型不会。请自行加一份过滤词表。
- **超过 30 秒后的重复 / 漂移。** 自回归模型会陷入循环。可对多次生成结果做交叉淡化（crossfade），或改用 ACE-Step 来保证结构连贯性。
- **节奏漂移。** 模型会偏离设定的 BPM。在提示词中加上 BPM 标签，并用 librosa 的 `beat_track` 做后过滤。
- **人声可懂度。** Suno 表现出色；开源模型在咬字上往往含糊不清。如果歌词很重要，请使用商业 API 或自行微调。
- **单声道输出。** 开源模型生成的是单声道或伪立体声。可用专门的立体声重建方案升级（ezst、Cartesia 的立体声扩散）。

## 交付成果

保存为 `outputs/skill-music-designer.md`。为一次音乐生成部署选定模型、授权策略、长度 / 结构规划，以及披露元数据。

## 练习

1. **简单。** 运行 `code/main.py`。它会以 ASCII 符号生成一段「生成式」和弦进行 + 鼓点模式——一个音乐生成的简笔示意。如果愿意，可以用任意 MIDI 渲染器播放出来。
2. **中等。** 安装 `audiocraft`，用 MusicGen-small 针对 4 个曲风提示词各生成一段 10 秒片段，并对照一组参考曲风测量 FAD。
3. **困难。** 使用 ACE-Step（或 MusicGen-melody），对同一段旋律用不同音色提示词生成三个变体。计算其与提示词的 CLAP 相似度以验证对齐效果。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| FAD | 音频版 FID | 真实与生成音频嵌入分布之间的 Fréchet 距离。 |
| Chromagram（色度图） | 把旋律表示为音高 | 每帧 12 维向量；旋律条件生成的输入。 |
| Stems（音轨） | 各乐器轨道 | 分离出的贝斯 / 鼓 / 人声 / 旋律，以 WAV 形式存在。 |
| Inpainting（局部重绘） | 重新生成某一段 | 遮盖一个时间窗口，让模型只重新生成该部分。 |
| CLAP | 音频版 CLIP | 对比式音频-文本嵌入；用于评测文本-音频对齐。 |
| EnCodec | 音乐编解码器 | Meta 的神经编解码器，被 MusicGen 使用；32 kHz，4 个码本。 |

## 延伸阅读

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) —— 开源自回归基准。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) —— 音效设计的默认之选。
- [ACE-Step](https://github.com/ace-step/ACE-Step) —— 开源 4B 完整歌曲生成器，2026 年 4 月。
- [Suno v5 平台文档](https://suno.com) —— 商业质量领跑者。
- [AudioLDM2](https://arxiv.org/abs/2308.05734) —— 用于音乐 + 音效的潜在扩散。
- [华纳音乐-Suno 和解案报道](https://www.musicbusinessworldwide.com/suno-warner-music-settlement/) —— 2025 年 11 月的判例。
