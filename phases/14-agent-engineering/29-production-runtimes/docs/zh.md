# 生產執行環境：佇列、事件、Cron

> 生產代理跑在六種執行環境形狀上：請求—回應、串流、持久執行、佇列式背景、事件驅動，以及排程。先挑形狀，再挑框架。可觀測性在每種形狀裡都是承重結構。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 13（LangGraph）、階段 14 · 22（語音）
**時間：** 約 60 分鐘

## 學習目標

- 說出那六種生產執行環境形狀，並把每一種對到某個框架／產品模式。
- 解釋持久執行（LangGraph）為何對長時程任務要緊。
- 描述事件驅動的執行環境，以及 Claude Managed Agents 何時合用。
- 解釋「可觀測性對多步驟代理而言是承重結構」這個主張。

## 問題所在

生產代理失敗的方式，是 Jupyter notebook 呈現不出來的：第 37 步網路逾時、使用者在語音通話中途掛斷、cron 工作在機器重開時死掉、背景 worker 記憶體用盡。執行環境的形狀決定了哪些失敗是可存活的。

## 核心概念

### 請求—回應

- 同步 HTTP。使用者等到完成為止。
- 只有短任務（<30 秒）可行。
- 堆疊：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可觀測性：標準 HTTP 存取日誌 + OTel span。

### 串流

- 用 SSE 或 WebSocket 做漸進式輸出。
- LiveKit 把這件事延伸到 WebRTC，用於語音／視訊（第 22 課）。
- 堆疊：任何支援串流的框架 + 一個處理得了 SSE/WS 的前端。
- 可觀測性：逐塊時間、首個詞元延遲、尾端延遲。

### 持久執行

- 每一步之後都存檢查點；失敗時自動續跑。
- AutoGen v0.4 的演員模型把故障隔離在單一代理內（第 14 課）。
- LangGraph 的核心差異化（第 13 課）。
- 當步數未知、而復原成本又高時，這是必備的。

### 佇列式／背景

- 工作進佇列、worker 撿起來、結果透過 webhook 或發布訂閱流回去。
- 對長時程代理而言是必備的（依 Anthropic 的 computer use 公告，每項任務數十到數百步）。
- 堆疊：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自製。
- 可觀測性：佇列深度、逐工作的延遲分布、DLQ 大小。

### 事件驅動

- 代理訂閱觸發源：新郵件、PR 開啟、cron 觸發。
- Claude Managed Agents 開箱就涵蓋這個（第 17 課）。
- CrewAI Flows（第 15 課）替事件驅動的決定性工作流做結構。
- 可觀測性：觸發來源、事件到啟動的延遲、代理延遲。

### 排程

- Cron 形狀的代理，週期性地跑。
- 跟持久執行結合，好讓失敗的夜間執行在下一個 tick 續跑。
- 堆疊：Kubernetes CronJob + 一個持久框架；或託管（Render cron、Vercel cron）。

### 2026 年的部署模式

- **CrewAI Flows** 給事件驅動的生產環境。
- **Agno** 的無狀態 FastAPI 給 Python 微服務。
- **Mastra** 的伺服器轉接器（Express、Hono、Fastify、Koa）給嵌入式場景。
- **Pipecat Cloud／LiveKit Cloud** 給託管語音（第 22 課）。
- **Claude Managed Agents** 給託管的長時間非同步工作。

### 可觀測性是承重結構

沒有 OpenTelemetry GenAI span（第 23 課）加上 Langfuse／Phoenix／Opik 後端（第 24 課），你就沒辦法替一個在第 40 步失敗的多步驟代理除錯。這在生產環境不是選配。它就是「我們除錯很快」與「我們加更多日誌從頭重播一次」之間的差別。

### 生產執行環境在哪裡會失敗

- **挑錯形狀。** 替一個 5 分鐘的任務挑了請求—回應。使用者掛斷；worker 堆積；重試複利。
- **沒有 DLQ。** 佇列 worker 沒有死信。失敗的工作就這樣消失。
- **不透明的背景工作。** 背景代理跑起來卻沒有匯出追蹤。失敗在使用者回報之前都是看不見的。
- **跳過持久狀態。** 任何超過 30 秒、又付不起重來一次的執行，都需要持久執行。

```figure
wb-runtime-shapes
```

## 動手實作

`code/main.py` 是一個 stdlib 的多形狀示範：

- 請求—回應端點（普通函數）。
- 串流處理器（產生器）。
- 帶 DLQ 的佇列式 worker。
- 事件觸發註冊表。
- Cron 形狀的排程器。

跑它：

```bash
python3 code/main.py
```

輸出：五條軌跡，顯示每種形狀在同一項任務上的行為。代理邏輯相同，外殼不同。持久執行（第六種形狀）刻意留在第 13 課、用 LangGraph 的檢查點來講。

## 框架應用

- **請求—回應** 給聊天式的使用體驗。
- **串流** 給漸進式回應。
- **持久** 給長時程任務。
- **佇列** 給批次／非同步／長時間執行。
- **事件** 給代理的反應性。
- **Cron** 給家務事（記憶整併、評測、成本報表）。

## 產出交付

`outputs/skill-runtime-shape.md` 會替一項任務挑出執行環境形狀，並把可觀測性需求接起來。

## 練習

1. 把你第 01 課的 ReAct 迴圈在你的堆疊上移植到全部六種形狀。哪種形狀配哪個產品表面？
2. 替佇列式示範加上 DLQ。模擬 10% 的工作失敗；把 DLQ 大小呈現出來。
3. 寫一個由 cron 觸發的評測代理，每晚對當天最重要的 20 條軌跡跑一次。
4. 實作帶背壓的串流：若客戶端很慢，就把代理暫停。這跟輪次預算之間怎麼互動？
5. 讀 Claude Managed Agents 的文件。什麼時候你會把一個自架的長時程代理搬到託管？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 請求—回應 | 「同步」 | 使用者等待；只適合短任務 |
| 串流 | 「SSE／WS」 | 漸進式輸出；體驗較好；延遲可逐塊觀測 |
| 持久執行 | 「從失敗處續跑」 | 存了檢查點的狀態；從最後一步重啟 |
| 佇列式 | 「背景工作」 | 生產者／worker 池／DLQ |
| 事件驅動 | 「基於觸發」 | 代理對外部事件做出反應 |
| DLQ | 「死信佇列」 | 失敗工作的停車場 |
| Claude Managed Agents | 「託管的執行環境」 | 由 Anthropic 託管、帶快取與壓實的長時間非同步工作 |

## 延伸閱讀

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 持久執行的細節
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— 託管的長時間非同步工作
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) —— 「每項任務數十到數百步」
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 演員模型的故障隔離
