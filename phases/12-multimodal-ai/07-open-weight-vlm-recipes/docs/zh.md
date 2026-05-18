# 开源权重 VLM 配方：什么才是真正重要的

> 2024-2026 年的开源权重 VLM 文献是一片消融表格的森林。苹果的 MM1 测试了图像编码器、连接器和数据混合的 13 种组合。Allen AI 的 Molmo 证明了详细的人工描述优于 GPT-4V 蒸馏。Cambrian-1 进行了 20 多个编码器比较。Idefics2 将五轴设计空间形式化。Prismatic VLMs 在受控基准上比较了 27 种训练配方。在所有这些噪音中，有一小部分结果跨越论文保持一致：图像编码器比连接器架构更重要，数据混合比两者都重要，而详细的人工描述优于蒸馏合成数据。本课替你阅读了这些表格，你不必再看了。

**类型：** Learn + lab
**语言：** Python（stdlib，消融表格解析器 + 配方选择器）
**前置知识：** Phase 12 · 05（LLaVA 基线）
**时间：** ~180 分钟

## 学习目标

- 命名五轴 VLM 设计空间：图像编码器、连接器、LLM、数据混合、分辨率调度。
- 阅读 MM1 / Idefics2 / Cambrian-1 消融表格，并预测哪个旋钮会影响给定基准。
- 给定计算预算和任务组合，为新 VLM 选择配方（编码器、连接器、数据、分辨率）。
- 解释为什么详细的人工描述在相同 token 数量下优于 GPT-4V 蒸馏。

## 问题所在

数百个开源权重 VLM 存在。"好"与"最先进"之间的大部分差距并非架构。而是数据、分辨率调度和编码器选择。知道当你的模型表现不佳时应该先转动哪个旋钮，可以帮你避免一个 500 万 GPU 小时的错误。

2023 年的浪潮（LLaVA-1.5、InstructBLIP、MiniGPT-4）运行在描述对预训练 + LLaVA-Instruct-150k 上。良好的基线。在 MMMU 上达到约 35%。

2024 年的浪潮（MM1、Idefics2、Molmo、Cambrian-1、Prismatic VLMs）进行了详尽的消融。结果既令人惊讶又实用。

## 核心概念

### 五轴设计空间

Idefics2（Laurençon 等人，2024）命名了这些轴：

1. 图像编码器。CLIP ViT-L/14、SigLIP SO400m/14、DINOv2 ViT-g/14、InternViT-6B。编码器在 patch size、分辨率和预训练目标上有所不同。
2. 连接器。MLP（2-4 层）、Q-Former（32 个查询 + 交叉注意力）、Perceiver Resampler（64 个查询）、C-Abstractor（卷积 + 双线性池化）。
3. 语言模型。Llama-3 8B / 70B、Mistral 7B、Phi-3、Gemma-2、Qwen2.5。LLM 大小是主导参数成本。
4. 训练数据。描述对（CC3M、LAION）、交错数据（OBELICS、MMC4）、指令数据（LLaVA-Instruct、ShareGPT4V、PixMo、Cauldron）。
5. 分辨率调度。固定 224/336/448、AnyRes、原生动态。训练期间递增或恒定。

每个生产 VLM 在每个轴上都做出了选择。MMMU 分数的大部分方差由轴 1、4 和 5 解释——而不是你选择的连接器。

### 轴 1：编码器 > 连接器

MM1 第 3.2 节表明：从 CLIP ViT-L/14 切换到 SigLIP SO400m/14 增加了 3+ 点 MMMU。将连接器从 MLP 切换到 Perceiver Resampler 增加了不到 1 点。Idefics2 复现了：SigLIP > CLIP，在相同 token 数量下 Q-Former ≈ MLP ≈ Perceiver。

Cambrian-1 的 "Cambrian Vision Encoders Match-Up"（Tong 等人，2024）在视觉中心基准（CV-Bench）上运行了 20 多个编码器。排行榜顶部是 DINOv2 和 SigLIP 的混合；CLIP 处于中游；ImageBind 和 ViT-MAE 较低。从 CLIP ViT-L 到 DINOv2 ViT-g/14 的差距在 CV-Bench 上约为 5-7 点。

2026 年开源 VLM 的默认编码器是 SigLIP 2 SO400m/14，用于语义 + 密集特征，有时与 DINOv2 ViT-g/14 特征拼接（Cambrian 的 "Spatial Vision Aggregator" 这样做）。

### 轴 2：连接器设计无关紧要

MM1、Idefics2、Prismatic 和 MM-Interleaved 都得出相同结论：在固定视觉 token 数量下，连接器架构几乎不重要。在平均池化 patch 上的 2 层 MLP 在相同 token 预算下与 32 查询 Q-Former 的性能差距在 1 点以内。

真正重要的是 token 数量。更多视觉 token = 更多 LLM 计算 = 更好的性能，直到某一点后收益递减。每张图像 64 个 token 对 OCR 来说太少。576-1024 个 token 是大多数开源 VLM 的最佳点。2048+ 仅对文档和图表有帮助。

Q-Former vs MLP 是一个成本问题，不是质量问题：Q-Former 将 token 限制在 32-64，无论图像分辨率如何；MLP 发出所有 patch token。对于高分辨率输入，Q-Former 节省 LLM 上下文；对于低分辨率，差异是噪声。

### 轴 3：LLM 大小设定上限

将 LLM 从 7B 翻倍到 13B 在每个 VLM 论文中可靠地增加 2-4 点 MMMU。在 70B 时，大多数基准达到饱和。VLM 的多模态推理上限是 LLM 的文本推理上限——视觉编码器只能喂养它，不能替它推理。

这就是 Qwen2.5-VL-72B 和 Claude Opus 4.7 在 MMMU-Pro 和 ScreenSpot-Pro 上碾压的原因：语言大脑是巨大的。7B VLM 无法通过巧妙的连接器设计替代 70B VLM。

### 轴 4：数据——详细的人工描述优于蒸馏

Molmo + PixMo（Deitke 等人，2024）是每个人都应该阅读的 2024 年结果。Allen AI 让人工标注员用 1-3 分钟的密集语音转文本来描述图像，产生了 712K 密集描述的图像。训练数据中没有任何 GPT-4V 蒸馏。

Molmo-72B 在 11 个基准中的 11 个上击败了 Llama-3.2-90B-Vision。差异不是架构——而是描述质量。详细的人工描述每张图像包含比短网页描述多 5-10 倍的信息，并且在 GPT-4V 蒸馏产生幻觉的地方保持事实基础。

ShareGPT4V（Chen 等人，2023）和 Cauldron（Idefics2）遵循了相同的人工 + GPT-4V 描述混合策略。趋势很明显：对于 2026 年的前沿，描述密度 > 描述数量 > 蒸馏便利性。

### 轴 5：分辨率及其调度

Idefics2 的消融：384 -> 448 增加 1-2 点。448 -> 980 带图像分割（AnyRes）在 OCR 基准上再增加 3-5。固定分辨率训练在中等准确率处达到平台期；分辨率递增（从 224 开始，到 448 或原生结束）训练更快且最终更高。

Cambrian-1 进行了分辨率 vs token 权衡：在固定计算下，你可以有更多低分辨率 token 或更少高分辨率 token。高分辨率对 OCR 获胜；低分辨率-更多 token 对一般场景理解获胜。

2026 年生产配方：第一阶段在 384 固定分辨率训练，第二阶段动态分辨率最高 1280，用于 OCR 密集型任务。

### Prismatic 受控比较

Prismatic VLMs（Karamcheti 等人，2024）是控制所有轴的论文。相同的 13B LLM、相同的指令数据、相同的评估——每次只有一个轴变化。结果：

- 每张图像视觉 token 数量解释约 60% 的方差。
- 编码器选择解释约 20%。
- 连接器架构解释约 5%。
- 其他一切（数据混合、调度器、学习率）解释剩余的约 15%。

这是一个粗略的分解，但它是文献中"我应该先消融什么"的最干净答案。

### 2026 年选择器

根据证据，2026 年新项目的默认开源 VLM 配方：

- 编码器：SigLIP 2 SO400m/14，原生分辨率带 NaFlex，如果需要分割/定位则与 DINOv2 ViT-g/14 拼接用于密集特征。
- 连接器：patch token 上的 2 层 MLP。除非受 token 限制，否则跳过 Q-Former。
- LLM：Qwen2.5 / Llama-3.1 / Gemma 2，7B 用于成本，70B 用于质量，按目标延迟选择。
- 数据：PixMo + ShareGPT4V + Cauldron，加上任务特定的指令数据。
- 分辨率：动态（最小 256，最大 1280 像素每长边）。
- 调度：第一阶段对齐（仅投影器），第二阶段全量微调，第三阶段任务特定微调。

这些默认值中的每一个都可以追溯到本课末尾引用论文中的测量消融。

## 使用它

`code/main.py` 是一个消融表格解析器和配方选择器。它编码了 MM1 和 Idefics2 消融表格（浓缩版），并允许你查询：

- "给定预算 X 和任务 Y，哪个配方获胜？"
- "如果我在 7B Llama 上将 SigLIP 换成 CLIP，预期的 MMMU 差异是多少？"
- "对于 80% 置信度的答案，我应该先消融哪个轴？"

输出是一个带预期基准差异的排名配方列表，以及一个"先消融"建议。

## 交付它

本课产出 `outputs/skill-vlm-recipe-picker.md`。给定目标任务组合、计算预算和延迟目标，它发出完整配方（编码器、连接器、LLM、数据混合、分辨率调度），并引用证明每个选择的消融。阻止工程师在每次新 VLM 项目开始时重新发明 Idefics2 消融表格。

## 练习

1. 阅读 MM1 第 3.2 节。对于固定 2B LLM，预算 5000 万张图像，哪个编码器获胜？在 13B LLM 下答案会翻转吗？为什么？

2. Cambrian-1 发现，在视觉中心基准上，拼接 DINOv2 + SigLIP 优于单独使用任何一个，但在 MMMU 上没有增加信号。预测哪些基准会提升，哪些保持平稳。

3. 你的目标是在 2B LLM 上的移动 UI 代理。选择编码器、连接器、分辨率和数据混合。用特定的消融表格证明每个选择。

4. Molmo 发布 4B 和 72B 模型。4B 与闭源 7B VLM 竞争；72B 在 11/11 基准上击败 Llama-3.2-90B-Vision。这告诉你关于 LLM 大小平台期假设的什么？

5. 设计一个消融表格，在 7B VLM 上隔离数据混合质量与编码器质量。最少需要多少次训练运行？提出四个轴设置。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 消融 | "转动一个旋钮" | 在恰好一个设计空间轴上不同的多次训练运行，保持其他一切不变 |
| 连接器 | "桥梁" / "投影器" | 将视觉编码器输出映射到 LLM token 空间的可训练模块（MLP、Q-Former、Perceiver） |
| 详细人工描述 | "密集描述" | 多句子人工撰写的描述（通常 80-300 token），比网页 alt 文本更丰富 |
| 蒸馏 | "GPT-4V 描述" | 由更强的专有 VLM 生成的训练数据；方便但容易继承幻觉 |
| AnyRes / 动态分辨率 | "高分辨率路径" | 通过平铺或 M-RoPE 将大于编码器原生分辨率的图像输入的策略 |
| 分辨率递增 | "课程" | 从低分辨率开始并递增的训练调度，加速对齐学习 |
| 视觉中心基准 | "CV-Bench / BLINK" | 强调细粒度视觉感知而非语言密集型推理的评估 |
| PixMo | "Molmo 的数据" | Allen AI 的 712K 密集描述图像数据集；人工语音转录成密集描述 |

## 延伸阅读

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
