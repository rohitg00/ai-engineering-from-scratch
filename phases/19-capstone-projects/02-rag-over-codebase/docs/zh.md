# Capstone 02 — 代码库之上的 RAG（跨仓库语义搜索）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年，每一家正经的工程组织内部都跑着一套理解「语义」而非仅仅「字符串」的代码搜索。Sourcegraph Amp、Cursor 的代码库问答、Augment 的企业级 graph、Aider 的 repomap、Pinterest 的内部 MCP——形态都一样。摄入多个仓库，用 tree-sitter 解析，对函数和类级别的 chunk 做 embedding（嵌入），混合检索，rerank（重排），带引用作答。本 capstone 要求你构建一套能处理 10 个仓库、共计 200 万行代码的系统，并且在每次 git push 之后都能扛住增量重建索引。

**Type:** Capstone
**Languages:** Python（摄入侧）、TypeScript（API + UI）
**Prerequisites:** Phase 5（NLP 基础）、Phase 7（transformer）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 17（基础设施）
**Phases exercised:** P5 · P7 · P11 · P13 · P17
**Time:** 30 小时

## 问题（Problem）

到了 2026 年，每个前沿编码 agent 都自带一层代码库检索，因为光靠 context window（上下文窗口）解决不了跨仓库的问题。Claude 的 1M-token context 有用，但消除不了对带排序检索的需求。在原始 chunk 上做朴素余弦检索，会被生成代码、monorepo 重复、以及那些极少被 import 的长尾符号毒化结果。生产级答案是：在 AST-aware（AST 感知）的 chunk 上跑混合检索（dense + BM25），加一个 reranker（重排器），背后再挂一张符号引用图。

学这件事的方式只能是：去索引一个真实的仓库群——不是某个教程仓——并测量 MRR@10、引用忠实度（citation faithfulness）和增量新鲜度。失败模式都是基础设施层面的：10 万文件的 monorepo、一次重写一半文件的 push、一个必须跨四个仓库才能正确回答的查询。

## 概念（Concept）

AST 感知的摄入流水线（pipeline）用 tree-sitter 解析每个文件，抽出函数和类节点，按节点边界切 chunk，而不是按固定 token 窗口切。每个 chunk 拿到三种表示：一个 dense embedding（Voyage-code-3 或 nomic-embed-code）、一组稀疏的 BM25 词项、以及一段简短的自然语言摘要。摘要补上了第三个可检索通道——用户问「X 是怎么做授权的」，摘要里会出现「authz」，哪怕代码里只有 `check_permission`。

检索是混合的。一次查询同时发起 dense 与 BM25 两路搜索，合并 top-k，把并集交给一个 cross-encoder reranker（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重排后的列表再喂给一个长 context 合成器（带 prompt caching 的 Claude Sonnet 4.7，或自托管的 Llama 3.3 70B），并要求它对每条主张都按文件和行号区间标引用。没引用的回答会被一个后置过滤器拒掉。

增量新鲜度是基础设施层面的难题。git push 触发一次 diff：哪些文件变了、哪些符号变了。只有受影响的 chunk 才会重新 embedding。受影响的跨文件符号边（import、方法调用）才会重算。索引保持一致，每次 commit 也不需要重处理 200 万行代码。

## 架构（Architecture）

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

## 技术栈（Stack）

- 解析：tree-sitter，覆盖 17 种语言文法（Python、TS、Rust、Go、Java、C++ 等）
- Dense embedding：Voyage-code-3（托管）或 nomic-embed-code-v1.5（自托管），bge-code-v1 兜底
- 稀疏索引：Tantivy（Rust 实现），用 BM25F，对符号名 vs 函数体做字段加权
- 向量数据库：Qdrant 1.12 带 hybrid search；或对 50M 向量以下的团队用 pgvector + pgvectorscale
- Chunk 摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，开 prompt caching
- Reranker：Cohere rerank-3 或自托管的 bge-reranker-v2-gemma-2b
- 编排：摄入用 LlamaIndex Workflows，查询 agent 用 LangGraph
- 合成器：Claude Sonnet 4.7（1M context）+ prompt caching
- 符号图：Neo4j（托管）或 kuzu（嵌入式），存 import 与 call 边
- 可观测性：Langfuse 在每次检索 + 合成步骤打 span

## 动手实现（Build It）

1. **摄入 walker。** 每次 push hook 来了就遍历 git 历史，收集变更文件。每个文件用 tree-sitter 解析，抽出函数和类节点连同完整源码区间。产出 chunk 记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **Chunk 摘要器。** 把 chunk 批量打到 Haiku 4.5，对 system 前缀开 prompt caching。Prompt：「Summarize this function in one sentence, naming its public contract and side effects.」摘要和 chunk 一起存。

3. **Embedding 池。** 两条并行队列：dense（Voyage-code-3，batch 128）和 summary（同一个模型，但作用在摘要字符串上）。把向量写进 Qdrant，payload 为 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 字段加权的 Tantivy 索引：符号名权重 4，函数体权重 1，摘要权重 2。这让「找名字叫 X 的函数」和「找做 X 的函数」两类查询都能跑。

5. **符号图。** 给每个 chunk 记录边：import（这个文件用到了仓库 Z 的符号 Y）、call（这个函数调用了类 C 的方法 M）、inheritance（继承）。存进 kuzu。查询时用它来跨仓库边界扩展检索。

6. **查询 agent。** LangGraph 三个节点。`retrieve` 并行发起 dense + BM25，按 (repo, path, symbol) 去重。`rerank` 在 top-50 上跑 cross-encoder，留 top-10。`synth` 拿重排后的 chunk 作为 context 调 Claude Sonnet 4.7，缓存 system prompt，强制要求 file:line 引用。

7. **引用强制。** 解析模型输出；任何不带 `(repo/path:start-end)` 锚点的主张都被打标重问或丢弃。只把带引用的回答返还给用户。

8. **增量重索引。** 每次 webhook 算一次符号级 diff。只有文本变了的 chunk 才重新 embedding。只有 import 变了的 chunk 才重算符号边。指标：在一个 200 万行代码的仓库群上，一次 50 文件的 push 在 60 秒内完成重索引。

9. **评估（Eval）。** 标注 100 个跨仓库问题，每个都给出黄金 file:line 答案。测 MRR@10、nDCG@10、引用忠实度（带可验证锚点的主张占比）、以及 p50 / p99 延迟。

## 用起来（Use It）

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

## 上线部署（Ship It）

交付物是 skill `outputs/skill-codebase-rag.md`。给定一组仓库语料，它能搭起摄入流水线、混合索引、查询 agent，并对任何跨仓库问题返回带引用的答案。评分表：

| 权重 | 标准 | 怎么测 |
|:-:|---|---|
| 25 | 检索质量 | 100 题 held-out 集上的 MRR@10 与 nDCG@10 |
| 20 | 引用忠实度 | 答案中带可验证 file:line 锚点的主张占比 |
| 20 | 延迟与规模 | 在该索引语料规模上、10k QPS 下的 p95 查询延迟 |
| 20 | 增量索引正确性 | 一次 50 文件 commit 从 git push 到可搜索的耗时 |
| 15 | UX 与回答格式 | 引用可点击性、片段预览、追问入口 |
| **100** | | |

## 练习（Exercises）

1. 把 Voyage-code-3 换成自托管的 nomic-embed-code。测 MRR@10 的差值。报告开启 reranker 后差距是否收敛。

2. 往语料里注入 20% 的生成代码（LLM 产出的样板），重新评测。观察检索被毒化的现象。给 payload 加一个 `generated` 标志，并对这些命中做降权。

3. 在你的语料规模上，对 Qdrant hybrid search 与 pgvector + pgvectorscale 做基准测试。报告 batch size 为 1 时的 p99。

4. 加一个基于采样的 drift 检查：每周重跑 100 题评测。MRR@10 跌幅大于 5% 时报警。

5. 扩展到跨语言符号解析：一个 Python 函数通过 gRPC 调用 Go 服务。用符号图把它们连起来。

## 关键术语（Key Terms）

| 术语 | 大家会怎么说 | 它实际是什么 |
|------|-----------------|------------------------|
| AST-aware chunking | 「按函数级别切」 | 按 tree-sitter 节点边界切代码，而不是按固定 token 窗口 |
| Hybrid search | 「Dense + sparse」 | 同时跑 BM25 与向量检索，合并 top-k，再 rerank |
| Cross-encoder rerank | 「二阶段排序」 | 把 (query, candidate) 一起打分的模型，比余弦更准 |
| Prompt caching | 「缓存的 system prompt」 | 2026 年 Claude / OpenAI 的特性，对重复前缀 token 最多打 9 折 |
| Symbol graph | 「Code graph」 | 跨文件、跨仓库的 import、call、inheritance 边 |
| Citation faithfulness | 「Grounded answer rate（接地率）」 | 用户点开锚点、读到对应区间就能验证的主张占比 |
| Incremental re-index | 「Push-to-search 时间」 | 从 git push 到变更符号可被查询的真实耗时 |

## 延伸阅读（Further Reading）

- [Sourcegraph Amp](https://ampcode.com) —— 生产级跨仓库代码智能
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) —— 本 capstone 的参考深度文章
- [Aider repo-map](https://aider.chat/docs/repomap.html) —— tree-sitter 排序的仓库视图
- [Augment Code enterprise graph](https://www.augmentcode.com) —— 商业化的符号图 RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) —— 参考实现
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) —— Voyage-code-3 细节
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) —— cross-encoder 参考
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) —— 内部平台参考
