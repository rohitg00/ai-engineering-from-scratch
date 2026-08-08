# 17 · 视频-语言模型：时间 token 与时间定位

> 视频不是一叠照片。一段 5 秒的片段具有因果次序、动作动词与事件时序，这些都是图像模型无法表征的。Video-LLaMA（Zhang 等人，2023 年 6 月）发布了首个带音视频「时间定位（grounding）」能力的开源视频 LLM。VideoChat 与 Video-LLaVA 进一步扩展了这一范式。到 2025 年，Qwen2.5-VL 的 TMRoPE 已将与前沿闭源模型的差距抹平。每个系统都以不同方式解决「时间 token（temporal token）」问题——Video-LLaMA 按片段用 Q-former，Video-LLaVA 按帧做 concat-pool，Qwen2.5-VL 按 token 用 TMRoPE。本课将逐一解读这些范式，构建一个「均匀采样 vs 动态采样」的帧采样器，并在时间定位任务上进行评测。

**类型：** 构建
**语言：** Python（标准库，帧采样器 + 时间定位评测器）
**前置：** 阶段 12 · 08（LLaVA-OneVision）
**时长：** 约 180 分钟

## 学习目标

- 解释为什么「时间位置编码（temporal positional encoding）」会独立于视觉编码器影响视频 VLM 的性能。
- 在「每秒 token 数 vs 定位准确率」维度上，对比均匀采样、动态 FPS 采样与事件驱动采样三种帧采样策略。
- 描述「每片段 Q-former（Video-LLaMA）」「每帧池化（Video-LLaVA）」「每 token M-RoPE（Qwen2.5-VL）」三种设计。
- 说出四个视频基准的名称：VideoMME、TempCompass、EgoSchema、Video-MMMU。

## 问题所在

一段 1 分钟、30 FPS 的视频是 1800 帧。若每帧 196 个视觉 token（ViT-B 在 224 分辨率下），那就是 35.2 万个 token——比任何 2024 年时代的 LLM 上下文都要大。

存在三种缩减策略：

1. 对帧进行下采样（视内容而定，1-8 FPS）。
2. 对每帧的 patch token 做激进池化（3x3 或 4x4 双线性池化）。
3. 通过 Q-former 压缩：输入一段 16 帧片段，输出 64 个 token。

每种策略的取舍各不相同。下采样损失时间细节。池化损失空间细节。Q-former 两者都略有损失，但能节省 token。

时间位置编码是另一条正交的轴：模型如何知道第 5 帧出现在第 6 帧之前？可选方案包括简单的一维「时间 RoPE（temporal RoPE）」（Video-LLaMA）、可学习的时间嵌入（Video-LLaVA），以及 TMRoPE（Qwen2.5-VL，完整三维）。

## 核心概念

### Video-LLaMA：每片段 Q-former + 音频分支

Video-LLaMA（2023）是首个开源视频 LLM。其架构：

- 在 2 FPS 下取 16 帧片段（即 8 秒）。
- 每帧 ViT 特征 -> Video Q-former 对全部 16 帧做交叉注意力 -> 32 个可学习 query -> LLM。
- 并行音频分支：波形 -> ImageBind 音频编码器 -> Audio Q-former -> 32 个 query -> LLM。

优势：音视频联合推理。劣势：片段长度固定，无法做任意时间点的定位。

### VideoChat 与 Video-LLaVA

VideoChat 沿用了 Video-LLaMA 的思路，但去掉了音频并加以简化。Video-LLaVA（Lin 等人，2023）用单个视觉编码器同时在图像与视频帧上训练（「先对齐后投影，alignment before projection」），得到统一的表征。两者都是「冻结的 CLIP 编码器 + MLP + LLM」结构。

两者都无法处理长视频。它们都是 8-16 帧的系统。

### Qwen2.5-VL 与 TMRoPE

Qwen2.5-VL 引入了 TMRoPE——时间-模态旋转位置编码（Temporal-Modality Rotary Position Embedding）。每个 patch token 携带一个 (t, h, w) 位置，其中 t 是真实时间戳（而非帧索引）。

与简单时间嵌入的关键区别：

- 绝对时间，而非索引。模型看到的是「在第 4.2 秒」，而不是「在第 15 帧」。
- 按 token 旋转，而非按片段。每个视觉 token 都按其自身时间戳独立旋转。
- 兼容动态 FPS。如果你在这里以 2 FPS 采样、在那里以 4 FPS 采样，TMRoPE 能原生处理这种不均匀间距。

TMRoPE 使「猫在第几秒跳起？」这类查询成为可能。模型可以输出「在第 4.2 秒」。而 Video-LLaMA 只能说「在片段的前段」。

### 帧采样策略

均匀采样（Uniform）：在时长上均匀采 N 帧。简单，但会错过运动峰值。

动态 FPS（Dynamic FPS）：根据运动强度自适应采样。用「光流（optical flow）」或帧间差分挑出高运动片段进行更密集采样。Qwen2.5-VL 就是基于此训练的。

事件驱动（Event-driven）：运行一个轻量检测器，在有动作发生处采更多帧。VideoAgent 采用此法。

关键帧 + 上下文（Keyframe + context）：在镜头边界处加上若干相邻帧采样。用于电影类内容。

### 每帧池化

在 1 FPS、每帧 576 token 的情况下，一段 5 分钟片段是 172,800 token。用 Qwen2.5-VL-72B 的 128k 上下文可以做到，但代价高昂。

3x3 双线性池化可将每帧降到 64 token -> 5 分钟为 19,200 token。这是大多数任务的甜点区。

对于空间细节不那么重要的智能体工作流，可做更激进的池化（6x6 -> 每帧 16 token）。

### 四个视频基准

- VideoMME：综合性视频理解，涵盖短、中、长视频。
- TempCompass：细粒度时间推理，「之前」/「之后」类问题。
- EgoSchema：长时程第一人称视频。
- Video-MMMU：多模态、多学科视频问答。

一次完整的视频 VLM 评测应覆盖全部四个。它们各自考验不同的轴——TempCompass 全是关于次序，EgoSchema 关于 3 分钟以上的推理，VideoMME 跨越各种时长。

### 定位输出格式

时间定位的输出格式：

- 自由文本：「猫在 4 秒左右跳起。」易于解析但不精确。
- 结构化 JSON：`{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL 基于此训练。
- 基于 token：在答案中穿插特殊 token `<time>4.1</time>`。这是 Qwen2.5-VL 的内部格式。

基于 token 的方式对下游使用最为精确。Qwen2.5-VL 的 JSON 输出格式可直接解析。

### 2026 年最佳实践

2026 年的视频 VLM：

- 编码器：SigLIP 2 搭配 M-RoPE 或 TMRoPE（Qwen2.5-VL）。
- 帧采样：动态 FPS（视运动而定 1-4）并设最大帧数上限。
- 每帧池化：3x3 双线性。
- 输出：带 time 与 event 字段的结构化 JSON。
- 基准：通用场景用 VideoMME + TempCompass；长时程用 EgoSchema。

## 动手用起来

`code/main.py` 包含：

- 均匀采样与动态 FPS 帧采样器。
- 一个玩具级时间定位评测器：给定某事件在时间 T 的「真值（ground truth）」与模型输出，按容差打分准确率。
- 一组对比：Video-LLaMA（16 帧，Q-former）、Video-LLaVA（8 帧，MLP）、Qwen2.5-VL（动态 FPS + TMRoPE）。

## 交付成果

本课产出 `outputs/skill-video-vlm-frame-planner.md`。给定一个视频任务（监控、动作识别、时间定位、摘要），它会选出帧采样器、池化系数、输出格式与预期准确率档位。

## 练习

1. 对于一段 3 分钟的烹饪演示，在均匀采样与动态 FPS 之间做选择。用 token 数量来论证。

2. 相比简单的时间嵌入表，TMRoPE 具体新增了什么它做不到的能力？

3. 编写一个 VLM 可学习输出的时间定位 JSON schema。包含错误情形。

4. 阅读 Video-LLaVA 第 3 节「Alignment Before Projection」。为什么这比分别训练图像编码器与视频编码器更好？

5. 给定 VideoMME 排行榜，截至 2026 年顶级开源模型与顶级闭源模型之间的差距是多少？这一差距有多少可归因于时间编码，多少归因于基座 LLM 规模？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 时间定位（Temporal grounding） | 「时间定位的答案」 | VLM 输出某事件发生的具体时间戳区间 |
| TMRoPE | 「时间-多模态 RoPE」 | 带绝对时间戳的三维旋转位置，Qwen2.5-VL 采用 |
| 动态 FPS（Dynamic FPS） | 「运动感知采样」 | 在高运动片段采更多帧，在静态片段采更少帧 |
| 帧池化（Frame pooling） | 「每帧空间压缩」 | 在送入 LLM 前用双线性插值减少每帧的 patch 数 |
| Video Q-former | 「片段压缩器」 | 将 N 帧映射为 K 个可学习 query 的交叉注意力瓶颈 |
| VideoMME | 「视频基准」 | 综合性短/中/长视频基准，2500+ 样本 |

## 延伸阅读

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
