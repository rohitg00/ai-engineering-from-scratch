# 毕业项目 04 — 多模态文档问答(视觉优先的 PDF、表格、图表)

> 2026 年的文档问答前沿已从“先 OCR 再文本”转向视觉优先的后期交互。ColPali、ColQwen2.5 和 ColQwen3-omni 将每个 PDF 页面视为图像，用多向量后期交互进行嵌入，并让查询直接关注图像块。在金融 10-K、科学论文和手写笔记上，这种模式大幅领先于 OCR 优先方案。在 1 万页语料上端到端地构建该流水线，并发布与“先 OCR 再文本”的对比结果。

**类型：** 毕业项目
**语言：** Python(流水线)、TypeScript(查看器 UI)
**先修：** 阶段 4(计算机视觉)、阶段 5(NLP)、阶段 7(transformers)、阶段 11(LLM 工程)、阶段 12(多模态)、阶段 17(基础设施)
**涉及阶段：** P4 · P5 · P7 · P11 · P12 · P17
**时间：** 30 小时

## 问题

企业中大量 PDF 会被 OCR 流水线处理得面目全非：带旋转表格的扫描版 10-K、满是公式的科学论文、只有作为图像才有意义的图表、手写批注。将它们当作纯文本处理意味着丢失一半的信号。2026 年的答案是对原始页面图像进行后期交互多向量检索。ColPali(Illuin Tech)率先提出；ColQwen2.5-v0.2 和 ColQwen3-omni 进一步提升了准确率。在 ViDoRe v3 上，视觉优先检索以显著优势超过“先 OCR 再文本”——而且这一差距在图表、表格和手写内容上还会扩大。

代价是存储和延迟。一个 ColQwen 嵌入是每页约 2048 个图像块向量，而不是单个 1024 维向量。原始存储急剧膨胀。DocPruner(2026)实现了 50% 的剪枝而准确率无可测量的损失。你将索引 1 万页，测量 ViDoRe v3 nDCG@5,在 2 秒内提供答案，并与“先 OCR 再文本”基线直接对比。

## 概念

后期交互意味着每个查询 token 与每个图像块 token 打分，并对每个查询 token 取最大分数后求和。这样无需单一池化向量即可获得细粒度匹配。多向量索引(Vespa、Qdrant 多向量或 AstraDB)存储逐块嵌入，并在检索时执行 MaxSim。

回答器是一个视觉-语言模型，接收查询加上作为图像的 top-k 检索页面，写出带证据区域(边界框或页面引用)的答案。Qwen3-VL-30B、Gemini 2.5 Pro 和 InternVL3 是 2026 年的前沿选择。对于公式和科学记号，可将 OCR 后备(Nougat、dots.ocr)作为可选文本通道接入。

评估是一个二维矩阵。一个轴：内容类型(普通文本段落、密集表格、柱状图/折线图、手写笔记、公式)。另一个轴：检索方式(视觉优先后期交互 vs 先 OCR 再文本 vs 混合)。每个单元格测量 nDCG@5 和答案准确率。报告就是交付成果。

## 架构

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

## 技术栈

- 页面渲染：PyMuPDF (fitz),180 DPI,纵向归一化
- 后期交互模型：ColQwen2.5-v0.2 或 ColQwen3-omni(Hugging Face 上的 vidore 团队)
- 索引：带多向量字段的 Vespa,或 Qdrant 多向量，或带 MaxSim 的 AstraDB
- 剪枝：DocPruner 2026 策略(保留高方差图像块，50% 压缩且准确率损失 < 0.5%)
- OCR 后备(公式/密集表格)：dots.ocr 或 Nougat
- VLM 回答器：自托管的 Qwen3-VL-30B 或托管的 Gemini 2.5 Pro;InternVL3 作为后备
- 评估：ViDoRe v3 基准、用于多页推理的 M3DocVQA
- 查看 UI:Next.js 15,用 canvas 叠加层显示证据区域

```figure
ce-late-interaction
```

## 构建步骤

1. **摄取。** 遍历由 10-K、科学论文和扫描文档组成的 1 万页 PDF 语料。将每页渲染为 1536x2048 PNG。持久化 `{doc_id, page_num, image_path}`。

2. **嵌入。** 对每个页面图像运行 ColQwen2.5-v0.2。输出形状约为 2048 个 128 维图像块嵌入。应用 DocPruner 保留信号最强的那一半。写入 Vespa 多向量字段或 Qdrant 多向量。

3. **查询。** 对每个传入查询，用查询塔(token 级嵌入)进行嵌入。对索引运行 MaxSim:对每个查询 token,取其在所有页面图像块嵌入上的最大点积，然后求和。返回 top-k 页面。

4. **综合。** 用查询和 top-5 页面图像调用 Qwen3-VL-30B。提示词："Answer using only the supplied pages. Cite each claim by (doc_id, page) and name the region (figure, table, paragraph)."

5. **证据区域。** 对答案进行后处理以提取被引用的区域。如果 VLM 输出边界框(Qwen3-VL 可以)，则在查看器中将其渲染为叠加层。

6. **OCR 后备。** 对被识别为公式密集的页面(基于图像方差的启发式)，运行 Nougat 或 dots.ocr,并将 OCR 文本作为附加通道与图像一起传入。

7. **评估。** 运行 ViDoRe v3(检索 nDCG@5)和 M3DocVQA(多页问答准确率)。同时在相同语料上用相同综合器运行“先 OCR 再文本”流水线。生成内容类型 × 方法矩阵。

8. **UI。** 先做 Streamlit 原型；再实现带逐页证据区域叠加层的 Next.js 15 生产查看器。

## 使用

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

## 交付标准

`outputs/skill-doc-qa.md` 描述了交付成果：一个针对特定语料调优、并在 ViDoRe v3 上与“先 OCR 再文本”基线对比评估的视觉优先多模态文档问答系统。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确率 | 基准数字 vs OCR-文本基线及公开排行榜 |
| 20 | 证据区域定位 | 被引用区域中真正包含答案片段的比例 |
| 20 | 存储与延迟工程 | DocPruner 压缩率、索引 p95、回答 p95 |
| 20 | 多页推理 | 在人工标注的 100 题多页测试集上的准确率 |
| 15 | 源文档查看体验 | 查看器清晰度、叠加层保真度、并排对比工具 |
| **100** | | |

## 练习

1. 在相同语料上测量 ColQwen2.5-v0.2 与 ColQwen3-omni。哪些页面一个答对而另一个漏掉？在索引中添加“内容类别”标签以便按类型路由。

2. 激进地剪枝嵌入(75%、90%)。找到压缩悬崖：ViDoRe nDCG@5 跌破 OCR 基线的临界点。

3. 构建混合方案：并行运行“先 OCR 再文本”和 ColQwen,用 RRF 融合，再用 cross-encoder 重排。混合方案能否胜过单独任一方案？在哪里帮助最大？

4. 将 Qwen3-VL-30B 换成更小的 VLM(Qwen2.5-VL-7B)。测量单位成本的准确率曲线。

5. 添加手写笔记支持。渲染手写语料，用 ColQwen 嵌入，测量检索效果。与手写 OCR 流水线对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 后期交互 | "ColPali 风格检索" | 查询 token 独立地与页面图像块打分;MaxSim 聚合 |
| 多向量 | "逐块嵌入" | 每个文档有多个向量，而不是单个池化向量 |
| MaxSim | "后期交互打分" | 对每个查询 token,取其在文档向量上的最大相似度;然后求和 |
| DocPruner | "图像块压缩" | 2026 年的剪枝方法，保留 50% 图像块且准确率损失可忽略 |
| ViDoRe v3 | "文档检索基准" | 衡量视觉文档检索的 2026 年标准 |
| 证据区域 | "被引用的边界框" | 源页面上定位答案片段的 bbox |
| OCR 后备 | "公式通道" | 在公式或表格密集页面上与视觉方案并用的文本流水线 |

## 延伸阅读

- [ColPali (Illuin Tech) 仓库](https://github.com/illuin-tech/colpali) — 后期交互文档检索的参考实现
- [ColPali 论文 (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — 奠基性方法论文
- [Hugging Face 上的 ColQwen 系列](https://huggingface.co/vidore) — 可用于生产的检查点
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — 多页多模态 RAG 基线
- [Vespa 多向量教程](https://docs.vespa.ai/en/colpali.html) — 参考服务栈
- [Qdrant 多向量支持](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — 备选索引
- [AstraDB 多向量](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — 备选托管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) — 支持公式的 OCR 后备