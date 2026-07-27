# ColPali 与视觉原生文档 RAG

> 传统 RAG 将 PDF 解析为文本、切分成块、对块进行嵌入、存储向量。每一步都会丢失信号：OCR 丢失图表数据，分块破坏表格行，文本嵌入忽略图形。ColPali（Faysse 等人，2024 年 7 月）提出了更简单的问题：为什么非要提取文本？直接通过 PaliGemma 嵌入页面图像，使用 ColBERT 风格的延迟交互进行检索，保留文档携带的所有布局、图形、字体和格式信号。已发表基准测试：在视觉丰富的文档上，端到端准确率比文本 RAG 高出 20-40%。ColQwen2、ColSmol 和 VisRAG 扩展了这一模式。本节课将阅读视觉原生 RAG 论文，并构建一个微型 ColPali 类索引器。

**类型：** 构建
**语言：** Python（标准库，多向量索引器 + MaxSim 评分器）
**前置知识：** 阶段 11（LLM 工程 — RAG 基础），阶段 12 · 05（LLaVA）
**时长：** 约 180 分钟

## 学习目标

- 解释双编码器检索（每文档一个向量）与延迟交互检索（每文档多个向量）的区别。
- 描述 ColBERT 的 MaxSim 操作以及 ColPali 如何将其从文本标记推广到图像块。
- 构建一个微型 ColPali 类索引器：页面 → 块嵌入 → 对查询词嵌入进行 MaxSim → 返回 top-k 页面。
- 在发票/财务报告用例上比较 ColPali + Qwen2.5-VL 生成器与文本 RAG + GPT-4。

## 问题所在

PDF 上的文本 RAG 丢弃了文档的大部分内容。财务报告的第三季度收入增长通常出现在图表中；医疗报告的发现存在于带注释的图像中；法律合同的签名块是布局事实，而非文本事实。

文本 RAG 流水线：

1. PDF → 通过 OCR / pdftotext 提取文本。
2. 文本 → 300-500 个 token 的块。
3. 块 → 双编码器嵌入（一个向量）。
4. 用户查询 → 嵌入 → 余弦相似度 → top-k 块。
5. 块 + 查询 → LLM。

五个有损步骤。图表未被捕获。表格被拆分到不同块中。多列布局被扁平化。图形注释消失。

ColPali 的解决方案：跳过 OCR，直接嵌入页面图像。使用 ColBERT 风格的延迟交互进行检索，使模型在查询时能够关注细粒度的图像块。

## 核心概念

### ColBERT（2020）

ColBERT（Khattab & Zaharia，arXiv:2004.12832）是一种文本检索方法。它不是每文档一个向量，而是每 token 产生一个向量。在查询时：

- 查询 token 获得各自的嵌入（N_q 个向量）。
- 文档 token 获得嵌入（N_d 个向量，通常缓存）。
- 得分 = 对每个查询 token，取文档 token 中余弦相似度的最大值并求和：Σ_i max_j cos(q_i, d_j)。

这就是 MaxSim 操作。每个查询 token "挑选"其匹配最佳的文档 token。最终得分即为总和。

优势：召回率高，处理词级语义。劣势：每文档 N_d 个向量，存储代价高。

### ColPali

ColPali（Faysse 等人，arXiv:2407.01449）将 ColBERT 模式应用于图像。

- 每页由 PaliGemma（ViT + 语言）编码为块嵌入：每页 N_p 个向量。
- 每个用户查询（文本）被编码为查询 token 嵌入：N_q 个向量。
- 得分 = Σ_i max_j cos(q_i, p_j)，即对查询文本 token 和页面图像块进行 MaxSim。
- 按总得分检索 top-k 页面。

在文档摄取时：用 PaliGemma 嵌入每一页，存储所有块嵌入。在查询时：嵌入查询 token，对所有已存储的页面嵌入计算 MaxSim，返回 top-k 页面。

优势：在视觉丰富的文档上，端到端比文本 RAG 高出 20-40%。每个块向量捕获局部布局和内容。

劣势：每页 N_p 个块 × 4 字节浮点数 × D 维向量 = 存储增长迅速。可通过 PQ/OPQ 量化缓解。

### ColQwen2 与 ColSmol

ColQwen2（illuin-tech，2024-2025）将 PaliGemma 替换为 Qwen2-VL。更好的基础编码器，更好的检索效果。

ColSmol 是面向本地/边缘场景的小规模变体。约 1B 参数的 ColSmol 检索器可在消费级 GPU 上运行。

### VisRAG

VisRAG（Yu 等人，arXiv:2410.10594）是一种不同的变体：它不是对块进行 MaxSim，而是通过 VLM 将每页池化为单个向量，然后进行双编码器检索。索引更快 + 存储更小，但召回率较弱。

质量与成本的权衡：追求质量用 ColPali，追求规模用 VisRAG。

### M3DocRAG

M3DocRAG（Cho 等人，arXiv:2411.04952）将多模态检索扩展到多页面、多文档推理。跨文档检索页面，为 VLM 组合多页上下文。

### ViDoRe — 基准测试

ColPali 的配套基准测试。视觉文档检索评估（Visual Document Retrieval Evaluation）。任务包括财务报告、科学论文、行政文档、医疗记录、手册。评估指标：nDCG@5。

ColPali-v1 在 ViDoRe 上得分约 80% nDCG@5；同一文档上的文本 RAG 得分约 50-60%。

### 端到端 RAG 流水线

对于视觉原生 RAG：

1. 摄取：PDF → 页面图像 → PaliGemma 编码 → 存储所有块嵌入。
2. 查询：用户文本 → 查询 token 嵌入 → 对所有已索引页面进行 MaxSim → top-k 页面。
3. 生成：top-k 页面图像 + 查询 → VLM（Qwen2.5-VL 或 Claude）→ 答案。

全程无需 OCR。图形、图表、字体、布局全部流入答案。

### 存储计算

一份 50 页的财务报告，每页 729 个块，128 维嵌入：

- ColPali：50 × 729 × 128 × 4 字节 = 约 18 MB 原始大小，PQ 后约 4 MB。
- 文本 RAG：50 个块 × 768 维 × 4 字节 = 约 150 kB。

ColPali 每文档存储约 30 倍。大规模下，OPQ/PQ 可将其降至约 5-10 倍，通常可接受。

### 文本 RAG 仍然占优的场景

- 纯文本文档，无布局信号（维基百科文章、聊天记录）。文本 RAG 更简单，存储更便宜。
- 数百万页的档案，存储成本占主导。
- 严格的法规要求，要求与检索同时提供可提取的 OCR 文本。

对于 2026 年的其他所有场景——财务报告、科学论文、法律合同、医疗记录、UX 文档——视觉原生 RAG 胜出。

## 使用方式

`code/main.py`：

- 玩具补丁编码器：将"页面"（小型特征向量网格）映射为块嵌入数组。
- MaxSim 评分器：计算查询 token 嵌入集与页面块集之间的 ColBERT 风格得分。
- 索引 5 个玩具页面，运行 3 个查询，返回带得分的 top-k 结果。

## 交付成果

本节课产出 `outputs/skill-vision-rag-designer.md`。针对给定的文档 RAG 项目，选择 ColPali / ColQwen2 / VisRAG / 文本 RAG 并估算存储需求。

## 练习

1. 一份 200 页的年报，每页 729 个块，128 维嵌入，4 字节浮点数。计算原始存储和 PQ 压缩后（8 倍）的存储。

2. MaxSim 是 Σ_i max_j cos(q_i, p_j)。这个求和捕获了什么简单均值相似度无法捕获的信息？

3. ColPali 将页面索引为块集。如果改为在词级进行索引（如 ColBERT 所做），会有什么变化？权衡是什么？

4. 为一个 100 万页的语料库设计端到端流水线，延迟预算为每次查询 500 毫秒。选择 ColQwen2 / VisRAG 并说明理由。

5. 阅读 M3DocRAG（arXiv:2411.04952）。描述其多页面注意力模式，以及它如何与单页面 ColPali 检索不同。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| 延迟交互（Late interaction） | "ColBERT 风格" | 使用每 token 或每块嵌入 + MaxSim 进行检索，而非单文档向量 |
| MaxSim | "块上取最大值" | 对每个查询 token，选取相似度最高的文档 token；在查询维度求和 |
| 双编码器（Bi-encoder） | "单向量" | 每文档一个向量；速度更快但粒度丢失 |
| 多向量（Multi-vector） | "每文档多向量" | 每文档/页面存储 N_p 个向量；存储成本增加但召回率提升 |
| 块嵌入（Patch embedding） | "页面特征" | 来自 VLM 编码器的每个图像块对应一个向量，按页缓存 |
| ViDoRe | "视觉文档基准" | ColPali 的视觉文档检索基准测试套件 |
| PQ 量化（PQ quantization） | "乘积量化" | 在保持向量相似度的同时将存储压缩约 8 倍的压缩方法 |

## 延伸阅读

- [Faysse 等人 — ColPali（arXiv:2407.01449）](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT（arXiv:2004.12832）](https://arxiv.org/abs/2004.12832)
- [Yu 等人 — VisRAG（arXiv:2410.10594）](https://arxiv.org/abs/2410.10594)
- [Cho 等人 — M3DocRAG（arXiv:2411.04952）](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
