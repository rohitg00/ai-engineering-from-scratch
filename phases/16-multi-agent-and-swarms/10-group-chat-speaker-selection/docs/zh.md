# 群聊與發言者選擇

> 共享對話式的編排，把 N 個代理放進同一場對話；一個選擇器函數（LLM、輪替，或自訂）挑出接下來誰發言。這是浮現式多代理對話的原型 —— 代理不知道自己在某張靜態圖裡的角色，它們只是對共享池做反應。AutoGen GroupChat 與 AG2 GroupChat 是那兩份參考實作：AutoGen v0.2 的 GroupChat 語意在 AG2 這個分支中被保留下來；AutoGen v0.4 則把它改寫成事件驅動的演員模型。Microsoft 在 2026 年 2 月把 AutoGen 轉入維護模式，並與 Semantic Kernel 合併成 Microsoft Agent Framework（2026 年 2 月 RC）。GroupChat 這個原語在 AG2 與 Microsoft Agent Framework 兩邊都活了下來 —— 學一次，到處都能用。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 16 · 04（原語模型）
**時間：** 約 60 分鐘

## 問題

靜態圖（LangGraph）在工作流已知時很好用。真實對話並不靜態：有時是寫程式的問審查者，有時問研究員，有時問寫手。把每一種可能的交接都寫死，會造成邊的爆炸。你想要的是*代理對著一個共享池做反應*，再由某個函數決定接下來誰講話。

那正是 AutoGen GroupChat 在做的事。

## 概念

### 那個形狀

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

每個代理都看到每則訊息。每一輪都會調用一次選擇器函數來挑出接下來誰發言。

### 三種選擇器口味

**輪替。** 固定循環。決定性。在 N 上是線性擴展，但無視脈絡 —— 就算主題是法務審查，寫程式的也會輪到。

**LLM 選擇。** 呼叫一個 LLM，讓它讀最近的訊息池並回傳最好的下一位發言者。知脈絡但慢：每一輪都多一次 LLM 呼叫。這是 AutoGen 的預設。

**自訂。** 一個帶你想要的任何邏輯的 Python 函數。典型做法：LLM 選擇加上退路規則（例如「寫程式的之後永遠輪到查證者」）。

### ConversableAgent 的 API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` 持有那個選擇器。當某個代理完成一輪，manager 就呼叫選擇器，選擇器回傳下一個代理。迴圈持續到某個終止條件為止。

### 終止

三種常見模式：

- **最大回合數。** 對總輪數設硬上限。
- **「TERMINATE」詞元。** 代理可以發出一個哨兵訊息；manager 一看到就停。
- **目標達成檢查。** 每一輪跑一個輕量查證器，完成時就把聊天停掉。

### 血脈：分支與合併

2025 年初，Microsoft 開始圍繞一個事件驅動的演員模型對 AutoGen 做大改寫（v0.4）。社群把 AutoGen v0.2 的 GroupChat 語意分支成 AG2，保住了早期採用者已經整合的那套 API。

2026 年 2 月，Microsoft 宣布 AutoGen 將轉入維護模式，其事件驅動的演員模型併入 **Microsoft Agent Framework**（2026 年 2 月 RC，現已與 Semantic Kernel 合併）。GroupChat 這個概念在兩條路線上都活了下來；實作細節不同。若要 v0.2 相容的程式碼，AG2 是首選的上游。

### GroupChat 適合的時候

- **浮現式的對話。** 你不想把每一種可能的下一位發言者都預先接死。
- **角色混雜的任務。** 寫程式的問研究員、研究員問檔案管理員、檔案管理員又問回寫程式的。流程不是 DAG。
- **探索式的解題。** 想的是「腦力激盪會議」，不是「裝配線」。

### 它失敗的時候

- **嚴格的決定性。** LLM 選擇器可能不一致。同一段提示詞、不同次執行、不同的下一位發言者。
- **奉承連鎖。** 代理順從那個講得最有自信的人。要用提示詞明確反制。
- **脈絡肥大。** 每個代理都讀每則訊息；10 輪之後脈絡就很巨大。用投影（第 15 課）來限縮視圖。
- **熱門發言者。** 某個代理主導了整場對話，因為選擇器偏愛它的專長。把發言者平衡加進選擇器的考量。

### 群聊 vs supervisor

同樣的原語，不同的預設：

- Supervisor：一個代理規劃、其他執行。選擇器是「去問規劃者要做什麼」。
- 群聊：所有代理都是同儕；選擇器是一個作用在共享池上的函數。

兩者都用第 04 課那四個原語。群聊預設採 LLM 選擇式編排與完整池式的共享狀態。

```figure
swarm-speaker
```

## 動手實作

`code/main.py` 用 stdlib 從零實作一個 GroupChat。三個代理（寫程式的、審查者、經理）、輪替與 LLM 選擇兩種變體，以及一個以 `TERMINATE` 詞元終止的機制。

這個示範會印出對話逐字稿，加上兩種變體的選擇器決策軌跡。

跑：

```
python3 code/main.py
```

## 框架應用

`outputs/skill-groupchat-selector.md` 替一項給定任務設定 GroupChat 選擇器 —— 輪替、LLM 選擇還是自訂，以及該用哪些選擇器輸入（最近訊息、代理專長、輪次計數）。

## 產出交付

檢查清單：

- **最大回合數上限。** 一律要有。典型任務 10-20。
- **發言者平衡指標。** 追蹤每個代理的輪數；不平衡超過門檻就發警示。
- **終止詞元。** `TERMINATE`，或一個專職的查證者代理。
- **投影或劃定範圍的記憶。** 大約 10 則訊息之後，就考慮只給每個代理一個劃定範圍的視圖，以防脈絡肥大。
- **選擇器記錄。** 對 LLM 選擇的變體，要同時記錄選擇器的輸入與它的選擇。否則除錯是不可能的。

## 練習

1. 跑 `code/main.py`。比較輪替與 LLM 選擇之下的對話。各自是哪個代理主導？
2. 在選擇器裡加一條「每個代理最多發言 N 次」的規則。它怎麼影響逐字稿？
3. 實作目標達成終止：審查者回傳「approved」就停。它在回合上限之前多常觸發？
4. 讀 AutoGen 穩定版關於 GroupChat 的文件（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。指認出 `GroupChatManager` 使用的預設選擇器。
5. 讀 AG2 儲存庫（https://github.com/ag2ai/ag2），把它的 v0.2 GroupChat 跟 v0.4 事件驅動版做比較。v0.4 具體加上了哪一項性質（吞吐量、容錯、可組合性）？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| GroupChat | 「代理在同一間聊天室」 | 共享訊息池 + 選擇器函數。AutoGen／AG2 的原語。 |
| 發言者選擇 | 「接下來誰講話」 | 挑出下一個代理的那個函數。輪替、LLM 選擇，或自訂。 |
| GroupChatManager | 「會議主持人」 | AutoGen 中持有選擇器並在輪次上迴圈的元件。 |
| ConversableAgent | 「那個基礎代理」 | AutoGen 的基礎類別；一個能收發訊息的代理。 |
| 終止詞元 | 「那個『停』字」 | 結束聊天的哨兵字串（通常是 `TERMINATE`）。 |
| 熱門發言者 | 「一個代理主導全場」 | 選擇器一直挑同一個代理的失敗模式。 |
| 脈絡肥大 | 「池子無界地長」 | 每個代理都讀所有先前訊息；脈絡隨輪數成長。 |
| 投影 | 「劃定範圍的視圖」 | 對共享池的角色專屬視圖，用來防止脈絡肥大。 |

## 延伸閱讀

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) —— 那份參考實作
- [AG2 repo](https://github.com/ag2ai/ag2) —— 社群版的 AutoGen v0.2 存續
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) —— 那個合併後的接班人，2026 年 2 月 RC
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) —— 事件驅動演員模型改寫的細節
