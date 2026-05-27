# 视频生成（Video Generation）

> 图像是一个二维张量。视频是一个三维张量。理论相同，但计算量难10-100倍。OpenAI的Sora（2024年2月）证明了其可行性。到2026年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0和WAN 2.2已能从文本生成1080p的生产级视频——而开源权重（CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2）落后约12个月。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段8 · 07（潜在扩散模型Latent Diffusion）、阶段7 · 09（视觉Transformer ViT）、阶段8 · 06（DDPM）
**时间：** 约45分钟

## 问题

一段10秒1080p、24fps的视频包含240帧1920×1080×3像素。每段片段原始数据约1.5 GB。像素空间扩散不可行。你需要：

1. **时空压缩（Spatiotemporal compression）。** 一种VAE，对视频（而非帧）进行编码，编码成一系列时空块（spatiotemporal patches）。
2. **时间一致性（Temporal coherence）。** 帧需要在数秒内共享内容、光照和物体身份。网络必须建模运动。
3. **计算预算。** 视频训练比同规模图像模型贵10-100倍。
4. **条件控制（Conditioning）。** 文本、图像（首帧）、音频或另一段视频。大多数生产模型都支持这四种输入。

解决此问题的架构是应用于时空块的**扩散Transformer（Diffusion Transformer, DiT）**，在海量（提示、字幕、视频）数据集上训练。扩散损失与第06课相同。

## 概念

![视频扩散：分块（patchify）、DiT、解码](../assets/video-generation.svg)

### 分块（Patchify）

使用3D VAE（学习的时空压缩）对视频进行编码。潜在张量形状为 `[T_latent, H_latent, W_latent, C_latent]`。将其分割成大小为 `[t_p, h_p, w_p]` 的块。对于Sora风格的模型，`t_p = 1`（逐帧块）或 `t_p = 2`（每两帧一个块）。一段10秒1080p视频压缩后约包含20,000-100,000个块。

### 时空DiT（Spatiotemporal DiT）

一个Transformer处理块的平坦序列。每个块都有一个3D位置嵌入（时间 + y + x）。注意力通常被分解：

- **空间注意力（Spatial attention）**：每个帧内部的块之间。
- **时间注意力（Temporal attention）**：跨帧、同一空间位置之间。
- **全3D注意力**：计算量贵16-100倍；仅在低分辨率或研究中使用。

### 文本条件

与大型文本编码器（Sora使用T5-XXL，CogVideoX-5B也使用T5-XXL）进行交叉注意力。长提示很重要——Sora的训练集使用了GPT生成的密集重标注（dense re-captions），每个片段平均200个token。

### 训练

对时空潜在变量使用标准扩散损失（ε或v预测）。数据：网络视频 + 约1亿条精选片段 + 合成文本字幕。计算量：即使是小型研究实验也需要10,000+ GPU小时；Sora规模则需要100,000+。

## 2026年生产环境概览

| 模型 | 日期 | 最大时长 | 最大分辨率 | 开源权重？ | 备注 |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60秒 | 1080p | 否 | 首个在规模上展现世界模拟器属性的模型 |
| Sora Turbo | 2024-12 | 20秒 | 1080p | 否 | 生产级Sora，推理速度提升5倍 |
| Veo 2 (谷歌) | 2024-12 | 8秒 | 4K | 否 | 2025年最高质量 + 最佳物理效果 |
| Veo 3 | 2025年第三季度 | 15秒 | 4K | 否 | 原生音频和更强的相机控制 |
| Kling 1.5 / 2.1 (快手) | 2024-2025 | 10秒 | 1080p | 否 | 2025年第一季度最佳人物运动 |
| Runway Gen-3 Alpha | 2024-06 | 10秒 | 768p | 否 | 其上还有专业视频工具 |
| Pika 2.0 | 2024-10 | 5秒 | 1080p | 否 | 最强的角色一致性 |
| CogVideoX (智谱AI) | 2024 | 10秒 | 720p | 是 (2B, 5B) | 首个开源5B规模视频模型 |
| HunyuanVideo (腾讯) | 2024-12 | 5秒 | 720p | 是 (13B) | 2024年底开源SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4秒 | 480p | 是 (10B) | 最开放的许可证 |
| WAN 2.2 (阿里巴巴) | 2025-07 | 5秒 | 720p | 是 | 2025年中最强开源模型 |

开源权重在视频领域的差距缩小速度比图像领域更快：到2026年中，HunyuanVideo + WAN 2.2的LoRA已经支撑了大多数开源工作流。

## 构建它

`code/main.py` 模拟了核心的时空DiT思想：将一个小型合成视频分块，为每个块添加位置嵌入，然后使用Transformer风格的注意力对整个序列进行去噪。不使用numpy；纯Python。我们展示了即使在一维情况下，当相邻帧的块共享去噪器和位置嵌入时，时间一致性也会出现。

### 第1步：将合成的一维“视频”分块

```python
def make_video(T_frames=8, rng=None):
    # 一个“视频”是沿着平滑轨迹变化的一维值序列
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### 第2步：每帧的位置嵌入

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### 第3步：去噪器看到整个序列

我们的小型网络不是独立地对每帧去噪，而是将所有帧的值及其位置嵌入拼接起来，联合预测整个序列的噪声。

### 第4步：时间一致性测试

训练后，采样一个视频。测量帧与帧之间的差值（delta）。如果模型已经学习了时间结构，那么这些差值会比独立采样每帧时更小。

## 常见陷阱

- **独立逐帧采样 = 闪烁（flicker）。** 如果对每帧单独运行图像扩散，输出会闪烁，因为每帧的噪声是独立的。视频扩散通过注意力或共享噪声来耦合帧，从而解决此问题。
- **朴素3D注意力 = 内存溢出（OOM）。** 对10秒1080p潜在张量进行全3D注意力计算需要数千亿次操作。应分解为空间 + 时间注意力。
- **数据字幕比数据规模更重要。** Sora相比之前工作的主要升级是使用了大约10倍更详细的字幕（GPT-4重新标注的片段）。OpenAI的技术报告明确指出了这一点。
- **首帧条件控制（First-frame conditioning）。** 大多数生产模型也接受一张图像作为首帧。这就是“图像到视频”模式；训练时包含此变体。
- **物理漂移（Physics drift）。** 长片段（>10秒）会积累细微的不一致。滑动窗口生成 + 关键帧锚定（keyframe anchoring）有助于缓解。

## 使用它

| 使用场景 | 2026年推荐 |
|----------|-----------|
| 最高质量的文本到视频，托管式 | Veo 3 或 Sora |
| 摄像机控制的电影级效果 | Runway Gen-3 配合运动笔刷（motion brushes） |
| 跨片段角色一致性 | Pika 2.0 或 Kling 2.1 |
| 开源权重，快速微调 | WAN 2.2 + LoRA |
| 图像到视频 | WAN 2.2-I2V、Kling 2.1 I2V 或 Runway |
| 音频到视频唇形同步 | Veo 3（原生音频）或专用唇形同步模型 |
| 视频编辑 | Runway Act-Two、Kling Motion Brush、Flux-Kontext（静态帧） |

2024年至2026年间，质量相当的视频每秒成本下降了20倍。

## 交付它

保存 `outputs/skill-video-brief.md`。技能要求：输入一个视频简报（时长、宽高比、风格、镜头方案、主体一致性、音频），输出：模型 + 托管方案、提示框架（镜头语言、主体描述、运动描述）、种子 + 可复现性协议，以及帧级别的质量检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中，比较（a）独立逐帧采样和（b）联合序列采样的帧间差值（delta）。报告差值的均值和方差。
2. **中等。** 添加首帧条件：将第0帧固定为给定值，并采样其余帧。测量固定值如何传播。
3. **困难。** 使用HuggingFace diffusers在本地GPU上运行CogVideoX-2B。对6秒720p片段计时20步推理。分析时空注意力以找出瓶颈。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| 视频VAE（Video VAE） | "3D VAE" | 将 `(T, H, W, C)` 压缩为时空潜在张量的编码器。 |
| 块（Patches） | "令牌（tokens）" | 潜在张量的固定大小3D块；DiT的输入。 |
| 分解注意力（Factorized attention） | "空间 + 时间" | 先做空间注意力，再做时间注意力；避免全3D注意力。 |
| 图像到视频（I2V） | "让这张照片动起来" | 模型接收图像 + 文本，输出从该图像开始的视频。 |
| 关键帧条件（Keyframe conditioning） | "锚定帧（Anchor frames）" | 固定特定帧以控制视频的走向。 |
| 运动笔刷（Motion brush） | "方向提示（Directional hint）" | 用户绘制运动向量到图像上的UI输入。 |
| 重标注（Re-captioning） | "密集字幕（Dense captions）" | 使用大语言模型（LLM）用详细的提示重新标注训练片段。 |
| 闪烁（Flicker） | "时间伪影（Temporal artifact）" | 帧间不一致；通过耦合去噪解决。 |

## 生产注意事项：视频潜在张量是内存带宽问题

一段10秒1080p、24fps的视频是240帧×1920×1080×3 ≈ 1.5 GB的原始像素。经4倍视频VAE压缩（2倍空间×2倍时间）后，每个请求的潜在张量约为100 MB。通过时空DiT运行30步，batch=1，则每一步需通过HBM移动约3 GB数据——瓶颈是内存带宽，而非FLOPs。

三个生产调优旋钮，全部来自生产推理章节：

- **DiT的张量并行（TP）。** 文本到视频模型通常≥10B参数。在4块H100上设置TP=4是标准做法；对于405B级模型则用PP=2×TP=2。每步延迟大致随TP线性下降，直至遇到全规约（all-reduce）瓶颈。
- **帧批处理 = 连续批处理（Continuous batching）。** 在生成时，视频在概念上是由注意力连接的一批帧。连续批处理（飞行中调度）适用：若模型架构允许滑动窗口生成，则可在返回第t-1帧的同时开始渲染第t+1帧。
- **片段级预填充缓存（Clip-level prefill cache）。** 对于图像到视频，首帧条件类似于大语言模型的提示预填充：计算一次，在时间解码器通路中复用。这实际上是一种视频的键值缓存（KV-cache）。

## 延伸阅读

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) — Sora技术报告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) — CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) — HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) — Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) — 2025年中开源SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) — 视频扩散的开创性论文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) — Stable Video Diffusion的前身。