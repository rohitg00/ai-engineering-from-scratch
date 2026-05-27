# LLaVA 与视觉指令微调

> LLaVA（2023年4月）是地球上被复制最多的多模态架构。它用2层MLP替换了BLIP-2的Q-Former，用朴素的token拼接替换了Flamingo的门控交叉注意力（gated cross-attention），并在由GPT-4从纯文本标题生成的158k个视觉指令轮次上进行了训练。任何在2023年至2026年间构建VLM的实践者，都构建了LLaVA的某种变体。LLaVA-1.5增加了AnyRes。LLaVA-NeXT提升了分辨率。LLaVA-OneVision将单图像、多图像和视频统一在同一个方案中。本课程解读这个方案，实现投影器（projector），并解释为什么“简单胜过复杂”。

**类型：** 构建  
**语言：** Python（标准库，投影器 + 指令模板构建器）  
**先决条件：** 阶段12 · 02（CLIP），阶段11（LLM工程——指令微调）  
**时间：** ~180分钟

## 学习目标

- 构建一个2层MLP投影器，将ViT补丁嵌入（维度1024）映射到LLM的嵌入维度（维度4096）。
- 走通LLaVA两阶段方案：(1) 在558k个标题对上对齐投影器，(2) 在158k个GPT-4生成的轮次上进行视觉指令微调。
- 构建LLaVA格式的提示，包含图像token占位符、系统提示和用户/助手轮次。
- 解释为什么社区从Q-Former转向MLP，尽管Q-Former在token预算上占优。

## 问题

BLIP-2的Q-Former（第12.03课）将图像压缩为32个token。干净、高效，在基准测试上表现良好。但它有两个问题。

首先，Q-Former是可训练的，但其损失不是最终任务。阶段1训练ITC+ITM+ITG。阶段2训练LM损失。查询（queries）学习一些中间表示，然后LLM必须对其进行解码。信息在瓶颈中丢失。

其次，Q-Former有1.88亿参数，以LLaVA 2023年的规模，你必须将其与目标LLM共同设计。更换LLM，重新训练Q-Former。更换视觉编码器，重新训练。每一种组合都是独立的研发项目。

LLaVA的答案简单得令人尴尬：取ViT的576个补丁token，让每个token通过一个2层MLP（`1024 → 4096 → 4096`），然后将全部576个token倾倒进LLM的输入序列。没有瓶颈。没有基于奇怪目标的阶段1预训练。只是用直接的LM损失训练MLP。

数据从何而来？LLaVA的第二个洞见：使用GPT-4（仅文本）生成指令数据。将图像的COCO标题和边界框数据喂给GPT-4，让它生成对话、描述和复杂推理问题。免费获得158k个指令-响应对。无需人工标注。

结果：一个仅用8块A100训练一天的VLM，在MMMU上击败了Flamingo，并发布了一个社区可以扩展的开源检查点。到2023年底，它已经催生了50多个分支。

## 概念

### 架构

LLaVA-1.5 at 13B：
- 视觉编码器：CLIP ViT-L/14 @ 336（阶段1冻结，阶段2可选解冻）。
- 投影器：2层MLP，GELU激活，`1024 → 4096 → 4096`。
- LLM：Vicuna-13B（后来是Llama-3.1-8B）。

图像 + 文本提示的前向传播：

```
img -> ViT -> 576个维度1024的补丁
patches -> MLP -> 576个维度4096的token
prompt: system + "<image>" 占位符 + 用户问题
将 <image> token替换为576个投影后的token
将完整序列送入LLM
解码响应
```

图像占用LLM上下文的576个token。在2048上下文中，剩下1472个token给文本。在32k上下文中，这只是一个舍入误差。

### 阶段1：投影器对齐

冻结ViT。冻结LLM。仅训练2层MLP。数据集：558k个图像-标题对（LAION-CC-SBU）。损失：以投影后的图像token为条件，对标题进行语言建模。

在batch size 128下训练一个epoch，几小时即可完成。投影器学习将ViT空间映射到LLM空间。没有任务特定的监督。

### 阶段2：视觉指令微调

解冻投影器（仍可训练）。解冻LLM（通常完全解冻，有时使用LoRA）。在158k个视觉指令轮次上训练。

指令数据是诀窍所在。Liu等人通过以下方式生成：
1. 取一张COCO图像。
2. 提取文本描述（5个人工标题 + 边界框列表）。
3. 使用三个提示模板发送给GPT-4：
   - 对话："生成关于这张图像的用户和助手之间的来回对话。"
   - 详细描述："给出一个丰富、详细的图像描述。"
   - 复杂推理："提出一个需要对图像进行推理的问题，然后回答它。"
4. 将GPT-4的输出解析为（指令，响应）对。

这一切都不直接涉及图像——只使用文本描述。GPT-4会幻觉出看似合理的图像内容。有些噪声，但奏效了：158k个轮次足以解锁对话能力。

### 社区为何复制此方法

- 无需调节阶段1特定的损失。全程使用LM损失。
- 投影器几小时训练完成，而非数天。
- LLM可以更换（LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3），只需重新训练投影器。
- 视觉指令数据管道使用GPT-4，为新的领域重新生成成本低廉。

### LLaVA-1.5 和 LLaVA-NeXT

LLaVA-1.5（2023年10月）新增：
- 学术任务数据（VQA、OKVQA、RefCOCO）混合到指令微调中。
- 更好的系统提示。
- 上下文从2048扩展到32k。

LLaVA-NeXT（2024年1月）新增：
- AnyRes：将高分辨率图像分割成2x2或1x3的336x336裁剪网格，加上一个全局低分辨率缩略图。每个裁剪产生576个token；每张图像总共约2880个视觉token。OCR和图表任务性能大幅提升。
- 使用ShareGPT4V（高质量的GPT-4V标题）提供更好的指令数据混合。
- 更强的基座LLM（Mistral-7B、Yi-34B）。

### LLaVA-OneVision

第12.08课深入介绍OneVision。简而言之：相同的投影器，但采用课程学习训练，涵盖单图像、多图像和视频，共享视觉token预算。

### 与Q-Former的比较

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| 每张图像的视觉token数 | 32 | 576（基础）或 2880（AnyRes） |
| 可训练参数 | 188M + LM | 40M + LM |
| 阶段1损失 | ITC+ITM+ITG | 仅LM |
| LLM更换 | 需重新训练 | 以最小重训量交换 |
| 多图像 | 笨拙 | 自然（拼接） |
| 视频 | 笨拙 | 自然（逐帧拼接） |
| token预算 | 小 | 大 |

MLP在简单性和token灵活性上胜出。Q-Former在token预算上胜出。到2023年底，token预算不再是主要约束（LLM上下文增长到32k-128k+），简单性占据主导。

### 提示格式

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` 是一个占位符token。在分词之前，它被替换为576个视觉token（或AnyRes下的2880个）。分词器看到的序列比训练时稍长，但LLM能处理这个新输入，因为阶段1教会了它如何处理。

### 参数经济性

LLaVA-1.5-7B 分解：
- CLIP ViT-L/14 @ 336：3.03亿（阶段1冻结，阶段2通常解冻）。
- 投影器（2x线性层）：约2200万可训练。
- Llama-7B：70亿。
- 总计：73亿参数。阶段2可训练部分：整个70亿 + 2200万投影器。

阶段2训练成本：8块A100上约20小时。这是关键数字——一天，一个节点，可复现。这就是LLaVA传播开的原因。

## 使用它

`code/main.py` 实现了：

1. 2层MLP投影器（玩具规模下维度16 → 32 → 32），纯Python实现。
2. 提示构建管道：系统提示 + `<image>` 替换为N个投影后的token + 用户轮次 + 助手生成占位符。
3. 可视化工具，显示576个token视觉块在LLM上下文中的占比（在2k / 32k / 128k上下文中的百分比）。

## 交付它

本课程生成 `outputs/skill-llava-vibes-eval.md`。给定一个LLaVA系列检查点，它运行一个10提示的感知评估套件（3个描述，3个VQA，2个推理，2个拒绝），并报告一个人工可读的评分卡。这不是一个基准测试；而是一个冒烟测试，用于确认投影器和LLM连接良好。

## 练习

1. 计算2层MLP投影器在 `1024 → 4096 → 4096` 下的可训练参数数量。包含GELU和偏置，它占LLaVA-13B参数总数的多少比例？

2. 为“拒绝”场景构建一个LLaVA提示——图像包含一个私人个体。写出期望的助手响应。为什么LLaVA应该在零样本下拒绝这种请求？需要什么样的训练数据来强化这种拒绝？

3. 阅读LLaVA-NeXT博客的AnyRes部分。计算一张1344x672图像在AnyRes下的视觉token数量。与基础336x336下的576个token进行比较。

4. LLaVA阶段1的投影器使用基于标题的LM损失进行训练。如果跳过阶段1直接进入阶段2（视觉指令微调）会发生什么？引用Prismatic VLMs消融实验（arXiv:2402.07865）来回答。

5. LLaVA-Instruct-150k使用GPT-4和COCO标题生成指令。对于一个新领域（医疗X光片、卫星图像），描述生成领域指令的四步数据管道。每一步可能出现什么问题？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 投影器 (Projector) | "MLP桥" | 2层MLP，带GELU，将ViT维度映射到LLM维度 |
| 图像token (Image token) | "<image>占位符" | 提示中的标记，在推理前被N个投影后的视觉token替换 |
| 视觉指令微调 (Visual instruction tuning) | "LLaVA阶段2" | 在GPT-4生成的（图像，指令，响应）三元组上训练 |
| 阶段1对齐 (Stage 1 alignment) | "投影器预训练" | 冻结ViT和LLM，用基于标题的LM损失训练投影器 |
| AnyRes | "多裁剪平铺" | 将高分辨率图像分割成拼图网格，并拼接每个拼图的视觉token |
| LLaVA-Instruct | "GPT-4生成的" | 从COCO标题和GPT-4合成的158k个指令-响应对 |
| 视觉编码器冻结 (Vision encoder freeze) | "骨干锁定" | CLIP权重在阶段1不更新，阶段2有时也不更新 |
| ShareGPT4V | "更好的标题" | 由GPT-4V生成的100万密集标题，用于更高质量的对齐 |
| VQA | "视觉问答" | 回答关于图像的自由形式问题的任务 |
| Prismatic VLMs | "设计空间论文" | Karamcheti 2024的消融实验，系统测试投影器和数据选择 |

## 延伸阅读

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA论文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — 密集标题数据集。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — 设计空间消融实验。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — 统一的单图像、多图像、视频。