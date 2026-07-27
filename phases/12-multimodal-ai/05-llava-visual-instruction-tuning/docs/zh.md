# LLaVA 与视觉指令微调

> LLaVA（2023年4月）是地球上被复制最多的多模态架构。它用两层 MLP 取代了 BLIP-2 的 Q-Former，用朴素的 token 拼接取代了 Flamingo 的门控交叉注意力，并在由 GPT-4 从纯文本描述生成的 158k 条视觉指令数据上训练。任何在 2023 年至 2026 年间构建 VLM 的实践者，都构建了某种 LLaVA 的变体。LLaVA-1.5 增加了 AnyRes。LLaVA-NeXT 提升了分辨率。LLaVA-OneVision 将单图、多图和视频统一在一个方案中。本课将解读这一方案，实现投影器，并解释为什么"更简单的方案赢了"。

**类型：** 构建
**语言：** Python（stdlib，投影器 + 指令模板构建器）
**前置知识：** 阶段12·02（CLIP），阶段11（LLM工程 — 指令微调）
**时间：** ~180 分钟

## 学习目标

- 构建一个两层 MLP 投影器，将 ViT 块嵌入（维度 1024）映射到 LLM 的嵌入维度（维度 4096）。
- 走通 LLaVA 两阶段方案：（1）在 558k 描述对上进行投影器对齐；（2）在 158k 条 GPT-4 生成的指令数据上进行视觉指令微调。
- 构建 LLaVA 格式的提示，包含图像 token 占位符、系统提示以及用户/助手的对话轮次。
- 解释为什么社区从 Q-Former 转向 MLP，尽管 Q-Former 在 token 预算方面有优势。

## 问题

BLIP-2 的 Q-Former（第 12.03 课）将一张图像压缩为 32 个 token。简洁、高效、基准测试表现好。但它有两个问题。

首先，Q-Former 是可训练的，但其损失并非最终任务。阶段 1 训练 ITC+ITM+ITG。阶段 2 训练 LM 损失。查询（queries）学习到某种中间表示，然后 LLM 需要对其进行解码。信息在瓶颈中丢失了。

其次，Q-Former 有 1.88 亿参数，在 LLaVA 2023 年的规模下，你需要将其与目标 LLM 协同设计。更换 LLM，就要重新训练 Q-Former。更换视觉编码器，也要重新训练。每一种组合都是一个独立的研发项目。

LLaVA 的答案简单得令人尴尬：取出 ViT 的 576 个块 token，每个通过一个两层 MLP（`1024 → 4096 → 4096`），然后把全部 576 个 token 灌入 LLM 的输入序列。没有瓶颈。没有基于奇怪目标的阶段 1 预训练。只需用直接的 LM 损失来训练 MLP。

数据从哪来？LLaVA 的第二个洞见：使用 GPT-4（仅文本）生成指令数据。将 COCO 的描述和边界框数据提供给 GPT-4，让它生成对话、描述和复杂的推理问题。免费获得 158k 条指令-回复数据对。无需人工标注。

结果：一个只需在 8 张 A100 上训练一天的 VLM，在 MMMU 上击败了 Flamingo，并发布了供社区扩展的开放检查点。到 2023 年底，它已衍生出 50 多个分支。

## 概念

### 架构

LLaVA-1.5 13B 版：
- 视觉编码器：CLIP ViT-L/14 @ 336（阶段 1 冻结，阶段 2 可选解冻）。
- 投影器：带 GELU 激活的两层 MLP，`1024 → 4096 → 4096`。
- LLM：Vicuna-13B（后来改为 Llama-3.1-8B）。

图像 + 文本提示的前向传播：

```
img → ViT → 576 个 dim 1024 的块
块 → MLP → 576 个 dim 4096 的 token
提示：系统 + "<image>" 占位符 + 用户问题
将 <image> token 替换为 576 个投影后的 token
将完整序列输入 LLM
解码回复
```

图像占用 LLM 上下文的 576 个 token。在 2048 上下文下，文本剩下 1472 个 token。在 32k 上下文下，这点开销可以忽略不计。

### 阶段 1：投影器对齐

冻结 ViT。冻结 LLM。只训练两层 MLP。数据集：558k 图像-描述对（LAION-CC-SBU）。损失：以投影后的图像 token 为条件，对描述进行语言建模。

在 batch 128 下训练一个 epoch，几小时即可完成。投影器学会了将 ViT 空间映射到 LLM 空间。无需特定任务的监督。

### 阶段 2：视觉指令微调

解冻投影器（仍可训练）。解冻 LLM（通常是全量，有时用 LoRA）。在 158k 条视觉指令数据上训练。

指令数据是诀窍所在。Liu 等人通过以下步骤生成：
1. 取一张 COCO 图像。
2. 提取文本描述（5 条人工描述 + 边界框列表）。
3. 将其发送给 GPT-4，使用三种提示模板：
   - 对话："请生成一段关于这张图像的用户与助手之间的来回对话。"
   - 详细描述："请给出图像丰富、详细的描述。"
   - 复杂推理："提出一个需要对图像进行推理的问题，然后回答它。"
4. 将 GPT-4 的输出解析为（指令，回复）数据对。

整个过程不直接接触图像——只使用文本描述。GPT-4 会幻觉出看似合理的图像内容。虽然有些噪声，但它有效：158k 条数据对足以解锁对话能力。

### 为什么社区复制了这一方案

- 无需调优特定于阶段 1 的损失。全程使用 LM 损失。
- 投影器训练只需数小时，而非数天。
- LLM 可以互换（LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3），只需重新训练投影器。
- 视觉指令数据管道使用 GPT-4，为新领域重新生成成本低廉。

### LLaVA-1.5 与 LLaVA-NeXT

LLaVA-1.5（2023 年 10 月）增加了：
- 在指令微调中混合学术任务数据（VQA、OKVQA、RefCOCO）。
- 更好的系统提示。
- 上下文从 2048 扩展到 32k。

LLaVA-NeXT（2024 年 1 月）增加了：
- AnyRes：将高分辨率图像拆分为 2×2 或 1×3 的 336×336 裁剪块网格，外加一张全局低分辨率缩略图。每个裁剪块产生 576 个 token；每张图像总共约 2880 个视觉 token。OCR 和图表任务大幅提升。
- 使用 ShareGPT4V（高质量的 GPT-4V 描述）改进了指令数据混合。
- 更强的基座 LLM（Mistral-7B、Yi-34B）。

### LLaVA-OneVision

第 12.08 课将深入介绍 OneVision。简而言之：投影器相同，但训练使用了课程学习，在共享视觉 token 预算下，在单一模型中覆盖单图、多图和视频。

### 与 Q-Former 的对比

| 项目 | Q-Former（BLIP-2） | MLP（LLaVA） |
|---|---|---|
| 每张图像的视觉 token 数 | 32 | 576（基础）或 2880（AnyRes） |
| 可训练参数 | 1.88 亿 + LM | 4000 万 + LM |
| 阶段 1 损失 | ITC+ITM+ITG | 仅 LM |
| LLM 替换 | 需重新训练 | 可互换，最少重训 |
| 多图支持 | 不便 | 自然（拼接） |
| 视频支持 | 不便 | 自然（逐帧拼接） |
| Token 预算 | 小 | 大 |

MLP 在简洁性和 token 灵活性上胜出。Q-Former 在 token 预算上胜出。到 2023 年底，token 预算不再是硬性约束（LLM 上下文已增长到 32k-128k+），简洁性占据了主导地位。

### 提示格式

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` 是一个占位 token。在 token 化之前，它会被替换为 576 个视觉 token（AnyRes 下为 2880 个）。分词器看到的序列比它训练时略长，但 LLM 能够处理这种新颖的输入，因为阶段 1 教会了它这一点。

### 参数经济性

LLaVA-1.5-7B 的分解：
- CLIP ViT-L/14 @ 336：3.03 亿（阶段 1 冻结，阶段 2 通常解冻）。
- 投影器（2 层线性层）：约 2200 万可训练参数。
- Llama-7B：70 亿。
- 总计：73 亿参数。阶段 2 可训练部分：全量 70 亿 + 2200 万投影器。

阶段 2 的训练成本：在 8×A100 上约 20 小时。这是关键数字——一天，一台节点，可复现。这就是 LLaVA 得以传播的原因。

## 使用它

`code/main.py` 实现了：

1. 两层 MLP 投影器（玩具规模下 dim 16 → 32 → 32），纯 Python 实现。
2. 提示构建管道：系统提示 + `<image>` 被替换为 N 个投影后的 token + 用户轮次 + 助手生成占位符。
3. 一个可视化工具，展示 576 个视觉 token 块在 LLM 上下文中占用的比例（2k / 32k / 128k 上下文消耗的百分比）。

## 交付成果

本课产出 `outputs/skill-llava-vibes-eval.md`。给定一个 LLaVA 系列检查点，它将运行一个 10 条提示的 vibe 评估套件（3 条图像描述、3 条 VQA、2 条推理、2 条拒答），并输出人类可读的评分卡。这不是基准测试，而是一个冒烟测试，用于确认投影器和 LLM 之间的连接是否正常。

## 练习

1. 计算 `1024 → 4096 → 4096` 的两层 MLP 投影器的可训练参数数量。考虑 GELU 和偏置，它占 LLaVA-13B 的多少比例？

2. 为一个"拒答"场景构建 LLaVA 提示——图像中出现了某个个人隐私信息。写出预期的助手回复。为什么 LLaVA 应该零样本拒绝回答这个问题？需要什么样的训练数据来强化这种拒答能力？

3. 阅读 LLaVA-NeXT 博客文章中的 AnyRes 部分。计算一张 1344×672 图像在 AnyRes 下的视觉 token 数量。与 336×336 下的基础 576 个 token 进行比较。

4. LLaVA 阶段 1 的投影器使用 LM 损失在描述数据上训练。如果跳过阶段 1，直接进入阶段 2（视觉指令微调），会发生什么？引用 Prismatic VLMs 的消融实验（arXiv:2402.07865）来回答。

5. LLaVA-Instruct-150k 使用 GPT-4 和 COCO 描述来生成指令。对于一个新领域（医学 X 光片、卫星图像），描述生成领域指令的四步数据管道。每一步可能出现什么问题？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 投影器（Projector） | "MLP 桥梁" | 带 GELU 的两层 MLP，将 ViT 维度映射到 LLM 维度 |
| 图像 token（Image token） | "`<image>` 占位符" | 在推理前被 N 个投影后的视觉 token 替换的提示标记 |
| 视觉指令微调（Visual instruction tuning） | "LLaVA 阶段 2" | 在 GPT-4 生成的（图像，指令，回复）三元组上训练 |
| 阶段 1 对齐（Stage 1 alignment） | "投影器预训练" | 冻结 ViT 和 LLM，用 LM 损失在描述上训练投影器 |
| AnyRes | "多裁剪图块" | 将高分辨率图像拆分为图块网格，拼接每个图块的视觉 token |
| LLaVA-Instruct | "GPT-4 生成" | 从 COCO 描述 + GPT-4 综合生成的 158k 条指令-回复数据对 |
| 视觉编码器冻结（Vision encoder freeze） | "主干锁定" | CLIP 权重在阶段 1 不更新，有时阶段 2 也不更新 |
| ShareGPT4V | "更好的描述" | 由 GPT-4V 生成的 100 万条密集描述，用于更高质量的对齐 |
| VQA | "视觉问答" | 回答关于图像的自由形式问题的任务 |
| Prismatic VLMs | "设计空间论文" | Karamcheti 2024 的消融实验，系统性地测试了投影器和数据选择 |

## 延伸阅读

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA 论文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — 密集描述数据集。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — 设计空间消融实验。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — 统一单图、多图、视频。
