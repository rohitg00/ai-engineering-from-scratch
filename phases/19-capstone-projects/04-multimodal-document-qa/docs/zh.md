# 综合项目 04 — 多模态文档 QA（视觉优先 PDF、表格、图表）

> 2026 年文档 QA 前沿从 OCR 后接文本转向视觉优先的后期交互（late interaction）。ColPali、ColQwen2.5 和 ColQwen3-omni 将每个 PDF 页面视为图像，用多向量后期交互嵌入它，并让查询直接关注图像块。在金融 10-K、科学论文和手写笔记上，这种模式以较大优势击败 OCR 优先方法。在 1 万页上端到端构建管道，并发布与 OCR 后接文本的并排对比。

**类型：** 综合项目
**语言：** Python（管道）、TypeScript（查看器 UI）
**前置条件：** 第 4 阶段（计算机视觉）、第 5 阶段（NLP）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 12 阶段（多模态）、第 17 阶段（基础设施）
**涉及阶段：** P4 · P5 · P7 · P11 · P12 · P17
**时间：** 30 小时

## 问题描述

企业坐拥被 OCR 管道破坏的 PDF：带有旋转表格的扫描版 10-K、充满公式的科学论文、仅作为图像才有意义的图表、手写注释。将这些视为文本优先意味着丢失一半信号。2026 年的答案是对原始页面图像进行后期交互多向量检索。ColPali（Illuin Tech）引入了它；ColQwen2.5-v0.2 和 ColQwen3-omni 提高了准确性。在 ViDoRe v3 上，视觉优先检索在有意义差距上超过 OCR 后接文本——在图表、表格和手写方面差距进一步扩大。

权衡是存储和延迟。一个 ColQwen 嵌入每页约 2048 个块向量，而非单个 1024 维向量。原始存储膨胀。DocPruner（2026）带来 50% 的剪枝而不损失可测量的准确性。你将索引 1 万页，测量 ViDoRe v3 nDCG@5，在 2 秒内提供回答，并直接与 OCR 后接文本基线进行比较。

## 核心概念

后期交互意味着每个查询 token 对每个块 token 评分，每个查询 token 的最高分数被求和。你获得细粒度匹配，而无需单个池化向量。多向量索引（Vespa、Qdrant 多向量或 AstraDB）存储每个块的嵌入，并在检索时运行 MaxSim。

回答者是一个视觉语言模型，它接收查询加上检索到的 top-k 页面作为图像，并撰写带有证据区域（边界框或页面引用）的回答。Qwen3-VL-30B、Gemini 2.5 Pro 和 InternVL3 是 2026 年的前沿选择。对于公式和科学符号，OCR 后备（Nougat、dots.ocr）作为可选文本通道被拼接进来。

评估是一个二维矩阵。一个轴：内容类型（纯文本段落、密集表格、条形/折线图、手写笔记、公式）。另一个轴：检索方法（视觉优先后期交互 vs OCR 后接文本 vs 混合）。每个单元格获得 nDCG@5 和回答准确性。报告是可交付成果。

## 架构

```
PDF -> 页面渲染器（PyMuPDF，180 DPI）
           |
           v
  ColQwen2.5-v0.2 嵌入（每页多向量，约 2048 个块）
           |
           +------> DocPruner 50% 压缩
           |
           v
   多向量索引（Vespa 或 Qdrant 多向量）
           |
query ----+----> 检索 top-k 页面（MaxSim）
           |
           v
  VLM 回答器：Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    输入：查询 + top-k 页面图像 + 可选 OCR 文本
           |
           v
  带有引用页码 + 证据区域的回答
           |
           v
  Streamlit / Next.js 查看器：源页面上的高亮框
```

## 技术栈

- 页面渲染：PyMuPDF（fitz），180 DPI，纵向标准化
- 后期交互模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上的 vidore 团队）
- 索引：带有多向量字段的 Vespa，或 Qdrant 多向量，或带有 MaxSim 的 AstraDB
- 剪枝：DocPruner 2026 策略（保留高方差块，< 0.5% 准确性损失下实现 50% 压缩）
- OCR 后备（公式 / 密集表格）：dots.ocr 或 Nougat
- VLM 回答器：自托管的 Qwen3-VL-30B 或托管的 Gemini 2.5 Pro；InternVL3 作为后备
- 评估：ViDoRe v3 基准测试、用于多页推理的 M3DocVQA
- 查看器 UI：Next.js 15，带有用于证据区域的 canvas 叠加层

## 构建步骤

1. **摄取。** 遍历 1 万页 PDF 页面语料库，涵盖 10-K、科学论文和扫描文档。将每页渲染为 1536x2048 PNG。持久化 `{doc_id, page_num, image_path}`。

2. **嵌入。** 在每页图像上运行 ColQwen2.5-v0.2。输出形状约 2048 个维度为 128 的块嵌入。应用 DocPruner 保留最高信号的半数。写入 Vespa 多向量字段或 Qdrant 多向量。

3. **查询。** 对于每个传入查询，使用查询塔（token 级嵌入）进行嵌入。针对索引运行 MaxSim：对于每个查询 token，取页面块嵌入上的最大点积，求和。返回 top-k 页面。

4. **合成。** 使用查询以及 top-5 页面图像调用 Qwen3-VL-30B。提示词："仅使用提供的页面回答。按 (doc_id, page) 引用每个声明，并命名区域（图、表、段落）。"

5. **证据区域。** 后处理回答以提取引用的区域。如果 VLM 发出边界框（Qwen3-VL 会），在查看器中将它们渲染为叠加层。

6. **OCR 后备。** 对于被识别为公式密集的页面（图像方差启发式），运行 Nougat 或 dots.ocr，并将 OCR 文本作为图像旁边的额外通道传递。

7. **评估。** 运行 ViDoRe v3（检索 nDCG@5）和 M3DocVQA（多页 QA 准确性）。在同一语料库上用同一合成器运行 OCR 后接文本管道。生成内容类型 × 方法矩阵。

8. **UI。** 先构建 Streamlit 原型；Next.js 15 生产查看器，带有逐页证据区域叠加层。

## 使用示例

```
$ doc-qa ask "2024 年 EMEA 分部营业利润率变化是多少？"
[retrieve]   320ms 内 top-5 页面（ColQwen2.5，MaxSim，Vespa）
[synth]      qwen3-vl-30b，1.4s，引用（form-10k-2024，p. 88）+（...，p. 92）
回答：
  EMEA 营业利润率从 18.2% 移动到 16.8%，下降 140 个基点。
  引用：10-K-2024.pdf p.88（表 4，分部营业利润率）
         10-K-2024.pdf p.92（MD&A，营运表现）
[viewer]     打开并叠加在 p.88 表 4 上的高亮边界框
```

## 交付成果

`outputs/skill-doc-qa.md` 描述了可交付成果：一个针对特定语料库调整的视觉优先多模态文档 QA 系统，并在 ViDoRe v3 上与 OCR 后接文本基线进行评估。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确性 | 基准测试数字 vs OCR 文本基线和已发布排行榜 |
| 20 | 证据区域定位 | 实际包含回答跨度（span）的引用区域比例 |
| 20 | 存储和延迟工程 | DocPruner 压缩比、索引 p95、回答 p95 |
| 20 | 多页推理 | 手工标注的 100 问题多页集上的准确性 |
| 15 | 源检查 UX | 查看器清晰度、叠加保真度、并排比较工具 |
| **100** | | |

## 练习

1. 在同一语料库上测量 ColQwen2.5-v0.2 与 ColQwen3-omni。哪些页面一个做对了而另一个错过了？向索引添加"内容类别"标签以按类型路由。

2. 激进地剪枝嵌入（75%、90%）。找到压缩悬崖：ViDoRe nDCG@5 跌破 OCR 基线的点。

3. 构建一个混合方案：并行运行 OCR 后接文本和 ColQwen，用 RRF 融合，用交叉编码器重新排序。混合方案是否击败任一单独方案？它在哪里帮助最大？

4. 将 Qwen3-VL-30B 换为更小的 VLM（Qwen2.5-VL-7B）。测量准确性与代价曲线。

5. 添加手写笔记支持。渲染手写语料库，用 ColQwen 嵌入，测量检索。与手写 OCR 管道进行比较。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 后期交互 | "ColPali 风格检索" | 查询 token 独立地对页面块评分；MaxSim 聚合 |
| 多向量 | "每块嵌入" | 每个文档有多个向量，而非一个池化向量 |
| MaxSim | "后期交互评分" | 对于每个查询 token，取文档向量上的最大相似度；求和 |
| DocPruner | "块压缩" | 2026 年剪枝，保留 50% 的块，准确性损失可忽略 |
| ViDoRe v3 | "文档检索基准" | 2026 年测量视觉文档检索的标准 |
| 证据区域 | "引用边界框" | 定位回答跨度的源页面上的 bbox |
| OCR 后备 | "公式通道" | 与视觉一起用于公式或表格密集页面的文本管道 |

## 延伸阅读

- [ColPali（Illuin Tech）仓库](https://github.com/illuin-tech/colpali) — 参考后期交互文档检索
- [ColPali 论文（arXiv:2407.01449）](https://arxiv.org/abs/2407.01449) — 基础方法论文
- [Hugging Face 上的 ColQwen 系列](https://huggingface.co/vidore) — 生产就绪检查点
- [M3DocRAG（Adobe）](https://arxiv.org/abs/2411.04952) — 多页多模态 RAG 基线
- [Vespa 多向量教程](https://docs.vespa.ai/en/colpali.html) — 参考服务栈
- [Qdrant 多向量支持](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — 备选索引
- [AstraDB 多向量](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — 备选托管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) — 支持公式的 OCR 后备
