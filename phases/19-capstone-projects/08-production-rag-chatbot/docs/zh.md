# 结业项目 08 — 面向受监管行业的可投产 RAG 聊天机器人

> Harvey、Glean、Mendable 和 LlamaCloud 在 2026 年都采用相同的生产架构：使用 docling 或 Unstructured 以及 ColPali 进行视觉内容摄取；混合检索；使用 bge-reranker-v2-gemma 重排序；使用 Claude Sonnet 4.7（60-80% 的提示缓存命中率）合成回答；使用 Llama Guard 4 和 NeMo Guardrails 进行安全防护；使用 Langfuse 和 Phoenix 进行监控；使用 RAGAS 在 200 道题目的黄金测试集上评分。在受监管领域（法律、临床、保险）构建一个，结业标准是通过黄金测试集、红队测试和漂移仪表盘。

**类型：** 结业项目
**语言：** Python（流水线 + API）、TypeScript（聊天 UI）
**前置要求：** 第 5 阶段（自然语言处理）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 12 阶段（多模态）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P5 · P7 · P11 · P12 · P17 · P18
**时间：** 30 小时

## 问题

受监管领域的 RAG（法律合同、临床试验方案、保险条款）是 2026 年交付量最大的生产形态，因为其投资回报率显而易见，且利害关系具体明确。Harvey（与 Allen & Overy 合作）为法律领域构建了它；Mendable 推出的是开发者文档版本；Glean 覆盖企业搜索。其模式是：高保真摄取、带重排序的混合检索、带引用强制和提示缓存的合成、多层安全防护，以及持续漂移监控。

难点不在于模型本身，而在于：管辖区域合规（HIPAA、GDPR、SOC2）、引用级别的可审计性、成本控制（高命中率时提示缓存可节省 60-90% 的费用）、通过 RAGAS 忠实度检测幻觉，以及在源文档已更新但索引未同步时检测漂移。本结业项目要求你在一个 200 道题的黄金测试集上完整交付上述内容，并附带一套红队测试套件。

## 概念

流水线分为两端。**摄取端**：docling 或 Unstructured 解析结构化文档；ColPali 处理视觉丰富的文档；分块后生成摘要、标签和基于角色的访问标记。向量存入 pgvector + pgvectorscale（5000 万向量以下）或 Qdrant Cloud；同时运行稀疏 BM25 索引。**对话端**：LangGraph 处理记忆和多轮对话；每轮查询执行混合检索，使用 bge-reranker-v2-gemma-2b 重排序，使用 Claude Sonnet 4.7（启用提示缓存）合成回答，输出经 Llama Guard 4 和 NeMo Guardrails 过滤，最终生成带引用锚点的响应。

评估堆栈有四层。**黄金测试集**（200 个带标注的问答对及引用）用于正确性评估。**红队测试**（越狱攻击、PII 提取尝试、领域外问题）用于安全评估。**RAGAS** 用于每轮在线评估忠实度/答案相关性/上下文精确度。**漂移仪表盘**（Arize Phoenix）每周监控检索质量和幻觉评分。

提示缓存是成本杠杆。Claude 4.5+ 和 GPT-5+ 支持缓存系统提示词和检索到的上下文。在 60-80% 的命中率下，每次查询的成本降低 3-5 倍。流水线必须针对稳定的前缀（系统提示词 + 重排序后的上下文放在前面）进行设计，以实现高缓存命中率。

## 架构

```
文档（合同、方案、条款）
      |
      v
docling / Unstructured 解析 + ColPali 处理视觉内容
      |
      v
分块 + 摘要 + 角色标签 + 管辖区域标签
      |
      v
pgvector + pgvectorscale  +  BM25（Tantivy）
      |
查询 + 角色 + 管辖区域
      |
      v
LangGraph 对话代理
   +--- 检索（混合）
   +--- 按角色和管辖区域过滤
   +--- 重排序（bge-reranker-v2-gemma-2b 或 Voyage rerank-2）
   +--- 合成（Claude Sonnet 4.7，提示缓存）
   +--- 防护（Llama Guard 4 + NeMo Guardrails + Presidio 输出 PII 清洗）
   +--- 引用 + 返回
      |
      v
评估：
  RAGAS 忠实度 / 答案相关性 / 上下文精确度（在线）
  Langfuse 标注队列（抽样）
  Arize Phoenix 漂移（每周）
  红队测试套件（发布前）
```

## 技术栈

- 摄取：Unstructured.io 或 docling（结构化文档）；ColPali（视觉丰富型 PDF）
- 向量数据库：5000 万向量以下用 pgvector + pgvectorscale；以上用 Qdrant Cloud
- 稀疏检索：Tantivy BM25（带字段权重）
- 编排：LlamaIndex Workflows（摄取）+ LangGraph（对话）
- 重排序器：自托管 bge-reranker-v2-gemma-2b 或托管 Voyage rerank-2
- LLM：Claude Sonnet 4.7（带提示缓存）；备用自托管 Llama 3.3 70B
- 评估：RAGAS 0.2 在线评估，DeepEval 用于幻觉和越狱测试套件
- 可观测性：自托管 Langfuse（带标注队列）；Arize Phoenix（漂移监控）
- 安全防护：Llama Guard 4 输入/输出分类器、NeMo Guardrails v0.12 策略、Presidio PII 清洗
- 合规：基于角色的访问标记（分块级）；管辖区域标签（GDPR/HIPAA）

```figure
金丝雀发布
```

## 构建步骤

1. **摄取。** 使用 Unstructured 或 docling 解析你的语料库（严肃构建需 1000-10000 份文档）。对于扫描件/视觉密集型页面，通过 ColPali 路由处理。生成带摘要、角色标签和管辖区域标签的文档块。

2. **索引。** 稠密嵌入（Voyage-3 或 Nomic-embed-v2）存入 pgvector + pgvectorscale。通过 Tantivy 建立 BM25 侧索引。角色和管辖区域过滤器作为元数据载荷。

3. **混合检索。** 先按角色+管辖区域过滤；然后并行执行稠密检索和 BM25 检索；使用倒数排名融合（RRF）合并结果；取前 20 条给重排序器；取前 5 条给合成模块。

4. **带提示缓存的合成。** 系统提示词和静态策略放入缓存头部；重排序后的上下文作为缓存扩展；用户问题作为未缓存的后缀。稳定状态下目标缓存命中率为 60-80%。

5. **安全防护。** Llama Guard 4 对输入进行过滤；NeMo Guardrails 规则阻止领域外提问或策略禁止的话题；Presidio 清洗输出中的意外 PII；引用强制后置过滤器。

6. **黄金测试集。** 由领域专家标注 200 个问答对（含答案和引用）。根据精确引用匹配、答案正确性和 RAGAS 忠实度对代理评分。

7. **红队测试。** 50 个对抗性提示：越狱攻击（PAIR、TAP）、PII 窃取尝试、领域外问题、跨管辖区域信息泄露。按通过/失败和严重程度评分。

8. **漂移仪表盘。** Arize Phoenix 每周跟踪检索质量（nDCG、引用忠实度）。下降 5% 时触发告警。

9. **成本报告。** Langfuse：提示缓存命中率、每次查询的 token 数、按阶段细分的每次查询成本（$）。

## 使用示例

```
$ chat --role=analyst --jurisdiction=GDPR
> 根据我们的合同，欧盟用户资料的数据保留义务是什么？
[retrieve]  混合检索前 20 条，按 GDPR + analyst 角色过滤
[rerank]    保留前 5 条
[synth]     claude-sonnet-4.7，缓存命中率 74%，0.8 秒
answer:
  合同（第 12.4 节，《主服务协议》日期 2024-03-11）
  根据 GDPR 第 17 条，要求在终止后 30 天内删除欧盟用户资料。
  DPA 修正案（DPA-v2.1 第 5 节）将"受限"类别数据的
  此期限缩短至 14 天。
  引用：[MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 交付要求

`outputs/skill-production-rag.md` 描述了交付物。一个已部署的受监管领域聊天机器人，带有合规标签，通过评分标准，并配有实时漂移监控。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | RAGAS 忠实度 + 答案相关性 | 黄金测试集（200 个问答对）上的在线评分 |
| 20 | 引用正确性 | 可验证源锚点的答案比例 |
| 20 | 安全防护覆盖 | Llama Guard 4 通过率 + 越狱测试套件结果 |
| 20 | 成本/延迟工程 | 提示缓存命中率、p95 延迟、每次查询成本 |
| 15 | 漂移监控仪表盘 | Phoenix 实时仪表盘，含每周检索质量趋势 |
| **100** | | |

## 练习

1. 在另一个管辖区域下构建第二批语料库（例如 HIPAA 与 GDPR 并列）。通过一个 20 道题的跨管辖区域探测，证明角色+管辖区域过滤能够防止信息交叉泄露。

2. 在生产流量上测量一周的提示缓存命中率。识别哪些查询破坏了缓存前缀。重新调整结构。

3. 添加多轮对话记忆，使用 10000 token 的摘要缓冲区。测量随对话增长忠实度是否下降。

4. 将 Claude Sonnet 4.7 替换为自托管的 Llama 3.3 70B。测量每次查询成本和忠实度变化。

5. 添加"不确定"模式：如果重排序后的最高得分低于阈值，代理回答"我没有足够可信的引用"而非硬性作答。测量虚假自信的减少情况。

## 关键术语

| 术语 | 表面含义 | 实际含义 |
|------|---------|---------|
| 提示缓存（Prompt caching） | "缓存系统提示词和上下文" | Claude/OpenAI 功能：命中的缓存前缀 token 节省 60-90% 费用 |
| RAGAS | "RAG 评估器" | 自动评分忠实度、答案相关性、上下文精确度 |
| 黄金测试集（Golden set） | "标注好的评估集" | 200+ 个由专家标注的问答对及引用；作为真实依据 |
| 管辖区域标签（Jurisdiction tag） | "合规标签" | 附加到文档块的 GDPR/HIPAA/SOC2 范围；由检索过滤器强制执行 |
| 引用忠实度（Citation faithfulness） | "有依据的回答率" | 可由检索到的源文本支撑的论断比例 |
| 漂移（Drift） | "检索质量衰减" | nDCG 或引用评分的每周变化；告警阈值 5% |
| 红队测试（Red team） | "对抗性评估" | 发布前进行的越狱、PII 提取、领域外探测 |

## 延伸阅读

- [Harvey AI](https://www.harvey.ai) — 参考法律生产堆栈
- [Glean 企业搜索](https://www.glean.com) — 企业级 RAG 参考
- [Mendable 文档](https://mendable.ai) — 开发者文档 RAG 参考
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — 托管式摄取
- [Anthropic 提示缓存](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 成本杠杆参考
- [RAGAS 0.2 文档](https://docs.ragas.io/) — 权威 RAG 评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 参考漂移可观测性
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 策略护栏框架
