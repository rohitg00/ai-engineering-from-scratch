# 顶点项目 04 —— 多模态文档问答（视觉优先 PDF、表格、图表）

> 2026 年的文档问答前沿从 OCR-然后-文本转向视觉优先的迟交互。ColPali、ColQwen2.5 和 ColQwen3-omni 将每个 PDF 页面视为图像，用多向量迟交互嵌入它，并让查询直接关注补丁。在财务 10-K、科学论文和手写笔记上，这种模式以很大优势击败 OCR 优先。端到端构建管道，处理 1 万页，并发布与 OCR-然后-文本的并排对比。

**类型：** 顶点项目
**语言：** Python（管道）、TypeScript（查看器 UI）
**先决条件：** Phase 4（计算机视觉）、Phase 5（NLP）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 17（基础设施）
**涉及阶段：** P4 · P5 · P7 · P11 · P12 · P17
**时间：** 30 小时

## 问题

企业坐拥 OCR 管道损坏的 PDF：带有旋转表格的扫描 10-K、密集方程的科学论文、只有作为图像才有意义的图表、手写注释。将这些视为文本优先意味着丢失一半信号。2026 年的答案是原始页面图像上的迟交互多向量检索。ColPali（Illuin Tech）引入了它；ColQwen2.5-v0.2 和 ColQwen3-omni 推动了准确性。在 ViDoRe v3 上，视觉优先检索得分高于 OCR-然后-文本，幅度有意义——而且在图表、表格和手写体上差距扩大。

权衡是存储和延迟。ColQwen 嵌入每页约 2048 个补丁向量，不是一个单一的 1024 维向量。原始存储膨胀。DocPruner（2026）带来 50% 的剪枝，没有可测量的准确性损失。你将索引 1 万页，测量 ViDoRe v3 nDCG@5，在 2 秒内提供答案，并直接与 OCR-然后-文本基线进行比较。

## 概念

迟交互意味着每个查询 token 对每个补丁 token 评分，每个查询 token 的最大分数被求和。你获得细粒度匹配，而不需要单一的池化向量。多向量索引（Vespa、Qdrant 多向量或 AstraDB）存储每补丁嵌入，并在检索时运行 MaxSim。

回答器是一个视觉语言模型，接收查询加上检索到的 top-k 页面作为图像，并写出带证据区域（边界框或页面引用）的答案。Qwen3-VL-30B、Gemini 2.5 Pro 和 InternVL3 是 2026 年的前沿选择。对于方程和科学符号，OCR 后备（Nougat、dots.ocr）作为可选文本通道拼接进来。

评估是一个二维矩阵。一个轴：内容类型（纯文本段落、密集表格、条形/折线图、手写笔记、方程）。另一个轴：检索方法（视觉优先迟交互 vs OCR-然后-文本 vs 混合）。每个单元格获得 nDCG@5 和答案准确性。报告是可交付成果。

## 架构

```
PDF -> 页面渲染器（PyMuPDF，180 DPI）
           |
           v
  ColQwen2.5-v0.2 嵌入（每页多向量，约 2048 个补丁）
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
  带引用页码 + 证据区域的答案
           |
           v
  Streamlit / Next.js 查看器：源页上的高亮框
```

## 技术栈

- 页面渲染：PyMuPDF（fitz）180 DPI，纵向标准化
- 迟交互模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上的 vidore 团队）
- 索引：Vespa 带多向量字段，或 Qdrant 多向量，或 AstraDB 带 MaxSim
- 剪枝：DocPruner 2026 策略（保留高方差补丁，50% 压缩，< 0.5% 准确性损失）
- OCR 后备（方程 / 密集表格）：dots.ocr 或 Nougat
- VLM 回答器：自托管 Qwen3-VL-30B 或托管 Gemini 2.5 Pro；InternVL3 作为后备
- 评估：ViDoRe v3 基准，M3DocVQA 用于多页推理
- 查看器 UI：Next.js 15，带证据区域的画布叠加

## 构建它

1. **摄取。** 遍历 1 万页 PDF 语料库，涵盖 10-K、科学论文和扫描文档。将每页渲染为 1536x2048 PNG。持久化 `{doc_id, page_num, image_path}`。

2. **嵌入。** 在每页图像上运行 ColQwen2.5-v0.2。输出形状约 2048 个 dim 128 的补丁嵌入。应用 DocPruner 保留最高信号的一半。写入 Vespa 多向量字段或 Qdrant 多向量。

3. **查询。** 对于每个传入查询，用查询塔嵌入（token 级嵌入）。针对索引运行 MaxSim：对于每个查询 token，取页面补丁嵌入上的最大点积，求和。返回 top-k 页面。

4. **合成。** 用查询和前 5 页图像调用 Qwen3-VL-30B。提示："仅使用提供的页面回答。通过 (doc_id, page) 引用每个声明，并命名区域（图、表、段落）。"

5. **证据区域。** 后处理答案以提取引用区域。如果 VLM 发出边界框（Qwen3-VL 确实如此），在查看器中将其渲染为叠加层。

6. **OCR 后备。** 对于被识别为方程密集（图像方差启发式）的页面，运行 Nougat 或 dots.ocr，并将 OCR 文本作为图像旁边的额外通道传递。

7. **评估。** 运行 ViDoRe v3（检索 nDCG@5）和 M3DocVQA（多页 QA 准确性）。也在相同语料库上用相同合成器运行 OCR-然后-文本管道。生成内容类型 × 方法矩阵。

8. **UI。** 首先 Streamlit 原型；Next.js 15 生产查看器，带逐页证据区域叠加。

## 使用它

```
$ doc-qa ask "EMEA 部门 2024 年营业利润率变化是多少？"
[检索]   320 毫秒内 top-5 页面（ColQwen2.5，MaxSim，Vespa）
[合成]      qwen3-vl-30b，1.4 秒，引用 (form-10k-2024, p. 88) + (..., p. 92)
答案：
  EMEA 营业利润率从 18.2% 移动到 16.8%，下降 140 个基点。
  引用：10-K-2024.pdf p.88（表 4，部门营业利润率）
         10-K-2024.pdf p.92（管理层讨论与分析，经营业绩）
[查看器]     打开，p.88 表 4 上叠加高亮边界框
```

## 交付它

`outputs/skill-doc-qa.md` 描述可交付成果：一个视觉优先的多模态文档问答系统，针对特定语料库调整，并在 ViDoRe v3 上与 OCR-然后-文本基线进行评估。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确性 | 基准数字与 OCR 文本基线和已发布排行榜对比 |
| 20 | 证据区域锚定 | 实际包含答案跨度的引用区域比例 |
| 20 | 存储和延迟工程 | DocPruner 压缩比、索引 p95、答案 p95 |
| 20 | 多页推理 | 手工标记的 100 问题多页集上的准确性 |
| 15 | 源检查用户体验 | 查看器清晰度、叠加保真度、并排比较工具 |
| **100** | | |

## 练习

1. 在相同语料库上测量 ColQwen2.5-v0.2 与 ColQwen3-omni。一个做对了哪些页面，另一个错过了？向索引添加"内容类别"标签以按类型路由。

2. 积极剪枝嵌入（75%、90%）。找到压缩悬崖：ViDoRe nDCG@5 低于 OCR 基线的点。

3. 构建混合：并行运行 OCR-然后-文本和 ColQwen，用 RRF 融合，用交叉编码器重新排序。混合是否单独击败任一个？它在何处帮助最大？

4. 将 Qwen3-VL-30B 换成较小的 VLM（Qwen2.5-VL-7B）。测量准确性-每美元曲线。

5. 添加手写笔记支持。渲染手写语料库，用 ColQwen 嵌入，测量检索。与手写 OCR 管道比较。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 迟交互 | "ColPali 风格检索" | 查询 token 独立对页面补丁评分；MaxSim 聚合 |
| 多向量 | "每补丁嵌入" | 每个文档有许多向量，不是一个池化向量 |
| MaxSim | "迟交互评分" | 对于每个查询 token，取文档向量上的最大相似度；求和 |
| DocPruner | "补丁压缩" | 2026 年剪枝，保留 50% 补丁，准确性损失可忽略 |
| ViDoRe v3 | "文档检索基准" | 2026 年测量视觉文档检索的标准 |
| 证据区域 | "引用边界框" | 源页上定位答案跨度的边界框 |
| OCR 后备 | "方程通道" | 与视觉并行使用的文本管道，用于方程或表格密集页面 |

## 延伸阅读

- [ColPali（Illuin Tech）仓库](https://github.com/illuin-tech/colpali) —— 参考迟交互文档检索
- [ColPali 论文 (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) —— 基础方法论文
- [Hugging Face 上的 ColQwen 家族](https://huggingface.co/vidore) —— 生产就绪检查点
- [M3DocRAG（Adobe）](https://arxiv.org/abs/2411.04952) —— 多页多模态 RAG 基线
- [Vespa 多向量教程](https://docs.vespa.ai/en/colpali.html) —— 参考服务栈
- [Qdrant 多向量支持](https://qdrant.tech/documentation/concepts/vectors/#multivectors) —— 替代索引
- [AstraDB 多向量](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) —— 替代托管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) —— 支持方程的 OCR 后备
