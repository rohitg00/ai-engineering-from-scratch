# Janus-Pro:用于统一多模态模型的解耦编码器

> 统一多模态模型存在一个无法回避的矛盾。理解任务需要语义特征——即 SigLIP 或 DINOv2 输出的、富含概念级信息的向量。生成任务需要利于重建的编码——即可重新组合为清晰像素的 VQ token。这两个目标无法在单个编码器中同时满足。Janus(DeepSeek,2024 年 10 月)和 Janus-Pro(DeepSeek,2025 年 1 月)主张的解决方案是放弃这种尝试:将两个编码器解耦。在任务之间共享 Transformer 主体,但让理解任务通过 SigLIP 路由,生成任务通过 VQ tokenizer 路由。在 7B 规模下,Janus-Pro 在 GenEval 上超越 DALL-E 3,同时在 MMMU 上与 LLaVA 持平。本课将解读为什么双编码器能成功而单编码器会失败。

**Type:** Build
**Languages:** Python (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 分钟

## 学习目标

- 解释为什么单个共享编码器会损害理解或生成质量。
- 描述 Janus-Pro 的路由方式:输入侧使用 SigLIP 特征用于理解,输入和输出两侧均使用 VQ token 用于生成。
- 梳理使 Janus-Pro 成功而 Janus 未能成功的数据混合扩展策略。
- 比较解耦(Janus-Pro)、耦合-连续(Transfusion)和耦合-离散(Show-o)三种架构。

## 问题所在

统一模型在理解和生成之间共享一个 Transformer 主体。之前的尝试(Chameleon、Show-o、Transfusion)在两个方向上都使用同一个视觉 tokenizer。这个 tokenizer 是一种妥协:

- 为重建优化(生成):VQ-VAE 能捕捉细粒度的像素细节,但产生的 token 语义一致性较弱。
- 为语义优化(理解):SigLIP 嵌入会将"猫"的图像聚集在"猫"的 token 附近,但无法实现良好的重建。

Show-o 和 Transfusion 为此在其中一个方向上付出了明显的质量代价。Janus-Pro 提出:既然两个任务有不同的需求,为什么还要强制使用一个 tokenizer?

## 核心概念

### 解耦视觉编码

Janus-Pro 的架构将两个编码器分离:

- 理解路径。输入图像 → SigLIP-SO400m → 2 层 MLP → Transformer 主体。
- 生成路径。输入图像(如果以已有图像为条件)→ VQ tokenizer → token ID → Transformer 主体。
- 输出生成。由 Transformer 预测的图像 token → VQ 解码器 → 像素。

Transformer 主体是共享的。主体上游和下游的所有组件都是任务特定的。

输入通过提示格式来消歧:`<understand>` 标签经 SigLIP 路由;`<generate>` 经 VQ 路由。或者路由可以根据任务隐式确定。

### 为什么有效

理解损失获得 SigLIP 特征,这些特征经 CLIP 风格的预训练针对语义相似性进行了调优。模型在感知基准上的表现优于 Show-o / Transfusion,因为输入特征更适合该任务。

生成损失获得 VQ token,这些 token 经 tokenizer 针对重建进行了调优。图像质量优于 Show-o,因为 VQ 编码可以干净地还原为像素。

共享的 Transformer 主体面对两种输入分布(SigLIP 和 VQ),并学会同时处理两者。其论断是:只要有足够的数据和参数,主体就能吸收这种切换。

### 数据扩展——Janus 对比 Janus-Pro

Janus(原始版,arXiv 2410.13848)引入了解耦思想,但规模较小(1.3B 参数,数据有限)。Janus-Pro(arXiv 2501.17811)进行了扩展:

- 7B 参数(vs 1.3B)。
- 第一阶段(对齐)的图文对从 72M 增至 90M。
- 第二阶段(统一)从 26M 增至 72M。
- 第三阶段新增 20 万条图像生成指令样本。

结果是:Janus-Pro-7B 在 MMMU 上与 LLaVA 持平(60.3 vs 约 58),并在 GenEval 上超越 DALL-E 3(0.80 vs 0.67)。一个开源模型,在统一模型的两端都具备竞争力。

### JanusFlow——修正流变体

JanusFlow(arXiv 2411.07975)将 VQ 生成路径替换为修正流生成路径(连续)。拆分变为 SigLIP-用于-理解 + 修正流-用于-生成。质量上限进一步提升。架构仍然是"解耦编码器 + 共享主体"。

### 共享主体的职责

Transformer 主体处理统一序列,但面对两种输入分布。它的职责是:

- 对于理解:消费 SigLIP 特征 + 文本 token → 自回归地输出文本。
- 对于生成:消费文本 token +(可选的图像 VQ token)→ 自回归地输出图像 VQ token。

主体的每个块中没有模态特定的权重。它就是你在 Qwen 或 Llama 内部所见的那种标准文本 Transformer,外加两个输入适配器。

有趣的是,这意味着 Janus-Pro 的主体可以从预训练 LLM 初始化。Janus-Pro 确实从 DeepSeek-MoE-7B 初始化。这一选择很重要:该 LLM 带来了纯从零训练的统一模型难以企及的推理能力。

### 与 InternVL-U 的比较

InternVL-U(第 12.10 课)是 2026 年的后续工作。它结合了:

- 原生多模态预训练(InternVL3 骨干)。
- 解耦编码器路由(SigLIP 输入,VQ + 扩散头输出)。
- 统一的理解 + 生成 + 编辑。

InternVL-U 将 Janus-Pro 的架构选择吸收进了一个更大的框架。解耦编码器的思想如今已成为大规模统一模型的默认选择。

### 局限性

解耦编码器增加了架构复杂度。需要训练两个 tokenizer,维护两条输入路径,应对两套故障模式。对于不需要生成的产品,Janus-Pro 属于过度设计——应选择 LLaVA 系列的理解模型。

对于不需要理解的产品,Janus-Pro 能力过剩——应选择 Stable Diffusion 3 / Flux 模型。

对于同时需要两者的产品,Janus-Pro 现在是参考性的开源架构。

```figure
l5-janus-decouple
```

## 动手实践

`code/main.py` 模拟了 Janus-Pro 的路由:

- 两个模拟编码器:类 SigLIP(产生 256 维语义向量)和类 VQ(产生整数编码)。
- 一个提示路由器,根据任务标签选择编码器。
- 一个共享主体(替身),无论哪个编码器产生序列都能处理。
- 一个从第一阶段(对齐)到第三阶段(指令微调)的加权采样调度切换。

打印 3 个示例的路由路径:图像问答、T2I、图像编辑。

## 部署上线

本课产出 `outputs/skill-decoupled-encoder-picker.md`。给定一个希望以接近前沿质量实现统一生成 + 理解的产品,它会在 Janus-Pro、JanusFlow 或 InternVL-U 之间做出选择,并给出具体的数据规模建议。

## 练习

1. Janus-Pro-7B 在 GenEval 上超越了 DALL-E 3。解释为什么一个 7B 开源模型能在生成上匹敌前沿专有模型,却在理解上不能。

2. 实现一个路由函数:给定提示文本,将其分类为 `understand` 或 `generate`。如何处理像"先描述然后画个草图"这样有歧义的提示?

3. JanusFlow 用修正流替换了 VQ 路径。此时 Transformer 主体输出什么?损失函数有什么变化?

4. 提出第四个任务,使 Janus-Pro 架构通过再增加一个解耦编码器来处理。示例:图像分割(DINO 风格)、深度估计(MiDaS 风格)。

5. 阅读 Janus-Pro 第 4.2 节关于数据扩展的内容。相对于 Janus,哪个数据阶段对 T2I 质量提升的贡献最大?

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 解耦编码 | "两个视觉编码器" | 每个方向使用独立的 tokenizer 或编码器:理解用语义,生成用重建 |
| 共享主体 | "一个 Transformer" | 单个 Transformer 处理任一编码器的输出;无模态特定权重 |
| SigLIP 用于理解 | "语义特征" | CLIP 系列视觉塔,提供丰富的概念特征但重建能力差 |
| VQ 用于生成 | "重建编码" | 可干净解码回像素的向量量化 token |
| JanusFlow | "修正流变体" | Janus-Pro 用连续流匹配生成头替代 VQ |
| 路由标签 | "任务标签" | 选择输入编码器的提示标记(`<understand>` / `<generate>`) |

## 延伸阅读

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)