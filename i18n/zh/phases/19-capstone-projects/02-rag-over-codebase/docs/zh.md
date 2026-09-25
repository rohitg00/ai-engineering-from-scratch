# Capstone 02 — 代码库 RAG（跨仓库语义搜索）

> 2026 年，每个严肃的工程组织都在运行能理解语义而非仅匹配字符串的内部代码搜索。Sourcegraph Amp、Cursor 的代码库问答、Augment 的企业图谱、Aider 的 repomap、Pinterest 的内部 MCP——形态都一样。摄取多个仓库，用 tree-sitter 解析，嵌入函数级和类级的代码块，混合检索，重排序，给出带引用的回答。本 Capstone 要求你构建一个能处理 10 个仓库、200 万行代码，并在每次 git push 时支持增量重建索引的系统。

**Type:** Capstone
**Languages:** Python（摄取）、TypeScript（API + UI）
**Prerequisites:** Phase 5（NLP 基础）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 17（基础设施）
**Phases exercised:** P5 · P7 · P11 · P13 · P17
**Time:** 30 小时

## 问题

到 2026 年，每个前沿编码代理都自带代码库检索层，因为仅靠上下文窗口无法解决跨仓库问题。Claude 的 1M token 上下文有帮助；它并不能消除对排序检索的需求。对原始代码块做朴素的余弦搜索，会在生成代码、monorepo 中的重复代码以及很少被导入的符号的长尾上产生毒化结果。生产级答案是：基于 AST 感知的代码块做混合（稠密 + BM25）搜索，配备重排序器，并由符号引用图谱支撑。

你将通过索引一组真实的仓库——而不是某个教程仓库——并测量 MRR@10、引用忠实度和增量新鲜度来学习这一点。失败模式是基础设施层面的：一个 10 万文件的 monorepo、一次触及一半文件的 push、一个需要跨四个仓库才能正确回答的查询。

## 概念

AST 感知的摄取管线用 tree-sitter 解析每个文件，提取函数和类节点，并在节点边界而非固定 token 窗口处切块。每个代码块有三种表示：稠密嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 词项，以及一段简短的自然语言摘要。摘要提供了第三种可检索模态——用户会问"X 是如何鉴权的"，而摘要里提到"authz"，即使代码里只有 `check_permission`。

检索是混合的。查询同时触发稠密检索和 BM25 检索，合并 top-k，并将并集交给交叉编码器重排序器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重排序后的列表交给长上下文合成器（带 prompt 缓存的 Claude Sonnet 4.7，或自托管的 Llama 3.3 70B），并要求其通过文件和行号范围为每条论断提供引用。没有引用的回答会被后置过滤器拒绝。

增量新鲜度是基础设施问题。Git push 触发一次 diff：哪些文件变了，哪些符号变了。只有受影响的代码块需要重新嵌入。受影响的跨文件符号边（导入、方法调用）需要重新计算。索引保持一致，无需每次提交都重新处理 200 万行代码。

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

- 解析：tree-sitter，支持 17 种语言语法（Python、TS、Rust、Go、Java、C++ 等）
- 稠密嵌入：Voyage-code-3（托管）或 nomic-embed-code-v1.5（自托管），备选 bge-code-v1
- 稀疏索引：Tantivy（Rust），使用 BM25F，对符号名与函数体做字段加权
- 向量数据库：Qdrant 1.12（支持混合搜索），或 5000 万向量以下团队使用 pgvector + pgvectorscale
- 代码块摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，启用 prompt 缓存
- 重排序器：Cohere rerank-3 或自托管 bge-reranker-v2-gemma-2b
- 编排：摄取用 LlamaIndex Workflows，查询代理用 LangGraph
- 合成器：带 prompt 缓存的 Claude Sonnet 4.7（1M 上下文）
- 符号图谱：导入与调用边使用 Neo4j（托管）或 kuzu（嵌入式）
- 可观测性：每次检索 + 合成步骤都有 Langfuse span

```figure
ce-hybrid-retrieval
```

## 动手构建

1. **摄取遍历器。** 在每次 push 钩子上迭代 git 历史。收集变更文件。对每个文件，用 tree-sitter 解析，提取函数和类节点及其完整源码跨度。输出代码块记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **代码块摘要器。** 将代码块分批送入 Haiku 4.5 调用，并对系统前导词启用 prompt 缓存。提示词："用一句话总结这个函数，说明其公开契约和副作用。" 将摘要与代码块一起存储。

3. **嵌入池。** 两条并行队列：稠密（Voyage-code-3，批次 128）和摘要（同一模型，但作用于摘要字符串）。将向量连同 payload `{repo, path, start_line, end_line, symbol, kind}` 写入 Qdrant。

4. **BM25 索引。** 字段加权的 Tantivy 索引：符号名权重 4，符号体权重 1，摘要权重 2。在"找出做 X 的函数"之外，同时支持"找出名为 X 的函数"的查询。

5. **符号图谱。** 对每个代码块记录边：导入（本文件使用了仓库 Z 中的符号 Y）、调用（本函数调用了类 C 上的方法 M）、继承。存入 kuzu。查询时用于跨仓库边界扩展检索。

6. **查询代理。** LangGraph，三个节点。`retrieve` 并行触发稠密 + BM25，按 (repo, path, symbol) 去重。`rerank` 在 top-50 上运行交叉编码器并保留 top-10。`synth` 调用 Claude Sonnet 4.7，将重排序后的代码块放入上下文，缓存系统提示词，要求 file:line 引用。

7. **引用强制。** 解析模型输出；任何没有 `(repo/path:start-end)` 锚点的论断会被标记要求重答或丢弃。只返回带引用的回答给用户。

8. **增量重建索引。** 在每个 webhook 上计算符号级 diff。只重新嵌入文本发生变化的代码块。对导入发生变化的代码块重新计算符号边。衡量标准：对 200 万行的仓库群，一次 50 个文件的 push 在 60 秒内完成重建索引。

9. **评估。** 标注 100 个带标准 file:line 答案的跨仓库问题。测量 MRR@10、nDCG@10、引用忠实度（有可验证锚点的论断比例），以及 p50/p99 延迟。

## 使用它

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

## 交付它

交付技能 `outputs/skill-codebase-rag.md`。给定一组仓库语料，它能搭建摄取管线、混合索引和查询代理，并对任意跨仓库问题返回带引用的回答。评分标准：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 检索质量 | 在 100 题的留出集上的 MRR@10 与 nDCG@10 |
| 20 | 引用忠实度 | 回答中带可验证 file:line 锚点的论断比例 |
| 20 | 延迟与规模 | 在已索引语料规模上，10k QPS 下的 p95 查询延迟 |
| 20 | 增量索引正确性 | 一次 50 文件提交从 git push 到可搜索的耗时 |
| 15 | 用户体验与回答格式 | 引用可点击性、片段预览、追问入口 |
| **100** | | |

## 练习

1. 将 Voyage-code-3 换成自托管的 nomic-embed-code。测量 MRR@10 的差值。报告启用重排序后差距是否消失。

2. 向语料中注入 20% 的生成代码（LLM 生成的样板代码）并重新评估。观察检索毒化现象。在 payload 中添加"generated"标志并下调这些命中的权重。

3. 在你的语料规模下对 Qdrant 混合搜索与 pgvector + pgvectorscale 进行基准测试。报告批次大小为 1 时的 p99。

4. 添加基于抽样的漂移检查：每周重跑 100 题评估。当 MRR@10 下降超过 5% 时告警。

5. 扩展到跨语言符号解析：一个通过 gRPC 调用 Go 服务的 Python 函数。使用符号图谱将它们关联起来。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| AST 感知切块 | "函数级切分" | 在 tree-sitter 节点边界而非固定 token 窗口处切分代码 |
| 混合搜索 | "稠密 + 稀疏" | 并行运行 BM25 与向量搜索，合并 top-k，重排序 |
| 交叉编码器重排序 | "第二阶段排序" | 对每个 (查询, 候选) 对共同打分的模型，比余弦相似度更准确 |
| Prompt 缓存 | "缓存的系统提示词" | 2026 年 Claude / OpenAI 的功能，对重复前缀 token 提供最高 90% 的折扣 |
| 符号图谱 | "代码图谱" | 跨文件和仓库的导入、调用、继承边 |
| 引用忠实度 | "有据回答率" | 用户可以通过点击锚点并阅读所引用片段来验证的论断比例 |
| 增量重建索引 | "push 到可搜索的时间" | 从 git push 到变更符号可被查询的实际耗时 |

## 延伸阅读

- [Sourcegraph Amp](https://ampcode.com) — 生产级跨仓库代码智能
- [Sourcegraph Cody RAG 架构](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — 本 Capstone 的参考深度剖析
- [Aider repo-map](https://aider.chat/docs/repomap.html) — 基于 tree-sitter 的仓库排序视图
- [Augment Code 企业图谱](https://www.augmentcode.com) — 商业符号图谱 RAG
- [Qdrant 混合搜索文档](https://qdrant.tech/documentation/concepts/hybrid-queries/) — 参考实现
- [Voyage AI 代码嵌入](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 详情
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — 交叉编码器参考
- [Pinterest MCP 内部搜索](https://medium.com/pinterest-engineering) — 内部平台参考