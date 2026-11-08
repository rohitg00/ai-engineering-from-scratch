# 多代理的原語模型

> 四個原語，沒有更多 —— 代理、交接、共享狀態、編排者 —— 張出一個四維的設計空間，而 2026 年出貨的主要多代理框架（AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework）都是這個空間裡的點。這一課從零把它們建出來、讓一個玩具系統在四者上都跑一遍，再把每個主要框架對映到同一組軸上，好讓你用一段話就讀懂任何新版本。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 14（代理工程）、階段 16 · 01（為什麼要多代理）
**時間：** 約 60 分鐘

## 問題

每六個月就有一個新的多代理框架出貨。2023 年的 AutoGen。2024 年的 CrewAI。2024 年的 LangGraph 與 OpenAI Swarm。2025 年 4 月的 Google ADK。2026 年 2 月的 Microsoft Agent Framework RC。每一份新聞稿都宣稱自己是「那個對的抽象」。

如果你打算一個一個學，你會燒光自己。API 看起來都不一樣。文件對「代理」是什麼各說各話。一個框架把它的共享記憶叫「黑板」，另一個叫「訊息池」，第三個叫「StateGraph」。你開始懷疑這個領域只是在原地攪動。

它不是。在行銷詞彙底下，那四個原語是穩定的。學一次，然後用一段話就讀懂每一個新框架。

## 概念

### 那四個原語

1. **代理（Agent）** —— 一段系統提示詞加一份工具清單。無狀態；每次執行都從它的系統提示詞與當前訊息歷史開始。
2. **交接（Handoff）** —— 從一個代理到另一個代理、結構化的控制權轉移。機制上，就是一次回傳新代理的工具呼叫，或一條依條件跟隨的圖邊。
3. **共享狀態（Shared state）** —— 任何超過一個代理能讀（有時能寫）的資料結構。訊息池、黑板、鍵值儲存、向量記憶。
4. **編排者（Orchestrator）** —— 決定接下來誰發言的那個東西。選項有：明寫的圖（決定性）、LLM 發言者選擇器（軟性）、上一位發言者的交接呼叫（OpenAI Swarm），或佇列之上的排程器（swarm 架構）。

這就是整個設計空間。每個框架替每一軸挑了預設值；其餘的都是表層語法。

### 2026 年的每個框架怎麼對映上去

| 框架 | 代理 | 交接 | 共享狀態 | 編排者 |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | 工具回傳 Agent | 呼叫者自己的事 | LLM 的下一次交接呼叫 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的發言者選擇器 | 訊息池 | 選擇器函數（LLM 或輪替） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task 輸出串接 | 經理 LLM 或靜態順序 |
| LangGraph | 節點函數 | 圖邊 + 條件 | `StateGraph` reducer | 那張圖，決定性的 |
| Microsoft Agent Framework | 代理 + 編排模式 | 依模式而定 | thread／context | 依模式而定 |
| Google ADK | 代理 + A2A card | A2A task | A2A 產物 | 由宿主決定 |

表面差異看起來很大。底下：同樣四個旋鈕。

### 為什麼這件事要緊

一旦你看見那些原語，比較框架就變成一份短短的檢查清單：

- 編排者是信任 LLM 來路由（Swarm），還是把路由釘死在程式碼裡（LangGraph）？
- 共享狀態是完整歷史（GroupChat），還是被投影過的（StateGraph reducer）？
- 代理能不能修改彼此的提示詞（CrewAI 的經理），還是只能交接（Swarm）？

那三個問題回答了「哪個框架適合某個問題」的 80%。你不再到處比價「最好的多代理框架」，而是開始針對你真正在意的那一軸做設計。

### 那個無狀態的洞見

除了共享狀態之外，每個原語都是無狀態的。代理是 (prompt, tools) 的函數。交接是一次函數呼叫。編排者是一個排程器。**系統中唯一有狀態的東西就是共享狀態。** 所有有趣的臭蟲都住在那裡：記憶投毒（第 15 課）、訊息排序、版本控管、寫入爭用。

把共享狀態藏起來的框架（Swarm）把問題推給呼叫者。把它集中起來的框架（LangGraph 的檢查點、AutoGen 的訊息池）讓它可被檢視，但把協調成本轉嫁到共享狀態的實作上。

### 單一原語的解剖

#### 代理

```
Agent = (system_prompt, tools, model, optional_name)
```

沒有記憶。沒有狀態。兩個系統提示詞與工具都相同的代理是可互換的。所有看起來像「逐代理狀態」的東西，其實都在共享狀態或交接協定裡。

#### 交接

```
Handoff = (from_agent, to_agent, reason, payload)
```

有三種實作占主導：

- **函數回傳** —— 工具回傳下一個代理。這是 OpenAI Swarm 的模式。代理把路由帶在自己的工具 schema 裡。
- **圖邊** —— LangGraph。邊是宣告式的。LLM 產出一個值；一個條件選出下一個節點。
- **發言者選擇** —— AutoGen 的 GroupChat。一個選擇器函數（有時自己就是一次 LLM 呼叫）讀訊息池並挑出下一個發言者。

#### 共享狀態

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最起碼是一份訊息清單。通常更多：結構化產物（CrewAI 的 Task 輸出）、具型別的脈絡（LangGraph 的 reducer）、外部記憶（MCP、向量 DB）。

兩種拓撲：**完整池**（每個代理都看到每則訊息）與**投影式**（代理看到依角色劃定範圍的視圖）。完整池很簡單，但擴展性很差。投影式池擴展得起來，但需要前期的 schema 設計。

#### 編排者

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四種口味：

- **靜態** —— 圖在建構時就固定（LangGraph 的決定性版本、CrewAI 的 Sequential）。
- **LLM 選擇** —— 一個 LLM 讀訊息池並挑出下一個發言者（AutoGen、CrewAI 的 Hierarchical）。
- **交接驅動** —— 由當前代理呼叫交接工具來決定（Swarm）。
- **佇列驅動** —— worker 從共享佇列拉工作；沒有明寫的下一位發言者（swarm 架構、Matrix）。

### 框架之間變動的是什麼

一旦原語固定下來，剩下的設計決策就是：

- **記憶策略** —— 短暫 vs 持久檢查點（LangGraph 的 checkpointer）。
- **安全邊界** —— 誰能核准一次交接（human-in-the-loop）。
- **成本記帳** —— 逐代理的詞元預算。
- **可觀測性** —— 追蹤交接、持久化狀態以便重播。

全都可以疊在那些原語之上實作。它們都不是新的原語。

```figure
a5-primitive-radar
```

## 動手實作

`code/main.py` 用約 150 行 stdlib Python 實作那四個原語。沒有真正的 LLM —— 每個代理都是一份腳本化的策略，好讓焦點留在協調結構上。

這個檔案匯出：

- `Agent` —— 一個帶名稱、系統提示詞、工具、策略函數的 dataclass。
- `Handoff` —— 一個回傳新代理的函數。
- `SharedState` —— 一個執行緒安全的訊息池。
- `Orchestrator` —— 三種變體：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模擬的）。

這個示範讓同一條三代理管線（研究 → 撰寫 → 審查）走過三種編排者型別，並在最後印出訊息池。你會看到輸出的差異只在於*誰挑下一個*；代理與共享狀態在各趟執行中都一模一樣。

跑它：

```
python3 code/main.py
```

預期輸出：三趟編排者執行，一種模式一趟。每一趟都印出最終的訊息池。若研究員提早判定完成，交接驅動那一趟會走到比較少的代理 —— 那就是 LLM 路由取捨的縮影。

## 框架應用

`outputs/skill-primitive-mapper.md` 是一項技能，會讀任何多代理程式庫或框架文件，並回傳那份四原語對映。在深入讀文件之前，先拿它跑一個新框架的版本，取得一段話的理解。

## 產出交付

在採用一個新框架之前，先替它寫出那份原語對映。如果你寫不出來，那不是文件不完整，就是這個框架在發明第五個原語（很罕見 —— 去檢查是不是有一種你沒見過的共享狀態口味）。

把那份對映釘在你的架構文件裡。新成員加入時，先把對映寄給他們，再給 API 文件。框架版本改變時，去 diff 那份對映，不是去 diff changelog。

## 練習

1. 用不同的代理策略跑 `code/main.py` 三次。觀察編排者的選擇如何改變哪些代理會被執行。
2. 實作第四種編排者型別：佇列驅動的那種，代理輪詢共享狀態取工作。會發生什麼樣的死鎖，而你要怎麼偵測它？
3. 拿 LangGraph 的快速上手（https://docs.langchain.com/oss/python/langgraph/workflows-agents）改寫成那四個原語。LangGraph 的哪些抽象是 1:1 對映，哪些只是便利包裝？
4. 讀 OpenAI Swarm 的 cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指認出 Swarm 把四個原語中的哪一個做得最人體工學，又把哪一個推給了呼叫者。
5. 在這張表裡找出一個完全把共享狀態藏起來的框架。解釋當代理需要跨交接協調、又不重讀歷史時，什麼會壞掉。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 代理 | 「帶工具的 LLM」 | 一組 `(system_prompt, tools, model)` 三元組。無狀態。 |
| 交接 | 「控制權轉移」 | 一次結構化呼叫，指名下一個代理與選配的酬載。三種實作：函數回傳、圖邊、發言者選擇。 |
| 共享狀態 | 「記憶」／「脈絡」 | 多代理系統中唯一有狀態的部分。訊息池或黑板。 |
| 編排者 | 「協調者」 | 決定接下來誰執行的那個東西。靜態圖、LLM 選擇器、交接驅動，或佇列驅動。 |
| 原語 | 「抽象」 | 每個框架都會參數化的那四軸之一。不是某個框架的功能。 |
| 訊息池 | 「共享的聊天歷史」 | 完整歷史式的共享狀態。容易推敲，擴展性很差。 |
| 投影式狀態 | 「劃定範圍的視圖」 | 對共享狀態的角色專屬視圖。擴展得起來，需要 schema 設計。 |
| 發言者選擇 | 「接下來誰講話」 | 一種編排模式：由一個函數（常常是 LLM）從一群人裡挑出下一個代理。 |

## 延伸閱讀

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 對交接驅動編排最清楚的表述
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) —— GroupChat + 發言者選擇是 LLM 選擇式編排的參考做法
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 圖邊式編排與以 reducer 為基礎的共享狀態
- [CrewAI introduction](https://docs.crewai.com/en/introduction) —— role-goal-backstory 代理、Sequential／Hierarchical 流程
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) —— Microsoft 把 v0.4 轉入維護後，AutoGen v0.2 這條線的存續版本
