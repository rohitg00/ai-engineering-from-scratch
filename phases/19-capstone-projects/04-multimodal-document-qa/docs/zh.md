# 04 · 多模态文档问答（视觉优先的 PDF、表格与图表）

> 2026 年的文档问答前沿已从"先 OCR 再文本检索"转向了视觉优先的后期交互（Late Interaction）。ColPali、ColQwen2.5 和 ColQwen3-omni 将每个 PDF 页面视为图像，使用多向量后期交互方式进行嵌入，让查询直接关注图像块（patch）。在财报 10-K、科学论文和手写笔记上，这套方案大幅领先 OCR 优先方案。在 10k 页上搭建完整流水线，并将视觉优先方案与 OCR 再文本方案进行并排对比评估。

**类型：** 综合项目
**语言：** Python（流水线）、TypeScript（查看器界面）
**前置：** 第 4 阶段（计算机视觉）、第 5 阶段（自然语言处理）、第 7 阶段（Transformer）、第 11 阶段（大语言模型工程）、第 12 阶段（多模态）、第 17 阶段（基础设施）
**涉及的阶段：** P4 · P5 · P7 · P11 · P12 · P17
**时长：** 30 小时

## 问题

企业坐拥大量被 OCR 流水线"肢解"的 PDF：含旋转表格的扫描版 10-K、布满公式的科学论文、只有看图像才有意义的图表、手写批注。将这些文档当作纯文本来处理，意味着丢失一半信号。2026 年的答案是：对原始页面图像进行后期交互多向量检索。ColPali（Illuin Tech）开创了这一范式；ColQwen2.5-v0.2 和 ColQwen3-omni 进一步提升了精度。在 ViDoRe v3 基准上，视觉优先检索的得分显著高于 OCR 再文本方案——而这一差距在图表、表格和手写内容上尤为明显。

代价是存储和延迟。ColQwen 的嵌入约为每页约 2048 个图像块向量，而非单个 1024 维向量。原始存储量急剧膨胀。DocPruner（2026）在无显著精度损失的情况下实现了 50% 的剪枝。你将索引 10k 页，测量 ViDoRe v3 nDCG@5，在 2 秒内返回答案，并直接与 OCR 再文本基线进行对比。

## 概念

后期交互意味着每个查询词元与每个图像块词元进行打分，取每个查询词元的最大得分后求和。你可以在不需要单一池化向量的情况下获得细粒度匹配。多向量索引（Vespa、Qdrant 多向量或 AstraDB）存储逐图像块的嵌入，并在检索时执行 MaxSim。

回答器是一个视觉语言模型（VLM），接收查询和检索到的 top-k 页面图像，输出答案并附上证据区域（Evidence Region，边界框或页码引用）。Qwen3-VL-30B、Gemini 2.5 Pro 和 InternVL3 是 2026 年的前沿选择。对于公式和科学符号，OCR 回退（Nougat、dots.ocr）作为可选文本通道接入。

评估是一个二维矩阵。一个轴是内容类型（纯文本段落、密集表格、柱状/折线图、手写笔记、公式）；另一个轴是检索方案（视觉优先后期交互 vs OCR 再文本 vs 混合）。每个单元格包含 nDCG@5 和答案准确率。交付物就是这份评估报告。

## 架构

```
PDFs -> 页面渲染器（PyMuPDF, 180 DPI）
           |
           v
  ColQwen2.5-v0.2 嵌入（每页多向量，约 2048 个图像块）
           |
           +------> DocPruner 50% 压缩
           |
           v
   多向量索引（Vespa 或 Qdrant 多向量）
           |
查询 ----+----> 检索 top-k 页面（MaxSim）
           |
           v
  VLM 回答器：Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    输入：查询 + top-k 页面图像 + 可选 OCR 文本
           |
           v
  带页码引用和证据区域的答案
           |
           v
  Streamlit / Next.js 查看器：在源页面上叠加高亮框
```

## 技术栈

- 页面渲染：PyMuPDF（fitz），180 DPI，纵向归一化
- 后期交互模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上 vidore 团队提供）
- 索引：Vespa（支持多向量字段）、Qdrant 多向量、或 AstraDB（支持 MaxSim）
- 剪枝：DocPruner 2026 策略（保留高方差图像块，50% 压缩率，精度损失小于 0.5%）
- OCR 回退（公式/密集表格）：dots.ocr 或 Nougat
- VLM 回答器：自托管 Qwen3-VL-30B 或托管版 Gemini 2.5 Pro；InternVL3 作为备选
- 评估：ViDoRe v3 基准、M3DocVQA（多页推理）
- 查看器界面：Next.js 15，Canvas 叠加证据区域

## 动手搭建

1. **数据接入。** 遍历 10k 页 PDF 语料库，涵盖 10-K、科学论文和扫描文档。将每页渲染为 1536×2048 PNG。持久化 `{doc_id, page_num, image_path}`。

2. **嵌入。** 对每页图像运行 ColQwen2.5-v0.2。输出形状约为 2048 个图像块嵌入，维度 128。应用 DocPruner 保留信号最强的一半。写入 Vespa 多向量字段或 Qdrant 多向量。

3. **查询。** 对每个传入查询，使用查询塔进行词元级嵌入。对索引运行 MaxSim：对每个查询词元，取与页面图像块嵌入的点积最大值，求和。返回 top-k 页面。

4. **综合回答。** 将查询和 top-5 页面图像一起送入 Qwen3-VL-30B。提示词："仅基于所提供的页面作答。每个论断须以 (doc_id, page) 形式引用来源，并注明区域类型（图、表、段落）。"

5. **证据区域。** 对答案进行后处理，提取被引用的区域。若 VLM 输出了边界框（Qwen3-VL 可以），在查看器中将其渲染为叠加层。

6. **OCR 回退。** 对于被判定为公式密集型页面（基于图像方差的启发式规则），运行 Nougat 或 dots.ocr，将 OCR 文本作为图像的额外通道一并传入。

7. **评估。** 运行 ViDoRe v3（检索 nDCG@5）和 M3DocVQA（多页问答准确率）。在同一语料上对相同回答器运行 OCR 再文本流水线。产出内容类型 × 方案矩阵。

8. **界面。** 先用 Streamlit 搭建原型；再用 Next.js 15 构建生产级查看器，支持逐页证据区域叠加。

## 使用方式

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[检索]    top-5 页面，耗时 320ms（ColQwen2.5, MaxSim, Vespa）
[综合回答] qwen3-vl-30b，耗时 1.4s，引用 (form-10k-2024, p. 88) + (..., p. 92)
答案：
  EMEA 地区营业利润率从 18.2% 降至 16.8%，下降 140 个基点。
  引用: 10-K-2024.pdf p.88（表 4，分部门营业利润率）
        10-K-2024.pdf p.92（管理层讨论与分析，经营业绩）
[查看器]   打开 p.88 表 4，叠加高亮边界框
```

## 交付标准

`outputs/skill-doc-qa.md` 描述了交付物：一个视觉优先的多模态文档问答系统，针对特定语料库调优，并在 ViDoRe v3 上与 OCR 再文本基线进行对比评估。

| 权重 | 评判标准 | 衡量方式 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确率 | 与 OCR-文本基线及公开发布的排行榜对比的基准得分 |
| 20 | 证据区域定位 | 被引用区域中确实包含答案片段的占比 |
| 20 | 存储与延迟工程 | DocPruner 压缩率、索引 P95、回答 P95 |
| 20 | 多页推理 | 在人工标注的 100 题多页测试集上的准确率 |
| 15 | 源文件查阅体验 | 查看器清晰度、叠加保真度、并排对比工具 |
| **100** | | |

## 练习

1. 在相同语料上对比 ColQwen2.5-v0.2 和 ColQwen3-omni。哪些页面其中一个答对、另一个答错？在索引中添加"内容类型"标签以按类型路由。

2. 激进剪枝嵌入（75%、90%）。找到压缩悬崖：即 ViDoRe nDCG@5 跌至 OCR 基线以下的临界点。

3. 构建混合方案：并行运行 OCR 再文本和 ColQwen，用 RRF 融合，用交叉编码器重排序。混合方案是否优于任何单一方案？它在哪些场景帮助最大？

4. 将 Qwen3-VL-30B 更换为更小的 VLM（Qwen2.5-VL-7B）。测量精度/成本曲线。

5. 增加手写笔记支持。渲染手写语料库，用 ColQwen 嵌入，测量检索效果。与手写 OCR 流水线对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 后期交互（Late Interaction） | "ColPali 风格的检索" | 查询词元独立与页面图像块打分；MaxSim 聚合 |
| 多向量（Multi-Vector） | "逐图像块嵌入" | 每个文档有多个向量，而非一个池化向量 |
| MaxSim | "后期交互打分" | 对每个查询词元，取与文档向量的最大相似度；求和 |
| DocPruner | "图像块压缩" | 2026 年的剪枝技术，保留 50% 图像块而精度损失可忽略 |
| ViDoRe v3 | "文档检索基准" | 2026 年衡量视觉文档检索的标准基准 |
| 证据区域（Evidence Region） | "被引用的边界框" | 源页面上定位答案片段的边界框 |
| OCR 回退（OCR Fallback） | "公式通道" | 对公式或表格密集型页面，与视觉方案并联使用的文本流水线 |

## 延伸阅读

- [ColPali（Illuin Tech）仓库](https://github.com/illuin-tech/colpali) — 参考后期交互文档检索实现
- [ColPali 论文（arXiv:2407.01449）](https://arxiv.org/abs/2407.01449) — 基础方法论文
- [Hugging Face 上的 ColQwen 系列模型](https://huggingface.co/vidore) — 可直接上生产的检查点
- [M3DocRAG（Adobe）](https://arxiv.org/abs/2411.04952) — 多页多模态 RAG 基线
- [Vespa 多向量教程](https://docs.vespa.ai/en/colpali.html) — 参考部署栈
- [Qdrant 多向量支持](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — 备用索引
- [AstraDB 多向量](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — 备用托管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) — 支持公式的 OCR 回退方案
