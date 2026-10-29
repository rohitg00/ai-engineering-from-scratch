# AI Gateways 閘道技術——LiteLLM、Portkey、Kong AI Gateway、Bifrost（AI Gateways — LiteLLM, Portkey, Kong AI Gateway, Bifrost）

> AI 閘道（Gateway）位處你的應用程式與底層模型服務供應商之間。其核心能力涵蓋服務供應商智慧路由、故障容錯移轉、指數退避重試、速率限制、機密憑證參照、全鏈路可觀測性以及安全性 Guardrails 防護欄。2026 年的市場技術格局清晰分立：**LiteLLM** 採 MIT 授權開源，支援 100 多家模型服務供應商並與 OpenAI 相容，但在公開壓測中約在 2,000 RPS 時遭遇效能崩潰（記憶體使用量約 8 GB，並引發連鎖故障）；最適配 Python 技術堆疊、500 RPS 以下或研發測試原型。**Portkey** 主打企業級控制平面定位（防護欄、PII 個資遮罩、越獄偵測、合規稽核追蹤），於 2026 年 3 月全面轉為 Apache 2.0 開源，單請求引入約 20 至 40 ms 延遲，提供每月 49 美元的正式環境方案。**Kong AI Gateway** 則直接生長於成熟的 Kong Gateway 企業級底座之上——Kong 官方在等價 12 核心 CPU 上的實測顯示：其吞吐量比 Portkey 快 228%，比 LiteLLM 更是狂飆 859%；採每模型每月 100 美元計價（Plus 層級上限 5 款模型）；若企業已深度採用 Kong 則堪稱最佳歸宿。**Bifrost**（Maxim AI 出品）主打採用可設定退避的自動重試，以及在 OpenAI 回應 429 時自動改用 Anthropic。**Cloudflare 與 Vercel AI Gateways** 則提供邊緣端零維運的全託管基礎重試能力。資料落地合規要求直接驅動了企業是否自行託管的決策；Portkey 與 Kong 則憑藉開源加可選託管的混合架構穩居中流砥柱。

**Type:** Learn
**Languages:** Python (stdlib, toy gateway-routing simulator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 16 (Model Routing)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 列出 AI 閘道的六項核心功能（智慧路由、容錯移轉、自動重試、速率限制、機密憑證參照、可觀測性、安全防護欄）。
- 梳理 2026 年四大主流閘道（LiteLLM、Portkey、Kong AI、Bifrost）的規模與效能上限及適用場景。
- 引用 Kong 官方權威跑分結論（相較於 Portkey 快 228%，相較於 LiteLLM 快 859%），並說明這項落差對超過 500 RPS 的情境有何影響。
- 立足於資料落地法律約束與工程維運預算，理性在自行託管與雲端全託管之間做出架構決策。

## The Problem｜問題

你的核心產品同時整合了 OpenAI、Anthropic 以及自行託管的 Llama 群集。每家服務供應商皆擁有獨立的 SDK、迥異的錯誤碼格式、自成一體的速率限制，以及獨家的身分鑑別機制。你需要故障切換（若 OpenAI 回應 429，則嘗試 Anthropic）、單一憑證儲存庫、統一的可觀測性，以及按租戶設定的速率限制。

若在應用層重複造輪子實作這些邏輯，會讓每項服務都與每家服務供應商耦合。架構專屬的 AI Gateway 閘道層，將上述複雜性統一收攏至單一獨立行程中，對外暴露單一標準 API（通常相容 OpenAI 規範），由其在底層向各大服務供應商扇出發派。

## The Concept｜核心概念

### 六大核心功能（Six core features）

1. **服務供應商智慧路由（Provider routing）**——將 OpenAI、Anthropic、Gemini 與私有推論群集統一封裝於單一 API 後方。
2. **故障容錯移轉（Fallback）**——當遭遇 HTTP 429、5xx 服務端錯誤或輸出品質滑鐵盧時，自動將請求無縫轉發至備援模型。
3. **指數退避重試（Retries）**——採用指數退避，並限制重試次數。
4. **全域速率限制（Rate limits）**——支援依據租戶 ID、API Key 或特定模型維度劃分配額。
5. **憑證參照（Secret references）**——在執行時期從 Vault 取得憑證，應用程式中不存放憑證。
6. **可觀測性體系（Observability）**——輸出符合 OpenTelemetry GenAI 語意約定的追蹤（第 17 課第 13 節）並精確拆解各業務線成本。
7. **安全性防護欄（Guardrails）**——個資 PII 即時遮罩、越獄攻擊即時防禦，以及違規主題內容過濾。

### LiteLLM——MIT 開源、純 Python（LiteLLM — MIT OSS, Python）

- 原生支援 100 多家模型服務供應商，符合 OpenAI 相容規範，內建路由器、容錯移轉與基礎監控。
- 在 Kong 的官方壓力測試中，約在 2,000 RPS 時遭遇架構極限；記憶體使用量約 8 GB，在持續高負載下引發連鎖故障。
- 最適合：純 Python 應用、每秒請求數低於 500 RPS、開發測試環境閘道或實驗性質的動態路由驗證。
- 授權與定價：純開源零成本；官方提供可選的雲端託管免費版。

### Portkey——控制平面戰略定位（Portkey — control plane positioning）

- 自 2026 年 3 月起全面轉為 Apache 2.0 開源協議。主打企業級安全防護欄、PII 個資遮罩、Prompt 越獄偵測與稽核軌跡。
- 每次請求增加約 20 至 40 ms 延遲。
- 正式環境託管版每月 49 美元，包含資料保留與 SLA。
- 最適用於需要整合安全防護欄與可觀測性的受監管產業。

### Kong AI Gateway——極致吞吐量規模之選（Kong AI Gateway — the scale play）

- 建立於成熟的 Kong Gateway API 閘道產品之上，採用 Lua 與 OpenResty。
- Kong 官方在等價 12 核心 CPU 環境下的基準測試：吞吐量比 Portkey 快 228%，比 LiteLLM 狂飆 859%。
- 定價模式：每模型每月 100 美元（Plus 方案上限納管 5 款模型）。
- 最適合：已使用 Kong、每秒請求數超過 1,000，且願意購買授權的團隊。

### Bifrost (Maxim AI)

- 主打可設定退避的自動重試機制。
- 當遭遇 OpenAI 429 速率限制時，改用 Anthropic 是其典型做法。
- 較新的商業產品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 雲端全託管、極致零維運。提供開箱即用的基本重試與調用監控。
- 最優適配：在 Cloudflare/Vercel 邊緣提供服務的 JavaScript 應用程式。
- 相較於 Kong 與 Portkey，其安全防護欄與速率限制功能較有限。

### 自行託管 vs 雲端全託管（Self-hosted vs managed）

資料落地法規是企業決定自行託管的關鍵因素。醫療保健與金融機構預設自行託管（部署 LiteLLM、Portkey 開源版或 Kong）。消費級通用產品則預設採用全託管雲端閘道（Cloudflare AI Gateway）或中間層級方案（Portkey 託管版）。混合架構：針對強監管企業租戶提供自行託管的獨立實例，其餘普通流量統一導向雲端託管閘道。

### 延遲預算精算（Latency budget）

- LiteLLM：常規引入 5 至 15 ms 額外延遲。
- Portkey：引入 20 至 40 ms 額外延遲。
- Kong：極致輕量，僅引入 3 至 8 ms 微延遲。
- Cloudflare / Vercel：在邊緣節點就近轉發，僅需 1 至 3 ms 延遲。

閘道延遲會直接增加 TTFT。若 SLA 要求 TTFT P99 < 100 ms，可選 Kong 或 Cloudflare；若 P99 < 500 ms，任何閘道都可符合。

### 速率限制語意至關重要（Rate-limit semantics matter）

簡單的 Token-bucket 演算法可用於中等規模。多租戶場景需要滑動窗口（Sliding-window）演算法、突發額度與租戶分級配額。LiteLLM 內建基礎 token-bucket；Kong 提供滑動窗口；Portkey 則提供分級配額。

### 閘道 + 可觀測性 + 路由的三位一體（Gateway + observability + routing compose）

第 17 課第 13 節（可觀測性）、第 16 節（模型路由）與第 19 節（AI 閘道）在真實正式環境中實質上是同一個架構層次。要麼挑選一款能同時通吞這三者的旗艦工具，要麼在架構中進行精妙的模組化拆解：2026 年多數部署會將 Helicone（可觀測性）或 Portkey（安全防護欄）與 Kong（高吞吐核心調度）搭配使用，各司其職。

### 務必銘記的核心數字指標（Numbers you should remember）

- LiteLLM 架構極限：約在 2,000 RPS 遇到瓶頸，記憶體使用量約 8 GB。
- Portkey 延遲代價：單請求引入 20 至 40 ms 開銷；2026 年 3 月起全面轉為 Apache 2.0 開源。
- Kong 官方跑分領先幅度：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 商用定價矩陣：每模型每月 100 美元，Plus 方案上限 5 款模型。
- Cloudflare/Vercel：邊緣端的額外延遲為 1 至 3 ms。

```figure
mx-gateway-fallback
```

## Use It｜實際應用

`code/main.py` 模擬一套在主動注入 429 限流與 5xx 故障的負載下，跨 3 家模型服務供應商進行智慧路由與自動降級的微型閘道。終端機即時輸出各策略下的端到端延遲、重試觸發率以及備援命中率指標。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-gateway-picker.md`。根據規模、維運方式、合規要求與延遲預算，挑選一款 AI 閘道。

## Exercises｜練習

1. 執行 `code/main.py`。配置由 OpenAI → Anthropic → 自行託管 的三級降級容錯鏈路。若單一服務供應商的錯誤率為 5%，預期備援命中率是多少？
2. 業務 SLA 嚴格承諾 P99 TTFT 必須小於 200 ms，而後端推論的基準延遲為 300 ms。哪幾款閘道能安全落入該延遲預算之內？
3. 某醫療機構客戶要求閘道必須完全自行託管、具備個資 PII 即時遮罩能力，並提供稽核功能。在 Portkey 開源版與 Kong 之間做出抉擇並給出論證。
4. 深度對比 LiteLLM 與 Kong：研發團隊的 RPS 達到多少時，應該從前者遷移至後者？
5. 為多租戶 SaaS 設計速率限制策略，涵蓋免費、試用與付費方案。你會選擇 token-bucket 還是 sliding-window？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Gateway | 「API 仲介」 | 位於應用程式與服務供應商之間的行程 |
| LiteLLM | 「MIT 授權版本」 | Python 開源軟體，支援 100 多家服務供應商，在 2K RPS 左右會遇到效能瓶頸 |
| Portkey | 「防護欄閘道」 | 控制平面與可觀測性，採 Apache 2.0 授權 |
| Kong AI Gateway | 「支援高規模的閘道」 | 建立於 Kong Gateway 上，基準測試表現領先 |
| Bifrost | 「Maxim 的閘道」 | 自動重試與 Anthropic 備援方案 |
| Cloudflare AI Gateway | 「邊緣託管」 | 部署於邊緣的託管式閘道，無需維運 |
| PII redaction | 「資料遮罩」 | 傳送給模型前以 Regex + NER 遮罩資料 |
| Jailbreak detection | 「prompt 注入防護」 | 用分類器檢查使用者輸入 |
| Audit trail | 「合規記錄」 | 每次 LLM 呼叫的不可變記錄 |
| Token-bucket | 「簡易速率限制」 | 以補充 token 的方式運作的速率限制器 |
| Sliding-window | 「精確速率限制」 | 依時間窗口計算的速率限制器，公平性較佳 |

## Further Reading｜延伸閱讀

- [Kong AI Gateway Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm) — 官方吞吐量與延遲深度對比實測報告。
- [TrueFoundry — AI Gateways 2026 Comparison](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison) — 2026 最新閘道競爭格局指南。
- [Techsy — Top LLM Gateway Tools 2026](https://techsy.io/en/blog/best-llm-gateway-tools) — 頂級大模型閘道橫向橫評。
- [LiteLLM GitHub](https://github.com/BerriAI/litellm) — 開源核心儲存庫。
- [Portkey GitHub](https://github.com/Portkey-AI/gateway) — 控制平面開源專案。
- [Kong AI Gateway docs](https://docs.konghq.com/gateway/latest/ai-gateway/) — 官方架構指南與配置手冊。
