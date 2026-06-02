# ColPali 与视觉原生的文档 RAG

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 传统 RAG 的做法是：把 PDF 解析成文本、切成 chunk、对 chunk 做 embedding、把向量存起来。每一步都会丢信号：OCR 丢图表数据、chunking 把表格行切断、文本 embedding 忽视图。ColPali（Faysse et al., 2024 年 7 月）问了一个更直接的问题：为什么非要抽文字出来？直接用 PaliGemma 把页面图像编码，再用 ColBERT 风格的 late interaction 做检索，把文档里所有的版面、图、字体、格式信号统统留住。论文公开的 benchmark：在视觉信息丰富的文档上，端到端准确率比 text-RAG 高 20%–40%。ColQwen2、ColSmol、VisRAG 沿着这个思路继续扩展。本课要读懂视觉原生 RAG 的论点，并自己造一个迷你版的 ColPali 索引器。

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer)
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 解释 bi-encoder 检索（每个文档一个向量）和 late-interaction 检索（每个文档多个向量）的差异。
- 描述 ColBERT 的 MaxSim 操作，以及 ColPali 如何把它从文本 token 推广到图像 patch。
- 自己实现一个迷你 ColPali 风格的索引器：page → patch embeddings → 对 query-term embedding 做 MaxSim → top-k 页面。
- 在发票 / 财报场景下，比较 ColPali + Qwen2.5-VL 生成器 vs text-RAG + GPT-4 的效果。

## 问题（The Problem）

在 PDF 上做 text-RAG，会把文档里大部分东西扔掉。财报里 Q3 的营收增长通常是一张图；医疗报告的诊断结论藏在标注图里；法律合同的签名块本质上是版面事实，不是文本事实。

text-RAG 的流水线（pipeline）：

1. PDF → 通过 OCR / pdftotext 转成文本。
2. 文本 → 300–500 token 的 chunk。
3. chunk → bi-encoder embedding（一个向量）。
4. 用户 query → embedding → 余弦相似度 → top-k chunk。
5. chunks + query → LLM。

五步里步步丢信息。图表抓不住。表格在 chunk 之间被切断。多列版面被压平。图注消失。

ColPali 的修法：跳过 OCR，直接对页面图像做 embedding。检索阶段使用 ColBERT 风格的 late interaction，让模型在 query 时刻还能关注到细粒度的 patch。

## 概念（The Concept）

### ColBERT (2020)

ColBERT（Khattab & Zaharia, arXiv:2004.12832）是一种文本检索方法。它不再为每个文档生成一个向量，而是为每个 token 生成一个向量。query 时：

- query 的 token 各自得到自己的 embedding（N_q 个向量）。
- 文档的 token 也各自得到 embedding（N_d 个向量，通常预先缓存）。
- 评分 = 对每个 query token，取它和文档所有 token 的余弦相似度的最大值，再把这些最大值加起来：Σ_i max_j cos(q_i, d_j)。

这就是 MaxSim 操作。每个 query token 「挑」出它在文档里最匹配的那个 token。最终得分是这些挑选结果的总和。

优点：召回强，能处理 term 级语义。缺点：每个文档要存 N_d 个向量，存储开销大。

### ColPali

ColPali（Faysse et al., arXiv:2407.01449）把 ColBERT 的套路搬到图像上。

- 每一页用 PaliGemma（ViT + 语言模型）编码成 patch embedding：每页 N_p 个向量。
- 每条用户 query（文本）编码成 query-token embedding：N_q 个向量。
- 评分 = Σ_i max_j cos(q_i, p_j)，也就是在 query 文本 token 和页面图像 patch 之间做 MaxSim。
- 按总分取 top-k 页。

文档入库阶段：用 PaliGemma 给每一页做 embedding，把所有 patch embedding 存下来。query 阶段：把 query token 编码出来，对所有已存的页面 embedding 做 MaxSim，返回 top-k 页。

优点：在视觉信息丰富的文档上端到端比 text-RAG 高 20%–40%。每个 patch 向量都捕捉了局部的版面和内容。

缺点：N_p 个 patch × 4 字节浮点 × D 维向量 / 页，存储增长很快。可以靠 PQ / OPQ 量化（quantization）缓解。

### ColQwen2 与 ColSmol

ColQwen2（illuin-tech, 2024–2025）把 PaliGemma 换成 Qwen2-VL。底层 encoder 更强，检索效果更好。

ColSmol 是面向本地 / 边缘场景的小规模变体。一个 ~1B 参数量的 ColSmol 检索器能跑在消费级 GPU 上。

### VisRAG

VisRAG（Yu et al., arXiv:2410.10594）走的是另一条路：不在 patch 上做 MaxSim，而是用一个 VLM 把每页 pool 成单个向量，再做 bi-encoder 检索。索引更快、存储更小，但召回更弱。

质量 vs 成本的取舍：要质量选 ColPali，要规模选 VisRAG。

### M3DocRAG

M3DocRAG（Cho et al., arXiv:2411.04952）把多模态检索扩展到了多页、多文档的推理。它跨文档检索页面，再为 VLM 拼出一个多页上下文。

### ViDoRe — 配套的 benchmark

ColPali 的配套基准。Visual Document Retrieval Evaluation。任务覆盖财报、科研论文、行政文档、医疗记录、操作手册等。指标：nDCG@5。

ColPali-v1 在 ViDoRe 上拿到 ~80% nDCG@5；同一份文档上 text-RAG 只有 ~50%–60%。

### 端到端的 RAG 流水线

视觉原生的 RAG 是这样：

1. 入库：PDF → 页面图像 → PaliGemma 编码 → 存所有 patch embedding。
2. query：用户文本 → query-token embedding → 对所有索引页面做 MaxSim → top-k 页。
3. 生成：top-k 页面图像 + query → VLM（Qwen2.5-VL 或 Claude） → 答案。

全流程没有 OCR。图、图表、字体、版面都自然地流进答案。

### 存储算账

一份 50 页的财报，每页 729 个 patch、128 维 embedding：

- ColPali：50 * 729 * 128 * 4 字节 ≈ 18 MB 原始数据，PQ 之后 ≈ 4 MB。
- Text-RAG：50 个 chunk * 768 维 * 4 字节 ≈ 150 kB。

ColPali 每份文档的存储大约是 text-RAG 的 30 倍。规模化时用 OPQ / PQ 能压到 ~5–10 倍，通常还能接受。

### 什么时候 text-RAG 还是赢家

- 没有版面信号的纯文本文档（wiki 文章、聊天记录）。text-RAG 更简单，存储更便宜。
- 千万页级别的归档库，存储成本是大头。
- 监管要求严格、必须把可抽取的 OCR 文本和检索一起留底的场景。

除此之外，2026 年的财报、科研论文、法律合同、医疗记录、UX 文档——这些场景视觉原生 RAG 都赢。

## 用起来（Use It）

`code/main.py`：

- 玩具版的 patch encoder：把一个「page」（一小格特征向量）映射成一组 patch embedding。
- MaxSim 评分器：在一组 query-token embedding 和一组 page patch 之间算 ColBERT 风格的得分。
- 索引 5 个玩具页面，跑 3 条 query，返回带分数的 top-k。

## 上线部署（Ship It）

本课产出 `outputs/skill-vision-rag-designer.md`。给定一个文档 RAG 项目，它会在 ColPali / ColQwen2 / VisRAG / text-RAG 之间选型，并算出存储规模。

## 练习（Exercises）

1. 一份 200 页的年报，每页 729 个 patch、128 维 embedding、4 字节浮点。算一下原始存储和 PQ 压缩（8x）后的存储。

2. MaxSim 是 Σ_i max_j cos(q_i, p_j)。这个求和捕捉到了什么是简单平均相似度做不到的？

3. ColPali 把页面索引成 patch 集合。如果改成在词（word）级别索引（像 ColBERT 那样）会怎样？取舍在哪？

4. 为一个百万页的语料设计端到端流水线，每条 query 的延迟（latency）预算 500ms。在 ColQwen2 / VisRAG 之间选型并说明理由。

5. 读 M3DocRAG（arXiv:2411.04952）。描述其多页 attention 模式，以及它和单页 ColPali 检索的差别。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际指什么 |
|------|-----------------|------------------------|
| Late interaction | 「ColBERT 风格」 | 用 per-token 或 per-patch embedding + MaxSim 做检索，而不是一个文档单向量 |
| MaxSim | 「在 patch 上取最大」 | 对每个 query token，挑出相似度最高的文档 token；再在 query 上求和 |
| Bi-encoder | 「单向量」 | 每个文档一个向量；快，但粒度丢失 |
| Multi-vector | 「每文档多向量」 | 每个文档 / 页存 N_p 个向量；存储变贵但召回更好 |
| Patch embedding | 「页面特征」 | 来自 VLM encoder 的每个图像 patch 一个向量，按页缓存 |
| ViDoRe | 「视觉文档基准」 | ColPali 的视觉文档检索基准套件 |
| PQ quantization | 「Product quantization（乘积量化）」 | 一种压缩方法，能把存储缩到约 1/8 而尽量保持向量相似度 |

## 延伸阅读（Further Reading）

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
