# 音乐生成 — MusicGen、Stable Audio、Suno 与授权许可地震

> 2026 年的音乐生成：Suno v5 和 Udio v4 主导商业领域；MusicGen、Stable Audio Open 和 ACE-Step 领跑开源。技术问题基本已被解决。法律问题（华纳音乐 5 亿美元和解案、UMG 和解案）在 2025-2026 年重塑了这个领域。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms)、Phase 4 · 10 (Diffusion Models)
**Time:** 约 75 分钟

## 问题所在

文本 → 一段 30 秒至 4 分钟的音乐片段，包含歌词、人声和结构。三个子问题：

1. **纯器乐生成。** "lo-fi hip-hop 鼓点配温暖键盘” 之类的文本 → 音频。MusicGen、Stable Audio、AudioLDM。
2. **歌曲生成（含人声 + 歌词）。** "一首关于德克萨斯雨夜乡村歌曲” → 完整歌曲。Suno、Udio、YuE、ACE-Step。
3. **条件化 / 可控生成。** 延长现有片段、重新生成过渡段、切换流派、分轨分离或修复（inpaint）。Udio 的 inpainting + 分轨分离是 2026 年竞相追赶的功能。

## 核心概念

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### 基于神经编解码器 token 的 token 语言模型

Meta 的 **MusicGen**（2023，MIT 许可）以及众多衍生模型：以文本/旋律 embedding 为条件，自回归地预测 EnCodec token（32 kHz，4 个 codebook），再用 EnCodec 解码。参数量 300M - 3.3B。是强大的基线；超过 30 秒表现不佳。

**ACE-Step**（开源，4B XL 于 2026 年 4 月发布）将其扩展为歌词条件的完整歌曲生成。这是开源社区最接近 Suno 的东西。

### 基于 mel 频谱或潜在空间的扩散模型

**Stable Audio (2023)** 和 **Stable Audio Open (2024)**：在压缩音频上的 latent diffusion。擅长循环乐句、音效设计和环境音纹理。不擅长结构化的完整歌曲。

**AudioLDM / AudioLDM2**：通过 T2I 风格的 latent diffusion 实现文本到音频，并推广至音乐、音效和语音。

### 混合式（生产级）— Suno、Udio、Lyria

闭源权重。很可能是 AR codec LM + 基于扩散的 vocoder，并带有专门的人声/鼓点/旋律输出头。Suno v5（2026）是 ELO 1293 的质量领跑者。Udio v4 增加了 inpainting + 分轨分离（贝斯、鼓、人声可分别下载）。

### 评估

- **FAD (Fréchet Audio Distance)。** 使用 VGGish 或 PANNs 特征，计算生成音频分布与真实音频分布在 embedding 层面的距离。数值越低越好。MusicGen small：在 MusicCaps 上 FAD 为 4.5；SOTA 约 3.0。
- **音乐性（主观）。** 人类偏好。Suno v5 以 ELO 1293 领先。
- **文本-音频对齐。** 提示词与输出之间的 CLAP 分数。
- **音乐性伪影。** 节拍错位的过渡、乐句人声漂移、超过 30 秒后结构崩坏。

## 2026 年模型图谱

| 模型 | 参数量 | 长度 | 人声 | 许可证 |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 秒 | 无 | MIT |
| Stable Audio Open | 1.2B | 47 秒 | 无 | Stability 非商业 |
| ACE-Step XL（2026 年 4 月） | 4B | &gt; 2 分钟 | 有 | Apache-2.0 |
| YuE | 7B | &gt; 2 分钟 | 有，多语言 | Apache-2.0 |
| Suno v5（闭源） | ? | 4 分钟 | 有，ELO 1293 | 商业 |
| Udio v4（闭源） | ? | 4 分钟 | 有 + 分轨 | 商业 |
| Google Lyria 3（闭源） | ? | 实时 | 有 | 商业 |
| MiniMax Music 2.5 | ? | 4 分钟 | 有 | 商业 API |

## 法律格局（2025-2026）

- **华纳音乐与 Suno 和解案。** 5 亿美元。WMG 现在对 Suno 上的 AI 声音模拟、音乐版权及用户生成的曲目拥有监督权。UMG 对 Udio 也有类似和解。
- **EU AI Act** + **California SB 942**：AI 生成的音乐必须予以披露。
- **Riffusion / MusicGen** 采用 MIT 许可，无合规负担，但也没有商业级人声。

可安全上线的模式：

1. 仅生成纯器乐（MusicGen、Stable Audio Open，MIT/CC0 输出）。
2. 使用带逐次生成授权的商业 API（Suno、Udio、ElevenLabs Music）。
3. 在自有或已授权的曲库上训练（大多数企业最终都走这条路）。
4. 为生成内容添加水印 + 元数据标签。

```figure
sp-codec-tokens
```

## 动手构建

### 步骤 1：用 MusicGen 生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三种规模：`small`（300M，快速）、`medium`（1.5B）、`large`（3.3B）。验证想法是否可行，small 就够了。

### 步骤 2：旋律条件化

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody 接收 chromagram，在保留曲调的同时更换音色。适用于“把这段旋律变成弦乐四重奏”。

### 步骤 3：FAD 评估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

计算 VGGish-embedding 距离。适用于流派级别的回归测试；不能替代真人听感评估。

### 步骤 4：接入 LLM-音乐工作流

与第 7-8 课的思路相结合：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 应用场景

| 目标 | 技术栈 |
|------|-------|
| 器乐音效设计 | Stable Audio Open |
| 游戏 / 自适应音乐 | Google Lyria RealTime（闭源） |
| 含人声的完整歌曲（商业） | Suno v5 或 Udio v4，附带明确授权 |
| 含人声的完整歌曲（开源） | ACE-Step XL 或 YuE |
| 短广告配乐 | 以哼唱参考做 melody 条件的 MusicGen |
| 音乐视频背景 | MusicGen + Stable Video Diffusion |

## 2026 年仍会踩的坑

- **版权洗白式提示词。** “泰勒·斯威夫特风格的歌曲” — 商业的 Suno/Udio 现在会过滤这类提示，开源模型不会。请自行添加过滤列表。
- **超过 30 秒的重复 / 漂移。** AR 模型会循环。可对多次生成结果做交叉淡化，或使用 ACE-Step 保持结构连贯性。
- **节奏漂移。** 模型会偏离 BPM。在提示词中使用 BPM 标签，并用 librosa 的 `beat_track` 做后置过滤。
- **人声清晰度。** Suno 表现优秀；开源模型的歌词往往含混不清。如果歌词很重要，请使用商业 API 或做微调。
- **单声道输出。** 开源模型生成单声道或伪立体声。需要用真正的立体声重建来升级（ezst、Cartesia 的 stereo diffusion）。

## 上线交付

保存为 `outputs/skill-music-designer.md`。为音乐生成部署选定模型、授权策略、长度/结构方案以及披露元数据。

## 练习

1. **简单。** 运行 `code/main.py`。它会以 ASCII 符号生成"生成式"和弦进行 + 鼓点模式 — 一幅音乐生成的漫画。需要的话可通过任意 MIDI 渲染器播放。
2. **中等。** 安装 `audiocraft`，用 MusicGen-small 在 4 个流派提示下生成 10 秒片段，并对照一个参考流派集合测量 FAD。
3. **困难。** 使用 ACE-Step（或 MusicGen-melody），用不同的音色提示生成同一段旋律的三个变体。计算与提示词的 CLAP 相似度以验证对齐。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| FAD | 音频版 FID | 真实音频与生成音频的 embedding 分布之间的 Fréchet 距离。 |
| Chromagram | 音高形式的旋律 | 每帧 12 维向量；旋律条件化的输入。 |
| Stems | 乐器音轨 | 分离出的贝斯/鼓/人声/旋律，以 WAV 格式保存。 |
| Inpainting | 重新生成某段 | 掩盖一个时间窗口；模型只重新生成该部分。 |
| CLAP | 文本-音频版 CLIP | 对比式音频-文本 embedding；用于评估文本-音频对齐。 |
| EnCodec | 音乐编解码器 | Meta 的神经编解码器，MusicGen 所用；32 kHz，4 个 codebook。 |

## 延伸阅读

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) — 开源自回归基准。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) — 音效设计的默认选择。
- [ACE-Step](https://github.com/ace-step/ACE-Step) — 开源 4B 完整歌曲生成器，2026 年 4 月。
- [Suno v5 平台文档](https://suno.com) — 商业质量领跑者。
- [AudioLDM2](https://arxiv.org/abs/2308.05734) — 面向音乐 + 音效的 latent diffusion。
- [WMG-Suno 和解案报道](https://www.musicbusinessworldwide.com/suno-warner-music-settlement/) — 2025 年 11 月的先例。