# OpenTelemetry GenAI 語意慣例

> OpenTelemetry 的 GenAI SIG（2024 年 4 月成立）替代理遙測定義了標準 schema。Span 名稱、屬性與內容捕捉規則跨廠商收斂，好讓代理的追蹤在 Datadog、Grafana、Jaeger 與 Honeycomb 裡意思都一樣。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 13（LangGraph）、階段 14 · 24（可觀測性平台）
**時間：** 約 60 分鐘

## 學習目標

- 說出 GenAI 的 span 類別：模型／客戶端、代理、工具。
- 分辨 `invoke_agent` 的 CLIENT 與 INTERNAL span，以及各自何時適用。
- 列出頂層的 GenAI 屬性：供應商名稱、請求模型、資料來源 ID。
- 解釋內容捕捉的契約：選擇加入、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部參照的建議做法。

## 問題所在

每家廠商都發明自己的 span 名稱。維運團隊最後只好逐框架做儀表板。OpenTelemetry 的 GenAI SIG 定義了一套整個生態系都對準的標準，修好這件事。

## 核心概念

### Span 類別

1. **模型／客戶端 span。** 涵蓋原始的 LLM 呼叫。由供應商 SDK（Anthropic、OpenAI、Bedrock）與框架的模型轉接器發出。
2. **代理 span。** `create_agent`（代理被建構時）與 `invoke_agent`（它執行時）。
3. **工具 span。** 每次工具調用一個；以父子關係連到代理的 span。

### 代理 span 的命名

- Span 名稱：有名字就用 `invoke_agent {gen_ai.agent.name}`；否則退回 `invoke_agent`。
- Span kind：
  - **CLIENT** —— 給遠端的代理服務（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** —— 給行程內的代理框架（LangChain、CrewAI、本地 ReAct）。

### 關鍵屬性

- `gen_ai.provider.name` —— `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` —— 那個模型 ID。
- `gen_ai.response.model` —— 解析後的模型（可能因路由而與請求不同）。
- `gen_ai.agent.name` —— 代理識別名。
- `gen_ai.operation.name` —— `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` —— 給 RAG 用：查了哪個語料或儲存。

Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 各有技術專屬的慣例。

### 內容捕捉

預設規則：儀器化「不應該」預設捕捉輸入／輸出。捕捉要透過這些選擇加入：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

建議的生產模式：把內容存到外部（S3、你的日誌儲存），在 span 上記錄參照（指標 ID，不是散文）。這就是第 27 課那套內容投毒防禦，接進可觀測性裡。

### 穩定性

截至 2026 年 3 月，多數慣例仍屬實驗性。用這個選擇加入穩定預覽：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 會把 GenAI 屬性原生對映進它的 LLM Observability schema。其他後端（Grafana、Honeycomb、Jaeger）支援原始屬性。

### 這套模式在哪裡會出錯

- **把完整提示詞捕捉進 span。** 讓 PII、密鑰、客戶資料出現在維運人員讀得到的追蹤裡。要存到外部。
- **沒有 `gen_ai.provider.name`。** 缺了歸屬，跨供應商的儀表板就壞了。
- **沒有父子連結的 span。** 孤兒工具 span。永遠要傳播脈絡。
- **沒設穩定性選擇加入。** 後端升級時你的屬性可能被改名。

```figure
ae-genai-span-tree
```

## 動手實作

`code/main.py` 用 stdlib 實作一個符合 GenAI 慣例的 span 發射器：

- `Span`，帶 GenAI 屬性 schema。
- `Tracer`，帶 `start_span` 與巢狀脈絡。
- 一趟腳本化的代理執行，會發出：`create_agent`、`invoke_agent`（INTERNAL）、逐工具的 span，以及 LLM 呼叫的 `chat` span。
- 一個內容捕捉模式，把提示詞存到外部，並在 span 上記下 ID。

跑它：

```
python3 code/main.py
```

輸出：一棵帶齊所有必要 GenAI 屬性的 span 樹，以及一個「外部儲存」，展示選擇加入後的內容參照。

## 框架應用

- **Datadog LLM Observability**（v1.37+）原生對映這些屬性。
- **Langfuse／Phoenix／Opik**（第 24 課）—— 自動替生態系做儀器化。
- **Jaeger／Honeycomb／Grafana Tempo** —— 原始 OTel 追蹤；用 GenAI 屬性做儀表板。
- **自架** —— 跑一個帶 GenAI processor 的 OTel Collector。

## 產出交付

`outputs/skill-otel-genai.md` 會把 OTel GenAI span 接進既有代理，帶內容捕捉預設值與外部參照儲存。

## 練習

1. 替你第 01 課的 ReAct 迴圈接上 `invoke_agent`（INTERNAL）加逐工具 span。送進一個 Jaeger 實例。
2. 用「只放參照」模式加上內容捕捉：提示詞存進 SQLite，span 屬性只帶列 ID。
3. 讀 `gen_ai.data_source.id` 的規格。把它接進你第 09 課的 Mem0 搜尋。
4. 設定 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，並驗證你的屬性不會被 collector 改名。
5. 做一個儀表板：只用 GenAI 屬性回答「哪些工具錯誤跟哪些模型相關」。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| GenAI SIG | 「OpenTelemetry 的 GenAI 小組」 | 定義這套 schema 的 OTel 工作組 |
| invoke_agent | 「代理 span」 | 代表一趟代理執行的那個 span 名稱 |
| CLIENT span | 「遠端呼叫」 | 呼叫遠端代理服務的 span |
| INTERNAL span | 「行程內」 | 行程內代理執行的 span |
| gen_ai.provider.name | 「供應商」 | anthropic／openai／aws.bedrock／google.vertex |
| gen_ai.data_source.id | 「RAG 來源」 | 某次檢索打中的是哪個語料／儲存 |
| 內容捕捉 | 「提示詞記錄」 | 選擇加入的訊息捕捉；生產環境要存到外部 |
| 穩定性選擇加入 | 「預覽模式」 | 用來釘住實驗性慣例的環境變數 |

## 延伸閱讀

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 那份規格
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 預設就發 GenAI span
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 內建 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) —— W3C 追蹤脈絡傳播
