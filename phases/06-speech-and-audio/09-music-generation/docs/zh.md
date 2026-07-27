# 音乐生成——MusicGen、Stable Audio、Suno 与许可地震

> 2026 年的音乐生成：Suno v5 和 Udio v4 主导商业领域；MusicGen、Stable Audio Open 和 ACE-Step 引领开源领域。技术问题基本已解决。法律问题（华纳音乐 5 亿美元和解、UMG 和解）在 2025-2026 年重塑了整个领域。

**类型：** 动手构建
**语言：** Python
**前置知识：** 阶段 6 · 02（频谱图），阶段 4 · 10（扩散模型）
**时间：** ~75 分钟

## 问题

文本 → 30 秒到 4 分钟的音乐片段，带歌词、人声和结构。三个子问题：

1. **器乐生成。** 像"lo-fi hip-hop drums with warm keys"这样的文本 → 音频。MusicGen、Stable Audio、AudioLDM。
2. **歌曲生成（带人声+歌词）。** "关于德州雨夜的乡村歌曲" → 完整歌曲。Suno、Udio、YuE、ACE-Step。
3. **条件式/可控生成。** 扩展现有片段、重新生成桥段、切换风格、音轨分离或修补。Udio 的修补 + 音轨分离是 2026 年需要追赶的功能。

## 概念

![音乐生成：token-LM vs 扩散，2026 年模型地图](../assets/music-generation.svg)

### 基于神经编解码器 token 的 token LM

Meta 的 **MusicGen**（2023，MIT 许可）及其众多衍生模型：以文本/旋律嵌入为条件，自回归预测 EnCodec token（32 kHz，4 个码本），用 EnCodec 解码。3 亿 - 33 亿参数。强大的基线；在 30 秒以上表现不佳。

**ACE-Step**（开源，4B XL 版本于 2026 年 4 月发布）扩展了此方法，用于全歌曲歌词条件生成。开源社区中最接近 Suno 的选择。

### 基于 Mel 或潜在空间的扩散

**Stable Audio (2023)** 和 **Stable Audio Open (2024)**：对压缩音频进行潜在扩散。在循环片段、声音设计、环境纹理方面表现出色。在结构性完整歌曲方面不太行。

**AudioLDM / AudioLDM2**：通过 T2I 风格的潜在扩散实现文本到音频，泛化到音乐、音效、语音。

### 混合型（生产级）——Suno、Udio、Lyria

闭源权重。可能是 AR 编解码器 LM + 扩散声码器，带有专门的语音/鼓/旋律头。Suno v5（2026）是 ELO 1293 质量领先者。Udio v4 增加了修补 + 音轨分离（贝斯、鼓、人声可单独下载）。

### 评估

- **FAD（Fr échet Audio Distance）。** 使用 VGGish 或 PANNs 特征在生成音频与真实音频分布之间的嵌入级距离。越低越好。MusicGen small：在 MusicCaps 上 FAD 4.5；SOTA 约 3.0。
- **音乐性（主观）。** 人类偏好。Suno v5 ELO 1293 领先。
- **文本-音频对齐。** 提示与输出之间的 CLAP 分数。
- **音乐性伪影。** 拍子不对的过渡、人声短语漂移、30 秒后结构丧失。

## 2026 年模型地图

| 模型 | 参数量 | 时长 | 人声 | 许可 |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 秒 | 否 | MIT |
| Stable Audio Open | 1.2B | 47 秒 | 否 | Stability 非商业 |
| ACE-Step XL（2026 年 4 月） | 4B | > 2 分钟 | 是 | Apache-2.0 |
| YuE | 7B | > 2 分钟 | 是，多语言 | Apache-2.0 |
| Suno v5（闭源） | ? | 4 分钟 | 是，ELO 1293 | 商业 |
| Udio v4（闭源） | ? | 4 分钟 | 是 + 音轨 | 商业 |
| Google Lyria 3（闭源） | ? | 实时 | 是 | 商业 |
| MiniMax Music 2.5 | ? | 4 分钟 | 是 | 商业 API |

## 法律格局（2025-2026）

- **华纳音乐 vs Suno 和解。** 5 亿美元。WMG 现在对 Suno 上的 AI 肖像、音乐版权和用户生成曲目拥有监督权。类似的 UMG 对 Udio 的和解。
- **欧盟 AI Act** + **California SB 942**：AI 生成的音乐必须披露。
- **Riffusion / MusicGen** 基于 MIT 许可没有合规负担，但也没有商业人声。

可安全发布的模式：

1. 仅生成器乐（MusicGen、Stable Audio Open，MIT/CC0 输出）。
2. 使用商业 API（Suno、Udio、ElevenLabs Music）并附带每次生成的许可。
3. 在自有或授权曲目上训练（大多数企业最终选择此方案）。
4. 为生成内容打上水印 + 元数据标签。

## 动手实现

### 第 1 步：使用 MusicGen 生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三种尺寸：`small`（300M，快速）、`medium`（1.5B）、`large`（3.3B）。Small 足以验证"这个创意是否可行"。

### 第 2 步：旋律条件生成

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody 接受 chromagram 输入，在交换音色的同时保留曲调。可用于"把这个旋律变成弦乐四重奏"。

### 第 3 步：FAD 评估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

计算 VGGish 嵌入距离。用于流派级别的回归测试；不能替代人类听众。

### 第 4 步：融入 LLM-音乐工作流

结合第 7-8 课的思想：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 使用建议

| 目标 | 技术栈 |
|------|-------|
| 器乐声音设计 | Stable Audio Open |
| 游戏/自适应音乐 | Google Lyria RealTime（闭源） |
| 带人声的完整歌曲（商业） | Suno v5 或 Udio v4，附带明确许可 |
| 带人声的完整歌曲（开源） | ACE-Step XL 或 YuE |
| 短广告曲 | MusicGen 基于哼唱参考的旋律条件生成 |
| 音乐视频背景 | MusicGen + Stable Video Diffusion |

## 2026 年仍然常见的陷阱

- **洗版权提示。** "Taylor Swift 风格的歌曲"——商业版 Suno/Udio 现在会过滤这些，开源模型不会。添加你自己的过滤列表。
- **30 秒后的重复/漂移。** AR 模型会循环。交叉淡入淡出多个生成结果，或使用 ACE-Step 实现结构连贯性。
- **速度漂移。** 模型会偏离 BPM。在提示中使用 BPM 标签，并用 librosa 的 `beat_track` 进行后处理过滤。
- **人声可懂度。** Suno 表现出色；开源模型在人声词语上通常含糊不清。如果歌词很重要，使用商业 API 或微调。
- **单声道输出。** 开源模型生成单声道或假立体声。使用合适的立体声重建方案（ezst、Cartesia 的立体声扩散）升级。

## 交付物

保存为 `outputs/skill-music-designer.md`。为音乐生成部署选择模型、许可策略、时长/结构方案和披露元数据。

## 练习

1. **简单。** 运行 `code/main.py`。它生成一个"生成式"和弦进行 + 鼓模式，用 ASCII 符号表示——一个音乐生成的卡通版本。如果你想，可以通过任何 MIDI 渲染器播放。
2. **中等。** 安装 `audiocraft`，用 MusicGen-small 在 4 个流派提示下生成 10 秒片段，测量与参考流派集的 FAD。
3. **困难。** 使用 ACE-Step（或 MusicGen-melody），用不同的音色提示生成同一曲调的三个变体。计算与提示的 CLAP 相似度以验证对齐度。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| FAD | 音频 FID | 真实与生成嵌入分布之间的 Fréchet 距离。 |
| Chromagram | 旋律的音高表示 | 每帧 12 维向量；旋律条件生成的输入。 |
| Stems（音轨） | 乐器轨道 | 分离的贝斯/鼓/人声/旋律 WAV。 |
| Inpainting（修补） | 重新生成某段 | 遮蔽时间窗口；模型仅重新生成该部分。 |
| CLAP | 文本-音频 CLIP | 对比式音频-文本嵌入；评估文本-音频对齐。 |
| EnCodec | 音乐编解码器 | Meta 的神经编解码器，MusicGen 使用；32 kHz，4 个码本。 |

## 延伸阅读

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284)——开源自回归基准。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358)——声音设计默认方案。
- [ACE-Step](https://github.com/ace-step/ACE-Step)——2026 年 4 月发布的 4B 开源全歌曲生成器。
- [Suno v5 platform docs](https://suno.com)——商业质量领导者。
- [AudioLDM2](https://arxiv.org/abs/2308.05734)——音乐 + 音效的潜在扩散。
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/suno-warner-music-settlement/)——2025 年 11 月的先例。
