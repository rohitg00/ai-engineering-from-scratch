# 视频生成（Video Generation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 图像是 2-D 张量，视频是 3-D 张量。理论一致，算力却要难上 10–100 倍。OpenAI 的 Sora（2024 年 2 月）证明了这条路走得通。到 2026 年，Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0、WAN 2.2 都已上线，可以从文本生成 1080p 的产品级视频；开源权重栈（CogVideoX、HunyuanVideo、Mochi-1、WAN 2.2）落后大约 12 个月。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## 问题（The Problem）

一段 10 秒、24fps 的 1080p 视频共 240 帧、每帧 1920×1080×3 像素，每段原始数据约 1.5 GB。在像素空间直接做 diffusion 不现实。你需要：

1. **时空压缩（Spatiotemporal compression）。** 用 VAE 把视频（而不是单帧）编码成一串时空 patch。
2. **时间一致性（Temporal coherence）。** 数秒之内，跨帧的内容、光照、物体身份必须保持一致。网络得对运动建模。
3. **算力预算。** 同样规模的模型，视频训练比图像训练贵 10–100 倍。
4. **条件输入（Conditioning）。** 文本、图像（首帧）、音频、或另一段视频。大多数生产级模型这四种都接。

解决这件事的架构是把 **Diffusion Transformer (DiT)** 套到时空 patch 上，再在大规模 (prompt, caption, video) 数据集上训练。diffusion 损失函数和第 06 课一致。

## 概念（The Concept）

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### 切 patch（Patchify）

用 3D VAE（学习得到的时空压缩）对视频编码，latent 形状为 `[T_latent, H_latent, W_latent, C_latent]`。再切成尺寸为 `[t_p, h_p, w_p]` 的 patch。Sora 这一类模型里，`t_p = 1`（每帧独立 patch）或 `t_p = 2`（每两帧合一）。一段 10 秒的 1080p 视频会被压成 ~20,000–100,000 个 patch。

### 时空 DiT（Spatiotemporal DiT）

由 transformer 处理这条扁平的 patch 序列。每个 patch 带 3D 位置编码（time + y + x）。attention 通常做因子化处理：

- **Spatial attention（空间注意力）**：作用于同一帧内的所有 patch。
- **Temporal attention（时间注意力）**：作用于不同帧、相同空间位置的 patch。
- **Full 3D attention（完整 3D 注意力）**：开销是上面两种的 16–100 倍；只在低分辨率或研究场景下用。

### 文本条件（Text conditioning）

用大型文本 encoder 做 cross-attention（Sora 用 T5-XXL，CogVideoX-5B 也用 T5-XXL）。长 prompt 很关键——Sora 训练集里用 GPT 重新生成的密集 caption 平均每段 200 个 token。

### 训练（Training）

在时空 latent 上跑标准 diffusion 损失（ε 或 v 预测）。数据：网络视频 + 约 1 亿条精选片段 + 合成文本 caption。算力：哪怕一次小规模研究跑也要 10,000+ GPU 小时；Sora 这种规模要 100,000+。

## 2026 年的生产格局（The 2026 production landscape）

| 模型 | 时间 | 最长时长 | 最高分辨率 | 开放权重？ | 亮点 |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | 否 | 第一个在大规模上展现「世界模拟器」性质的模型 |
| Sora Turbo | 2024-12 | 20s | 1080p | 否 | 推理快 5 倍的生产版 Sora |
| Veo 2 (Google) | 2024-12 | 8s | 4K | 否 | 2025 年画质与物理表现最好 |
| Veo 3 | 2025 Q3 | 15s | 4K | 否 | 原生音频，更强的镜头控制 |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | 否 | 2025 Q1 人体运动表现最佳 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | 否 | 顶层有专业视频工具 |
| Pika 2.0 | 2024-10 | 5s | 1080p | 否 | 角色一致性最强 |
| CogVideoX (THUDM) | 2024 | 10s | 720p | 是（2B、5B） | 第一款 5B 级开源视频模型 |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | 是（13B） | 2024 年末开源 SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | 是（10B） | 许可证最宽松 |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | 是 | 2025 年中期最强开源模型 |

开源权重在视频领域追赶得比图像领域更快：到 2026 年中，HunyuanVideo + WAN 2.2 LoRA 已经撑起了大多数开源工作流。

## 动手实现（Build It）

`code/main.py` 模拟时空 DiT 的核心思路：把一段小型合成视频切 patch，加上每个 patch 的位置编码，然后用 transformer 风格的 attention 对整条序列做去噪。不依赖 numpy；纯 Python。我们要展示，即使在 1-D 情况下，只要相邻帧的 patch 共享同一个 denoiser 和位置编码，时间一致性也会浮现。

### Step 1：把一段合成的 1-D「视频」切 patch

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Step 2：每帧一个位置编码

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Step 3：denoiser 看完整序列

我们这个迷你网络不会逐帧独立去噪，而是把所有帧的值 + 它们的位置编码拼起来，一次性预测所有帧的噪声。

### Step 4：时间一致性测试

训练完成后采样一段视频，量一下相邻帧之间的差。如果模型学到了时间结构，这些差应该比逐帧独立采样时更小。

## 常见坑（Pitfalls）

- **逐帧独立采样 = 闪烁。** 如果你对每帧分别跑图像 diffusion，输出会闪烁，因为每帧的噪声彼此独立。视频 diffusion 通过 attention 或共享噪声把帧耦合起来解决这一点。
- **天真的 3D attention = OOM。** 在 10 秒 1080p latent 上跑完整 3D attention 是几千亿次操作，得拆成空间 + 时间因子化做。
- **数据 caption 比规模更关键。** Sora 相对前作的主要升级，是用了详尽 10 倍的 caption（GPT-4 重新打标）训练。OpenAI 的技术报告对此非常明确。
- **首帧条件（First-frame conditioning）。** 大多数生产级模型也支持把一张图作为首帧，这就是「图生视频（image-to-video）」模式；训练时也会包含这个变体。
- **物理漂移。** 长片段（>10s）会逐渐积累细微的不一致。滑动窗口生成 + 关键帧锚定（keyframe anchoring）能缓解。

## 用起来（Use It）

| 用例 | 2026 年首选 |
|----------|-----------|
| 最高质量的文生视频，托管服务 | Veo 3 或 Sora |
| 镜头可控的电影级视频 | Runway Gen-3 + 运动笔刷 |
| 跨片段保持角色一致性 | Pika 2.0 或 Kling 2.1 |
| 开源权重，快速 fine-tune | WAN 2.2 + LoRA |
| 图生视频 | WAN 2.2-I2V、Kling 2.1 I2V，或 Runway |
| 音频驱动的口型同步 | Veo 3（原生音频）或专门的口型同步模型 |
| 视频编辑 | Runway Act-Two、Kling Motion Brush、Flux-Kontext（静帧） |

每秒视频在等价质量下的成本，2024 到 2026 之间下降了 20 倍。

## 上线部署（Ship It）

把成果保存到 `outputs/skill-video-brief.md`。这个 skill 接收一份视频简报（时长、宽高比、风格、镜头方案、主体一致性、音频），输出：模型 + 托管方案、prompt 脚手架（镜头语言、主体描述、运动描述词）、seed 与可复现协议，以及一份逐帧 QA 清单。

## 练习（Exercises）

1. **Easy（容易）。** 在 `code/main.py` 里，对比 (a) 逐帧独立采样、(b) 联合序列采样的相邻帧差。报告差的均值与方差。
2. **Medium（中等）。** 加上首帧条件：把 frame 0 钉死成给定值，再采样其余帧。量一下被钉住的值如何向后传播。
3. **Hard（困难）。** 用 HuggingFace diffusers 在本地 GPU 上跑 CogVideoX-2B。给一段 6 秒 720p 片段计 20 步推理的耗时，剖析时空 attention，定位瓶颈。

## 关键术语（Key Terms）

| 术语 | 大家怎么叫 | 实际是什么 |
|------|-----------------|-----------------------|
| Video VAE | 「3-D VAE」 | 把 `(T, H, W, C)` 压成时空 latent 的 encoder。 |
| Patches | 「就是 token」 | latent 的固定大小 3-D 块；DiT 的输入。 |
| Factorized attention | 「空间 + 时间」 | 先在空间上做 attention，再在时间上做；跳过完整 3-D attention。 |
| Image-to-video (I2V) | 「让这张照片动起来」 | 模型接收图像 + 文本，输出从这张图开始的视频。 |
| Keyframe conditioning | 「锚定帧」 | 把特定帧钉死，以控制视频的弧线。 |
| Motion brush | 「方向提示」 | UI 输入：用户在图像上涂运动向量。 |
| Re-captioning | 「密集 caption」 | 用 LLM 给训练片段重新生成详细的 prompt。 |
| Flicker | 「时间伪影」 | 相邻帧之间的不一致；通过耦合去噪修复。 |

## 生产笔记：视频 latent 是一个内存带宽问题（Production note: video latents are a memory-bandwidth problem）

一段 10 秒、24 fps 的 1080p 片段是 240 帧 × 1920 × 1080 × 3 ≈ 1.5 GB 原始像素。经过 4× video VAE 压缩（`2 × 空间 × 2 × 时间`）后，每个请求的 latent 大约 100 MB。再丢给一个时空 DiT 跑 30 步、batch 1，你每步要在 HBM 上搬 ~3 GB——瓶颈是内存带宽，不是 FLOPs。

下面这三个生产侧的旋钮都直接来自生产级推理（production-inference）文献的推理章节：

- **DiT 上做 TP。** 文生视频模型常态 ≥10B 参数。TP=4 跨 4 张 H100 是标配；405B 量级会用 PP=2 × TP=2。每步延迟随 TP 大致线性下降，直到撞上 all-reduce 墙。
- **帧批 = continuous batching（连续批处理）。** 生成阶段，视频在概念上就是一批通过 attention 关联起来的帧。continuous batching（in-flight scheduling，飞行中调度）适用于此：只要模型架构允许滑动窗口生成，就可以一边返回 frame `t-1`、一边开始渲染 frame `t+1`。
- **片段级 prefill 缓存。** 对图生视频来说，首帧条件类似 LLM 的 prompt prefill：算一次，跨多次 temporal decoder 复用。这本质上是视频版的 KV cache。

## 延伸阅读（Further Reading）

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) —— Sora 技术报告。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) —— CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) —— HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) —— Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) —— 2025 年中开源 SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) —— 视频 diffusion 的奠基论文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) —— Stable Video Diffusion 的前身。
