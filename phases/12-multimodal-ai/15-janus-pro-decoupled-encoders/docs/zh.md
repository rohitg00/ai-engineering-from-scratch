# Janus-Pro：用解耦 encoder 做统一多模态模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 统一多模态模型有一对绕不过去的张力。理解任务想要语义特征——SigLIP 或 DINOv2 输出的向量富含概念级信息；生成任务想要利于重建的码本——VQ token 能干净地拼回清晰的像素。这两个目标在同一个 encoder 里没法兼得。Janus（DeepSeek，2024 年 10 月）和 Janus-Pro（DeepSeek，2025 年 1 月）说：别再硬凑了，把两个 encoder 解耦。transformer 主干两边共用，但理解走 SigLIP，生成走 VQ tokenizer。在 7B 规模下，Janus-Pro 在 GenEval 上击败了 DALL-E 3，同时在 MMMU 上和 LLaVA 打平。这一课讲为什么两个 encoder 能解决一个 encoder 解决不了的事。

**Type:** Build
**Languages:** Python (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 解释为什么单一共享 encoder 必然要在理解或生成质量上做妥协。
- 描述 Janus-Pro 的路由策略：理解侧输入走 SigLIP 特征，生成侧输入和输出都走 VQ token。
- 梳理让 Janus-Pro 成功而 Janus 没成功的数据规模化（data-mix scaling）路径。
- 比较解耦式（Janus-Pro）、耦合连续式（Transfusion）、耦合离散式（Show-o）三种架构。

## 问题（The Problem）

统一模型在理解和生成之间共享一个 transformer 主干。之前的尝试（Chameleon、Show-o、Transfusion）都用同一个视觉 tokenizer 同时承担两个方向。这个 tokenizer 本身就是个折中品：

- 偏向重建（生成）的：VQ-VAE 能抓住细粒度像素细节，但产出的 token 语义一致性弱。
- 偏向语义（理解）的：SigLIP embedding 把"猫"的图片聚到"猫"附近，但没法支持高质量重建。

Show-o 和 Transfusion 都因此在某一个方向上付出了肉眼可见的质量税。Janus-Pro 的反问是：既然两个任务诉求不同，为什么非得用一个 tokenizer？

## 概念（The Concept）

### 解耦的视觉编码（Decoupled visual encoding）

Janus-Pro 的架构把两个 encoder 分开：

- 理解路径。输入图像 → SigLIP-SO400m → 2 层 MLP → transformer 主干。
- 生成路径。输入图像（如果是基于已有图像做条件）→ VQ tokenizer → token ID → transformer 主干。
- 输出生成。transformer 预测出图像 token → VQ decoder → 像素。

transformer 主干是共享的。主干的上游和下游都是任务专属的。

输入靠 prompt 格式来消歧：`<understand>` 标签走 SigLIP，`<generate>` 标签走 VQ；或者直接由任务隐式决定路由。

### 为什么这样行得通（Why this works）

理解的 loss 拿到的是 SigLIP 特征，CLIP 风格的预训练已经把它调到适合做语义相似度。模型的感知类基准（perception benchmark）相比 Show-o / Transfusion 提升了，因为输入特征更适配这件事。

生成的 loss 拿到的是 VQ token，tokenizer 已经把它调到适合做重建。图像质量超过 Show-o，因为 VQ 码能干净地拼回像素。

共享的 transformer 主干看到两种输入分布（SigLIP 和 VQ），学着同时处理两者。论点是：只要数据够多、参数够大，主干能把这种切换吸收掉。

### 数据规模化——Janus vs Janus-Pro（Data scaling）

Janus（原版，arXiv 2410.13848）首次引入了解耦，但规模偏小（1.3B 参数，数据有限）。Janus-Pro（arXiv 2501.17811）做了规模化：

- 7B 参数（vs 1.3B）。
- stage 1（alignment）用了 90M 图文对，相比之前的 72M 提升。
- stage 2（unified）用了 72M，相比之前的 26M 提升。
- stage 3 增加了 200k 条图像生成指令样本。

效果：Janus-Pro-7B 在 MMMU 上追平 LLaVA（60.3 vs 约 58），在 GenEval 上击败 DALL-E 3（0.80 vs 0.67）。一个开放模型，在统一光谱的两端都有竞争力。

### JanusFlow——rectified flow 版本

JanusFlow（arXiv 2411.07975）把 VQ 生成路径换成了 rectified-flow 生成路径（连续）。架构变成 SigLIP 做理解 + rectified flow 做生成。质量上限被进一步抬高。架构总体仍是「解耦 encoder + 共享主干」。

### 共享主干干什么（The shared body's job）

transformer 主干处理的是一条统一序列，但要面对两种输入分布。它的工作是：

- 对理解：吃 SigLIP 特征 + 文本 token → autoregressive 地输出文本。
- 对生成：吃文本 token +（可选的图像 VQ token）→ autoregressive 地输出图像 VQ token。

主干内部没有按 block 区分模态的权重，就是你在 Qwen 或 Llama 里会看到的那种文本风格 transformer，加上两个输入侧的 adapter。

有意思的是，这意味着 Janus-Pro 的主干可以从一个预训练好的 LLM 初始化。Janus-Pro 确实从 DeepSeek-MoE-7B 初始化。这个选择很关键：LLM 贡献了纯从零训练的统一模型很难达到的推理能力。

### 与 InternVL-U 对比（Compared to InternVL-U）

InternVL-U（第 12.10 课）是 2026 年的后续工作。它综合了：

- 原生多模态预训练（InternVL3 主干）。
- 解耦 encoder 路由（输入 SigLIP，输出 VQ + diffusion head）。
- 统一的理解 + 生成 + 编辑。

InternVL-U 把 Janus-Pro 的架构选择吸收进了更大的框架里。解耦 encoder 这个想法，已经成了大规模统一模型的默认选择。

### 局限（Limitations）

解耦 encoder 增加了架构复杂度。要训两个 tokenizer，要维护两条输入路径，要处理两套失败模式。对那些不需要生成的产品，Janus-Pro 是过度设计——挑一个 LLaVA 系的理解模型就够了。

对那些不需要理解的产品，Janus-Pro 又超规格了——挑一个 Stable Diffusion 3 / Flux 模型即可。

对那些两边都要的产品，Janus-Pro 现在就是参考级的开放架构。

## 用起来（Use It）

`code/main.py` 模拟 Janus-Pro 的路由：

- 两个 mock encoder：类 SigLIP 的（产出 256 维语义向量）和类 VQ 的（产出整数码）。
- 一个 prompt router，根据任务标签挑 encoder。
- 一个共享主干（占位实现），无论 token 序列来自哪个 encoder 都统一处理。
- 一个从 stage 1（alignment）到 stage 3（instruction tune）的加权采样调度切换。

把 3 个样例的路由路径打印出来：图像 QA、T2I、图像编辑。

## 上线部署（Ship It）

这一课产出 `outputs/skill-decoupled-encoder-picker.md`。给定一个想做前沿级统一生成 + 理解的产品，它会在 Janus-Pro、JanusFlow、InternVL-U 之间选一个，并给出具体的数据规模建议。

## 练习（Exercises）

1. Janus-Pro-7B 在 GenEval 上击败 DALL-E 3。解释为什么一个 7B 的开放模型能在生成上追平前沿闭源模型，但在理解上做不到。

2. 实现一个 router 函数：给定 prompt 文本，分类为 `understand` 或 `generate`。怎么处理"先描述再画一张草图"这种含糊的 prompt？

3. JanusFlow 把 VQ 路径换成了 rectified flow。transformer 主干现在输出什么？loss 又有什么变化？

4. 提出第四个任务，让 Janus-Pro 架构再加一个解耦 encoder 来承载。例：图像分割（DINO 风格）、深度估计（MiDaS 风格）。

5. 读 Janus-Pro 第 4.2 节关于数据 scaling 的内容。哪个数据阶段对相比 Janus 的 T2I 质量提升贡献最大？

## 关键术语（Key Terms）

| 术语 | 通俗说法 | 实际含义 |
|------|-----------------|------------------------|
| Decoupled encoding | "两个视觉 encoder" | 每个方向用独立的 tokenizer 或 encoder：理解走语义型，生成走重建型 |
| Shared body | "一个 transformer" | 单一 transformer 处理任一 encoder 的输出，没有模态专属的权重 |
| SigLIP for understanding | "语义特征" | CLIP 系视觉塔，提供丰富的概念特征，但重建效果差 |
| VQ for generation | "重建码" | 向量量化（vector-quantized）token，能干净地解码回像素 |
| JanusFlow | "rectified-flow 版" | 把 VQ 换成连续 flow-matching 生成头的 Janus-Pro |
| Routing tag | "任务标签" | 选输入 encoder 用的 prompt 标记（`<understand>` / `<generate>`） |

## 延伸阅读（Further Reading）

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
