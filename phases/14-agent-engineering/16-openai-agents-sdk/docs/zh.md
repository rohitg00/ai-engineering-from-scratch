# OpenAI Agents SDK：Handoffs、Guardrails、Tracing

> OpenAI Agents SDK 是建構在 Responses API 之上的輕量多代理框架。五個原語：Agent、Handoff、Guardrail、Session、Tracing。Handoff 是名為 `transfer_to_<agent>` 的工具。Guardrail 會在輸入或輸出上被絆到。Tracing 預設開啟。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 06（工具使用）
**時間：** 約 75 分鐘

## 學習目標

- 說出 OpenAI Agents SDK 的五個原語。
- 解釋 handoff：為何把它模型化成工具、模型看到的名稱形狀是什麼，以及脈絡怎麼轉移。
- 分辨輸入護欄、輸出護欄與工具護欄；解釋 `run_in_parallel` 與阻塞模式的差別。
- 用 stdlib 實作一個帶 handoff + 護欄 + span 式追蹤的執行環境。

## 問題所在

不能乾淨委派的代理，最後會把所有東西都塞進同一段提示詞。沒有護欄的代理會外洩 PII、出貨違反政策的輸出，或永遠迴圈下去。OpenAI 的 SDK 把讓多代理變得可處理的那三個原語編纂了下來。

## 核心概念

### 五個原語

1. **Agent。** LLM + 指示 + 工具 + handoffs。
2. **Handoff。** 委派給另一個代理。對模型呈現為一項名為 `transfer_to_<agent_name>` 的工具。
3. **Guardrail。** 對輸入（僅第一個代理）、輸出（僅最後一個代理），或工具調用（逐 function tool）做的驗證。
4. **Session。** 跨輪次的自動對話歷史。
5. **Tracing。** 為 LLM 生成、工具呼叫、handoff、護欄內建的 span。

### Handoff 即工具

模型在自己的工具清單裡看到 `transfer_to_billing_agent`。呼叫它就是在告訴執行環境要：

1. 複製對話脈絡（或透過 `nest_handoff_history` beta 把它塌縮）。
2. 用目標代理的指示把它初始化。
3. 以目標代理繼續這一趟執行。

這就是 supervisor 模式（第 13 課／第 28 課）的產品化。

### 護欄

三種口味：

- **輸入護欄。** 跑在第一個代理的輸入上。在任何 LLM 呼叫之前，就拒絕不安全或超出範圍的請求。
- **輸出護欄。** 跑在最後一個代理的輸出上。攔下 PII 外洩、政策違規、畸形回應。
- **工具護欄。** 逐 function tool 執行。驗證參數、檢查權限、稽核執行。

模式：

- **平行**（預設）。護欄 LLM 跟主 LLM 並肩跑。尾端延遲較低。若被絆到，主 LLM 的工作就丟掉（浪費詞元）。
- **阻塞**（`run_in_parallel=False`）。護欄 LLM 先跑。若被絆到，主呼叫上一個詞元都不會浪費。

絆線會丟出 `InputGuardrailTripwireTriggered`／`OutputGuardrailTripwireTriggered`。

### Tracing

預設開啟。每次 LLM 生成、工具呼叫、handoff 與護欄都會發出一個 span。`OPENAI_AGENTS_DISABLE_TRACING=1` 可退出。`add_trace_processor(processor)` 會把 span 在 OpenAI 之外同時扇出到你自己的後端。

### Sessions

`Session` 把對話歷史存在某個後端（SQLite、Redis、自訂）。`Runner.run(agent, input, session=session)` 會自動載入並附加。

### 這套模式在哪裡會出錯

- **Handoff 漂移。** 代理 A 交接給代理 B，代理 B 又交接回代理 A。加一個跳數計數器。
- **護欄被繞過。** 工具護欄只在 function tool 上觸發；內建工具（檔案讀取器、網頁抓取）需要另外的政策。
- **過度追蹤。** span 裡出現敏感內容。要搭配 OTel GenAI 的內容捕捉規則（第 23 課）—— 存到外部去，用 ID 參照。

```figure
ae-agent-handoff
```

## 動手實作

`code/main.py` 用 stdlib 實作這個 SDK 的形狀：

- `Agent`、`FunctionTool`、`Handoff`（做成一個帶轉移語意的 function tool）。
- `Runner`，含輸入／輸出／工具護欄、handoff 分派與跳數計數器。
- 一個簡單的 span 發射器，用來呈現軌跡的形狀。
- 一個檢傷分類代理，依使用者查詢交接給帳務或客服；其中一則輸入會絆到護欄。

跑它：

```
python3 code/main.py
```

軌跡顯示兩次成功的 handoff、一次輸入護欄被絆到，以及一棵對映真實 SDK 所發出內容的 span 樹。

## 框架應用

- **OpenAI Agents SDK** 給以 OpenAI 為先的產品。
- **Claude Agent SDK**（第 17 課）給以 Claude 為先的產品。
- **LangGraph**（第 13 課）給你想要明寫狀態與持久續跑的時候。
- **自製** 給你需要精確掌控的時候（語音、多供應商、聯邦式部署）。

## 產出交付

`outputs/skill-agents-sdk-scaffold.md` 會搭出一個 Agents SDK 應用的鷹架，含檢傷分類代理、handoffs、輸入／輸出／工具護欄、session 儲存，以及一個 trace processor。

## 練習

1. 加一個 handoff 跳數計數器：超過 N 次轉移就拒絕。把行為追出來。
2. 把 `nest_handoff_history` 實作成一個選項 —— 在轉移之前，把先前的訊息塌縮成一段摘要。
3. 寫一個阻塞式的輸出護欄。比較「會絆到它的提示詞」與「通過的提示詞」兩者的延遲。
4. 把 `add_trace_processor` 接到一個 JSON logger。它每個 span 發出的形狀長怎樣？
5. 讀 SDK 文件。把你的 stdlib 玩具移植到 `openai-agents-python`。你哪裡模型化錯了？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Agent | 「LLM + 指示」 | SDK 裡的 Agent 型別；擁有工具與 handoffs |
| Handoff | 「轉移」 | 模型呼叫來委派給另一個代理的工具 |
| Guardrail | 「政策檢查」 | 對輸入／輸出／工具調用所做的驗證 |
| Tripwire | 「護欄被絆到」 | 護欄拒絕時丟出的例外 |
| Session | 「歷史儲存」 | 在多次執行之間持久化的對話記憶 |
| Tracing | 「Span」 | 覆蓋 LLM + 工具 + handoff + 護欄的內建可觀測性 |
| 阻塞式護欄 | 「循序檢查」 | 護欄先跑；被絆到時不浪費詞元 |
| 平行式護欄 | 「併發檢查」 | 護欄並肩跑；延遲較低，但被絆到時浪費詞元 |

## 延伸閱讀

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— 原語、handoffs、guardrails、tracing
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude 口味的對應物
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 到底何時才該伸手拿 handoff
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— Agents SDK 的 span 所對映的那套標準
