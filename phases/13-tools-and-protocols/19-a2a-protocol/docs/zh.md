# A2A —— 代理對代理協定

> MCP 是代理對工具。A2A（Agent2Agent）則是代理對代理 —— 一套讓建構在不同框架上的不透明代理彼此協作的開放協定。由 Google 於 2025 年 4 月釋出，2025 年 6 月捐給 Linux Foundation，並在 2026 年 4 月抵達 v1.0，擁有 150 個以上的支持者，包括 AWS、Cisco、Microsoft、Salesforce、SAP 與 ServiceNow。它吸收了 IBM 的 ACP，並加上了 AP2 付款擴充。這一課會走過 Agent Card、Task 生命週期，以及三種協定繫結，並使用 A2A 1.0.1 的線路名稱。

**類型：** 實作
**程式語言：** Python (stdlib, Agent Card + Task harness)
**先修單元：** 階段 13 · 06（MCP 基礎）、階段 13 · 08（MCP 客戶端）
**時間：** 約 75 分鐘

## 學習目標

- 分辨代理對工具（MCP）與代理對代理（A2A）的使用情境。
- 在 `/.well-known/agent-card.json` 發布一份帶技能與 `supportedInterfaces` 中繼資料的 Agent Card。
- 走過 Task 生命週期：`TASK_STATE_SUBMITTED`、`TASK_STATE_WORKING`、`TASK_STATE_INPUT_REQUIRED`，以及終止狀態 `TASK_STATE_COMPLETED`、`TASK_STATE_FAILED`、`TASK_STATE_CANCELED`、`TASK_STATE_REJECTED`。
- 使用 Message，其中每個 Part 各自持有 `text`、`raw`、`url` 或 `data` 之一，並以 Artifact 作為輸出。

## 問題所在

一個客服代理需要把撰寫報告委派給一個專門的寫作代理。A2A 之前的選項有：

- 客製 REST API。可行，但每一組配對都是一次性的。
- 共用同一份程式碼庫。這要求兩個代理跑同一個框架。
- MCP。不合適：MCP 是用來呼叫工具的，不是用來讓兩個代理在各自保有不透明內部推理的前提下協作的。

A2A 補上了這道缺口。它把互動建模成一個代理把一個 Task 送給另一個代理，並帶有生命週期、訊息與 artifact。被呼叫代理的內部狀態保持不透明 —— 呼叫方只看得到任務狀態的轉移與最終的輸出。

A2A 就是那套「讓跨框架的代理彼此對話」的協定。它並不取代 MCP；兩者是互補的。

## 核心概念

### Agent Card

每個符合 A2A 的代理都在 `/.well-known/agent-card.json` 發布一張卡片：

```json
{
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "version": "1.2.0",
  "supportedInterfaces": [
    {
      "url": "https://research.example.com/a2a",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true},
  "securitySchemes": {
    "bearer": {"httpAuthSecurityScheme": {"scheme": "Bearer"}}
  },
  "securityRequirements": [{"schemes": {"bearer": {"list": []}}}],
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/markdown"],
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "tags": ["research", "summarization"],
      "inputModes": ["text/plain", "application/pdf"],
      "outputModes": ["text/markdown"]
    }
  ]
}
```

探索是以 URL 為基礎的：抓取那張卡片，挑出第一個 `protocolBinding` 是你的客戶端會講的 `supportedInterfaces` 項目，再列舉技能。輸入與輸出模式都是媒體類型。

### 簽章的 Agent Card

一張卡片可以帶一個 `signatures` 陣列。每個項目都是一份 JWS（RFC 7515），對卡片的 RFC 8785 標準 JSON 計算而得，計算時排除 `signatures` 欄位。使用者用同樣的方式把卡片標準化，再加以驗證。這能防止冒充。

### Task 生命週期

```text
TASK_STATE_SUBMITTED
  -> TASK_STATE_WORKING
  -> TASK_STATE_COMPLETED | TASK_STATE_FAILED | TASK_STATE_CANCELED | TASK_STATE_REJECTED

TASK_STATE_WORKING
  -> TASK_STATE_INPUT_REQUIRED
  -> TASK_STATE_WORKING (the client sends a message with the same taskId)
```

客戶端以 `SendMessage` 發起，由伺服器建立 Task。被呼叫的代理在各狀態間轉移；客戶端可以用 `GetTask` 輪詢，或透過 SSE 以 `SendStreamingMessage` 與 `SubscribeToTask` 串流。串流承載 `statusUpdate` 與 `artifactUpdate` 事件，並在任務抵達終止狀態時關閉。沒有 `final` 旗標。

### Message 與 Part

一則訊息有一個 `messageId`、一個 `role`（`ROLE_USER` 或 `ROLE_AGENT`），以及一個以上的 Part。每個 Part 恰好持有一個內容欄位，而那個欄位名稱就是它的型別。沒有 `kind` 欄位。

- `text`：純內容。
- `raw`：檔案位元組，在 JSON 裡以 base64 表示，通常附帶 `filename` 與 `mediaType`。
- `url`：指向檔案內容的連結。
- `data`：結構化的 JSON 酬載（給被呼叫代理的結構化輸入）。

範例：

```json
{
  "messageId": "msg-001",
  "role": "ROLE_USER",
  "parts": [
    {"text": "Summarize this paper."},
    {"raw": "...", "filename": "paper.pdf", "mediaType": "application/pdf"},
    {"data": {"targetLength": "3 paragraphs"}, "mediaType": "application/json"}
  ]
}
```

### Artifact

輸出是 Artifact，不是裸字串。一個 Artifact 是一份具名、定型的輸出：

```json
{
  "artifactId": "art-001",
  "name": "summary",
  "parts": [{"text": "...", "mediaType": "text/markdown"}]
}
```

Artifact 可以分塊串流。每個 `artifactUpdate` 事件都帶著該 artifact，外加 `append` 與 `lastChunk`。呼叫方負責累積。

### 三種協定繫結

1. **跑在 HTTP 上的 JSON-RPC 2.0**（`JSONRPC`）。用 POST 送請求，用 SSE 串流。方法採 PascalCase：`SendMessage`、`SendStreamingMessage`、`GetTask`、`ListTasks`、`CancelTask`、`SubscribeToTask`、`CreateTaskPushNotificationConfig`、`GetTaskPushNotificationConfig`、`ListTaskPushNotificationConfigs`、`DeleteTaskPushNotificationConfig` 與 `GetExtendedAgentCard`。
2. **gRPC**（`GRPC`）。給那些原生就用 gRPC 的企業環境。方法名稱相同。
3. **HTTP+JSON/REST**（`HTTP+JSON`）。資源 URL，例如 `POST /message:send` 與 `GET /tasks/{id}`。

三種繫結承載相同的資料模型。每個 `supportedInterfaces` 項目指名一種繫結及其 `protocolVersion`。客戶端在每個請求上都送出標頭 `A2A-Version: 1.0`，因為伺服器會把沒有這個標頭的請求當成 0.3 版。

```http
POST /a2a HTTP/1.1
Host: research.example.com
Content-Type: application/json
A2A-Version: 1.0

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "ROLE_USER",
      "parts": [{"text": "Summarize this paper."}]
    }
  }
}
```

### 不透明性的保留

一項關鍵的設計原則：被呼叫代理的內部狀態是不透明的。呼叫方看到的是任務狀態與 artifact。被呼叫代理的思維鏈、它的工具呼叫、它對子代理的委派 —— 全都看不見。這與 MCP 不同，MCP 的工具呼叫是透明的。

理由是：A2A 讓競爭對手能在不揭露內部的前提下協作。A2A 可以是「呼叫這個客服代理」，而呼叫方無從得知那個代理是怎麼實作這項服務的。

### 時間軸

- **2025-04-09。** Google 宣布 A2A。
- **2025-06-23。** 捐給 Linux Foundation。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 擴充（Agent Payments）出貨。
- **2026-04。** v1.0 釋出，擁有 150 個以上的支持組織。

### 與 MCP 的關係

| 面向 | MCP | A2A |
|-----------|-----|-----|
| 使用情境 | 代理對工具 | 代理對代理 |
| 不透明性 | 透明的工具呼叫 | 不透明的內部推理 |
| 典型呼叫方 | 代理執行環境 | 另一個代理 |
| 狀態 | 工具呼叫的結果 | 帶生命週期的 Task |
| 授權 | OAuth 2.1（階段 13 · 16） | Agent Card 的 `securitySchemes` + `securityRequirements` |
| 傳輸 | Stdio／Streamable HTTP | JSON-RPC／gRPC／HTTP+JSON |

想呼叫某個特定工具時用 MCP。想把一整項任務委派給另一個代理時用 A2A。許多生產系統兩者都用：一個代理在工具層用 MCP，在協作層用 A2A。

```figure
a2a-task-lifecycle
```

## 框架應用

`code/main.py` 實作了一套最小的 A2A 測試框架：寫作代理發布它的卡片，研究代理送給它一個 `SendMessage` 請求，其中帶一個 PDF part 與一段文字指令，任務依序經過 `TASK_STATE_WORKING` → `TASK_STATE_INPUT_REQUIRED` → `TASK_STATE_WORKING` → `TASK_STATE_COMPLETED`，最後回傳一份文字 artifact。全部用 stdlib；並用一個記憶體內傳輸，好把焦點放在訊息形狀上。

要看的地方有：

- Agent Card 的 JSON 形狀。
- 伺服器端的 Task id 指派與狀態轉移。
- 依據出現哪個內容欄位來決定型別的 Part。
- 任務中途的 `TASK_STATE_INPUT_REQUIRED` 分支。
- 完成時回傳的 artifact。

## 產出交付

這一課產出 `outputs/skill-a2a-agent-spec.md`。給定一個應該能被其他代理呼叫的新代理，這項技能會產出 Agent Card 的 JSON、技能 schema 與端點藍圖。

## 練習

1. 跑一次 `code/main.py`。追蹤完整的 Task 生命週期，包括被呼叫代理索取澄清時那次 `TASK_STATE_INPUT_REQUIRED` 的暫停。

2. 加上一張簽章的 Agent Card。在 `signatures` 裡放一個 `alg` 設為 `HS256` 的 JWS 項目，對排除 `signatures` 欄位後的卡片標準 JSON 簽章。寫一個驗證器，確認它對被竄改的卡片會失敗。

3. 用 `SendStreamingMessage` 實作任務串流：寫作代理吐出 `task`、三個 `artifactUpdate` 分塊，以及一個帶 `TASK_STATE_COMPLETED` 的 `statusUpdate`，然後關閉串流。呼叫方把這些分塊累積起來。

4. 設計一個包住某台 MCP 伺服器的 A2A 代理。把每一個 MCP 工具對映到一項 A2A 技能。記下其中的取捨 —— 什麼樣的不透明性被犧牲了？

5. 讀 A2A v1.0 的發布公告，找出截至 2026 年 4 月尚未被任何框架實作的那項功能。（提示：它和多跳任務委派有關。）

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|------------------------|
| A2A | 「代理對代理協定」 | 供不透明代理協作的開放協定 |
| Agent Card | 「`/.well-known/agent-card.json`」 | 描述一個代理的技能與 `supportedInterfaces` 的公開中繼資料 |
| Skill | 「一個可呼叫的單位」 | 該代理支援的具名操作（類比於 MCP 的工具） |
| Task | 「委派的單位」 | 帶生命週期與最終 artifact 的一件工作 |
| Message | 「任務輸入」 | 承載各個 Part（`text`、`raw`、`url`、`data`） |
| Part | 「定型的一塊」 | 恰好是 `text`／`raw`／`url`／`data` 其中之一，外加選配的 `mediaType`；沒有 `kind` 欄位 |
| Artifact | 「任務輸出」 | 完成時回傳的具名、定型輸出 |
| AP2 | 「Agent Payments Protocol」 | 建立在 A2A 之上的付款擴充；卡片簽章屬於 A2A 核心（`signatures`） |
| 不透明性 | 「黑箱協作」 | 被呼叫代理的內部對呼叫方是隱藏的 |
| `TASK_STATE_INPUT_REQUIRED` | 「任務暫停」 | 代理需要更多資訊時的中斷狀態 |

## 延伸閱讀

- [a2a-protocol.org](https://a2a-protocol.org/latest/) —— 權威的 A2A 規格
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) —— 參考實作與 SDK
- [A2A v1.0.1 release](https://github.com/a2aproject/A2A/tree/v1.0.1)：本課所依循、帶標籤的 `docs/specification.md` 與規範性的 `specification/a2a.proto`
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) —— 2025 年 6 月的治理移轉
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) —— 路線圖與夥伴動能
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) —— v1.0 發布說明與向後相容的指引
