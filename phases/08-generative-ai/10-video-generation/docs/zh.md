# 视频生成

> 图像是 2-D 张量。视频是 3-D 张量。理论相同；计算量难 10-100 倍。OpenAI 的 Sora（2024 年 2 月）证明了这是可能的。到 2026 年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0 和 WAN 2.2 从文本生成 1080p 的生产级视频——而开放权重栈（CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2）落后 12 个月。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 8 · 07（潜在扩散）、阶段 7 · 09（ViT）、阶段 8 · 06（DDPM）
**时间：** ~45 分钟

## 问题

一个 10 秒的 1080p 视频，24fps，是 240 帧 1920×1080×3 像素。每个片段约 1.5 GB 原始数据。像素空间扩散不可行。你需要：

1. **时空压缩。** 一个对视频（而非帧）进行编码的 VAE，将其编码为时空补丁序列。
2. **时间连贯性。** 帧需要在数秒内共享内容、光照和物体身份。网络必须对运动建模。
3. **计算预算。** 对于相同模型大小，视频训练比图像贵 10-100 倍。
4. **条件化。** 文本、图像（首帧）、音频或另一个视频。大多数生产模型接受全部四种。

解决这个问题的架构是应用于时空补丁的 **Diffusion Transformer（DiT）**，在海量（提示、字幕、视频）数据集上训练。与第 06 课相同的扩散损失。

## 概念

![视频扩散：分块、DiT、解码](../assets/video-generation.svg)

### 分块

使用 3D VAE（学习到的时空压缩）对视频进行编码。潜在表示形状为 `[T_latent, H_latent, W_latent, C_latent]`。分割成大小为 `[t_p, h_p, w_p]` 的补丁。对于 Sora 风格的模型，`t_p = 1`（逐帧补丁）或 `t_p = 2`（每两帧）。一个 10 秒的 1080p 视频压缩为约 20,000-100,000 个补丁。

### 时空 DiT

Transformer 处理补丁的扁平序列。每个补丁有一个 3D 位置嵌入（时间 + y + x）。注意力通常被分解：

- **空间注意力** 在每帧的补丁内。
- **时间注意力** 在相同空间位置跨帧。
- **全 3D 注意力** 贵 16-100 倍；仅在低分辨率或研究中使用。

### 文本条件化

使用大型文本编码器（Sora 和 CogVideoX-5B 使用 T5-XXL）进行交叉注意力。长提示很重要——Sora 的训练集有 GPT 生成的密集重字幕，平均每个片段 200 个令牌。

### 训练

在时空潜在表示上的标准扩散损失（ε 或 v 预测）。数据：网络视频 + 约 1 亿精选片段 + 合成文本字幕。计算：即使一个小型研究运行也需要 10,000+ GPU 小时；Sora 规模是 100,000+。

## 2026 年生产格局

| 模型 | 日期 | 最长时长 | 最高分辨率 | 开放权重？ | 特点 |
|-------|------|--------------|---------|---------------|---------|
| Sora（OpenAI） | 2024-02 | 60s | 1080p | 否 | 首个大规模展示世界模拟器属性的模型 |
| Sora Turbo | 2024-12 | 20s | 1080p | 否 | 生产级 Sora，推理速度 5 倍 |
| Veo 2（Google） | 2024-12 | 8s | 4K | 否 | 2025 年最高质量 + 物理 |
| Veo 3 | 2025 Q3 | 15s | 4K | 否 | 原生音频和更强的相机控制 |
| Kling 1.5 / 2.1（快手） | 2024-2025 | 10s | 1080p | 否 | 2025 Q1 最佳人体运动 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | 否 | 之上的专业视频工具 |
| Pika 2.0 | 2024-10 | 5s | 1080p | 否 | 最强角色一致性 |
| CogVideoX（THUDM） | 2024 | 10s | 720p | 是（2B、5B） | 首个开放 5B 规模视频模型 |
| HunyuanVideo（腾讯） | 2024-12 | 5s | 720p | 是（13B） | 2024 年末开放 SOTA |
| Mochi-1（Genmo） | 2024-10 | 5.4s | 480p | 是（10B） | 最宽松许可 |
| WAN 2.2（阿里巴巴） | 2025-07 | 5s | 720p | 是 | 2025 年中最强开放模型 |

开放权重在视频领域比图像领域更快地缩小差距：到 2026 年中，HunyuanVideo + WAN 2.2 LoRA 已驱动大多数开源工作流。

## 动手实现

`code/main.py` 模拟了核心的时空 DiT 思想：分块一个小型合成视频，添加每个补丁的位置嵌入，并使用 Transformer 风格的注意力对整个补丁序列进行去噪。无 numpy；纯 Python。我们展示了即使在 1-D 中，当相邻帧补丁共享去噪器和位置嵌入时，时间连贯性也会出现。

### 步骤 1：分块一个合成的 1-D "视频"

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### 步骤 2：每帧的位置嵌入

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### 步骤 3：去噪器看到整个序列

我们微小的网络不是独立对每帧去噪，而是连接所有帧的值 + 它们的位置嵌入，并联合预测所有帧的噪声。

### 步骤 4：时间连贯性测试

训练后，采样一个视频。测量帧间增量。如果模型学到了时间结构，增量将保持小于独立采样每帧。

## 陷阱

- **独立逐帧采样 = 闪烁。** 如果你分别对每帧运行图像扩散，输出会闪烁，因为每帧的噪声是独立的。视频扩散通过注意力或共享噪声耦合帧来修复此问题。
- **朴素 3D 注意力 = OOM。** 在 10 秒 1080p 潜在表示上的全 3D 注意力是数千亿次操作。分解为空间 + 时间。
- **数据字幕比规模更重要。** Sora 相对于先前工作的主要升级是在约 10 倍更详细的字幕（GPT-4 重新标记的片段）上训练。OpenAI 的技术报告对此有明确说明。
- **首帧条件化。** 大多数生产模型也接受图像作为首帧。这是"图像到视频"模式；训练包含此变体。
- **物理漂移。** 长片段（>10s）积累微小的不一致。滑动窗口生成 + 关键帧锚定有帮助。

## 应用

| 使用场景 | 2026 年选择 |
|----------|-----------|
| 最高质量的文生视频，托管 | Veo 3 或 Sora |
| 相机控制电影级 | 带运动笔刷的 Runway Gen-3 |
| 跨片段角色一致性 | Pika 2.0 或 Kling 2.1 |
| 开放权重，快速微调 | WAN 2.2 + LoRA |
| 图生视频 | WAN 2.2-I2V、Kling 2.1 I2V 或 Runway |
| 音频到视频口型同步 | Veo 3（原生音频）或专用口型同步模型 |
| 视频编辑 | Runway Act-Two、Kling Motion Brush、Flux-Kontext（静态帧） |

2024 到 2026 年间，同等质量下每秒视频的成本下降了 20 倍。

## 交付

保存为 `outputs/skill-video-brief.md`。技能接受视频简介（时长、宽高比、风格、相机规划、主体一致性、音频）并输出：模型 + 托管、提示框架（相机语言、主体描述、运动描述符）、种子 + 可重现性方案以及帧级 QA 检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中比较（a）独立逐帧采样与（b）联合序列采样的帧间增量。报告增量的均值和方差。
2. **中等。** 添加首帧条件：将帧 0 固定为给定值并采样其余部分。测量固定值如何传播。
3. **困难。** 使用 HuggingFace diffusers 在本地 GPU 上运行 CogVideoX-2B。对 6 秒片段的 720p 20 步推理计时。分析时空注意力以识别瓶颈。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | 将 `(T, H, W, C)` 压缩为时空潜在表示的编码器。 |
| Patches | "令牌" | 潜在表示的固定大小 3-D 块；DiT 的输入。 |
| Factorized attention | "空间 + 时间" | 先在空间上运行注意力，然后在时间上运行；跳过全 3-D 注意力。 |
| Image-to-video (I2V) | "动画化这张照片" | 模型接受图像 + 文本，输出从其开始的视频。 |
| Keyframe conditioning | "锚定帧" | 固定特定帧以控制视频的弧线。 |
| Motion brush | "方向提示" | 用户将运动向量绘制到图像上的 UI 输入。 |
| Re-captioning | "密集字幕" | 使用 LLM 用详细提示重新标记训练片段。 |
| Flicker | "时间伪影" | 帧间不一致；通过耦合去噪修复。 |

## 生产说明：视频潜在表示是一个内存带宽问题

一个 10 秒 1080p 视频，24fps，是 240 帧 × 1920 × 1080 × 3 ≈ 1.5 GB 原始像素。经过 4× 视频 VAE 压缩（`2 × 空间 × 2 × 时间`），每个请求的潜在表示约为 100 MB。通过时空 DiT 以批大小 1 运行 30 步，你每步移动约 3 GB 通过 HBM——瓶颈是内存带宽，而非 FLOPs。

三个生产级旋钮，全部直接来自生产推理文献的推理章节：

- **DiT 上的 TP。** 文生视频模型通常 ≥10B 参数。跨 4 个 H100 的 TP=4 是标准；对于 405B 类模型使用 PP=2 × TP=2。每步延迟随着 TP 大致线性下降，直到 all-reduce 墙。
- **帧批处理 = 连续批处理。** 生成时，视频概念上是一个通过注意力连接的帧批。连续批处理（飞行中调度）适用：如果模型架构允许滑动窗口生成，则在返回帧 `t-1` 时开始渲染帧 `t+1`。
- **片段级预填充缓存。** 对于图像到视频，首帧条件化类似于 LLM 的提示预填充：计算一次，在时间解码传递中复用。这实际上是视频的 KV-cache。

## 延伸阅读

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) — Sora 技术报告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) — CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) — HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) — Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) — 2025 年中开放 SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) — 开创性的视频扩散论文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) — Stable Video Diffusion 的前身。
