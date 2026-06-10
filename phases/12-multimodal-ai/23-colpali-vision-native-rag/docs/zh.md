# 23 · ColPali 与视觉原生文档 RAG

> 传统 RAG 把 PDF 解析为文本，切分成块，对块做嵌入，再把向量存起来。每一步都在丢失信号：OCR 丢掉图表数据，分块打断表格行，文本嵌入忽略图形。ColPali（Faysse 等人，2024 年 7 月）提出了一个更朴素的问题：为什么还要抽取文本？直接用 PaliGemma 对整页图像做嵌入，用 ColBERT 风格的「后期交互（late interaction）」做检索，把文档承载的所有版式、图形、字体与排版信号统统保留下来。已发布的基准测试结果：在视觉信息丰富的文档上，端到端准确率比文本 RAG 高 20-40%。ColQwen2、ColSmol 和 VisRAG 进一步扩展了这一范式。本课研读视觉原生 RAG 的核心论点，并构建一个微型的类 ColPali 索引器。

**类型：** 构建
**语言：** Python（标准库，多向量索引器 + MaxSim 打分器）
**前置：** 第 11 阶段（LLM 工程——RAG 基础）、第 12 阶段 · 05（LLaVA）
**时长：** 约 180 分钟

## 学习目标

- 解释「双编码器检索（bi-encoder retrieval）」（每个文档一个向量）与「后期交互检索（late-interaction retrieval）」（每个文档多个向量）之间的区别。
- 描述 ColBERT 的 MaxSim 运算，以及 ColPali 如何把它从文本 token 推广到图像 patch（图块）。
- 构建一个微型的类 ColPali 索引器：页面 → patch 嵌入 → 对查询词嵌入做 MaxSim → top-k 页面。
- 在发票/财务报告这一用例上，对比 ColPali + Qwen2.5-VL 生成器与文本 RAG + GPT-4 的效果。

## 问题所在

针对 PDF 的文本 RAG 丢掉了文档的大部分内容。财务报告里的第三季度营收增长通常藏在图表中；医疗报告的诊断结论在带标注的图像里；法律合同的签名区是一种版式事实，而非文本事实。

文本 RAG 管线：

1. PDF → 通过 OCR / pdftotext 转为文本。
2. 文本 → 300-500 token 的块。
3. 块 → 双编码器嵌入（一个向量）。
4. 用户查询 → 嵌入 → 余弦相似度 → top-k 块。
5. 块 + 查询 → LLM。

五个有损步骤。图表未被捕获。表格被切块打断。多栏版式被压平。图形标注消失。

ColPali 的解法：跳过 OCR，直接对整页图像做嵌入。检索时采用 ColBERT 风格的后期交互，使模型能在查询时关注到细粒度的 patch。

## 核心概念

### ColBERT（2020）

ColBERT（Khattab & Zaharia，arXiv:2004.12832）是一种文本检索方法。它不是每个文档生成一个向量，而是每个 token 生成一个向量。在查询时：

- 查询 token 获得各自的嵌入（N_q 个向量）。
- 文档 token 获得嵌入（N_d 个向量，通常会缓存）。
- 得分 = 对每个查询 token，取其与所有文档 token 余弦相似度的最大值，再对查询 token 求和：Σ_i max_j cos(q_i, d_j)。

这就是 MaxSim 运算。每个查询 token「挑选」与它最匹配的文档 token。最终得分是这些最大值之和。

优点：召回率强，能处理词项级语义。缺点：每个文档需 N_d 个向量，存储开销大。

### ColPali

ColPali（Faysse 等人，arXiv:2407.01449）把 ColBERT 范式应用到图像上。

- 每一页由 PaliGemma（ViT + 语言）编码为 patch 嵌入：每页 N_p 个向量。
- 每个用户查询（文本）被编码为查询 token 嵌入：N_q 个向量。
- 得分 = Σ_i max_j cos(q_i, p_j)，即在查询文本 token 与页面图像 patch 之间做 MaxSim。
- 按总得分检索 top-k 页面。

文档入库时：用 PaliGemma 对每一页做嵌入，存下所有 patch 嵌入。查询时：对查询 token 做嵌入，针对所有已存的页面嵌入计算 MaxSim，返回 top-k 页面。

优点：在视觉信息丰富的文档上，端到端比文本 RAG 高 20-40%。每个 patch 向量捕获了局部的版式与内容。

缺点：每页 N_p 个 patch × 4 字节浮点数 × D 维向量 = 存储增长很快。可通过 PQ / OPQ 量化来缓解。

### ColQwen2 与 ColSmol

ColQwen2（illuin-tech，2024-2025）把 PaliGemma 换成了 Qwen2-VL。更强的基础编码器，更好的检索效果。

ColSmol 是面向本地/边缘场景的小规模变体。一个约 1B 参数的 ColSmol 检索器可在消费级 GPU 上运行。

### VisRAG

VisRAG（Yu 等人，arXiv:2410.10594）是另一种不同的变体：它不在 patch 上做 MaxSim，而是用 VLM 把每一页池化为单个向量，再做双编码器检索。索引更快、存储更小，但召回率更弱。

质量与成本的权衡：追求质量用 ColPali，追求规模用 VisRAG。

### M3DocRAG

M3DocRAG（Cho 等人，arXiv:2411.04952）把多模态检索扩展到跨页、跨文档的推理。它跨文档检索页面，为 VLM 组合出一个多页上下文。

### ViDoRe——基准测试

ColPali 的配套基准。视觉文档检索评测（Visual Document Retrieval Evaluation）。任务涵盖财务报告、科学论文、行政文档、医疗记录、说明手册。指标：nDCG@5。

ColPali-v1 在 ViDoRe 上的 nDCG@5 约为 80%；针对同一批文档的文本 RAG 仅约 50-60%。

### 端到端 RAG 管线

对于一个视觉原生 RAG：

1. 入库：PDF → 页面图像 → PaliGemma 编码 → 存储所有 patch 嵌入。
2. 查询：用户文本 → 查询 token 嵌入 → 针对所有已索引页面做 MaxSim → top-k 页面。
3. 生成：top-k 页面图像 + 查询 → VLM（Qwen2.5-VL 或 Claude）→ 答案。

全程没有 OCR。图形、图表、字体、版式全部流入最终答案。

### 存储量计算

一份 50 页的财务报告，每页 729 个 patch，嵌入维度为 128：

- ColPali：50 * 729 * 128 * 4 字节 = 约 18 MB 原始大小，经 PQ 后约 4 MB。
- 文本 RAG：50 个块 * 768 维 * 4 字节 = 约 150 kB。

每份文档 ColPali 的存储量约为文本 RAG 的 30 倍。在大规模场景下，OPQ / PQ 可将其降至约 5-10 倍，通常可接受。

### 文本 RAG 仍占优的场景

- 没有版式信号的纯文本文档（维基文章、聊天记录）。文本 RAG 更简单、更省存储。
- 数百万页级别的归档库，其中存储成本占主导。
- 严格的合规要求，需要在检索之外同时提供可抽取的 OCR 文本。

至于 2026 年的其他一切场景——财务报告、科学论文、法律合同、医疗记录、UX 文档——视觉原生 RAG 都更占优。

## 动手用它

`code/main.py`：

- 玩具版 patch 编码器：把一个「页面」（小型特征向量网格）映射为一组 patch 嵌入数组。
- MaxSim 打分器：计算查询 token 嵌入集合与页面 patch 集合之间的 ColBERT 风格得分。
- 索引 5 个玩具页面，运行 3 个查询，返回带得分的 top-k 结果。

## 交付它

本课产出 `outputs/skill-vision-rag-designer.md`。给定一个文档 RAG 项目，它会在 ColPali / ColQwen2 / VisRAG / 文本 RAG 之间做选择，并估算存储量。

## 练习

1. 一份 200 页的年报，每页 729 个 patch，嵌入维度 128，4 字节浮点数。计算其原始存储量与经 PQ 压缩（8 倍）后的存储量。

2. MaxSim 是 Σ_i max_j cos(q_i, p_j)。相比简单的平均相似度，这个求和捕获到了什么后者没有的信息？

3. ColPali 把页面索引为 patch 集合。如果改为在词级别索引（像 ColBERT 那样），会有什么变化？有何权衡？

4. 为一个 100 万页的语料库设计端到端管线，每次查询的延迟预算为 500ms。在 ColQwen2 / VisRAG 之间做选择并给出理由。

5. 阅读 M3DocRAG（arXiv:2411.04952）。描述其多页注意力模式，以及它与单页 ColPali 检索的区别。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 后期交互（Late interaction） | “ColBERT 风格” | 使用按 token 或按 patch 的嵌入 + MaxSim 做检索，而非单个文档向量 |
| MaxSim | “在 patch 上取最大” | 对每个查询 token，挑出相似度最高的文档 token；再对所有查询 token 求和 |
| 双编码器（Bi-encoder） | “单向量” | 每个文档一个向量；更快但损失粒度 |
| 多向量（Multi-vector） | “每文档多向量” | 每个文档/页面存储 N_p 个向量；存储成本上升但召回提升 |
| Patch 嵌入（Patch embedding） | “页面特征” | 来自 VLM 编码器的每个图像 patch 一个向量，按页缓存 |
| ViDoRe | “视觉文档基准” | ColPali 用于视觉文档检索的基准测试套件 |
| PQ 量化（PQ quantization） | “乘积量化” | 在保持向量相似度的同时把存储缩小约 8 倍的压缩方法 |

## 延伸阅读

- [Faysse 等人——ColPali（arXiv:2407.01449）](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia——ColBERT（arXiv:2004.12832）](https://arxiv.org/abs/2004.12832)
- [Yu 等人——VisRAG（arXiv:2410.10594）](https://arxiv.org/abs/2410.10594)
- [Cho 等人——M3DocRAG（arXiv:2411.04952）](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
