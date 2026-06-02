# InternVL3：原生多模态预训练

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> InternVL3 之前的所有开源 VLM 都遵循同一个三步配方：拿一个在数万亿 text token 上训练好的 text LLM，外挂一个 vision encoder，再把接缝处微调一下。这能跑，但有「对齐债务」——text LLM 已经把全部预训练预算花在了纯文本上，并不天然理解视觉 token。当你事后把视觉加进来，LLM 必须重新学习如何把视觉输入和它的文本推理关联起来，同时还不能遗忘文本。InternVL3（Zhu 等，2025 年 4 月）拒绝了这种事后路线：一次预训练跑完，文本与多模态从第一步起就交错在一起。最终结果是 78B 参数开源模型在 MMMU-Pro 上追平 Gemini 2.5 Pro。本课讨论原生预训练的论据，以及一旦走这条路会改变什么。

**Type:** Learn
**Languages:** Python (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 解释为什么事后式 VLM 训练会累积对齐债务，并指出三个可度量的症状（catastrophic forgetting、答案漂移、视觉-文本不一致）。
- 描述 InternVL3 的原生预训练语料组合，以及 text : interleaved : caption 比例为何重要。
- 比较 V2PE（variable visual position encoding）和 Qwen2-VL 的 M-RoPE。
- 说出 Visual Resolution Router（ViR）和 Decoupled Vision-Language（DvD）这两项部署优化。

## 问题（The Problem）

事后式 VLM 训练是默认做法。LLaVA、BLIP-2、Qwen-VL、Idefics——全都是拿一个已经预训练好的 LLM（Llama、Vicuna、Qwen、Mistral）再加上视觉。训练阶段通常长这样：

1. 冻结 LLM + 冻结 vision encoder + 可训练的 projector，在 caption 配对数据上训练以对齐 embedding。
2. 解冻 LLM，在指令数据（LLaVA-Instruct、ShareGPT4V）上训练。
3. 可选的任务专属微调。

对齐债务有三个症状会显现：

- Catastrophic forgetting（灾难性遗忘）。事后式 VLM 会忘掉纯文本技能。GSM8K 分数掉 5–10 分，Hellaswag 分数下滑，纯文本 agent 出现退化。
- 答案漂移。同一个视觉问题换个说法，答案就变了。vision encoder 接到 LLM 上的绑定比 LLM 自己的 token 弱。
- 视觉-文本不一致。VLM 可以正确描述一张图，紧接着却给出与自己描述相矛盾的回答。视觉 token 没有像文本那样参与 LLM 内部的一致性校验。

这些症状有据可查。MM1.5 第 4 节做了量化，LLaVA-OneVision 的消融实验（ablation）也有暗示。原生预训练就是答案。

## 概念（The Concept）

### 原生多模态预训练（Native multimodal pretraining）

InternVL3 从零开始在一个从第一步起就是原生多模态的语料上训练。组合是：

- 40% 纯文本数据（FineWeb、Proof-Pile-2 等）
- 35% 交错图文数据（OBELICS、MMC4 风格）
- 20% 图-caption 配对数据
- 5% 视频-文本数据

视觉 token、文本 token、跨模态交互从第一个梯度步起就一同参与同一个 loss。没有对齐预训练阶段，没有冻结 projector 阶段，也没有需要事后补救的 catastrophic forgetting。

基础模型的训练是单阶段的。指令微调随后进行，但基础模型已经把视觉 token 当成一等公民来理解。

### V2PE（variable visual position encoding）

Qwen2-VL 用的是固定轴分配的 M-RoPE。InternVL3 引入 V2PE：位置编码按模态类型（文本、图像、视频）变化，并带可学习的缩放。具体是：

- 文本 token 拿 1D 位置（文本索引）。
- 图像 patch 拿 2D 位置（行、列）。
- 视频帧拿 3D 位置（时间、行、列）。

三者共享同一个 RoPE 频率基数，但每段在 hidden-dim 上的分配是一个学习出来的参数，而非固定切分。这样在预训练期间就有自由度去权衡时间频率和空间频率的分辨率。

V2PE 的消融实验声称：在相同算力下，比 M-RoPE 在视频基准上高 1–2 分。算不上革命，但更干净。

### Visual Resolution Router（ViR）

部署侧的优化。并不是所有图像都需要全分辨率编码。一张细节很少、只有一个物体的照片，按 1280px 原生分辨率编码就是在浪费 token。ViR 是一个小分类器，在编码之前预测回答这个问题所需的最小分辨率。

路由分三档：低分辨率（256 token）、中（576）、高（2048+）。在生产流量中，60% 的 query 用低或中分辨率就够了。净效果：相同质量下吞吐提高 2–3 倍。

### 解耦的视觉-语言部署（Decoupled Vision-Language deployment, DvD）

当你部署一个大 VLM 时，vision encoder 每张图只跑一次，但 LLM 要为每个输出 token 自回归地（autoregressive）跑一遍。两个组件的瓶颈不同（视觉 = 卷积 + attention 的 GPU 显存带宽；LLM = KV cache）。DvD 把它们拆到不同 GPU，中间用流式传输。

对于 8B + 400M 编码器的模型，DvD 比同机部署大致能让单节点吞吐翻倍。

### 单阶段 vs 多阶段的质量

InternVL3 的主要基准声明：78B 参数下，追平 Gemini 2.5 Pro 的 MMMU-Pro；38B 下追平 GPT-4o；8B 下领跑开源 8B 榜单。全都是在单阶段预训练 + 指令微调的配方下达成的。

对齐债务的假设是可度量的：InternVL3-8B 每换取一个单位的视觉基准提升所损失的文本基准分（MMLU、GSM8K）少于 Qwen2.5-VL-7B。这个模型更像一个通才，因为训练是一整块、不是两段。

### InternVL3.5 与 InternVL-U

InternVL3.5（2025 年 8 月）扩大了配方规模。同样的原生预训练思路，更多数据、更多参数。MMMU 的提升是渐进式的。

InternVL-U（2026）加入了统一生成——通过在同一个骨干上挂 MMDiT head 实现图像输出。「U」代表「Understanding + generation」，对标 Transfusion 风格的统一模型（第 12.13 课）。同一个原生预训练骨干同时支撑理解和生成 head。

### 原生预训练的取舍

原生预训练不是免费的：

- 算力。从零训练一个新 VLM 的成本与训练一个 text LLM 相当——数百万 GPU-hour。事后式适配复用已有 LLM 权重，省下绝大部分成本。
- 数据。规模化的交错图文语料很稀缺。OBELICS 有 1.41 亿篇文档，MMC4 有 5.71 亿篇。纯文本动辄 15T token。多模态预训练数据稀缺是硬约束。
- 基础 LLM 的复用。原生预训练放弃了未来「换一个新 LLM」的余地。事后式让你只重训 adapter 就能把 Llama-3.1 换成 Llama-4。

InternVL3 押的注是：对齐债务比损失复用更糟。基准测试支持了这一说法。生产成本则把未来的实验室挡在了「廉价复制」之外。事后式 VLM 仍会存在，因为对绝大多数项目而言它依然更便宜。

## 用起来（Use It）

`code/main.py` 是一个训练语料混合器与 ViR 路由模拟器。它会：

- 接收一个目标语料组合（%text、%interleaved、%caption、%video），并计算每种模态的预期步数。
- 在一批 query 上模拟 ViR 路由（分布：50% 低细节、30% 中、20% 高细节），并报告平均 token 数。
- 给定 encoder 与 LLM 的 FLOPs，报告 DvD 吞吐估计。
- 并排打印事后式 vs 原生预训练在参数、算力、数据、以及预期的对齐债务症状上的对比。

## 上线部署（Ship It）

本课产出 `outputs/skill-native-vs-posthoc-auditor.md`。给定一份拟定的 VLM 训练计划，它会审计应该走原生路线还是事后式，标记对齐债务风险，并推荐一个语料组合。当你在为一个新的开源 VLM 项目定规模、需要选训练策略时使用它。

## 练习（Exercises）

1. 估算 InternVL3-8B（原生预训练）和 LLaVA-OneVision-7B（事后式）之间的算力差。GPU-hour 的比例大致是多少？是什么造成了这个差距？

2. InternVL3 报告的比例是 40% text / 35% interleaved / 20% caption / 5% video。如果你的目标任务以视频为主，提出一个新的比例，并论证基础模型为何仍然需要大量文本和 caption 数据。

3. 阅读 MM1.5 第 4 节关于遗忘的内容。指出事后式训练在哪个具体基准上表现出最大幅度的回退。这个回退付出了多大代价？

4. ViR 把 60% 的流量路由到低分辨率编码。它会错路由哪种 query（在本应高分辨率时却送到低分辨率）？提出三种路由失败模式。

5. DvD 把视觉和 LLM 拆到不同 GPU。在什么样的流量模式下 DvD 反而会拖累吞吐而不是提升？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么意思 |
|------|-----------------|------------------------|
| 原生多模态预训练（Native multimodal pretraining） | 「从零一起训」 | 文本 + 图像 + 视频 token 从第 1 步起就参与 loss，而非事后外挂 |
| 对齐债务（Alignment debt） | 「事后式的代价」 | 把视觉硬接到一个冻结 LLM 上所带来的、可度量的文本技能与答案一致性回退 |
| V2PE | 「可变视觉位置编码」 | 按模态可学习的位置编码分配；InternVL3 对 M-RoPE 的继任 |
| ViR | 「分辨率路由器」 | 在编码之前为每个 query 选最小所需分辨率的小分类器，节省推理 token |
| DvD | 「解耦部署」 | vision encoder 在一块 GPU、LLM 在另一块，中间流式交接；为大 VLM 翻倍吞吐 |
| InternVL-U | 「统一理解 + 生成」 | 2026 年的后续，给原生预训练骨干加上图像生成 head |
| 交错语料（Interleaved corpus） | 「OBELICS / MMC4」 | 按自然阅读顺序排列文本与图像的文档；原生预训练的原料 |

## 延伸阅读（Further Reading）

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
