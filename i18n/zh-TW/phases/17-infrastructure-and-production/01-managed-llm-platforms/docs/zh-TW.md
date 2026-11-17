# 託管式 LLM 平台——Bedrock、Vertex AI、Azure OpenAI（Managed LLM Platforms — Bedrock, Vertex AI, Azure OpenAI）

> 三大超大規模雲端供應商（Hyperscaler），三種涇渭分明的戰略路徑。AWS Bedrock 是一座模型市集——將 Claude、Llama、Titan、Stability 與 Cohere 統一整合於單一 API 後方。Azure OpenAI 是 OpenAI 的獨家深度合作夥伴，並提供用於專屬容量的預置吞吐量單元（PTU）。Vertex AI 則是 Gemini 優先，擁有最強悍的超長上下文與多模態敘事能力。2026 年 Artificial Analysis 實測指出，在等價的 Llama 3.1 405B 等級部署上，Azure OpenAI 的第一個 token 延遲中位數約為 50 ms，而 Bedrock 則約為 75 ms——PTU 的專屬容量有助解釋這項差距，因為專屬容量通常比共享隨需容量有較低的延遲。決策鐵律絕非「哪家最快」，而是「哪家的模型型錄與 FinOps 成本歸因面能精準貼合你的產品需求」。本課教你拋開主觀感覺，基於白紙黑字的工程權衡做出冷靜選型。

**Type:** Learn
**Languages:** Python (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出三大平台戰略（市集型 vs 獨家型 vs Gemini 優先型），並將各自精準映射至合適的產品應用場景。
- 深入解釋 Azure OpenAI 的預置吞吐量單元（Provisioned Throughput Units, PTU）究竟為你購買了什麼，以及為何隨需的 Bedrock 在 405B 規模下第一個 token 延遲通常慢約 25 ms。
- 繪製三大平台的 FinOps 成本歸因架構圖（Bedrock 的 Application Inference Profiles vs Vertex 的專案即團隊模式 vs Azure 的範圍作用域與 PTU 預留）。
- 撰寫「至少雙供應商（Two-provider minimum）」政策，並說明為何在 2026 年單一供應商鎖定是代價高昂的錯誤。

## The Problem｜問題

你為產品選定了 Claude 3.7 Sonnet。現在你需要對外提供服務。你可以直接呼叫 Anthropic 官方 API，也可以透過 AWS Bedrock 存取，或者在前端架構一層專屬 Gateway。直連官方 API 最為簡潔；Bedrock 則額外賦予了 BAA 商業夥伴協議、VPC 私有端點、IAM 權限控管與 CloudWatch 細粒度計費歸因。而 Gateway 則能在跨供應商之間提供自動容錯移轉、統一帳單以及全域速率限制（Rate limiting）。

更深層的核心課題在於模型型錄。若你的產品同時需要 Claude、Llama 與 Gemini，你根本無法從單一廠商處買齊全部能力——除非你同時擁抱 Bedrock、Vertex 與 Azure OpenAI。各大超大規模雲端廠商絕非彼此同質的替代品——它們在「究竟誰該擁有底層模型層」這項世紀賭注上，各自押下了截然不同的籌碼。

本課將全面剖析這三大核心戰略押注、背後的實測延遲落差、FinOps 歸因機制以及嚴峻的廠商鎖定風險。

## The Concept｜核心概念

### 三大核心戰略（Three strategies）

**AWS Bedrock**——開放市集模式。容納 Claude（Anthropic）、Llama（Meta）、Titan（AWS 第一方自研）、Stability（影像生成）、Cohere（向量 Embedding）、Mistral，另有影像與 Embedding 子型錄。提供單一統一 API、統一的 IAM 權限介面以及開箱即用的 CloudWatch 指標匯出。Bedrock 的戰略押注在於：企業客戶對「選擇的自由度與彈性」之渴望，遠勝於對單一特定模型的依賴。

**Azure OpenAI**——獨家深度結盟。你能在微軟的全球資料中心內部，享有 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper，以及 OpenAI 模型的 fine-tuning。在標準的「Azure OpenAI 服務」型錄中完全不包含非 OpenAI 模型——這些模型列於獨立產品 Azure AI Foundry。Azure 的戰略押注在於：OpenAI 始終代表著最尖端的前沿能力，而大型企業需要在此特定關係上獲得企業級控制。

**Vertex AI**——Gemini 絕對優先，其餘皆屬配角。以 Gemini 1.5 / 2.0 / 2.5 Flash 與 Pro 為核心支柱，輔以 Model Garden 第三方模型花園。Vertex 的戰略押注在於原生的多模態與百萬級 Token 超長上下文——1M Token 的 Gemini 上下文視窗是其差異化優勢。

### 規模化下的延遲落差（Latency gap at scale）

Artificial Analysis 持續執行基準測試。在等價的 Llama 3.1 405B 共享隨需部署下，Azure OpenAI 的第一個 token 延遲（Time-to-First-Token, TTFT）中位數約為 50 ms；而 Bedrock 則落在約 75 ms 附近。這項差距絕非 AWS 底層技術落後——而是源於容量售賣模式的根本差異。Azure 主打販售 PTU（預置吞吐量單元），直接為你的租戶獨家預留實體 GPU 算力；Bedrock 雖亦有名為 Provisioned Throughput 的類似機制，但每單元每小時起跳價高達 21 美元，絕大多數客戶預設皆採用共享隨需模式。

隨需共享容量意味著你必須與全球所有其他租戶的突發流量共同爭奪 GPU。而專屬容量則不會與其他客戶流量競爭。若你產品的服務等級協定（SLA）嚴格要求 P99 TTFT 必須小於 100 ms，你要麼在 Azure 上採購 PTU，要麼在 Bedrock 上購買預置吞吐量，要麼就必須默默承受隨需模式的高波動變異數。

### 預置吞吐量經濟學（Provisioned Throughput economics）

Azure PTU：一組鎖定預留的推論運算區塊。針對負載高度可預測的正式環境系統，相較於隨需呼叫最高能節省約 70% 的雲端開銷。其費用按小時固定扣收，無論期間是否有流量流入——即便完全閒置，你依然必須為預留買單。其損益平衡點（Break-even）通常落在 40% 至 60% 的持續負載率區間。

Bedrock Provisioned Throughput：依據模型規格與託管區域不同，每單元每小時約為 21 至 50 美元。計算邏輯類似——損益平衡點約落在峰值負載的一半左右。通常要求按月進行契約承諾。

Vertex 的預置容量則按特定 Gemini SKU 進行販售；定價因模型與區域而異，公開透明度相對較低。

### FinOps 歸因視圖——真正的分水嶺（FinOps surface — the real differentiator）

**Bedrock Application Inference Profiles** 是當前市場上設計最為優雅整潔的成本歸因機制。你可以為特定 Profile 打上 `team`、`product`、`feature` 等標籤；所有模型呼叫皆經由該 Profile 進行路由；CloudWatch 即可直接按 Profile 獨立切分帳單與成本，無需耗費精力撰寫後處理資料管線。這項機制自 2025 年上線以來，依然是各大超大廠中最精細的原生解決方案。

**Vertex** 的歸因機制採用「每個團隊獨立 GCP 專案 + 到處打標籤」哲學。你將每個研發團隊建模為獨立的 GCP 專案，為所有關聯資源打上 Label，並透過 BigQuery Billing Export 匯出帳單，搭配 DataStudio 進行多維度彙整。雖然前期建置較為繁瑣，但 BigQuery 能讓財務工程師透過任意 SQL 對成本明細資料展開無限深度的自由探勘。

**Azure** 則依賴訂閱帳戶（Subscription）與資源群組（Resource Group）的作用域層級搭配 Tag，並將 PTU 預留視為獨立的一等公民成本物件。由於 Tag 繼承自資源群組而非單次 HTTP 請求，若要做到請求級別的精細歸因，必須另外配置 Application Insights 自定義指標，或是在前端 Gateway 層為請求標註 Header。

歸納總結：Bedrock 的原生體驗最乾淨俐落，Vertex 透過 BigQuery 提供最強大的分析彈性，而 Azure 若不進行額外深度埋點則黑盒度最高。

### 供應商鎖定是 2026 年的最大風險（Lock-in is the 2026 risk）

在單一模型獨步天下的舊時代，將籌碼全押在單一超大廠上無可厚非。然而到了 2026 年，技術前沿每個月都在劇烈洗牌——某個季度是 Claude 3.7，下個季度是 Gemini 2.5，再下個季度是 GPT-5。若將系統死鎖在單一平台上，等同於主動將自己隔絕在三分之二的全球尖端智力之外。

成熟團隊採用的模式：任何產品關鍵 LLM 呼叫都至少採用**雙供應商（Two-provider minimum）**。Bedrock 搭配 Azure OpenAI 是常見組合——由前者供應 Claude、後者供應 GPT，並透過同一套 Gateway 在兩者間容錯移轉。由於 Gateway 會選擇最佳路由，成本增幅可忽略不計；服務中斷時（例如 Azure OpenAI 2025 年 1 月事件或 AWS us-east-1 中斷），可用性提升則具決定性。

### 資料落地、BAA 與強監管產業（Data residency, BAAs, and regulated industries）

Bedrock：在全球絕大多數主要區域皆支援簽署 BAA（商業夥伴協議）；提供全私有 VPC 端點與原生 Guardrails 防護欄。是金融科技領域極受歡迎的預設選擇。
Azure OpenAI：通過 HIPAA、SOC 2、ISO 27001 認證；提供嚴格的歐盟境內資料落地保護；是傳統大型跨國企業與高度監管行業的首選預設。
Vertex：符合 HIPAA、GDPR 標準，支援各區域資料本機落地；繼承 Google Cloud 完整的合規技術堆疊。

三大平台皆能滿足常規的企業合規勾選框。實質差異往往藏在細節中：資料保留週期政策、記錄留存與銷毀機制，以及底層的防濫用審查（Abuse monitoring）是否會讀取你的業務資料流量（多數預設開啟，但企業級方案皆提供申請 Opt-out 豁免的途徑）。

### 務必銘記的核心關鍵數字（Numbers you should remember）

- Azure OpenAI 在 Llama 3.1 405B 等價模型上的 TTFT 中位數：約 50 ms（在 PTU 專屬容量下）。
- Bedrock 在隨需模式下的 TTFT 中位數：約 75 ms。
- Bedrock 預置吞吐量單價：每單元每小時約 21 至 50 美元。
- Azure PTU 損益平衡點：持續負載率達到約 40% 至 60%。
- 在高負載飽和狀態下，PTU 相較於隨需模式的費用節省：最高可達 70%。

```figure
i4-platform-lanes
```

## Use It｜實際應用

`code/main.py` 在一套模擬負載上對三大平台展開全方位綜合模擬——建模隨需計費 vs PTU 預留的財務模型、TTFT 的波動變異數，以及成本歸因維度的顆粒度。執行該腳本，親眼見證 PTU 在何種流量閾值下開始展現壓倒性優勢，以及市集型的模型廣度何時能抵消微小的 TTFT 延遲落差。

## Ship It｜交付成果

本課交付標準資產 `outputs/skill-managed-platform-picker.md`。給定具體的業務負載特徵（所需模型型錄、TTFT SLA 指標、每日呼叫量級與合規限制），該 Skill 將自動產出首選平台、備援容錯平台，以及配套的 FinOps 成本監控與埋點工程藍圖。

## Exercises｜練習

1. 執行 `code/main.py`。針對 70B 參數等級的模型，持續利用率必須達到多少百分比時，Azure PTU 的經濟效益才會超越隨需模式？計算該損益平衡點並與業界標稱的 40-60% 區間進行對比。
2. 你的核心產品同時依賴 Claude 3.7 Sonnet 與 GPT-4o。設計一套跨雙供應商的正式環境部署藍圖——各模型分別掛載在哪家超大廠？前端放置什麼 Gateway 架構？容錯移轉（Failover）觸發規則為何？
3. 某高度受監管的醫療機構客戶要求必須簽署 BAA、資料嚴格保留在美東地區，且 P99 TTFT 必須穩定低於 100 ms。挑選出最適平台並列出三項具體關鍵功能以支撐你的決策。
4. 你發現團隊本月的 Bedrock 帳單暴增了 4 倍，然而整體業務流量並未增長。在缺乏 Application Inference Profiles 的前提下，你該如何排查真正的元兇？若早已導入 Profiles，排查耗時會有何不同？
5. 仔細閱讀 Azure OpenAI 與 Bedrock 的官方最新定價頁面。針對每月消耗 1 億 Token 的 Claude 業務負載，直接呼叫 Anthropic 官方 API、採用 Bedrock 隨需模式，以及購買 Bedrock 預置吞吐量，三者之中哪一種方案成本最為低廉？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Bedrock | 「AWS 的 LLM 服務」 | 涵蓋 Claude、Llama、Titan、Mistral 與 Cohere 的模型市集 |
| Azure OpenAI | 「Azure 的 ChatGPT」 | Azure 資料中心中的獨家 OpenAI 模型，並提供企業級控制項 |
| Vertex AI | 「Google 的 LLM」 | 以 Gemini 為優先的平台，並透過 Model Garden 提供第三方模型 |
| PTU | 「專屬容量」 | 預置吞吐量單元；按小時計價的預留推論 GPU |
| Application Inference Profile | 「Bedrock 標籤」 | 依產品建立成本／用量設定檔，原生整合 CloudWatch |
| Model Garden | 「Vertex 型錄」 | Vertex AI 中獨立於 Gemini 的第三方模型區段 |
| Two-provider minimum | 「LLM 備援」 | 要求每條關鍵 LLM 路徑跨至少兩家超大規模雲端供應商運作的政策 |
| BAA | 「HIPAA 法規文件」 | 商業夥伴協議；PHI 相關流程所需，三家皆提供 |
| Abuse monitoring | 「記錄監看」 | 供應商端對 prompt 與輸出內容執行的安全掃描；企業方案可選擇退出 |

## Further Reading｜延伸閱讀

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — 官方權威費率表與預置吞吐量定價手冊。
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) — PTU 經濟學與官方計費矩陣。
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini 各層級定價與 Model Garden 附加費說明。
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — 跨各大雲端推論供應商的不間斷延遲與吞吐量實測排行榜。
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — 專為技術決策者撰寫的企業級選型指南。
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — 三大超大廠 AI 支出歸因機制的橫向對比分析。
