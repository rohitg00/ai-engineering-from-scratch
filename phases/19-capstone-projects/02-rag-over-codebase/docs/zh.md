# 顶点项目 02 —— 代码库 RAG（跨仓库语义搜索）

> 2026 年，每个严肃的工程组织都运行一个理解含义而不仅仅是字符串的内部代码搜索。Sourcegraph Amp、Cursor 的代码库答案、Augment 的企业图谱、Aider 的 repomap、Pinterest 的内部 MCP —— 形状相同。摄取多个仓库，用 tree-sitter 解析，嵌入函数和类级别的块，混合搜索，重新排序，用引用回答。这个顶点项目要求你构建一个能处理 10 个仓库 200 万行代码并在每次 git push 时存活增量重新索引的系统。

**类型：** 顶点项目
**语言：** Python（摄取）、TypeScript（API + UI）
**先决条件：** Phase 5（NLP 基础）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 17（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P17
**时间：** 30 小时

## 问题

到 2026 年，每个前沿编码智能体都配备代码库检索层，因为仅靠上下文窗口无法解决跨仓库问题。Claude 的 100 万 token 上下文有帮助；它不能消除对排序检索的需求。对原始块的朴素余弦搜索在生成代码、monorepo 重复和很少导入符号的长尾上污染结果。生产答案是混合（密集 + BM25）搜索，基于 AST 感知的块，带有重新排序器，由符号引用图谱支持。

你通过索引一个真实的舰队来学习——不是一个教程仓库——并测量 MRR@10、引用忠实度和增量新鲜度。失败模式是基础设施性的：一个 10 万文件的 monorepo、一个重新触及一半文件的推送、一个需要跨四个仓库才能正确回答的查询。

## 概念

AST 感知摄取管道用 tree-sitter 解析每个文件，提取函数和类节点，并在节点边界而不是固定 token 窗口处分块。每个块获得三种表示：密集嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 术语和简短的自然语言摘要。摘要添加了第三种可检索模态——用户问"X 如何被授权"，摘要提到"authz"，即使代码只有 `check_permission`。

检索是混合的。查询同时触发密集和 BM25 搜索，合并 top-k，并将并集交给交叉编码器重新排序器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重新排序的列表进入长上下文合成器（Claude Sonnet 4.7 带提示缓存，或 Llama 3.3 70B 自托管），指令要求按文件和行范围引用每个声明。没有引用的答案被后过滤器拒绝。

增量新鲜度是基础设施问题。Git push 触发差异：哪些文件更改，哪些符号更改。只有受影响的块重新嵌入。受影响的跨文件符号边（导入、方法调用）重新计算。索引保持一致，无需每次提交处理 200 万行。

## 架构

```
git push --> webhook --> 摄取工作器（LlamaIndex Workflow）
                           |
                           v
             tree-sitter 解析 + AST 分块
                           |
            +--------------+----------------+
            v              v                v
          密集        BM25 索引       摘要（LLM）
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      符号图谱（Neo4j / kuzu）
                            |
  查询 --> LangGraph 智能体（检索 -> 重新排序 -> 合成）
                            |
                            v
                 Claude Sonnet 4.7 1M 上下文
                            |
                            v
                 答案 + file:line 引用
```

## 技术栈

- 解析：tree-sitter，17 种语言语法（Python、TS、Rust、Go、Java、C++ 等）
- 密集嵌入：Voyage-code-3（托管）或 nomic-embed-code-v1.5（自托管），bge-code-v1 后备
- 稀疏索引：Tantivy（Rust），带 BM25F，符号名称与正文的字段加权
- 向量数据库：Qdrant 1.12，带混合搜索，或 pgvector + pgvectorscale，用于 5000 万向量以下的团队
- 块摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，提示缓存
- 重新排序器：Cohere rerank-3 或 bge-reranker-v2-gemma-2b 自托管
- 编排：LlamaIndex Workflows 用于摄取，LangGraph 用于查询智能体
- 合成器：Claude Sonnet 4.7（1M 上下文），带提示缓存
- 符号图谱：Neo4j（托管）或 kuzu（嵌入式），用于导入和调用边
- 可观察性：Langfuse 跨度，每次检索 + 合成步骤

## 构建它

1. **摄取遍历器。** 在每个推送钩子上迭代 git 历史。收集更改的文件。对于每个文件，用 tree-sitter 解析，提取函数和类节点及其完整源跨度。发出块记录 `{repo, path, start_line, end_line, symbol, body}`。

2. **块摘要器。** 将块批处理到 Haiku 4.5 调用中，系统前言上带提示缓存。提示："用一句话总结这个函数，命名其公共契约和副作用。"将摘要与块一起存储。

3. **嵌入池。** 两个并行队列：密集（Voyage-code-3 批处理 128）和摘要（相同模型，但在摘要字符串上）。将向量写入 Qdrant，负载为 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 字段加权 Tantivy 索引：符号名称权重 4，符号正文权重 1，摘要权重 2。支持"找到名为 X 的函数"查询以及"找到执行 X 的函数"。

5. **符号图谱。** 对于每个块，记录边：导入（此文件使用来自仓库 Z 的符号 Y）、调用（此函数调用类 C 上的方法 M）、继承。存储在 kuzu 中。查询时用于跨仓库边界扩展检索。

6. **查询智能体。** LangGraph，三个节点。`检索` 并行触发密集 + BM25，按 (repo, path, symbol) 去重。`重新排序` 在 top-50 上运行交叉编码器并保留 top-10。`合成` 调用 Claude Sonnet 4.7，将重新排序的块放入上下文，缓存系统提示，要求 file:line 引用。

7. **引用强制执行。** 解析模型输出；任何没有 `(repo/path:start-end)` 锚点的声明被标记为重新询问或丢弃。仅将带引用的答案返回给用户。

8. **增量重新索引。** 在每个 webhook 上，计算符号级差异。仅重新嵌入文本更改的块。重新计算导入更改的块的符号边。测量：50 文件推送在 200 万 LOC 舰队中重新索引不到 60 秒。

9. **评估。** 标记 100 个跨仓库问题，带有黄金 file:line 答案。测量 MRR@10、nDCG@10、引用忠实度（带有可验证锚点的声明比例）和 p50/p99 延迟。

## 使用它

```
$ code-rag ask "S3 多部分中止如何接入我们的重试预算？"
[检索]  12 个密集块 + 7 个 bm25 块，去重后 16 个唯一
[重新排序]    保留 top-5（cohere rerank-3）
[合成]     claude-sonnet-4.7，缓存命中率 68%，2.1 秒
答案：
  多部分中止由 services/uploader/retry.go:122-148 中的
  `AbortMultipartOnFail` 触发，该函数递减在
  config/budgets.yaml:34-51 中定义的每个存储桶重试预算 ...
  引用：[services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## 交付它

可交付技能 `outputs/skill-codebase-rag.md`。给定仓库语料库，它建立摄取管道、混合索引和查询智能体，并返回任何跨仓库问题的引用答案。评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 检索质量 | 100 问题保留集上的 MRR@10 和 nDCG@10 |
| 20 | 引用忠实度 | 带有可验证 file:line 锚点的答案声明比例 |
| 20 | 延迟和规模 | 索引语料库大小下 10k QPS 的 p95 查询延迟 |
| 20 | 增量索引正确性 | 50 文件提交从 git push 到可搜索的时间 |
| 15 | 用户体验和答案格式 | 引用可点击性、片段预览、后续交互便利性 |
| **100** | | |

## 练习

1. 将 Voyage-code-3 替换为自托管的 nomic-embed-code。测量 MRR@10 差异。报告重新排序启用时差距是否缩小。

2. 向语料库注入 20% 生成代码（LLM 生成的样板）并重新评估。观察检索污染。向负载添加"生成"标志并降低这些命中的权重。

3. 在你的语料库大小下对 Qdrant 混合搜索与 pgvector + pgvectorscale 进行基准测试。报告批处理大小 1 的 p99。

4. 添加基于采样的漂移检查：每周，重新运行 100 问题评估。MRR@10 下降 > 5% 时警报。

5. 扩展到跨语言符号解析：一个通过 gRPC 调用 Go 服务的 Python 函数。使用符号图谱链接它们。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| AST 感知分块 | "函数级拆分" | 在 tree-sitter 节点边界而不是固定 token 窗口处切割代码 |
| 混合搜索 | "密集 + 稀疏" | 并行运行 BM25 和向量搜索，合并 top-k，重新排序 |
| 交叉编码器重新排序 | "第二阶段排序" | 一起评分每个（查询，候选）对的模型，比余弦更准确 |
| 提示缓存 | "缓存的系统提示" | 2026 Claude / OpenAI 功能，对重复前缀 token 折扣高达 90% |
| 符号图谱 | "代码图谱" | 跨文件和仓库的导入、调用、继承的边 |
| 引用忠实度 | "有根据的答案率" | 用户可以通过点击锚点并阅读引用跨度来验证的声明比例 |
| 增量重新索引 | "Push-to-search 时间" | 从 git push 到更改的符号可查询的挂钟时间 |

## 延伸阅读

- [Sourcegraph Amp](https://ampcode.com) —— 生产跨仓库代码智能
- [Sourcegraph Cody RAG 架构](https://sourcegraph.com/blog/how-cody-understands-your-codebase) —— 这个顶点项目的参考深度解析
- [Aider repo-map](https://aider.chat/docs/repomap.html) —— tree-sitter 排序的仓库视图
- [Augment Code 企业图谱](https://www.augmentcode.com) —— 商业符号图谱 RAG
- [Qdrant 混合搜索文档](https://qdrant.tech/documentation/concepts/hybrid-queries/) —— 参考实现
- [Voyage AI 代码嵌入](https://docs.voyageai.com/docs/embeddings) —— Voyage-code-3 详情
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) —— 交叉编码器参考
- [Pinterest MCP 内部搜索](https://medium.com/pinterest-engineering) —— 内部平台参考
