# 正式環境中的 LLM 混沌工程（Chaos Engineering for LLM Production）

> 針對 LLM 系統的混沌工程在 2026 年已獨立演進為一門專門學科。在正式環境中展開主動破壞性實驗前，必須嚴格具備五大先決條件：明確的 SLI/SLO 目標、覆蓋 Trace、Metric 與記錄（Log）的全鏈路可觀測性、自動回滾、標準化維運手冊（Runbook）以及專職值班人員。完整架構橫跨四個架構平面：控制平面（實驗排程調度器）、目標平面（微服務、實體架構、資料儲存層）、安全平面（防護欄 + 緊急終止按鈕 + 流量過濾器）、可觀測性平面（指標 + 追蹤 + 記錄），並形成反哺 SLO 動態調整的回饋閉環。安全防護欄是不可妥協的硬約束：燃盡率（Burn-rate）警報在單日錯誤預算消耗速度超過預期 2 倍時強制自動暫停實驗；靜默窗口會抑制爆炸半徑內的非實驗告警，並以 Trace-ID 關聯去重。推薦實施節奏：每週進行小規模金絲雀驗證與 SLO 檢討；每月舉行跨團隊防災演練日（Game Day）並產出事故檢討報告；每季度展開跨團隊系統韌性稽核與依賴圖譜梳理。LLM 專屬五大經典混沌實驗：記憶體超載、網路中斷、模型供應商大面積癱瘓、惡意畸形 Prompt 炸彈、KV 快取驅逐風暴。主流工具鏈：Harness Chaos Engineering（AI 輔助推薦、爆炸半徑自動降級、MCP 工具鏈原生整合）、LitmusChaos（CNCF 畢業級專案）、Chaos Mesh（CNCF 雲原生專案）。

**Type:** Learn
**Languages:** Python (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 列出正式環境混沌工程的五大必備先決條件（SLI/SLO、可觀測性、自動回滾、維運手冊、值班制度），並深刻解釋跳過任何一項為何會讓混沌實驗直接退化為真實生產事故。
- 精準繪製四個架構平面（控制、目標、安全、可觀測性）以及回饋至 SLO 動態校準的完整架構閉環圖。
- 列出五種 LLM 專屬的混沌實驗（記憶體超載、網路故障、供應商中斷、格式錯誤的 Prompt、KV 快取驅逐風暴）。
- 依據團隊現有基礎架構技術堆疊，理性在 Harness、LitmusChaos 與 Chaos Mesh 之間做出選型。

## The Problem｜問題

傳統微服務技術堆疊下的混沌工程早已成熟。然而 LLM 系統引入了前所未見的全新失效模式。一段長達 4k Token 且深嵌了特殊毒性字元的惡意 Prompt，直接導致 Tokenizer 停滯 12 秒。上游模型供應商突發 HTTP 429 限流；前端 Gateway 盲目啟動自動重試；重試放大的並行流量使服務發生記憶體不足（OOM）。一次突發負載觸發了 KV 快取驅逐風暴，造成重新執行 Prefill 的連鎖反應，使運算資源飽和。

上述極端狀況在常規單元測試中完全隱形。混沌工程正是為了在真實使用者遭遇災難之前，主動在受控環境下將這些潛在暗病徹底逼出水面。

## The Concept｜核心概念

### 先決條件（Prerequisites）

在未湊齊以下五大拼圖之前，切忌在正式環境擅自執行任何混沌實驗：

1. **SLI/SLO**——擁有清晰量化的服務等級指標與目標。
2. **可觀測性體系**——Trace 追蹤、Metric 指標、Log 記錄全鏈路打通，並在儀表板上即時視覺化。
3. **自動回滾**——第 17 課第 20 節的策略旗標回滾。
4. **結構化 Runbook**——第 17 課第 23 節所確立的標準化維運處方手冊。
5. **值班制度（On-call）**——必須有真實的工程師隨時待命響應突發狀況。

缺少上述任何一項，混沌實驗就會變成真正的事故。

### 四個架構平面與回饋閉環（Four planes + feedback）

**控制平面（Control plane）**——實驗調度排程核心（Litmus Workflow、Chaos Mesh Schedule、Harness UI 控制台）。

**目標平面（Target plane）**——被注入故障的目標對象：微服務、Pod 容器、實體節點、負載平衡器、底層資料庫與快取。

**安全平面（Safety plane）**——全域緊急中斷開關（Kill switch）、警報抑制窗口、爆炸半徑（Blast radius）硬性邊界、錯誤預算防護閘門。

**可觀測性平面（Observability plane）**——常規監控指標 + 基於 Trace-ID 的關聯追蹤，用以精確區分當前故障究竟是由混沌實驗主動引發，還是源自線上系統的自然崩潰。

**回饋閉環（Feedback loop）**——實驗發現會回饋到 SLO 調整、runbook 更新與程式碼修正。

### 防護欄是絕對的剛性約束（Guardrails are mandatory）

- **錯誤預算燃盡率警報（Burn-rate alert）**：若當日錯誤預算的消耗速度超過預期的 2 倍，安全平面會暫停實驗。
- **警報抑制窗口（Suppression windows）**：在實驗進行期間，精準抑制爆炸半徑內的非實驗告警，防止值班群組被大量告警淹沒。
- **Trace-ID 標籤關聯**：所有由實驗引發的錯誤都加上標籤，方便值班人員去重。

### 五大 LLM 專屬混沌實驗（Five LLM-specific experiments）

1. **記憶體超載與搶佔衝擊（Memory overload）**——透過以極高並行併發超長上下文 Prompt，強制觸發推論引擎的 KV 快取搶佔風暴。觀察服務是否能平順地降低負載，還是會崩潰？

2. **跨節點網路斷連（Network failure）**——主動切斷推論 Gateway 與底層供應商之間的網路連線。觀測目標：自動容錯移轉是否能在 SLA 內啟動？（第 17 課第 19 節）

3. **供應商全面癱瘓模擬（Provider outage simulation）**——模擬 OpenAI API 100% 回傳 HTTP 429 限流報錯。觀測目標：路由是否會容錯移轉至 Anthropic？（第 17 課第 16 與 19 節）

4. **惡意畸形 Prompt 炸彈（Malformed prompt）**——向服務端注入專門導致 Tokenizer 卡死的特殊邊界字元（極深層嵌套的 Unicode、異常 UTF-8 字碼點）。觀測目標：單一請求是否會讓一個 Worker 卡住？

5. **KV 快取驅逐風暴（KV eviction storm）**——透過極限打滿 vLLM 的 Block 區塊預算，強制引發大規模快取淘汰。觀察 LMCache 是否能復原，或服務是否會降級。

### 實施節奏（Cadence）

- **每週常態**——在預發布環境（Staging）進行小規模金絲雀演練；也可考慮在正式環境使用 5% 流量。
- **每月演練日（Game Day）**——針對特定預設的重大故障場景舉行全流程實戰演習；跨團隊參與；會後進行事後檢討。
- **每季度大審**——展開跨團隊系統韌性全面稽核；重新梳理並更新全鏈路服務依賴圖譜。

### 工具鏈選型（Tooling）

- **Harness Chaos Engineering**——商用工具；提供 AI 產生的實驗建議、爆炸半徑縮減及 MCP 工具整合。
- **LitmusChaos**——CNCF 畢業級專案；基於 Kubernetes 宣告式 Workflow 運作。
- **Chaos Mesh**——CNCF sandbox 專案；Kubernetes 原生 CRD 風格。
- **Gremlin**——商用混沌工程平台；支援範圍廣。
- **AWS FIS** / **Azure Chaos Studio**——各大超大規模雲端供應商內建的原生託管混沌服務。

### 從微小起步（Starting small）

團隊的第一個混沌實驗：在平穩流量下對一個 decode 副本執行 pod-kill。觀察重新導流與復原。若此實驗運作正常且看起來安全，再進階至網路層故障注入。

團隊的第一個 LLM 專屬實驗：主動向某家供應商注入持續 5 分鐘的 HTTP 429 故障。即時驗收系統的容錯移轉機制。絕大多數團隊往往在此時才猛然發現，自家的備援切換邏輯未經充分測試。

### 務必銘記的核心數字指標（Numbers you should remember）

- 混沌的四個架構平面：控制平面、目標平面、安全平面、可觀測性平面。
- 燃盡率中止閾值：當日錯誤預算消耗率超過每日預期消耗量的 2 倍時暫停。
- 推薦演進節奏：每週金絲雀演練、每月 Game Day 演習、每季深度韌性稽核。
- 五大 LLM 專屬維度：記憶體超載、網路阻斷、供應商斷線、畸形 Prompt、KV 快取風暴。

```figure
i4-chaos-guard
```

## Use It｜實際應用

`code/main.py` 模擬了一套配備安全平面防護閘門的混沌實驗執行器。在模擬環境下主動觸發三類故障注入，回報哪些實驗會觸發燃盡率中止警報。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-chaos-plan.md`。根據目前的技術堆疊與團隊成熟度，該 Skill 規劃前三項混沌實驗並選擇工具。

## Exercises｜練習

1. 執行 `code/main.py`。哪一項實驗觸發了燃盡率安全閘門？背後的觸發機理是什麼？
2. 為一套基於 vLLM 打造的企業級 RAG 檢索服務設計前五個必備的混沌實驗。為每一項實驗明確列出成功驗收判定準則。
3. 你的錯誤預算燃盡率警報強制暫停了當前的混沌實驗。你該如何精準研判當前系統中的異常錯誤究竟是混沌實驗主動引起，還是線上真實爆發的獨立偶發故障？
4. 深入辯論混沌實驗究竟應當在正式環境直接執行，還是嚴格限制在預發布環境？什麼情況下正式環境才是合適的選擇？
5. 列出三項傳統通用網路故障注入工具完全無法模擬、唯有 LLM 系統才會特有的專屬崩潰模式。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| SLI / SLO | 「服務目標」 | 指標與目標；必要的先決條件 |
| Blast radius | 「影響範圍」 | 實驗影響的服務與使用者集合 |
| Burn-rate alert | 「預算閘門」 | 錯誤預算消耗率高於預期兩倍時觸發 |
| Game day | 「每月演練」 | 定期舉行的跨團隊混沌演練 |
| LitmusChaos | 「CNCF 工作流程」 | CNCF 畢業專案的 Kubernetes 混沌工具 |
| Chaos Mesh | 「CNCF CRD」 | CNCF sandbox 的 Kubernetes 原生混沌工具 |
| Harness CE | 「商用 AI 輔助工具」 | Harness 混沌工程，提供 AI 建議 |
| Malformed prompt | 「tokenizer 炸彈」 | 會使 tokenizer 停滯的輸入 |
| KV eviction storm | 「搶佔連鎖」 | 大量快取驅逐導致重複 prefill |

## Further Reading｜延伸閱讀

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
