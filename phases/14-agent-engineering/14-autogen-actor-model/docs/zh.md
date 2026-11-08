# 給代理的演員模型 —— 非同步訊息與具型別執行環境

> 代理即演員：非同步訊息交換、事件驅動的處理器、故障隔離、天然的併發。AutoGen v0.4（Microsoft Research，2025 年 1 月）圍繞這個模型重新設計了代理編排；該框架現已進入維護模式，由 Microsoft Agent Framework（2025 年 10 月公開預覽）作為它的生產接班人。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 12（工作流模式）
**時間：** 約 75 分鐘

## 學習目標

- 描述演員模型：代理即演員、訊息是唯一的行程間通訊、故障逐演員隔離。
- 說出 AutoGen v0.4 的三層 API —— Core、AgentChat、Extensions —— 以及各自的用途。
- 解釋為何把訊息投遞與處理解耦，能帶來故障隔離與天然的併發。
- 用 Python stdlib 實作一個演員執行環境，並把一個雙代理的程式碼審查流程移植上去。

## 問題所在

多數代理框架是同步的：一個代理生產、一個代理消費，全在同一個呼叫堆疊裡。失敗會把堆疊弄崩。併發是後來硬栓上去的。要做分散式就得重寫。

AutoGen v0.4 的答案：演員模型。每個代理是一個帶私有收件匣的演員。訊息是唯一的互動方式。執行環境把投遞與處理解耦。故障被隔離在單一演員內。併發是原生的。分散式只是換一種傳輸。

## 核心概念

### 演員

一個演員擁有：

- 一份私有狀態（從外面絕不會被直接碰到）。
- 一個收件匣（訊息佇列）。
- 一個處理器：`receive(message) -> effects`，其中 effects 可以是「回覆」、「送給其他演員」、「生出新演員」、「更新狀態」、「停掉自己」。

兩個演員不能共享記憶體。它們只能互傳訊息。

### 三層 API

AutoGen v0.4 把它的表面切成三層：

1. **Core。** 低階的演員框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。非同步訊息交換、事件驅動。
2. **AgentChat。** 任務驅動的高階 API（取代 v0.2 的 ConversableAgent）。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions。** 各種整合 —— OpenAI、Anthropic、Azure、工具、記憶。

### 解耦為什麼要緊

在 v0.2 的模型裡，同步呼叫 `agent_a.chat(agent_b)` 會擋住 agent_a，直到 agent_b 回傳。在 v0.4 裡，`send(agent_b, msg)` 把訊息丟進 agent_b 的收件匣就回來了。執行環境稍後才投遞。三個後果：

- **故障隔離。** 代理 B 崩了不會把代理 A 弄崩 —— 執行環境會在 B 的處理器裡接住故障，並決定怎麼辦（記錄、重試、丟死信）。
- **天然的併發。** 同時有很多訊息在飛；演員併發地處理自己的收件匣。
- **可直接做分散式。** 不論演員在同一行程內還是在另一台主機上，收件匣 + 傳輸都是同一套抽象。

### 拓撲

- **RoundRobinGroupChat。** 代理照固定輪替順序發言。
- **SelectorGroupChat。** 一個選擇器代理依對話脈絡挑出下一個發言者。
- **Magentic-One。** 用於網頁瀏覽、程式碼執行、檔案處理的參考多代理團隊。建構在 AgentChat 之上。

### 可觀測性

內建 OpenTelemetry 支援。每則訊息都發出一個 span；工具呼叫依 2026 年 OTel GenAI 語意慣例（第 23 課）帶上 `gen_ai.*` 屬性。

### 狀態：維護模式

2026 年初：AutoGen v0.7.x 對研究與原型開發而言是穩定的。Microsoft 已把活躍開發移到 Microsoft Agent Framework，也就是它的生產接班人（2025 年 10 月 1 日公開預覽；1.0 GA 原訂 2026 年第一季末）。AutoGen 的那些模式可以乾淨地往前移植 —— 演員模型才是那個耐久的構想。

```figure
actor-mailbox
```

## 動手實作

`code/main.py` 用 stdlib 實作一個演員執行環境：

- `Message` —— 具型別的酬載，含 `sender`、`recipient`、`topic`、`body`。
- `Actor` —— 抽象類別，帶 `receive(message, runtime)`。
- `Runtime` —— 事件迴圈，帶共享佇列、投遞與故障隔離。
- 一個雙演員示範：`ReviewerAgent` 審查程式碼、`ChecklistAgent` 跑一份檢查清單；它們互傳訊息直到達成共識。

跑它：

```
python3 code/main.py
```

軌跡顯示訊息投遞、一個演員裡模擬出來的故障（並不會把另一個弄崩），以及收斂到一份共同的裁決。

## 框架應用

- **AutoGen v0.4/v0.7**（維護中）—— 對研究、原型開發與多代理模式而言是穩定的。
- **Microsoft Agent Framework** —— 生產接班人（2025 年 10 月公開預覽）；同樣的演員模型構想，換上翻新過的 API。
- **LangGraph 的 swarm 拓撲**（第 13 課）—— 透過共享工具交接來達成類似模式。
- **自製演員執行環境** —— 當你需要特定傳輸時（NATS、RabbitMQ、gRPC）。

## 產出交付

`outputs/skill-actor-runtime.md` 會替給定的多代理任務產出一個最小的演員執行環境，加一份團隊樣板（RoundRobin 或 Selector）。

## 練習

1. 加一個死信佇列：處理器丟出例外時，把那則失敗訊息停放起來供人檢視。在你的玩具裡 DLQ 多久被打中一次？
2. 實作 `SelectorGroupChat`：一個選擇器演員依對話狀態挑出誰來處理下一則訊息。
3. 加上分散式傳輸：把行程內佇列換成一個 JSON-over-HTTP 伺服器，讓演員可以跑在不同行程裡。
4. 替每則訊息接上一個 OTel span（或一個 no-op 替身）。依第 23 課發出 `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 讀 AutoGen v0.4 的架構貼文。把你的玩具移植到真正的 `autogen_core` API。你跳過了哪些在生產環境很要緊的東西？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 演員 | 「代理」 | 私有狀態 + 收件匣 + 處理器；沒有共享記憶體 |
| 訊息 | 「事件」 | 具型別的酬載；演員互動的唯一方式 |
| 收件匣 | 「信箱」 | 每個演員各自的待處理訊息佇列 |
| 執行環境 | 「代理宿主」 | 負責路由訊息並隔離故障的事件迴圈 |
| Topic | 「頻道」 | 演員之間具名的發布訂閱路由 |
| 故障隔離 | 「讓它崩」 | 一個演員失敗不會把其他演員弄崩 |
| RoundRobinGroupChat | 「固定輪替的團隊」 | 代理照順序輪流 |
| SelectorGroupChat | 「依脈絡路由的團隊」 | 由選擇器挑出下一個發言者 |
| Magentic-One | 「參考團隊」 | 處理網頁 + 程式碼 + 檔案的多代理小隊 |

## 延伸閱讀

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 那篇重新設計的貼文
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 圖形狀的替代方案
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— AutoGen 預設會發出的那些 span
