# 视频-语言模型：时间 Token 与定位

> 视频不是一堆照片。一个 5 秒片段具有因果顺序、动作动词和图像模型无法表示的事件时间。Video-LLaMA（Zhang 等人，2023 年 6 月）发布了第一个具有视听定位的开放视频-LLM。VideoChat 和 Video-LLaVA 扩展了这一模式。到 2025 年，Qwen2.5-VL 的 TMRoPE 缩小了与前沿专有模型的差距。每个系统以不同方式解决了时间 token——每片段 Q-former、每帧连接池化、每 token TMRoPE。本课解读这些模式，构建统一 vs 动态帧采样器，并在时间定位任务上评估。

**类型：** Build
**语言：** Python（stdlib，帧采样器 + 时间定位评估器）
**前置知识：** Phase 12 · 08（LLaVA-OneVision）
**时间：** ~180 分钟

## 学习目标

- 解释为什么时间位置编码独立于视觉编码器改变视频 VLM 性能。
- 在每秒 token 数 vs 定位精度上比较统一、动态-FPS 和事件驱动帧采样。
- 描述每片段 Q-former（Video-LLaMA）vs 每帧池化（Video-LLaVA）vs 每 token M-RoPE（Qwen2.5-VL）设计。
- 命名四个视频基准：VideoMME、TempCompass、EgoSchema、Video-MMMU。

## 问题所在

1 分钟视频在 30 FPS 下是 1800 帧。每帧 196 个视觉 token（ViT-B 在 224 下），那是 352k 个 token——比任何 2024 年时代的 LLM 上下文都大。

三种缩减策略存在：

1. 子采样帧（根据内容 1-8 FPS）。
2. 积极池化每帧的 patch token（3x3 或 4x4 双线性池化）。
3. 通过 Q-former 压缩，取 16 帧片段并输出 64 个 token。

每种权衡不同。子采样丢失时间细节。池化丢失空间细节。Q-former 两者都丢失一点但节省 token。

时间位置编码是另一个轴：模型如何知道第 5 帧在第 6 帧之前？选项包括简单 1D 时间 RoPE（Video-LLaMA）、学习时间嵌入（Video-LLaVA）和 TMRoPE（Qwen2.5-VL，完整 3D）。

## 核心概念

### Video-LLaMA：每片段 Q-former + 音频分支

Video-LLaMA（2023）是第一个开放视频-LLM。架构：

- 16 帧片段在 2 FPS 下（所以 8 秒）。
- 每帧 ViT 特征 -> 在所有 16 帧上交叉关注的视频 Q-former -> 32 个学习查询 -> LLM。
- 并行音频分支：波形 -> ImageBind 音频编码器 -> 音频 Q-former -> 32 个查询 -> LLM。

优势：视听联合推理。弱点：固定片段长度，没有任意时间定位。

### VideoChat 和 Video-LLaVA

VideoChat 保留了 Video-LLaMA 的想法但放弃了音频并简化。Video-LLaVA（Lin 等人，2023）在图像和视频帧上训练单一视觉编码器（"投影前对齐"），给出统一表示。两者都是冻结 CLIP 编码器 + MLP + LLM。

两者都不处理长视频。两者都是 8-16 帧系统。

### Qwen2.5-VL 和 TMRoPE

Qwen2.5-VL 引入了 TMRoPE——时间-模态旋转位置嵌入。每个 patch token 携带 (t, h, w) 位置，其中 t 是实际时间戳（而非帧索引）。

与简单时间嵌入的关键差异：

- 绝对时间，而非索引。模型看到"在 4.2 秒"而非"在第 15 帧"。
- 每 token 旋转，而非每片段。每个视觉 token 按其时间戳独立旋转。
- 兼容动态 FPS。如果你在这里以 2 FPS 采样，在那里以 4 FPS 采样，TMRoPE 原生处理不均匀间隔。

TMRoPE 启用"猫在什么时候跳？"查询。模型可以输出"在 4.2 秒"。Video-LLaMA 只能说"在片段早期"。

### 帧采样策略

统一：在持续时间上均匀采样 N 帧。简单，丢失运动峰值。

动态 FPS：基于运动强度自适应采样。光流或帧差分选择高运动段进行更密集采样。Qwen2.5-VL 在此训练。

事件驱动：运行轻量级检测器，在动作发生处采样更多。VideoAgent 使用。

关键帧 + 上下文：在镜头边界采样 + 几个相邻帧。用于电影内容。

### 每帧池化

在 1 FPS 和每帧 576 个 token 下，5 分钟片段是 172,800 个 token。用 Qwen2.5-VL-72B 的 128k 上下文可行但昂贵。

3x3 双线性池化减少到每帧 64 个 token -> 5 分钟 19,200 个 token。大多数任务的甜点。

更积极地池化（6x6 -> 每帧 16 个 token）用于空间细节较不重要的代理工作流。

### 四个视频基准

- VideoMME：全面视频理解，短 + 中 + 长。
- TempCompass：细粒度时间推理，"之前"/"之后"问题。
- EgoSchema：长程第一人称视频。
- Video-MMMU：多模态多学科视频问题。

完整的视频-VLM 评估命中所有四个。它们强调不同轴——TempCompass 全是关于排序，EgoSchema 是关于 3+ 分钟推理，VideoMME 跨越持续时间。

### 定位输出格式

时间定位的输出格式：

- 自由文本："猫在 4 秒左右跳。"易于解析但不精确。
- 结构化 JSON：`{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL 训练这个。
- 基于 Token：特殊 `<time>4.1</time>` token 与答案交错。Qwen2.5-VL 的内部格式。

基于 Token 对下游使用最准确。Qwen2.5-VL 的 JSON 输出格式直接解析。

### 2026 年最佳实践

对于 2026 年的视频 VLM：

- 编码器：带 M-RoPE 或 TMRoPE 的 SigLIP 2（Qwen2.5-VL）。
- 帧采样：动态 FPS（根据运动 1-4），带最大帧上限。
- 每帧池化：3x3 双线性。
- 输出：带时间 + 事件字段的结构化 JSON。
- 基准：VideoMME + TempCompass 用于一般；EgoSchema 用于长程。

## 使用它

`code/main.py` 包括：

- 统一和动态-FPS 帧采样器。
- 玩具时间定位评估器：给定时间 T 的"真实"事件和模型输出，用容差评分精度。
- Video-LLaMA（16 帧，Q-former）、Video-LLaVA（8 帧，MLP）、Qwen2.5-VL（动态 FPS + TMRoPE）之间的比较。

## 交付它

本课产出 `outputs/skill-video-vlm-frame-planner.md`。给定视频任务（监控、动作识别、时间定位、摘要），它选择帧采样器、池化因子、输出格式和预期精度层级。

## 练习

1. 对于一个 3 分钟烹饪演示，选择统一 vs 动态 FPS。用 token 计数证明。

2. TMRoPE 具体添加了简单时间嵌入表无法做到什么？

3. 编写 VLM 可以学习发出的时间定位 JSON 模式。包括错误案例。

4. 阅读 Video-LLaVA 第 3 节关于"投影前对齐"。为什么这比训练单独的图像和视频编码器更好？

5. 给定 VideoMME 排行榜，2026 年顶级开放模型与顶级专有模型之间的差距是多少？多少差距归因于时间编码 vs 基础 LLM 规模？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 时间定位 | "时间局部化答案" | VLM 输出事件发生的特定时间戳范围 |
| TMRoPE | "时间-多模态 RoPE" | 带绝对时间戳的 3D 旋转位置，Qwen2.5-VL 使用 |
| 动态 FPS | "运动感知采样" | 在高运动段采样更多帧，在静态段采样更少 |
| 帧池化 | "每帧空间压缩" | 在 LLM 之前用双线性插值减少每帧的 patch |
| 视频 Q-former | "片段压缩器" | 将 N 帧映射到 K 个学习查询的交叉注意力瓶颈 |
| VideoMME | "视频基准" | 全面短/中/长视频基准，2500+ 样本 |

## 延伸阅读

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
