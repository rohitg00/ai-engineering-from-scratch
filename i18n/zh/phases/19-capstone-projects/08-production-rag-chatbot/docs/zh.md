# 毕业项目 08 — 面向受监管行业的生产级 RAG 聊天机器人

> Harvey、Glean、Mendable 和 LlamaCloud 在 2026 年运行的都是同一种生产形态。使用 docling 或 Unstructured 摄取文档，用 ColPali 处理视觉内容。混合检索。用 bge-reranker-v2-gemma 重排序。用 Claude Sonnet 4.7 进行合成，prompt 缓存命中率达 60-80%。用 Llama Guard 4 和 NeMo Guardrails 做防护。用 Langfuse 和 Phoenix 做监控。在 200 题黄金集上用 RAGAS 评分。在受监管领域（法律、临床、保险）构建一个系统，毕业标准是黄金集、红队测试和漂移仪表盘全部通过。

**类型：** 毕业项目
**语言：** Python（pipeline + API）、TypeScript（聊天 UI）
**先修内容：** 阶段 5（NLP）、阶段 7（transformers）、阶段 11（LLM 工程）、阶段 12（多模态）、阶段 17（基础设施）、阶段 18（安全）
**涉及的阶段：** P5 · P7 · P11 · P12 · P17 · P18
**时间：** 30 小时

## 问题

受监管领域的 RAG（法律合同、临床试验方案、保险条款）是 2026 年投产最多的生产形态，因为 ROI 明确、风险具体。Harvey（Allen & Overy）在法律领域构建了它。Mendable 提供开发者文档版本。Glean 覆盖企业搜索。这个模式是：高保真摄取、混合检索加重排序、带引用强制和 prompt 缓存的合成、多层安全防护、持续监控漂移。

难点不在模型本身，而在于管辖权感知的合规（HIPAA、GDPR、SOC2）、引用级可审计性、成本控制（命中率高时 prompt 缓存可带来 60-90% 的折扣）、通过 RAGAS faithfulness 检测幻觉，以及源文档更新而索引未同步时的漂移检测。本毕业项目要求你在 200 题黄金集上交付全部功能，并附带一套红队测试。

## 概念

pipeline 有两侧。**摄取**：docling 或 Unstructured 解析结构化文档；ColPali 处理视觉丰富的文档；chunk 获得摘要、标签和基于角色的访问标签。向量存入 pgvector + pgvectorscale（5000 万向量以内）或 Qdrant Cloud；稀疏 BM25 并行运行。**对话**：LangGraph 处理记忆和多轮对话；每次查询执行混合检索、用 bge-reranker-v2-gemma-2b 重排序、用 Claude Sonnet 4.7（prompt 缓存）合成、输出经 Llama Guard 4 和 NeMo Guardrails 防护，并生成带引用锚点的回答。

评估栈有四层。**黄金集**（200 条带引用的标注 Q/A）用于正确性。**红队**（越狱、PII 提取尝试、域外问题）用于安全性。**RAGAS** 用于逐轮自动评估 faithfulness / 答案相关性 / context precision。**漂移仪表盘**（Arize Phoenix）每周监控检索质量和幻觉分数。

Prompt 缓存是成本杠杆。Claude 4.5+ 和 GPT-5+ 支持缓存系统提示 + 检索到的上下文。在 60-80% 的命中率下，每查询成本下降 3-5 倍。pipeline 必须围绕稳定前缀（系统提示 + 重排序后的上下文放在最前）设计，以实现高缓存命中率。

## 架构

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## 技术栈

- 摄取：Unstructured.io 或 docling 处理结构化文档；ColPali 处理视觉丰富的 PDF
- 向量数据库：5000 万向量以内用 pgvector + pgvectorscale；否则用 Qdrant Cloud
- 稀疏检索：带字段权重的 Tantivy BM25
- 编排：LlamaIndex Workflows（摄取）+ LangGraph（对话）
- 重排序器：bge-reranker-v2-gemma-2b 自托管，或托管的 Voyage rerank-2
- LLM：带 prompt 缓存的 Claude Sonnet 4.7；备选自托管 Llama 3.3 70B
- 评估：RAGAS 0.2 在线评估，DeepEval 用于幻觉和越狱测试套件
- 可观测性：自托管 Langfuse 带标注队列；Arize Phoenix 用于漂移监控
- 防护：Llama Guard 4 输入/输出分类器、NeMo Guardrails v0.12 策略、Presidio PII 清洗
- 合规：chunk 上的基于角色的访问标签；用于 GDPR/HIPAA 的管辖权标签

```figure
canary-rollout
```

## 构建步骤

1. **摄取。** 用 Unstructured 或 docling 解析你的语料库（认真构建需 1000-10000 份文档）。扫描版/视觉密集的页面经 ColPali 处理。生成带摘要、角色标签、管辖权标签的 chunk。

2. **索引。** 稠密向量（Voyage-3 或 Nomic-embed-v2）存入 pgvector + pgvectorscale。BM25 侧索引经 Tantivy。角色和管辖权过滤条件作为 payload。

3. **混合检索。** 先按角色+管辖权过滤；再并行稠密检索 + BM25；用倒数排名融合合并；top-20 送入重排序器；top-5 送入合成。

4. **带 prompt 缓存的合成。** 系统提示 + 静态策略放入缓存头；重排序后的上下文作为缓存扩展；用户问题作为未缓存的尾部。目标稳态缓存命中率 60-80%。

5. **防护。** 输入经 Llama Guard 4；NeMo Guardrails 的 rail 拦截域外问题或策略禁止的话题；Presidio 清洗输出中意外出现的 PII；引用强制后置过滤。

6. **黄金集。** 200 条 Q/A，由领域专家标注（答案、引用）。按精确引用匹配、答案正确性、faithfulness（RAGAS）给 agent 打分。

7. **红队。** 50 条对抗性提示：越狱（PAIR、TAP）、PII 窃取尝试、域外问题、跨管辖权泄露。按通过/失败和严重性评分。

8. **漂移仪表盘。** Arize Phoenix 每周跟踪检索质量（nDCG、引用 faithfulness）。下降 5% 时告警。

9. **成本报告。** Langfuse：prompt 缓存命中率、每查询 token 数、按阶段拆解的 $/query。

## 使用

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 交付

`outputs/skill-production-rag.md` 描述了交付物。一个部署的受监管领域聊天机器人，带合规标签、通过评分标准、并有实时漂移监控。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | RAGAS faithfulness + 答案相关性 | 黄金集（200 Q/A）上的在线分数 |
| 20 | 引用正确性 | 带可验证来源锚点的答案比例 |
| 20 | 防护覆盖 | Llama Guard 4 通过率 + 越狱套件结果 |
| 20 | 成本 / 延迟工程 | prompt 缓存命中率、p95 延迟、$/query |
| 15 | 漂移监控仪表盘 | Phoenix 实时仪表盘，含每周检索质量趋势 |
| **100** | | |

## 练习

1. 在不同管辖权下构建第二个语料切片（例如 GDPR 旁的 HIPAA）。通过 20 题跨管辖权探针演示角色+管辖权过滤防止跨泄露。

2. 测量一周生产流量中的 prompt 缓存命中率。识别哪些查询破坏了缓存前缀。重构。

3. 添加带 10k-token 摘要缓冲区的多轮记忆。测量随着对话变长 faithfulness 是否下降。

4. 将 Claude Sonnet 4.7 换成自托管 Llama 3.3 70B。测量 $/query 和 faithfulness 差异。

5. 添加“不确定”模式：若 top 重排序分数低于阈值，agent 回答“我没有可信的引用”而不是作答。测量虚假置信度的降低。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Prompt 缓存 | “缓存系统 + 上下文” | Claude/OpenAI 特性：命中时缓存前缀 token 折扣 60-90% |
| RAGAS | “RAG 评估器” | 自动评估 faithfulness、答案相关性、context precision |
| 黄金集 | “标注评估” | 200+ 条专家标注的带引用 Q/A；即 ground truth |
| 管辖权标签 | “合规标签” | 附加到 chunk 上的 GDPR/HIPAA/SOC2 范围；由检索过滤器强制执行 |
| 引用 faithfulness | “有据回答率” | 有可检索来源片段支撑的声明比例 |
| 漂移 | “检索质量衰减” | nDCG 或引用分数的每周变化；告警阈值 5% |
| 红队 | “对抗评估” | 发布前的越狱、PII 提取、域外探针 |

## 延伸阅读

- [Harvey AI](https://www.harvey.ai) — 法律领域生产栈参考
- [Glean 企业搜索](https://www.glean.com) — 企业级 RAG 参考
- [Mendable 文档](https://mendable.ai) — 开发者文档 RAG 参考
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) — 托管摄取
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 成本杠杆参考
- [RAGAS 0.2 文档](https://docs.ragas.io/) — 权威 RAG 评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 漂移可观测性参考
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — 2026 年安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 策略 rail 框架