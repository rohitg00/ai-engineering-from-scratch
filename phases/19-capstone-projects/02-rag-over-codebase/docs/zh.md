# 顶点项目 02 — 基于代码库的 RAG（跨仓库语义搜索）

> 2026 年，每个认真的工程组织都在运行一种理解含义而非字符串的内部代码搜索。Sourcegraph Amp、Cursor 的代码库问答、Augment 的企业知识图谱、Aider 的 repomap、Pinterest 的内部 MCP——形态相同。摄取多个仓库，用 tree-sitter 解析，对函数和类级别的代码块做嵌入，混合搜索，重排序，带引用给出答案。本顶点项目要求你构建一个能够处理跨 10 个仓库、200 万行代码，并在每次 git push 时完成增量重索引的系统。

**类型：** 顶点项目
**语言：** Python（数据摄取）、TypeScript（API + UI）
**前置知识：** 阶段 5（NLP 基础）、阶段 7（Transformer）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 17（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P17
**预计时间：** 30 小时

## 问题

到 2026 年，每个前沿编码智能体都配备了代码库检索层，因为仅靠上下文窗口无法解决跨仓库问题。Claude 的 100 万 token 上下文窗口有所帮助，但并不能消除对排序检索的需求。对原始代码块做简单的余弦搜索结果会被生成的代码、单体仓库中的重复代码以及大量极少被导入的符号所污染。生产级的解决方案是对 AST 感知的代码块进行混合（稠密 + BM25）搜索，配合重排序器，并以符号引用图作为支撑。

你将通过索引一个真实的代码仓库群（而非一个教学仓库）来学习这些，并衡量 MRR@10、引用忠实度和增量新鲜度。失败模式是基础设施层面的：一个包含 10 万个文件的单体仓库、一次改动了一半文件的推送、一个需要跨越四个仓库才能正确回答的查询。

## 概念

一个 AST 感知的数据摄取管道用 tree-sitter 解析每个文件，提取函数和类节点，并在节点边界处进行分块，而非使用固定的 token 窗口。每个代码块有三种表示形式：稠密嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 词项和一个简短的自然语言摘要。摘要增加了第三种可检索的模态——用户问"X 是如何鉴权的"，摘要提及了"authz"，即使代码中只有 `check_permission`。

检索是混合式的。查询同时触发稠密搜索和 BM25 搜索，合并 top-k 结果，然后将合集交给交叉编码器重排序器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重排序后的列表被送入长上下文合成器（支持提示缓存的 Claude Sonnet 4.7，或自托管的 Llama 3.3 70B），指令要求每个断言都标注文件和行号范围。没有引用的答案会被后置过滤器拒绝。

增量新鲜度是基础设施层面的问题。Git push 触发差异分析：哪些文件发生了变化，哪些符号发生了变化。只有受影响的代码块需要重新嵌入。受影响的跨文件符号边（导入、方法调用）会被重新计算。索引在每次提交时无需重新处理 200 万行代码即可保持一致性。

## 架构

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## 技术栈

- 解析：tree-sitter，支持 17 种语言文法（Python、TS、Rust、Go、Java、C++ 等）
- 稠密嵌入：Voyage-code-3（托管版）或 nomic-embed-code-v1.5（自托管版），bge-code-v1 作为备选
- 稀疏索引：Tantivy（Rust），使用 BM25F，基于字段权重区分符号名称与代码体
- 向量数据库：支持混合搜索的 Qdrant 1.12，或适用于少于 5000 万向量的团队的 pgvector + pgvectorscale
- 代码块摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，启用提示缓存
- 重排序器：Cohere rerank-3 或自托管的 bge-reranker-v2-gemma-2b
- 编排：LlamaIndex Workflows（数据摄取）、LangGraph（查询智能体）
- 合成器：Claude Sonnet 4.7（100 万上下文），带提示缓存
- 符号图：Neo4j（托管版）或 kuzu（嵌入式），用于导入和调用边
- 可观测性：Langfuse，覆盖每个检索和合成步骤的跨度

## 构建步骤

1. **数据摄取遍历器。** 在每个推送钩子上迭代 git 历史。收集变更的文件。对每个文件，用 tree-sitter 解析，提取函数和类节点及其完整源代码跨度。生成代码块记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **代码块摘要器。** 将代码块批量送入 Haiku 4.5 调用，对系统提示词前缀使用提示缓存。提示词："用一句话总结此函数，说明其公共契约和副作用。"将摘要与代码块一起存储。

3. **嵌入池。** 两个并行队列：稠密嵌入（Voyage-code-3，批量大小 128）和摘要嵌入（相同模型，但作用于摘要文本）。将向量写入 Qdrant，附带负载 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 基于字段权重的 Tantivy 索引：符号名称权重 4，符号体权重 1，摘要权重 2。支持"找到名为 X 的函数"和"找到执行 X 的函数"两种查询。

5. **符号图。** 对每个代码块，记录边关系：导入（此文件使用了仓库 Z 中的符号 Y）、调用（此函数调用了类 C 上的方法 M）、继承。存储在 kuzu 中。查询时用于跨仓库边界扩展检索。

6. **查询智能体。** 包含三个节点的 LangGraph。`retrieve` 并行触发稠密搜索和 BM25 搜索，按 (repo, path, symbol) 去重。`rerank` 对 top-50 结果运行交叉编码器，保留 top-10。`synth` 调用 Claude Sonnet 4.7，将重排序后的代码块放入上下文，缓存系统提示词，并要求标注文件:行号引用。

7. **引用强制执行。** 解析模型输出；任何没有 `(repo/path:start-end)` 锚点的断言都会被标记，要求重新回答或被丢弃。仅向用户返回带有引用的答案。

8. **增量重索引。** 在每个 webhook 上，计算符号级别的差异。仅重新嵌入文本发生变化的代码块。对导入发生变化的代码块重新计算符号边。衡量指标：对于一个包含 200 万行代码的仓库群，一次 50 个文件的推送在 60 秒内完成重索引。

9. **评估。** 标注 100 个跨仓库问题及其标准答案的文件:行号定位。衡量 MRR@10、nDCG@10、引用忠实度（带有可验证锚点的断言比例）以及 p50/p99 延迟。

## 使用方式

```
$ code-rag ask "S3 multipart abort 是如何关联到我们的重试预算的？"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart abort 由 `AbortMultipartOnFail` 触发
  位于 services/uploader/retry.go:122-148，
  该函数会扣减 config/budgets.yaml:34-51 中定义的
  每个桶的重试预算 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## 交付标准

可交付技能 `outputs/skill-codebase-rag.md`。给定一组代码仓库，它能搭建起数据摄取管道、混合索引和查询智能体，并为任何跨仓库问题返回带引用的答案。评分标准：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 检索质量 | 在 100 个问题的留出测试集上的 MRR@10 和 nDCG@10 |
| 20 | 引用忠实度 | 答案中断言拥有可验证文件:行号锚点的比例 |
| 20 | 延迟与规模 | 在索引语料库大小下，10k QPS 时的 p95 查询延迟 |
| 20 | 增量索引正确性 | 从 git push 到可搜索，针对 50 个文件的提交所需时间 |
| 15 | 用户体验与答案格式 | 引用的可点击性、代码片段预览、追问支持 |
| **100** | | |

## 练习

1. 将 Voyage-code-3 替换为自托管的 nomic-embed-code。衡量 MRR@10 的差异。报告启用重排序后差距是否缩小。

2. 向语料库中注入 20% 的生成代码（LLM 产生的样板代码），重新评估。观察检索污染现象。在负载中添加"generated"标志并降低这些结果的权重。

3. 在你的语料库规模下，对比评测 Qdrant 混合搜索与 pgvector + pgvectorscale。报告批量大小为 1 时的 p99 延迟。

4. 添加基于抽样的漂移检查：每周重新运行 100 个问题的评估。当 MRR@10 下降超过 5% 时发出告警。

5. 扩展到跨语言的符号解析：一个 Python 函数通过 gRPC 调用一个 Go 服务。使用符号图将它们关联起来。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| AST 感知分块 | "函数级拆分" | 在 tree-sitter 节点边界处切割代码，而非使用固定的 token 窗口 |
| 混合搜索 | "稠密 + 稀疏" | 并行运行 BM25 和向量搜索，合并 top-k 结果，然后重排序 |
| 交叉编码器重排序 | "第二阶段排序" | 对每个（查询，候选）对进行联合评分的模型，比余弦相似度更准确 |
| 提示缓存 | "缓存系统提示词" | 2026 年 Claude/OpenAI 的功能，对重复的前缀 token 最高可减免 90% 成本 |
| 符号图 | "代码图" | 跨文件和仓库的导入、调用、继承关系边 |
| 引用忠实度 | "有依据的回答率" | 用户可通过点击锚点并阅读引用片段来验证的断言比例 |
| 增量重索引 | "推送即搜索时间" | 从 git push 到变更的符号可被查询的墙钟时间 |

## 延伸阅读

- [Sourcegraph Amp](https://ampcode.com) — 生产级跨仓库代码智能
- [Sourcegraph Cody RAG 架构](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — 本顶点项目的参考深度解读
- [Aider repo-map](https://aider.chat/docs/repomap.html) — tree-sitter 排序的仓库视图
- [Augment Code 企业知识图谱](https://www.augmentcode.com) — 商业符号图 RAG
- [Qdrant 混合搜索文档](https://qdrant.tech/documentation/concepts/hybrid-queries/) — 参考实现
- [Voyage AI 代码嵌入](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 详细信息
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — 交叉编码器参考
- [Pinterest MCP 内部搜索](https://medium.com/pinterest-engineering) — 内部平台参考
