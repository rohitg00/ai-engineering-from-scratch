# 專案實戰 02——基於程式碼儲存庫的 RAG 檢索（跨儲存庫語義搜尋）（Capstone 02 — RAG over Codebase (Cross-Repo Semantic Search)）

> 到了 2026 年，每一家嚴謹的工程團隊內部皆運作著一套能真正理解語義而非僅做字串匹配的程式碼搜尋引擎。Sourcegraph Amp、Cursor 的 Codebase 問答、Augment 的企業程式碼圖譜、Aider 的 repomap，以及 Pinterest 內部的 MCP 檢索——皆共享相似的架構。跨多個程式碼儲存庫攝取資料、使用 tree-sitter 進行語法解析、在函式與類別層次切割分塊並為程式碼區塊計算 embedding、實施混合搜尋、二次重排序，並生成附帶精確引用的回答。本專案實戰要求你端到端建構一套能抗住 10 個程式碼儲存庫、200 萬行程式碼規模，並能在每次 Git push 後增量更新索引的工業級系統。

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:** P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## Problem｜問題

到了 2026 年，每一個前沿編程 Agent 皆標配了程式碼儲存庫檢索增強層，因為單靠上下文視窗不足以解決複雜的跨儲存庫工程提問。Claude 的 100 萬 Token 上下文視窗確實威力強大；但它絕未消除對精確排序檢索的需求。針對原始文字切塊實施樸素的餘弦相似度搜尋，會在面對自動生成的樣板程式碼、Monorepo 內部的大量重複邏輯，以及長尾罕見符號時毒化檢索結果。正式環境採用的方案是：在保留 AST 語法樹感知的程式碼區塊上，實施混合檢索（稠密向量 + 稀疏 BM25），外加 Cross-Encoder 重排序器，並由全域符號引用圖譜提供拓撲支撐。

你可以透過為真實的多儲存庫程式碼群（而非單一教學專案）建立索引，並測量 MRR@10、引用忠實度與增量更新鮮度，學會這套做法。真實的系統死穴全是基礎設施層面的：一個包含 10 萬個檔案的 Monorepo、一次改動了半數檔案的 Git Push，或者一個需跨四個儲存庫才能回答的查詢。

## Concept｜核心概念

具備 AST 感知的資料攝取管線首先使用 tree-sitter 解析每個原始碼檔案，精確提取函式與類別節點，並在語法節點邊界處進行切塊，徹底拋棄傳統固定 Token 視窗的盲目截斷。每個程式碼區塊具備三重語義表徵：dense embedding（Voyage-code-3 或 nomic-embed-code）、稀疏 BM25 關鍵字權重，以及一段精煉的自然語言功能摘要。自然語言摘要引入了關鍵的第三檢索模態——當工程師提問「X 是如何被授權的」時，摘要會主動提及「authz」，即便底層程式碼內部僅命名為 `check_permission`。

檢索流程全面採用混合架構。一個查詢會並行觸發稠密向量搜尋與 BM25 關鍵字檢索，合併兩者的 Top-K 候選集，並將聯集餵入 Cross-Encoder 重排序器（Cohere rerank-3 或本地部署的 bge-reranker-v2-gemma-2b）。重新排序後的精選清單被送入長上下文合成大模型（具備 Prompt 快取機制的 Claude Sonnet 4.7，或本地部署的 Llama 3.3 70B），系統嚴格要求模型在陳述任何結論時皆必須精確標註檔案路徑與行號範圍。任何未附帶引用的回答皆會被後置過濾器直接拒絕。

增量鮮度是核心基礎設施難題。Git Push 會觸發 Webhook 比對 Git Diff：哪些檔案發生了變更、哪些符號被修改。系統僅對受到波及的程式碼區塊重新計算 embedding，並重新計算受影響的跨檔案符號拓撲邊（import 依賴項、類別方法呼叫）。這使得整套索引能在每次 Commit 時保持完美一致性，而無需每次都重新掃描 200 萬行龐大程式碼。

## 系統架構

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

- 語法解析：tree-sitter 搭配 17 種主流語言語法庫（Python、TypeScript、Rust、Go、Java、C++ 等）
- dense embedding：Voyage-code-3（託管 API）或本地部署之 nomic-embed-code-v1.5，以 bge-code-v1 作為備用
- 稀疏檢索索引：以 Rust 編寫的 Tantivy，搭載 BM25F 演算法，支援符號名稱與函式主體的自定義欄位加權
- 向量資料庫：Qdrant 1.12（原生支援混合檢索），或針對 5000 萬向量以下團隊選用 pgvector + pgvectorscale
- 區塊摘要模型：Claude Haiku 4.5 或 Gemini 2.5 Flash，啟用 Prompt 快取
- 二次重排序器：Cohere rerank-3 或本地部署的 bge-reranker-v2-gemma-2b
- 流程編排引擎：LlamaIndex Workflows 負責非同步資料攝取，LangGraph 負責多節點查詢 Agent
- 答案合成模型：Claude Sonnet 4.7（100 萬 Token 上下文視窗），全面啟用系統提示快取
- 符號拓撲圖譜：Neo4j（託管版）或 kuzu（內嵌式圖資料庫），專門儲存跨檔案與跨庫的 import 與呼叫拓撲邊
- 全鏈路可觀測性：Langfuse，完整記錄每一次檢索節點與文字合成節點的詳細 Span

```figure
ce-hybrid-retrieval
```

## Build It｜動手實作

1. **增量攝取掃描器**。監聽每次 Git Push 的 Webhook。提取本次變更的檔案清單。針對每個檔案呼叫 tree-sitter 解析語法樹，精確抽取出函式與類別節點及其完整的原始碼起止跨度。輸出標準分塊記錄：`{repo, path, start_line, end_line, symbol, body}`。

2. **區塊自動摘要產生器**。將分塊批次送入 Haiku 4.5，系統 Prompt 全面啟用快取機制。要求prompt：「用一句話概述此函式，明確說明其對外公開合約與可能引發的副作用。」將生成的自然語言摘要與原始程式碼分塊並列儲存。

3. **embedding 執行緒池**。建置兩個並行工作佇列：稠密向量（Voyage-code-3 每批 128 條）與摘要向量（使用相同的模型為摘要文字產生 embedding）。將高維向量寫入 Qdrant，並攜帶豐富中繼資料：`{repo, path, start_line, end_line, symbol, kind}`。

4. **稀疏 BM25 索引建置**。建構具備欄位加權的 Tantivy 索引：符號名稱權重設為 4，函式內容主體權重設為 1，自然語言摘要權重設為 2。同時完美支援「尋找名為 X 的函式」與「尋找負責處理 X 邏輯的函式」兩類典型提問。

5. **全域符號引用拓撲圖譜**。針對每一個分塊記錄關聯邊：import 依賴（本檔案引用了儲存庫 Z 的符號 Y）、函式呼叫（本函式呼叫了類別 C 的方法 M）、物件導向繼承。將邊寫入內嵌式 kuzu 圖資料庫。在查詢時用於跨儲存庫邊界動態展開檢索上下文。

6. **查詢 Agent 狀態機**。使用 LangGraph 編排三大核心節點。`retrieve` 節點並行發射稠密向量搜尋與 BM25 檢索，依據 (repo, path, symbol) 實施精確去重；`rerank` 節點調用 Cross-Encoder 對 Top-50 候選進行重排序，精選保留 Top-10；`synth` 節點將重排後的分塊裝填入上下文呼叫 Claude Sonnet 4.7，啟用系統提示快取，強制輸出 file:line 引用。

7. **嚴格引用合規校驗器**。解析大模型的輸出文字；任何未標註 `(repo/path:start-end)` 具體錨點的論斷皆會被後置過濾器攔截打回重新生成或直接剔除。僅將具備確鑿引用的答案回傳給終端用戶。

8. **增量重構索引管線**。在接收到 Webhook 時，計算符號層級的 Diff 差異。僅對原始碼文字發生實質變更的區塊重新計算 embedding。僅對 import 關係變動的分塊重算符號圖拓撲邊。實測指標：在 200 萬行程式碼儲存庫上，一次改動 50 個檔案的 Git Push 必須在 60 秒之內完成增量索引重構。

9. **全自動評測套件**。人工標定 100 道跨儲存庫複雜工程問題，並給予經過驗證的標準答案與 file:line 標籤。精確度量 MRR@10、nDCG@10、引用真實性比例（具備可驗證錨點的陳述佔比），以及 p50 / p99 系統查詢延遲。

## Use It｜實際應用

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

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-codebase-rag.md`。給定一組程式碼儲存庫叢集，該 Skill 將自動拉起增量攝取管線、混合檢索索引庫與查詢 Agent，並針對任何跨儲存庫提問回傳附帶可點選跳轉引用的權威解答。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 檢索命中品質 | 在包含 100 道題目的獨立測試集上度量 MRR@10 與 nDCG@10 |
| 20 | 引用真實性與忠實度 | 回答中附帶精確可驗證之 file:line 錨點的論述佔比 |
| 20 | 查詢延遲與高併發吞吐 | 在現有索引資料量下，在 10k QPS 壓力下的 p95 查詢延遲表現 |
| 20 | 增量索引建置效率 | 從 Git Push 到最新變更可被檢索查詢到的端到端物理耗時（50 個檔案改動） |
| 15 | 使用者體驗與回答排版 | 引用的可點選跳轉體驗、程式碼片段即時預覽、追問銜接順暢度 |
| **100** | | |

## Exercises｜練習

1. 將後台稠密向量模型從 Voyage-code-3 替換為本地部署的 nomic-embed-code。客觀度量 MRR@10 的變動幅度。深入分析在開啟二次重排序後，兩者在最終召回效果上的差距是否顯著縮小？
2. 向程式碼儲存庫中惡意注入 20% 由大模型自動生成的樣板程式碼，重新執行基準評測。觀察檢索結果是否出現嚴重退化與雜訊污染。在 Payload 中為生成程式碼打上 generated 標籤，並在檢索加權中動態調降其權重。
3. 在你的目標程式碼儲存庫規模下，針對 Qdrant 混合檢索與 pgvector + pgvectorscale 展開極限效能壓力測試。對比兩者在批次大小為 1 時的 p99 檢索延遲。
4. 設計一套基於抽樣檢測的資料漂移監控機制：每週自動重跑這 100 道標準評測題。當 MRR@10 出現超過 5% 的下滑時自動觸發告警通知。
5. 將符號拓撲圖擴充至跨程式語言的遠端呼叫解析：例如一個 Python 函式透過 gRPC 跨網路呼叫一個 Go 微服務。利用符號圖將跨語言的呼叫鏈路精準串聯。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| AST-aware chunking |「以函式為單位切分」| 在 tree-sitter 節點邊界切分程式碼，而非使用固定 Token 視窗 |
| Hybrid search |「稠密 + 稀疏」| 平行執行 BM25 與向量搜尋、合併前 k 個結果，再重新排序 |
| Cross-encoder rerank |「第二階段排序」| 一起為每組（查詢、候選項目）評分的模型，比餘弦相似度更準確 |
| Prompt caching |「快取的 system prompt」| Claude／OpenAI 在 2026 年提供的功能，可為重複的前綴 Token 提供最高 90% 折扣 |
| Symbol graph |「程式碼圖譜」| 表示不同檔案與儲存庫間匯入、呼叫及繼承關係的邊 |
| Citation faithfulness |「有根據的回答比例」| 使用者點選錨點並閱讀引用片段後，可自行驗證的主張比例 |
| Incremental re-index |「從 git push 到可搜尋的時間」| 從 git push 到變更的符號可供查詢所經過的實際時間 |

## Further Reading｜延伸閱讀

- [Sourcegraph Amp](https://ampcode.com) — 正式環境跨程式碼儲存庫智慧搜尋平台。
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — 本專案實戰的深度參考架構剖析。
- [Aider repo-map](https://aider.chat/docs/repomap.html) — 基於 tree-sitter 的精準程式碼儲存庫地圖設計。
- [Augment Code enterprise graph](https://www.augmentcode.com) — 商業級符號圖程式碼 RAG。
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) — 混合檢索權威實作指南。
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 技術規格細節。
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — Cross-Encoder 二次重排序參考指南。
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) — 內部工程平台檢索實踐參考。
