# 开放权重 VLM 配方：真正重要的是什么

> 2024-2026 年的开放权重 VLM 文献是一片消融实验表格的森林。Apple 的 MM1 测试了图像编码器、连接器和数据组合的 13 种搭配。Allen AI 的 Molmo 证明了详细的人工描述胜过 GPT-4V 蒸馏。Cambrian-1 进行了 20 多个编码器的对比。Idefics2 将设计空间形式化为五个维度。Prismatic VLMs 在受控基准上比较了 27 种训练配方。从这些噪声中，一小部分结论在各论文间保持一致：图像编码器比连接器架构更重要，数据组合比两者都重要，而详细的人工描述胜过蒸馏得到的合成数据。本课带你读懂这些表格，省去你自己翻阅的功夫。

**Type:** Learn + lab
**Languages:** Python (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 分钟

## 学习目标

- 说出 VLM 的五维设计空间：图像编码器、连接器、LLM、数据组合、分辨率策略。
- 读懂 MM1 / Idefics2 / Cambrian-1 的消融表格，并预测哪个旋钮会影响哪个基准。
- 在给定算力预算和任务组合下，为新 VLM 选择一套配方(编码器、连接器、数据、分辨率)。
- 解释为什么在相同 token 数量下，详细的人工描述胜过 GPT-4V 蒸馏。

## 问题所在

开放权重 VLM 已有数百个。"好"与"最先进"之间的差距大多不在架构，而在于数据、分辨率策略和编码器的选择。知道模型表现不佳时先调哪个旋钮，能帮你省下一次 500 万 GPU 小时的错误。

2023 年那一波(LLaVA-1.5、InstructBLIP、MiniGPT-4)基于描述对预训练 + LLaVA-Instruct-150k。是不错的基线。在 MMMU 上止步于 35% 左右。

2024 年那一波(MM1、Idefics2、Molmo、Cambrian-1、Prismatic VLMs)进行了穷举式消融。结果既出人意料又具实用价值。

## 核心概念

### 五维设计空间

Idefics2(Laurençon 等，2024)命名了这些维度：

1. 图像编码器。CLIP ViT-L/14、SigLIP SO400m/14、DINOv2 ViT-g/14、InternViT-6B。编码器在 patch 大小、分辨率和预训练目标上各不相同。
2. 连接器。MLP(2-4 层)、Q-Former(32 个查询 + 交叉注意力)、Perceiver Resampler(64 个查询)、C-Abstractor(卷积 + 双线性池化)。
3. 语言模型。Llama-3 8B / 70B、Mistral 7B、Phi-3、Gemma-2、Qwen2.5。LLM 大小是占主导的参数成本。
4. 训练数据。描述对(CC3M、LAION)、交错式(OBELICS、MMC4)、指令(LLaVA-Instruct、ShareGPT4V、PixMo、Cauldron)。
5. 分辨率策略。固定 224/336/448、AnyRes、原生动态。训练中递增或保持恒定。

每个生产级 VLM 都要在每个维度上做出选择。MMMU 分数的方差大部分由维度 1、4、5 解释——而不是你选了哪个连接器。

### 维度 1:编码器 > 连接器

MM1 第 3.2 节显示：把 CLIP ViT-L/14 换成 SigLIP SO400m/14 带来 MMMU 3 分以上的提升。把连接器从 MLP 换成 Perceiver Resampler 带来的提升不到 1 分。Idefics2 复现了这一结果：SigLIP > CLIP,在相同 token 数量下 Q-Former ≈ MLP ≈ Perceiver。

Cambrian-1 的"Cambrian Vision Encoders Match-Up"(Tong 等，2024)在一个视觉中心基准(CV-Bench)上运行了 20 多个编码器。排行榜顶端是 DINOv2 和 SigLIP 的混合；CLIP 处于中游；ImageBind 和 ViT-MAE 更低。CLIP ViT-L 到 DINOv2 ViT-g/14 的差距在 CV-Bench 上约为 5-7 分。

2026 年开放 VLM 的默认编码器是 SigLIP 2 SO400m/14,用于语义 + 密集特征，有时与 DINOv2 ViT-g/14 特征拼接(Cambrian 的"Spatial Vision Aggregator"就是这么做的)。

### 维度 2:连接器设计影响甚微

MM1、Idefics2、Prismatic 和 MM-Interleaved 都得出同一结论：在固定视觉 token 数量下，连接器架构几乎无关紧要。在相同 token 预算下，基于均值池化 patch 的 2 层 MLP 与 32 查询 Q-Former 的性能差距在 1 分以内。

真正重要的是 token 数量。更多视觉 token = 更多 LLM 计算 = 在一定范围内性能更好，之后收益递减。每张图 64 个 token 对 OCR 来说太少。576-1024 个 token 是大多数开放 VLM 的最佳区间。2048+ 只对文档和图表有帮助。

Q-Former 对 MLP 是一个成本问题，而非质量问题：Q-Former 无论图像分辨率如何都将 token 上限设为 32-64;MLP 则输出所有 patch token。对于高分辨率输入，Q-Former 节省 LLM 上下文；对于低分辨率，差异只是噪声。

### 维度 3:LLM 大小决定上限

在每一篇 VLM 论文中，把 LLM 从 7B 翻倍到 13B 都可靠地在 MMMU 上增加 2-4 分。到 70B 时，大多数基准趋于饱和。VLM 的多模态推理上限就是 LLM 的文本推理上限——视觉编码器只能为其提供输入，不能替它推理。

这就是 Qwen2.5-VL-72B 和 Claude Opus 4.7 在 MMMU-Pro 和 ScreenSpot-Pro 上碾压对手的原因：语言大脑足够大。一个 7B 的 VLM 无法通过巧妙的连接器设计替代 70B 的 VLM。

### 维度 4:数据——详细的人工描述胜过蒸馏

Molmo + PixMo(Deitke 等，2024)是 2024 年人人都该读的结果。Allen AI 让人类标注员以 1-3 分钟的密集语音转文字方式描述图像，产生了 712K 张密集描述的图像。训练数据中完全没有 GPT-4V 蒸馏。

Molmo-72B 在 11 项基准中的 11 项上击败了 Llama-3.2-90B-Vision。差距不在架构——而在描述质量。详细的人工描述每张图包含的信息是简短网页描述的 5-10 倍，而且在 GPT-4V 蒸馏产生幻觉的地方保持事实准确。

ShareGPT4V(Chen 等，2023)和 Cauldron(Idefics2)遵循了同样的策略，使用人工 + GPT-4V 混合描述。趋势很明显：对于 2026 年的前沿，描述密度 > 描述数量 > 蒸馏便利性。

### 维度 5:分辨率及其策略

Idefics2 的消融：384 -> 448 增加 1-2 分。448 -> 980 配合图像切分(AnyRes)在 OCR 基准上再增加 3-5 分。固定分辨率的训练在中等精度处停滞；分辨率递增(从 224 开始，到 448 或原生分辨率结束)训练更快、终点更高。

Cambrian-1 研究了分辨率与 token 的权衡：在固定算力下，你可以选择低分辨率更多 token,或高分辨率更少 token。高分辨率在 OCR 上胜出；低分辨率多 token 在通用场景理解上胜出。

2026 年的生产配方：Stage 1 以固定 384 训练，Stage 2 使用动态分辨率，OCR 重度任务最高至 1280。

### Prismatic 的受控对比

Prismatic VLMs(Karamcheti 等，2024)是控制了所有维度的论文。相同的 13B LLM、相同的指令数据、相同的评估——每次只变动一个维度。结果：

- 每图视觉 token 数解释了约 60% 的方差。
- 编码器选择解释了约 20%。
- 连接器架构解释了约 5%。
- 其余(数据组合、调度器、学习率)占剩下的约 15%。

这是一个粗略的分解，但它是文献中对“我应该先消融什么”最干净的回答。

### 2026 年的选择器

基于以上证据，2026 年新项目的默认开放 VLM 配方：

- 编码器：SigLIP 2 SO400m/14,使用 NaFlex 的原生分辨率；如需分割/定位，与 DINOv2 ViT-g/14 拼接以获得密集特征。
- 连接器：基于 patch token 的 2 层 MLP。除非受 token 限制，否则跳过 Q-Former。
- LLM:Qwen2.5 / Llama-3.1 / Gemma 2,追求成本选 7B,追求质量选 70B,按目标延迟决定。
- 数据:PixMo + ShareGPT4V + Cauldron,再补充任务特定的指令数据。
- 分辨率：动态(长边最小 256,最大 1280 像素)。
- 训练计划：Stage 1 对齐(仅投影层)，Stage 2 全量微调，Stage 3 任务特定微调。

以上每一个默认设置都能追溯到本课末尾引用的论文中的实测消融。

```figure
l5-vlm-recipe-knobs
```

## 动手使用

`code/main.py` 是一个消融表格解析器和配方选择器。它编码了(精简版)MM1 和 Idefics2 的消融表格，并允许你查询：

- “给定预算 X 和任务 Y,哪个配方最优？”
- “如果在一个 7B Llama 上把 SigLIP 换成 CLIP,预期的 MMMU 变化是多少？”
- “要得到 80% 置信度的答案，我应该先消融哪个维度？”

输出是一个按排名排序的配方列表，包含预期的基准变化和“先消融什么”的建议。

## 交付成果

本课产出 `outputs/skill-vlm-recipe-picker.md`。给定目标任务组合、算力预算和延迟目标，它会输出一套完整配方(编码器、连接器、LLM、数据组合、分辨率策略)，并为每个选择附上支持它的消融实验引用。避免工程师们在每次启动新 VLM 项目时都重新发明一遍 Idefics2 消融表格。

## 练习

1. 阅读 MM1 第 3.2 节。对于一个预算为 5000 万张图像的固定 2B LLM,哪个编码器胜出？换成 13B LLM 时答案会反转吗？为什么？

2. Cambrian-1 发现拼接 DINOv2 + SigLIP 在视觉中心基准上优于单独任一编码器，但在 MMMU 上没有带来增益。预测哪些基准会提升，哪些保持不变。

3. 你的目标是一个基于 2B LLM 的移动端 UI 智能体。选择编码器、连接器、分辨率和数据组合，并用具体的消融表格论证每个选择。

4. Molmo 发布了 4B 和 72B 两个模型。4B 与闭源 7B VLM 相当；72B 在 11/11 项基准上击败 Llama-3.2-90B-Vision。这对你判断“LLM 大小平台期”假说有什么启示？

5. 设计一个消融表格，在 7B VLM 上将数据组合质量与编码器质量分离。最少需要多少次训练？提出四个维度的设置。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 消融 | “转动一个旋钮” | 训练多个仅在恰好一个设计空间维度上不同、其余一切保持恒定的运行 |
| 连接器 | “桥” / “投影层” | 将视觉编码器输出映射到 LLM token 空间的可训练模块(MLP、Q-Former、Perceiver) |
| 详细人工描述 | “密集描述” | 多句人工撰写的描述(通常 80-300 个 token),比网页替代文本更丰富 |
| 蒸馏 | “GPT-4V 描述” | 由更强的专有 VLM 生成的训练数据；方便但容易继承幻觉 |
| AnyRes / 动态分辨率 | “高分辨率路径” | 通过切分或 M-RoPE 输入大于编码器原生分辨率的图像的策略 |
| 分辨率递增 | “课程学习” | 从低分辨率开始并逐步提高的训练计划，加速对齐学习 |
| 视觉中心基准 | “CV-Bench / BLINK” | 考察细粒度视觉感知而非语言推理为主的评估 |
| PixMo | “Molmo 的数据” | Allen AI 的 712K 张密集描述图像数据集；人工语音转录为密集描述 |

## 延伸阅读

- [McKinzie 等 — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon 等 — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke 等 — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong 等 — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti 等 — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)