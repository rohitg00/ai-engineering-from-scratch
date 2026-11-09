#                      

> 每一个认真的工程机构在2026年都会进行内部代码搜索, 源图扩展器,Cursor的代码基础答案, Augment的企业图,Aider的重绘图,Pinterest的内部MCP 相同的形状. 取许多回复,用树分析,嵌入函数和类级分类,混合搜索,重新排名,回答引用. 这块顶石要求你构建一个处理2万行代码的代码,

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**五·七·十一·十三·十七
**Time:** 30 hours

## 问题

到2026年,每个边境编码代理都将运输一个代码基础检索层,因为单独的语境窗口无法解决跨度问题. 克劳德的1M代币背景有助于;它并没有消除排名检索的需要. 简单的搜索原始的毒品, 结果是生成代码, 单体复制, 生产答案是通过重新排名的AST意识的块进行混合 (密度+BM25) 搜索,支持符号引用图.

通过索引一个真正的机队,而不是一个教程 repo,测量MRR@10,引用忠诚度和增量新鲜度来学习这一点. 失败模式是基础设施的:一个100k文件单元 repo,一个重复一半文件的推力,一个需要跨越四个 repos才能正确回答.

## 概念

基于AST的摄入管道通过树座仪分析每个文件,提取函数和类节点,并将节点的块放在节点边界而不是固定的代币窗口. 每个部分都得到了三个表示:密集嵌入 (旅行代码-3或名字嵌入代码),稀缺的BM25术语,以及简短的自然语言摘要. 总结中添加了第三种可检索的模式用户问"X是如何授权的"总结中提到"authz",即使代码只有`check_permission`现在,我们要去.

复苏是混合物. 一个查询会发射密集和BM25搜索,并合并top-k,并将联盟交给一个跨编码重新排名器 (Cohere重排-3或bge-重排-v2-gemma-2b). 重新排名的列表将被转移到长文本合成器 (Claude Sonnet 4.7 与快速缓存,或Llama 3.3 70B自主托管) 没有引用的答案被后过所拒绝.

增长新鲜性是基础设施问题. Git 推进会引发差异:哪些文件改变,哪些符号改变.只有受影响的块重新嵌入.受影响的跨文件符号边缘 (进口,方法调用) 重新计算.索引保持一致,不需要重新处理2M行.

## 建筑

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

## 堆

- 解析:有17种语言语法的树守 (Python,TS,Rust,Go,Java,C++等)
- 密集嵌入式: Voyage-code-3 (托管) 或名式嵌入式代码-v1.5 (自主托管), bge-code-v1倒退
- 率指数:与BM25F的性 (性),按符号名称与体格进行田径权重
- 矢量DB:Qdrant 1.12 混合搜索,或pgvector + pgvector尺度为50M以下的团队
- 零件总结模型:克劳德海库4.5或双子 2.5 闪存,即时缓存
- 排名重:Cohere排名-3或bge排名重-v2-gemma-2b自主托管
- 调整:LlamaIndex 摄入工作流程,查询代理的LangGraph
- 合成器:Claude Sonnet 4.7 (1M语境) 随时缓存
- 符号图:进口和调用边缘 Neo4j (管理) 或 kuzu (嵌入式)
- 观察性:每次检索+合成步骤的长跨度

```figure
ce-hybrid-retrieval
```

## 建立它

1. **Ingestion walker.**按每一个按上重复 Git 历史记录.收集已更改的文件.每个文件,用树监管器分析,提取函数和类节点,以其全部源跨度. 发送分类记录.`{repo, path, start_line, end_line, symbol, body}`现在,我们要去.

2. **Chunk summarizer.**按组分分为Haiku 4.5调用,即时缓存系统序言. 提示:"将这个函数总结成一个句子,命名其公开合约和副作用". 随着部分存储总结.

3. **Embedding pool.**两条平行队列:密集 (旅行代码-3批量128) 和总结 (相同的模型,但在总结字符串上).`{repo, path, start_line, end_line, symbol, kind}`现在,我们要去.

4. **BM25 index.**字段权重的Tantivy指数:符号名称重量4,符号体重量1,总结重量2. 启用"找到名为X的函数"查询,并加上"找到X的函数".

5. **Symbol graph.**对于每个部分,记录边缘:进口 (本文件使用 repo Z 的符号 Y),调用 (本函数在 C 类上调用方法 M),继承.存储在 kuzu 中.在查询时用于扩大回收跨 repo 边界.

6. **Query agent.**具有三个节点的兰格格拉夫.`retrieve`密度火 + BM25平行,乘以 (repo,路径,符号) 倍增.`rerank`运行跨码器在50上,保持10上.`synth`调用Claude Sonnet 4.7在文本中重新排名的部分,缓存系统提示,需要文件:行引用.

7. **Citation enforcement.**分析模型输出; 任何没有 `(repo/path:start-end)`给用户返回只引用答案.

8. **Incremental re-index.**在每个网关上,计算符号级别差异. 只有重新嵌入的部分,其文字发生了变化. 重新计算进口发生了变化的部分的符号边缘. 测量:为2M-LOC舰队,50文件推重索引在60秒内.

9. **Eval.**标签100个跨度问题,以黄金文件:线答. 测量MRR@10,nDCG@10,引用忠实性 (有可验证的杆的索赔的部分) 和p50/p99延迟.

## 用它

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

## 运送它

能提供的技能`outputs/skill-codebase-rag.md`鉴于复制文件,它会查询摄入量管道,混合指数和查询代理,并返回任何复制问题上引用的答案.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## 运动

1. 换取自主托管的名字嵌入式代码.测量MRR@10三角形.报告是否在重新排名启用时关闭差距.

2. 注入20%生成代码 (LLM生产的炉板) 进入体内,重新评估.观察检索中毒.添加"生成"旗到有效载荷中,减轻这些击中.

3. 基准测量Qdrant混合搜索与pgvector +pgvectorscale在您的体积. 报告p99在批量1.

4. 增加基于样本的漂移检查:每周,重复100个问题评估.

5. 扩展到跨语言符号分辨率:一个Python函数,通过gRPC调用Go服务.使用符号图来链接它们.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## 进一步阅读

- [Sourcegraph Amp](https://ampcode.com)生产跨度报告代码信息
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase)这个顶石的参考深度潜水
- [Aider repo-map](https://aider.chat/docs/repomap.html)树排名的回复视图
- [Augment Code enterprise graph](https://www.augmentcode.com)商业象征图RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/)参考实施
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings)旅行代码-3详细信息
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank)跨编码器参考
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering)内部平台参考
