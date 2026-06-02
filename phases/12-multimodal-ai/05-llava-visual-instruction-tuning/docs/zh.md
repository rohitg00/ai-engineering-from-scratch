# LLaVA 与视觉指令微调（LLaVA and Visual Instruction Tuning）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> LLaVA（2023 年 4 月）是地球上被复刻最多的多模态架构。它把 BLIP-2 的 Q-Former 换成了 2 层 MLP，把 Flamingo 的 gated cross-attention 换成了朴素的 token 拼接，并用 GPT-4 从纯文本 caption 生成的 158k 条视觉指令对话进行训练。2023 到 2026 年间任何造过 VLM 的从业者，都构建过某种 LLaVA 变体。LLaVA-1.5 加了 AnyRes，LLaVA-NeXT 拉高了分辨率，LLaVA-OneVision 用一个 recipe（配方）统一了图像、多图和视频。本课通读这份 recipe，实现 projector，并解释为什么「更简单的赢了」。

**Type:** Build
**Languages:** Python (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 构建一个 2 层 MLP projector，把 ViT 的 patch embedding（dim 1024）映射到 LLM 的 embedding 维度（dim 4096）。
- 走一遍 LLaVA 的两阶段 recipe：(1) 在 558k 条 caption 对上做 projector 对齐，(2) 在 158k 条 GPT-4 生成的对话上做视觉指令微调（visual instruction tuning）。
- 构造一个 LLaVA 格式的 prompt：包含 image token 占位符、system prompt、以及 user / assistant 轮次。
- 解释为什么尽管 Q-Former 在 token 预算上占优，社区还是从 Q-Former 转向了 MLP。

## 问题（The Problem）

BLIP-2 的 Q-Former（第 12.03 课）把一张图压缩成 32 个 token。干净、高效、benchmark（基准测试）成绩好。但它有两个问题。

第一，Q-Former 可训，但它的 loss 不是最终任务的 loss。Stage 1 训 ITC+ITM+ITG，Stage 2 训 LM loss。query 学到的是某种中间表征，LLM 还得再去解码。瓶颈处会丢信息。

第二，Q-Former 占 188M 参数，而在 LLaVA 2023 年的规模下，你必须把它和目标 LLM 协同设计。换 LLM 就要重训 Q-Former；换视觉 encoder 也得重训。每种组合都是一个独立的 R&D 项目。

LLaVA 的答案简单到令人尴尬：拿 ViT 的 576 个 patch token，每个过一遍 2 层 MLP（`1024 → 4096 → 4096`），然后把全部 576 个直接塞进 LLM 的输入序列。没有瓶颈，没有 stage 1 在奇怪目标上的预训练，就是直接用 LM loss 训 MLP。

数据从哪来？LLaVA 的第二个洞见：用 GPT-4（纯文本版）生成指令数据。把图像的 COCO caption 和 bounding-box 数据喂给 GPT-4，让它产出对话、描述和复杂推理问题。158k 条指令-响应对话白拿，零人工标注。

结果：一个 VLM，8 张 A100 跑一天，在 MMMU 上打败 Flamingo，并放出社区可扩展的开源 checkpoint。到 2023 年底它已经派生出 50+ 个 fork。

## 概念（The Concept）

### 架构（The architecture）

LLaVA-1.5 在 13B 规模下的配置：
- 视觉 encoder：CLIP ViT-L/14 @ 336（stage 1 frozen，stage 2 可选解冻）。
- Projector：2 层 MLP，使用 GELU 激活函数，`1024 → 4096 → 4096`。
- LLM：Vicuna-13B（后来用 Llama-3.1-8B）。

图像 + 文本 prompt 的前向传播：

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

图像在 LLM context 里占 576 个 token。在 2048 的 context 下，留给文本的还有 1472 个 token；在 32k context 下，这只是一个零头。

### Stage 1：projector 对齐（Stage 1: projector alignment）

冻结 ViT，冻结 LLM，只训 2 层 MLP。数据集：558k 条图像-caption 对（LAION-CC-SBU）。Loss：在 caption 上做语言建模，条件是投影后的图像 token。

batch 128 跑一个 epoch，几小时就完事。Projector 学会把 ViT 空间映射到 LLM 空间，没有任务专属的监督。

### Stage 2：视觉指令微调（Stage 2: visual instruction tuning）

解冻 projector（仍可训），解冻 LLM（通常全量解冻，有时用 LoRA）。在 158k 条视觉指令对话上训练。

指令数据才是关键。Liu 等人的生成流程是：
1. 取一张 COCO 图。
2. 提取它的文本描述（5 条人工 caption + bounding-box 列表）。
3. 用三种 prompt 模板发给 GPT-4：
   - 对话型：「围绕这张图，生成一段用户与 assistant 的来回对话。」
   - 详细描述型：「给出对这张图的丰富、详细的描述。」
   - 复杂推理型：「提一个需要对图像进行推理的问题，并作答。」
4. 把 GPT-4 的输出解析为 (instruction, response) 对。

整个过程不直接接触图像——只用文本描述。GPT-4 会 hallucinate（幻觉）出听起来合理的图像内容。是有点噪声，但它管用：158k 条对话已经足以解锁对话能力。

### 为什么社区跟着抄（Why the community copied this）

- 没有 stage-1 专属 loss 要调，全程 LM loss。
- Projector 训练以小时计，不是天。
- 换 LLM 时（LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3）只要重训 projector。
- 视觉指令数据 pipeline（流水线）用 GPT-4，对新领域重新生成成本很低。

### LLaVA-1.5 与 LLaVA-NeXT（LLaVA-1.5 and LLaVA-NeXT）

LLaVA-1.5（2023 年 10 月）新增：
- 把学术任务数据（VQA、OKVQA、RefCOCO）混入指令微调。
- 更好的 system prompt。
- context 从 2048 扩到 32k。

LLaVA-NeXT（2024 年 1 月）新增：
- AnyRes：把高清图切成 2x2 或 1x3 的 336x336 网格 crop，再加一张全局低分辨率缩略图。每个 crop 变成 576 个 token；每张图大约总共 2880 个视觉 token。OCR 和图表任务表现大幅提升。
- 更好的指令数据混合，加入 ShareGPT4V（高质量 GPT-4V 生成的 caption）。
- 更强的基座 LLM（Mistral-7B、Yi-34B）。

### LLaVA-OneVision（LLaVA-OneVision）

第 12.08 课会深入讲 OneVision。简短版本：projector 一样，但用一种 curriculum（课程式）训练，覆盖单图、多图和视频，共享同一份视觉 token 预算。

### 与 Q-Former 的对比（The comparison to Q-Former）

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| 单图视觉 token 数 | 32 | 576（基础）或 2880（AnyRes） |
| 可训参数 | 188M + LM | 40M + LM |
| Stage 1 loss | ITC+ITM+ITG | 仅 LM |
| LLM 即插即用 | 需重训 | 极少重训即可替换 |
| 多图 | 别扭 | 自然（拼接） |
| 视频 | 别扭 | 自然（逐帧拼接） |
| Token 预算 | 小 | 大 |

MLP 在简洁性和 token 灵活性上赢；Q-Former 在 token 预算上赢。到 2023 年底，token 预算已经不是瓶颈约束（LLM context 长到 32k–128k+），简洁性占了上风。

### Prompt 格式（The prompt format）

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` 是占位符 token。tokenize 之前，它会被替换为 576 个视觉 token（用 AnyRes 则是 2880 个）。tokenizer 看到的是一段比训练时略长的序列，但 LLM 能处理这种新输入——因为 stage 1 教过它。

### 参数账本（Parameter economy）

LLaVA-1.5-7B 拆分：
- CLIP ViT-L/14 @ 336：303M（stage 1 frozen，stage 2 通常解冻）。
- Projector（2 个 linear 层）：约 22M 可训。
- Llama-7B：7B。
- 合计：7.3B 参数。Stage 2 时可训部分：完整 7B + 22M projector。

Stage 2 训练成本：8xA100 上约 20 小时。这就是关键数字——一天、一台机、可复现。这就是 LLaVA 能扩散的原因。

## 用起来（Use It）

`code/main.py` 实现：

1. 用纯 Python 写的 2 层 MLP projector（玩具规模 dim 16 → 32 → 32）。
2. Prompt 构造 pipeline：system prompt + 把 `<image>` 替换为 N 个投影后的 token + user 轮次 + assistant 生成占位符。
3. 一个可视化工具，展示 576 个 token 的视觉块在 LLM context 里长什么样（占 2k / 32k / 128k context 的百分比）。

## 上线部署（Ship It）

本课产出 `outputs/skill-llava-vibes-eval.md`。给定一个 LLaVA 系列的 checkpoint，它跑一套 10 条 prompt 的 vibes-eval（3 条 captioning、3 条 VQA、2 条推理、2 条 refusal），并输出可读的评分卡。这不是 benchmark，是一个 smoke test，用来确认 projector 和 LLM 接得顺。

## 练习（Exercises）

1. 计算 `1024 → 4096 → 4096` 这个 2 层 MLP projector 的可训参数量。在带 GELU 和 bias（偏置）的情况下，它占 LLaVA-13B 的多少比例？

2. 构造一个 LLaVA prompt，用于一个「拒答」场景——图中包含一位私人个体。写出预期的 assistant 回复。为什么 LLaVA 应该 zero-shot 拒答此类请求？为加强这种拒答行为，需要怎样的训练数据？

3. 阅读 LLaVA-NeXT 博客中关于 AnyRes 的章节。计算 1344x672 图像在 AnyRes 下的视觉 token 数，与 336x336 下的基础 576 token 做对比。

4. LLaVA 的 stage-1 projector 是用 caption 上的 LM loss 训练的。如果跳过 stage 1 直接进 stage 2（视觉指令微调）会发生什么？请引用 Prismatic VLMs 消融实验（arXiv:2402.07865）的结论作答。

5. LLaVA-Instruct-150k 用 GPT-4 配合 COCO caption 来生成指令。对于一个新领域（医学 X 光、卫星影像），描述生成领域指令的四步数据 pipeline。每一步可能出什么问题？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| Projector | 「MLP 桥」 | 带 GELU 的 2 层 MLP，把 ViT 维度映射到 LLM 维度 |
| Image token | 「`<image>` 占位符」 | 推理前会被替换为 N 个投影视觉 token 的 prompt 标记 |
| Visual instruction tuning | 「LLaVA stage 2」 | 在 GPT-4 生成的 (image, instruction, response) 三元组上训练 |
| Stage 1 alignment | 「Projector 预训练」 | 冻结 ViT 和 LLM，用 caption 上的 LM loss 训练 projector |
| AnyRes | 「多 crop 平铺」 | 把高清图切成 tile 网格，将每个 tile 的视觉 token 拼接 |
| LLaVA-Instruct | 「GPT-4 生成的」 | 由 COCO caption + GPT-4 合成的 158k 条指令-响应对 |
| Vision encoder freeze | 「Backbone 锁住」 | CLIP 权重在 stage 1 不更新，有时 stage 2 也不更新 |
| ShareGPT4V | 「更好的 caption」 | 由 GPT-4V 生成的 1M 条密集 caption，用于更高质量的对齐 |
| VQA | 「视觉问答」 | 针对一张图回答一个自由格式问题的任务 |
| Prismatic VLMs | 「设计空间论文」 | Karamcheti 2024 系统性地对 projector 和数据选择做消融实验 |

## 延伸阅读（Further Reading）

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA 原始论文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — 密集 caption 数据集。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — 设计空间消融。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — 统一单图、多图、视频。
