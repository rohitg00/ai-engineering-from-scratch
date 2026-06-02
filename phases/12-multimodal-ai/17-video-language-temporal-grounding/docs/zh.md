# 视频-语言模型：时序 token 与 grounding（Video-Language Models: Temporal Tokens and Grounding）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 视频不是一摞照片。一段 5 秒的片段里有因果次序、动作动词和事件时间，这些都是图像模型无法表达的。Video-LLaMA（Zhang et al., 2023 年 6 月）发布了首个带音视频 grounding 的开源视频 LLM。VideoChat 和 Video-LLaVA 把这个范式做大。到 2025 年，Qwen2.5-VL 的 TMRoPE 已经追平了前沿的闭源模型。每个系统对时序 token 的处理方式都不一样——有的是每个 clip 一个 Q-former，有的是每帧 concat-pool，有的是每个 token 一个 TMRoPE。本课会读这些范式，构建一个 uniform vs dynamic 的帧采样器，并在时序 grounding 任务上做评估。

**Type:** Build
**Languages:** Python（标准库，帧采样器 + 时序 grounding 评估器）
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 分钟

## 学习目标（Learning Objectives）

- 解释为什么时序位置编码会独立于视觉 encoder 影响视频 VLM 的表现。
- 在「每秒 token 数 vs grounding 准确率」这个维度上，对比 uniform、dynamic-FPS 和事件驱动三种帧采样策略。
- 描述「每 clip 一个 Q-former」（Video-LLaMA）vs「每帧 pooled」（Video-LLaVA）vs「每 token 一个 M-RoPE」（Qwen2.5-VL）三种设计。
- 说出四个视频基准的名字：VideoMME、TempCompass、EgoSchema、Video-MMMU。

## 问题（The Problem）

一段 1 分钟、30 FPS 的视频是 1800 帧。按每帧 196 个视觉 token（ViT-B 在 224 分辨率下），就是 35.2 万 token——比任何 2024 年代的 LLM context 都大。

减量策略有三种：

1. 抽帧（按内容选 1-8 FPS）。
2. 把每帧的 patch token 狠狠 pool 一下（3x3 或 4x4 双线性 pool）。
3. 用 Q-former 压缩：吃 16 帧的 clip，吐 64 个 token。

每种取舍都不一样。抽帧丢时序细节。Pooling 丢空间细节。Q-former 两边都丢一点，但省 token。

时序位置编码是另一个轴：模型怎么知道第 5 帧在第 6 帧之前？选项包括简单的 1D 时序 RoPE（Video-LLaMA）、可学习的时序 embedding（Video-LLaVA）和 TMRoPE（Qwen2.5-VL，完整 3D）。

## 概念（The Concept）

### Video-LLaMA：每 clip 一个 Q-former + 音频分支（Video-LLaMA: Q-former per clip + audio branch）

Video-LLaMA（2023）是首个开源视频 LLM。架构如下：

- 16 帧 clip，2 FPS（也就是 8 秒）。
- 每帧的 ViT 特征 -> Video Q-former 在所有 16 帧上做 cross-attention -> 32 个可学习 query -> LLM。
- 并行的音频分支：波形 -> ImageBind 音频 encoder -> Audio Q-former -> 32 个 query -> LLM。

强项：音视频联合推理。弱项：clip 长度固定，没法做任意时间点的 grounding。

### VideoChat 与 Video-LLaVA（VideoChat and Video-LLaVA）

VideoChat 沿用了 Video-LLaMA 的思路，但去掉了音频，做了简化。Video-LLaVA（Lin et al., 2023）训练了一个统一的视觉 encoder，同时吃图像和视频帧（"alignment before projection"），得到统一表示。两者都是「冻结 CLIP encoder + MLP + LLM」。

两者都不处理长视频。都是 8-16 帧的系统。

### Qwen2.5-VL 与 TMRoPE（Qwen2.5-VL and TMRoPE）

Qwen2.5-VL 引入了 TMRoPE——Temporal-Modality Rotary Position Embedding。每个 patch token 携带一个 (t, h, w) 位置，其中 t 是真正的时间戳（不是帧序号）。

它和「简单时序 embedding」的关键区别：

- 绝对时间，不是序号。模型看到的是「在 4.2 秒处」，而不是「在第 15 帧」。
- 每个 token 单独旋转，不是每个 clip 一起转。每个视觉 token 按它自己的时间戳独立旋转。
- 兼容动态 FPS。如果你这里采 2 FPS、那里采 4 FPS，TMRoPE 原生就能处理这种不均匀间距。

TMRoPE 让「猫在第几秒跳起来？」这种查询成为可能。模型可以输出「在 4.2 秒」。Video-LLaMA 只能说「在 clip 的早段」。

### 帧采样策略（Frame sampling strategies）

Uniform：在时长上等距采 N 帧。简单，但会错过运动峰值。

Dynamic FPS：根据运动强度自适应采样。光流或帧差选出高运动段做更密的采样。Qwen2.5-VL 就是按这个训练的。

事件驱动（Event-driven）：跑一个轻量检测器，在动作发生处多采。VideoAgent 用的是这个。

关键帧 + 上下文（Keyframe + context）：在镜头边界处采 + 几个邻近帧。用于影视类内容。

### 每帧 pooling（Pooling per frame）

在 1 FPS、每帧 576 token 的设置下，5 分钟的 clip 是 172,800 token。用 Qwen2.5-VL-72B 的 128k context 撑得住，但贵。

3x3 双线性 pool 把每帧降到 64 token -> 5 分钟 19,200 token。是大多数任务的甜区。

更狠地 pool（6x6 -> 每帧 16 token），用在「空间细节没那么重要」的 agent 工作流里。

### 四个视频基准（The four video benchmarks）

- VideoMME：综合视频理解，短 + 中 + 长。
- TempCompass：细粒度时序推理，「之前」/「之后」类问题。
- EgoSchema：长链路第一人称视频。
- Video-MMMU：多模态、多学科的视频问题。

完整的视频 VLM 评估会全打。它们各自压不同的轴——TempCompass 全是排序，EgoSchema 是 3 分钟以上的推理，VideoMME 跨越各种时长。

### Grounding 输出格式（Grounding output formats）

时序 grounding 的输出格式：

- 自由文本（Free text）：「猫大概在第 4 秒跳起来。」好解析，但不精确。
- 结构化 JSON：`{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL 按这个训。
- 基于 token：在答案里夹特殊的 `<time>4.1</time>` token。Qwen2.5-VL 的内部格式。

基于 token 的方式对下游使用最准。Qwen2.5-VL 的 JSON 输出格式可以直接解析。

### 2026 年最佳实践（2026 best practice）

2026 年的视频 VLM：

- Encoder：SigLIP 2 配 M-RoPE 或 TMRoPE（Qwen2.5-VL）。
- 帧采样：dynamic FPS（按运动 1-4 FPS），加上最大帧数上限。
- 每帧 pooling：3x3 双线性。
- 输出：带 time + event 字段的结构化 JSON。
- 基准：综合用 VideoMME + TempCompass；长链路用 EgoSchema。

## 用起来（Use It）

`code/main.py` 包含：

- Uniform 和 dynamic-FPS 帧采样器。
- 一个玩具版的时序 grounding 评估器：给定时间 T 处的「ground truth」事件和模型输出，按容差打分。
- 跨 Video-LLaMA（16 帧，Q-former）、Video-LLaVA（8 帧，MLP）、Qwen2.5-VL（dynamic FPS + TMRoPE）的对比。

## 上线部署（Ship It）

本课产出 `outputs/skill-video-vlm-frame-planner.md`。给定一个视频任务（监控、动作识别、时序 grounding、摘要），它会挑出帧采样器、pooling 因子、输出格式和预期的准确率档位。

## 练习（Exercises）

1. 对一段 3 分钟的烹饪演示，在 uniform vs dynamic FPS 之间选一个。用 token 数论证。

2. 相比一张简单的时序 embedding 表，TMRoPE 多带来了什么具体能力？

3. 为时序 grounding 写一份 JSON schema，要让 VLM 能学会输出。包括错误场景。

4. 读 Video-LLaVA 论文第 3 节「Alignment Before Projection」。为什么这比单独训图像和视频 encoder 更好？

5. 看 VideoMME 排行榜，截至 2026 年，最强开源模型和最强闭源模型的差距是多少？这个差距里有多少能归因于时序编码、多少归因于 base LLM 的规模？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------|---------|
| 时序 grounding（Temporal grounding） | "时间定位的答案" | VLM 输出事件发生的具体时间戳区间 |
| TMRoPE | "Time-Multimodal RoPE" | 带绝对时间戳的 3D 旋转位置编码，Qwen2.5-VL 在用 |
| Dynamic FPS | "运动感知采样" | 在高运动段多采帧、静态段少采 |
| 帧 pooling（Frame pooling） | "每帧空间压缩" | 进 LLM 之前用双线性插值降每帧的 patch 数 |
| Video Q-former | "Clip 压缩器" | Cross-attention 瓶颈，把 N 帧映射到 K 个可学习 query |
| VideoMME | "视频基准" | 综合的短/中/长视频基准，2500+ 样本 |

## 延伸阅读（Further Reading）

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
