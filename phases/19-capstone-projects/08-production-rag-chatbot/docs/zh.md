# 综合项目 08 — 面向受监管垂直领域的生产级 RAG 聊天机器人

> Harvey、Glean、Mendable 和 LlamaCloud 在 2026 年都运行着相同的生产形态。使用 docling 或 Unstructured 以及用于视觉的 ColPali 进行摄取。混合搜索。使用 bge-reranker-v2-gemma 重新排序。使用 60-80% 命中率的提示缓存，通过 Claude Sonnet 4.7 进行合成。使用 Llama Guard 4 和 NeMo Guardrails 进行守卫。使用 Langfuse 和 Phoenix 进行监控。使用 200 个问题的黄金集通过 RAGAS 进行评分。在受监管领域（法律、临床、保险）构建一个，本综合项目的目标是通过黄金集、红队和漂移仪表板。

**类型：** 综合项目
**语言：** Python（管道 + API）、TypeScript（聊天 UI）
**前置条件：** 第 5 阶段（NLP）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 12 阶段（多模态）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P5 · P7 · P11 · P12 · P17 · P18
**时间：** 30 小时

## 问题描述

受监管领域的 RAG（法律合同、临床试验方案、保险政策）是 2026 年交付最多的生产形态，因为 ROI 显而易见且风险具体。Harvey（Allen & Overy）为法律界构建了它。Mendable 交付了开发者文档风格。Glean 覆盖企业搜索。模式是：高保真摄取、带重新排序的混合检索、使用引用强制执行和提示缓存进行合成、通过多层安全防护进行守卫，以及持续监控漂移。

最困难的部分不是模型。它们是感知感知的合规性（HIPAA、GDPR、SOC2）、引用级可审计性、成本控制（提示缓存在命中率高时买入 60-90% 折扣）、通过 RAGAS  Faithfulness 进行的幻觉检测，以及当源文档更新但索引未跟上时的漂移检测。本综合项目要求你在带有红队套件的 200 问题黄金集上交付所有这些。

## 核心概念

管道有两侧。**摄取侧**：docling 或 Unstructured 解析结构化文档；ColPali 处理视觉丰富的文档；块获得摘要、标签和基于角色的访问标签。向量进入 pgvector + pgvectorscale（5000 万向量以下）或 Qdrant Cloud；稀疏 BM25 并行运行。**对话侧**：LangGraph 处理记忆和多轮；每个查询运行混合检索，使用 bge-reranker-v2-gemma-2b 重新排序，使用 Claude Sonnet 4.7（提示缓存）进行合成，通过 Llama Guard 4 和 NeMo Guardrails 传递输出，并发出引用锚定的响应。

评估技术栈有四层。**黄金集**（200 个带引用的标注 Q/A）用于正确性。**红队**（越狱、PII 提取尝试、域外问题）用于安全性。**RAGAS** 用于每轮的 Faithfulness / Answer Relevance / Context Precision 自动化。**漂移仪表板**（Arize Phoenix）每周监控检索质量和幻觉分数。

提示缓存是成本杠杆。Claude 4.5+ 和 GPT-5+ 支持缓存系统提示 + 检索到的上下文。在 60-80% 命中率下，每个查询的成本下降 3-5 倍。管道必须针对稳定前缀（系统提示 + 首先重新排序的上下文）进行设计，以实现高缓存命中率。

## 架构

```
文档（合同、方案、政策）
      |
      v
docling / Unstructured 解析 + 用于视觉的 ColPali
      |
      v
块 + 摘要 + 角色标签 + 司法管辖区标签
      |
      v
pgvector + pgvectorscale  +  BM25（Tantivy）
      |
查询 + 角色 + 司法管辖区
      |
      v
LangGraph 对话智能体
   +--- 检索（混合）
   +--- 按角色 + 司法管辖区过滤
   +--- 重新排序（bge-reranker-v2-gemma-2b 或 Voyage rerank-2）
   +--- 合成（Claude Sonnet 4.7，提示缓存）
   +--- 守卫（Llama Guard 4 + NeMo Guardrails + Presidio 输出 PII 清理）
   +--- 引用 + 返回
      |
      v
评估：
  RAGAS Faithfulness / Answer Relevance / Context Precision（在线）
  Langfuse 标注队列（采样）
  Arize Phoenix 漂移（每周）
  红队套件（发布前）
```

## 技术栈

- 摄取：用于结构化文档的 Unstructured.io 或 docling；用于视觉丰富 PDF 的 ColPali
- 向量数据库：5000 万向量以下的 pgvector + pgvectorscale；否则使用 Qdrant Cloud
- 稀疏：带字段权重的 Tantivy BM25
- 编排：LlamaIndex Workflows（摄取）+ LangGraph（对话）
- 重新排序器：自托管的 bge-reranker-v2-gemma-2b 或托管的 Voyage rerank-2
- LLM：带提示缓存的 Claude Sonnet 4.7；后备自托管的 Llama 3.3 70B
- 评估：在线的 RAGAS 0.2、用于幻觉和越狱套件的 DeepEval
- 可观测性：带标注队列的自托管 Langfuse；用于漂移的 Arize Phoenix
- 防护栏：Llama Guard 4 输入/输出分类器、NeMo Guardrails v0.12 策略、Presidio PII 清理
- 合规性：块上的基于角色的访问标签；用于 GDPR/HIPAA 的司法管辖区标签

## 构建步骤

1. **摄取。** 使用 Unstructured 或 docling 解析你的语料库（对于严肃的构建，1000-10000 个文档）。对于扫描/视觉密集的页面，通过 ColPali 路由。生成带有摘要、角色标签、司法管辖区标签的块。

2. **索引。** 将稠密嵌入（Voyage-3 或 Nomic-embed-v2）放入 pgvector + pgvectorscale。通过 Tantivy 建立 BM25 侧索引。角色和司法管辖区过滤器作为载荷。

3. **混合检索。** 先按角色+司法管辖区过滤；然后并行稠密 + BM25；用倒数排名融合合并；top-20 送给重新排序器；top-5 送给合成器。

4. **使用提示缓存进行合成。** 缓存头中的系统提示 + 静态策略；将重新排序的上下文作为缓存扩展；用户问题作为未缓存后缀。目标在稳态下达到 60-80% 缓存命中率。

5. **防护栏。** 输入上的 Llama Guard 4；NeMo Guardrails 栏杆阻止域外问题或策略禁止的主题；Presidio 清理输出中的意外 PII；引用强制执行后置过滤器。

6. **黄金集。** 由领域专家标注的 200 个 Q/A 对（答案、引用）。在精确引用匹配、答案正确性、Faithfulness（RAGAS）上对智能体评分。

7. **红队。** 50 个对抗性提示：越狱（PAIR、TAP）、PII 渗透尝试、域外、跨司法管辖区泄漏。用通过/失败和严重性评分。

8. **漂移仪表板。** Arize Phoenix 每周跟踪检索质量（nDCG、引用 Faithfulness）。在下降 5% 时发出警报。

9. **成本报告。** Langfuse：提示缓存命中率、每个查询的 token 数、按阶段细分的 $/查询。

## 使用示例

```
$ chat --role=analyst --jurisdiction=GDPR
> 根据我们的合同，EU 用户配置文件的数据保留义务是什么？
[retrieve]  混合 top-20 过滤为 GDPR + 分析师角色
[rerank]    top-5 保留
[synth]     claude-sonnet-4.7，缓存命中 74%，0.8s
回答：
  合同（第 12.4 节，主服务协议日期 2024-03-11）
  规定根据 GDPR 第 17 条，终止后 30 天内删除 EU 用户配置文件
  DPA 修订案（DPA-v2.1，第 5 节）将此延长至 14 天
  用于"受限"类别数据。
  引用：[MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 交付成果

`outputs/skill-production-rag.md` 描述了可交付成果。一个带有合规标签的受监管领域聊天机器人，通过评分标准，通过实时漂移监控进行观察。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | RAGAS Faithfulness + Answer Relevance | 在黄金集（200 个 Q/A）上的在线分数 |
| 20 | 引用正确性 | 带有可验证源锚点的答案比例 |
| 20 | 防护栏覆盖率 | Llama Guard 4 通过率 + 越狱套件结果 |
| 20 | 成本 / 延迟工程 | 提示缓存命中率、p95 延迟、$/查询 |
| 15 | 漂移监控仪表板 | 带有每周检索质量趋势的 Phoenix 实时仪表板 |
| **100** | | |

## 练习

1. 在不同的司法管辖区（例如，HIPAA 与 GDPR 一起）下构建第二个语料库切片。在 20 个问题的跨司法管辖区探针中演示角色+司法管辖区过滤防止交叉泄漏。

2. 在一周的生产流量上测量提示缓存命中率。识别哪些查询破坏了缓存前缀。重构。

3. 使用 1 万 token 摘要缓冲区添加多轮记忆。测量随着对话增长，Faithfulness 是否下降。

4. 将 Claude Sonnet 4.7 换为自托管的 Llama 3.3 70B。测量 $/查询和 Faithfulness 差异。

5. 添加"不确定"模式：如果 top reranked 分数低于阈值，智能体说"我没有信心的引用"而不是回答。测量错误信心减少量。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 提示缓存 | "已缓存的系统 + 上下文" | Claude/OpenAI 功能：命中时缓存的前缀 token 折扣 60-90% |
| RAGAS | "RAG 评估器" | Faithfulness、Answer Relevance、Context Precision 的自动评分 |
| 黄金集 | "已标注的评估" | 200+ 个专家标注的 Q/A，带有引用；地面实况 |
| 司法管辖区标签 | "合规标签" | 附加到块的 GDPR/HIPAA/SOC2 范围；由检索过滤器强制执行 |
| 引用 Faithfulness | "有据可依的回答率" | 由可检索的源跨度支持的声明比例 |
| 漂移 | "检索质量衰减" | nDCG 或引用分数的每周变化；警报阈值 5% |
| 红队 | "对抗性评估" | 发布前的越狱、PII 提取、域外探针 |

## 延伸阅读

- [Harvey AI](https://www.harvey.ai) — 参考法律生产技术栈
- [Glean 企业搜索](https://www.glean.com) — 企业规模参考 RAG
- [Mendable 文档](https://mendable.ai) — 开发者文档 RAG 参考
- [LlamaCloud 解析 + 索引](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — 托管摄取
- [Anthropic 提示缓存](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 成本杠杆参考
- [RAGAS 0.2 文档](https://docs.ragas.io/) — 规范 RAG 评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 参考漂移可观测性
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年安全分类器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 策略栏杆框架
