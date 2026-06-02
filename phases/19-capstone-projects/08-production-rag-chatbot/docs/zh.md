# Capstone 08 — 受监管垂直领域的生产级 RAG 聊天机器人（Production RAG Chatbot for a Regulated Vertical）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Harvey、Glean、Mendable、LlamaCloud 在 2026 年跑的都是同一套生产形态：用 docling 或 Unstructured 做 ingestion，用 ColPali 处理图文页；hybrid 检索；用 bge-reranker-v2-gemma 重排；用 Claude Sonnet 4.7 合成，prompt caching 命中率维持在 60-80%；用 Llama Guard 4 + NeMo Guardrails 做 guardrail（护栏）；用 Langfuse + Phoenix 做观测；用 RAGAS 在 200 题黄金集（golden set）上打分。在受监管领域（法律、临床、保险）做一个出来，capstone 的标准就是黄金集、red team（红队）和 drift（漂移）看板都过线。

**Type:** Capstone
**Languages:** Python（流水线 + API），TypeScript（聊天 UI）
**Prerequisites:** Phase 5（NLP）、Phase 7（transformer）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 17（基础设施）、Phase 18（安全）
**Phases exercised:** P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## 问题（Problem）

受监管领域的 RAG（法律合同、临床试验方案、保险保单）是 2026 年最常被推到生产的形态，因为 ROI 一目了然、风险也很具体。Harvey（Allen & Overy）做的是法律版；Mendable 做的是开发者文档版；Glean 覆盖企业搜索。套路是一样的：高保真 ingestion，hybrid 检索 + rerank，合成时强制 citation（引用）并用 prompt caching，叠多层安全 guardrail，再持续监控 drift。

难的不是模型，而是这些事：按 jurisdiction（司法辖区）做合规（HIPAA、GDPR、SOC2）、citation 级可审计、成本控制（prompt caching 命中率高时能打 60-90% 折扣）、用 RAGAS faithfulness 检测 hallucination（幻觉）、以及当源文档被更新而索引没跟上时检测 drift。本 capstone 要求你把这一整套都跑起来：一个 200 题黄金集，外加一套 red team 套件。

## 概念（Concept）

流水线分两侧。**Ingestion**：docling 或 Unstructured 解析结构化文档；ColPali 处理图文重的；切出来的 chunk 配上摘要、标签、基于角色的访问标签。向量进 pgvector + pgvectorscale（5000 万向量以下）或 Qdrant Cloud；BM25 稀疏检索并排跑。**Conversation**：LangGraph 负责记忆和多轮；每个 query 跑 hybrid 检索，用 bge-reranker-v2-gemma-2b 重排，用 Claude Sonnet 4.7（带 prompt cache）合成，输出过 Llama Guard 4 和 NeMo Guardrails，最后输出带 citation 锚点的回答。

评估栈分四层。**Golden set**（200 条带 citation 标注的 Q/A）查正确性。**Red team**（jailbreak、PII 提取、跨域提问）查安全。**RAGAS** 在线逐轮自动跑 faithfulness / answer relevance / context precision。**Drift 看板**（Arize Phoenix）每周看 retrieval 质量和 hallucination 分。

Prompt caching 是成本杠杆。Claude 4.5+ 和 GPT-5+ 都支持把 system prompt + 检索到的 context 一起缓存。命中率到 60-80%，单 query 成本能降 3-5 倍。流水线必须设计成稳定前缀（system prompt + 重排后的 context 排在前面），命中率才上得去。

## 架构（Architecture）

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

## 技术栈（Stack）

- Ingestion：Unstructured.io 或 docling 处理结构化文档；ColPali 处理图文重的 PDF
- 向量数据库：5000 万向量以内用 pgvector + pgvectorscale；超过则用 Qdrant Cloud
- 稀疏检索：Tantivy BM25，按字段加权
- 编排：LlamaIndex Workflows（ingestion）+ LangGraph（conversation）
- Reranker：自托管 bge-reranker-v2-gemma-2b，或托管 Voyage rerank-2
- LLM：Claude Sonnet 4.7 + prompt caching；fallback 用自托管 Llama 3.3 70B
- 评估：RAGAS 0.2 在线跑，DeepEval 跑 hallucination 和 jailbreak 套件
- 可观测性：自托管 Langfuse 带标注队列；Arize Phoenix 看 drift
- Guardrails：Llama Guard 4 输入 / 输出分类器，NeMo Guardrails v0.12 策略层，Presidio 做 PII 清洗
- 合规：在 chunk 上打基于角色的访问标签；用 jurisdiction 标签覆盖 GDPR/HIPAA

## 动手实现（Build It）

1. **Ingestion。** 用 Unstructured 或 docling 解析你的语料（认真做的话 1000-10000 篇文档）。扫描件 / 图文重的页面走 ColPali。产出带摘要、角色标签、jurisdiction 标签的 chunk。

2. **建索引。** 稠密 embedding（Voyage-3 或 Nomic-embed-v2）入 pgvector + pgvectorscale。BM25 旁路索引走 Tantivy。角色和 jurisdiction 过滤器作为 payload。

3. **Hybrid 检索。** 先按 role+jurisdiction 过滤；再并行跑 dense + BM25；用 reciprocal rank fusion（互逆排名融合）合并；top-20 给 reranker；top-5 给合成。

4. **带 prompt caching 的合成。** 把 system prompt + 静态策略放进 cache header；重排后的 context 作为 cache 扩展；用户问题作为不缓存的尾段。稳态命中率目标 60-80%。

5. **Guardrails。** 输入端跑 Llama Guard 4；NeMo Guardrails 的 rail 拦截跨域提问或政策禁止话题；Presidio 清洗输出里意外漏出的 PII；后置过滤强制 citation。

6. **Golden set。** 200 条 Q/A，由领域专家标注（answer，citations）。从三个维度给 agent 打分：精确 citation 命中率、答案正确性、faithfulness（RAGAS）。

7. **Red team。** 50 条对抗 prompt：jailbreak（PAIR、TAP）、PII 外泄尝试、跨域问题、跨 jurisdiction 泄漏。打 pass/fail 加严重程度。

8. **Drift 看板。** Arize Phoenix 每周跟踪 retrieval 质量（nDCG、citation faithfulness）。下降 5% 就告警。

9. **成本报表。** Langfuse 看：prompt-caching 命中率、每 query 的 token 数、各阶段的 $/query 拆分。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-production-rag.md` 描述了交付物。一个带合规标签部署的受监管领域聊天机器人，过了评分表，并接上线上 drift 监控。

| 权重 | 标准 | 怎么衡量 |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | 黄金集（200 Q/A）上的在线得分 |
| 20 | Citation 正确性 | 答案中可验证源锚点的占比 |
| 20 | Guardrail 覆盖 | Llama Guard 4 通过率 + jailbreak 套件结果 |
| 20 | 成本 / 延迟工程 | Prompt cache 命中率、p95 延迟、$/query |
| 15 | Drift 监控看板 | Phoenix 在线看板每周展示 retrieval 质量趋势 |
| **100** | | |

## 练习（Exercises）

1. 建一个不同 jurisdiction 的第二个语料切片（比如在 GDPR 之外加一份 HIPAA）。在 20 题跨 jurisdiction 探针上证明 role+jurisdiction 过滤能阻止跨域泄漏。

2. 在一周生产流量上测 prompt-cache 命中率。找出哪些 query 把 cache 前缀打断了，重构。

3. 加一个 10k token 摘要 buffer 的多轮记忆。看对话变长后 faithfulness 会不会掉。

4. 把 Claude Sonnet 4.7 换成自托管的 Llama 3.3 70B。测 $/query 和 faithfulness 的差值。

5. 加一个「不确定」模式：如果重排后的 top 分数低于阈值，agent 就说「I do not have confident citations」而不强答。测一下假自信的下降幅度。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Prompt caching | "缓存 system + context" | Claude/OpenAI 的功能：缓存的前缀 token 命中时打 60-90% 折扣 |
| RAGAS | "RAG 评估器" | 自动给 faithfulness、answer relevance、context precision 打分 |
| Golden set | "标注评估集" | 200+ 条专家标注、带 citation 的 Q/A；ground truth |
| Jurisdiction tag | "合规标签" | 挂在 chunk 上的 GDPR/HIPAA/SOC2 范围标签；由检索过滤器强制 |
| Citation faithfulness | "答案可溯源率" | 由可检索源片段支撑的论断占比 |
| Drift | "Retrieval 质量衰减" | nDCG 或 citation 分的周变化；告警阈值 5% |
| Red team | "对抗评估" | 上线前的 jailbreak、PII 提取、跨域探针 |

## 延伸阅读（Further Reading）

- [Harvey AI](https://www.harvey.ai) — 法律生产栈参考
- [Glean enterprise search](https://www.glean.com) — 企业级 RAG 参考
- [Mendable documentation](https://mendable.ai) — 开发者文档 RAG 参考
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — 托管 ingestion
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 成本杠杆参考
- [RAGAS 0.2 documentation](https://docs.ragas.io/) — RAG 评估的标准框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — drift 可观测性参考
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 策略 rail 框架
