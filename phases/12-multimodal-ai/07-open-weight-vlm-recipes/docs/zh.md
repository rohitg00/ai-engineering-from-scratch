# 开源权重 VLM 配方：什么才是真正重要的

> 2024-2026年的开源权重VLM文献中充满了消融实验表格。Apple的MM1测试了13种图像编码器、连接器和数据混合的组合。Allen AI的Molmo证明了详细的人工标注描述优于GPT-4V蒸馏。Cambrian-1进行了20+种编码器比较。Idefics2将五轴设计空间形式化。Prismatic VLMs在受控基准上比较了27种训练配方。在所有这些噪声中，一小部分结果在论文之间保持一致：图像编码器比连接器架构更重要，数据混合比二者都重要，而详细的人工标注描述优于蒸馏合成数据。本课让你不必亲自阅读那些表格，而是直接理解其中的结论。

**类型：** 学习 + 实验  
**语言：** Python（标准库，消融表格解析器 + 配方选择器）  
**前置要求：** Phase 12 · 05（LLaVA基线）  
**时间：** ~180分钟

## 学习目标

- 列举VLM五轴设计空间：图像编码器、连接器、语言模型、数据混合、分辨率策略。
- 阅读MM1 / Idefics2 / Cambrian-1消融表格，并能预测哪个旋钮会影响给定基准。
- 针对给定计算预算和任务组合，为新VLM选择配方（编码器、连接器、数据、分辨率）。
- 解释为什么在相同token数量下，详细人工标注描述优于GPT-4V蒸馏。

## 问题

存在数百个开源权重VLM。大多数“好”与“最先进”之间的差距并不在于架构。而在于数据、分辨率策略和编码器选择。当你的模型表现不佳时，知道先转动哪个旋钮可以避免500万GPU小时的错误。

2023年浪潮（LLaVA-1.5, InstructBLIP, MiniGPT-4）基于标注对预训练 + LLaVA-Instruct-150k运行。不错的基线。最高达到MMMU约35%。

2024年浪潮（MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs）进行了详尽的消融实验。结果令人惊讶且实用。

## 概念

### 五轴设计空间

Idefics2（Laurençon等，2024）命名了各轴：

1. **图像编码器**。CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B。编码器在patch大小、分辨率和预训练目标上有所不同。
2. **连接器**。MLP（2-4层）、Q-Former（32个查询 + 交叉注意力）、Perceiver Resampler（64个查询）、C-Abstractor（卷积 + 双线性池化）。
3. **语言模型**。Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5。LLM大小是主要的参数成本。
4. **训练数据**。标注对（CC3M, LAION）、交错数据（OBELICS, MMC4）、指令数据（LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron）。
5. **分辨率策略**。固定224/336/448、AnyRes、原生动态。训练中逐步提升或保持不变。

每个生产级VLM在每个轴上做出选择。MMMU分数的大部分差异由轴1、4和5解释——而不是你选择了哪个连接器。

### 轴1：编码器 > 连接器

MM1第3.2节表明：从CLIP ViT-L/14切换到SigLIP SO400m/14，MMMU增加了3+个点。将连接器从MLP切换到Perceiver Resampler增加不到1个点。Idefics2复现了：SigLIP > CLIP, Q-Former ≈ MLP ≈ Perceiver（相同token数量）。

Cambrian-1的“Cambrian Vision Encoders Match-Up”（Tong等，2024）在视觉中心基准（CV-Bench）上运行了20+种编码器。排行榜顶部是DINOv2和SigLIP的混合；CLIP处于中游；ImageBind和ViT-MAE较低。从CLIP ViT-L到DINOv2 ViT-g/14，CV-Bench上的差距约为5-7个点。

2026年开源VLM的默认编码器是SigLIP 2 SO400m/14（用于语义+密集特征），有时与DINOv2 ViT-g/14特征拼接（Cambrian的“空间视觉聚合器”实现了这一点）。

### 轴2：连接器设计几乎无差异

MM1, Idefics2, Prismatic和MM-Interleaved都得出了相同结论：在固定视觉token数量下，连接器架构几乎无关紧要。在相同token预算下，对均值池化的patch使用2层MLP，性能与32-查询Q-Former相差1个点以内。

真正重要的是token数量。更多的视觉token = 更多的LLM计算 = 更好的性能，但达到某个点后回报递减。每张图像64个token对于OCR来说太少。576-1024个token是大多数开源VLM的甜蜜点。2048+只对文档和图表有帮助。

Q-Former与MLP是成本问题，而非质量问题：Q-Former将token限制在32-64，无论图像分辨率如何；MLP输出所有patch token。对于高分辨率输入，Q-Former节省了LLM上下文；对于低分辨率，差异是噪声。

### 轴3：LLM大小设置天花板

将LLM从7B翻倍到13B，在每个VLM论文中，MMMU可靠地增加2-4个点。在70B时，大多数基准饱和。VLM的多模态推理天花板是LLM的文本推理天花板——视觉编码器只能提供输入，而不能替代推理。

这就是为什么Qwen2.5-VL-72B和Claude Opus 4.7碾压MMMU-Pro和ScreenSpot-Pro：语言大脑巨大。一个7B VLM无法通过巧妙的连接器设计替代70B VLM。

### 轴4：数据——详细人工标注描述优于蒸馏

Molmo + PixMo（Deitke等，2024）是2024年每个人都该读的结果。Allen AI让人类标注员通过1-3分钟的密集语音转文字描述图像，生成了712K张密集标注图像。训练数据中没有任何GPT-4V蒸馏。

Molmo-72B在11/11项基准上击败了Llama-3.2-90B-Vision。差异不在架构——而是标注质量。详细人工标注描述每张图像包含的信息量是简短网络标注的5-10倍，并且保持事实准确性，而GPT-4V蒸馏会幻觉。

ShareGPT4V（Chen等，2023）和Cauldron（Idefics2）遵循了相同策略，混合了人工和GPT-4V标注。趋势很明确：对于2026年前沿，标注密度 > 标注数量 > 蒸馏便利性。

### 轴5：分辨率及其策略

Idefics2的消融实验：384 -> 448增加1-2个点。使用图像分割（AnyRes）从448 -> 980，在OCR基准上再增加3-5个点。固定分辨率训练在中精度处饱和；分辨率逐步提升（从224开始，最终448或原生）训练更快，最终结果更高。

Cambrian-1进行了分辨率与token的权衡：在固定计算量下，你可以以较低分辨率获得更多token，或者以较高分辨率获得较少token。更高分辨率对OCR有利；较低分辨率更多token对一般场景理解有利。

2026年生产配方：阶段1使用固定384训练，阶段2对OCR密集型任务使用动态分辨率高达1280。

### Prismatic受控比较

Prismatic VLMs（Karamcheti等，2024）是控制了所有轴的论文。相同的13B LLM，相同的指令数据，相同的评估——每次只变化一个轴。结果：

- 每张图像的视觉token数量解释了约60%的方差。
- 编码器选择解释了约20%。
- 连接器架构解释了约5%。
- 其他所有（数据混合、调度器、学习率）解释了剩余的约15%。

这是一个粗略的分解，但它是文献中关于“我应该先消融什么”的最清晰答案。

### 2026年的选择器

基于证据，2026年新项目的默认开源VLM配方：

- **编码器**：原生分辨率下的SigLIP 2 SO400m/14，使用NaFlex，如果你需要分割/定位，则与DINOv2 ViT-g/14拼接以获取密集特征。
- **连接器**：在patch token上的2层MLP。除非受token约束，否则跳过Q-Former。
- **语言模型**：Qwen2.5 / Llama-3.1 / Gemma 2，成本优先用7B，质量优先用70B，根据目标延迟选择。
- **数据**：PixMo + ShareGPT4V + Cauldron，再加上任务特定的指令数据。
- **分辨率**：动态（长边最小256，最大1280像素）。
- **策略**：阶段1对齐（仅投影器），阶段2全微调，阶段3任务特定微调。

每个默认选项都可以追溯到本课末尾引用的论文中测量的消融实验。

## 使用它

`code/main.py`是一个消融表格解析器和配方选择器。它编码了MM1和Idefics2消融表格（压缩版），并允许你查询：

- “给定预算X和任务Y，哪种配方获胜？”
- “如果我在7B Llama上将SigLIP换成CLIP，期望的MMMU差异是多少？”
- “为了80%置信度的答案，我应该先消融哪个轴？”

输出是一个排序的配方列表，包含期望的基准差异和“先消融”建议。

## 交付

本课生成`outputs/skill-vlm-recipe-picker.md`。给定目标任务组合、计算预算和延迟目标，它会输出完整的配方（编码器、连接器、LLM、数据混合、分辨率策略），并附有支持每个选择的消融引用。阻止工程师每次启动新VLM项目时都重新发明Idefics2消融表格。

## 练习

1. 阅读MM1第3.2节。对于固定2B LLM，预算50M图像，哪种编码器获胜？在13B LLM下答案会反转吗？为什么？

2. Cambrian-1发现，在视觉中心基准上，拼接DINOv2 + SigLIP优于单独使用任何一个，但在MMMU上不增加信号。预测哪些基准会提升，哪些保持不变。

3. 你的目标是基于2B LLM的移动UI代理。选择编码器、连接器、分辨率和数据混合。用特定的消融表格证明每个选择。

4. Molmo推出了4B和72B模型。4B与封闭的7B VLM竞争；72B在11/11基准上击败Llama-3.2-90B-Vision。这告诉你关于LLM大小平台假设什么？

5. 设计一个消融表格，在7B VLM上分离数据混合质量与编码器质量。最少需要多少次训练运行？提出四个轴的设置。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| Ablation (消融) | “转动一个旋钮” | 训练多个运行，它们仅在设计空间中的一个轴上不同，其他一切保持不变 |
| Connector (连接器) | “桥接器”/“投影器” | 可训练模块，将视觉编码器输出映射到LLM的token空间（MLP, Q-Former, Perceiver） |
| Detailed human caption (详细人工标注描述) | “密集标注” | 多句人工编写的描述（通常80-300 token），比网络替代文本更丰富 |
| Distillation (蒸馏) | “GPT-4V标注” | 由更强的专有VLM生成的训练数据；方便但容易继承幻觉 |
| AnyRes / dynamic res (AnyRes/动态分辨率) | “高分辨率路径” | 通过分块或M-RoPE输入大于编码器原生分辨率图像策略 |
| Resolution ramp (分辨率逐步提升) | “课程学习” | 从低分辨率开始并增加的训练策略，加速对齐学习 |
| Vision-centric bench (视觉中心基准) | “CV-Bench / BLINK” | 强调细粒度视觉感知而非语言密集推理的评估 |
| PixMo | “Molmo的数据” | Allen AI的712K张密集标注图像数据集；人类语音转录为密集标注 |

## 延伸阅读

- [McKinzie等 — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon等 — Idefics2 / 构建VLM的关键 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke等 — Molmo和PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong等 — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti等 — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)