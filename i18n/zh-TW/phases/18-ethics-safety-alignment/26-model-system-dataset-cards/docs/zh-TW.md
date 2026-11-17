# 模型卡、系統卡與資料集卡（Model, System, and Dataset Cards）

> 三大標準化文件格式構築了當代 AI 透明度體系的基石。**模型卡（Model Cards）**（Mitchell 等人，2019）——為機器學習模型量身打造的「營養成分標籤」：訓練資料集、跨人口學特徵的量化細分分析、倫理考量與限制警示；然而 Oreamuno 等人（2023）的實證審計發現，Hugging Face 上僅有 0.3% 的模型卡記錄了倫理考量。**資料集規格書（Datasheets for Datasets）**（Gebru 等人，2018，CACM 2021）——借鑑電子產品規格書的類比：涵蓋立項動機、資料構成、採集流程、標註、分發途徑與後續維護。**資料卡（Data Cards）**（Pushkarna 等人，Google 2022）——模組化的多層次視圖（遠望鏡級、潛望鏡級、顯微鏡級），充當跨領域溝通的邊界物件（Boundary objects）。2024 至 2025 年最新演進：基於 LLM 的自動化文件生成（CardGen，Liu 等人，2024）；詳盡的模型卡與 Hugging Face 上最高可達 29% 的下載量提升相關（Liang 等人，2024）；基於機密運算 TEE 與數位簽名的可驗證認證（Laminator，Duddu 等人，2024）；碳排放與水資源消耗等永續性報告新增欄位正在浮現（Jouneaux 等人，2025 年 7 月）；歐盟法案與 ISO 合規卡的興起。**系統卡（System Cards）**（Sidhpurwala 2024；Meta 系統級透明度；《Blueprints of Trust》arXiv:2509.20394）——涵蓋底層模型 + 安全防禦技術堆疊 + 實體部署情境的端到端全景文件，涵蓋安全防護能力、Prompt 注入抵禦、資料外洩偵測與人類核心價值觀對齊。

**Type:** Build
**Languages:** Python (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入描述 Mitchell 等人 2019 年原創的模型卡（Model Card）與 Gebru 等人 2018 年的資料集規格書（Datasheet）的核心結構。
- 掌握 Google Data Cards 的「遠望鏡／潛望鏡／顯微鏡」三級多維度分層揭露架構。
- 描述系統卡（System Card）的架構範疇，及其超越單一模型卡的端到端全鏈路覆蓋面。
- 說明 2024 至 2025 年文件領域的三項發展（LLM 自動化生成、硬體級可驗證認證、永續性報告）。

## The Problem｜問題

監管框架（第 24 課）與實驗室安全政策（第 18 課）都要求提供文件。文件格式從模型層面（模型卡），延伸至資料集層面（資料集規格書），再到系統層面（系統卡）。每種格式處理透明度的不同範疇。而 2024 至 2025 年的自動化與可驗證佐證相關工作，正著手處理長期存在的採納問題。

## The Concept｜核心概念

### 模型卡（Model Cards，Mitchell 等人，2019）

標準核心章節：
- 模型詳細資訊。
- 預期用途。
- 因素（評估時相關的人口統計或環境因素）。
- 指標。
- 評估資料。
- 訓練資料。
- 量化分析（依因素細分）。
- 倫理考量。
- 注意事項與建議。

歷史採納率困境：Oreamuno 等人（2023）對 Hugging Face 模型卡的審計發現，僅 0.3% 記錄了倫理考量。

### 資料集規格書（Datasheets for Datasets，Gebru 等人，2018）

借鑑傳統電子產品規格書（Datasheet）的類比。核心章節：
- 動機（為何建立該資料集）。
- 組成（資料集包含什麼）。
- 收集流程（如何組成資料集）。
- 標註（若適用）。
- 用途（預期用途、禁止用途、風險）。
- 發布。
- 維護。

於 2021 年發表於 CACM。資料集規格書是上游文件；模型卡依賴資料集規格書的準確性。

### 資料卡（Data Cards，Pushkarna 等人，Google 2022）

模組化的多層次變焦架構。針對不同背景的受眾提供三級縮放視圖：
- **遠望鏡級（Telescopic）**：提供非專家高層次摘要。
- **潛望鏡級（Periscopic）**：提供 ML practitioners 中階概覽。
- **顯微鏡級（Microscopic）**：為稽核人員提供特徵層級的詳細文件。

邊界物件（Boundary objects）的概念：不同讀者可從同一份文件取得不同資訊。

### 系統卡（System Cards）

涵蓋範疇：超越單一模型本身，覆蓋由「底層模型 + 安全防禦技術堆疊 + 實體業務部署情境」構成的端到端 AI 複雜系統。典型章節：
- 安全能力。
- Prompt 注入防護。
- 資料外洩偵測。
- 與明確陳述的人類價值觀對齊。
- 事件回應。

Sidhpurwala（2024）與 Meta 的系統級透明度工作；《Blueprints of Trust》（arXiv:2509.20394）將系統卡形式化為模型卡在部署層面的互補文件。

### 2024 至 2025 年關鍵突破

- **CardGen 自動化生成（Liu 等人，2024）**：透過 LLM 自動生成模型卡；研究報告指出，在 Mitchell 2019 的標準欄位上，其客觀性高於許多人工作卡。
- **商業下載量正相關（Liang 等人，2024）**：詳細的模型卡與 Hugging Face 上最高 29% 的下載率提升相關——除了法規遵循之外，市場也帶來了採納壓力。
- **Laminator 硬體級可驗證認證（Duddu 等人，2024）**：利用機密運算硬體安全飛地（TEE）與密碼學數位簽名，使模型卡能附帶可驗證的宣稱佐證（proof-of-claim），而不只是宣稱。
- **綠色永續性指標（Jouneaux 等人，2025 年 7 月）**：新增碳、水與運算能源足跡相關項目；ISO 標準仍在發展中。
- **法規合規卡興起**：歐盟 AI 法案（第 24 課）GPAI 實踐準則的「透明度」專章，要求將模型卡作為合規文件。

### 該研究在第 18 階段中的宏觀座標

第 24 與 25 課討論主權法規與 CVE；第 26 課建立透明度文件規範；第 27 課處理訓練資料治理，位於資料集規格書的上游；第 28 課則介紹產出卡片所引用評估結果的外部研究生態系。

```figure
an-card-scopes
```

## Use It｜實際應用

`code/main.py` 實作了一套微型文件生成器：針對一套玩具部署，產出模型卡（Model Card）、資料集規格書（Datasheet）與系統卡（System Card）。各文件採用典型的章節結構，可用來比較三種文件的職責範圍與揭露深度。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-card-audit.md`。輸入一份現成的模型卡、資料集規格書或系統卡，該 Skill 將審查章節涵蓋情形、數值細分，以及是否具備可驗證認證。

## Exercises｜練習

1. 執行 `code/main.py`。檢視輸出的三份卡片。指出哪些章節只有佔位內容（Placeholders），並說明需要補充哪些證據才能加強這些章節。
2. 為模型卡擴充一項依兩個人口群體分組的量化分析（銜接第 20 課的偏見度量技術）。
3. 研讀 Oreamuno 等人（2023）關於倫理考量章節僅有 0.3% 填寫率的實證報告。提出一項模型卡規格的結構性改動，以提高倫理考量章節的採用率。
4. Laminator（Duddu 等人，2024）利用 TEE 提供可驗證認證。為模型卡設計一個承載評測結果密碼學簽章的欄位，並描述驗證者（verifier）的角色。
5. 為你團隊過去參與過的一個真實專案或一個假想系統，親手撰寫一份系統卡（System Card，注意非單純模型卡）。指出對第三方稽核人員最有價值的章節。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Model Card | 「Mitchell 的模型卡」 | Mitchell 等人於 2019 年提出的機器學習模型標準文件 |
| Datasheet | 「Gebru 的資料規格書」 | Gebru 等人於 2018 年提出的資料集標準文件 |
| Data Card | 「Pushkarna 的資料卡」 | Google 於 2022 年提出的模組化分層資料文件 |
| System Card | 「部署文件」 | 涵蓋安全技術堆疊的端到端 AI 系統文件 |
| Boundary object | 「不同讀者共用的一份文件」 | Data Cards 的概念：同一份文件可供不同讀者使用 |
| Verifiable attestation | 「Laminator 的認證」 | 附加於文件宣稱的密碼學或 TEE 證明 |
| Sustainability field | 「碳排／水足跡」 | 正在發展中的 2025 年環境會計新增欄位 |

## Further Reading｜延伸閱讀

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — 模型卡經典奠基原著。
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — 資料集規格書權威論文。
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) — 階梯分層資料卡架構設計。
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — 系統卡形式化規格指南。
