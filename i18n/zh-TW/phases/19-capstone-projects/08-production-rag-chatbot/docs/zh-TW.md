# 專案實戰 08——強監管垂直領域的正式環境 RAG 對話機器人（Capstone 08 — Production RAG Chatbot for a Regulated Vertical）

> Harvey、Glean、Mendable 與 LlamaCloud 在 2026 年皆運作著完全相同的工業級生產架構。使用 docling 或 Unstructured 攝取結構化文件，使用 ColPali 處理視覺圖表富媒體；實施混合檢索；調用 bge-reranker-v2-gemma 實施二次重排序；利用支援系統提示快取（Prompt Caching，快取命中率達 60% 至 80%）的 Claude Sonnet 4.7 進行答案合成；透過 Llama Guard 4 與 NeMo Guardrails 實施全方位安全防護；經由 Langfuse 與 Phoenix 實施全鏈路可觀測性；並在包含 200 道黃金問題的基準測試集上使用 RAGAS 框架嚴格驗收。在醫療、法律或保險等高度監管的垂直領域端到端建置一套系統，本專案的驗收標準就是成功通過黃金測試集評測、通過頂級紅隊滲透，並平穩運行資料漂移監控儀表板。

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Problem｜問題

強監管垂直領域的 RAG 檢索增強生成（法律合約、臨床試驗協定、保險條款理賠）是 2026 年最常部署的正式環境應用形式，因為其投資報酬率極其明確且業務容錯率極低。Harvey（Allen & Overy）打造法律領域產品；Mendable 提供開發者文件版本；Glean 涵蓋企業搜尋。其共通模式為：高保真資料攝取、混合檢索搭配二次重排序、強制附帶精確引用的答案合成且全面啟用 Prompt 快取、多層防護欄層層把關，以及持續不間斷的資料漂移監控。

系統中最棘手的挑戰從來不是大模型本身。而是具備法域感知的合規隔離（HIPAA、GDPR、SOC2）、引用層級的可稽核性、推論成本控制（高快取命中率可帶來 60% 至 90% 的折扣）、透過 RAGAS 忠實度（Faithfulness）偵測幻覺，以及當底層原始合約更新時索引庫未及時同步的「資料漂移」捕捉。本專案實戰要求你在包含 200 道題目的專家標註黃金測試集與一整套紅隊對抗測試集上，端到端交付整套系統。

## Concept｜核心概念

整個管線分為兩大對稱表面。**資料攝取端**：使用 docling 或 Unstructured 精確解析結構化文件；使用 ColPali 處理包含豐富圖表的視覺掃描件；將分塊附帶精煉摘要、權限標籤與法域標籤。向量寫入 pgvector + pgvectorscale（5000 萬向量以下）或 Qdrant Cloud；稀疏 BM25 索引同步並行建置。**對話交互端**：使用 LangGraph 維護多輪對話歷史與記憶；針對每次提問實施混合檢索，使用 bge-reranker-v2-gemma-2b 進行精確重排序，調用 Claude Sonnet 4.7（啟用 Prompt 快取）合成附帶引用的答案，輸出經由 Llama Guard 4、NeMo Guardrails 以及 Presidio 進行合規與隱私審查，最終回傳附帶可查驗錨點的回答。

評測架構由四重防線組成。**黃金測試集（Golden Set）**（由領域專家人工精確標註的 200 組問答與引用對），用於保障事實正確性。**紅隊對抗套件（Red Team）**（包含越獄提示、PII 誘發提取、領域外問題），用於保障邊界安全。**RAGAS 線上評估**，在每一輪對話中全自動計算忠實度、答案相關性與上下文精準度。**漂移監控儀表板（Arize Phoenix）**，每週定時監控檢索質量衰退與幻覺率抬頭趨勢。

Prompt 快取是成本控制的核心命門。Claude 4.5+ 與 GPT-5+ 支援對系統 Prompt 與檢索到的上下文實施快取。在達到 60% 至 80% 快取命中率時，單次查詢成本可直接下降 3 至 5 倍。整套管線在架構設計上必須維持嚴格穩定的前綴結構（系統 Prompt + 重排後的上下文排列在最前），方能穩定維持極高命中率。

## 系統架構

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

- 資料攝取：Unstructured.io 或 docling 處理結構化文字；ColPali 處理高密度富媒體 PDF
- 向量資料庫：5000 萬向量以下選用 pgvector + pgvectorscale；超大規模選用 Qdrant Cloud
- 稀疏檢索：以 Rust 編寫的 Tantivy，搭載支援自定義欄位加權的 BM25
- 流程編排：LlamaIndex Workflows 負責高併發資料攝取，LangGraph 負責多輪對話狀態機
- 重排序器：本地部署之 bge-reranker-v2-gemma-2b 或託管之 Voyage rerank-2
- 大語言模型：全面啟用 Prompt 快取的 Claude Sonnet 4.7；以本地部署的 Llama 3.3 70B 作為備用
- 自動評測：RAGAS 0.2 負責線上逐輪打分，DeepEval 負責幻覺率度量與越獄測試集掃描
- 全鏈路可觀測性：私有化部署 Langfuse（附帶人工標註審核佇列）；Arize Phoenix 專責資料漂移分析
- 安全防護欄：Llama Guard 4 輸入／輸出分類器、NeMo Guardrails v0.12 業務規則引擎、Presidio 敏感資訊過濾
- 合規治理：分塊層級的基於角色存取控制（RBAC）標籤；滿足 GDPR/HIPAA 的法域標籤

```figure
canary-rollout
```

## Build It｜動手實作

1. **結構化與多模態攝取**。使用 Unstructured 或 docling 解析目標語料庫（生產級建議準備 1000 至 10000 份專業合約與文件）。針對掃描圖片與圖表密集頁，自動導流至 ColPali 進行多向量解析。輸出帶有摘要、角色權限標籤與法域識別碼的標準分塊。

2. **混合向量索引庫搭建**。使用 Voyage-3 或 Nomic-embed-v2 計算 dense embedding，寫入 pgvector + pgvectorscale。使用 Tantivy 建置稀疏 BM25 倒排索引。角色與法域作為 Payload 標籤儲存，用於檢索前置過濾。

3. **雙層混合檢索架構**。在檢索發起瞬間，首先依據使用者角色與所屬法域實施硬性過濾；隨後並行發射稠密向量搜尋與 BM25 關鍵字搜尋；調用倒數排名融合（RRF）演算法合併候選集；將 Top-20 候選送入 Cross-Encoder 重排序器；精選出 Top-5 最優片段送入大模型合成。

4. **Prompt 快取答案合成**。將靜態系統規範、防護欄規則與特定法域法規釘死在快取頭部；將重排後的上下文作為快取擴展區塊；使用者的新提問作為動態後綴。確保系統在穩定服務狀態下達成 60% 至 80% 的快取命中率。

5. **多層防護防線實施**。在輸入端調用 Llama Guard 4 攔截違規請求；使用 NeMo Guardrails 阻斷超綱業務提問與敏感禁忌話題；在輸出端使用 Presidio 掃描並剔除意外外洩的 PII 隱私資料；掛載嚴格的「無可驗證引用即打回」後置過濾器。

6. **專家黃金評測集標定**。邀請垂直領域業務專家親自標定包含 200 組問答對的黃金測試集（包含標準回答與標準引用）。在精確引用匹配率、回答正確性與 RAGAS 忠實度上全面度量 Agent。

7. **專業紅隊滲透測試**。設計 50 條具備惡意對抗性的 Prompt：自動化越獄反覆運算（PAIR、TAP）、誘導 PII 敏感資料外洩嘗試、超綱業務誘導、跨法域越權探測。以通過率與危害等級評定安全等級。

8. **資料漂移即時監控**。串接 Arize Phoenix，每週定時度量檢索質量變化（nDCG 下滑、引用真實性波動）。當整體指標出現超過 5% 的異常回撤時自動觸發告警通知。

9. **全維度成本效益報告**。在 Langfuse 中建立儀表板：即時統計 Prompt 快取命中率、每查詢平均 Token 開銷，並按「檢索、重排、大模型合成」三個階段逐一拆解單次提問的具體花費。

## Use It｜實際應用

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

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-production-rag.md`。它代表一套為強監管垂直領域量身訂製、附帶法規合規標籤、依評分規準評估且具備線上即時資料漂移監控的正式環境級對話機器人。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | RAGAS 忠實度與答案相關性 | 在 200 道專家標註的黃金問答集上實測線上綜合評分 |
| 20 | 條款引用的真實客觀性 | 回答中附帶精確可驗證原始合約條款定位錨點的陳述佔比 |
| 20 | 防護欄體系防禦覆蓋度 | Llama Guard 4 通過率 + 50 道惡意越獄紅隊測試集掃描結果 |
| 20 | 成本控制與推論延遲工程 | Prompt 快取穩定命中率、端到端 p95 延遲、單次對話查詢平均花費（$/query） |
| 15 | 資料漂移監控儀表板 | Phoenix 即時儀表板正常運作，展示每週檢索品質走勢圖表 |
| **100** | | |

## Exercises｜練習

1. 在不同的監管法域下建置第二個語料庫切片（例如在 GDPR 之外平行引入醫療 HIPAA 條例）。在包含 20 道跨法域邊界探測題的測試集上，展示「角色 + 法域」雙重前置過濾機制能防止跨法域資料洩漏。
2. 在真實正式環境流量下持續觀測一週的 Prompt 快取命中率。分析究竟是哪些特殊提問意外破壞了快取前綴的穩定性。重新調整 Prompt 架構以修復快取擊穿。
3. 為系統加入長程多輪對話記憶，設定 1 萬 Token 的摘要滾動緩衝區。客觀度量隨著對話輪次持續加深，RAGAS 忠實度指標是否會因歷史文字累積而出現下滑？
4. 將 Claude Sonnet 4.7 替換為本地部署的 Llama 3.3 70B。度量單次查詢成本的下降幅度，以及其在複雜合約條款解讀忠實度上的具體變化。
5. 新增「不確定」模式：若重排序後排名靠前的分數低於閾值，Agent 就回答「我沒有足夠可信的引用」，而不作答。測量此模式降低虛假信心的效果。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Prompt caching |「快取 system prompt 與脈絡」| Claude／OpenAI 的功能；命中時，快取的前綴 Token 可享 60–90% 折扣 |
| RAGAS |「RAG 評估器」| 自動評分忠實度、回答相關性與脈絡精確度 |
| Golden set |「有標籤的評估集」| 由專家標註、含引用的 200 多組問答；作為標準答案 |
| Jurisdiction tag |「法遵標籤」| 附加在切塊上的 GDPR／HIPAA／SOC2 適用範圍，由檢索篩選器強制執行 |
| Citation faithfulness |「有根據的回答比例」| 有可檢索來源片段支持的主張比例 |
| Drift |「檢索品質衰退」| nDCG 或引用分數的每週變化；警示門檻為 5% |
| Red team |「對抗式評估」| 發布前執行的越獄、PII 擷取及領域外探測 |

## Further Reading｜延伸閱讀

- [Harvey AI](https://www.harvey.ai) — 法律科技領域標竿級正式環境架構。
- [Glean enterprise search](https://www.glean.com) — 企業級全域 RAG 權威架構參考。
- [Mendable documentation](https://mendable.ai) — 開發者文件檢索領域專業實踐。
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) — 全託管文件解析與攝取平台。
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 大模型 Prompt 快取核心指南。
- [RAGAS 0.2 documentation](https://docs.ragas.io/) — 官方標準 RAG 自動化評估框架手冊。
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 專門針對 RAG 資料漂移與追蹤的可觀測性平台。
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — Meta 最新一代安全審查分類模型。
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — NVIDIA 可程式化安全防護欄架構。
