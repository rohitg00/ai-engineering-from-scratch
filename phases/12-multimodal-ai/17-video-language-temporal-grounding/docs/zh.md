# 视频-语言模型：时间Token与时间定位

> 视频并非一叠照片。一段5秒的片段具有因果顺序、动作动词和事件时序，这些是图像模型无法表征的。Video-LLaMA（Zhang 等人，2023年6月）发布了首个具备音视频联合定位能力的开源视频-LLM。VideoChat 和 Video-LLaVA 扩展了该范式。到2025年，Qwen2.5-VL 的 TMRoPE 缩小了与前沿闭源模型的差距。每个系统对时间Token的处理方式各不相同——每个片段使用 Q-former、每帧使用 concat-pool、每个Token使用 TMRoPE。本课程将解读这些模式，构建统一帧采样器与动态帧采样器，并在时间定位任务上进行评估。

**类型：** 构建
**语言：** Python（标准库，帧采样器 + 时间定位评估器）
**前置知识：** 阶段12 · 08（LLaVA-OneVision）
**时长：** 约180分钟

## 学习目标

- 解释为何时间位置编码能独立于视觉编码器改变视频VLM的性能。
- 对比统一采样、动态FPS和事件驱动帧采样在每秒Token数与时间定位准确率方面的差异。
- 描述 Q-former-per-clip（Video-LLaMA）、pooled-per-frame（Video-LLaVA）和 M-RoPE-per-token（Qwen2.5-VL）三种设计。
- 列举四大视频基准：VideoMME、TempCompass、EgoSchema、Video-MMMU。

## 问题

一段1分钟、30 FPS的视频共有1800帧。以每帧196个视觉Token计算（ViT-B，224分辨率），即35.2万Token——超过任何2024年LLM的上下文长度。

目前存在三种降采样策略：

1. 子采样帧（根据内容，1-8 FPS）。
2. 对每帧的Patch Token进行激进池化（3×3或4×4双线性池化）。
3. 通过 Q-former 压缩：输入16帧片段，输出64个Token。

每种方案各有取舍。子采样会丢失时间细节；池化会丢失空间细节；Q-former 两者都丢失一点，但节省Token。

时间位置编码是另一个维度：模型如何知道第5帧在第6帧之前？可选方案包括简单的一维时间RoPE（Video-LLaMA）、学习式时间嵌入（Video-LLaVA）和 TMRoPE（Qwen2.5-VL，完整三维）。

## 核心概念

### Video-LLaMA：逐片段 Q-former + 音频分支

Video-LLaMA（2023年）是首个开源视频-LLM。架构如下：

- 16帧片段，2 FPS（即8秒）。
- 逐帧ViT特征 → 视频 Q-former，对所有16帧进行交叉注意力 → 32个学习查询 → LLM。
- 并行音频分支：波形 → ImageBind 音频编码器 → 音频 Q-former → 32个查询 → LLM。

**优点：** 音视频联合推理。**缺点：** 片段长度固定，无法实现任意时间定位。

### VideoChat 与 Video-LLaVA

VideoChat 保留了 Video-LLaMA 的思想，但去掉了音频并做了简化。Video-LLaVA（Lin 等人，2023年）训练了一个统一的视觉编码器，同时处理图像和视频帧（"对齐先于投影"），实现了统一的表示。两者都是 冻结的CLIP编码器 + MLP + LLM。

两者都无法处理长视频。均属于8-16帧系统。

### Qwen2.5-VL 与 TMRoPE

Qwen2.5-VL 引入了 TMRoPE——时间-模态旋转位置编码。每个Patch Token携带一个 (t, h, w) 位置，其中 t 是实际时间戳（而非帧索引）。

与简单时间嵌入的关键区别：

- **绝对时间，而非索引。** 模型看到的是"在4.2秒处"，而不是"在第15帧"。
- **逐Token旋转，而非逐片段。** 每个视觉Token根据其时间戳独立旋转。
- **兼容动态FPS。** 如果此处以2 FPS采样，彼处以4 FPS采样，TMRoPE 原生处理不均匀间距。

TMRoPE 支持"猫在第几秒跳起？"这类查询。模型可以输出"在第4.2秒"。Video-LLaMA 只能回答"在片段早期"。

### 帧采样策略

**统一采样：** 在持续时间内均匀采样N帧。简单，但会遗漏运动峰值。

**动态FPS：** 基于运动强度自适应采样。光流或帧差法在高运动区域进行更密集采样。Qwen2.5-VL 即采用此方式训练。

**事件驱动：** 运行轻量级检测器，在动作发生处更多采样。VideoAgent 使用此方法。

**关键帧+上下文：** 在镜头边界采样，加上几个相邻帧。用于电影类内容。

### 每帧池化

在1 FPS且每帧576个Token的情况下，一段5分钟的视频为17.28万个Token。Qwen2.5-VL-72B 的12.8万上下文窗口勉强可行，但代价很高。

3×3双线性池化降至每帧64个Token → 5分钟共1.92万个Token。对大多数任务而言是推荐配置。

对于空间细节不那么重要的智能体工作流，可进行更激进的池化（6×6 → 每帧16个Token）。

### 四大视频基准

- **VideoMME：** 综合性视频理解，短/中/长三种时长。
- **TempCompass：** 细粒度时间推理，"之前"/"之后"类问题。
- **EgoSchema：** 长时程第一人称视频。
- **Video-MMMU：** 多模态多学科视频问答。

完整的视频-VLM评估需要覆盖全部四项基准。它们侧重不同维度——TempCompass 专注于时序关系，EgoSchema 要求3分钟以上的推理，VideoMME 覆盖多种时长。

### 时间定位输出格式

时间定位的输出格式：

- **自由文本：** "猫在大约第4秒处跳起。" 容易解析但不精确。
- **结构化JSON：** `{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL 采用此格式训练。
- **基于Token：** 特殊 `<time>4.1</time>` Token 与答案交错排列。Qwen2.5-VL 的内部格式。

基于Token的格式对下游使用最为准确。Qwen2.5-VL 的JSON输出格式可直接解析。

### 2026年最佳实践

对于2026年的视频VLM：

- **编码器：** 带有 M-RoPE 或 TMRoPE 的 SigLIP 2（Qwen2.5-VL）。
- **帧采样：** 动态FPS（根据运动情况1-4），设置最大帧数上限。
- **每帧池化：** 3×3双线性。
- **输出：** 包含时间和事件字段的结构化JSON。
- **基准：** 通用场景使用 VideoMME + TempCompass；长时程场景使用 EgoSchema。

## 使用它

`code/main.py` 包含：

- 统一采样和动态FPS帧采样器。
- 一个简易的时间定位评估器：给定"真实"事件时间 T 和模型输出，用容差计算准确率。
- Video-LLaMA（16帧，Q-former）、Video-LLaVA（8帧，MLP）、Qwen2.5-VL（动态FPS + TMRoPE）三者之间的对比。

## 交付物

本课程产出 `outputs/skill-video-vlm-frame-planner.md`。给定一个视频任务（监控、动作识别、时间定位、摘要），它将选择帧采样器、池化系数、输出格式和预期准确率等级。

## 练习

1. 针对一段3分钟的烹饪演示，选择统一FPS还是动态FPS。用Token数量说明理由。

2. TMRoPE 具体增加了什么功能，是简单的时间嵌入表无法实现的？

3. 编写一个时间定位的JSON schema，供VLM学习输出。需包含错误情况。

4. 阅读 Video-LLaVA 第3节"对齐先于投影"。为什么这比训练独立的图像和视频编码器更好？

5. 查看 VideoMME 排行榜，截至2026年，最佳开源模型与最佳闭源模型之间的差距是多少？其中有多少差距可归因于时间编码，多少归因于基础LLM规模？

## 关键术语

| 术语 | 字面意思 | 实际含义 |
|------|---------|---------|
| Temporal grounding | 时间定位 | VLM输出事件发生的具体时间戳范围 |
| TMRoPE | 时间-多模态旋转位置编码 | 带绝对时间戳的三维旋转位置编码，由Qwen2.5-VL使用 |
| Dynamic FPS | 运动感知采样 | 在高运动片段采样更多帧，静态片段采样更少帧 |
| Frame pooling | 每帧空间压缩 | 在送入LLM前，通过双线性插值减少每帧的Patch数 |
| Video Q-former | 片段压缩器 | 交叉注意力瓶颈，将N帧映射为K个学习查询 |
| VideoMME | 视频基准测试 | 综合性短/中/长视频基准，2500+样本 |

## 延伸阅读

- [Zhang 等人 — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li 等人 — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin 等人 — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen团队 — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin 等人 — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
