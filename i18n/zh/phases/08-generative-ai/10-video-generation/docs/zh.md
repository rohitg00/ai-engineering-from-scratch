# 视频生成

> 图像是 2-D 张量。视频是 3-D 张量。理论是一样的；计算量却高出 10-100 倍。OpenAI 的 Sora(2024 年 2 月)证明了这是可能的。到 2026 年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0 和 WAN 2.2 已能以 1080p 从文本生成生产级视频——而开源权重技术栈(CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2)仅落后 12 个月。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07(Latent Diffusion)、Phase 7 · 09(ViT)、Phase 8 · 06(DDPM)
**Time:** 约 45 分钟

## 问题所在

一段 10 秒、24fps 的 1080p 视频包含 240 帧，每帧为 1920×1080×3 像素。每段原始数据约 1.5 GB。像素空间扩散是不可行的。你需要:

1. **时空压缩。** 一个将视频(而非帧)编码为时空 patch 序列的 VAE。
2. **时间一致性。** 帧之间需要在数秒内共享内容、光照和物体身份。网络必须建模运动。
3. **计算预算。** 在相同模型规模下，视频训练比图像训练贵 10-100 倍。
4. **条件控制。** 文本、图像(首帧)、音频或另一段视频。大多数生产级模型支持全部四种。

解决这一问题的架构是应用于时空 patch 的 **Diffusion Transformer(DiT)**,在庞大的(prompt、caption、video)数据集上训练。扩散损失与第 06 课相同。

## 核心概念

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Patchify

用 3D VAE(学习到的时空压缩)对视频编码。latent 的形状为 `[T_latent, H_latent, W_latent, C_latent]`。将其切分为大小为 `[t_p, h_p, w_p]` 的 patch。对于 Sora 风格的模型，`t_p = 1`(每帧一个 patch)或 `t_p = 2`(每两帧一个 patch)。一段 10 秒的 1080p 视频压缩为约 20,000-100,000 个 patch。

### 时空 DiT

一个 transformer 处理扁平化的 patch 序列。每个 patch 带 3-D 位置嵌入(time + y + x)。注意力通常被分解:

- **空间注意力** 在每帧的 patch 内部。
- **时间注意力** 在相同空间位置上跨帧。
- **完整 3-D 注意力** 的开销高出 16-100 倍；仅用于低分辨率或研究中。

### 文本条件控制

通过大型文本编码器进行 cross-attention(Sora 使用 T5-XXL,CogVideoX-5B 也使用 T5-XXL)。长 prompt 很重要——Sora 的训练集包含 GPT 生成的密集重标注描述，平均每段 200 个 token。

### 训练

在时空 latent 上使用标准扩散损失(ε 或 v 预测)。数据:网络视频 + 约 1 亿段精选片段 + 合成文本描述。计算量:即便小规模研究也需要 10,000+ GPU 小时;Sora 规模则需 100,000+。

## 2026 年生产格局

| 模型 | 日期 | 最大时长 | 最大分辨率 | 开源权重？ | 亮点 |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | 否 | 首个在大规模下展现世界模拟器特性的模型 |
| Sora Turbo | 2024-12 | 20s | 1080p | 否 | 生产级 Sora,推理速度快 5 倍 |
| Veo 2 (Google) | 2024-12 | 8s | 4K | 否 | 2025 年最高质量 + 物理表现 |
| Veo 3 | 2025 Q3 | 15s | 4K | 否 | 原生音频与更强的镜头控制 |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | 否 | 2025 Q1 最佳人体运动 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | 否 | 叠加专业视频工具 |
| Pika 2.0 | 2024-10 | 5s | 1080p | 否 | 最强角色一致性 |
| CogVideoX (THUDM) | 2024 | 10s | 720p | 是 (2B, 5B) | 首个开源 5B 规模视频模型 |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | 是 (13B) | 2024 年底开源 SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | 是 (10B) | 许可证最宽松 |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | 是 | 2025 年中最强开源模型 |

开源权重正在以比图像领域更快的速度缩小差距:到 2026 年年中，HunyuanVideo + WAN 2.2 LoRA 已经支撑了大多数开源工作流。

```figure
video-diffusion-denoise
```

## 动手实现

`code/main.py` 模拟时空 DiT 的核心思想:patchify 一段小型合成视频，添加逐 patch 位置嵌入，然后用 transformer 风格的 patch 间注意力对整个序列去噪。不使用 numpy;纯 Python。我们展示了即便在 1-D 下，当相邻帧的 patch 共享去噪器和位置嵌入时，时间一致性也会涌现。

### 步骤 1:patchify 一段合成的 1-D"视频"

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### 步骤 2:逐帧位置嵌入

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### 步骤 3:去噪器看到整个序列

我们的微型网络不再独立地对每帧去噪，而是拼接所有帧的值 + 位置嵌入，并联合预测所有帧的噪声。

### 步骤 4:时间一致性测试

训练后，采样一段视频。测量帧间差值。如果模型学到了时间结构，这些差值会小于逐帧独立采样的结果。

## 常见陷阱

- **逐帧独立采样 = 闪烁。** 如果你对每帧单独运行图像扩散，输出会闪烁，因为每帧的噪声是独立的。视频扩散通过注意力或共享噪声将帧耦合起来，从而解决此问题。
- **朴素的 3D 注意力 = OOM。** 对 10 秒 1080p latent 做完整 3-D 注意力需要数千亿次运算。应分解为空间 + 时间。
- **数据标注比数据量更重要。** Sora 相较此前工作的主要升级是在约 10 倍详细的描述上训练(GPT-4 重新标注片段)。OpenAI 的技术报告明确指出了这一点。
- **首帧条件控制。** 大多数生产级模型也接受一张图像作为首帧。这就是"image-to-video"模式；训练包含此变体。
- **物理漂移。** 长片段(>10s)会累积细微的不一致。滑窗生成 + 关键帧锚定有所帮助。

## 应用场景

| 用例 | 2026 年选择 |
|----------|-----------|
| 最高质量的文生视频，托管服务 | Veo 3 或 Sora |
| 可控镜头的电影级生成 | Runway Gen-3 配合 motion brushes |
| 跨片段的角色一致性 | Pika 2.0 或 Kling 2.1 |
| 开源权重，快速微调 | WAN 2.2 + LoRA |
| 图生视频 | WAN 2.2-I2V、Kling 2.1 I2V 或 Runway |
| 音频驱动的视频口型同步 | Veo 3(原生音频)或专用 lip-sync 模型 |
| 视频编辑 | Runway Act-Two、Kling Motion Brush、Flux-Kontext(静态帧) |

在同等质量下，每秒视频的成本在 2024 年到 2026 年间下降了 20 倍。

## 上线交付

保存 `outputs/skill-video-brief.md`。该技能接收一个视频简报(时长、宽高比、风格、镜头规划、主体一致性、音频)，输出:模型 + 托管方式、prompt 框架(镜头语言、主体描述、运动描述符)、seed + 可复现性协议，以及逐帧 QA 检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中，比较(a)逐帧独立采样与(b)联合序列采样的帧间差值。报告差值的均值和方差。
2. **中等。** 添加首帧条件:将第 0 帧固定为给定值并采样其余帧。测量固定值如何传播。
3. **困难。** 使用 HuggingFace diffusers 在本地 GPU 上运行 CogVideoX-2B。对一个 6 秒片段在 720p 下计时 20 步推理。对时空注意力进行性能分析以找出瓶颈。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | 将 `(T, H, W, C)` 压缩为时空 latent 的编码器。 |
| Patches | "tokens" | latent 中固定大小的 3-D 块；DiT 的输入。 |
| Factorized attention | "空间 + 时间" | 先在空间上做注意力，再在时间上；跳过完整 3-D 注意力。 |
| Image-to-video (I2V) | "让这张照片动起来" | 模型接收图像 + 文本，输出以该图像开头的视频。 |
| Keyframe conditioning | "锚定帧" | 固定特定帧以控制视频走向。 |
| Motion brush | "方向提示" | 用户在图像上涂抹运动矢量的 UI 输入。 |
| Re-captioning | "密集描述" | 使用 LLM 用详细 prompt 重新标注训练片段。 |
| Flicker | "时间伪影" | 帧间不一致；通过耦合去噪解决。 |

## 生产提示:视频 latent 是内存带宽问题

一段 10 秒、24fps 的 1080p 片段为 240 帧 × 1920 × 1080 × 3 ≈ 1.5 GB 原始像素。经过 4× 的视频 VAE 压缩(`2 × spatial × 2 × temporal`)后，每次请求的 latent 约 100 MB。用时空 DiT 以 batch 1 跑 30 步，每步约有 ~3 GB 数据流经 HBM——瓶颈是内存带宽，而非 FLOPs。

三个生产调优手段，全部直接来自生产级推理文献的推理章节:

- **DiT 上的 TP。** 文生视频模型的参数量通常 ≥10B。4 块 H100 上 TP=4 是标准做法；405B 级模型用 PP=2 × TP=2。每步延迟随 TP 大致线性下降，直至碰到 all-reduce 瓶颈。
- **帧批处理 = continuous batching。** 在生成时，视频在概念上是由注意力关联的一批帧。适用 continuous batching(in-flight scheduling):如果模型架构支持滑窗生成，在帧 `t-1` 被返回的同时开始渲染帧 `t+1`。
- **片段级 prefill 缓存。** 对于图生视频，首帧条件控制类似于 LLM 的 prompt prefill:计算一次，在时间解码器的多次传递中复用。这实际上就是视频版的 KV-cache。

## 延伸阅读

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) — Sora 技术报告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) — CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) — HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) — Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) — 2025 年年中开源 SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) — 视频扩散的开创性论文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) — Stable Video Diffusion 的前身。