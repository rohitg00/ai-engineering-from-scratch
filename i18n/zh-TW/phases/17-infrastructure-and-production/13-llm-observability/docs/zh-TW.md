# LLM 可觀測性技術堆疊選型（LLM Observability Stack Selection）

> 2026 年的大模型可觀測性市場清晰分化為兩大陣營。研發一體化平台（LangSmith、Langfuse、Comet Opik）將指標監控與 Eval 評測、Prompt 版本管理以及工作階段重播深度捆綁。Gateway 與遙測工具（Helicone、SigNoz、OpenLLMetry、Phoenix）則專注於遙測資料。Langfuse 核心採 MIT 授權開源，在開源功能與雲端方案之間取得良好平衡（雲端版每月免費 5 萬事件）。Phoenix 則在 Elastic License 2.0 下原生擁抱 OpenTelemetry——在 RAG 檢索管線視覺化與資料漂移排查上表現出色，但並非專為長久儲存的正式環境後端而設計。Arize AX 則透過零拷貝的 Iceberg/Parquet 資料湖整合，宣稱在大規模流量下成本比傳統單體可觀測性平台低 100 倍。LangSmith 在 LangChain/LangGraph 生態中領先，每使用者每月 39 美元，僅頂級企業版提供自行託管。Helicone 採反向代理架構，15 至 30 分鐘即可極速接入，每月提供 10 萬次免費請求，但在多步驟 Agent 複雜鏈路上深度略顯不足。常見的 production pattern：前端 Gateway（Helicone/Portkey）+ 評測平台（Phoenix/TruLens），兩者透過 OpenTelemetry 協定連接。

**Type:** Learn
**Languages:** Python (stdlib, toy trace-sampling simulator)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格區分研發一體化平台（捆綁評測 + Prompt 管理 + 工作階段重播）與純 Gateway/遙測工具（僅處理 Trace 追蹤 + 核心指標）的邊界。
- 梳理六大主流可觀測性工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）的授權方式、定價與最適用情境。
- 深刻理解以 OpenTelemetry 作為通用黏著劑的現代架構模式，無縫串聯前端 Gateway 與獨立評測平台。
- 指出 2026 年大規模下的核心成本分水嶺（Arize AX 的資料湖零拷貝 vs 傳統單體採集），並理解其標稱百倍成本差異的底層原理。

## The Problem｜問題

你剛剛交付了一項核心 LLM 功能。它運作正常。但你對背後的真實情況一無所知：Prompt 為何偶發報錯？工具呼叫是否陷入死循環？延遲為何退化？成本為何突然飆升？前綴快取命中率究竟是多少？你在 Google 上搜尋「LLM 可觀測性」，跳出了八種工具，每家都宣稱能解決完全相同的痛點，背後卻標著三種天壤之別的價格矩陣。

它們解決的根本不是同一個問題。LangSmith 專門解答「這一次 LangGraph 運作究竟為什麼崩潰？」Phoenix 專門回答「我的 RAG pipeline 是否正在漂移？」Helicone 專門揪出「後台究竟是哪一款 App 在瘋狂吞噬 Token？」而 Langfuse 則解答「我們能否自行託管整套系統？」工具不同，面對的目標受眾亦截然不同。

理性選型必須立足於四大維度：技術堆疊（依賴 LangChain？純原生 SDK？跨多供應商？）、開源授權容忍度（僅接受 MIT？接受 Elastic？純商業版無所謂？）、財務預算（免費版？每月 100 美元？每月 1000 美元？），以及自行託管需求（絕對剛需？加分項？絕不考慮？）。

## The Concept｜核心概念

### 兩大主流類別（Two categories）

**研發一體化平台（Development platforms）**：將即時可觀測性與離線 Eval 評測、Prompt 版本納管、資料集版本控制以及工作階段重播深度融合。可執行實驗以查看哪個 Prompt 有效，並以舊的優勝結果為基準，對新 Prompt 進行資料集回歸評估。代表：LangSmith、Langfuse、Comet Opik。

**Gateway 與遙測工具（Gateway/telemetry tools）**：極簡侵入推論呼叫鏈路——完整記錄 Prompt、回應內容、Token 數量、端到端延遲、呼叫模型與財務花費。代表：Helicone、SigNoz、OpenLLMetry、Phoenix。架構極度輕量，能透過標準 OpenTelemetry 與下游獨立評測工具無縫對接。

### Langfuse——開源生態的最佳平衡點（Langfuse — OSS balance）

- 核心程式碼採 Apache / MIT 開源授權；支援透過 Docker 極速自行託管。
- 雲端託管版提供每月 5 萬次免費事件額度；團隊版起跳價每月 29 美元。
- 完整涵蓋 Eval 評測、Prompt 納管、追蹤與資料集。
- 最佳甜蜜點：期望享有 LangSmith 級別的完整研發體驗，但強烈要求必須採用開源授權或自行託管。

### Phoenix (Arize)——遙測優先、OpenTelemetry 原生

- 採 Elastic License 2.0 授權；自行託管相當簡單。
- 擅長 RAG 與 drift 視覺化。原生提供將 Embedding 投影至降維散佈圖的開箱即用功能。
- 設計初衷並非作為永久存檔的正式環境監控後端——主要用於開發階段的可觀測性。
- 最佳甜蜜點：RAG 檢索管線調優、語意漂移排查；在正式環境中通常與前端獨立 Gateway 搭檔協同。

### Arize AX——超大規模下的成本破局者（Arize AX — the scale play）

- 純商業級企業產品。核心採用基於 Apache Iceberg 與 Parquet 的資料湖零拷貝架構。
- 官方宣稱在超大規模流量下，成本比傳統單體可觀測性方案（如 Datadog 體系）便宜約 100 倍。底層數學邏輯：追蹤資料以 Parquet 格式存放在你自己的 S3 上；Arize 可直接讀取。
- 最佳甜蜜點：日均 Trace 超過 1,000 萬次、內部已建置成熟資料湖，期望以極致成本享有大模型專屬儀表板的巨型企業。

### LangSmith——LangChain 與 LangGraph 生態王者（LangSmith — LangChain/LangGraph first）

- 商業閉源，每使用者每月 39 美元。僅頂級 Enterprise 企業客戶可自行託管。
- 針對 LangChain 與 LangGraph 技術堆疊提供一流的支援。但若你的底層架構並未採用這兩款框架，就較不具吸引力。
- 最佳甜蜜點：已全面深度綁定 LangChain 生態、且具備充足軟體採購預算的研發團隊。

### Helicone——基於代理的最小可行方案（Helicone — proxy-based minimum viable）

- 接入時只需將程式碼中的 `OPENAI_API_BASE` 指向 Helicone 代理端點，約 15–30 分鐘可完成設定。
- 核心程式碼採 MIT 授權；每月提供 10 萬次免費請求，付費版每月 20 美元起。
- 內建容錯移轉、快取、速率限制——兼具可觀測性與輕量 Gateway 雙重角色。
- 在多步驟複雜 Agent 追蹤圖譜的呈現深度上相對有限。
- 最佳甜蜜點：單體應用、需要以最快速度同時獲得 Gateway 與基礎可觀測性雙重能力的精悍團隊。

### Opik (Comet)——開源研發一體化平台（Opik (Comet) — OSS dev platform）

- 全面遵循 Apache 2.0 開源協議。
- 功能矩陣高度對標 Langfuse，並深度繼承了 Comet 在機器學習實驗追蹤領域的深厚底蘊。
- 最佳甜蜜點：本就依賴 Comet 進行傳統 ML 模型管理的團隊，期望在同一個單一面板中統一檢視 LLM 應用。

### SigNoz——以 OpenTelemetry 為核心的全端 APM（SigNoz — OpenTelemetry-first full APM）

- Apache 2.0 開源授權。在統一的視圖中同時處理微服務常規 APM 指標與 LLM 推論呼叫。
- 最佳甜蜜點：期望在同一套監控體系中打通端到端微服務鏈路與底層 LLM 呼叫的大型基礎架構團隊。

### 黏著劑：OpenTelemetry 與 GenAI 語意約定（The glue: OpenTelemetry + GenAI semantic conventions）

OpenTelemetry 聯盟於 2025 年底正式發布了官方 GenAI 語意約定標準（涵蓋 `gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens` 等標準屬性）。凡是能消費 OTel 標準格式的工具皆能無縫互通。當前在工業界全面成型的標準範式：

1. 每次 LLM 呼叫都輸出採用 GenAI 慣例的 OpenTelemetry Trace。
2. 日常使用時，將流量路由至 Gateway（Helicone / Portkey）。
3. 同步雙寫至離線評測平台（Phoenix / Langfuse）以進行回歸評估。
4. 將資料封存至 Iceberg 資料湖，供 Arize AX 或 DuckDB 長期分析。

### 致命陷阱：在錯誤的架構層次進行埋點（The trap: instrumenting at the wrong layer）

在特定的 agent 框架內部埋點（例如加入 LangSmith traces），會使你與該框架耦合。而在 HTTP/OpenAI-SDK 層埋點（透過 OpenLLMetry 或 Gateway），則較具可移植性。

### 採樣策略——你無法保留所有原始追蹤（Sampling — you can't keep everything）

當系統每日請求量超過 100 萬次時，全量保留 Trace 的成本會高於 LLM 呼叫成本。依規則進行採樣：保留 100% 的錯誤和高成本請求、保留 5% 的成功請求。彙總資料一律保留；長尾部分則保留原始資料。

### 務必銘記的核心數字指標（Numbers you should remember）

- Langfuse 雲端版免費額度：每月 5 萬個事件。
- LangSmith 標價：每使用者每月 39 美元。
- Helicone 免費額度：每月 10 萬次請求。
- Arize AX 標稱優勢：在超大規模流量下成本比傳統單體可觀測性方案便宜約 100 倍。
- OpenTelemetry GenAI 慣例：2025 年推出，2026 年廣泛採用。

```figure
i4-otel-glue
```

## Use It｜實際應用

`code/main.py` 在日均 100 萬次 Trace 追蹤的模擬業務下，橫向演練了三種資料保留策略（100% 全量寫入、採樣、採樣並保留錯誤）。終端機即時輸出各策略下的儲存成本，以及各策略會遺失的資訊。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-observability-stack.md`。給定技術堆疊、規模、預算與授權策略後，挑選合適的工具。

## Exercises｜練習

1. 採用 LangChain 的團隊希望使用開源且可自行託管的可觀測性方案。在 Langfuse 與 Opik 之間做出抉擇並給出充分論證。
2. 某系統每天產生 500 萬筆 trace，Datadog 報價為每月 15 萬美元。計算 Arize AX 的損益平衡點。
3. 為你的組織設計一組 OpenTelemetry GenAI 屬性，作為 guideline，規定每次 LLM 呼叫都應包含。
4. 討論 Phoenix 單獨用於正式環境是否足夠；在什麼情況下會不足？
5. Helicone 的代理額外開銷約 20 ms。若你服務的 P99 TTFT 預算為 300 ms，該開銷是否在可接受範圍內？若 SLA 門檻嚴格收緊至 100 ms 呢？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| OpenLLMetry | 「LLM 的 OTel」 | 開源的 LLM OpenTelemetry 插樁工具 |
| GenAI conventions | 「OTel 屬性」 | LLM 呼叫使用的標準 OTel 屬性名稱 |
| LangSmith | 「LangChain 可觀測性」 | 與 LangChain 生態系整合的商業平台 |
| Langfuse | 「開源版 LangSmith」 | 具備類似功能的 MIT 授權開源平台 |
| Phoenix | 「Arize 開發工具」 | 以 OpenTelemetry 為基礎的開發／評估平台 |
| Arize AX | 「大規模可觀測性」 | 採用 Iceberg／Parquet 零拷貝方式的商業可觀測性平台 |
| Helicone | 「代理伺服器可觀測性」 | 透過 HTTP 代理伺服器收集 LLM 遙測資料，並提供 gateway 功能 |
| Opik | 「Comet 的 LLM 工具」 | Comet 推出的 Apache 2.0 開源開發平台 |
| Session replay | 「工作階段重播」 | 重播包含工具呼叫的完整 agent 工作階段 |
| Eval | 「離線測試」 | 在有標籤的資料集上執行候選模型或 prompt |

## Further Reading｜延伸閱讀

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/) — 頂級大模型可觀測性工具橫向橫評。
- [Langfuse — Arize AX Alternative analysis](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Setting Up Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/) — 四大主流工具端到端配置實戰。
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 官方語意約定規格說明書。
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — Phoenix 官方架構指南。
- [Helicone docs](https://docs.helicone.ai/)
