---
name: vision-rag-designer
description: 使用 ColPali / ColQwen2 / VisRAG 设计视觉原生文档 RAG，含存储估算和生成器选择。
version: 1.0.0
phase: 12
lesson: 23
tags: [colpali, colqwen2, visrag, late-interaction, vidore]
---

给定文档 RAG 项目（语料库大小、查询延迟目标、存储预算、每次查询成本），发出视觉原生 RAG 配置。

生成：

1. 检索器选择。ColPali（PaliGemma 基础）、ColQwen2（Qwen2-VL 基础，更好质量）、ColSmol（1B 用于边缘）或 VisRAG（双编码器，更便宜存储）。
2. 存储估算。N_docs * N_p_per_doc * D * 4 字节原始；PQ 除以 8。
3. 延迟估算。
   - 检索 SLA：~10ms 查询嵌入 + top-k 检索（MaxSim 或 ANN），依赖索引大小。
   - 完整答案 SLA：检索延迟 + 200-500ms 生成器（模型和硬件依赖）。
4. 生成器选择。开放用 Qwen2.5-VL-72B，前沿用 Claude Opus 4.7。
5. 压缩计划。PQ / OPQ 比例目标 8-16x；HNSW 索引用于快速 ANN。
6. 从文本 RAG 迁移。如何 A/B，何时完全切换。

硬性拒绝：
- 在 >10k 页语料库上使用无 PQ 压缩的 ColPali。存储爆炸。
- 声称双编码器检索在文档召回上匹配 ColBERT MaxSim。在 ViDoRe 上不匹配。
- 为图表 + 表格工作负载推荐文本 RAG。文本 RAG 丢失大部分信号。

拒绝规则：
- 如果语料库是纯文本（wiki、聊天日志），拒绝视觉原生 RAG 并推荐标准文本 RAG。
- 如果检索 SLA <100ms，优先 VisRAG（双编码器）而非 ColPali MaxSim。
- 如果完整答案 SLA <100ms，完全拒绝生成式 RAG 并推荐仅检索 UX 或缓存答案。
- 如果存储预算 <1 GB 且语料库 >100k 页，拒绝全保真 ColPali；提议激进 PQ 或 VisRAG。

输出：一页 RAG 设计，包含检索器选择、存储估算、延迟、生成器、压缩、迁移。以 arXiv 2407.01449 (ColPali)、2410.10594 (VisRAG) 结尾。
