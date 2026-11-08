# 綜合專案 02 —— 對程式碼庫做 RAG（跨儲存庫語意搜尋）

> 2026 年每一家認真的工程組織，都跑著一套「懂意思、而不只是懂字串」的內部程式碼搜尋。Sourcegraph Amp、Cursor 的程式碼庫問答、Augment 的企業圖譜、Aider 的 repomap、Pinterest 的內部 MCP —— 形狀都一樣。攝取多個儲存庫、用 tree-sitter 剖析、對函式與類別層級的片段做嵌入、混合搜尋、重新排序，最後帶引用作答。這個綜合專案要你建一套能撐住 10 個儲存庫、共 200 萬行程式碼，而且每次 git push 都挺得過增量重新索引的系統。

**類型：** 總結專案
**程式語言：** Python (ingestion), TypeScript (API + UI)
**先修單元：** 階段 5（NLP 基礎）、階段 7（transformer）、階段 11（LLM 工程）、階段 13（工具）、階段 17（基礎設施）
**演練到的階段：** P5 · P7 · P11 · P13 · P17
**時間：** 30 小時

## 問題

到 2026 年，每一個前沿寫程式代理都帶著一層程式碼庫檢索，因為光靠脈絡窗口解不掉跨儲存庫的問題。Claude 的 100 萬詞元脈絡有幫助；但它並沒有消除對排序式檢索的需求。在原始片段上做天真的餘弦搜尋，會在生成式程式碼、單一大型儲存庫的重複內容，以及那些鮮少被匯入的符號長尾上把結果毒掉。生產上的答案是：在 AST 感知的片段上做混合（稠密 + BM25）搜尋、配一個重排器，並以一張符號參照圖為後盾。

你要靠索引一整支真實艦隊來學會這件事 —— 不是一個教學用的儲存庫 —— 並量測 MRR@10、引用忠實度與增量新鮮度。失敗模式都是基礎設施層面的：一個 10 萬檔案的單一大型儲存庫、一次動到半數檔案的推送、一個必須跨越四個儲存庫才答得對的查詢。

## 概念

一條 AST 感知的攝取管線，用 tree-sitter 剖析每個檔案、抽出函式與類別節點，並在節點邊界而不是固定詞元窗口上切片。每個片段有三種表示：一個稠密嵌入（Voyage-code-3 或 nomic-embed-code）、稀疏的 BM25 詞項，以及一段簡短的自然語言摘要。那段摘要增加了第三種可檢索的模態 —— 使用者問「X 是怎麼做授權的」，而摘要裡提到了「authz」，即使程式碼裡只有 `check_permission`。

檢索是混合式的。一次查詢同時發動稠密與 BM25 搜尋、合併前 k 筆，再把聯集交給一個交叉編碼器重排器（Cohere rerank-3 或 bge-reranker-v2-gemma-2b）。重排後的清單送進一個長脈絡合成器（帶提示詞快取的 Claude Sonnet 4.7，或自架的 Llama 3.3 70B），並指示它替每一項主張標註檔案與行號範圍的引用。沒有引用的答案會被後置過濾器拒絕。

增量新鮮度是那個基礎設施問題。Git push 觸發一次差異比對：哪些檔案變了、哪些符號變了。只有受影響的片段需要重新嵌入。受影響的跨檔案符號邊（匯入、方法呼叫）要重算。索引維持一致，而不必每次提交都重新處理 200 萬行。

## 架構

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

## 技術堆疊

- 剖析：tree-sitter，配 17 種語言的文法（Python、TS、Rust、Go、Java、C++ 等）
- 稠密嵌入：Voyage-code-3（託管）或 nomic-embed-code-v1.5（自架），bge-code-v1 作為退路
- 稀疏索引：Tantivy（Rust），用 BM25F，在符號名稱與本體之間做欄位加權
- 向量資料庫：帶混合搜尋的 Qdrant 1.12；或對向量數低於 5000 萬的團隊用 pgvector + pgvectorscale
- 片段摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，配提示詞快取
- 重排器：Cohere rerank-3 或自架的 bge-reranker-v2-gemma-2b
- 編排：攝取用 LlamaIndex Workflows，查詢代理用 LangGraph
- 合成器：Claude Sonnet 4.7（100 萬脈絡）配提示詞快取
- 符號圖：Neo4j（託管）或 kuzu（嵌入式），存匯入邊與呼叫邊
- 可觀測性：每個檢索與合成步驟一個 Langfuse span

```figure
ce-hybrid-retrieval
```

## 動手實作

1. **攝取走訪器。** 在每個推送掛鉤上走訪 git 歷史。蒐集變更的檔案。對每個檔案用 tree-sitter 剖析，抽出函式與類別節點及其完整原始碼範圍。發出片段紀錄 `{repo, path, start_line, end_line, symbol, body}`。

2. **片段摘要器。** 把片段批次送進 Haiku 4.5 呼叫，並對系統前言啟用提示詞快取。提示詞：「用一句話摘要這個函式，說出它的公開契約與副作用。」把摘要與片段一起存起來。

3. **嵌入池。** 兩條平行佇列：稠密（Voyage-code-3，批次 128）與摘要（同一個模型，但跑在摘要字串上）。把向量寫進 Qdrant，酬載為 `{repo, path, start_line, end_line, symbol, kind}`。

4. **BM25 索引。** 欄位加權的 Tantivy 索引：符號名稱權重 4、符號本體權重 1、摘要權重 2。讓「找一個叫 X 的函式」與「找一個會做 X 的函式」這兩種查詢都行得通。

5. **符號圖。** 對每個片段記錄邊：匯入（這個檔案用到儲存庫 Z 的符號 Y）、呼叫（這個函式呼叫了類別 C 上的方法 M）、繼承。存進 kuzu。查詢時用來把檢索跨儲存庫邊界擴展出去。

6. **查詢代理。** 用 LangGraph 建三個節點。`retrieve` 平行發動稠密與 BM25，並依 (repo, path, symbol) 去重。`rerank` 對前 50 筆跑交叉編碼器，留下前 10 筆。`synth` 帶著重排後的片段呼叫 Claude Sonnet 4.7，快取系統提示詞，並要求標註 file:line 引用。

7. **引用強制。** 剖析模型輸出；任何沒有 `(repo/path:start-end)` 錨點的主張都會被標記重問或丟棄。只把有引用的答案回給使用者。

8. **增量重新索引。** 在每個 webhook 上算出符號層級的差異。只重新嵌入文字有變的片段。替匯入有變的片段重算符號邊。量測目標：在一支 200 萬行的艦隊上，一次 50 個檔案的推送要在 60 秒內重新索引完。

9. **評估。** 替 100 個跨儲存庫問題標上黃金 file:line 答案。量測 MRR@10、nDCG@10、引用忠實度（有可驗證錨點的主張比例），以及 p50/p99 延遲。

## 框架應用

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

## 產出交付

交付的技能是 `outputs/skill-codebase-rag.md`。給定一批儲存庫語料，它會把攝取管線、混合索引與查詢代理架起來，並替任何跨儲存庫問題回傳一份帶引用的答案。評分表：

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 檢索品質 | 在 100 題保留集上的 MRR@10 與 nDCG@10 |
| 20 | 引用忠實度 | 答案主張中帶可驗證 file:line 錨點的比例 |
| 20 | 延遲與規模 | 在已索引語料規模上、10k QPS 之下的 p95 查詢延遲 |
| 20 | 增量索引正確性 | 一次 50 檔案提交從 git push 到可被搜尋的時間 |
| 15 | 使用體驗與答案排版 | 引用可點擊、片段預覽、追問的可操作性 |
| **100** | | |

## 練習

1. 把 Voyage-code-3 換成自架的 nomic-embed-code。量測 MRR@10 的差值。回報開啟重排之後那個差距會不會被補上。

2. 在語料中注入 20% 的生成式程式碼（LLM 產出的樣板碼）並重新評估。觀察檢索被毒化的情況。在酬載裡加上一個 "generated" 旗標，並把那些命中降權。

3. 在你的語料規模上，對 Qdrant 混合搜尋與 pgvector + pgvectorscale 做基準測試。回報批次大小為 1 時的 p99。

4. 加上一項以抽樣為基礎的漂移檢查：每週重跑那份 100 題評估。MRR@10 掉超過 5% 就發警報。

5. 擴充到跨語言的符號解析：一個透過 gRPC 呼叫 Go 服務的 Python 函式。用符號圖把它們連起來。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| AST 感知切片 | 「函式層級的切分」 | 在 tree-sitter 的節點邊界、而非固定詞元窗口上切程式碼 |
| 混合搜尋 | 「稠密 + 稀疏」 | 平行跑 BM25 與向量搜尋、合併前 k 筆、再重排 |
| 交叉編碼器重排 | 「第二階段排序」 | 把（查詢, 候選）配對放在一起評分的模型，比餘弦更準 |
| 提示詞快取 | 「快取住的系統提示詞」 | 2026 年 Claude / OpenAI 的功能，對重複前綴詞元最高折 90% |
| 符號圖 | 「程式碼圖譜」 | 跨檔案與跨儲存庫的匯入、呼叫、繼承邊 |
| 引用忠實度 | 「有接地的答案比例」 | 使用者能點開錨點、讀到被引用範圍而加以驗證的主張比例 |
| 增量重新索引 | 「推送到可搜尋的時間」 | 從 git push 到變更符號可被查詢之間的實際時間 |

## 延伸閱讀

- [Sourcegraph Amp](https://ampcode.com) —— 生產環境的跨儲存庫程式碼智能
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) —— 這個綜合專案的參考深度剖析
- [Aider repo-map](https://aider.chat/docs/repomap.html) —— tree-sitter 的排序式儲存庫檢視
- [Augment Code enterprise graph](https://www.augmentcode.com) —— 商業的符號圖 RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) —— 參考實作
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) —— Voyage-code-3 的細節
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) —— 交叉編碼器的參考
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) —— 內部平台的參考
