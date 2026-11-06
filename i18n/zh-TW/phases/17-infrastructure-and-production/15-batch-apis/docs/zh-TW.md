# Batch API 批次處理——五折優惠的業界通用標準（Batch APIs — the 50% Discount as Industry Standard）

> 各大服務供應商都提供非同步 Batch API，折扣為 50%，處理時間約 24 小時。OpenAI、Anthropic、Google 及多數推論平台（Fireworks batch tier、Together batch）採用相同模式。將 Batch API 與 prompt caching 疊加，夜間管線的成本可降至同步且未使用快取成本的約 10%。規則很簡單：若不需要互動，就採用批次處理。內容生成管線、文件分類、資料擷取、報告生成、大量標記、目錄標籤——任何能容忍 24 小時延遲的工作負載，在改用批次處理前都會造成額外成本。2026 年的正式環境模式是將每個新的 LLM 工作負載分為三類：互動式（同步並使用快取）、半互動式（非同步佇列，並提供備援）、批次（夜間處理，並疊加快取）。那些看似需要互動、實際上能容忍幾分鐘延遲的工作負載會浪費大部分成本。

**Type:** Learn
**Languages:** Python (stdlib, toy batch-vs-sync cost simulator)
**Prerequisites:** Phase 17 · 14 (Prompt & Semantic Caching)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 列出三家服務供應商的 Batch API（OpenAI、Anthropic、Google），並掌握其通用的 50% 折扣優惠與 24 小時履約承諾。
- 精確計算在夜間離線分類業務中將「Batch API」與「快取輸入」雙重疊加後的財務成本，並與同步未快取基準線進行橫向對比。
- 熟練將各類業務負載分流至即時互動／半即時／批次三大專屬通道，並給出架構層面的充分論證。
- 指出兩個陷阱：部分互動性（使用者期待比 24 小時更快收到結果）與輸出結構漂移（各服務供應商的批次檔案格式不同）。

## The Problem｜問題

你的團隊維運著一套夜間自動產生企業營運報告的離線管線。每晚處理 50,000 份文件，分別進行摘要提煉、對摘要展開語意分群，最終起草一份高階主管決策簡報。若以傳統同步方式運作，耗時 4 小時且每晚消耗高達 2,000 美元。隨後你聽說了 Batch API。

切換至 Batch API 直接為全線帳單打 5 折。你隨後又為這 50,000 次呼叫所共享的系統 Prompt 啟用 prompt caching。兩項技術疊加後，每晚帳單降至 180 美元——約為原始基準線的 9%。管線相同，只改了三項設定。

Batch API 是 LLM 成本工具箱中最便宜、卻最少人採用的槓桿。原因大多是組織因素：團隊認為需要「即時」，但 SLA 實際要求只是「早上前交付」。本課說明如何不把 90% 的帳單留在桌上。

## The Concept｜核心概念

### 三大主力 Batch API（The three batch APIs）

**OpenAI Batch API**：透過上傳包含單行獨立請求的 JSONL 檔案發起。官方承諾 24 小時內完成履約（實務上通常約需 2 至 8 小時）。針對輸入與輸出 Token 全程提供 50% 的折扣。對外暴露標準的 `/v1/batches` 管理端點。若輸入 Prompt 符合快取資格，更能在此 5 折基礎上進一步疊加快取輸入專屬折扣。

**Anthropic Message Batches**：同樣採 JSONL 檔案批次上傳機制。承諾 24 小時非同步履約。全線 5 折。原生完整支援 `cache_control`——快取寫入顯式標註，同一批次內部的後續請求自動享有快取讀取折扣。

**Google Vertex AI Batch Prediction**：輸入可來自 BigQuery 或 GCS。Gemini 也有類似的 50% 折扣。深度整合進 GCP 的 Vertex Pipelines 工作流。

### 語意本質：非同步，而非緩慢（Semantic: asynchronous, not slow）

批次處理的真實語意是「我承諾在 24 小時以內將結果交給你」——絕非「每個請求都要跑滿 24 小時」。在真實環境中，P50 耗時通常落在 2 至 6 小時區間。各大雲端服務供應商本質上是將你的批次任務靈活排程至深夜或離峰時段，動態填補其閒置 GPU 庫存的算力低谷。

### 疊加快取技術（Stack with caching）

以 50,000 份文件摘要且共享相同的 4k Token 系統 Prompt 為例：

- 同步未快取：50000 × ($input × 4000 + $output × 200)，依原價計費。
- 同步有快取：system prompt 首次寫入快取後，其餘 49,999 次呼叫享有便宜 10 倍的輸入單價。
- 批次有快取：在上述快取巨大節省的基礎之上，對讀取費率、寫入費率與輸出費率全額再次砍半（打 5 折）。

技術疊加效應：批次處理 + 快取 = 約為同步未快取帳單的 10%。任何在夜間運作且共用 system prompt 的工作負載，都應採用這種做法。

### 業務工作負載分流決策（Workload triage）

**即時互動通道（Interactive）**——使用者在螢幕前焦急等待文字跳出。TTFT 很重要。必須走同步呼叫，搭配 Prompt 快取。絕對無法採用批次處理。

**半互動任務（Semi-interactive）**——使用者送出任務，幾分鐘後回來查看。使用非同步佇列；批次處理不可用時改為同步呼叫。例如中等流量的 RAG 索引建置。

**批次通道（Batch）**——使用者期望在「明早開工前」或「下一小時內」拿到批次結果。內容產出管線、大規模分類、離線分析。必須百分之百採用批次處理，並強制疊加前綴快取。

常見錯誤：因為管線屬於正式環境，就把所有工作負載都歸為互動式。正式環境不是延遲規格——SLA 才是。

### 部分互動性陷阱（The partial-interactivity trap）

許多業務功能表面上看似即時互動，但實質上完全能容忍 5 至 10 分鐘的非同步等待。經典範例：夜間客戶健康報告的「重新整理」按鈕。使用者點選重新整理後，等待 10 分鐘通常完全在接受範圍內。然而研發團隊往往習慣性將其直接實作為前端同步阻塞。若 50 位使用者同時點選重新整理，其成本是採用批次處理並以電子郵件交付方案的 10 倍。

應該問：「24 小時對這位使用者代表什麼？」如果答案是「他們不會注意到」，就採用批次處理。

### 輸出格式差異陷阱（The output-schema trap）

各大服務供應商的批次檔案格式各不相同：

- OpenAI：JSONL 格式，每行一個 request。
- Anthropic：JSONL 格式，每行一個 message，且 response format 內嵌。
- Vertex：BigQuery 資料表或帶有 TFRecord 的 GCS prefix。

若要跨服務供應商撰寫「單一批次用戶端」，仍須為各服務供應商編寫轉接程式碼。宣稱支援多服務供應商批次的 Gateway（Portkey、部分方案的 LiteLLM）仍只是對原始格式做薄封裝。

### 務必銘記的核心數字指標（Numbers you should remember）

- 各大雲端廠通用的批次折扣：輸入與輸出 Token 全面統一 5 折（50% off）。
- 履約保證 SLA：官方承諾 24 小時內交付；真實 P50 耗時約 2 至 6 小時。
- 疊加批次與快取的綜合成效：總算力支出被壓縮至原始同步未快取的約 10%。
- 分流決策鐵律：凡是業務能容忍 24 小時非同步的任務，永遠強制採用批次處理。

```figure
batch-lane-triage
```

## Use It｜實際應用

`code/main.py` 針對 50,000 份文件的典型批次負載，橫向精算四種不同架構下的財務開銷：純同步、同步+快取、純批次、批次+快取。即時輸出各方案的美元總支出與淨節省百分比。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-batch-triager.md`。輸入具體業務負載屬性、使用者期望時效與資料吞吐規模，該 Skill 會將任務分流至互動、半互動或批次處理，並估算節省金額。

## Exercises｜練習

1. 執行 `code/main.py`。針對包含 10 萬份文件、系統 Prompt 為 3k Token 且輸出為 500 Token 的離線管線，計算全套技術疊加（批次 + 快取）相較於原始同步基準線所能節省的確切金額。
2. 檢視你目前所屬產品中的三項真實 AI 功能。將它們分別精準分流至即時互動／半即時／批次三大專屬通道，並為每一項給出充分論據。
3. 某使用者投訴其報告在送出後花費了 3 小時才產出。這是錯誤分流至批次處理，還是確實需要互動式處理？寫出判斷準則。
4. 你的 Batch API 官方履約承諾是 24 小時，但長尾 P99 偶發達到 20 小時。你該如何向終端使用者設計產品互動——當遭遇極限長尾時，下游系統應當展現何種容錯行為？
5. 計算損益平衡點：共享前綴要多長，批次處理 + 快取才會比在你已預留的 GPU 上整晚執行更便宜？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Batch API | 「非同步折扣」 | 24 小時內完成並享有 50% 折扣 |
| JSONL | 「批次格式」 | 每行一個 JSON 請求；OpenAI／Anthropic 標準格式 |
| Message Batches | 「Anthropic 批次」 | Anthropic 批次 API 的產品名稱 |
| Batch prediction | 「Vertex 批次」 | Vertex AI 的批次 API 產品 |
| Turnaround SLA | 「24 小時承諾」 | 這是履約保證而非常見耗時；通常需 2 至 6 小時 |
| Workload triage | 「互動性判斷」 | 判定採互動、半互動或批次處理 |
| Output schema | 「回應格式」 | 各服務供應商的 JSONL 版面配置不同，無法直接移植 |
| Stacked discount | 「批次 + 快取」 | 兩者同時適用時，費用約為未快取同步處理的 10% |

## Further Reading｜延伸閱讀

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — 官方 JSONL 規格與 `/v1/batches` 管理語意。
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — 批次傳輸格式與 `cache_control` 快取互動指南。
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) — Gemini 批次預測語意與架構。
- [Finout — OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison) — 2026 雲端大廠費率橫向對比。
- [Zen Van Riel — LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/) — 最新 API 成本結構解析。
