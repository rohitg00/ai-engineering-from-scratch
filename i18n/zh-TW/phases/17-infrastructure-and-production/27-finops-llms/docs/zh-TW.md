# LLM FinOps 財務維運——單位經濟學與多租戶成本歸因（FinOps for LLMs — Unit Economics and Multi-Tenant Attribution）

> 傳統的雲端財務維運（FinOps）面對 LLM 推論支出時全面失效。LLM 的費用本質上是離散的 Token 事務交易，而非伺服器資源的實體運作時數。標籤無法直接對應——一次 API 呼叫是一筆交易，而非一項資產。工程架構決策（Prompt 模板設計、上下文視窗大小、輸出長度）直接等價於企業的財務決策。2026 年的成熟操作手冊要求從上線第一天起強制埋點三大歸因維度：按使用者維度（`user_id`）服務於席位定價與帳戶擴展、按任務維度（`task_id` + `route`）服務於產品功能成本拆解與研發優先權、按租戶維度（`tenant_id`）服務於單位經濟效益核算與合約續約談判。精細劃分四大 Token 成本層次——Prompt 輸入、工具呼叫、記憶、模型回應——將它們混為一談只會讓成本黑洞徹底隱形。面向多租戶 SaaS 產品的三級強制執行階梯：按租戶實施速率限制（預期峰值的 2 至 3 倍，嚴格回傳 429 與 Retry-After）；每日支出上限（合約額度的 1.5 至 3 倍，觸發速率收緊並警報客戶成功團隊）；終極熔斷斷路器（當支出相對於租戶基準的 z-score > 4 時自動暫停租戶、通知值班人員，並升級至 ops 與 CS）。六大歸因架構模式：打標聚合、遙測連接（基於 Trace-ID 關聯帳單，精度最高）、隨機抽樣推估、模型回歸推導、事件溯源、即時串流儀表板。衡量單位指標：每個已解決查詢的成本、每件生成產物的成本——絕非單純供應商術語中的「$/M tokens」。事後溯源打標永遠存在死角；必須在請求建立的發起點強制注入中繼資料。

**Type:** Learn
**Languages:** Python (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深刻解釋為何傳統基於標籤與資源層級的 FinOps 在 LLM 支出面前全面失效，並精準指出三大全新的業務歸因維度。
- 梳理 LLM 成本的四大 Token 層次（Prompt 輸入、工具回填、記憶、最終回應），並剖析為何單一黑盒計費會掩蓋真實成本殺手。
- 為多租戶 SaaS 產品設計一套嚴密的三級強制執行階梯（速率限制 → 支出上限 → 終極熔斷斷路器）。
- 學會以「每個已解決查詢或產出物的成本」取代單純的「$/M tokens」，確立與商業結果深度錨定的北極星單位指標。

## The Problem｜問題

月底的雲端帳單赫然顯示 40,000 美元。你試圖深入分析，卻發現面對著一團漆黑迷霧：
- 究竟是哪一家企業客戶消耗了這筆巨資？
- 究竟是哪一項具體的產品功能在瘋狂燃燒經費？
- 是否存在特定個別使用者在惡意濫用系統？
- 帳單暴增的元兇究竟是 Prompt 模板過度臃腫、工具呼叫成本，還是長對話記憶的無節制增長？

傳統雲端廠商在主機（EC2、S3）上採用的「打標聚合（Tag-and-aggregate）」機制之所以可行，是因為實體資源的標籤會自然穿透至每一筆帳單細項中。然而LLM API 呼叫絕不會自動為你標註業務上下文——你必須在程式碼發起呼叫的源頭，親手為其烙印上 user/task/tenant 標籤並全程向下傳遞。事後補救性的資料清洗與猜測，永遠無法覆蓋複雜的邊界情況。

## The Concept｜核心概念

### 三大核心歸因維度（Three attribution dimensions）

**按使用者維度（`user_id`）**：精準透視每一位終端使用者的實質成本消耗。直接支撐單席位定價策略、指引商業增購談判，並能識別高用量使用者。

**按任務維度（`task_id` + `route`）**：精確量化每一處產品功能介面的真實開銷。為產品功能的優先權排期提供客觀財務依據，並為「是否應當壯士斷腕砍掉昂貴邊緣功能」提供確鑿論據。

**按租戶維度（`tenant_id`）**：精確計算每一家簽約客戶的真實利潤率。直接支撐企業級單位的單位經濟效益（Unit economics）、合約續約定價調整以及階梯服務門檻。

在系統開發的第一天，就必須在所有 API 呼叫點強制埋入這三大標籤。事後歸因總是不如在呼叫時埋點。

### 四大 Token 成本層次（Four token layers）

| 成本層次 | 具體構成範例 | 佔總支出典型比例 |
|-------|---------|---------------------|
| Prompt 輸入層 | 靜態系統提示 + 使用者即時輸入 | 40% 至 60% |
| 工具呼叫層 | 工具呼叫結果回填 | 20% 至 40%（Agent 業務） |
| 記憶層 | 先前對話／檢索文件 | 10% 至 30% |
| 最終回應層 | 模型生成的解答文字 | 10% 至 30% |

將這四大層次的 Token 混為一談打包計費，會使一切成本最佳化變得盲人摸象。必須在你的歸因 Schema 中將它們清晰切分獨立核算。

### 三級梯度強制執行階梯（Enforcement ladder）

1. **租戶級速率限制（Rate limit）**：門檻設定為該租戶預期峰值的 2 至 3 倍。一旦超標，閘道立即回傳 HTTP 429 搭配標準 `Retry-After` Header。租戶感受到適度摩擦；徹底規避天價帳單驚喜。

2. **租戶級每日支出上限（Daily spend cap）**：門檻設定為合約約定額度的 1.5 至 3 倍。觸發時：收緊速率限制並通知客戶成功團隊。

3. **終極熔斷斷路器（Kill switch）**：當支出相對於租戶基準的 z-score > 4 時，自動暫停租戶、通知值班人員，並升級至 ops 與 CS。

### 六大成本歸因架構模式（Attribution patterns）

- **打標聚合模式（Tag-and-aggregate）**：在請求中附加中繼資料 Header，事後離線匯總。架構最簡，顆粒度偏粗。
- **遙測連接器模式（Telemetry joiner）**：透過全鏈路 Trace-ID 將分散式追蹤資料與底層計費記錄進行精密關聯。精度最高；成熟團隊採用的模式。
- **隨機抽樣推估模式（Sampling + extrapolation）**：僅隨機取樣 5% 至 10% 的請求進行深度分析，隨後線性放大。適合粗略估算成本，但可能漏掉長尾情況。
- **統計模型推導模式（Model-based allocation）**：針對缺乏標籤的歷史遺留資料，透過迴歸分析推斷成本驅動因素。
- **事件溯源架構（Event-sourced）**：以事件串流（Kafka / Kinesis）表示成本，即時提供資料。
- **即時串流儀表板（Real-time streaming）**：儀表板會在次秒內更新。

### 「每單位 X 成本」才是真正的北極星指標（Cost per X is the unit metric）

「$/M tokens」是雲端供應商用來促銷的行銷黑話。產品團隊真正在意的單位經濟學指標應當與真實商業結果深度綁定：

- 每解決一起客服工單的實質成本（Cost per resolved support ticket）。
- 每生成一篇文章的實質成本（Cost per generated article）。
- 每成功執行一項 Agent 自動化任務的實質成本（Cost per successful agent task）。
- 每位使用者每工作階段分鐘的成本（Cost per user-session-minute）。

唯有將成本緊緊錨定於具體的商業成果之上，團隊的架構最佳化才具備明確的價值指向。

### 成本歸因 Trace 資料結構範本（Cost attribution trace shape）

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

每一次推論呼叫皆必須強制產出上述結構化資訊。全量落盤進資料湖中。按維度任意維度展開聚合。第 17 課第 13 節打造的可觀測性技術堆疊正是這套資料的最佳載體。

### 乘數相乘的綜合節省技術堆疊（The compounded-savings stack）

當你將全書所學的四項核心技術全面疊加時：快取 + 批次 + 路由 + 智慧閘道：
- L2 供應商快取（第 17 課第 14 節）：輸入成本便宜約 10 倍。
- 非同步 Batch 批次處理（第 17 課第 15 節）：全線再次直接打 5 折。
- 模型動態路由（第 17 課第 16 節）：將低難度任務分流至輕量模型，再省 60%。
- 閘道效率（第 17 課第 19 節）：冗餘 + 重試。

全部疊加時的最佳情境：總帳單能被壓縮至原始基準線的約 **5% 至 10%**。大多數團隊已啟用其中 2 至 3 項槓桿；只有少數團隊將四項全部疊加。

### 務必銘記的核心數字指標（Numbers you should remember）

- 核心歸因三維度：按使用者（User）、按任務（Task）、按租戶（Tenant）。
- 四大 Token 成本劃分：Prompt 輸入、工具呼叫、記憶、最終回應。
- 終極斷路器標準：支出異常偏離值 Z-score > 4 自動觸發熔斷。
- 北極星單位指標：每完成一次商業結果的成本，而非 $/M tokens。
- 四合一全端最佳化潛力：可將總體推論支出壓縮至原始基準線的 5% 至 10%。

```figure
i4-spend-ladder
```

## Use It｜實際應用

`code/main.py` 模擬一個具備三級強制執行階梯的多租戶 LLM 服務。注入一個濫用服務的租戶，並示範 kill switch 觸發。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-finops-plan.md`。根據產品與規模，該 Skill 設計歸因資料結構（Schema）與執行階梯。

## Exercises｜練習

1. 執行 `code/main.py`。在模擬負載下，異常租戶的支出 Z-score 達到多少時觸發了終極斷路器？你該如何依據自身業務的歷史波峰特徵科學設定該閾值？
2. 為團隊設計一套「按租戶 + 按功能」的即時成本儀表板。列出你認為最應當優先建置的前 5 個核心視圖。
3. 你的最大租戶單位經濟效益為負。依對客戶的影響由小到大，提出三項介入措施。
4. 為一套智慧客服產品精確計算其「每成功解決一起工單的實質成本」：已知每起工單平均消耗 300 萬 Token，每日處理約 800 起工單，底層全面採用 GPT-5 搭配快取費率。
5. 深入辯論事後補救性打標究竟是否具備可行性。在何種特定的折衷情境下，事後粗估是可被勉強接受的？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Per-user attribution | 「使用者層級成本」 | 每次呼叫都標記 `user_id` |
| Per-task attribution | 「功能成本」 | 以 `task_id` + `route` 識別產品功能 |
| Per-tenant attribution | 「客戶成本」 | 以 `tenant_id` 歸因，支援單位經濟分析 |
| Four token layers | 「成本層次」 | prompt + tool + memory + response |
| Rate limit | 「429 防護」 | 由閘道執行的租戶層級上限 |
| Daily spend cap | 「每日上限」 | 租戶層級的預算與警示 |
| Kill switch | 「自動暫停」 | 支出 z-score > 4 時觸發自動暫停 |
| Cost per resolved | 「產品單位指標」 | 以產品成果而非 token 計算成本 |
| Telemetry joiner | 「追蹤資料連結帳單」 | 精確度最高的歸因模式 |
| Stacked optimization | 「快取 + 批次 + 路由 + 閘道」 | 疊加後可將成本降至基準的約 5% 至 10% |

## Further Reading｜延伸閱讀

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
