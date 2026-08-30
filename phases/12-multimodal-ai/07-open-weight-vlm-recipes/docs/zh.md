# 07 · 开放权重 VLM 配方：真正重要的是什么

> 2024-2026 年的开放权重「视觉语言模型（VLM）」文献是一片消融表（ablation table）的森林。苹果的 MM1 测试了图像编码器、连接器与数据配比的 13 种组合。Allen AI 的 Molmo 证明了精细的人工标注字幕胜过 GPT-4V 蒸馏。Cambrian-1 跑了 20 多种编码器对比。Idefics2 形式化了五轴设计空间。Prismatic VLMs 在受控基准上比较了 27 种训练配方。在所有这些噪声之中，有一小撮结论跨论文成立：图像编码器比连接器架构更重要，数据配比比二者都更重要，而精细的人工字幕胜过蒸馏出的合成数据。本课替你读完这些表格，省去你亲自翻阅之苦。

**类型：** 学习 + 实验
**语言：** Python（标准库，消融表解析器 + 配方挑选器）
**前置：** 阶段 12 · 05（LLaVA 基线）
**时长：** 约 180 分钟

## 学习目标

- 说出 VLM 的五轴设计空间：图像编码器、连接器、LLM、数据配比、分辨率调度。
- 读懂一张 MM1 / Idefics2 / Cambrian-1 的消融表，并预测哪个旋钮会撬动某个给定基准。
- 在给定算力预算和任务组合的情况下，为一个新 VLM 挑选配方（编码器、连接器、数据、分辨率）。
- 解释为什么在相同 token 数下，精细的人工字幕胜过 GPT-4V 蒸馏。

## 问题所在

存在数以百计的开放权重 VLM。「好」与「最先进」之间的差距大部分并不在架构上，而在于数据、分辨率调度和编码器选择。当你的模型表现不佳时，知道该先拧哪个旋钮，能让你避免一个耗费 500 万 GPU 小时的错误。

2023 年的那一波（LLaVA-1.5、InstructBLIP、MiniGPT-4）依靠字幕对预训练 + LLaVA-Instruct-150k。是个不错的基线，MMMU 上限在 35% 左右。

2024 年的那一波（MM1、Idefics2、Molmo、Cambrian-1、Prismatic VLMs）做了详尽的消融实验。结果既出人意料又非常实用。

## 核心概念

### 五轴设计空间

Idefics2（Laurençon 等人，2024）命名了这些轴：

1. 图像编码器。CLIP ViT-L/14、SigLIP SO400m/14、DINOv2 ViT-g/14、InternViT-6B。不同编码器在 patch 大小、分辨率和预训练目标上各有差异。
2. 连接器（connector）。MLP（2-4 层）、Q-Former（32 个 query + 交叉注意力）、Perceiver Resampler（64 个 query）、C-Abstractor（卷积 + 双线性池化）。
3. 语言模型。Llama-3 8B / 70B、Mistral 7B、Phi-3、Gemma-2、Qwen2.5。LLM 规模是参数成本的主导因素。
4. 训练数据。字幕对（CC3M、LAION）、交织数据（OBELICS、MMC4）、指令数据（LLaVA-Instruct、ShareGPT4V、PixMo、Cauldron）。
5. 分辨率调度。固定 224/336/448、AnyRes、原生动态。可以在训练中逐步提升，也可以保持恒定。

每个生产级 VLM 都要在每条轴上做出选择。MMMU 分数的大部分方差由第 1、4、5 轴解释——而不是由你选了哪种连接器。

### 第 1 轴：编码器 > 连接器

MM1 第 3.2 节显示：从 CLIP ViT-L/14 换成 SigLIP SO400m/14，MMMU 提升了 3 个点以上。而把连接器从 MLP 换成 Perceiver Resampler，提升不到 1 个点。Idefics2 复现了这一点：SigLIP > CLIP，且在相同 token 数下 Q-Former ≈ MLP ≈ Perceiver。

Cambrian-1 的「Cambrian 视觉编码器擂台赛」（Tong 等人，2024）在一个以视觉为中心的基准（CV-Bench）上跑了 20 多种编码器。排行榜顶部是 DINOv2 和 SigLIP 的混搭；CLIP 居中；ImageBind 和 ViT-MAE 偏低。从 CLIP ViT-L 到 DINOv2 ViT-g/14，在 CV-Bench 上相差约 5-7 个点。

2026 年开放 VLM 的默认编码器是 SigLIP 2 SO400m/14，用于语义 + 稠密特征，有时还会拼接上 DINOv2 ViT-g/14 的特征（Cambrian 的「空间视觉聚合器（Spatial Vision Aggregator）」就是这么做的）。

### 第 2 轴：连接器设计无关紧要

MM1、Idefics2、Prismatic 和 MM-Interleaved 都得出了相同结论：在固定的视觉 token 数下，连接器架构几乎不影响结果。对均值池化后的 patch 跑一个 2 层 MLP，在相同 token 预算下，其表现与 32-query 的 Q-Former 相差不到 1 个点。

真正重要的是 token 数。更多视觉 token = 更多 LLM 算力 = 在某个临界点之前性能更好，之后收益递减。每张图 64 个 token 对 OCR 来说太少。576-1024 个 token 是大多数开放 VLM 的甜点区。2048+ 只对文档和图表有帮助。

Q-Former 与 MLP 之争是成本问题，而非质量问题：无论图像分辨率多高，Q-Former 都把 token 数封顶在 32-64；而 MLP 会发出全部 patch token。对于高分辨率输入，Q-Former 能节省 LLM 上下文；对于低分辨率输入，二者差异只是噪声。

### 第 3 轴：LLM 规模设定上限

把 LLM 从 7B 翻倍到 13B，在每篇 VLM 论文中都能稳定地为 MMMU 带来 2-4 个点的提升。到了 70B，大多数基准都已饱和。VLM 的多模态推理上限就是 LLM 的文本推理上限——视觉编码器只能给它喂料，不能替它推理。

这就是为什么 Qwen2.5-VL-72B 和 Claude Opus 4.7 能在 MMMU-Pro 和 ScreenSpot-Pro 上碾压对手：语言大脑非常庞大。一个 7B 的 VLM 无法靠巧妙的连接器设计来替代 70B 的 VLM。

### 第 4 轴：数据——精细的人工字幕胜过蒸馏

Molmo + PixMo（Deitke 等人，2024）是 2024 年人人都该读一读的结论。Allen AI 让人工标注员用 1-3 分钟的稠密语音转文字来描述图像，产出了 71.2 万张稠密标注图像。训练数据中没有任何一处用到 GPT-4V 蒸馏。

Molmo-72B 在 11 项基准的全部 11 项上击败了 Llama-3.2-90B-Vision。这个差距不来自架构——而来自字幕质量。精细的人工字幕每张图所含信息量比简短的网络字幕多 5-10 倍，而且在 GPT-4V 蒸馏会产生幻觉的地方仍能保持事实依据。

ShareGPT4V（Chen 等人，2023）和 Cauldron（Idefics2）沿用了同样的打法，混合了人工 + GPT-4V 字幕。趋势很清晰：对于 2026 年的前沿而言，字幕稠密度 > 字幕数量 > 蒸馏的便利性。

### 第 5 轴：分辨率及其调度

Idefics2 的消融实验：384 -> 448 提升 1-2 个点。448 -> 980 配合图像切分（AnyRes），在 OCR 基准上再提升 3-5 个点。平坦分辨率训练在中等精度处停滞；而分辨率渐进（从 224 起步，结束于 448 或原生分辨率）训练更快，最终也更高。

Cambrian-1 跑了一个分辨率与 token 数的取舍：在固定算力下，你可以选择低分辨率下更多的 token，或高分辨率下更少的 token。OCR 偏好高分辨率；通用场景理解偏好低分辨率-更多 token。

2026 年的生产配方：第 1 阶段固定 384 训练，第 2 阶段对 OCR 密集任务采用动态分辨率，上至 1280。

### Prismatic 受控对比

Prismatic VLMs（Karamcheti 等人，2024）是那篇控制了所有轴的论文。相同的 13B LLM、相同的指令数据、相同的评测——每次只变动一条轴。结果：

- 每张图的视觉 token 数解释了约 60% 的方差。
- 编码器选择解释了约 20%。
- 连接器架构解释了约 5%。
- 其余一切（数据配比、调度器、学习率）解释了剩下约 15%。

这是个粗略的分解，但它是文献中对「我该先消融什么」给出的最清晰回答。

### 一个面向 2026 的挑选器

鉴于这些证据，2026 年一个新项目的默认开放 VLM 配方为：

- 编码器：SigLIP 2 SO400m/14，配合 NaFlex 在原生分辨率下使用；如果你需要分割/定位（grounding），再拼接上 DINOv2 ViT-g/14 以获得稠密特征。
- 连接器：对 patch token 用 2 层 MLP。除非你受 token 数约束，否则跳过 Q-Former。
- LLM：Qwen2.5 / Llama-3.1 / Gemma 2，追求成本用 7B，追求质量用 70B，按目标延迟来选。
- 数据：PixMo + ShareGPT4V + Cauldron，再用特定任务的指令数据加料。
- 分辨率：动态（长边最小 256，最大 1280 像素）。
- 调度：第 1 阶段对齐（仅训练 projector），第 2 阶段全量微调，第 3 阶段特定任务微调。

以上每一项默认值都能追溯到本课结尾所引论文中实测的某次消融实验。

## 上手用它

`code/main.py` 是一个消融表解析器兼配方挑选器。它编码了 MM1 和 Idefics2 的消融表（精简版），让你可以查询：

- 「给定预算 X 和任务 Y，哪种配方胜出？」
- 「如果我在 7B Llama 上把 SigLIP 换成 CLIP，MMMU 的预期变化是多少？」
- 「要得到 80% 置信度的答案，我该先消融哪条轴？」

输出是一份排序后的配方列表，附带预期的基准变化值，以及一条「先消融哪个」的建议。

## 交付它

本课产出 `outputs/skill-vlm-recipe-picker.md`。给定目标任务组合、算力预算和延迟目标，它会输出一份完整配方（编码器、连接器、LLM、数据配比、分辨率调度），并为每个选择附上佐证该选择的消融出处。这能让工程师在每次启动新 VLM 项目时，不必再重新发明 Idefics2 那张消融表。

## 练习

1. 读 MM1 第 3.2 节。对于一个固定的 2B LLM、预算为 5000 万张图，哪个编码器胜出？换成 13B LLM 答案会反转吗？为什么？

2. Cambrian-1 发现，拼接 DINOv2 + SigLIP 在以视觉为中心的基准上胜过单独使用任一编码器，但在 MMMU 上不带来任何增益。预测哪些基准会获益、哪些会保持不变。

3. 你的目标是在 2B LLM 上做一个移动端 UI 智能体。挑选编码器、连接器、分辨率和数据配比。用一张具体的消融表来论证每个选择。

4. Molmo 发布了 4B 和 72B 模型。4B 与闭源 7B VLM 不相上下；72B 在 11/11 项基准上击败 Llama-3.2-90B-Vision。这对「LLM 规模平台期」假设说明了什么？

5. 设计一张消融表，以便在一个 7B VLM 上把数据配比质量与编码器质量隔离开来。最少需要多少次训练运行？给出四条轴的设置方案。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 消融（Ablation） | 「拧一个旋钮」 | 跑多次训练，每次只在设计空间的一条轴上有差异，其余一切保持不变 |
| 连接器（Connector） | 「桥」/「投影器（projector）」 | 可训练模块，把视觉编码器输出映射到 LLM 的 token 空间（MLP、Q-Former、Perceiver） |
| 精细人工字幕（Detailed human caption） | 「稠密字幕」 | 由人工撰写的多句描述（通常 80-300 token），比网络 alt 文本更丰富 |
| 蒸馏（Distillation） | 「GPT-4V 字幕」 | 由更强的专有 VLM 生成的训练数据；便利，但容易继承幻觉 |
| AnyRes / 动态分辨率 | 「高分辨率通路」 | 通过切片（tiling）或 M-RoPE，把超出编码器原生分辨率的图像喂进去的策略 |
| 分辨率渐进（Resolution ramp） | 「课程（curriculum）」 | 从低分辨率起步并逐步升高的训练调度，可加速对齐学习 |
| 以视觉为中心的基准（Vision-centric bench） | 「CV-Bench / BLINK」 | 侧重细粒度视觉感知、而非语言密集型推理的评测 |
| PixMo | 「Molmo 的数据」 | Allen AI 的 71.2 万张稠密标注图像数据集；由人工语音转写成稠密字幕 |

## 延伸阅读

- [McKinzie 等人 — MM1（arXiv:2403.09611）](https://arxiv.org/abs/2403.09611)
- [Laurençon 等人 — Idefics2 / 构建 VLM 时什么才重要（arXiv:2405.02246）](https://arxiv.org/abs/2405.02246)
- [Deitke 等人 — Molmo 与 PixMo（arXiv:2409.17146）](https://arxiv.org/abs/2409.17146)
- [Tong 等人 — Cambrian-1（arXiv:2406.16860）](https://arxiv.org/abs/2406.16860)
- [Karamcheti 等人 — Prismatic VLMs（arXiv:2402.07865）](https://arxiv.org/abs/2402.07865)
