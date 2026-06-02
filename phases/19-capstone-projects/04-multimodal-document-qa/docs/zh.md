# Capstone 04 — 多模态文档问答（Vision-First PDF / 表格 / 图表）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年文档问答的前沿已经从「先 OCR 再文本」转向了 vision-first（视觉优先）late interaction（晚期交互）。ColPali、ColQwen2.5、ColQwen3-omni 把每一页 PDF 当成一张图片，用多向量 late interaction 做 embedding，让 query 直接对 patch 做注意。在金融 10-K、科学论文、手写笔记上，这套范式相对 OCR-first 大幅领先。把整条流水线在 1 万页规模上端到端搭起来，并发布与 OCR-then-text 的对照评测。

**Type:** Capstone
**Languages:** Python（流水线）、TypeScript（查看器 UI）
**Prerequisites:** Phase 4（计算机视觉）、Phase 5（NLP）、Phase 7（transformer）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 17（基础设施）
**Phases exercised:** P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## 问题（Problem）

企业坐拥大量 OCR 流水线会搞砸的 PDF：扫描版的 10-K 报表里表格还转着角度，科学论文里挤满公式，图表必须当成图片才讲得通，还有手写批注。把这些当成 text-first 处理，等于丢掉一半信号。2026 年的答案是：在原始页面图像上做 late-interaction 多向量检索。ColPali（Illuin Tech）首次提出，ColQwen2.5-v0.2 和 ColQwen3-omni 把准确率推得更高。在 ViDoRe v3 上，vision-first 检索相对 OCR-then-text 拉开了实打实的差距——而且在图表、表格、手写场景里，差距还会进一步放大。

代价是存储和延迟。一个 ColQwen embedding 是每页约 2048 个 patch 向量，不是一个单独的 1024 维向量。原始存储会爆炸式增长。DocPruner（2026）能在不损失可测准确率的前提下做 50% 的剪枝。你要做的是：索引 1 万页、测出 ViDoRe v3 nDCG@5、把回答时延压到 2 秒以内，并直接和 OCR-then-text 基线对照。

## 概念（Concept）

Late interaction 的含义是：每个 query token 都要对每个 patch token 算分数，再对每个 query token 取最大分并求和。你不需要一个池化后的单向量也能拿到细粒度匹配。一个多向量索引（Vespa、Qdrant multi-vector，或 AstraDB）会存下每个 patch 的 embedding，并在检索时跑 MaxSim。

回答器是一个视觉-语言模型（VLM），输入是 query 加上 top-k 检索回来的页面图片，输出是带证据区域（bounding box 或页码引用）的答案。Qwen3-VL-30B、Gemini 2.5 Pro、InternVL3 是 2026 年的前沿选项。对公式和科学符号，会拼接一个 OCR 兜底（Nougat、dots.ocr）作为可选的文本通道。

评测是一个二维矩阵。一个轴是内容类型（普通段落、密集表格、柱状/折线图、手写笔记、公式）；另一个轴是检索方式（vision-first late interaction、OCR-then-text、混合）。每个格子都给出 nDCG@5 和回答准确率。这份报告就是交付物。

## 架构（Architecture）

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## 技术栈（Stack）

- 页面渲染：PyMuPDF (fitz)，180 DPI，竖版归一化
- Late-interaction 模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上的 vidore 团队）
- 索引：Vespa 的多向量字段，或 Qdrant multi-vector，或 AstraDB 配 MaxSim
- 剪枝：DocPruner 2026 策略（保留高方差 patch，50% 压缩，准确率损失 < 0.5%）
- OCR 兜底（公式 / 密集表格）：dots.ocr 或 Nougat
- VLM 回答器：自托管 Qwen3-VL-30B 或托管的 Gemini 2.5 Pro；InternVL3 作为兜底
- 评测：ViDoRe v3 基准、M3DocVQA（多页推理）
- 查看器 UI：Next.js 15，用 canvas 叠加证据区域

## 动手实现（Build It）

1. **Ingest（摄入）。** 遍历一份 1 万页规模的 PDF 语料，覆盖 10-K、科学论文、扫描文档。把每页渲染成 1536x2048 的 PNG，持久化 `{doc_id, page_num, image_path}`。

2. **Embed。** 在每张页面图片上跑 ColQwen2.5-v0.2，输出形状大约是 2048 个 128 维 patch embedding。用 DocPruner 留下信号最强的一半，写到 Vespa 多向量字段或 Qdrant multi-vector。

3. **Query。** 对每个进来的 query，用 query 塔做 embedding（token 级 embedding）。对索引跑 MaxSim：对每个 query token，取它和所有页面 patch embedding 的最大点积，再求和。返回 top-k 页面。

4. **Synthesize（合成）。** 用 query 和 top-5 页面图片调用 Qwen3-VL-30B。Prompt：「Answer using only the supplied pages. Cite each claim by (doc_id, page) and name the region (figure, table, paragraph).」

5. **证据区域（Evidence regions）。** 后处理回答以提取被引用的区域。如果 VLM 输出了 bounding box（Qwen3-VL 会），在查看器里把它们渲染成叠加层。

6. **OCR 兜底。** 对被识别为公式密集的页面（基于图像方差的启发式），跑 Nougat 或 dots.ocr，把 OCR 文本作为额外通道和图片一起送进去。

7. **Eval（评测）。** 跑 ViDoRe v3（检索 nDCG@5）和 M3DocVQA（多页 QA 准确率）。在同一份语料、同一个合成器上也跑一遍 OCR-then-text 流水线。产出一张「内容类型 × 方法」的对照矩阵。

8. **UI。** 先用 Streamlit 出原型；生产版本用 Next.js 15，做逐页的证据区域叠加。

## 用起来（Use It）

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## 上线部署（Ship It）

`outputs/skill-doc-qa.md` 描述了交付物：一个针对特定语料调优、并在 ViDoRe v3 上与 OCR-then-text 基线对照评测过的 vision-first 多模态文档问答系统。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确率 | 与 OCR-text 基线及公开榜单的对比 |
| 20 | 证据区域定位（grounding） | 被引用的区域中真正包含答案 span 的比例 |
| 20 | 存储与延迟工程 | DocPruner 压缩比、索引 p95、回答 p95 |
| 20 | 多页推理 | 100 题人工标注多页集上的准确率 |
| 15 | 源文档检视 UX | 查看器清晰度、叠加保真度、side-by-side 对比工具 |
| **100** | | |

## 练习（Exercises）

1. 在同一份语料上对比 ColQwen2.5-v0.2 和 ColQwen3-omni。哪些页一个对、另一个错？给索引加一个「内容类别」标签，按类型路由。

2. 把 embedding 激进剪枝（75%、90%）。找到那条压缩悬崖：ViDoRe nDCG@5 跌破 OCR 基线的临界点。

3. 搭一套混合：OCR-then-text 和 ColQwen 并行跑，用 RRF 融合，再用 cross-encoder 做 reranker。混合是否打得过任何单独一路？在哪里收益最大？

4. 把 Qwen3-VL-30B 换成更小的 VLM（Qwen2.5-VL-7B），度量「单位美元准确率」曲线。

5. 加入手写笔记支持。把手写语料渲染出来、用 ColQwen 做 embedding、测检索效果，并和一个手写 OCR 流水线对照。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | 「ColPali 风格检索」 | Query token 独立地对页面 patch 计分；MaxSim 做聚合 |
| Multi-vector | 「每 patch 一个 embedding」 | 每篇文档有很多向量，而不是一个池化后的向量 |
| MaxSim | 「Late-interaction 打分」 | 对每个 query token 取它和文档向量集合上的最大相似度，再求和 |
| DocPruner | 「Patch 压缩」 | 2026 年的剪枝策略，保留 50% patch、准确率几乎不掉 |
| ViDoRe v3 | 「文档检索基准」 | 2026 年衡量视觉文档检索的标准 |
| Evidence region | 「被引用的 bounding box」 | 源页面上一个定位答案 span 的 bbox |
| OCR fallback | 「公式通道」 | 视觉之外为公式或表格密集页同时跑的文本流水线 |

## 延伸阅读（Further Reading）

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) — late-interaction 文档检索的参考实现
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — 方法奠基论文
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) — 可直接用于生产的 checkpoint
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — 多页多模态 RAG 基线
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) — 参考服务栈
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — 备选索引
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — 备选托管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) — 支持公式的 OCR 兜底
