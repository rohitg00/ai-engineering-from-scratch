# 前綴快取推論服務——RadixAttention 與 KV 重複利用（Prefix-Cache Serving — RadixAttention and KV Reuse）

> 將 KV 快取視為保存在基數樹（Radix tree）中、可隨時重複利用的一等公民資源，底層排程邏輯將隨之徹底重構：排程器不再遵循 vLLM 的先到先服務（FCFS）機制，而是採用快取感知（Cache-aware）排程，優先指派共享更長前綴的請求——本質上是基數樹的深度優先遍歷，從而使熱門路徑長駐於 HBM 之中。SGLang 正是圍繞這項思想打造的推論引擎。在 Llama 3.1 8B 搭配類似 ShareGPT 的 1k 長度 Prompt 測試中，SGLang 飆出約 16,200 tok/s 的吞吐量，相比於 vLLM 的約 12,500 tok/s 具備約 29% 的顯著優勢。在具備超長固定前綴的 RAG 負載下，其加速比高達 6.4 倍。在聲音複製場景下，前綴快取命中率更是突破了 86%。截至 2026 年，該架構已在全球 xAI、LinkedIn、Cursor、Oracle、GCP、Azure 與 AWS 等巨頭的 40 萬張以上 GPU 上大規模運作。然而關鍵隱患在於：一旦 Prompt 前綴各元件的組裝順序出現微小混亂，這 6.4 倍的巨大收益將瞬間蒸發——維持嚴格的 Prompt 模板排序，是工程師不可妥協的操作槓桿。

**Type:** Learn
**Languages:** Python (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 精準繪製 RadixAttention 架構圖：掌握前綴如何被壓縮索引於基數樹中，以及源自相同根分岔的多個序列如何共享實體 KV Block。
- 深刻解釋快取感知排程（Cache-aware scheduling）的底層原理，並指出為何傳統 FCFS 先到先服務在面對前綴密集型流量時完全失效。
- 給定具體的前綴快取命中率與 Prompt 長度分佈，精確推導出系統的理論加速比。
- 說出能讓 6.4 倍效能數字成真、而非錯失收益的 Prompt 排序規範。

## The Problem｜問題

傳統推論服務引擎將每個請求的 Prompt 視為完全黑盒且獨立的孤島。即便有 5,000 個 RAG 請求皆具備完全相同的 2,000 Token 系統提示加上相同的檢索上下文引言，vLLM 依然會機械化地對這 2,000 Token 的前綴連跑 5,000 次 Prefill 前向傳播。GPU 一遍又一遍地執行完全相同的無用重複運算。

關鍵的洞察在於：在現代 Agent 與 RAG 業務中，跨請求之間幾乎總是共享著極長的公共前綴。系統 Prompt、工具呼叫 Schema 定義、Few-shot 範例、檢索參照文件標頭，乃至多輪對話歷史——在請求之間反覆大量重現。若能將這些公共前綴的 KV 快取在首次運算後妥善保存並重複利用，後續請求便完全無需重複執行 Prefill。

RadixAttention 正是為此而生。所有 Token 序列被組織為一棵基數樹（Radix tree）；每個樹節點皆維護從根節點至該節點路徑所對應的實體 KV Block。新請求抵達時直接沿樹深度遍歷：任何匹配成功的節點直接複用其已算好的實體 KV Block。Prefill 的實質運算成本驟降至僅與「新增的後綴 Token」成正比，而與完整 Prompt 總長度脫鉤。

真正的難題轉移到了排程層。若佇列中有兩個請求共享 2,000 Token 的長前綴，而第三個請求僅共享 200 Token，排程器理應優先將前兩個長共享請求綁定調度，以確保這 2,000 Token 的熱門路徑始終留在 HBM 內。傳統 FCFS 機制則完全相反——它盲目按照抵達先後順序派發，極易在下一個長前綴請求抵達之前，將剛剛算好的熱門路徑粗暴驅逐釋放。

## The Concept｜核心概念

### 基數樹作為 KV 快取索引（The radix tree as a KV index）

基數樹（緊湊型 Trie 字典樹）用來儲存已快取的 Token 序列。每個節點擁有特定範圍的連續 Token 以及為該範圍預先計算好的實體 KV Block。子節點則代表向後延伸一個或多個 Token 的分岔路徑。

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

當一個包含系統 Prompt + "Context: <doc A>" + "Question: Carol" 的新請求抵達時：排程器開始巡檢基數樹：系統前綴精準匹配（直接複用 124 個 Block）、doc-A 分岔路徑精準匹配（直接複用 31 個 Block），隨後僅需為全新的 "Question: Carol" 動態分配 4 個新 Block。Prefill 的實際負載僅需處理這 4 個 Block 的新 Token。若無基數樹快取，系統必須全量運算 160 個 Block。Prefill 階段在此斬獲了高達約 40 倍的驚人算力節省。

### 快取感知排程機制（Cache-aware scheduling）

若快取資源池處於劇烈抖動與反覆置換（Cache churn）之中，基於基數樹的重複利用將毫無意義。以下是兩項關鍵策略：

1. **深度優先派發（Depth-first dispatch）**。在挑選佇列中的下一個待處理請求時，優先挑選與當前正在運作中任務共享相同樹分岔的請求。此舉能將熱門路徑牢牢留在 GPU 記憶體內。
2. **分岔層級的 LRU 淘汰（LRU at branch level, not block level）**。淘汰快取時以整條分岔路徑為單位進行剔除（從最少使用的葉節點開始向上修剪），而非無序地逐個清理個別 Block，確保 GPU 記憶體拓撲嚴密貼合基數樹結構。

傳統 FCFS 同時違背了上述兩大原則。一個共享 2,000 Token 的優質請求被迫排在僅共享 50 Token 的零散請求之後，隨後那條珍貴的 2,000 Token 熱門路徑在迎接後續請求之前，就被那個小請求強行擠出 GPU 記憶體。

### 務必銘記的核心基準實測數字（Benchmark numbers you should memorize）

- Llama 3.1 8B 模型在單張 H100、ShareGPT 1K Prompt 負載下：SGLang 達到約 16,200 tok/s，vLLM 約 12,500 tok/s（領先約 29%）。
- 前綴密集型 RAG 任務（完全相同的系統提示 + 相同文件，僅使用者提問變動）：SGLang 在此類負載下可達 6.4 倍效能優勢。
- 聲音複製業務場景：前綴快取命中率實測高達 86.4%。
- SGLang 商業客戶在正式環境中的快取命中率：依據 Prompt 模板嚴謹度不同，通常落在 50% 至 99% 之間。
- 截至 2026 年，已在超過 40 萬張實體 GPU 上大規模正式部署。

### 排序一致性陷阱（The ordering gotcha）

6.4 倍的極致加速比完全建立在**嚴格一致的 Prompt 模板拼接順序**之上。若你的應用程式用戶端在部分請求中按 `[system, tools, context, history, question]` 順序組裝 Prompt，而在另一些請求中卻拼接為 `[system, context, tools, history, question]`，基數樹將完全無法識別出兩者的公共前綴。在工程師眼中語意相同的內容，在基數樹看來是兩條完全割裂的異質序列。

工程師的核心操作槓桿：你的 Prompt 模板就是快取鍵（Cache key）。必須以極其嚴苛的紀律固化順序。將所有靜態不可變的內容（系統提示、工具定義、JSON Schema）強制置於最前端；緊接著放置檢索上下文文件；最後才放置隨機變動的使用者提問。切忌將動態生成的暫態內容插隊混雜在前綴之中。

來自科研團隊的真實案例：某正式環境系統僅僅透過一次改動，將動態內容移出可快取前綴，其快取命中率便瞬間從悲慘的 7% 暴衝至 74%。

### RadixAttention 的勝場與敗場（Where RadixAttention wins and loses）

大獲全勝的戰場：
- RAG 檢索增強生成（共享相同的知識庫參照引言，提問內容各異）。
- Agents（共用相同的工具結構描述，查詢內容各異）。
- 使用長 System Prompt 的聊天。
- 重複使用相同前置內容的語音／視覺工作負載。

落敗戰場（效能退化至 vLLM 常規水平）：
- 零前綴共享的單次發散生成（如獨特 Prompt 的程式碼補全、無 System Prompt 的開放式漫聊）。
- 每個請求的 Prompt 都在前綴中穿插獨特動態內容。

### 為何這本質上是排程器問題而非單純的核心問題（Why this is a scheduler problem, not just a kernel problem）

你可以把 KV 重複利用實作為 kernel 技巧。SGLang 的深層洞察在於：只有當上層排程器能確保熱門路徑常駐 GPU 記憶體時，快取複用才能轉化為真金白銀的效能收益。在混合負載衝擊下，天真的「有快取就用」排程政策必然導致 GPU 記憶體頻繁顛簸。基於基數樹建立的智慧排程器，才是將底層 Kernel 技巧蛻變為 29% 實質正式環境優勢的關鍵靈魂。

### 與 vLLM 的競合格局（Interplay with vLLM）

兩者並非死板的非黑即白替代品。2026 年 vLLM 亦跟進推出了前綴快取開關（`--enable-prefix-caching`）以及用 Rust 重構的快取感知路由器（vLLM Router）。兩者之間的效能差距有所收窄，但並未完全抹平——SGLang 整套底層架構從第一天起便是以基數樹為核心雕琢而生；而 vLLM 則是事後嫁接。對於由公共前綴絕對主導的特定業務場景，SGLang 仍是預設選擇；而對於缺乏顯著前綴重複特徵的通用型推論場景，vLLM 的表現相當或更好。

```figure
roofline
```

## Use It｜實際應用

`code/main.py` 實作了一套微型基數樹 KV 快取，並配備了兩種排程策略：傳統 FCFS 先到先服務與 SGLang 風格的快取感知深度排程。在完全相同的業務負載下分別運作兩者，即時輸出前綴快取命中率與吞吐量對比；隨後引入「亂序模板」負載，親眼見證 6.4 倍效能如何因組裝順序混亂而瞬間瓦解。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-radix-scheduler-advisor.md`。輸入具體的業務工作負載特徵（Prompt 模板結構、檢索命中模式、並行租戶規模），該 Skill 將自動產出標準的 Prompt 拼接順序約束指南，並對是否應當全面切換至 SGLang 給出明確的 Go/No-Go 決策判定。

## Exercises｜練習

1. 執行 `code/main.py`。在相同負載下對比 FCFS 與快取感知排程。兩者巨大的吞吐量落差究竟源自何處——是 Prefill 算力節省、解碼加速，還是排隊延遲的縮短？
2. 修改模擬負載生成器，使 Prompt 隨機排列 `[system, tools, context]` 的順序。重新執行。快取命中率發生了什麼變化？背後的底層物理機理為何？
3. 在 Llama 3.1 8B 模型下，精確計算將一個長度為 2,000 Token 的系統提示作為單一基數樹路徑常駐 HBM 所需的記憶體位元組數。將其與在缺乏前綴複用的前提下運作 16 個並行請求的 GPU 記憶體用量進行對比。
4. 閱讀 SGLang RadixAttention 論文。用三句話解釋，為何樹狀 LRU 淘汰在長前綴密集負載下優於區塊式 LRU。
5. 客戶通報其推論服務的前綴快取命中率僅有淒慘的 8%。列出三項最可能引發該問題的架構元兇，並針對每一項分別給出標準排查診斷手段。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| RadixAttention | 「SGLang 的功能」 | 以基數樹索引 KV 快取，讓共用前綴能重複利用區塊 |
| Radix tree | 「緊湊型 Trie」 | 每個節點都保存一段 token 範圍及其 KV 區塊的樹 |
| Cache-aware scheduler | 「優先處理熱門分岔」 | 優先選擇與目前常駐分岔共用前綴的請求的排程器 |
| Prefix-cache hit rate | 「Prompt 有多少內容可免費重用」 | 透過重用 KV 區塊提供服務的 Prompt token 比例 |
| FCFS | 「先到先服務」 | 會破壞前綴局部性的預設排程方式 |
| Branch-level LRU | 「淘汰葉節點」 | 配合基數樹結構的淘汰政策 |
| Prompt template ordering | 「快取索引鍵」 | Prompt 元件的順序決定基數樹能共用哪些內容 |
| System prompt pinning | 「常駐前綴」 | 固定不可變的系統部分，以避免反覆淘汰 |

## Further Reading｜延伸閱讀

- [SGLang GitHub](https://github.com/sgl-project/sglang) — 官方開源儲存庫與完整技術手冊。
- [SGLang documentation](https://sgl-project.github.io/) — RadixAttention 與排程器架構實作指南。
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — 奠定基數樹推論服務思維的經典原著。
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) — 權威基準實測數字與排程架構深度剖析。
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) — vLLM 原生的前綴快取實作對照手冊。
