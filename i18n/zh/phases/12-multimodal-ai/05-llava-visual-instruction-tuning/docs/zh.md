# LLaVA 与视觉指令微调

> LLaVA(2023 年 4 月)是全球被复制最多的多模态架构。它用 2 层 MLP 取代了 BLIP-2 的 Q-Former,用朴素的 token 拼接取代了 Flamingo 的门控交叉注意力，并在由 GPT-4 基于纯文本描述生成的 158k 视觉指令轮次上训练。2023 至 2026 年间构建过 VLM 的从业者，都构建过某种 LLaVA 变体。LLaVA-1.5 加入了 AnyRes。LLaVA-NeXT 提升了分辨率。LLaVA-OneVision 将单图、多图和视频统一到同一个方案中。本课解读这个方案、实现投影器，并解释为什么“更简单的设计赢了”。

**Type:** Build
**Languages:** Python(stdlib,投影器 + 指令模板构建器)
**Prerequisites:** Phase 12 · 02(CLIP),Phase 11(LLM 工程 — 指令微调)
**Time:** 约 180 分钟

## 学习目标

- 构建一个 2 层 MLP 投影器，将 ViT patch 嵌入(维度 1024)映射到 LLM 的嵌入维度(维度 4096)。
- 走一遍 LLaVA 的两阶段方案:(1) 在 558k 图文对上做投影器对齐，(2) 在 158k 条 GPT-4 生成的指令轮次上做视觉指令微调。
- 构建带图像 token 占位符、系统提示词和 user/assistant 轮次的 LLaVA 格式提示词。
- 解释为什么社区从 Q-Former 转向了 MLP,尽管 Q-Former 在 token 预算上占优。

## 问题

BLIP-2 的 Q-Former(第 12.03 课)将图像压缩为 32 个 token。干净、高效，基准测试表现好。但它有两个问题。

第一，Q-Former 是可训练的，但它的损失函数并不是最终任务。阶段 1 训练 ITC+ITM+ITG。阶段 2 训练 LM 损失。这些 query 学到的是某种中间表示，LLM 还得再去解码它。信息在瓶颈中丢失了。

第二，Q-Former 有 1.88 亿参数，而且在 LLaVA 的 2023 年规模下，你必须与目标 LLM 共同设计它。换 LLM,就重训 Q-Former。换视觉编码器，也重训。每一种组合都是独立的研发项目。

LLaVA 的答案简单得令人尴尬：取 ViT 的 576 个 patch token,将每个 token 通过一个 2 层 MLP(`1024 → 4096 → 4096`),然后把全部 576 个 token 直接塞进 LLM 的输入序列。没有瓶颈。没有奇怪目标的阶段 1 预训练。直接在 LM 损失上训练 MLP。

数据从哪来？LLaVA 的第二个洞察：用 GPT-4(纯文本)生成指令数据。把一张图的 COCO 描述和边界框数据喂给 GPT-4,让它生成对话、详细描述和复杂推理问题。158k 条指令-响应轮次，零成本。无需人工标注。

结果：一个在 8 块 A100 上跑了一天的 VLM,在 MMMU 上超过了 Flamingo,并发布了社区可以扩展的开放权重。到 2023 年底，它已经催生了 50 多个分支。

## 概念

### 架构

LLaVA-1.5 13B 版：
- 视觉编码器：CLIP ViT-L/14 @ 336(阶段 1 冻结，阶段 2 可选解冻)。
- 投影器：带 GELU 激活的 2 层 MLP,`1024 → 4096 → 4096`。
- LLM:Vicuna-13B(后来是 Llama-3.1-8B)。

图像 + 文本提示词的前向传播：

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

图像占据 LLM 上下文的 576 个 token。在 2048 上下文中，还剩 1472 个 token 给文本。在 32k 上下文中，这只是舍入误差。

### 阶段 1:投影器对齐

冻结 ViT。冻结 LLM。只训练 2 层 MLP。数据集：558k 图文对(LAION-CC-SBU)。损失：以投影后的图像 token 为条件，对描述做语言建模。

批大小 128 时，一个 epoch 只需几个小时。投影器学会把 ViT 空间映射到 LLM 空间。没有任何任务特定的监督。

### 阶段 2:视觉指令微调

解冻投影器(保持可训练)。解冻 LLM(通常全解冻，有时用 LoRA)。在 158k 视觉指令轮次上训练。

指令数据是关键。Liu 等人生成它的方法是：
1. 取一张 COCO 图像。
2. 提取文本描述(5 条人工标注的 caption + 边界框列表)。
3. 用三个提示词模板发给 GPT-4:
   - 对话：“围绕这张图生成一段用户与助手之间的来回对话。”
   - 详细描述：“对这张图给出一段丰富、详尽的描述。”
   - 复杂推理：“提一个需要对图像进行推理的问题，然后回答它。”
4. 将 GPT-4 的输出解析为(指令，响应)对。

整个过程都不直接接触图像——只用文本描述。GPT-4 会幻觉出合理的图像内容。有些噪声，但确实有效：158k 轮次足以解锁对话能力。

### 社区为什么复制这套做法

- 没有需要调优的阶段 1 专用损失。全程只用 LM 损失。
- 投影器训练以小时计，而非以天计。
- 只需重训投影器就能换 LLM(LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3)。
- 视觉指令数据管线用 GPT-4,为新领域重新生成成本很低。

### LLaVA-1.5 与 LLaVA-NeXT

LLaVA-1.5(2023 年 10 月)加入了：
- 学术任务数据(VQA、OKVQA、RefCOCO)混入指令微调。
- 更好的系统提示词。
- 2048 → 32k 上下文。

LLaVA-NeXT(2024 年 1 月)加入了：
- AnyRes:将高分辨率图像切分为 2x2 或 1x3 网格的 336x336 裁剪块，外加一张全局低分辨率缩略图。每个裁剪块变为 576 个 token;每张图总共约 2880 个视觉 token。OCR 和图表任务大幅提升。
- 配合 ShareGPT4V(高质量 GPT-4V 描述)更好的指令数据混合。
- 更强的基座 LLM(Mistral-7B、Yi-34B)。

### LLaVA-OneVision

第 12.08 课会深入讲解 OneVision。简短版本：同样的投影器，但用一个课程式训练方案覆盖单图、多图和视频，共享视觉 token 预算。

### 与 Q-Former 的比较

| | Q-Former(BLIP-2) | MLP(LLaVA) |
|---|---|---|
| 每张图的视觉 token 数 | 32 | 576(基础)或 2880(AnyRes) |
| 可训练参数 | 188M + LM | 40M + LM |
| 阶段 1 损失 | ITC+ITM+ITG | 仅 LM |
| 更换 LLM | 需要重训 | 最小重训即可替换 |
| 多图 | 别扭 | 自然(拼接) |
| 视频 | 别扭 | 自然(逐帧拼接) |
| Token 预算 | 小 | 大 |

MLP 在简单性和 token 灵活性上胜出。Q-Former 在 token 预算上胜出。到 2023 年底，token 预算已不再是约束条件(LLM 上下文增长到 32k-128k+),简单性占了上风。

### 提示词格式

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` 是一个占位符 token。在分词之前，它被替换为 576 个视觉 token(使用 AnyRes 时为 2880 个)。分词器看到的序列比它训练时略长，但 LLM 能处理这种新输入，因为阶段 1 已经教会了它。

### 参数经济

LLaVA-1.5-7B 拆解：
- CLIP ViT-L/14 @ 336:3.03 亿(阶段 1 冻结，阶段 2 常常解冻)。
- 投影器(2 个线性层)：约 2200 万可训练参数。
- Llama-7B:70 亿。
- 总计：73 亿参数。阶段 2 可训练：完整的 70 亿 + 2200 万投影器。

阶段 2 训练成本：8xA100 上约 20 小时。这是关键数字——一天、一个节点、可复现。这就是 LLaVA 传播开来的原因。

```figure
mm-llava-projector
```

## 使用它

`code/main.py` 实现了：

1. 纯 Python 的 2 层 MLP 投影器(玩具规模下维度 16 → 32 → 32)。
2. 提示词构建管线：系统提示词 + 被替换为 N 个投影 token 的 `<image>` + user 轮次 + assistant 生成占位符。
3. 一个可视化工具，展示 576 token 的视觉块在 LLM 上下文中的样子(占 2k / 32k / 128k 上下文的百分比)。

## 发布它

本课产出 `outputs/skill-llava-vibes-eval.md`。给定一个 LLaVA 系列的 checkpoint,它运行一套 10 个提示词的 vibe 评估套件(3 个描述、3 个 VQA、2 个推理、2 个拒答)，并输出人类可读的评分卡。这不是基准测试；而是确认投影器与 LLM 连接良好的冒烟测试。

## 练习

1. 计算 `1024 → 4096 → 4096` 处 2 层 MLP 投影器的可训练参数量。在带 GELU 和偏置的情况下，它占 LLaVA-13B 的比例是多少？

2. 为一个“拒答”场景构建 LLaVA 提示词——图像包含一名普通个人的隐私内容。写出预期的 assistant 响应。为什么 LLaVA 应当在零样本下拒绝，以及需要什么训练数据来强化这种拒答？

3. 阅读 LLaVA-NeXT 博客中的 AnyRes 部分。计算 1344x672 图像在 AnyRes 下的视觉 token 数。与 336x336 下基础版的 576 个 token 比较。

4. LLaVA 阶段 1 的投影器用 LM 损失在描述上训练。如果跳过阶段 1 直接进入阶段 2(视觉指令微调)会发生什么？引用 Prismatic VLMs 的消融实验(arXiv:2402.07865)作答。

5. LLaVA-Instruct-150k 用 GPT-4 配合 COCO 描述生成指令。对于一个新领域(医学 X 光、卫星影像)，描述生成领域指令的四步数据管线。每一步可能出什么问题？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 投影器 | “MLP 桥” | 带 GELU 的 2 层 MLP,将 ViT 维度映射到 LLM 维度 |
| 图像 token | "<image> 占位符" | 推理前被替换为 N 个投影视觉 token 的提示词标记 |
| 视觉指令微调 | “LLaVA 阶段 2” | 在 GPT-4 生成的(图像、指令、响应)三元组上训练 |
| 阶段 1 对齐 | “投影器预训练” | 冻结 ViT 和 LLM,用 LM 损失在描述上训练投影器 |
| AnyRes | “多裁剪平铺” | 将高分辨率图像切分为平铺网格，并拼接每个 tile 的视觉 token |
| LLaVA-Instruct | “GPT-4 生成” | 基于 COCO 描述 + GPT-4 合成的 158k 指令-响应对 |
| 视觉编码器冻结 | “骨干锁定” | CLIP 权重在阶段 1 不更新，有时阶段 2 也不更新 |
| ShareGPT4V | “更好的描述” | 由 GPT-4V 生成的 100 万条密集描述，用于更高质量的对齐 |
| VQA | “视觉问答” | 对图像回答自由形式问题的任务 |
| Prismatic VLMs | “设计空间论文” | Karamcheti 2024 的消融研究，系统测试投影器和数据选择 |

## 延伸阅读

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA 论文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — 密集描述数据集。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — 设计空间消融。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — 统一的单图、多图、视频。