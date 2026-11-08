# 綜合專案 11 —— LLM 可觀測性與評估儀表板

> Langfuse 走上了開源核心。Arize Phoenix 發表了 2026 年 GenAI 語意慣例的對映。Helicone 與 Braintrust 都加碼投入逐使用者的成本歸屬。Traceloop 的 OpenLLMetry 成了 SDK 檢測的事實標準。生產上的形狀是：軌跡放 ClickHouse、中繼資料放 Postgres、UI 用 Next.js，再加上一小群跑在抽樣軌跡上的評估工作（DeepEval、RAGAS、LLM 裁判）。自架一套出來、從至少四個 SDK 家族攝取，並示範在五分鐘內抓到一次注入的退化。

**類型：** 總結專案
**程式語言：** TypeScript (UI), Python / TypeScript (ingest + evals), SQL (ClickHouse)
**先修單元：** 階段 11（LLM 工程）、階段 13（工具）、階段 17（基礎設施）、階段 18（安全）
**演練到的階段：** P11 · P13 · P17 · P18
**時間：** 25 小時

## 問題

2026 年每一支跑生產流量的 AI 團隊，都在模型旁邊擺著一個可觀測性平面。成本歸屬。幻覺偵測。漂移監控。越獄訊號。SLO 儀表板。PII 外洩警報。那些開源參考 —— Langfuse、Phoenix、OpenLLMetry —— 都收斂到以 OpenTelemetry 的 GenAI 語意慣例作為攝取結構。你現在可以用一套 SDK 檢測 OpenAI、Anthropic、Google、LangChain、LlamaIndex 與 vLLM，並送出相容的 span。

你會建一個自架的儀表板，從至少四個 SDK 家族攝取、在抽樣軌跡上跑一小組評估工作、偵測漂移，並發警報。量測標準是：給定一次刻意注入的退化（某段提示詞開始產出 PII），儀表板要在五分鐘內抓到它並觸發警報。

## 概念

攝取走 OTLP HTTP。SDK 產出 GenAI 語意慣例的 span：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 落進 ClickHouse 做欄式分析；中繼資料（使用者、工作階段、應用）落進 Postgres。

評估以批次工作的形式跑在抽樣軌跡上。DeepEval 替忠實度、毒性與答案相關性評分。當軌跡帶有檢索脈絡時，RAGAS 替檢索指標評分。自訂的 LLM 裁判跑領域專屬的檢查（PII 外洩、違反政策的回應）。評估的執行結果寫回同一個 ClickHouse，成為連到父軌跡的評估 span。

漂移偵測監看嵌入空間分布隨時間的變化（對提示詞嵌入算 PSI 或 KL 散度），加上評估分數的趨勢。警報餵給 Prometheus Alertmanager，再進到 Slack / PagerDuty。UI 是 Next.js 15 配 Recharts。

## 架構

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

- 攝取：OpenTelemetry SDK + GenAI 語意慣例；OTLP HTTP 傳輸
- 收集器：帶尾端抽樣處理器的 OpenTelemetry Collector（用於成本控制）
- 儲存：span 用 ClickHouse、中繼資料用 Postgres、原始事件封存用 S3
- 評估：DeepEval、RAGAS 0.2、Arize Phoenix 評估器套件、自訂 LLM 裁判
- 漂移：每週對池化後的提示詞嵌入（sentence-transformers）算 PSI / KL
- 警報：Prometheus Alertmanager -> Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + server actions
- 開箱支援的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

```figure
ce-otel-drift
```

## 動手實作

1. **收集器設定。** OpenTelemetry Collector，配上 OTLP HTTP 接收器、一個保留 100% 出錯軌跡與 10% 成功軌跡的尾端抽樣器，以及送往 ClickHouse 與 S3 的匯出器。

2. **ClickHouse 結構。** 一張 `spans` 表，欄位對映 GenAI 語意慣例：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，外加一個裝長酬載的 JSON 袋。依 user_id 與 app_id 加上次級索引。

3. **SDK 涵蓋測試。** 用每一套 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）配 OpenLLMetry 自動檢測，寫一個小型客戶端應用。驗證每一套都產出落進 ClickHouse 的標準 GenAI span。

4. **評估工作。** 一個排程工作讀取最近 15 分鐘的抽樣軌跡，跑 DeepEval 的忠實度、毒性與答案相關性。輸出是連到父軌跡的評估 span。

5. **自訂 LLM 裁判。** 一個 PII 外洩裁判：給定一份回應，呼叫一個守衛 LLM 替 PII 外洩的可能性評分。高分回應進到檢傷佇列。

6. **漂移偵測。** 每週的工作計算本週池化提示詞嵌入與前四週基線之間的 PSI。若 PSI 高於門檻就發警報。

7. **儀表板。** Next.js 15，含這些頁面：總覽（每秒 span 數、每使用者成本、p95 延遲）、軌跡（搜尋 + 瀑布圖）、評估（忠實度趨勢、毒性）、漂移（PSI 隨時間變化）、警報。

8. **警報鏈。** Prometheus 匯出器讀取評估分數彙總與延遲百分位；Alertmanager 把警告路由到 Slack、把嚴重違規路由到 PagerDuty。

9. **退化探測。** 注入一個臭蟲：被評估的聊天機器人開始有 1% 的機率洩漏假的社會安全號碼。量測 MTTR：從臭蟲部署到 Slack 警報。

## 框架應用

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## 產出交付

`outputs/skill-llm-observability.md` 就是那份交付物。給定一個 LLM 應用，這個儀表板會攝取它的軌跡、跑評估、對漂移發警報，並在 Next.js 裡呈現每使用者的成本拆解。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 軌跡結構涵蓋率 | 產出標準 GenAI span 的 SDK 家族數（目標：6 個以上） |
| 20 | 評估正確性 | DeepEval / RAGAS 分數對照人工標註集 |
| 20 | 儀表板使用體驗 | 對注入退化的 MTTR（目標為 5 分鐘以內） |
| 20 | 成本／規模 | 在每秒 1k span 下持續攝取而不積壓 |
| 15 | 警報 + 漂移偵測 | Prometheus/Alertmanager 這條鏈端到端演練過 |
| **100** | | |

## 練習

1. 替 Haystack 框架加上自訂檢測。驗證標準 span 帶著忠實的 `gen_ai.*` 屬性落進 ClickHouse。

2. 在同一批軌跡上把 DeepEval 換成 Phoenix 的評估器。量測這兩套評估引擎之間的分數漂移。

3. 把漂移偵測器磨利：逐 app-id 計算 PSI，而不是全域計算。呈現逐應用的漂移軌跡。

4. 加上一個「使用者影響」頁面：帶迷你走勢圖的每使用者成本與每使用者失敗率。

5. 建一套尾端抽樣政策，保留 100% 毒性 > 0.5 的軌跡，加上其餘的 10% 分層抽樣。量測引入的抽樣偏差。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| GenAI 語意慣例 | 「OTel 的 LLM 屬性」 | 2025 年 OpenTelemetry 替 LLM span 屬性（系統、模型、詞元）訂的規格 |
| 尾端抽樣 | 「軌跡結束後才抽樣」 | 收集器在軌跡完成之後才決定保留或丟棄（可以先看錯誤） |
| PSI | 「族群穩定度指數」 | 比較兩個分布的漂移指標；> 0.2 通常代表有意義的漂移 |
| LLM 裁判 | 「用模型做評估」 | 一個 LLM 依評分準則替另一個 LLM 的輸出評分（忠實度、毒性、PII） |
| 尾端抽樣政策 | 「保留規則」 | 決定哪些軌跡要持久化、哪些要丟棄的規則；出錯的 + 抽樣率 |
| 評估 span | 「連結的評估軌跡」 | 承載評估分數、連到原始 LLM 呼叫 span 的子 span |
| 每使用者成本 | 「單位經濟」 | 一段時間內歸屬到某個 user_id 的美元成本；關鍵的產品指標 |

## 延伸閱讀

- [Langfuse](https://github.com/langfuse/langfuse) —— 參考用的開源核心可觀測性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) —— 另一份參考，漂移支援很強
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) —— 自動檢測的 SDK 家族
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 那套攝取結構
- [Helicone](https://www.helicone.ai) —— 另一套託管式可觀測性
- [Braintrust](https://www.braintrust.dev) —— 另一套以評估為先的平台
- [ClickHouse documentation](https://clickhouse.com/docs) —— 欄式的 span 儲存
- [DeepEval](https://github.com/confident-ai/deepeval) —— 評估器函式庫
