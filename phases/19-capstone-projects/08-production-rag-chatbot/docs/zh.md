# 顶点项目 08 —— 受监管垂直领域的生产 RAG 聊天机器人

> Harvey、Glean、Mendable 和 LlamaCloud 在 2026 年都运行相同的生产形态。用 docling 或 Unstructured 和 ColPali 进行视觉摄取。混合搜索。用 bge-reranker-v2-gemma 重新排序。用 Claude Sonnet 4.7 合成，提示缓存命中率 60-80%。用 Llama Guard 4 和 NeMo Guardrails 防护。用 Langfuse 和 Phoenix 监控。在 200 问题的黄金集上用 RAGAS 评分。在受监管领域（法律、临床、保险）构建一个，顶点项目是通过黄金集、红队和漂移仪表板。

**类型：** 顶点项目
**语言：** Python（管道 + API）、TypeScript（聊天 UI）
**先决条件：** Phase 5（NLP）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 17（基础设施）、Phase 18（安全）
**涉及阶段：** P5 · P7 · P11 · P12 · P17 · P18
**时间：** 30 小时

## 问题

受监管领域 RAG（法律合同、临床试验协议、保险政策）是 2026 年最广泛交付的生产形态，因为投资回报率明显且风险具体。Harvey（Allen & Overy）为法律构建。Mendable 交付开发者文档版本。Glean 覆盖企业搜索。模式是：高保真摄取、混合检索并重新排序、带引用强制和提示缓存的合成、多层安全防护、持续监控漂移。

困难的部分不是模型。它们是司法管辖区感知合规（HIPAA、GDPR、SOC2）、引用级可审计性、成本控制（提示缓存在命中率高时购买 60-90% 折扣）、通过 RAGAS 忠实度的幻觉检测，以及源文档更新而索引未跟上时的漂移检测。这个顶点项目要求你在 200 问题黄金集上交付所有内容，并附带红队套件。

## 概念

管道有两面。**摄取**：docling 或 Unstructured 解析结构化文档；ColPali 处理视觉丰富的文档；块获得摘要、标签和基于角色的访问标签。向量进入 pgvector + pgvectorscale（5000 万向量以下）或 Qdrant Cloud；稀疏 BM25 并行运行。**对话**：LangGraph 处理记忆和多轮；每个查询运行混合检索，用 bge-reranker-v2-gemma-2b 重新排序，用 Claude Sonnet 4.7（提示缓存）合成，通过 Llama Guard 4 和 NeMo Guardrails 传递输出，并发出引用锚定的响应。

评估栈有四层。**黄金集**（200 个带引用的标记 Q/A）用于正确性。**红队**（越狱、PII 提取尝试、域外问题）用于安全性。**RAGAS** 用于每轮自动忠实度/答案相关性/上下文精度。**漂移仪表板**（Arize Phoenix）每周监控检索质量和幻觉分数。

提示缓存是成本杠杆。Claude 4.5+ 和 GPT-5+ 支持缓存系统提示 + 检索上下文。在 60-80% 命中率下，每次查询成本下降 3-5 倍。管道必须设计为稳定前缀（系统提示 + 重新排序的上下文优先）以实现高缓存命中率。

## 架构

```
文档（合同、协议、政策）
      |
      v
docling / Unstructured 解析 + ColPali 用于视觉
      |
      v
块 + 摘要 + 角色标签 + 司法管辖区标签
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
查询 + 角色 + 司法管辖区
      |
      v
LangGraph 对话智能体
   +--- 检索（混合）
   +--- 按角色 + 司法管辖区过滤
   +--- 重新排序（bge-reranker-v2-gemma-2b 或 Voyage rerank-2）
   +--- 合成（Claude Sonnet 4.7，提示缓存）
   +--- 防护（Llama Guard 4 + NeMo Guardrails + Presidio 输出 PII 清洗）
   +--- 引用 + 返回
      |
      v
评估：
  RAGAS 忠实度 / answer_relevance / context_precision（在线）
  Langfuse 注释队列（采样）
  Arize Phoenix 漂移（每周）
  红队套件（发布前）
```

## 技术栈

- 摄取：Unstructured.io 或 docling 用于结构化文档；ColPali 用于视觉丰富的 PDF
- 向量数据库：pgvector + pgvectorscale，5000 万向量以下；否则 Qdrant Cloud
- 稀疏：Tantivy BM25，带字段权重
- 编排：LlamaIndex Workflows（摄取）+ LangGraph（对话）
- 重新排序器：自托管 bge-reranker-v2-gemma-2b 或托管 Voyage rerank-2
- LLM：Claude Sonnet 4.7，带提示缓存；后备自托管 Llama 3.3 70B
- 评估：RAGAS 0.2 在线，DeepEval 用于幻觉和越狱套件
- 可观察性：自托管 Langfuse，带注释队列；Arize Phoenix 用于漂移
- 护栏：Llama Guard 4 输入/输出分类器，NeMo Guardrails v0.12 策略，Presidio PII 清洗
- 合规：块上的基于角色访问标签；GDPR/HIPAA 的司法管辖区标签

## 构建它

1. **摄取。** 用 Unstructured 或 docling 解析你的语料库（严肃构建 1000-10000 文档）。对于扫描/视觉重的页面，通过 ColPali 路由。生成带摘要、角色标签、司法管辖区标签的块。

2. **索引。** 密集嵌入（Voyage-3 或 Nomic-embed-v2）到 pgvector + pgvectorscale。通过 Tantivy 的 BM25 侧索引。角色和司法管辖区过滤器作为负载。

3. **混合检索。** 首先按角色+司法管辖区过滤；然后并行密集 + BM25；用倒数排名融合合并；top-20 到重新排序器；top-5 到合成器。

4. **带提示缓存的合成。** 系统提示 + 静态策略在缓存头中；重新排序的上下文作为缓存扩展；用户问题作为未缓存后缀。稳态目标 60-80% 缓存命中率。

5. **护栏。** Llama Guard 4 在输入上；NeMo Guardrails 轨道阻止域外问题或策略禁止主题；Presidio 清洗输出中的意外 PII；引用强制后过滤器。

6. **黄金集。** 200 个由领域专家标记的 Q/A 对，带（答案、引用）。在精确引用匹配、答案正确性、忠实度（RAGAS）上评分智能体。

7. **红队。** 50 个对抗性提示：越狱（PAIR、TAP）、PII 提取尝试、域外、跨司法管辖区泄露。用通过/失败和严重性评分。

8. **漂移仪表板。** Arize Phoenix 每周跟踪检索质量（nDCG、引用忠实度）。5% 下降时警报。

9. **成本报告。** Langfuse：提示缓存命中率、每次查询 token、按阶段划分的 $/查询 细分。

## 使用它

```
$ chat --role=analyst --jurisdiction=GDPR
> 根据我们的合同，欧盟用户配置文件的数据保留义务是什么？
[检索]  混合 top-20 过滤到 GDPR + analyst-role
[重新排序]    保留 top-5
[合成]     claude-sonnet-4.7，缓存命中 74%，0.8 秒
答案：
  合同（2024-03-11 主服务协议第 12.4 节）
  规定根据 GDPR 第 17 条，在终止后 30 天内删除欧盟用户配置文件。
  DPA 修正案（DPA-v2.1，第 5 节）将此延长至"受限"类别数据的 14 天。
  引用：[MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 交付它

`outputs/skill-production-rag.md` 描述可交付成果。受监管领域聊天机器人，带合规标签部署，通过评分标准，带实时漂移监控观察。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | RAGAS 忠实度 + 答案相关性 | 黄金集（200 Q/A）上的在线分数 |
| 20 | 引用正确性 | 带有可验证源锚点的答案比例 |
| 20 | 护栏覆盖率 | Llama Guard 4 通过率 + 越狱套件结果 |
| 20 | 成本 / 延迟工程 | 提示缓存命中率、p95 延迟、$/查询 |
| 15 | 漂移监控仪表板 | Phoenix 实时仪表板，带每周检索质量趋势 |
| **100** | | |

## 练习

1. 在不同司法管辖区（例如，HIPAA  alongside GDPR）下构建第二个语料库切片。演示角色+司法管辖区过滤在 20 问题跨司法管辖区探测上防止跨泄露。

2. 测量一周生产流量的提示缓存命中率。识别哪些查询打破缓存前缀。重构。

3. 添加多轮记忆，带 10k token 摘要缓冲区。测量随着对话增长忠实度是否下降。

4. 将 Claude Sonnet 4.7 换成自托管 Llama 3.3 70B。测量 $/查询 和忠实度差异。

5. 添加"不确定"模式：如果顶部重新排序分数低于阈值，智能体说"我没有自信的引用"而不是回答。测量虚假信心减少。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 提示缓存 | "缓存的系统 + 上下文" | Claude/OpenAI 功能：缓存前缀 token 命中时折扣 60-90% |
| RAGAS | "RAG 评估器" | 忠实度、答案相关性、上下文精度的自动评分 |
| 黄金集 | "标记的评估" | 200+ 专家标记的 Q/A，带引用；地面真相 |
| 司法管辖区标签 | "合规标签" | 附加到块的 GDPR/HIPAA/SOC2 范围；由检索过滤器强制执行 |
| 引用忠实度 | "有根据的答案率" | 由可检索源跨度支持的声明比例 |
| 漂移 | "检索质量衰减" | nDCG 或引用分数的每周变化；警报阈值 5% |
| 红队 | "对抗性评估" | 发布前越狱、PII 提取、域外探测 |

## 延伸阅读

- [Harvey AI](https://www.harvey.ai) —— 参考法律生产栈
- [Glean 企业搜索](https://www.glean.com) —— 参考企业规模 RAG
- [Mendable 文档](https://mendable.ai) —— 开发者文档 RAG 参考
- [LlamaCloud 解析 + 索引](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) —— 托管摄取
- [Anthropic 提示缓存](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) —— 成本杠杆参考
- [RAGAS 0.2 文档](https://docs.ragas.io/) —— 经典 RAG 评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) —— 参考漂移可观察性
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) —— 2026 年安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) —— 策略轨道框架
