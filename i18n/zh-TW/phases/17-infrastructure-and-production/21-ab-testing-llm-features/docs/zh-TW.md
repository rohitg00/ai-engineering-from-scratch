# LLM 功能的 A/B 測試——GrowthBook、Statsig 與「憑感覺上線」的終結（A/B Testing LLM Features — GrowthBook, Statsig, and the Vibes Problem）

> 傳統的 A/B 測試框架並非為具備隨機非確定性（Non-deterministic）的 LLM 量身打造。兩者存在本質分工邊界：離線評測（Evals）回答「模型是否有能力勝任該任務？」線上 A/B 測試則回答「真實使用者究竟在不在意這項改變？」兩者皆屬不可或缺的硬性要求；只憑感覺檢查就上線的做法已過時。2026 年核心測試三大維度：Prompt 工程（措辭修飾）、模型選型（GPT-4 vs GPT-3.5 vs 開源模型；準確率 vs 成本 vs 延遲的三角權衡），以及生成參數（Temperature、Top-p）。真實經典實戰成效：某對話機器人採用獎勵模型變體後，對話長度增加 70%、使用者留存率提升 +30%；Nextdoor 在精修獎勵函數後點閱率（CTR）達到 +1% 的淨增長；可汗學院（Khan Academy）的 Khanmigo 助手則反覆調整延遲與數學準確率之間的取捨。平台比較：**Statsig**（於 2025 年 9 月被 OpenAI 以 11 億美元收購）——原生整合循序檢定（Sequential testing）、CUPED 變異數減少與一站式整合方案。**GrowthBook**——採 MIT 授權開源，原生生長於雲端資料倉儲之上，提供貝氏、頻率學派與循序檢定三大引擎，完整實裝 CUPED、SRM 樣本失配校驗，以及 Benjamini-Hochberg 與 Bonferroni 多重比較校正。選型取決於企業對資料倉儲 SQL 的偏好，以及貴公司是否介意採用「已被 OpenAI 納入麾下」的商業軟體。

**Type:** Learn
**Languages:** Python (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格界定離線評測 Evals（「模型能不能做」）與線上 A/B 測試（「使用者在不在意」）的架構職責邊界。
- 梳理三大可測試維度（Prompt 模板、模型版本、推論取樣參數），並為每一項維度精準選定核心評估指標。
- 解釋 CUPED、循序檢定（Sequential testing）以及 Benjamini-Hochberg 多重比較校正。
- 依據對 warehouse-SQL 的偏好與企業對收購的立場，在 Statsig 與 GrowthBook 之間做出理性決策。

## The Problem｜問題

你手動調整了一段新的系統 Prompt。你讀起來覺得語氣舒服多了。你直接將其全量發布至正式環境。隨後產品的轉化率在統計雜訊區間內微幅震盪。你把責任推給指標不靈敏。或者你發布了一款新模型，而轉化率紋絲不動——究竟是模型發生了隱微的退化，還是這項改動本身太過微小根本無法被偵測？你完全無法得出客觀結論，因為你從未經過嚴密的 A/B 實驗。

離線 Evals 只能驗證模型在已標註的固定資料集上是否具備特定任務能力。它絲毫無法回答真實使用者是否真心偏好這項輸出。唯有在線上對真實使用者展開受控的隨機分流實驗才能回答這個問題——且前提是該實驗具備足夠的統計檢定力（Power）、妥善控制了 LLM 的底層非確定性，並嚴格實施了多重假設檢定校正。

## The Concept｜核心概念

### 離線評測（Evals）vs 線上 A/B 測試（A/B tests）

**離線評測（Evals）**——離線執行、依賴已標註測試集、由評估器評判（評分量表 Rubric、LLM-as-a-judge 或人工審查）。回答的核心問題：「在當前這份固定資料分佈下，模型的輸出是否足夠正確、有幫助且安全？」

**線上 A/B 測試（A/B test）**——在線上面向真實使用者，以隨機方式分派。回答的核心問題：「這個候選新版本是否真正推動了業務層面最核心的使用者指標？」

兩者缺一不可。Evals 在模型接觸真實使用者前攔截回歸缺陷；A/B 測試則在發布後確認對產品業務的實質影響。

### 究竟該測試什麼維度（What to test）

1. **Prompt 工程設計**——文字措辭、系統 Prompt 結構、Few-shot 範例選擇。度量指標：任務成功率、使用者留存率、單次請求成本。
2. **底層模型選型**——GPT-4 vs GPT-3.5-Turbo vs 開源 Llama 變體。度量指標：任務準確率 + 單請求成本 + P99 延遲。典型多目標聯合最佳化。
3. **生成取樣超參數**——Temperature 溫度、Top-p、Max_tokens。度量指標：依據具體任務而定（輸出多樣性 vs 嚴格確定性）。

### CUPED——變異數減少（CUPED — variance reduction）

Controlled-experiments Using Pre-Experiment Data（基於實驗前資料的受控實驗技術）。核心在於利用實驗前該使用者群體的歷史基準資料，透過線性迴歸將天然存在的個體差異變異數剔除。實測典型變異數減少幅度：30% 至 70%。有效樣本量也會隨之增加。

Statsig 與 GrowthBook 都有實作該演算法。

### 循序檢定（Sequential testing）

傳統經典的 A/B 測試嚴格依賴固定樣本量，中途偷看資料會嚴重虛胖顯著性。循序檢定（Sequential testing，允許「邊看邊做決策」）在多次連續觀測下嚴格將偽陽性（False-positive）機率控制在預設 α 門檻之內。永遠有效的循序檢定程序（如 mSPRT、Howard 信賴序列）允許你在結果明確勝出時提前停止實驗，極大節省線上試錯成本。

### 多重比較校正（Multiple-comparison corrections）

若你在 95% 信賴水準下同時平行運作 20 個 A/B 測試，純粹依靠隨機碰巧就會產生 1 個偽陽性虛假繁榮。Bonferroni 校正透過將 α 除以測試數量進行硬性收緊；而 Benjamini-Hochberg 則精細控制錯誤發現率（False Discovery Rate, FDR）。GrowthBook 原生完整實裝了這兩大校正器。

### SRM——樣本比例失配檢驗（SRM — sample ratio mismatch）

分流演算法會將使用者隨機分派至不同版本。若 50/50 分流產生 47/53 的樣本比例，就代表出了問題；SRM 檢查會標示這種失配。兩個平台都已實作此檢查。

### Statsig vs GrowthBook

**Statsig**：
- 於 2025 年 9 月被 OpenAI 以 11 億美元正式收購。採雲端託管 SaaS 模式。
- 原生深度支援循序檢定、CUPED 變異數減少與保留族群。
- 一體化完整技術堆疊：功能開關（Feature Flags） + 線上實驗平台 + 基礎可觀測性。
- 最優適配：期望採購一體化成熟開箱方案、且完全不在意其已被 OpenAI 控股的企業。

**GrowthBook**：
- 全面遵循 MIT 開源協議；採資料倉儲原生（Warehouse-native）架構（直接查詢 Snowflake、BigQuery、Redshift 等底層資料庫）。
- 內建三大統計推論引擎：貝氏統計、頻率學派與循序檢定。
- 完整支援 CUPED、SRM、Bonferroni 與 Benjamini-Hochberg 多重校正。
- 支援私有化自建或採購託管雲端版。
- 最優適配：以資料倉儲 SQL 為核心資產、資料團隊嚴格把控指標計算層、堅定擁抱純開源生態的企業。

### 非確定性使得統計檢定力計算更加棘手（Non-determinism complicates power）

完全相同的 Prompt 在多次呼叫中會隨機產生不同的文字輸出。傳統的樣本量檢定力公式嚴格基於獨立同分佈（IID）假設。在 LLM 的非確定性干擾下，實體的有效樣本量低於表面標稱值。在進行 A/B 實驗樣本量規劃時，將所需樣本數乘以約 1.3 至 1.5 倍作為安全緩衝。

### 工業級真實案例實效（Real case outcomes）

- 某對話機器人採用獎勵模型變體：對話長度增加 70%，使用者留存率提升 +30%。
- Nextdoor 主旨行實驗：獎勵函數經過調整後，CTR 提升 1%。
- 可汗學院 Khanmigo 教育助手：在推論延遲與高難度數學解題準確率之間調整取捨。

### 致命反模式：憑個人感覺拍板發布（The anti-pattern: shipping on vibes）

每位資深工程師都能舉出一項僅因「感覺更好」而未經 A/B 測試就發布的功能。多數這類功能使產品指標退步，而團隊數月都未察覺。A/B 測試是促使團隊執行驗證的機制。

### 務必銘記的核心數字指標（Numbers you should remember）

- Statsig 併購案：2025 年 9 月被 OpenAI 以 11 億美元收購。
- GrowthBook：遵循 MIT 開源協議；集齊貝氏、頻率學派與循序檢定三大引擎。
- CUPED 變異數減少成效：實測可降低 30% 至 70% 的變異數。
- LLM 非確定性緩衝係數：實驗樣本量需額外增加 30% 至 50%。

```figure
mx-sequential-test
```

## Use It｜實際應用

`code/main.py` 模擬一套使用固定與循序檢定邊界的 A/B 實驗，展示循序檢定如何允許提前停止實驗，大幅節省時間與試錯成本。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ab-plan.md`。輸入欲變更的具體模型功能、流量特徵曲線與基準轉化率，該 Skill 將自動為你推導出最佳實驗平台選型、核心防護指標設定以及包含非確定性緩衝的精確樣本量規劃。

## Exercises｜練習

1. 執行 `code/main.py`。針對預期帶來 5% 提升、基準轉化率為 3% 的業務場景，若要達到 80% 的統計檢定力（Power），所需的最小樣本量是多少？
2. 針對一位受醫療規範、採用 on-prem 部署的客戶，在 Statsig 與 GrowthBook 之間選擇並說明理由。
3. 設計一套以每件已解決工單成本為指標、比較 GPT-4 與 GPT-3.5 的 A/B 實驗方案。分別給出第一核心指標（Primary metric）、護欄指標（Guardrail metric）與輔助次要指標（Secondary metric）。
4. 你的金絲雀發布順利通關，但後續的 A/B 測試顯示轉化率淨下跌了 1.2%。你究竟該不該發布該版本？撰寫標準的決策升級與裁決準則。
5. 將 CUPED 套用於前期變異數為後期變異數 60% 的資料，計算有效樣本數提升幅度。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Eval | 「離線測試」 | 使用標註資料集評估模型能力 |
| A/B test | 「實驗」 | 對使用者進行線上隨機比較 |
| CUPED | 「變異數減少」 | 利用實驗前資料進行迴歸以降低變異數 |
| Sequential test | 「可提早停止的檢定」 | 可在任何檢視時點保持有效並允許提早停止的程序 |
| Multiple comparison | 「整體錯誤率」 | 同時執行多項測試會增加偽陽性 |
| Bonferroni | 「嚴格校正」 | 將 α 除以測試數量 |
| Benjamini-Hochberg | 「BH 假發現率」 | 控制假發現率，較不保守 |
| SRM | 「分流異常」 | 樣本比例失配，可能是指派錯誤 |
| Statsig | 「OpenAI 旗下」 | 2025 年收購的商業一體化平台 |
| GrowthBook | 「開源版本」 | MIT 授權、資料倉儲原生的平台 |
| mSPRT | 「序貫機率比檢定」 | 傳統的序貫檢定程序 |

## Further Reading｜延伸閱讀

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/) — AI 功能 A/B 測試實戰指南。
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation) — 基於資料驅動的 LLM 最佳化實踐。
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools) — 兩大主流實驗平台深度橫向對比。
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
