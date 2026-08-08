# 10 · 视频生成

> 图像是一个二维张量，视频则是三维张量。理论是一样的，但算力难度高出 10 到 100 倍。OpenAI 的 Sora（2024 年 2 月）证明了它的可行性。到 2026 年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0 以及 WAN 2.2 已经能从文本生成 1080p 的生产级视频——而开放权重（open-weights）技术栈（CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2）则落后约 12 个月。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 8 · 07（潜在扩散）、阶段 7 · 09（ViT）、阶段 8 · 06（DDPM）
**时长：** 约 45 分钟

## 问题所在

一段 10 秒、1080p、24fps 的视频包含 240 帧，每帧为 1920×1080×3 个像素。这意味着每个片段约有 1.5 GB 的原始数据。在像素空间（pixel-space）做扩散是不可行的。你需要：

1. **时空压缩（spatiotemporal compression）。** 一个对视频（而非单帧）进行编码的 VAE，将其编码为一系列时空 patch。
2. **时间一致性（temporal coherence）。** 帧与帧之间需要在数秒内共享内容、光照和物体身份。网络必须建模运动。
3. **算力预算（compute budget）。** 在相同模型规模下，视频训练的成本是图像训练的 10 到 100 倍。
4. **条件控制（conditioning）。** 文本、图像（首帧）、音频，或另一段视频。大多数生产级模型四者全部支持。

解决这一问题的架构，是将**扩散 Transformer（Diffusion Transformer，DiT）**应用于时空 patch，并在海量 (prompt, caption, video) 数据集上训练。其扩散损失与第 06 课完全相同。

## 核心概念

〔图：视频扩散流程——patch 化、DiT、解码〕

### Patch 化（Patchify）

用一个 3D VAE（学习得到的时空压缩器）对视频进行编码。其潜在表示（latent）的形状为 `[T_latent, H_latent, W_latent, C_latent]`。将其切分为尺寸为 `[t_p, h_p, w_p]` 的 patch。对于 Sora 类模型，`t_p = 1`（逐帧 patch）或 `t_p = 2`（每两帧一组）。一段 10 秒的 1080p 视频会被压缩为约 20,000 到 100,000 个 patch。

### 时空 DiT（Spatiotemporal DiT）

一个 Transformer 处理这串扁平化的 patch 序列。每个 patch 都带有一个三维位置嵌入（时间 + y + x）。注意力通常采用因子化（factorized）方式：

- **空间注意力（spatial attention）** 在每一帧内部的 patch 之间进行。
- **时间注意力（temporal attention）** 在不同帧中相同空间位置的 patch 之间进行。
- **完整三维注意力（full 3D attention）** 的成本要高出 16 到 100 倍，仅在低分辨率或研究场景中使用。

### 文本条件控制（Text conditioning）

通过与一个大型文本编码器（Sora 使用 T5-XXL，CogVideoX-5B 也使用 T5-XXL）做交叉注意力（cross-attention）来实现。长 prompt 很重要——Sora 的训练集采用了由 GPT 生成的密集重述描述（re-caption），平均每个片段约 200 个 token。

### 训练（Training）

在时空潜在表示上使用标准扩散损失（ε 预测或 v 预测）。数据：网络视频 + 约 1 亿条精选片段 + 合成文本描述。算力：即便一次小规模研究运行也需要 10,000+ GPU 小时；Sora 量级则需要 100,000+。

## 2026 年的生产级格局

| 模型 | 日期 | 最大时长 | 最大分辨率 | 是否开放权重？ | 亮点 |
|-------|------|--------------|---------|---------------|------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | 否 | 首个在大规模上展现世界模拟器特性的模型 |
| Sora Turbo | 2024-12 | 20s | 1080p | 否 | 生产版 Sora，推理速度快 5 倍 |
| Veo 2 (Google) | 2024-12 | 8s | 4K | 否 | 2025 年画质与物理表现最佳 |
| Veo 3 | 2025 Q3 | 15s | 4K | 否 | 原生音频，更强的镜头控制 |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | 否 | 2025 年 Q1 人体运动表现最佳 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | 否 | 在其之上构建了专业视频工具 |
| Pika 2.0 | 2024-10 | 5s | 1080p | 否 | 角色一致性最强 |
| CogVideoX (THUDM) | 2024 | 10s | 720p | 是 (2B, 5B) | 首个开放的 5B 规模视频模型 |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | 是 (13B) | 2024 年末的开放 SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | 是 (10B) | 许可证最宽松 |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | 是 | 2025 年年中最强的开放模型 |

开放权重在视频领域追赶的速度比在图像领域更快：到 2026 年年中，HunyuanVideo + WAN 2.2 的 LoRA 已经驱动了大多数开源工作流。

## 动手构建

`code/main.py` 模拟了时空 DiT 的核心思想：对一段小型合成视频做 patch 化，为每个 patch 添加位置嵌入，然后用一种 Transformer 风格的、跨 patch 的注意力对整个序列去噪。不使用 numpy，纯 Python 实现。我们展示了：即便在一维场景中，只要相邻帧的 patch 共享同一个去噪器和位置嵌入，时间一致性也会自然涌现。

### 步骤 1：对一段合成的一维"视频"做 patch 化

```python
def make_video(T_frames=8, rng=None):
    # 一段"视频"是一串沿平滑轨迹变化的一维数值
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### 步骤 2：为每一帧添加位置嵌入

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### 步骤 3：去噪器看到整个序列

我们的微型网络不是对每一帧独立去噪，而是把所有帧的数值 + 它们的位置嵌入拼接起来，联合预测所有帧的噪声。

### 步骤 4：时间一致性测试

训练完成后，采样生成一段视频。测量帧与帧之间的差值。如果模型学到了时间结构，这些差值应当比独立采样每一帧时更小。

## 易踩的坑

- **逐帧独立采样 = 闪烁。** 如果你对每一帧单独运行图像扩散，输出会闪烁，因为每帧的噪声彼此独立。视频扩散通过注意力或共享噪声把各帧耦合起来，从而解决这一问题。
- **朴素的三维注意力 = 显存溢出（OOM）。** 对一个 10 秒 1080p 的潜在表示做完整三维注意力涉及数千亿次运算。要因子化为空间 + 时间。
- **数据描述（captioning）比数据量更重要。** Sora 相对于先前工作的主要升级，是在约 10 倍更详细的描述（由 GPT-4 重新标注的片段）上训练。OpenAI 的技术报告对此有明确说明。
- **首帧条件控制。** 大多数生产级模型也接受将一张图像作为首帧。这就是"图生视频（image-to-video）"模式；训练中包含了这一变体。
- **物理漂移（physics drift）。** 较长的片段（>10 秒）会累积细微的不一致。滑动窗口生成（sliding-window generation）+ 关键帧锚定（keyframe anchoring）有助于缓解。

## 实际应用

| 应用场景 | 2026 年的选择 |
|----------|-----------|
| 最高画质的文生视频，托管式 | Veo 3 或 Sora |
| 带镜头控制的电影感画面 | Runway Gen-3 配合运动笔刷（motion brushes） |
| 跨片段的角色一致性 | Pika 2.0 或 Kling 2.1 |
| 开放权重、快速微调 | WAN 2.2 + LoRA |
| 图生视频 | WAN 2.2-I2V、Kling 2.1 I2V 或 Runway |
| 音频驱动的视频口型同步 | Veo 3（原生音频）或专用的口型同步模型 |
| 视频编辑 | Runway Act-Two、Kling Motion Brush、Flux-Kontext（静帧） |

在画质对等的前提下，每秒视频的成本在 2024 到 2026 年间下降了 20 倍。

## 交付落地

保存 `outputs/skill-video-brief.md`。该技能接收一份视频简报（时长、画幅比例、风格、镜头方案、主体一致性、音频），并输出：模型 + 托管方案、prompt 脚手架（镜头语言、主体描述、运动描述词）、种子 + 可复现性协议，以及一份逐帧的 QA 检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中，对比以下两种方式的帧间差值：(a) 逐帧独立采样，(b) 联合序列采样。报告差值的均值和方差。
2. **中等。** 添加首帧条件：将第 0 帧固定为给定值，再采样其余帧。测量该固定值是如何向后传播的。
3. **困难。** 使用 HuggingFace diffusers 在本地 GPU 上运行 CogVideoX-2B。为一段 6 秒、720p 的片段计时 20 步推理。对时空注意力进行性能剖析，找出瓶颈所在。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 视频 VAE（Video VAE） | "3-D VAE" | 将 `(T, H, W, C)` 压缩为时空潜在表示的编码器。 |
| Patch | "那些 token" | 潜在表示中固定尺寸的三维块；DiT 的输入。 |
| 因子化注意力（Factorized attention） | "空间 + 时间" | 先在空间上做注意力，再在时间上做；跳过完整三维注意力。 |
| 图生视频（Image-to-video，I2V） | "让这张照片动起来" | 模型接收图像 + 文本，输出一段以该图像为起点的视频。 |
| 关键帧条件控制（Keyframe conditioning） | "锚定帧" | 固定特定帧以控制视频的走向。 |
| 运动笔刷（Motion brush） | "方向提示" | 一种 UI 输入，用户在图像上绘制运动向量。 |
| 重述描述（Re-captioning） | "密集描述" | 用 LLM 为训练片段重新标注详细的 prompt。 |
| 闪烁（Flicker） | "时间伪影" | 帧与帧之间的不一致；通过耦合去噪解决。 |

## 生产笔记：视频潜在表示是一个内存带宽问题

一段 10 秒、1080p、24 fps 的片段为 240 帧 × 1920 × 1080 × 3 ≈ 1.5 GB 的原始像素。经过 4× 视频 VAE 压缩（`2 × 空间 × 2 × 时间`）后，每次请求的潜在表示约为 100 MB。把它送入时空 DiT，以 batch 1 跑 30 步，每步要在 HBM 中搬运约 3 GB 数据——瓶颈在于内存带宽，而非 FLOPs。

三个生产级调优旋钮，全部直接取自生产推理文献的推理章节：

- **跨 DiT 的张量并行（TP）。** 文生视频模型通常 ≥10B 参数。在 4 张 H100 上做 TP=4 是标准配置；对于 405B 级别的模型则用 PP=2 × TP=2。每步延迟随 TP 大致线性下降，直至触及 all-reduce 上限。
- **帧批处理 = 连续批处理（continuous batching）。** 在生成阶段，视频在概念上是由注意力关联起来的一批帧。连续批处理（in-flight scheduling）在此适用：如果模型架构支持滑动窗口生成，就可以在返回第 `t-1` 帧的同时开始渲染第 `t+1` 帧。
- **片段级 prefill 缓存。** 对于图生视频，首帧条件控制类似于 LLM 的 prompt prefill：计算一次，并在各次时间解码器（temporal decoder）传递中复用。这实际上就是视频版的 KV 缓存。

## 延伸阅读

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) —— Sora 技术报告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) —— CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) —— HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) —— Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) —— 2025 年年中的开放 SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) —— 视频扩散的奠基性论文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) —— Stable Video Diffusion 的前身。
