# 專案實戰 11——LLM 可觀測性與評估儀表板（Capstone 11 — LLM Observability & Eval Dashboard）

> Langfuse 轉向開放核心（Open-Core）模式。Arize Phoenix 發布了 2026 年 GenAI 語意約定映射規範。Helicone 與 Braintrust 皆深度押注基於單用戶維度的精確成本分攤。Traceloop 開發的 OpenLLMetry 則成為事實上的跨 SDK 自動埋點標準。2026 年常見的正式環境架構包括：使用 ClickHouse 儲存 Span 追蹤、使用 Postgres 儲存應用與用戶中繼資料、使用 Next.js 建構現代化前端儀表板，並調度一組專屬的後台自動化評估工作行程（DeepEval、RAGAS、LLM-as-a-Judge）在抽樣的 Trace 上持續打分。本專案實戰要求你私有化自建整套系統、自至少四類主流 SDK 中攝取相容資料，並實測在 5 分鐘內精準揪出人為注入的線上退化異常。

**Type:** Capstone
**Languages:** TypeScript (UI), Python / TypeScript (ingest + evals), SQL (ClickHouse)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P17 · P18
**Time:** 25 hours

## Problem｜問題

到了 2026 年，每一支維運真實線上流量的 AI 工程團隊，皆會在模型推論旁路並列部署一套完整的可觀測性控制平面。成本精準分攤、幻覺即時偵測、分佈漂移預警、越獄攻擊探針、SLO 履約監控、PII 敏感資料外洩告警。以 Langfuse、Phoenix 與 OpenLLMetry 為代表的開源生態，全面收斂至 OpenTelemetry GenAI 語意約定作為通用的資料攝取 Schema。工程師如今可以使用一套統一的 SDK 同時為 OpenAI、Anthropic、Google、LangChain、LlamaIndex 與 vLLM 進行埋點，並輸出完全相容的 Trace Span。

你將私有化自建一套可觀測性儀表板，能無縫攝取至少四種主流 SDK 家族的監控資料、在抽樣 Trace 上執行微型評測作業矩陣、敏銳捕捉語義資料漂移，並主動觸發告警。客觀驗收基準：在人為故意注入一個線上退化缺陷（例如某個 Prompt 突然在 1% 的機率下產生假個人識別資訊（PII））時，儀表板必須在 5 分鐘之內捕捉異常並成功向維運通道推播告警。

## Concept｜核心概念

資料攝取協定全面採用 OTLP HTTP。SDK 自動生成符合 GenAI 語意約定的標準 Span 欄位：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 串流批次寫入 ClickHouse 進行高效能列式儲存與 OLAP 分析；業務中繼資料（用戶 ID、工作階段 Session、應用 App）則持久化至 Postgres。

自動評估工作以批次任務形式在抽樣 Trace 上持續運作。DeepEval 自動為回答的忠實度、毒性與相關性評分。當 Trace 攜帶檢索上下文時，RAGAS 自動度量檢索指標。自定義的 LLM 裁判則針對垂直業務規則展開合規排查（如 PII 外洩、不符合政策的回應）。所有評測結果皆作為子 Span 關聯回原始的父級 Trace，並寫回同一個 ClickHouse 叢集。

資料漂移檢測機制持續監控 Prompt embedding在特徵空間中的分佈演變（透過對 Prompt 語義向量計算總體穩定性指標 PSI 或 KL 散度）以及綜合評測得分的走勢趨勢。告警訊號流入 Prometheus Alertmanager，並進一步路由至 Slack 或 PagerDuty。前端採用 Next.js 15 搭配 Recharts 進行高效渲染。

## 系統架構

```
production apps:
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK with GenAI semconv
       |
       v  OTLP HTTP
  collector (ingest, sample, fan-out)
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 archive
   (spans)       (metadata)  (raw events)
       |
       +---> eval jobs (DeepEval, RAGAS, LLM-judge)
       |     sampled or all-trace
       |     write eval spans back
       |
       +---> drift detector (PSI / KL on prompt embeddings)
       |
       +---> Prometheus metrics -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 dashboard (Recharts)
```

## 技術堆疊

- 資料攝取：OpenTelemetry SDK 搭配 GenAI 語意約定；傳輸採用 OTLP HTTP
- 收集器：OpenTelemetry Collector，配置尾部抽樣（Tail-Sampling）處理器（用於控制儲存成本）
- 儲存引擎：ClickHouse 儲存全量 Span，Postgres 儲存業務中繼資料，S3 用於原始事件長期封存
- 自動評測：DeepEval、RAGAS 0.2、Arize Phoenix 評估模組包、私有自定義 LLM 裁判
- 漂移偵測：每週針對匯集的 Prompt 語義向量（使用 sentence-transformers）計算 PSI 或 KL 散度
- 告警路由：Prometheus Alertmanager -> Slack / PagerDuty
- 前端架構：Next.js 15（App Router）+ Recharts 圖表庫 + Server Actions
- 原生開箱即用支援的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

```figure
ce-otel-drift
```

## Build It｜動手實作

1. **OTel 收集器配置**。部署 OpenTelemetry Collector，啟用 OTLP HTTP 接收器，配置尾部抽樣器：對所有包含 Error 報錯的 Trace 實施 100% 全量保留，對成功請求保留 10% 抽樣。配置匯出器（Exporter）同步導流至 ClickHouse 與 S3。

2. **ClickHouse 高效能 Schema**。設計 `spans` 列式資料表，欄位嚴格映射 GenAI 語意約定：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，並提供儲存非結構化長文字的 JSON 欄位。按 user_id 與 app_id 建立二級索引。

3. **跨 SDK 覆蓋度驗證測試**。針對 6 類主流 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）分別撰寫微型測試應用，掛載 OpenLLMetry 自動埋點。確認每個 SDK 皆能穩定產出標準的 GenAI 語意 Span 並成功入庫 ClickHouse。

4. **後台評測定時任務**。編寫排程工作行程，定時抓取最近 15 分鐘內的抽樣 Trace，呼叫 DeepEval 度量忠實度、毒性與答案相關性。將評估結論封裝為帶有關聯關係的 Eval 子 Span 寫回 ClickHouse。

5. **私有 LLM 隱私裁判**。實作 PII 外洩裁判邏輯：針對模型產出的回答，呼叫防護 LLM 判定存在 PII 隱私洩漏的機率。一旦判定為高風險，立即將該筆記錄拋入待分流佇列。

6. **Prompt 分佈漂移監控**。編寫每週排程任務：提取本週全量 Prompt 的語義向量，計算其與過去 4 週基準分佈之間的總體穩定性指標（PSI）。當 PSI 突破安全閾值時，即刻觸發漂移警報。

7. **全功能可觀測儀表板**。使用 Next.js 15 開發全功能頁面：全局概覽（每秒 Span 吞吐、每用戶平均花費、p95 延遲走勢）、鏈路詳情（即時檢索 + 瀑布圖 Waterfall 展開）、評測面板（忠實度走勢、毒性分佈）、漂移分析（PSI 歷史曲線）、告警歷史。

8. **告警聯動鏈路**。使用 Prometheus Exporter 定時聚合評測得分與延遲分位數；透過 Alertmanager 將一般 Warning 警告推播至 Slack，將重大違規事件升級至 PagerDuty。

9. **線上回退注入實測**。手動注入故障：讓受測的聊天機器人在 1% 的隨機機率下吐出虛構的假美國社會安全碼（SSN）。度量平均修復時間（MTTR）：從故障程式碼上線到 Slack 收到報警通知的端到端秒數。

## Use It｜實際應用

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-llm-observability.md`。給定任何一個基於 LLM 的應用，該儀表板能自動無縫攝取其全鏈路 Trace、自動執行評測打分、對資料分佈漂移進行告警，並在 Next.js 前端精準呈現每用戶單位的成本拆解。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 鏈路 Schema 規範覆蓋度 | 成功產出標準 GenAI 語意 Span 的主流 SDK 家族數量（目標：>= 6 種） |
| 20 | 自動化評測準確度 | DeepEval 與 RAGAS 給出的評分與人工專家標註測試集的對齊吻合度 |
| 20 | 故障偵測與告警時效性 | 在人為注入線上退化缺陷時，從上線到發出告警的端到端 MTTR 耗時（目標：嚴格低於 5 分鐘） |
| 20 | 吞吐效能與系統成本 | 在 1000 spans/sec 持續寫入壓力下，系統無積壓 |
| 15 | 告警與漂移監控完備度 | Prometheus / Alertmanager 完整閉環驗證，PSI 漂移分析穩定運作 |
| **100** | | |

## Exercises｜練習

1. 為新興的 Haystack 框架編寫自定義 OpenTelemetry 埋點擴充功能。驗證其生成的 Span 能攜帶標準的 `gen_ai.*` 屬性精準入庫 ClickHouse。
2. 在完全相同的 Trace 資料集上，同時調用 DeepEval 與 Arize Phoenix 評估器展開平行打分。度量兩套評測引擎在評分差異。
3. 深化資料漂移演算法：不再於全局粗暴聚合，改為按具體的 app_id 獨立計算各自的 PSI 指標。在前端儀表板繪製出各個獨立應用的分佈演變軌跡。
4. 在前端新增「單用戶商業價值影響」專屬看板：展示特定使用者的歷史花費曲線（Cost-per-user）與請求報錯率走勢。
5. 設計一套智慧尾部抽樣策略：對所有毒性評分大於 0.5 的 Trace 實施 100% 強制保留，對其餘請求實施 10% 的分層抽樣。客觀測量該抽樣機制給全局統計指標帶來的抽樣偏差。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| GenAI semconv |「OTel LLM 屬性」| 2025 年 OpenTelemetry 對 LLM span 屬性的規範（system、model、tokens） |
| Tail sampling |「追蹤完成後取樣」| trace 完成後，Collector 決定保留或丟棄；可檢查錯誤 |
| PSI |「母體穩定性指數」| 比較兩個分布的漂移指標；大於 0.2 通常表示有意義的漂移 |
| LLM-judge |「以模型評估」| LLM 依評分規準為另一個 LLM 的輸出評分（忠實度、毒性、PII） |
| Tail-sampling policy |「保留規則」| 決定要保存或丟棄哪些 trace 的規則；條件包括錯誤狀態與取樣率 |
| Eval span |「連結的評估追蹤」| 帶有評估分數、並連結至原始 LLM 呼叫 span 的子 span |
| Cost per user |「單位經濟效益」| 在指定時間範圍內歸屬於某個 user_id 的美元成本；是重要產品指標 |

## Further Reading｜延伸閱讀

- [Langfuse](https://github.com/langfuse/langfuse) — 業界標竿級開源核心可觀測性平台。
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 具備強大資料漂移分析功能的評測觀察平台。
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — 業界事實標準的自動埋點 SDK 系列。
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 官方標準 LLM 遙測資料格式約定。
- [Helicone](https://www.helicone.ai) — 商業級全託管可觀測性平台。
- [Braintrust](https://www.braintrust.dev) — 以自動評測為第一優先級的工程平台。
- [ClickHouse documentation](https://clickhouse.com/docs) — 高效能列式資料庫官方架構手冊。
- [DeepEval](https://github.com/confident-ai/deepeval) — 業界主流單元級評測開源庫。
