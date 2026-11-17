# 推論平台經濟學——Fireworks、Together、Baseten、Modal、Replicate、Anyscale（Inference Platform Economics — Fireworks, Together, Baseten, Modal, Replicate, Anyscale）

> 2026 年的 AI 推論市場早已不再是純粹的 GPU 機時租賃。市場全面分化為三大陣營：專屬客製化晶片（Groq、Cerebras、SambaNova）、GPU 算力平台（Baseten、Together、Fireworks、Modal）以及 API 優先型市集（Replicate、DeepInfra）。Fireworks 於 2026 年 5 月 1 日起將每 GPU 租金上調 1 美元/小時，且日均處理超過 10 兆 Token、估值達到 40 億美元，顯示以用量為核心的模式可行。Baseten 則於 2026 年 1 月以 50 億美元估值完成 3 億美元 E 輪融資。競爭定位的法則極其純粹：Fireworks 專攻極致延遲最佳化，Together 專攻模型型錄廣度，Baseten 專攻企業級交付成熟度，Modal 專攻 Python 原生開發體驗，Replicate 專攻多模態覆蓋，而 Anyscale 專攻分散式 Python 運算。本課為你提供一份足以直接交給創辦人的立體選型決策矩陣。

**Type:** Learn
**Languages:** Python (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出三大市場區塊（專屬客製晶片、GPU 平台、API 優先型市集），並將各家廠商精準歸類。
- 深刻解釋為何「按 Token 計費（Per-token）」的 API 定價模型會朝推論服務引擎的成本曲線壓縮，而非朝硬體成本曲線壓縮。
- 計算跨至少三家廠商的單次請求實質成本，並指出何時按分鐘計費（Baseten、Modal）勝過按 Token 計費。
- 依據給定的具體負載特徵（無伺服器突發流量、平穩高吞吐量、fine-tuning 客製化變體、多模態），精準挑選預設最適平台。

## The Problem｜問題

你評估過各大超大規模雲端平台後，得出結論：你需要更聚焦、推論延遲更低的專業服務商——追求極致延遲選 Fireworks、追求全模型覆蓋選 Together、部署經過 fine-tuning 的客製模型選 Baseten。然而當你面對六家真實廠商的定價頁面時，卻發現維度完全無法對齊：各家定價頁採用的計價單位分別為：Fireworks shows $/M tokens; Baseten shows $/minute; Modal shows $/second; Replicate shows $/prediction。在不對真實負載建立數學模型的前提下，你根本無法將它們放在同一個基準上橫向對比。

更棘手的是，每份定價頁面背後的商業邏輯截然不同。Fireworks 在共享 GPU 上運作自研的 FireAttention 專屬推論引擎，其每 Token 費率直接反映了其算力利用率曲線；Baseten 提供 Truss 打包框架與獨佔專屬 GPU，其按分鐘計費反映的是資源專有權；Modal 則是徹底的 Python 無伺服器（Serverless）架構——提供按秒計費與亞秒級的冷啟動體驗。產出完全相同的文字（一段 LLM 回應），背後卻對應三種本質迥異的成本函數。

本課將為這六大廠商建立精確的財務模型，並指出各自在何種戰場上所向披靡。

## The Concept｜核心概念

### 三大市場區塊（The three segments）

**專屬客製化晶片（Custom silicon）**——Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。在相同模型下，解碼速度通常比基於常規 GPU 的叢集快 5 至 10 倍。雖然每 Token 單價相對較高（2025 年底 Groq 在 Llama-70B 上的報價為 ~$0.99/M），但在延遲極度敏感的場景下具備無可爭議的統治地位。Groq 是目前語音 Agent 與即時語意翻譯領域的正式環境首選。

**GPU 算力平台（GPU platforms）**——Baseten、Together、Fireworks、Modal、Anyscale。基於 NVIDIA（2026 年的 H100、H200、B200）或部分 AMD GPU 運作。它們是介於「純裸金屬 GPU 租賃（RunPod、Lambda）」與「超大廠託管服務（Bedrock）」之間的黃金經濟層。

**API 優先型市集（API-first marketplaces）**——Replicate、DeepInfra、OpenRouter、Fal。擁有極致廣泛的模型型錄，支援按次預測或按秒計費，將開發者「從註冊到首次呼叫成功耗時」的最佳化推向極致。

### Fireworks——延遲最佳化型 GPU 平台（Fireworks — latency-optimized GPU platform）

- 核心搭載自研 FireAttention 引擎；官方宣稱在等效組態下延遲比 vLLM 低 4 倍。
- 針對非即時互動型背景任務，提供費率僅為無伺服器模式約 50% 的 Batch 批次層級。
- 託管 fine-tuning 模型的收費標準與基礎 Base 模型完全一致——相較於對掛載 LoRA 額外加收溢價的同行，這是極其厚道的關鍵差異化優勢。
- 2026 年中動態：自 2026 年 5 月 1 日起，隨需 GPU 租賃費率每小時上調 1 美元。大量採購可協商價格。
- 財務里程碑：估值突破 40 億美元，日均處理 Token 總量突破 10 兆大關。

### Together——廣度最佳化型（Together — breadth-optimized）

- 涵蓋 200 多款主流模型，開源社群最新成果發布數天內即可全面上線。
- 在同等 LLM 模型上，費率比 Replicate 便宜 50% 至 70%——其「AI 原生雲」的戰略定位核心在於以吞吐量規模與海量型錄制勝。
- 在單一統一 API 內部無縫整合推論、fine-tuning 與訓練。

### Baseten——企業級成熟度最佳化（Baseten — enterprise-polish-optimized）

- 推出 Truss 框架：在單一宣告式資訊清單內部完整封裝模型相依套件、機密憑證與 Serving 配置。
- 硬體覆蓋從 T4 直至 B200。按分鐘計費，並具備合理的冷啟動緩解機制。
- 全面通過 SOC 2 Type II 認證，已做好符合 HIPAA 要求的準備。是金融科技與醫療領域的熱門首選。
- 估值達 50 億美元，2026 年 1 月完成 3 億美元 E 輪融資（由 CapitalG、IVP 與 NVIDIA 聯合注資）。

### Modal——Python 原生體驗最佳化（Modal — Python-native-optimized）

- 以純 Python 實踐基礎架構即程式碼（IaC）。僅需透過 `@modal.function(gpu="A100")` 裝飾器修飾常規函式，即可透過單一指令部署。
- 精確到秒的微粒度計費。搭配預熱機制冷啟動耗時僅需 2 至 4 秒；輕量級模型甚至小於 1 秒。
- 2025 年以 11 億美元估值完成 8,700 萬美元 B 輪融資。在各類獨立開發者調查中，開發者體驗（DX）評分最高。

### Replicate——多模態廣度王者（Replicate — multimodal breadth）

- 採按次預測（Pay-per-prediction）計費。是影像、影片生成與音訊處理模型的常用平台。
- 擁有無比繁榮的第三方生態系擴充功能與整合（Zapier、Vercel、CMS 擴充套件）。
- 雖然在純文字 LLM 的每 Token 單價上缺乏競爭優勢，但在多模態模型種類上有優勢。

### Anyscale——Ray 原生分散式推論（Anyscale — Ray-native）

- 底層原生基於 Ray 運作；搭載專屬的 RayTurbo 推論引擎（在 Ray 叢集環境下與 vLLM 展開直接競爭）。
- 針對推論僅作為巨型運算有向無環圖（DAG）中某一個節點的複雜分散式 Python 運算負載展現出無可比擬的適配性。
- 提供全託管 Ray 叢集；與 Ray AIR 及 Ray Serve 深度原生咬合。

### 按 Token 計費 vs 按分鐘計費——各自何時勝出（Per-token versus per-minute — when each wins）

當業務負載對延遲不敏感、且呈現劇烈的波峰波谷突發性時，按 Token 計費是最理性的選擇——完全為實際消耗付費，零閒置浪費。而當系統流量飽和、負載高度平穩可預測時，按分鐘計費則展現出壓倒性優勢——一旦你能把專屬 GPU 餵飽，單位 Token 成本將大幅低於按量計價。

工程經驗粗估法則：當單張專屬 GPU 的持續利用率突破約 **30%** 時，按分鐘計費（Baseten、Modal）的總體支出便開始低於按 Token 計費（Fireworks、Together）。反之，若持續利用率低於 30%，按 Token 計費大獲全勝，因為你成功規避了昂貴的 GPU 閒置成本。

### 自研專屬推論引擎是真正的護城河（Custom engine is the real moat）

市面上凡是建構在 vLLM 與 SGLang 之上的平台，皆一致宣稱旗下具備強大的自研推論引擎：FireAttention、RayTurbo、Baseten 的私有推論堆疊。自研引擎的宣傳往往帶有些許市場包裝色彩——客觀冷靜的產業現狀是：vLLM 與 SGLang 構成了當前開源正式環境推論約 80% 的堅實基石，而各商業平台層之間真正的勝負分水嶺，更多取決於開發者體驗、帳單歸因粒度與企業級 SLA 承諾。

### 務必銘記的核心數字指標（Numbers you should remember）

- Fireworks 隨需 GPU 租賃費率：自 2026 年 5 月 1 日起每小時上調 1 美元。
- Fireworks 官方宣稱指標：在等效組態下延遲比 vLLM 降低 4 倍。
- Together 價格優勢：在 LLM 模型上比 Replicate 便宜 50% 至 70%。
- Baseten 估值：50 億美元（2026 年 1 月 E 輪融資 3 億美元）。
- Modal 估值：11 億美元（2025 年 B 輪融資）。
- 當專屬 GPU 持續利用率高於約 30% 時，按分鐘計費開始擊敗按 Token 計費。

```figure
cost-per-token
```

## Use It｜實際應用

`code/main.py` 在跨越各類計費模式的模擬業務負載下，對這六家廠商展開全方位財務演算。輸出 $/day and effective $/M tokens。執行該腳本，精準定位你自身業務在按 Token 與按分鐘計費之間的損益平衡交會點。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-inference-platform-picker.md`。輸入具體的業務負載特徵、SLA 延遲要求與月度預算上限，該 Skill 將自動為你推導出首選推論平台與備選供應商方案。

## Exercises｜練習

1. 執行 `code/main.py`。針對部署在單張 H100 上的 70B 模型，持續利用率必須達到多少時，Baseten（按分鐘計費）的總成本才會低於 Fireworks（按 Token 計費）？親手推導出該交會點並與 30% 經驗法則進行比對。
2. 你的產品功能同時整合了影像生成、文字對話與語音辨識（STT）。為這三種不同模態分別挑選最適託管平台，並指出能在前端將它們統一抽象整合的 Gateway 設計模式。
3. Fireworks 針對你所採用的主力模型將每小時單價上調 1 美元。若你將 40% 的流量切換至其 5 折優惠的 Batch 批次層級，精確建模推導出整體混合成本的淨變動幅度。
4. 某強監管企業客戶要求系統必須具備 SOC 2 Type II 認證、符合 HIPAA 規範，且必須使用專屬獨立 GPU。哪三家平台具備合格入場資格？其中哪一家在 FinOps 成本控制上最具優勢？
5. 針對 Llama 3.1 70B 模型，橫向比對 Fireworks 無伺服器、Together 隨需、Baseten 專屬與 Replicate API 處理每 1,000 次預測的單價。當每日呼叫量僅有 10 次時，哪家最便宜？當每日呼叫量暴增至 10,000 次時，局面會如何逆轉？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Custom silicon | 「非 GPU 晶片」 | Groq LPU、Cerebras WSE、SambaNova RDU；針對解碼最佳化 |
| FireAttention | 「Fireworks 引擎」 | 自訂注意力核心；宣稱延遲比 vLLM 低 4 倍 |
| Truss | 「Baseten 的格式」 | 模型封裝資訊清單，列出相依套件、密鑰與服務設定 |
| Per-token | 「API 計價」 | 依使用的 token 計費；不需支付閒置成本 |
| Per-minute | 「專屬資源計價」 | 依 GPU 實際運作時間計費；高利用率時較有利 |
| Per-prediction | 「Replicate 計價」 | 每次模型呼叫計費；常用於影像／影片模型 |
| RayTurbo | 「Anyscale 引擎」 | Ray 上的專有推論引擎；在 Ray 叢集上與 vLLM 競爭 |
| Batch tier | 「五折方案」 | 以較低費率處理非互動式佇列；Fireworks、OpenAI 等提供此方案 |
| Fine-tuned at base rate | 「Fireworks LoRA」 | 使用 LoRA 服務的請求依基礎模型費率計費（差異化之處） |

## Further Reading｜延伸閱讀

- [Fireworks Pricing](https://fireworks.ai/pricing) — 每 Token 費率、Batch 批次折扣與 GPU 租賃官方定價手冊。
- [Baseten Pricing](https://www.baseten.co/pricing/) — 按分鐘費率、承諾專屬容量與企業級階梯定價。
- [Modal Pricing](https://modal.com/pricing) — 按秒計費 GPU 矩陣與免費額度政策。
- [Together AI Pricing](https://www.together.ai/pricing) — 完整模型型錄與每 Token 費率對照表。
- [Anyscale Pricing](https://www.anyscale.com/pricing) — RayTurbo 推論引擎與全託管 Ray 服務計費標準。
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — 推論服務商的比較評估。
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) — 2026 年最新推論服務版圖演進報告。
