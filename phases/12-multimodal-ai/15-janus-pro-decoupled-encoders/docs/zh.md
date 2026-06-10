# 15 · Janus-Pro：面向统一多模态模型的解耦编码器

> 统一多模态模型存在一个无法回避的张力。理解任务需要语义特征——SigLIP 或 DINOv2 输出的向量富含概念级信息。生成任务需要利于重建的编码——VQ token 能重新组合出清晰的像素。这两个目标在单一编码器里无法兼容。Janus（DeepSeek，2024 年 10 月）和 Janus-Pro（DeepSeek，2025 年 1 月）主张：别再硬凑了，把两个编码器「解耦（decouple）」。在任务之间共享 transformer 主干，但让理解任务走 SigLIP，生成任务走 VQ 分词器（tokenizer）。在 7B 规模上，Janus-Pro 在 GenEval 上击败 DALL-E 3，同时在 MMMU 上追平 LLaVA。本课讲清楚为什么两个编码器能成功，而一个编码器却不行。

**类型：** 实战（Build）
**语言：** Python（标准库，双编码器路由 + 共享主干信号）
**前置：** 阶段 12 · 13（Transfusion）、阶段 12 · 14（Show-o）
**时长：** 约 120 分钟

## 学习目标

- 解释为什么单一共享编码器会牺牲理解质量或生成质量。
- 描述 Janus-Pro 的路由方式：输入侧用 SigLIP 特征做理解，输入与输出侧都用 VQ token 做生成。
- 梳理让 Janus-Pro 成功、而 Janus 没能成功的数据混合（data-mix）扩展策略。
- 比较解耦式（Janus-Pro）、耦合连续式（Transfusion）、耦合离散式（Show-o）三种架构。

## 问题所在

统一模型在理解与生成之间共享一个 transformer 主干。此前的尝试（Chameleon、Show-o、Transfusion）都对两个方向使用同一个视觉分词器。这个分词器是一种折中：

- 为重建（生成）优化：VQ-VAE 能捕捉细粒度的像素细节，但产生的 token 语义连贯性较弱。
- 为语义（理解）优化：SigLIP 嵌入会把「猫」的图像聚到「猫」的 token 附近，但无法支持良好的重建。

Show-o 和 Transfusion 为此在某一个方向上付出了肉眼可见的质量代价。Janus-Pro 提出疑问：既然两个任务需求不同，为什么非要用同一个分词器？

## 核心概念

### 解耦的视觉编码

Janus-Pro 的架构把两个编码器分开：

- 理解路径。输入图像 → SigLIP-SO400m → 2 层 MLP → transformer 主干。
- 生成路径。输入图像（若以已有图像为条件）→ VQ 分词器 → token ID → transformer 主干。
- 输出生成。transformer 预测出的图像 token → VQ 解码器 → 像素。

transformer 主干是共享的。主干的上游和下游一切都是任务专属的。

输入通过提示词格式来消歧：`<understand>` 标签路由到 SigLIP；`<generate>` 路由到 VQ。或者路由也可以由任务隐式决定。

### 为什么这样行得通

理解损失拿到的是 SigLIP 特征，而 CLIP 式预训练已经把它调校得擅长语义相似性。模型的感知类基准表现优于 Show-o / Transfusion，因为输入特征更契合该任务。

生成损失拿到的是 VQ token，而分词器已经把它调校得擅长重建。图像质量优于 Show-o，因为 VQ 编码能干净地组合回像素。

共享的 transformer 主干会面对两种输入分布（SigLIP 与 VQ），并学会同时处理二者。其论点是：只要数据够多、参数够多，主干就能吸收这种切换。

### 数据扩展——Janus 对比 Janus-Pro

Janus（原版，arXiv 2410.13848）引入了解耦思路，但规模较小（1.3B 参数，数据有限）。Janus-Pro（arXiv 2501.17811）进行了扩展：

- 7B 参数（对比 1.3B）。
- 第 1 阶段（对齐）使用 90M 图文对，从 72M 提升而来。
- 第 2 阶段（统一）使用 72M，从 26M 提升而来。
- 第 3 阶段新增了 20 万条图像生成指令样本。

结果是：Janus-Pro-7B 在 MMMU 上追平 LLaVA（60.3 对比约 58），在 GenEval 上击败 DALL-E 3（0.80 对比 0.67）。一个开源模型，在统一谱系的两端都具备竞争力。

### JanusFlow——整流流（rectified flow）变体

JanusFlow（arXiv 2411.07975）把 VQ 生成路径换成了整流流生成路径（连续）。拆分变为「SigLIP 做理解 + 整流流做生成」。质量上限进一步抬高。架构依然是「解耦编码器 + 共享主干」。

### 共享主干的职责

transformer 主干处理的是一条统一序列，但面对两种输入分布。它的职责是：

- 对理解任务：消费 SigLIP 特征 + 文本 token → 自回归地输出文本。
- 对生成任务：消费文本 token +（可选的图像 VQ token）→ 自回归地输出图像 VQ token。

主干在每个 block 上都没有模态专属的权重。它就是你预期会在 Qwen 或 Llama 内部见到的那种文本式 transformer，再加上两个输入适配器。

有意思的是，这意味着 Janus-Pro 的主干可以用一个预训练好的 LLM 来初始化。Janus-Pro 确实是从 DeepSeek-MoE-7B 初始化的。这个选择很重要：LLM 贡献了推理能力，而纯从零训练的统一模型很难达到这种能力。

### 与 InternVL-U 的对比

InternVL-U（第 12.10 课）是 2026 年的后续工作。它整合了：

- 原生多模态预训练（InternVL3 主干）。
- 解耦编码器路由（SigLIP 进，VQ + 扩散头出）。
- 统一的理解 + 生成 + 编辑。

InternVL-U 把 Janus-Pro 的架构选择吸纳进了一个更大的框架。解耦编码器思路如今已成为大规模统一模型的默认方案。

### 局限

解耦编码器增加了架构复杂度。要训练两个分词器、维护两条输入路径、应对两套失败模式。对于不需要生成的产品，Janus-Pro 是过度工程——选一个 LLaVA 系列的理解模型即可。

对于不需要理解的产品，Janus-Pro 又是大材小用——选一个 Stable Diffusion 3 / Flux 模型即可。

对于两者都需要的产品，Janus-Pro 如今是参考性的开源架构。

## 动手用

`code/main.py` 模拟 Janus-Pro 的路由：

- 两个模拟编码器：类 SigLIP（产生 256 维语义向量）和类 VQ（产生整数编码）。
- 一个提示词路由器，根据任务标签选择编码器。
- 一个共享主干（占位实现），无论 token 序列由哪个编码器产生都能处理。
- 一个从第 1 阶段（对齐）到第 3 阶段（指令微调）的加权采样调度切换。

打印 3 个示例的路由路径：图像问答、文生图（T2I）、图像编辑。

## 交付物

本课产出 `outputs/skill-decoupled-encoder-picker.md`。给定一个需要在接近前沿的质量下做统一生成 + 理解的产品，它会在 Janus-Pro、JanusFlow、InternVL-U 之间做出选择，并给出具体的数据规模建议。

## 练习

1. Janus-Pro-7B 在 GenEval 上击败了 DALL-E 3。请解释为什么一个 7B 开源模型在生成上能追平前沿闭源模型，但在理解上却不能。

2. 实现一个路由函数：给定提示词文本，将其分类为 `understand` 或 `generate`。对于「描述一下然后画个草图」这类含糊的提示词，你会如何处理？

3. JanusFlow 把 VQ 路径替换成了整流流。此时 transformer 主干输出的是什么？损失函数又发生了什么变化？

4. 提出第四个任务，让 Janus-Pro 架构能够通过再增加一个解耦编码器来处理。示例：图像分割（DINO 风格）、深度估计（MiDaS 风格）。

5. 阅读 Janus-Pro 第 4.2 节关于数据扩展的内容。相比 Janus，哪个数据阶段对 T2I 质量提升的贡献最大？

## 关键术语

| 术语 | 通常的说法 | 实际含义 |
|------|-----------------|------------------------|
| 解耦编码（Decoupled encoding） | 「两个视觉编码器」 | 每个方向用各自独立的分词器或编码器：理解用语义型，生成用重建型 |
| 共享主干（Shared body） | 「一个 transformer」 | 单个 transformer 处理任一编码器的输出；没有模态专属权重 |
| SigLIP 做理解 | 「语义特征」 | CLIP 系列视觉塔，提供丰富的概念特征但重建效果差 |
| VQ 做生成 | 「重建编码」 | 向量量化（vector-quantized）token，能干净地解码回像素 |
| JanusFlow | 「整流流变体」 | 用连续的流匹配（flow-matching）生成头替代 VQ 的 Janus-Pro |
| 路由标签（Routing tag） | 「任务标签」 | 用于选择输入编码器的提示词标记（`<understand>` / `<generate>`） |

## 延伸阅读

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
