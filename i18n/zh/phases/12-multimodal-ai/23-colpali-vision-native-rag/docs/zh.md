# ColPali 与视觉原生文档 RAG

> 传统 RAG 将 PDF 解析为文本、切分成块、嵌入块、存储向量。每一步都在损失信号:OCR 丢失图表数据,分块打乱表格行,文本嵌入忽略插图。ColPali(Faysse 等人,2024 年 7 月)提出了一个更简单的问题:为什么还要提取文本?直接通过 PaliGemma 嵌入页面图像,使用 ColBERT 风格的 late interaction 进行检索,并保留文档所携带的全部版式、插图、字体和格式信号。已发表的基准测试显示:在视觉信息丰富的文档上,端到端准确率比文本 RAG 高 20-40%。ColQwen2、ColSmol 和 VisRAG 延续了这一模式。本课阅读视觉原生 RAG 的论文,并构建一个小型类 ColPali 索引器。

**Type:** Build
**Languages:** Python(标准库,多向量索引器 + MaxSim 评分器)
**Prerequisites:** Phase 11(LLM Engineering — RAG 基础)、Phase 12 · 05(LLaVA)
**Time:** ~180 分钟

## 学习目标

- 解释 bi-encoder 检索(每个文档一个向量)与 late-interaction 检索(每个文档多个向量)的区别。
- 描述 ColBERT 的 MaxSim 操作,以及 ColPali 如何将其从文本 token 推广到图像 patch。
- 构建一个小型类 ColPali 索引器:页面 → patch 嵌入 → 对查询词嵌入做 MaxSim → top-k 页面。
- 在发票/财务报告用例上,对比 ColPali + Qwen2.5-VL 生成器与文本 RAG + GPT-4。

## 问题所在

对 PDF 使用文本 RAG 会丢弃文档的大部分信息。财务报告的 Q3 营收增长通常在图表中;医疗报告的结论在标注图像中;法律合同的签名栏是版式事实,而非文本事实。

文本 RAG 流水线:

1. PDF → 通过 OCR / pdftotext 转为文本。
2. 文本 → 300-500 token 的块。
3. 块 → bi-encoder 嵌入(一个向量)。
4. 用户查询 → 嵌入 → 余弦相似度 → top-k 块。
5. 块 + 查询 → LLM。

五个有损步骤。图表未被捕获。表格被跨块切断。多栏版式被压平。插图标注消失。

ColPali 的解决方案:跳过 OCR,直接嵌入页面图像。使用 ColBERT 风格的 late interaction 进行检索,使模型能在查询时关注细粒度的 patch。

## 核心概念

### ColBERT(2020)

ColBERT(Khattab & Zaharia,arXiv:2004.12832)是一种文本检索方法。它不是每个文档一个向量,而是每个 token 一个向量。在查询时:

- 查询 token 获得各自的嵌入(N_q 个向量)。
- 文档 token 获得嵌入(N_d 个向量,通常已缓存)。
- 分数 = 对每个查询 token 取其与所有文档 token 余弦相似度的最大值,再求和:Σ_i max_j cos(q_i, d_j)。

这就是 MaxSim 操作。每个查询 token "挑选"与其最匹配的文档 token,最终分数是各次匹配之和。

优点:召回强,能处理词级语义。缺点:每个文档 N_d 个向量,存储开销大。

### ColPali

ColPali(Faysse 等人,arXiv:2407.01449)将 ColBERT 模式应用于图像。

- 每个页面由 PaliGemma(ViT + 语言模型)编码为 patch 嵌入:每页 N_p 个向量。
- 每个用户查询(文本)被编码为查询 token 嵌入:N_q 个向量。
- 分数 = Σ_i max_j cos(q_i, p_j),即在查询文本 token 与页面图像 patch 之间做 MaxSim。
- 按总分检索 top-k 页面。

在文档入库时:用 PaliGemma 嵌入每个页面,存储所有 patch 嵌入。在查询时:嵌入查询 token,对所有已存储的页面嵌入计算 MaxSim,返回 top-k 页面。

优点:在视觉信息丰富的文档上,端到端效果比文本 RAG 高 20-40%。每个 patch 向量捕获局部版式与内容。

缺点:每页 N_p 个 patch × 4 字节浮点数 × D 维向量,存储增长迅速。可通过 PQ / OPQ 量化缓解。

### ColQwen2 与 ColSmol

ColQwen2(illuin-tech,2024-2025)将 PaliGemma 替换为 Qwen2-VL。更好的基础编码器,更好的检索效果。

ColSmol 是面向本地/边缘使用的小规模变体。一个约 1B 参数的 ColSmol 检索器可在消费级 GPU 上运行。

### VisRAG

VisRAG(Yu 等人,arXiv:2410.10594)是另一种变体:不对 patch 做 MaxSim,而是用 VLM 将每个页面池化为单个向量,再做 bi-encoder 检索。索引更快、存储更小,但召回较弱。

质量与成本的权衡:追求质量用 ColPali,追求规模用 VisRAG。

### M3DocRAG

M3DocRAG(Cho 等人,arXiv:2411.04952)将多模态检索扩展到多页面、多文档推理。跨文档检索页面,为 VLM 组装多页面上下文。

### ViDoRe —— 基准测试

ColPali 的配套基准。Visual Document Retrieval Evaluation。任务包括财务报告、科学论文、行政文件、医疗记录、手册。指标:nDCG@5。

ColPali-v1 在 ViDoRe 上的 nDCG@5 约 80%;同样的文档,文本 RAG 仅约 50-60%。

### 端到端 RAG 流水线

对于一个视觉原生 RAG:

1. 入库:PDF → 页面图像 → PaliGemma 编码 → 存储所有 patch 嵌入。
2. 查询:用户文本 → 查询 token 嵌入 → 对所有已索引页面做 MaxSim → top-k 页面。
3. 生成:top-k 页面图像 + 查询 → VLM(Qwen2.5-VL 或 Claude)→ 答案。

全程无 OCR。插图、图表、字体、版式全部进入答案。

### 存储计算

一份 50 页的财务报告,每页 729 个 patch,128 维嵌入:

- ColPali:50 * 729 * 128 * 4 字节 ≈ 18 MB 原始存储,PQ 后约 4 MB。
- 文本 RAG:50 块 * 768 维 * 4 字节 ≈ 150 kB。

ColPali 每个文档的存储约为 30 倍。在大规模场景下,OPQ / PQ 可将其降至约 5-10 倍,通常可以接受。

### 文本 RAG 仍然占优的场景

- 没有版式信号的纯文本文档(wiki 文章、聊天记录)。文本 RAG 更简单且存储成本低。
- 存储成本占主导的数百万页面归档。
- 监管严格要求在检索之外保留可提取的 OCR 文本。

对于 2026 年的其他一切——财务报告、科学论文、法律合同、医疗记录、UX 文档——视觉原生 RAG 都更胜一筹。

```figure
mm-maxsim
```

## 动手实践

`code/main.py`:

- 玩具 patch 编码器:将一个"页面"(特征向量的小网格)映射为 patch 嵌入数组。
- MaxSim 评分器:计算一组查询 token 嵌入与一组页面 patch 之间的 ColBERT 风格分数。
- 索引 5 个玩具页面,运行 3 个查询,返回带分数的 top-k 结果。

## 交付物

本课产出 `outputs/skill-vision-rag-designer.md`。给定一个文档 RAG 项目,在 ColPali / ColQwen2 / VisRAG / 文本 RAG 中做出选择并估算存储规模。

## 练习

1. 一份 200 页的年度报告,每页 729 个 patch,128 维嵌入,4 字节浮点数。计算原始存储量和 PQ 压缩后(8 倍)的存储量。

2. MaxSim 是 Σ_i max_j cos(q_i, p_j)。这个求和捕获了简单平均相似度所无法捕获的什么信息?

3. ColPali 将页面索引为 patch 集合。如果我们改为在词级别索引(如 ColBERT 那样),会有什么变化?权衡是什么?

4. 为一个 100 万页的语料库设计端到端流水线,延迟预算为每次查询 500ms。选择 ColQwen2 / VisRAG 并说明理由。

5. 阅读 M3DocRAG(arXiv:2411.04952)。描述其多页面注意力模式,以及它与单页面 ColPali 检索的区别。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Late interaction | "ColBERT 风格" | 使用 per-token 或 per-patch 嵌入 + MaxSim 的检索,而非单一文档向量 |
| MaxSim | "对 patch 取最大" | 对每个查询 token,选取相似度最高的文档 token;再对查询求和 |
| Bi-encoder | "单向量" | 每个文档一个向量;更快但丢失粒度 |
| Multi-vector | "每文档多向量" | 每个文档/页面存储 N_p 个向量;存储成本上升但召回改善 |
| Patch embedding | "页面特征" | 由 VLM 编码器为每个图像 patch 生成一个向量,按页面缓存 |
| ViDoRe | "视觉文档基准" | ColPali 用于视觉文档检索的基准套件 |
| PQ quantization | "乘积量化" | 在将存储缩小约 8 倍的同时保持向量相似度的压缩方法 |

## 延伸阅读

- [Faysse 等人 — ColPali(arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT(arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu 等人 — VisRAG(arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho 等人 — M3DocRAG(arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)