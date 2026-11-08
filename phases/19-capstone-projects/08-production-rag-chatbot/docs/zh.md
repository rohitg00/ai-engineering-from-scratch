# 綜合專案 08 —— 受管制垂直領域的生產級 RAG 聊天機器人

> Harvey、Glean、Mendable 與 LlamaCloud 在 2026 年跑的都是同一套生產形狀。用 docling 或 Unstructured 攝取，視覺內容用 ColPali。混合搜尋。用 bge-reranker-v2-gemma 重排。用 Claude Sonnet 4.7 合成，提示詞快取命中率 60-80%。用 Llama Guard 4 與 NeMo Guardrails 把關。用 Langfuse 與 Phoenix 監看。用 RAGAS 在一份 200 題的黃金集上評分。在一個受管制的領域（法律、臨床、保險）建一套出來，而這個綜合專案的關卡就是通過黃金集、紅隊測試與漂移儀表板。

**類型：** 總結專案
**程式語言：** Python (pipeline + API), TypeScript (chat UI)
**先修單元：** 階段 5（NLP）、階段 7（transformer）、階段 11（LLM 工程）、階段 12（多模態）、階段 17（基礎設施）、階段 18（安全）
**演練到的階段：** P5 · P7 · P11 · P12 · P17 · P18
**時間：** 30 小時

## 問題

受管制領域的 RAG（法律合約、臨床試驗方案、保單）是 2026 年出貨最多的生產形狀，因為投資報酬顯而易見、風險又很具體。Harvey（Allen & Overy）替法律業建了它。Mendable 出貨了開發者文件的版本。Glean 涵蓋企業搜尋。那套模式是：高保真地攝取、以混合檢索加重排取回、配上引用強制與提示詞快取來合成、用多層安全把關，並持續監控漂移。

難的部分不是模型。難的是因管轄區而異的法遵（HIPAA、GDPR、SOC2）、引用層級的可稽核性、成本控制（命中率高時提示詞快取換來 60-90% 折扣）、透過 RAGAS 忠實度做的幻覺偵測，以及當來源文件更新而索引沒跟上時的漂移偵測。這個綜合專案要你把這一切都在一份 200 題的黃金集上出貨，並附上一套紅隊測試。

## 概念

這條管線有兩側。**攝取**：用 docling 或 Unstructured 剖析結構化文件；視覺豐富的則交給 ColPali；片段會拿到摘要、標籤，以及基於角色的存取標記。向量進到 pgvector + pgvectorscale（5000 萬向量以下）或 Qdrant Cloud；稀疏的 BM25 在旁邊並行。**對話**：LangGraph 處理記憶與多輪；每一則查詢都跑混合檢索、用 bge-reranker-v2-gemma-2b 重排、用 Claude Sonnet 4.7（帶提示詞快取）合成、把輸出過一遍 Llama Guard 4 與 NeMo Guardrails，最後產出一份以引用為錨的回應。

評估堆疊有四層。**黃金集**（200 組帶引用的已標註問答）測正確性。**紅隊**（越獄、PII 抽取嘗試、離題問題）測安全性。**RAGAS** 自動逐輪測忠實度／答案相關性／脈絡精確度。**漂移儀表板**（Arize Phoenix）每週監看檢索品質與幻覺分數。

提示詞快取是那根成本槓桿。Claude 4.5+ 與 GPT-5+ 支援快取系統提示詞 + 檢索到的脈絡。在 60-80% 命中率下，每次查詢成本降 3-5 倍。這條管線必須為穩定的前綴（系統提示詞 + 重排後的脈絡擺前面）而設計，才達得到高快取命中率。

## 架構

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## 技術堆疊

- 攝取：結構化文件用 Unstructured.io 或 docling；視覺豐富的 PDF 用 ColPali
- 向量資料庫：5000 萬向量以下用 pgvector + pgvectorscale；否則用 Qdrant Cloud
- 稀疏：帶欄位權重的 Tantivy BM25
- 編排：LlamaIndex Workflows（攝取）+ LangGraph（對話）
- 重排器：自架的 bge-reranker-v2-gemma-2b 或託管的 Voyage rerank-2
- LLM：帶提示詞快取的 Claude Sonnet 4.7；退路是自架的 Llama 3.3 70B
- 評估：線上跑 RAGAS 0.2，幻覺與越獄套件用 DeepEval
- 可觀測性：自架的 Langfuse 配標註佇列；漂移用 Arize Phoenix
- 護欄：Llama Guard 4 的輸入／輸出分類器、NeMo Guardrails v0.12 政策、Presidio PII 清洗
- 法遵：片段上的角色式存取標記；供 GDPR/HIPAA 用的管轄區標籤

```figure
canary-rollout
```

## 動手實作

1. **攝取。** 用 Unstructured 或 docling 剖析你的語料（認真的建置要 1000-10000 份文件）。掃描版／視覺繁重的頁面走 ColPali。產出帶摘要、角色標記與管轄區標籤的片段。

2. **索引。** 稠密嵌入（Voyage-3 或 Nomic-embed-v2）進 pgvector + pgvectorscale。透過 Tantivy 做 BM25 側索引。角色與管轄區過濾器放在酬載裡。

3. **混合檢索。** 先依角色+管轄區過濾；接著平行跑稠密 + BM25；用倒數排名融合合併；前 20 筆送重排器；前 5 筆送合成。

4. **配提示詞快取合成。** 系統提示詞 + 靜態政策放在快取標頭裡；重排後的脈絡當成快取延伸；使用者問題當成未快取的後綴。目標是在穩定狀態下達到 60-80% 的快取命中率。

5. **護欄。** 輸入端用 Llama Guard 4；NeMo Guardrails 的軌道擋掉離題問題或政策禁止的主題；Presidio 清洗輸出中不小心洩出的 PII；引用強制作為後置過濾。

6. **黃金集。** 200 組由領域專家標註（答案、引用）的問答配對。就精確引用相符、答案正確性、忠實度（RAGAS）替代理評分。

7. **紅隊。** 50 則對抗提示詞：越獄（PAIR、TAP）、PII 外洩嘗試、離題、跨管轄區洩漏。以通過／失敗與嚴重度評分。

8. **漂移儀表板。** Arize Phoenix 每週追蹤檢索品質（nDCG、引用忠實度）。掉 5% 就發警報。

9. **成本報告。** Langfuse：提示詞快取命中率、每次查詢的詞元數、依階段拆解的每次查詢花費。

## 框架應用

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 產出交付

`outputs/skill-production-rag.md` 描述那份交付物。一個帶法遵標記部署出去的受管制領域聊天機器人，通過那份評分表，並以即時漂移監控加以觀察。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | RAGAS 忠實度 + 答案相關性 | 黃金集（200 組問答）上的線上分數 |
| 20 | 引用正確性 | 帶可驗證來源錨點的答案比例 |
| 20 | 護欄涵蓋率 | Llama Guard 4 通過率 + 越獄套件結果 |
| 20 | 成本／延遲工程 | 提示詞快取命中率、p95 延遲、每次查詢花費 |
| 15 | 漂移監控儀表板 | 帶每週檢索品質趨勢的 Phoenix 即時儀表板 |
| **100** | | |

## 練習

1. 在另一個管轄區之下建第二份語料切片（例如在 GDPR 旁邊加上 HIPAA）。在一份 20 題的跨管轄區探測上，示範角色+管轄區過濾能防住跨界洩漏。

2. 量測一週生產流量下的提示詞快取命中率。指出哪些查詢會打斷快取前綴。重新調整結構。

3. 用一個 1 萬詞元的摘要緩衝區加上多輪記憶。量測忠實度會不會隨著對話變長而下降。

4. 把 Claude Sonnet 4.7 換成自架的 Llama 3.3 70B。量測每次查詢花費與忠實度的差值。

5. 加上一個「不確定」模式：若重排後的最高分低於門檻，代理就說「我沒有有把握的引用」而不作答。量測過度自信的下降幅度。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 提示詞快取 | 「快取住的系統提示詞 + 脈絡」 | Claude/OpenAI 的功能：命中時被快取的前綴詞元折 60-90% |
| RAGAS | 「RAG 評估器」 | 對忠實度、答案相關性、脈絡精確度所做的自動化評分 |
| 黃金集 | 「已標註的評估集」 | 200 組以上由專家標註、帶引用的問答；那份標準答案 |
| 管轄區標籤 | 「法遵標記」 | 附在片段上的 GDPR/HIPAA/SOC2 範圍；由檢索過濾器強制執行 |
| 引用忠實度 | 「有接地的答案比例」 | 有可檢索來源跨度支撐的主張比例 |
| 漂移 | 「檢索品質衰退」 | nDCG 或引用分數的每週變化；警報門檻 5% |
| 紅隊 | 「對抗式評估」 | 發布前的越獄、PII 抽取、離題探測 |

## 延伸閱讀

- [Harvey AI](https://www.harvey.ai) —— 法律領域生產堆疊的參考
- [Glean enterprise search](https://www.glean.com) —— 企業規模 RAG 的參考
- [Mendable documentation](https://mendable.ai) —— 開發者文件 RAG 的參考
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) —— 託管式攝取
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) —— 那根成本槓桿的參考
- [RAGAS 0.2 documentation](https://docs.ragas.io/) —— 經典的 RAG 評估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) —— 漂移可觀測性的參考
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) —— 2026 年的安全分類器
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) —— 政策軌道框架
