# 08 · 面向受监管垂直领域的生产级 RAG 聊天机器人

> Harvey、Glean、Mendable 和 LlamaCloud 在 2026 年都运行着相同的生产级架构。使用 docling 或 Unstructured 结合 ColPali 进行视觉内容摄入。混合搜索。用 bge-reranker-v2-gemma 进行重排序。用 Claude Sonnet 4.7 结合提示缓存（prompt caching）以 60%–80% 的命中率进行合成。用 Llama Guard 4 和 NeMo Guardrails 进行防护。用 Langfuse 和 Phoenix 进行监控。在 200 道题目的金标集上用 RAGAS 评分。在受监管领域（法律、临床、保险）构建一个，而毕业条件就是通过金标集、红队测试和漂移仪表盘。

**类型：** 毕业项目
**语言：** Python（管线 + API）、TypeScript（聊天 UI）
**前置：** 第五阶段（NLP）、第七阶段（变换器）、第十一阶段（LLM 工程）、第十二阶段（多模态）、第十七阶段（基础设施）、第十八阶段（安全）
**覆盖阶段：** P5 · P7 · P11 · P12 · P17 · P18
**时长：** 30 小时

## 问题

受监管领域的 RAG（检索增强生成，Retrieval-Augmented Generation）——法律合同、临床试验方案、保险条款——是 2026 年交付最多的生产级架构形态，因为其投资回报率显而易见，且风险明确。Harvey（安理国际律师事务所）在法律领域构建了它。Mendable 交付了面向开发者文档的版本。Glean 覆盖企业搜索。其模式是：高保真摄入、混合检索加重排序、带引文约束和提示缓存的合成、多层安全防护，以及持续的漂移监控。

难点不在于模型。难点在于司法管辖区合规（HIPAA、GDPR、SOC2）、引文级可审计性、成本控制（提示缓存在命中率高时可节省 60%–90% 的费用）、通过 RAGAS 忠实度进行的幻觉检测，以及源文档更新而索引未同步时的漂移检测。本毕业项目要求你在 200 道题目的金标集和红队测试套件上交付全部这些能力。

## 概念

这条管线有两面。**摄入侧**：docling 或 Unstructured 解析结构化文档；ColPali 处理视觉丰富的页面；每个分块附带摘要、标签和基于角色的访问标签。向量存入 pgvector + pgvectorscale（5000 万向量以内）或 Qdrant Cloud；稀疏 BM25 并行运行。**对话侧**：LangGraph 处理记忆和多轮对话；每次查询先执行混合检索，再用 bge-reranker-v2-gemma-2b 重排序，由 Claude Sonnet 4.7（启用了提示缓存）合成回复，输出经过 Llama Guard 4 和 NeMo Guardrails，最终发出带引文锚定的回复。

评估栈有四个层面。**金标集（golden set）**（200 道带标注的问答，含引文）用于正确性评估。**红队（red team）**（越狱、PII 提取尝试、领域外问题）用于安全评估。**RAGAS** 按轮次自动评估忠实度 / 答案相关性 / 上下文精度。**漂移仪表盘**（Arize Phoenix）每周监控检索质量和幻觉评分。

提示缓存是成本杠杆。Claude 4.5+ 和 GPT-5+ 都支持对系统提示和检索上下文进行缓存。在 60%–80% 的命中率下，每次查询的成本可降低 3–5 倍。管线必须设计为具有稳定的前缀（系统提示 + 已重排序的上下文排在前）才能实现高缓存命中率。

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

- 摄入：Unstructured.io 或 docling 用于结构化文档；ColPali 用于视觉丰富的 PDF
- 向量数据库：pgvector + pgvectorscale（5000 万向量以内）；超出则用 Qdrant Cloud
- 稀疏检索：Tantivy BM25，带字段加权
- 编排：LlamaIndex Workflows（摄入）+ LangGraph（对话）
- 重排序器：bge-reranker-v2-gemma-2b 自托管，或 Voyage rerank-2 托管
- LLM：Claude Sonnet 4.7 开启提示缓存；回退方案为 Llama 3.3 70B 自托管
- 评估：RAGAS 0.2 在线评估，DeepEval 用于幻觉和越狱测试套件
- 可观测性：Langfuse 自托管加标注队列；Arize Phoenix 用于漂移监控
- 护栏：Llama Guard 4 输入/输出分类器，NeMo Guardrails v0.12 策略，Presidio PII 擦除
- 合规：分块上的基于角色的访问标签；GDPR/HIPAA 司法管辖区标签

## 构建步骤

1. **摄入。** 用 Unstructured 或 docling 解析你的语料库（严肃构建需要 1000–10000 份文档）。对于扫描件或视觉密集的页面，路由到 ColPali 处理。为每个分块生成摘要、角色标签和司法管辖区标签。

2. **索引。** 稠密嵌入（Voyage-3 或 Nomic-embed-v2）存入 pgvector + pgvectorscale。BM25 侧索引通过 Tantivy。角色和司法管辖区过滤器作为附带载荷。

3. **混合检索。** 先按角色 + 司法管辖区过滤；然后并行执行稠密检索和 BM25；用倒数排名融合（RRF）合并结果；取前 20 送入重排序器；取前 5 送入合成。

4. **带提示缓存的合成。** 系统提示和静态策略放在缓存头部；已重排序的上下文作为缓存扩展；用户问题作为未缓存的尾部。稳态下目标缓存命中率为 60%–80%。

5. **护栏。** Llama Guard 4 对输入进行检测；NeMo Guardrails 规则阻断领域外问题或被策略禁止的话题；Presidio 擦除输出中意外泄露的 PII；引文强制后置过滤。

6. **金标集。** 200 道由领域专家标注的问答对，包含（答案、引文）。按精确引文匹配、答案正确性和忠实度（RAGAS）对智能体评分。

7. **红队。** 50 条对抗性提示：越狱（PAIR、TAP）、PII 泄露尝试、领域外查询、跨司法管辖区泄露。按通过/失败和严重程度评分。

8. **漂移仪表盘。** Arize Phoenix 每周跟踪检索质量（nDCG、引文忠实度）。在指标下降 5% 时触发告警。

9. **成本报告。** Langfuse：提示缓存命中率、每次查询的 token 用量、按阶段拆分的每次查询成本。

## 使用方式

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

`outputs/skill-production-rag.md` 描述了交付物。一个在受监管领域部署的、带合规标签的聊天机器人，通过了评分标准，并配有实时漂移监控。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | RAGAS 忠实度 + 答案相关性 | 在金标集（200 道问答）上的在线评分 |
| 20 | 引文正确性 | 带可验证来源锚点的答案占比 |
| 20 | 护栏覆盖率 | Llama Guard 4 通过率 + 越狱测试套件结果 |
| 20 | 成本 / 延迟工程 | 提示缓存命中率、p95 延迟、每次查询成本 |
| 15 | 漂移监控仪表盘 | Phoenix 实时仪表盘，展示每周检索质量趋势 |
| **100** | | |

## 练习

1. 构建第二个处于不同司法管辖区（例如 HIPAA 与 GDPR 并列）的语料切片。通过 20 道跨司法管辖区探测题，证明角色 + 司法管辖区过滤能防止跨区泄露。

2. 在持续一周的生产流量中测量提示缓存命中率。识别哪些查询破坏了缓存前缀。重新调整结构。

3. 添加带 1 万 token 摘要缓冲区的多轮记忆。测量随对话增长忠实度是否下降。

4. 将 Claude Sonnet 4.7 替换为 Llama 3.3 70B 自托管。测量每次查询成本和忠实度的变化。

5. 添加"不确定"模式：如果最高重排序得分低于阈值，智能体回复"我没有可信的引文"而非强行作答。测量误信率的降低。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 提示缓存（Prompt caching） | "缓存的系统提示 + 上下文" | Claude/OpenAI 特性：缓存的前缀 token 命中时享受 60%–90% 折扣 |
| RAGAS | "RAG 评估器" | 自动评分忠实度、答案相关性、上下文精度 |
| 金标集（Golden set） | "标注评测集" | 200+ 道专家标注的问答及引文；即真实基准 |
| 司法管辖区标签（Jurisdiction tag） | "合规标签" | 附加到分块的 GDPR/HIPAA/SOC2 范围标记；由检索过滤器强制执行 |
| 引文忠实度（Citation faithfulness） | "有依据回答率" | 可追溯到来源片段的观点占比 |
| 漂移（Drift） | "检索质量衰退" | nDCG 或引文评分的每周变化；告警阈值为 5% |
| 红队（Red team） | "对抗性评估" | 发布前的越狱、PII 提取、领域外探测 |

## 延伸阅读

- [Harvey AI](https://www.harvey.ai) — 法律领域生产级 RAG 参考
- [Glean 企业搜索](https://www.glean.com) — 企业规模 RAG 参考
- [Mendable 文档](https://mendable.ai) — 开发者文档 RAG 参考
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — 托管摄入服务
- [Anthropic 提示缓存](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 成本杠杆参考
- [RAGAS 0.2 文档](https://docs.ragas.io/) — 权威 RAG 评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 漂移可观测性参考
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 策略护栏框架
