# Janus-Pro：统一多模态模型的解耦编码器

> 统一多模态模型有一个不可避免的紧张关系。理解想要语义特征——SigLIP 或 DINOv2 输出向量富含概念级信息。生成想要重建友好的代码——组合回清晰像素的 VQ token。两个目标在单一编码器中不兼容。Janus（DeepSeek，2024 年 10 月）和 Janus-Pro（DeepSeek，2025 年 1 月）认为修复方法是停止尝试：解耦两个编码器。在任务之间共享 transformer 主体，但通过 SigLIP 路由理解，通过 VQ 分词器路由生成。在 7B 参数下，Janus-Pro 在 GenEval 上击败 DALL-E 3，同时在 MMMU 上匹配 LLaVA。本课解读为什么两个编码器在单一编码器失败的地方有效。

**类型：** Build
**语言：** Python（stdlib，双编码器路由 + 共享主体信号）
**前置知识：** Phase 12 · 13（Transfusion），Phase 12 · 14（Show-o）
**时间：** ~120 分钟

## 学习目标

- 解释为什么单一共享编码器会损害理解或生成质量。
- 描述 Janus-Pro 的路由：输入端用于理解的 SigLIP 特征，输入和输出两端用于生成的 VQ token。
- 追踪使 Janus-Pro 在 Janus 未成功的地方成功的数据规模扩展。
- 比较解耦（Janus-Pro）、耦合连续（Transfusion）和耦合离散（Show-o）架构。

## 问题所在

统一模型在理解和生成之间共享 transformer 主体。先前的尝试（Chameleon、Show-o、Transfusion）都使用一个视觉分词器用于两个方向。分词器是一种妥协：

- 优化用于重建（生成）：VQ-VAE 捕获细粒度像素细节，但产生语义连贯性弱的 token。
- 优化用于语义（理解）：SigLIP 嵌入将"猫"图像分组在"猫"token 附近，但不允许良好的重建。

Show-o 和 Transfusion 在一个方向上为此付出可见的质量代价。Janus-Pro 问道：当任务有不同需求时，为什么要求一个分词器？

## 核心概念

### 解耦视觉编码

Janus-Pro 的架构分离两个编码器：

- 理解路径。输入图像 → SigLIP-SO400m → 2 层 MLP → transformer 主体。
- 生成路径。输入图像（如果以现有图像为条件）→ VQ 分词器 → token ID → transformer 主体。
- 输出生成。Transformer 预测的图像 token → VQ 解码器 → 像素。

Transformer 主体是共享的。主体上游和下游的一切都是任务特定的。

输入由提示词格式消除歧义：`<understand>` 标签通过 SigLIP 路由；`<generate>` 通过 VQ 路由。或者路由是隐式的，来自任务。

### 为什么这有效

理解损失获得 SigLIP 特征，CLIP 风格预训练已将其调整为语义相似性。模型的感知基准测试比 Show-o / Transfusion 改善，因为输入特征更适合该任务。

生成损失获得 VQ token，分词器已将其调整为重建。图像质量比 Show-o 改善，因为 VQ 代码干净地组合回像素。

共享的 transformer 主体看到两个输入分布（SigLIP 和 VQ）并学会与两者一起工作。声明：足够的数据 + 足够的参数，主体会吸收切换。

### 数据规模——Janus vs Janus-Pro

Janus（原始，arXiv 2410.13848）引入了解耦，但规模较小（1.3B 参数，有限数据）。Janus-Pro（arXiv 2501.17811）进行了扩展：

- 7B 参数（vs 1.3B）。
- 第 1 阶段（对齐）9000 万图像-文本对，从 7200 万增加。
- 第 2 阶段（统一）7200 万，从 2600 万增加。
- 第 3 阶段增加了 20 万图像生成指令样本。

结果：Janus-Pro-7B 在 MMMU 上匹配 LLaVA（60.3 vs ~58），在 GenEval 上击败 DALL-E 3（0.80 vs 0.67）。一个开放模型，在统一谱的两边都有竞争力。

### JanusFlow——整流流变体

JanusFlow（arXiv 2411.07975）将 VQ 生成路径替换为整流流生成路径（连续）。分裂变为 SigLIP 用于理解 + 整流流用于生成。质量上限进一步提升。架构保持解耦编码器-共享主体。

### 共享主体的任务

Transformer 主体处理统一序列，但有两个输入分布。它的任务是：

- 用于理解：消费 SigLIP 特征 + 文本 token → 自回归地发出文本。
- 用于生成：消费文本 token +（可选图像 VQ token）→ 自回归地发出图像 VQ token。

主体每个块没有模态特定权重。它是你在 Qwen 或 Llama 内部期望找到的文本风格 transformer，加上两个输入适配器。

有趣的是，这意味着 Janus-Pro 的主体可以从预训练 LLM 初始化。Janus-Pro 确实从 DeepSeek-MoE-7B 初始化。这一选择很重要：LLM 贡献了纯从头训练统一模型难以达到推理能力。

### 与 InternVL-U 比较

InternVL-U（第 12.10 课）是 2026 年的后续。它结合：

- 原生多模态预训练（InternVL3 骨干）。
- 解耦编码器路由（SigLIP 输入，VQ + 扩散头输出）。
- 统一理解 + 生成 + 编辑。

InternVL-U 将 Janus-Pro 的架构选择吸收到更大的框架中。解耦编码器想法现在是大规模统一模型的默认。

### 限制

解耦编码器增加了架构复杂性。两个分词器要训练，两个输入路径要维护，两组故障模式。对于不需要生成的产品，Janus-Pro 过度工程——选择 LLaVA 家族理解模型。

对于不需要理解的产品，Janus-Pro 过度合格——选择 Stable Diffusion 3 / Flux 模型。

对于两者都需要的产品，Janus-Pro 现在是参考开放架构。

## 使用它

`code/main.py` 模拟 Janus-Pro 路由：

- 两个模拟编码器：SigLIP 风格（产生 256 维语义向量）和 VQ 风格（产生整数代码）。
- 基于任务标签选择编码器的提示词路由器。
- 共享主体（替代品），无论哪个编码器产生 token 序列都处理它们。
- 从第 1 阶段（对齐）到第 3 阶段（指令调优）的加权样本调度切换。

为 3 个示例打印路由路径：图像 QA、T2I、图像编辑。

## 交付它

本课产出 `outputs/skill-decoupled-encoder-picker.md`。给定一个想要前沿质量统一生成 + 理解的产品，它在 Janus-Pro、JanusFlow 或 InternVL-U 之间选择，并给出具体的数据规模建议。

## 练习

1. Janus-Pro-7B 在 GenEval 上击败 DALL-E 3。解释为什么一个 7B 开放模型可以在生成上匹配前沿专有模型，但在理解上不能。

2. 实现一个路由器函数：给定提示词文本，分类为 `understand` 或 `generate`。你如何处理像"描述然后素描"这样的模糊提示词？

3. JanusFlow 用整流流替换 VQ 路径。Transformer 主体现在输出什么，损失中有什么变化？

4. 提出 Janus-Pro 架构可以用一个额外解耦编码器处理的第四个任务。示例：图像分割（DINO 风格）、深度（MiDaS 风格）。

5. 阅读 Janus-Pro 第 4.2 节关于数据规模。哪个数据阶段对 T2I 质量提升 vs Janus 贡献最大？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 解耦编码 | "两个视觉编码器" | 每个方向单独的分词器或编码器：语义用于理解，重建用于生成 |
| 共享主体 | "一个 transformer" | 单个 transformer 处理任一编码器的输出；没有模态特定权重 |
| SigLIP 用于理解 | "语义特征" | CLIP 家族视觉塔提供丰富的概念特征但重建差 |
| VQ 用于生成 | "重建代码" | 向量量化 token 干净地解码回像素 |
| JanusFlow | "整流流变体" | 用连续流匹配生成头替换 VQ 的 Janus-Pro |
| 路由标签 | "任务标签" | 选择输入编码器的提示词标记（`<understand>` / `<generate>`） |

## 延伸阅读

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
