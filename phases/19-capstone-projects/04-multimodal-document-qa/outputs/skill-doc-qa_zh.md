---
name: doc-qa
description: 在1万页上构建视觉优先的多模态文档问答系统，具备后期交互检索和证据区域引用。
version: 1.0.0
phase: 19
lesson: 04
tags: [capstone, multimodal, rag, colpali, colqwen, late-interaction, pdf]
---

给定PDF语料库（10-K、科学论文、扫描文档），构建一个管道，使用ColPali风格后期交互将页面索引为图像，并以页面级证据区域回答问题。

构建计划：

1. 用PyMuPDF以180 DPI将每个PDF页面渲染为1536x2048 PNG。
2. 用ColQwen2.5-v0.2或ColQwen3-omni嵌入每个页面。在Vespa、Qdrant multi-vector或AstraDB中存储多向量patch嵌入。
3. 应用DocPruner风格50% patch剪枝。验证在ViDoRe v3上准确率下降保持在0.5%以下。
4. 查询时：嵌入查询token；针对每个页面的patch计算MaxSim；排序top-k。
5. 用传递查询加top-5页面图像的Qwen3-VL-30B或Gemini 2.5 Pro合成。要求引用`(doc_id, page, region)`锚点。
6. 对于公式或表格繁重的页面，可选运行Nougat或dots.ocr作为文本通道并 alongside 图像输入。
7. 构建Next.js 15查看器，在源页面上以边界框覆盖证据区域。
8. 在ViDoRe v3和M3DocVQA上评估。生成内容类别×方法矩阵，比较vision-first与OCR-then-text在纯文本、表格、图表、手写和公式上的表现。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 准确率 | 匹配页面上与OCR-then-text基线的基准测试 |
| 20 | 证据区域定位 | 包含答案跨度的引用区域比例 |
| 20 | 存储和延迟工程 | DocPruner压缩、索引p95、答案p95低于2秒 |
| 20 | 多页推理 | 手工标记的100问题多页集上的准确率 |
| 15 | 源检查UX | 覆盖保真度、比较工具、逐页浏览器 |

硬性拒绝：
- 将OCR文本改造为单向量嵌入的OCR优先管道宣称为"视觉优先"。
- 任何丢弃patch级边界框因此无法渲染证据覆盖的系统。
- 未记录DocPruner设置就报告的存储数字。

拒绝规则：
- 拒绝在没有专门修订策略的情况下索引扫描法律合同。ColQwen嵌入会泄露内容。
- 拒绝针对用户未披露的语料库提供查询。审计跟踪对受监管领域是强制性的。
- 拒绝在未在同一语料库上运行两个管道的情况下与OCR-then-text比较。

输出：包含摄取管道、Vespa（或Qdrant multi-vector）配置、100问题多页评估集、查看器UI的仓库，以及一份包含内容类别×方法矩阵和针对2026年哪些内容类别仍偏好OCR-then-text的具体建议的撰写。
