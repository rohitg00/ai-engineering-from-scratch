# 02 · 基于代码库的 RAG（跨仓库语义搜索）

> 2026 年，每一个严肃的工程组织都在运行能够理解语义而非仅仅匹配字符串的内部代码搜索。Sourcegraph Amp、Cursor 的代码库问答、Augment 的企业级图谱、Aider 的 repomap、Pinterest 的内部 MCP——形态如出一辙：摄入多个仓库，用 tree-sitter 解析，在函数和类级别进行分块（chunk），混合搜索，重排序（re-rank），并以引用形式给出回答。本实战项目要求你构建一个能够处理 10 个仓库中 200 万行代码、并在每次 git push 时完成增量重建索引（incremental re-index）的系统。

**类型：** 实战项目
**语言：** Python（数据摄入），TypeScript（API + 用户界面）
**前置：** 阶段五（NLP 基础）、阶段七（Transformer）、阶段十一（LLM 工程）、阶段十三（工具）、阶段十七（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P17
**时长：** 30 小时

## 问题

到 2026 年，所有前沿编码智能体都配备了代码库检索层，因为仅靠上下文窗口无法解决跨仓库的问题。Claude 的 100 万 token 上下文有帮助，但并不能消除对排序检索的需求。在原始代码块上做朴素余弦搜索时，生成代码、单体仓库（monorepo）中的重复内容，以及大量极少被引用的符号都会污染结果。工业界的解决方案是：在 AST 感知的分块之上进行混合（稠密 + BM25）搜索，加上一个重排序器，并以符号引用图作为支撑。

你将通过索引一个真实的代码仓库集群来学习上述内容——不是一个教学用的示例仓库——并衡量 MRR@10、引用忠实度（citation faithfulness）和增量新鲜度（incremental freshness）。失败模式主要来自基础设施层面：一个 10 万文件的单体仓库、一次触及半数文件的 push、一个需要跨四个仓库才能正确回答的查询。

## 概念

一条 AST 感知的摄入管道用 tree-sitter 解析每个文件，提取函数和类节点，并以节点边界而非固定 token 窗口进行分块。每个分块获得三种表示：一个稠密嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 词项，以及一段简短的自然语言摘要。摘要增加了第三种可检索模态——用户问"X 是如何被授权的"，摘要中提到了"authz"，即便代码里只有 `check_permission`。

检索是混合的。一次查询同时触发稠密搜索和 BM25 搜索，合并 top-k 结果，并将并集交给交叉编码器（cross-encoder）重排序器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重排序后的列表送入一个长上下文合成器（Claude Sonnet 4.7，启用提示缓存（prompt caching）；或自托管 Llama 3.3 70B），并指示其对每个断言引用文件及行号范围。不包含引用的回答将被后置过滤器拒绝。

增量新鲜度是基础设施层面的问题。git push 触发差异计算：哪些文件发生了变化，哪些符号发生了变化。只有受影响的分块需要重新嵌入。受影响的跨文件符号边（导入、方法调用）会被重新计算。索引在每次提交时保持一致性，无需重新处理全部 200 万行代码。

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

- 解析：tree-sitter，支持 17 种语言语法（Python、TypeScript、Rust、Go、Java、C++ 等）
- 稠密嵌入：Voyage-code-3（托管）或 nomic-embed-code-v1.5（自托管），bge-code-v1 作为回退方案
- 稀疏索引：Tantivy（Rust），使用 BM25F，符号名与函数体按字段加权
- 向量数据库：Qdrant 1.12（支持混合搜索），或 pgvector + pgvectorscale（适用于 5000 万向量以下的团队）
- 分块摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，启用提示缓存
- 重排序器：Cohere rerank-3 或 bge-reranker-v2-gemma-2b（自托管）
- 编排：LlamaIndex Workflows（摄入），LangGraph（查询智能体）
- 合成器：Claude Sonnet 4.7（100 万 token 上下文），启用提示缓存
- 符号图：Neo4j（托管）或 kuzu（嵌入式），用于导入和调用边
- 可观测性：Langfuse，按检索和合成步骤记录 span

## 动手构建

1. **摄入遍历器。** 每次 push hook 触发时迭代 git 历史。收集变更文件。对每个文件用 tree-sitter 解析，提取函数和类节点及其完整源代码跨度。输出分块记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **分块摘要器。** 将分块批量送入 Haiku 4.5，系统前言部分启用提示缓存。提示："用一句话概括此函数，说明其公共契约和副作用。"将摘要与分块一并存储。

3. **嵌入池。** 两条并行队列：稠密（Voyage-code-3，批量 128）和摘要（同一模型，但在摘要文本上运行）。将向量写入 Qdrant，携带载荷 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 按字段加权的 Tantivy 索引：符号名权重 4，符号体权重 1，摘要权重 2。既能支持"找到名为 X 的函数"这类查询，也能支持"找到做 X 的函数"。

5. **符号图。** 为每个分块记录边：导入（本文件使用了仓库 Z 中的符号 Y）、调用（本函数调用了类 C 上的方法 M）、继承。存入 kuzu。在查询时用于跨越仓库边界扩展检索范围。

6. **查询智能体。** LangGraph，包含三个节点。`retrieve` 并行触发稠密搜索和 BM25 搜索，按 (repo, path, symbol) 去重。`rerank` 对 top-50 结果运行交叉编码器，保留 top-10。`synth` 调用 Claude Sonnet 4.7，上下文包含重排序后的分块，缓存系统提示，要求输出 file:line 格式的引用。

7. **引用强制。** 解析模型输出；任何不含 `(repo/path:start-end)` 锚点的断言标记为需重新提问或直接丢弃。仅向用户返回带引用的回答。

8. **增量重建索引。** 对每次 webhook，计算符号级别的差异。仅对文本发生变更的分块重新嵌入。对导入关系发生变更的分块重新计算符号边。衡量指标：对于 200 万行代码的仓库集群，一次 50 个文件的 push 在 60 秒内完成重建索引。

9. **评估。** 标注 100 个跨仓库问题，附上黄金 file:line 答案。衡量 MRR@10、nDCG@10、引用忠实度（可验证锚点断言的比例），以及 p50/p99 延迟。

## 使用方式

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## 交付

可交付技能文件 `outputs/skill-codebase-rag.md`。给定一组代码仓库，它能够搭建摄入管道、混合索引和查询智能体，并为任何跨仓库问题返回带引用的回答。评分标准：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 检索质量 | 在 100 个问题的留出集上的 MRR@10 和 nDCG@10 |
| 20 | 引用忠实度 | 包含可验证 file:line 锚点的回答断言比例 |
| 20 | 延迟与扩展性 | 在索引语料规模下 10k QPS 的 p95 查询延迟 |
| 20 | 增量索引正确性 | 一次 50 个文件的提交从 git push 到可搜索的时间 |
| 15 | 用户体验与回答格式 | 引用可点击性、代码片段预览、追问能力 |
| **100** | | |

## 练习

1. 将 Voyage-code-3 替换为自托管的 nomic-embed-code。衡量 MRR@10 的差异。报告启用重排序后差距是否缩小。

2. 向语料中注入 20% 的生成代码（LLM 产生的样板代码）并重新评估。观察检索污染（retrieval poisoning）现象。向载荷中添加"generated"标记，并对这些匹配结果降权。

3. 在你的语料规模下，对比 Qdrant 混合搜索与 pgvector + pgvectorscale。报告批量大小为 1 时的 p99。

4. 添加基于采样的漂移检查：每周重新运行 100 题评估。在 MRR@10 下降超过 5% 时告警。

5. 扩展到跨语言符号解析：一个 Python 函数通过 gRPC 调用一个 Go 服务。使用符号图将它们关联起来。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| AST 感知分块 | "按函数级别切分" | 按 tree-sitter 节点边界切割代码，而非固定 token 窗口 |
| 混合搜索 | "稠密 + 稀疏" | 并行运行 BM25 和向量搜索，合并 top-k 结果，再重排序 |
| 交叉编码器重排序 | "第二阶段排序" | 同时为每对（查询，候选）打分的模型，比余弦相似度更准确 |
| 提示缓存 | "缓存的系统提示" | 2026 年 Claude / OpenAI 的功能，对重复的前缀 token 最多提供 90% 的费用折扣 |
| 符号图 | "代码图谱" | 跨文件和仓库的导入、调用、继承关系边 |
| 引用忠实度 | "可溯源回答率" | 用户可通过点击锚点并阅读引用代码片段来验证的断言比例 |
| 增量重建索引 | "从 Push 到可搜索的时间" | 从 git push 到变更符号可被查询的端到端耗时 |

## 延伸阅读

- [Sourcegraph Amp](https://ampcode.com)——生产级跨仓库代码智能
- [Sourcegraph Cody RAG 架构](https://sourcegraph.com/blog/how-cody-understands-your-codebase)——本实战项目参考的深度文章
- [Aider repo-map](https://aider.chat/docs/repomap.html)——基于 tree-sitter 的排序仓库视图
- [Augment Code 企业级图谱](https://www.augmentcode.com)——商业级符号图 RAG
- [Qdrant 混合搜索文档](https://qdrant.tech/documentation/concepts/hybrid-queries/)——参考实现
- [Voyage AI 代码嵌入](https://docs.voyageai.com/docs/embeddings)——Voyage-code-3 详情
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank)——交叉编码器参考
- [Pinterest MCP 内部搜索](https://medium.com/pinterest-engineering)——内部平台参考
