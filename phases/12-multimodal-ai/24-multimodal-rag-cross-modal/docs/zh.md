# 多模态 RAG 与跨模态检索（Multimodal RAG and Cross-Modal Retrieval）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Vision-native（视觉原生）的文档 RAG 只是其中一片切面。生产级多模态 RAG 覆盖更广 —— 跨文本、图像、音频、视频做检索，服务于诸如旅行规划（"帮我找一家安静、有自然光的纯素 brunch"）、医疗分诊（"这张照片加上这些笔记，对应什么伤情"）、电商（"和这张自拍风格相似、还要我的尺码的搭配"）、现场维修（"这段引擎噪音加上这张零件照片，诊断一下故障"）等场景。2025 年的三篇综述 —— Abootorabi 等、Mei 等、Zhao 等 —— 把子问题梳理成了体系：跨模态检索、检索融合、生成 grounding、多模态评估。本课就来读这三篇综述，并设计一条生产 pipeline。

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator)
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 设计跨模态检索：text → image、image → text、audio → video，等等。
- 比较三种融合策略：score fusion、attention-based fusion、MoE fusion。
- 解释什么是生成 grounding：当 source 是多模态混合时，"cite your sources"（标注引用来源）长什么样。
- 说出 2025 年三篇标志性多模态 RAG 综述的名字，以及它们的子问题分类。

## 问题（The Problem）

单模态 RAG 已经是一套成熟范式：embedding 化 query、embedding 化 chunk、检索、塞进 LLM。多模态 RAG 则要求：

1. 多个检索头（每种模态都需要在兼容空间里的 embedding）。
2. 跨模态地融合检索结果。
3. 生成 grounding 要能跨模态地标注 source。
4. 评估指标要覆盖跨模态信号。

2025 年的三篇综述给出的分类，殊途同归。

## 概念（The Concept）

### 跨模态检索（Cross-modal retrieval）

给定模态 A 的 query，检索模态 B 的文档。三种思路：

1. 共享 embedding 空间。CLIP 和 CLAP 把 text + image / text + audio 嵌入到共享空间，跨模态直接做余弦相似度即可。代价是只能用 CLIP 训练过的配对。

2. 各模态各自的 encoder + translator（翻译模块）。text encoder + image encoder，再加一个小的 translator 在两个空间之间映射。Gupta 等人的 Sen2Sen 以及 2024 年的其他设计都属于这一路。灵活但更复杂。

3. 把 VLM 当 encoder 用。把 VLM 的 hidden state 直接当作检索表征。VLM 支持的模态都可以用。质量更高，开销也更大。

选型：text+image 用 CLIP / SigLIP 2；text+audio 用 CLAP；想要 frontier（前沿）质量的跨模态检索就用 VLM hidden states。

### 融合策略（Fusion strategies）

你检索回来 10 条结果：5 张图、3 段文本、2 段音频。怎么合并？

Score fusion（最便宜）。每种模态各有一个 retriever，各自返回分数。在每种模态内归一化，然后求和。简单，常常够用。

Attention-based fusion。把所有检索项拼起来，让一个小 attention 网络给它们加权。需要训练。

MoE fusion。一个 gating 网络把不同 query 路由到对应模态的专家。不同类型的 query 路由方式不同 —— 视觉问题就给图像更高权重。

生产默认值：用 score fusion，并对 query 主导模态稍加偏置。如果 A/B 实验在你的领域里 MoE 明显更优，再升级。

### 生成 grounding（Generation grounding）

LLM 应该标明每条断言来自哪条检索项。多模态场景下：

- 文本来源：标准引用 `[1]`。
- 图像来源：`[img 3]`，附一句简短 caption。
- 音频：`[audio 2 at 0:34]`。

训练 generator 时使用带 grounding 标注的数据：训练目标里每条断言都标记上 source 编号。推理时模型自然就会输出引用。

### 2025 年的三篇综述

Abootorabi 等（arXiv:2502.08826，"Ask in Any Modality"）：多模态 RAG 的分类学。覆盖检索、融合、生成。涵盖面最广。

Mei 等（arXiv:2504.08748，"A Survey of Multimodal RAG"）：聚焦子任务 benchmark 和失败模式，对评估设计很有用。

Zhao 等（arXiv:2503.18016）：聚焦视觉的综述。对 ColPali 系工作讲得最透。

三篇连起来读，就拿到了 2025 年春天这块领域的现状。绝大多数子问题仍是开放的。

### MuRAG —— 奠基论文

MuRAG（Chen 等，2022）是首个多模态 RAG。从一个多模态知识库里检索 image + text，再生成答案。在 VLM 浪潮之前就证明了可行性。现代系统（REACT、VisRAG、M3DocRAG）都站在它的肩膀上。

### 生产级旅行规划示例

Query：「帮我找一家安静、有自然光的纯素 brunch。」

Pipeline：

1. 拆解 query。"安静" → 音频 / 评论关键词；"纯素 brunch" → 菜单项；"自然光" → 图像特征。
2. 各模态分别检索：
   - 评论上的文本检索：「vegan brunch, quiet ambiance」。
   - 餐厅照片上的图像检索：「natural light, airy」。
   - 环境音片段上的音频检索：「low decibel, no music」。
3. 融合分数。每家餐厅得到一个综合分。
4. Top-k 餐厅 → VLM generator + 全部证据 → 带引用的答案。

这远不是文本 RAG 能覆盖的。每种模态都补上了纯文本注意不到的信号。

### Agentic 多模态 RAG（Agentic multimodal RAG）

多跳（Multi-hop）：如果第一轮检索拿不到高置信度答案，LLM 就改写 query 再检索。Phase 14 的 Agentic RAG 模式在这里同样适用。例子：

- 检索回 top-10 → LLM 说「太吵了，过滤到 <40 dB」→ 再检索。
- 检索回若干图像 → LLM 看到其中一张是菜单 → 再检索菜单文本 → 给出答案。

复杂度上去了，但能处理单轮检索搞不定的 query。

### 评估（Evaluation）

跨模态评估目前还很不成熟。常见的代理指标：

- 各模态分别的 Recall@k。
- 融合后的 top-k 准确率。
- 人工评判的端到端满意度。
- 任务特定指标（成功预订、成功下单）。

目前还没有横跨所有模态的标准 benchmark。论文大多在领域特定任务上做评估。

## 用起来（Use It）

`code/main.py`：

- 三个 mock retriever（text、image、audio），共享同一份餐厅语料库。
- score fusion，按可配置权重组合各模态分数。
- 一个 generator stub，输出带引用的最终答案。
- 一个简单的 agentic 循环，置信度低时改写 query。

## 上线部署（Ship It）

本课产出 `outputs/skill-multimodal-rag-designer.md`。给定一个带多模态 query 流程的产品规格，它会设计 retriever、融合策略、generator 与评估方案。

## 练习（Exercises）

1. 设计一个医疗分诊多模态 RAG：query = 伤口照片 + 症状文本。各模态分别从什么知识库里检索什么？

2. score fusion 是简单加权和。它有哪种 MoE fusion 能规避的失败模式？

3. 阅读 Abootorabi 等综述的分类（Section 3）。三个标志性子问题是什么？它们如何映射到你选定的产品？

4. 给一个旅行规划多模态 RAG 写一份评估规格（eval spec）。哪些指标覆盖图像召回、音频召回与综合正确性？

5. Agentic 多跳 RAG 每往返一次都要交一笔延迟税。在多大的 query 难度下，准确率收益才值这份延迟？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Cross-modal retrieval（跨模态检索） | 「用一种模态查询，检索另一种模态」 | 文本 query 检索图像；图像 query 检索文本；要么共享空间，要么有 translator |
| Score fusion | 「把分数合起来」 | 各模态检索分数的加权和；最简单的融合方式 |
| MoE fusion | 「按模态路由的专家」 | gating 网络按 query 决定信任哪种模态的分数 |
| Grounded generation | 「cite your sources」 | 答案里每条断言都标上 source 编号 |
| MuRAG | 「首个多模态 RAG」 | 2022 年那篇确立多模态 RAG 范式的论文 |
| Agentic multi-hop | 「改写后重试」 | 第一轮置信度低时，LLM 重新查询 retriever |

## 延伸阅读（Further Reading）

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
