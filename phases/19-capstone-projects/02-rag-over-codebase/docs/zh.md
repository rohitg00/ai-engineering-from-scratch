# 综合项目 02 — 跨代码库 RAG（跨仓库语义搜索）

> 2026 年每家严肃的工程组织都运行着一个理解语义而非仅匹配字符串的内部代码搜索。Sourcegraph Amp、Cursor 的代码库回答、Augment 的企业图谱、Aider 的 repomap、Pinterest 的内部 MCP——形态相同。摄取多个仓库，用 tree-sitter 解析，按函数和类级别分块嵌入，混合搜索，重新排序，附带引用作答。本综合项目要求你构建一个能处理 10 个仓库共 200 万行代码，并在每次 git push 后存活增量重新索引的系统。

**类型：** 综合项目
**语言：** Python（摄取）、TypeScript（API + UI）
**前置条件：** 第 5 阶段（NLP 基础）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 17 阶段（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P17
**时间：** 30 小时

## 问题描述

到 2026 年，每个前沿编程智能体都配备了代码库检索层，因为仅靠上下文窗口无法解决跨仓库问题。Claude 的 100 万 token 上下文有帮助，但不能消除对排序检索的需求。对原始块的朴素余弦搜索会污染结果，涉及生成代码、单一代码库重复，以及很少被导入的符号的长尾。生产环境的答案是在 AST 感知块上进行混合（稠密 + BM25）搜索，配合重新排序器，并由符号引用图谱支撑。

通过索引真实代码舰队——而非一个教程仓库——并测量 MRR@10、引用保真度和增量新鲜度，你可以学到这些。失败模式是基础设施层面的：一个 10 万文件的单一代码库、一次触及一半文件的 push、一个需要跨四个仓库才能正确回答的查询。

## 核心概念

一个 AST 感知的摄取管道用 tree-sitter 解析每个文件，提取函数和类节点，并在节点边界处分块，而非固定 token 窗口。每个块有三种表示：一个稠密嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 词项，以及一个简短的自然语言摘要。摘要增加了第三种可检索模态——用户问"X 是如何被授权的"，即使代码只有 `check_permission`，摘要也会提到"authz"。

检索是混合式的。一个查询同时触发稠密和 BM25 搜索，合并 top-k，并将并集交给交叉编码器重新排序器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重新排序后的列表被送到一个长上下文合成器（带提示缓存的 Claude Sonnet 4.7，或自托管的 Llama 3.3 70B），并附指示要求按文件和行范围引用每个声明。没有引用的回答会被后置过滤器拒绝。

增量新鲜度是基础设施问题。Git push 触发一个 diff：哪些文件变了，哪些符号变了。只有受影响的块重新嵌入。受影响的跨文件符号边（导入、方法调用）被重新计算。索引保持一致，而无需在每次提交时重新处理 200 万行。

## 架构

```
git push --> webhook --> 摄取worker（LlamaIndex Workflow）
                           |
                           v
             tree-sitter 解析 + AST 分块
                           |
            +--------------+----------------+
            v              v                v
         稠密          BM25 索引       摘要（LLM）
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      符号图谱（Neo4j / kuzu）
                            |
  query --> LangGraph 智能体（retrieve -> rerank -> synth）
                            |
                            v
                      Claude Sonnet 4.7 1M 上下文
                            |
                            v
                 回答 + file:line 引用
```

## 技术栈

- 解析：tree-sitter，支持 17 种语言语法（Python、TS、Rust、Go、Java、C++ 等）
- 稠密嵌入：Voyage-code-3（托管）或 nomic-embed-code-v1.5（自托管），bge-code-v1 作为后备
- 稀疏索引：Tantivy（Rust），使用 BM25F，对符号名称和主体进行字段加权
- 向量数据库：Qdrant 1.12（支持混合搜索），或 pgvector + pgvectorscale（适用于少于 5000 万向量的团队）
- 块摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，带提示缓存
- 重新排序器：Cohere rerank-3 或自托管的 bge-reranker-v2-gemma-2b
- 编排：LlamaIndex Workflows 用于摄取，LangGraph 用于查询智能体
- 合成器：Claude Sonnet 4.7（100 万上下文），带提示缓存
- 符号图谱：Neo4j（托管）或 kuzu（嵌入式），用于导入和调用边
- 可观测性：每次检索 + 合成步骤的 Langfuse span

## 构建步骤

1. **摄取遍历器。** 在每个 push 钩子上迭代 git 历史。收集变更文件。对每个文件，用 tree-sitter 解析，提取函数和类节点及其完整源跨度。发出块记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **块摘要器。** 将块分批送入 Haiku 4.5 调用，系统前置内容上启用提示缓存。提示词："用一句话总结这个函数，说明其公开契约和副作用。"将摘要与块一起存储。

3. **嵌入池。** 两个并行队列：稠密（Voyage-code-3 批次 128）和摘要（同一模型，但在摘要字符串上）。将向量写入 Qdrant，载荷为 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 字段加权的 Tantivy 索引：符号名称权重 4，符号主体权重 1，摘要权重 2。支持"查找名为 X 的函数"查询和"查找执行 X 的函数"查询。

5. **符号图谱。** 对每个块，记录边：导入（此文件使用来自仓库 Z 的符号 Y）、调用（此函数调用类 C 上的方法 M）、继承。存储在 kuzu 中。在查询时用于跨仓库边界扩展检索。

6. **查询智能体。** 带有三个节点的 LangGraph。`retrieve` 并行触发稠密 + BM25，按 (repo, path, symbol) 去重。`rerank` 在 top-50 上运行交叉编码器，保留 top-10。`synth` 调用 Claude Sonnet 4.7，将重新排序的块放入上下文，缓存系统提示，要求 file:line 引用。

7. **引用强制执行。** 解析模型输出；任何没有 `(repo/path:start-end)` 锚点的声明都会被标记为重问或丢弃。仅返回有引用的回答给用户。

8. **增量重新索引。** 在每个 webhook 上，计算符号级 diff。仅重新嵌入文本变更的块。为导入变更的块重新计算符号边。测量指标：对于 200 万行代码舰队，50 个文件的 push 在 60 秒内重新索引完成。

9. **评估。** 用 gold file:line 回答标注 100 个跨仓库问题。测量 MRR@10、nDCG@10、引用保真度（可验证锚点的声明比例）和 p50/p99 延迟。

## 使用示例

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 个块稠密 + 7 个块 bm25，去重后 16 个唯一
[rerank]    top-5 保留（cohere rerank-3）
[synth]     claude-sonnet-4.7，缓存命中率 68%，2.1s
回答：
  Multipart 中止由 services/uploader/retry.go:122-148 中的
  `AbortMultipartOnFail` 触发，它递减 config/budgets.yaml:34-51
  中定义的每桶重试预算...
  引用：[services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## 交付成果

可交付技能 `outputs/skill-codebase-rag.md`。给定一组仓库语料库，它建立摄取管道、混合索引和查询智能体，并为任何跨仓库问题返回有引用的回答。评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 检索质量 | 在 100 个问题的留出集上的 MRR@10 和 nDCG@10 |
| 20 | 引用保真度 | 回答声明中具有可验证 file:line 锚点的比例 |
| 20 | 延迟和规模 | 在索引语料库大小下，10k QPS 时的 p95 查询延迟 |
| 20 | 增量索引正确性 | 从 git push 到可搜索的耗时（50 个文件的提交） |
| 15 | UX 和回答格式 | 引用可点击性、片段预览、后续操作空间 |
| **100** | | |

## 练习

1. 将 Voyage-code-3 换为自托管的 nomic-embed-code。测量 MRR@10 差异。报告启用重新排序后差距是否缩小。

2. 向语料库注入 20% 生成代码（LLM 产生的样板代码）并重新评估。观察检索污染。向载荷添加"generated"标志并降低这些命中的权重。

3. 在你的语料库规模下，对 Qdrant 混合搜索与 pgvector + pgvectorscale 进行基准测试。报告批次大小为 1 时的 p99。

4. 添加基于采样的漂移检查：每周重新运行 100 问题评估。在 MRR@10 下降 > 5% 时发出警报。

5. 扩展到跨语言符号解析：一个通过 gRPC 调用 Go 服务的 Python 函数。使用符号图谱链接它们。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| AST 感知分块 | "函数级拆分" | 在 tree-sitter 节点边界切割代码，而非固定 token 窗口 |
| 混合搜索 | "稠密 + 稀疏" | 并行运行 BM25 和向量搜索，合并 top-k，重新排序 |
| 交叉编码器重排 | "第二阶段排序" | 共同对每个（查询，候选）对评分的模型，比余弦更准确 |
| 提示缓存 | "缓存的系统提示" | 2026 年 Claude / OpenAI 功能，最高可折扣 90% 的重复前缀 token |
| 符号图谱 | "代码图谱" | 跨文件和仓库的导入、调用、继承边 |
| 引用保真度 | "有据回答率" | 用户可以通过点击锚点并阅读引用跨度来验证的声明比例 |
| 增量重新索引 | "push 到搜索时间" | 从 git push 到变更符号可被查询的实际时间 |

## 延伸阅读

- [Sourcegraph Amp](https://ampcode.com) — 生产级跨仓库代码智能
- [Sourcegraph Cody RAG 架构](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — 本综合项目的参考深度解析
- [Aider repo-map](https://aider.chat/docs/repomap.html) — tree-sitter 排序的仓库视图
- [Augment Code 企业图谱](https://www.augmentcode.com) — 商业符号图谱 RAG
- [Qdrant 混合搜索文档](https://qdrant.tech/documentation/concepts/hybrid-queries/) — 参考实现
- [Voyage AI 代码嵌入](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 详情
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — 交叉编码器参考
- [Pinterest MCP 内部搜索](https://medium.com/pinterest-engineering) — 内部平台参考
