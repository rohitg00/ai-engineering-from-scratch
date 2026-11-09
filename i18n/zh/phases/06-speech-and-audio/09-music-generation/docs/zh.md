# 音乐世代 音乐世代,稳定音频,苏诺,许可证地震

> 2026年音乐代:Suno v5和Udio v4占据商业主导地位; MusicGen,Stable Audio Open和 ACE-Step引领开源.技术问题大多得到解决.法律问题 (Warner Music 500M美元和解,UMG和解) 在2025-2026年重新塑造了该领域.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## 问题

文字 → 30 秒到 4 分钟的音乐片段,歌词,歌声和结构.

1. **Instrumental generation.**文字如"热键的洛菲哈普鼓" →音频.
2. **Song generation (with vocals + lyrics).**关于雨天的德克萨斯州夜晚的乡村歌曲.
3. **Conditional / controllable.**扩展现有剪辑,再生桥梁,交换类型,干部分离或涂料.Udio的涂料+干部分离是2026年配合的功能.

## 概念

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### 标志 LM 与神经编码标志相比

标签**MusicGen**根据"中文代码"的定义,它可以使用"中文代码" (MIT) 和许多衍生品:文字/旋律嵌入式的条件,可自行预测EnCodec代码 (32 kHz, 4 代码书),可用EnCodec解码. 300M - 3.3B参数.强基线;超过 30 秒的斗争.

**ACE-Step**开源,4B XL发布于2026年4月. 这将扩展到全歌曲歌词的生成.

### 化或隐藏物间的化

**Stable Audio (2023)**其他**Stable Audio Open (2024)**音,音响设计,环境纹理,结构性完整歌曲不太好.

**AudioLDM / AudioLDM2**通过T2I式的隐藏传播,将其通用到音乐,音效,语音.

### 混合动力 (制作) 苏诺,乌迪奥,丽亚

密闭重量.可能是AR编码器LM+基于扩散的声码器,具有专业的声音/鼓/旋律头.Suno v5 (2026) 是ELO 1293质量领导者.Udio v4增加了涂料+干部分离 (低音,鼓,声声单独下载).

### 评估

- **FAD (Fréchet Audio Distance).**嵌入级距离在使用VGGish或PANN功能生成与真实的音频分发之间.较低更好.音乐Gen小: MusicCaps上的4.5 FAD;SOTA ~3.0.
- **Musicality (subjective).**人类偏好.苏诺V5ELO1293导向.
- **Text-audio alignment.**快速和输出之间的CLAP分数.
- **Musicality artifacts.**音频转变,声语漂移,30秒后结构损失.

## 2026年模型地图

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## 法律环境 (2025-2026)

- **Warner Music vs Suno settlement.**现在WMG已经监督了Suno的AI相似性,音乐权利和用户生成的曲目.
- **EU AI Act**其他**California SB 942**必须披露人工智能生成的音乐.
- **Riffusion / MusicGen**没有合规包装,也没有商业声.

安全到船的模式:

1. 仅生成仪器 (MusicGen,稳定音频开放,MIT/CC0输出).
2. 使用商业API (Suno,Udio,ElevenLabs Music) 按一代许可.
3. 列车在拥有或授权的目录上 (大多数企业都在此结束).
4. 标签生成器用水标+元数据.

```figure
sp-codec-tokens
```

## 建立它

### 步骤1:使用 MusicGen生成

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

三个尺寸:`small`快速的`medium`其他国家`large`3.3B. 对于"想法能实现"而言,小就足够了.

### 步骤2:调节旋律

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

音乐Gen-melody在调音调换时会采用染色符号,保存调音.

### 步骤3:FAD评估

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

对于类型水平回归测试有用,而不是替代人类听者.

### 步骤4:加入LLM音乐工作流程

结合了从第七到八课的想法:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 用它

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## 陷在2026年仍存在

- **Copyright-laundering prompts.**现在,开放型号不了. 添加自己的过列表.
- **Repetition / drift past 30 s.**交叉多代,或使用ACE-Step来实现结构一致性.
- **Tempo drift.**通过图书馆的提示和后过器使用BPM标签.`beat_track`现在,我们要去.
- **Vocal intelligibility.**苏诺很好,开放式模型通常是不熟悉的.如果歌词很重要,请使用商业API或细节调节.
- **Mono output.**开放型号生成单声或假声. 通过适当的声波重建升级 (例如,卡特西亚的声波扩散).

## 运送它

保存如`outputs/skill-music-designer.md`选择模式,许可战略,长度/结构计划,以及披露音乐代部署的元数据.

## 运动

1. **Easy.**跑步`code/main.py`它产生"生成"和弦进步 + 鼓模式作为ASCII符号音乐代动画.
2. **Medium.**安装`audiocraft`通过 MusicGen-small生成10秒的视频,
3. **Hard.**使用ACE-Step (或 MusicGen-melody) 来生成相同旋律的三个变化,使用不同的调音提示.计算CLAP与提示的相似性来验证对齐.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## 进一步阅读

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284)开放的反向性基准指数.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358)默认的音响设计.
- [ACE-Step](https://github.com/ace-step/ACE-Step)开放4B全歌发电机,2026年4月.
- [Suno v5 platform docs](https://suno.com)商业质量领导者.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) 音乐+音效的隐藏传播.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/)2025年11月前例.
