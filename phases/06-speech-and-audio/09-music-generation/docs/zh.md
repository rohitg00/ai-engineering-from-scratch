# 音乐一代- MusicGen、Stable Audio、Suno和许可地震

> 2026年音乐世代：Suno v5和Udio v4主导商业; MusicGen、Stable Audio Open和ACE-Step主导开源。技术问题基本解决。法律问题（华纳音乐5亿美元和解，UMG和解）在2025-2026年重塑了该领域。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 02（光谱图）、阶段4 · 10（扩散模型）
** 时间：** ~75分钟

## 问题

文本-30秒至4分钟的音乐片段，包含歌词、人声和结构。三个子问题：

1. ** 工具一代。**文本类似“带有温暖键的低保真嘻哈鼓”的文本-音频。MusicGen、稳定音频、AudioLDM。
2. ** 歌曲生成（人声+歌词）。**“关于德克萨斯州雨夜的乡村歌曲”-完整歌曲。Suno、Udio、YuE、ACE-Step。
3. ** 有条件/可控。**扩展现有剪辑、重新生成桥梁、交换类型、分离茎或修补。Udio的修补+茎分离是2026年的配套功能。

## 概念

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### 神经编解码器令牌上的令牌LM

Meta的 **MusicGen**（2023年，麻省理工学院）和许多衍生作品：文本/旋律嵌入条件、自回归预测EnCodec令牌（32 GHz，4个码本）、使用EnCodec解码。300 M- 3.3B参数。基线较强;挣扎超过30秒。

**ACE-Step**（开源，4 B XL于2026年4月发布）扩展了这一功能，用于完整歌曲歌词条件生成。开放社区是最接近Suno的地方。

### 熔液或潜伏物上的扩散

** 稳定音频（2023）** 和 ** 稳定音频开放（2024）**：压缩音频的潜在扩散。擅长循环、声音设计、环境纹理。不擅长结构完整的歌曲。

**AudioLDM /AudioLDM 2 **：通过T2 I式潜在扩散进行文本到音频，概括为音乐、音效、语音。

### 混合动力（生产）- Suno，Udio，Lyria

封闭的重量。可能是AR编解码器LM +基于扩散的声码器，具有专门的语音/鼓/旋律头。Suno v5（2026）是ELO 1293质量领导者。Udio v4添加了修补+词干分离（低音、鼓、人声单独下载）。

### 评价

- **FAD（Fréchet音频距离）。**使用VPGish或PANN功能生成的音频分发与真实音频分发之间的嵌入级距离。低越好。MusicGen小号：MusicCaps上的FAD为4.5; SOTA ~3.0。
- ** 音乐性（主观）。**人类的偏好。Suno v5 ELO 1293领先。
- ** 文本音频对齐。**提示和输出之间的CLAP得分。
- ** 音乐性文物。**跑调过渡、人声短语漂移、30年代后结构丧失。

## 2026年模型地图

| 模型 | Params | 长度 | 人声 | 许可证 |
|-------|--------|--------|--------|---------|
| Music Gen-large | 3.3B | 30 s | 没有 | MIT |
| 稳定的音频打开 | 1.2B | 47突击步枪 | 没有 | 稳定性非商业性 |
| ACE-Step XL（2026年4月） | 4B | &gt;2分钟 | 是的 | Apache-2.0 |
| 岳 | 7B | &gt;2分钟 | 是的，多语言 | Apache-2.0 |
| Suno v5（已关闭） | ? | 4分钟 | 是的，ELO 1293 | 商业 |
| Udio v4（已结束） | ? | 4分钟 | 是+词干 | 商业 |
| Google Lyria 3（已关闭） | ? | 实时 | 是的 | 商业 |
| MiniMax音乐2.5 | ? | 4分钟 | 是的 | 商业API |

## 法律格局（2025-2026年）

- ** 华纳音乐与Suno和解。** 5亿美元。WMG现在负责监督Suno上的人工智能相似性、音乐版权和用户生成的曲目。UMG在Udio上的类似和解。
- ** 欧盟人工智能法案 ** + ** 加州SB 942**：必须披露人工智能生成的音乐。
- 麻省理工学院旗下的 ** Rifferty/ MusicGen** 没有合规负担，但也没有商业声音。

安全运输模式：

1. 仅生成器乐（MusicGen、稳定音频开放、MIT/CC 0输出）。
2. 使用具有每一代许可的商业API（Suno、Udio、ElevenLabs Music）。
3. 根据拥有或许可的目录进行培训（大多数企业最终都会在这里）。
4. 使用水印+元数据标记世代。

## 建设党

### 步骤1：使用MusicGen生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三种尺寸：“小”（300 M，快速）、“中”（1.5B）、“大”（3.3B）。小就足够了”这个想法落地了。"

### 2.旋律条件反射

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody采用彩色打印机并在交换音色时保留曲调。对于“把这首旋律作为弦乐四重奏给我有用。"

### 第3步：FAD评估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

计算VGish嵌入距离。对于流派级回归测试有用;不能替代人类听众。

### 步骤4：添加到LLM-music工作流

结合第7-8课的想法：

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 使用它

| 目标 | 堆叠 |
|------|-------|
| 器乐音响设计 | 稳定的音频打开 |
| 游戏/自适应音乐 | Google Lyria RealTime（已关闭） |
| 完整歌曲含人声（商业） | 具有明确许可证的Suno v5或Udio v4 |
| 完整歌曲含人声（打开） | ACE-Step XL或YuE |
| 短广告顺口溜 | MusicGen旋律-以哼唱的参考为条件 |
| 音乐视频背景 | MusicGen +稳定的视频传播 |

## 2026年仍存在的陷阱

- ** 版权洗钱提示。**“泰勒·斯威夫特风格的歌曲”-商业Suno/Udio现在过滤了这些，开放模型却没有。添加您自己的过滤器列表。
- ** 重复/漂移超过30秒。** AR模型循环。交叉淡化多代，或使用ACE-Step实现结构一致性。
- ** 节奏漂移。**模型偏离BPM。在提示和后过滤器中使用BPM标签，并使用librosa的“beat_track”。
- ** 声音清晰度 ** Suno是优秀的;开放的模型往往是糊状的话。如果歌词很重要，请使用商业API或微调。
- ** 单音输出。**开放模型生成单声或假立体声。通过适当的立体声重建进行升级（ezst，Cartesia的立体声扩散）。

## 把它运

另存为“输出/skill-music-designer.md”。为音乐世代部署选择模型、许可策略、长度/结构计划和披露元数据。

## 演习

1. ** 简单。**运行'代码/main.py '。它产生一个“生成”和弦进行+鼓模式作为ASCII符号-一个音乐生成卡通。如果你愿意，可以通过任何渲染器播放。
2. ** 中等。**安装“audiocraft”，使用MusicGen-small在4个流派提示中生成10秒的剪辑，根据参考流派集测量FAD。
3. ** 很难。**使用ACE-Step（或MusicGen-melody），生成具有不同音色提示的同一曲调的三个变体。计算CLAP与提示的相似性以验证对齐。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| FAD | 音频FID | 真实与生成的嵌入分布之间的Fréchet距离。 |
| 色度图 | 旋律作为音调 | 12-每帧暗淡的载体;旋律条件反射的输入。 |
| 茎 | 乐器轨道 | 将低音/鼓/人声/旋律分离为WAV。 |
| 修复 | 再生一段 | 掩盖一个时间窗口;模型就是再生这个时间窗口。 |
| 鼓掌 | 文本音频剪辑 | 对比音频-文本嵌入;评估文本-音频对齐。 |
| EnCodec | 音乐编解码器 | MusicGen使用的Meta神经编解码器; 32 GHz，4个代码本。 |

## 进一步阅读

- [Copet et al.（2023）. MusicGen]（https：//arxiv.org/abs/2306.05284）-开放自回归基准。
- [Evans等人（2024）。稳定音频打开]（https：//arxiv.org/abs/2407.14358）-声音设计默认。
- [ACE-Step]（https：//github.com/ace-step/ACE-Step）-开放4 B完整歌曲生成器，2026年4月。
- [Suno v5平台文档]（https：suno.com）-商业质量领导者。
- [AudioLDM 2]（https：//arxiv.org/abs/2308.05734）-音乐+音效的潜在扩散。
- [WMG-Suno和解报道]（https：//www.musicbusinessworldwide.com/suno-warner-music-settlement/）-2025年11月先例。
