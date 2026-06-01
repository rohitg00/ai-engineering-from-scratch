# 05 · LLaVA 与视觉指令微调

> LLaVA（2023 年 4 月）是地球上被复制最多的多模态架构。它用一个 2 层 MLP 替换了 BLIP-2 的 Q-Former，用朴素的 token 拼接替换了 Flamingo 的门控交叉注意力（gated cross-attention），并在由 GPT-4 从纯文本描述生成的 158k 条视觉指令对话轮次上训练。任何在 2023 到 2026 年间构建过 VLM 的从业者，构建的都是某种 LLaVA 变体。LLaVA-1.5 加入了 AnyRes。LLaVA-NeXT 提升了分辨率。LLaVA-OneVision 用一套配方统一了图像、多图与视频。本课将研读这套配方、实现投影器（projector），并解释为什么「更简单的方案胜出」。

**类型：** 构建
**语言：** Python（标准库，投影器 + 指令模板构建器）
**前置：** Phase 12 · 02（CLIP）、Phase 11（LLM 工程 —— 指令微调）
**时长：** 约 180 分钟

## 学习目标

- 构建一个 2 层 MLP 投影器，将 ViT 的图块嵌入（patch embeddings，维度 1024）映射到 LLM 的嵌入维度（维度 4096）。
- 走通 LLaVA 的两阶段配方：（1）在 558k 个描述对上做投影器对齐；（2）在 158k 条 GPT-4 生成的对话轮次上做视觉指令微调（visual instruction tuning）。
- 构建一个 LLaVA 格式的提示词，包含图像 token 占位符、系统提示以及用户/助手轮次。
- 解释为什么尽管 Q-Former 在 token 预算上占优，社区仍从 Q-Former 转向了 MLP。

## 问题所在

BLIP-2 的 Q-Former（第 12.03 课）将一张图像压缩为 32 个 token。简洁、高效、在基准测试上表现好。但它有两个问题。

第一，Q-Former 是可训练的，但它的损失并非最终任务。阶段 1 训练 ITC+ITM+ITG，阶段 2 训练 LM 损失。查询（queries）学到的是某种中间表示，之后还得由 LLM 去解码。信息在瓶颈处丢失了。

第二，Q-Former 有 188M 参数，而在 LLaVA 所处的 2023 年规模下，你必须把它与目标 LLM 协同设计。换了 LLM，就要重训 Q-Former；换了视觉编码器，也要重训。每一种组合都是一个独立的研发项目。

LLaVA 的答案简单到令人尴尬：取 ViT 的 576 个图块 token，让每个都通过一个 2 层 MLP（`1024 → 4096 → 4096`），然后把全部 576 个 token 直接塞进 LLM 的输入序列。没有瓶颈。没有在奇怪目标上做阶段 1 预训练。只是用一个直接的 LM 损失训练这个 MLP。

数据从哪来？这是 LLaVA 的第二个洞见：用 GPT-4（纯文本）来生成指令数据。把一张图像的 COCO 描述和边界框（bounding-box）数据喂给 GPT-4，让它产出对话、描述和复杂推理问题。158k 条指令-回复轮次免费到手，无需人工标注。

结果：一个在 8 张 A100 上跑一天的 VLM，在 MMMU 上击败了 Flamingo，并发布了社区可以扩展的开放检查点（checkpoint）。到 2023 年底，它已经衍生出 50 多个分支（fork）。

## 核心概念

### 架构

13B 规模的 LLaVA-1.5：
- 视觉编码器：CLIP ViT-L/14 @ 336（阶段 1 冻结，阶段 2 可选解冻）。
- 投影器：带 GELU 激活的 2 层 MLP，`1024 → 4096 → 4096`。
- LLM：Vicuna-13B（后续为 Llama-3.1-8B）。

对「图像 + 文本提示」的前向传播：

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

图像占用 LLM 上下文中的 576 个 token。在 2048 上下文下，留给文本的还剩 1472 个 token。在 32k 上下文下，这点占用就只是个零头。

### 阶段 1：投影器对齐

冻结 ViT。冻结 LLM。只训练那个 2 层 MLP。数据集：558k 个图像-描述对（LAION-CC-SBU）。损失：在投影后的图像 token 为条件下，对描述做语言建模。

在 batch 128 下跑单个 epoch，几小时即可完成。投影器学会把 ViT 空间映射到 LLM 空间。没有任务特定的监督。

### 阶段 2：视觉指令微调

解冻投影器（仍可训练）。解冻 LLM（通常是完全解冻，有时用 LoRA）。在 158k 条视觉指令轮次上训练。

指令数据是关键所在。Liu 等人这样生成它：
1. 取一张 COCO 图像。
2. 提取其文本描述（5 条人工标注的描述 + 边界框列表）。
3. 用三种提示模板发送给 GPT-4：
   - 对话（Conversation）：「围绕这张图像，生成一段用户与助手之间的来回对话。」
   - 详细描述（Detailed description）：「给出对这张图像丰富、详尽的描述。」
   - 复杂推理（Complex reasoning）：「提一个需要对图像进行推理的问题，然后回答它。」
4. 把 GPT-4 的输出解析为（指令，回复）对。

这一切都没有直接接触图像 —— 只用了文本描述。GPT-4 会幻觉出看似合理的图像内容。会有一些噪声，但确实奏效：158k 条轮次足以解锁对话能力。

### 为什么社区争相复制它

- 没有阶段 1 专属的损失需要调。全程都是 LM 损失。
- 投影器以小时计训练完成，而非以天计。
- 只需重训投影器，就能替换 LLM（LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3）。
- 视觉指令数据管线使用 GPT-4，为新领域重新生成数据成本低廉。

### LLaVA-1.5 与 LLaVA-NeXT

LLaVA-1.5（2023 年 10 月）新增：
- 把学术任务数据（VQA、OKVQA、RefCOCO）混入指令微调。
- 更好的系统提示。
- 上下文从 2048 提升到 32k。

LLaVA-NeXT（2024 年 1 月）新增：
- AnyRes：把高分辨率图像切分为 2x2 或 1x3 的 336x336 裁剪网格，再加一张全局低分辨率缩略图。每个裁剪块变成 576 个 token；每张图像总计约 2880 个视觉 token。OCR 和图表任务表现大幅提升。
- 更优的指令数据配比，引入 ShareGPT4V（高质量的 GPT-4V 描述）。
- 更强的基础 LLM（Mistral-7B、Yi-34B）。

### LLaVA-OneVision

第 12.08 课会深入讲解 OneVision。简而言之：同样的投影器，但用一套课程式（curriculum）训练，在一个模型中以共享的视觉 token 预算覆盖单图、多图和视频。

### 与 Q-Former 的对比

| | Q-Former（BLIP-2） | MLP（LLaVA） |
|---|---|---|
| 每张图像的视觉 token 数 | 32 | 576（基础）或 2880（AnyRes） |
| 可训练参数 | 188M + LM | 40M + LM |
| 阶段 1 损失 | ITC+ITM+ITG | 仅 LM |
| LLM 即插即用 | 需要重训 | 仅需极少重训即可替换 |
| 多图 | 别扭 | 自然（拼接） |
| 视频 | 别扭 | 自然（逐帧拼接） |
| token 预算 | 小 | 大 |

MLP 在简洁性和 token 灵活性上胜出，Q-Former 在 token 预算上胜出。到 2023 年底，token 预算不再是约束瓶颈（LLM 上下文增长到 32k-128k+），简洁性占了上风。

### 提示词格式

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` 是一个占位符 token。在分词（tokenization）之前，它会被替换为 576 个视觉 token（AnyRes 下为 2880 个）。分词器看到的序列略长于它训练时所见的，但 LLM 能处理这个新颖的输入，因为阶段 1 教会了它。

### 参数经济性

LLaVA-1.5-7B 的参数构成：
- CLIP ViT-L/14 @ 336：303M（阶段 1 冻结，阶段 2 通常解冻）。
- 投影器（2 个线性层）：约 22M 可训练参数。
- Llama-7B：7B。
- 总计：7.3B 参数。阶段 2 可训练的部分：完整的 7B + 22M 投影器。

阶段 2 的训练成本：在 8xA100 上约 20 小时。这是关键数字 —— 一天、一个节点、可复现。这就是 LLaVA 得以扩散的原因。

## 上手实践

`code/main.py` 实现了：

1. 用纯 Python 实现的 2 层 MLP 投影器（玩具规模下为 dim 16 → 32 → 32）。
2. 提示词构建管线：系统提示 + 把 `<image>` 替换为 N 个投影后的 token + 用户轮次 + 助手生成占位符。
3. 一个可视化器，展示 576 个 token 的视觉块在 LLM 上下文中的样子（占用 2k / 32k / 128k 上下文的百分比）。

## 交付成果

本课产出 `outputs/skill-llava-vibes-eval.md`。给定一个 LLaVA 家族的检查点，它会运行一套 10 条提示的 vibes-eval 套件（3 条描述生成、3 条 VQA、2 条推理、2 条拒答），并输出一份人类可读的评分表。这不是基准测试，而是一个冒烟测试（smoke test），用于确认投影器和 LLM 衔接良好。

## 练习

1. 计算 `1024 → 4096 → 4096` 这个 2 层 MLP 投影器的可训练参数量。在带 GELU 和偏置（bias）的情况下，它占 LLaVA-13B 的多大比例？

2. 为一个「拒答」场景构建一个 LLaVA 提示词 —— 图像中包含一位私人个体。写出预期的助手回复。为什么 LLaVA 应当零样本（zero-shot）地拒答此请求？需要什么训练数据来强化这种拒答？

3. 阅读 LLaVA-NeXT 博客中关于 AnyRes 的章节。计算一张 1344x672 图像在 AnyRes 下的视觉 token 数量。与 336x336 下的基础 576 个 token 做对比。

4. LLaVA 的阶段 1 投影器是用描述上的 LM 损失训练的。如果你跳过阶段 1、直接进入阶段 2（视觉指令微调），会发生什么？引用 Prismatic VLMs 的消融实验（arXiv:2402.07865）来回答。

5. LLaVA-Instruct-150k 使用 GPT-4 配合 COCO 描述来生成指令。对于一个新领域（医学 X 光片、卫星影像），描述生成领域指令的四步数据管线。每一步可能出什么问题？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Projector（投影器） | 「MLP 桥接」 | 带 GELU 的 2 层 MLP，把 ViT 维度映射到 LLM 维度 |
| Image token（图像 token） | 「<image> 占位符」 | 提示中的标记，推理前被替换为 N 个投影后的视觉 token |
| Visual instruction tuning（视觉指令微调） | 「LLaVA 阶段 2」 | 在 GPT-4 生成的（图像，指令，回复）三元组上训练 |
| Stage 1 alignment（阶段 1 对齐） | 「投影器预训练」 | 冻结 ViT 和 LLM，用描述上的 LM 损失训练投影器 |
| AnyRes | 「多裁剪平铺」 | 把高分辨率图像切分为裁剪网格，并拼接每个裁剪块的视觉 token |
| LLaVA-Instruct | 「GPT-4 生成」 | 从 COCO 描述 + GPT-4 合成的 158k 条指令-回复对 |
| Vision encoder freeze（视觉编码器冻结） | 「骨干网络锁定」 | CLIP 权重在阶段 1 不更新，有时阶段 2 也不更新 |
| ShareGPT4V | 「更好的描述」 | 由 GPT-4V 生成的 1M 条密集描述，用于更高质量的对齐 |
| VQA | 「视觉问答」 | 对图像回答自由形式问题的任务 |
| Prismatic VLMs | 「设计空间论文」 | Karamcheti 2024 的消融实验，系统性测试投影器与数据选择 |

## 延伸阅读

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) —— LLaVA 论文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) —— LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) —— 密集描述数据集。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) —— 设计空间消融实验。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) —— 统一单图、多图、视频。
