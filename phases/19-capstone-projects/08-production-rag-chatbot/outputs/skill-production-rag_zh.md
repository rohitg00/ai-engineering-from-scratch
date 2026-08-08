---
name: production-rag
description: 部署受监管领域的RAG聊天机器人，具备角色+管辖区过滤、提示缓存、护栏和实时漂移监控。
version: 1.0.0
phase: 19
lesson: 08
tags: [capstone, rag, chatbot, regulated, llama-guard, nemo-guardrails, ragas, langfuse]
---

给定受监管领域语料库（法律合同、临床试验协议、保险政策或类似），部署一个以可验证引用回答、尊重角色和管辖区访问策略并监控漂移的聊天机器人。

构建计划：

1. 用docling或Unstructured解析语料库；视觉丰富文档通过ColPali路由。发出带角色和管辖区标签的块。
2. 密集索引（Voyage-3或Nomic-embed-v2）到pgvector + pgvectorscale；通过Tantivy的稀疏BM25。
3. 连接LangGraph对话代理：retrieve（按角色+管辖区过滤、混合dense+BM25、倒数排名融合）、rerank（bge-reranker-v2-gemma-2b或Voyage rerank-2）、synth（Claude Sonnet 4.7，带提示缓存）。
4. 用稳定前缀组装提示：系统前言 -> 策略块 -> 重排序上下文 -> 用户查询。目标60-80%提示缓存命中率。
5. 护栏：输入和输出的Llama Guard 4、NeMo Guardrails v0.12的离域和策略禁止问题护栏、输出的Presidio PII清理、引用强制后过滤。
6. 构建200问题专家标记黄金集，含（答案、引用）。在精确引用匹配、答案正确性、RAGAS忠实度上评分。
7. 构建50提示红队（PAIR、TAP、PII提取、离域、跨管辖区探测）。
8. Arize Phoenix漂移仪表板，每周跟踪检索nDCG和引用忠实度；下降5%时告警。
9. Langfuse成本报告：提示缓存命中率、每查询token、每阶段$/查询。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | RAGAS忠实度 + 答案相关性 | 200问题黄金集上的在线分数 |
| 20 | 引用正确性 | 带可验证源锚点的答案比例 |
| 20 | 护栏覆盖率 | Llama Guard 4通过率 + 越狱套件结果 |
| 20 | 成本/延迟工程 | 提示缓存命中率、p95延迟、$/查询 |
| 15 | 漂移监控仪表板 | 带每周检索质量趋势的实时Phoenix仪表板 |

硬性拒绝：
- 任何泄露跨管辖区数据的聊天机器人。角色+管辖区过滤必须在检索前强制执行，而非之后。
- 破坏缓存前缀的合成提示（在系统和上下文之间重新排序策略）。会摧毁缓存经济性。
- 没有记录红队运行的护栏配置。
- 没有引用的答案；没有可验证锚点的引用。

拒绝规则：
- 拒绝在没有每个块管辖区标签的情况下在受监管领域部署。
- 拒绝在专家标记黄金集问题上训练检索。污染会摧毁评估可信度。
- 拒绝在没有README中明确SOC2/HIPAA/GDPR适用性矩阵的情况下声称"合规"。

输出：包含摄取管道、LangGraph对话代理、200问题黄金集、50提示红队、Phoenix漂移仪表板、Langfuse成本仪表板的仓库，以及一份说明观察到的前三大引用断裂模式及每个的检索或提示修复的撰写。
