# 有狀態的圖編排 —— 持久執行與檢查點

> 代理是一台狀態機；節點是函數；邊是轉移；狀態在每個節點之後存成檢查點。任何失敗都可以從最後一個成功的檢查點續跑。LangGraph 是 2026 年這種低階有狀態編排模型的參考做法。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 12（工作流模式）
**時間：** 約 75 分鐘

## 學習目標

- 描述 LangGraph 的核心模型：帶具型別狀態的狀態機、函數節點、條件邊，以及節點後的檢查點。
- 說出文件強調的四種能力：持久執行、串流、human-in-the-loop、完整的記憶。
- 解釋 LangGraph 支援的三種編排拓撲：supervisor、點對點（swarm）、階層式（巢狀子圖）。
- 用 stdlib 實作一張狀態圖，含具型別狀態、條件邊，以及一次檢查點／續跑的循環。

## 問題所在

代理與工作流共有一個問題：當一趟 40 步的執行在第 38 步失敗時，你想從第 38 步續跑，而不是從頭來過。二等公民級的狀態模型，只會讓維運者在一個假設「每次都是全新執行」的函式庫外面東拼西湊地做重試。

LangGraph 的設計答案：狀態是一等的具型別物件、變更是明寫的，而且每個節點之後都持久化檢查點。續跑就是一次 `load_state(session_id)` 呼叫。

## 核心概念

### 那張圖

一張圖由這些定義：

- **狀態型別。** 一個具型別的 dict（或 Pydantic 模型），每個節點都會讀它、改它。
- **節點。** 純函數 `(state) -> state_update`。回傳後更新會被併回狀態。
- **邊。** 節點之間的條件式或直接轉移。
- **進入與離開。** `START` 與 `END` 這兩個哨兵節點標出邊界。

例子：一個帶 `classify`、`refund`、`bug`、`sales`、`done` 節點的代理 —— 一個路由工作流被畫成圖。

### 持久執行

每個節點回傳後，執行環境會把狀態序列化並寫進一個 checkpointer（SQLite、Postgres、Redis、自訂）。若在第 N 步失敗，執行環境可以 `resume(session_id)`，帶著一模一樣的狀態從第 N+1 步接下去。

LangGraph 文件明白點名了幾個這件事很要緊的生產使用者：Klarna、Uber、J.P. Morgan。它主張的不是圖這個形狀本身；而是圖這個形狀加上檢查點，讓復原變得便宜。

### 串流

每個節點都可以吐出部分輸出。圖會把逐節點的 delta 事件串流給呼叫者，好讓 UI 隨著圖的執行而更新。

### Human-in-the-loop

在節點之間檢視並修改狀態。實作方式：在某個關鍵節點前暫停、把狀態呈現給人、接受修改、續跑。checkpointer 讓這件事很容易，因為狀態本來就已經序列化了。

### 記憶

短期（單次執行內 —— 狀態裡的對話歷史）與長期（跨執行 —— 透過 checkpointer 加一個獨立的長期儲存來持久化）。LangGraph 透過工具與外部記憶系統（Mem0、自製）整合。

### 三種拓撲

1. **Supervisor。** 中央的路由 LLM 分派給專家子代理。`langgraph-supervisor` 裡的 `create_supervisor()`（不過 LangChain 團隊在 2026 年建議直接透過工具呼叫來做這件事，以取得更好的脈絡掌控）。
2. **Swarm／點對點。** 代理透過共享的工具表面直接交接。沒有中央路由器。
3. **階層式。** Supervisor 管理子 supervisor，以巢狀子圖實作。

### 這套模式在哪裡會出錯

- **檢查點太小。** 只把對話輪次存成檢查點，會讓工具狀態與記憶寫入無法復原。完整狀態都必須序列化。
- **非決定性的節點。** 續跑假設同樣的節點輸入會產出同樣的狀態更新。隨機種子、牆鐘時間、外部 API 都必須被捕捉下來。
- **過度使用條件邊。** 一張每條邊都是條件式的圖，是一台沒辦法推敲的狀態機。偏好線性鏈條、偶爾分岔。

```figure
langgraph-state
```

## 動手實作

`code/main.py` 用 stdlib 實作一張有狀態的圖：

- `State` —— 一個具型別的 dict，含 `messages`、`step`、`route`、`output`、`human_approval`。
- `Node` —— 吃狀態、回傳一份更新 dict 的可呼叫物件。
- `StateGraph` —— 節點 + 邊 + 條件邊 + 執行 + 續跑。
- `SQLiteCheckpointer`（記憶體內的假貨）—— 每個節點後序列化狀態；`load(session_id)` 還原。
- 一張示範圖：classify -> branch(refund / bug / sales) -> 人工閘門 -> send。

跑它：

```
python3 code/main.py
```

軌跡顯示第一趟在人工閘門處失敗、持久化，然後續跑產出最終輸出。

## 框架應用

- **LangGraph** —— 參考做法，生產就緒。用 `create_react_agent`、`create_supervisor`，或自己蓋一張圖。
- **AutoGen v0.4**（第 14 課）—— 高併發場景下的演員模型替代方案。
- **Claude Agent SDK**（第 17 課）—— 內建工作階段儲存的託管執行環境。
- **自製** —— 當你需要精確掌控狀態形狀或 checkpointer 後端時。

## 產出交付

`outputs/skill-state-graph.md` 會在任何目標執行環境中產出一張 LangGraph 形狀的狀態圖，檢查點與續跑都接好。

## 練習

1. 加一條從 `classify` 到 `end` 的條件邊，在分類信心低於門檻時走它。等人工把 `route` 手動設好之後再續跑。
2. 把那個類 SQLite 的假貨換成真正的 SQLite checkpointer。量逐步的序列化開銷。
3. 實作平行邊：兩個節點併發跑，再用一個自訂 reducer 合併。不可變狀態在這裡替你換到了什麼？
4. 讀 `langgraph-supervisor` 的參考文件。把這個玩具移植到 `create_supervisor`。比較兩者的軌跡形狀。
5. 加上串流：每個節點在執行過程中吐出部分狀態。收到 delta 就印出來。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 狀態圖 | 「代理即狀態機」 | 具型別狀態 + 節點 + 邊 + reducer |
| Checkpointer | 「持久化後端」 | 每個節點後序列化狀態；讓續跑成為可能 |
| Reducer | 「狀態合併器」 | 把當前狀態與某節點的更新合起來的函數 |
| 條件邊 | 「分岔」 | 由一個以狀態為輸入的函數所選出的邊 |
| 子圖 | 「巢狀圖」 | 被當成另一張圖裡一個節點使用的圖 |
| 持久執行 | 「從失敗處續跑」 | 帶著一模一樣的狀態從最後一個成功節點重啟 |
| Supervisor | 「路由 LLM」 | 給專家子代理用的中央分派者 |
| Swarm | 「P2P 代理」 | 代理透過共享工具交接；沒有中央路由器 |

## 延伸閱讀

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 參考文件
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) —— supervisor 模式的 API
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 演員模型的替代方案
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— 工作階段儲存與子代理
