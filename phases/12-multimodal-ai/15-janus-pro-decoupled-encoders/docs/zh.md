# Janus-Pro：用于统一多模态模型的解耦编码器

> 统一多模态模型存在一种不可避免的张力。理解需要语义特征——SigLIP或DINOv2输出的富含概念级信息的向量。生成需要重建友好的编码——可以组合回清晰像素的VQ（向量量化）标记。这两个目标在单一编码器中无法兼容。Janus（DeepSeek，2024年10月）和Janus-Pro（DeepSeek，2025年1月）认为解决方案是停止尝试：解耦两个编码器。在任务间共享transformer主体，但通过SigLIP路由理解任务，通过VQ tokenizer（标记器）路由生成任务。在70亿参数规模下，Janus-Pro在GenEval上击败DALL-E 3，同时在MMMU上与LLaVA相当。本课程将解释为什么两个编码器比一个更有效。

**类型：** 构建
**语言：** Python（标准库，双编码器路由+共享主体信号）
**先决条件：** 第12·13阶段（Transfusion），第12·14阶段（Show-o）
**时间：** 约120分钟

## 学习目标

- 描述为什么单一共享编码器会损害理解或生成质量。
- 描述Janus-Pro的路由机制：理解任务使用输入侧的SigLIP特征，生成任务在输入和输出侧都使用VQ标记。
- 追溯使Janus-Pro成功而Janus未能成功的数据混合扩展策略。
- 比较解耦（Janus-Pro）、耦合连续（Transfusion）和耦合离散（Show-o）架构。

## 问题

统一模型在理解和生成任务间共享一个transformer主体。之前的尝试（Chameleon、Show-o、Transfusion）都使用一个视觉tokenizer（标记器）处理两个方向。这个tokenizer是一种折中方案：

- 针对重建（生成）优化：VQ-VAE（向量量化变分自编码器）捕获细粒度的像素细节，但生成的标记语义连贯性弱。
- 针对语义（理解）优化：SigLIP嵌入将"猫"的图像分组在"猫"标记附近，但不允许良好的重建。

Show-o和Transfusion为此在一个方向上付出了明显的质量代价。Janus-Pro问道：当任务需求不同时，为什么需要一个tokenizer？

## 概念

### 解耦视觉编码

Janus-Pro的架构将两个编码器分离：

- 理解路径。输入图像 → SigLIP-SO400m → 2层MLP（多层感知机）→ transformer主体。
- 生成路径。输入图像（如果基于现有图像进行条件化）→ VQ tokenizer → 标记ID → transformer主体。
- 输出生成。由transformer预测的图像标记 → VQ解码器 → 像素。

transformer主体是共享的。主体上游和下游的所有内容都是任务特定的。

输入通过提示格式消除歧义：`<understand>`标签通过SigLIP路由；`<generate>`通过VQ路由。或者路由根据任务隐式确定。

### 为什么这有效

理解损失使用SigLIP特征，这些特征通过CLIP风格的预训练针对语义相似性进行了调整。模型的感知基准在Show-o/Transfusion之上得到改进，因为输入特征更适合任务。

生成损失使用VQ标记，这些标记通过tokenizer针对重建进行了调整。图像质量在Show-o之上得到改进，因为VQ代码可以干净地组合回像素。

共享的transformer主体看到两种输入分布（SigLIP和VQ）并学会同时处理两者。主张是：足够的数据+足够的参数，主体可以吸收这种切换。

### 数据扩展 — Janus与Janus-Pro

Janus（原始版本，arXiv 2410.13848）引入了解耦，但规模较小（13亿参数，有限数据）。Janus-Pro（arXiv 2501.17811）进行了扩展：

- 70亿参数（对比13亿）。
- 第一阶段（对齐）使用9000万图像-文本对，从7200万增加。
- 第二阶段（统一）使用7200万，从2600万增加。
- 为第三阶段增加了20万图像生成指令样本。

结果是：Janus-Pro-70亿在MMMU上与LLaVA相当（60.3对比约58），在GenEval上击败DALL-E 3（0.80对比0.67）。一个开放模型，在统一频谱的两个方面都具有竞争力。

### JanusFlow — 修正流变体

JanusFlow（arXiv 2411.07975）将VQ生成路径替换为修正流生成路径（连续）。分裂变为SigLIP用于理解+修正流用于生成。质量上限进一步提升。架构保持为解耦编码器-共享主体。

### 共享主体的工作

transformer主体处理统一序列，但有两种输入分布。其工作是：

- 对于理解：消耗SigLIP特征+文本标记→自回归地输出文本。
- 对于生成：消耗文本标记+（可选的图像VQ标记）→自回归地输出图像VQ标记。

主体在每个块中没有模态特定的权重。它是你在Qwen或Llama内部期望找到的文本风格transformer，加上两个输入适配器。

有趣的是，这意味着Janus-Pro的主体可以从预训练的LLM初始化。Janus-Pro确实从DeepSeek-MoE-70亿初始化。这个选择很重要：LLM提供了推理能力，这是从头开始的统一模型难以达到的。

### 与InternVL-U相比

InternVL-U（课程12.10）是2026年的后续版本。它结合了：

- 原生多模态预训练（InternVL3主干）。
- 解耦编码器路由（SigLIP输入，VQ+扩散输出头）。
- 统一的理解+生成+编辑。

InternVL-U将Janus-Pro的架构选择纳入更大的框架中。解耦编码器理念现在已成为大规模统一模型的默认选择。

### 局限性

解耦编码器增加了架构复杂性。需要训练两个tokenizer，维护两条输入路径，两套故障模式。对于不需要生成的产品，Janus-Pro过度工程化——选择一个LLaVA系列的理解模型。

对于不需要理解的产品，Janus-Pro过于高级——选择一个Stable Diffusion 3/Flux模型。

对于需要两者的产品，Janus-Pro现在是参考开放架构。

## 使用它

`code/main.py`模拟Janus-Pro路由：

- 两个模拟编码器：类似SigLIP的（产生256维语义向量）和类似VQ的（产生整数编码）。
- 一个提示路由器，根据任务标签选择编码器。
- 一个共享主体（替代品），处理标记序列，无论哪个编码器产生它们。
- 从第一阶段（对齐）到第三阶段（指令调优）的加权采样计划切换。

打印3个示例的路由路径：图像问答、T2I（文本到图像）、图像编辑。

## 发布它

本课程生成`outputs/skill-decoupled-encoder-picker.md`。对于想要在接近前沿质量的统一生成+理解的产品，它选择Janus-Pro、JanusFlow或InternVL-U，并提供具体的数据规模建议。

## 练习

1. Janus-Pro-70亿在GenEval上击败DALL-E 3。解释为什么70亿开放模型可以在生成上匹配前沿专有模型，但在理解上不能。

2. 实现一个路由函数：给定提示文本，分类为`understand`（理解）或`generate`（生成）。如何处理"描述然后素描"这样的模糊提示？

3. JanusFlow用修正流替换了VQ路径。transformer主体现在输出什么，损失有什么变化？

4. 提出Janus-Pro架构可以通过另一个解耦编码器处理的第四个任务。例如：图像分割（DINO风格）、深度（MiDaS风格）。

5. 阅读Janus-Pro第4.2节关于数据扩展的内容。哪个数据阶段对T2I质量增益贡献最大，与Janus相比？

## 关键术语

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| 解耦编码 | "两个视觉编码器" | 每个方向使用单独的tokenizer或编码器：理解用语义，生成用重建 |
| 共享主体 | "一个transformer" | 单个transformer处理任一编码器的输出；没有模态特定的权重 |
| SigLIP用于理解 | "语义特征" | CLIP系列视觉塔，提供丰富的概念特征但重建能力差 |
| VQ用于生成 | "重建编码" | 向量量化标记，可以干净地解码回像素 |
| JanusFlow | "修正流变体" | Janus-Pro使用连续流匹配生成头替代VQ |
| 路由标签 | "任务标签" | 提示标记（`<understand>`/`<generate>`），用于选择输入编码器 |

## 进一步阅读

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)