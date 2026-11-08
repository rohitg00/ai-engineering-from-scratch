# 角色制的代理團隊 —— 角色、任務、流程

> 四個原語：Agent、Task、Crew、Process。兩種頂層形狀：Crews（自主的角色制協作）與 Flows（事件驅動、決定性）。CrewAI 是 2026 年的參考實作，而它的文件講得很直白：「任何生產就緒的應用，都從 Flow 開始。」

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 12（工作流模式）、階段 14 · 14（演員模型）
**時間：** 約 75 分鐘

## 學習目標

- 說出 CrewAI 的四個原語（Agent、Task、Crew、Process），以及各自擁有什麼。
- 分辨 Sequential、Hierarchical 與規劃中的 Consensus 流程；替每種工作負載挑一個。
- 分辨 Crews（自主的角色制）與 Flows（事件驅動的決定性），並解釋文件給出的生產建議。
- 用 `@tool` 裝飾器與 `BaseTool` 子類別接上工具；推敲結構化輸出與自由文字的取捨。
- 說出 CrewAI 的四種記憶型別，以及各自何時划算。
- 用 stdlib 實作一個三代理的 crew（研究員、寫手、編輯），產出一份摘要。
- 揪出 CrewAI 的三種失敗模式：提示詞肥大、經理 LLM 稅、脆弱的交接。

## 問題所在

採用多代理框架的團隊都撞上同一面牆。「自主協作」在示範裡聽起來很棒。然後某個客戶回報了一個臭蟲，而你需要決定性的重播。或財務問你一個由 LLM 路由的 crew 每跑一趟要多少錢。或值班的人需要知道凌晨三點是哪個代理卡住了。

自由形式、由 LLM 路由的 crew，這些問題一個都答不乾淨。純 DAG 全部都答得出來，但會失去腦力激盪代理所需要的那種探索形狀。

CrewAI 的拆分對這筆取捨很誠實。Crews 給協作式、角色制、探索性的工作。Flows 給事件驅動、由程式碼擁有、可稽核的生產環境。同一個框架、兩種形狀，依表面各自挑選。

## 核心概念

### 四個原語

CrewAI 的表面很小。把這個背起來，剩下的都是設定。

- **Agent。** `role + goal + backstory + tools + （選配）llm`。backstory 是承重結構。它形塑語氣、判斷力，以及代理何時停手。tools 是代理可以呼叫的函數（下面詳述）。
- **Task。** `description + expected_output + agent + （選配）context + （選配）output_pydantic`。一個可重用的工作單位。`expected_output` 就是那份契約。`context` 列出哪些上游任務的輸出要傳進來。`output_pydantic` 強制一個結構化的形狀。
- **Crew。** 容器。擁有 `agents` 清單、`tasks` 清單、`process`，以及選配的 `memory` + `verbose` + `manager_llm` 設定。
- **Process。** 執行策略。Sequential、Hierarchical、Consensus（規劃中）。它挑定這一趟執行的形狀。

代理彼此看不到對方。任務參照代理。Crew 替任務排序。Process 決定誰來挑下一項任務。整個心智模型就這樣。

> **驗證版本：** CrewAI 0.86（2026-05）。更新的版本可能改名或合併流程型別；在依賴某個特定形狀之前，先查 [CrewAI Processes docs](https://docs.crewai.com/concepts/processes)。

### Sequential vs Hierarchical vs Consensus

- **Sequential。** 任務按宣告順序跑。第 N 項任務的輸出會以 `context` 提供給第 N+1 項任務。成本最低。最可預測。順序固定時就用它。
- **Hierarchical。** 一個經理 Agent（獨立的 LLM 呼叫）在專家之間做路由。CrewAI 會依你的 `manager_llm` 設定或預設值生出這位經理。經理每一輪挑出下一項任務，而且可以拒絕或改道。當你有四個以上的專家、而順序真的取決於先前輸出時就用它。
- **Consensus。** 規劃中，目前公開 API 尚未實作。文件替一個未來、以投票為基礎的流程保留了這個名字。今天不要依賴它。

Hierarchical 在每個專家呼叫之上，又疊了每輪一次的 LLM 呼叫（那位經理）。在一趟五步的執行裡，詞元成本可能變三倍。只有在你真的需要那個路由時才付這筆錢。

### Crews vs Flows

這是文件在 2026 年開場就擺出來的框架。

- **Crew。** LLM 驅動的自主性。框架在執行期決定形狀。適合：研究、腦力激盪、初稿，以及任何「路徑本身就是答案一部分」的場合。很難重播。很難測試。原型開發很便宜。
- **Flow。** 由你擁有的事件驅動圖。`@start` 標出入口。`@listen(topic)` 標出一個在別的步驟發出該 topic 時觸發的步驟。每個步驟都是普通 Python（內部可以呼叫一個 Crew）。適合：生產環境。可觀測。可測試。決定性。

文件在 2026 年給的生產建議：從 Flow 開始。當自主性掙得回它的成本時，再從 Flow 的步驟裡以 `Crew.kickoff()` 呼叫把 Crew 折進來。Flow 給你稽核軌跡，Crew 給你探索。要組合，不要二選一。

### 工具整合

有三種方式把工具給 Agent。挑最簡單、合用的那個。

1. **`@tool` 裝飾器。** 純函數變成工具。簽章就是 schema；docstring 就是 LLM 看到的描述。最適合一次性的小幫手。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` 子類別。** 基於類別的工具，帶明寫的參數 schema、非同步支援、重試。當工具帶狀態（一個 client、一份快取）或需要結構化參數時使用。

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **內建工具包。** CrewAI 出貨了一批第一方轉接器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。一行 import 就接好。

結構化輸出用 Pydantic。在 Task 上傳 `output_pydantic=MyModel`。CrewAI 會拿該模型去驗證 LLM 的回應，然後強制轉型或重試。把它跟一段收得很緊的 `expected_output` 字串搭配使用。自由文字輸出用在初稿沒問題；結構化輸出才是下游 Flow 消化得了的東西。

### 記憶掛鉤

CrewAI 開箱就出貨四種記憶型別。它們可以組合：一個 Crew 可以同時啟用全部四種。

> **驗證版本：** CrewAI 0.86（2026-05）。近期版本把一切都導向一個統一的 `Memory` 系統，由它包住這四種儲存。下面的概念模型仍然成立，但在更新的版本裡，公開的類別表面可能會塌縮成單一個 `Memory` 入口；當前 API 請查 [CrewAI memory docs](https://docs.crewai.com/concepts/memory)。

- **短期。** 單趟執行內的對話緩衝區。結束時抹除。
- **長期。** 跨執行持久化。存在向量 DB 裡（預設 Chroma，可換）。依與當前任務的相似度檢索。
- **實體。** 逐實體的事實。「客戶 X 用的是企業方案。」以實體為鍵，不是以相似度。跨執行存活。
- **脈絡式。** 組裝時才檢索。在 Agent 需要的那一刻才把相關記憶拉進來，不預先載入。

在 Crew 上用 `memory=True` 或逐型別設定來啟用。背後由你設定的嵌入供應商支撐（預設 OpenAI，可換成本地）。記憶是 CrewAI 相對於更薄框架掙得身價的地方之一；純 LangGraph 得由你自己把這幾樣一一接起來。

### 角色制團隊合用的時候

- 三到六個有具名角色的代理，加上一套協作式工作流。起草、審查、規劃、腦力激盪。
- 路由中「LLM 對下一步的判斷」本身就是價值的一部分（Hierarchical）。
- 任何團隊讀 `role + goal + backstory` 比讀一份圖定義更開心的場合。

### 不合用的時候

- 有嚴格順序的決定性 DAG。用 LangGraph（第 13 課）。圖這個形狀才是對的抽象；CrewAI 的角色框架反而是摩擦力。
- 次秒級的延遲預算。Hierarchical 增加來回。就連 Sequential 也會把含有 backstory 與先前輸出的提示詞串成一長串。
- 單代理迴圈。跳過框架；一個代理迴圈（第 1 課）加一份工具註冊表更短。

第 17 課（代理框架取捨）用一張矩陣把這件事攤開。簡短版：CrewAI 坐在「協作式角色制」那個角落。

### 相依形狀

獨立於 LangChain。Python 3.10 到 3.13。使用 `uv`。星數：見 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)（快照時間 2026-05）。AWS Bedrock 整合有文件；廠商基準回報在問答工作負載上相對 LangGraph 有相當幅度的加速，但方法論（資料集、硬體、評測指標）未公開，所以框架廠商的數字只能當方向性參考。

### 這套模式在哪裡會出錯

- **backstory 造成的提示詞肥大。** 每個代理一段 2000 字的 backstory、再配一個五代理的 crew，第一次工具呼叫都還沒發生，脈絡預算就燒光了。backstory 控制在 200 字以內。跨代理重用片語；別把同一套家規重複寫五遍。
- **經理 LLM 的詞元稅。** Hierarchical 流程在每個專家呼叫之前都加一次經理 LLM 呼叫。一個五任務的 crew 就從五次 LLM 呼叫變成六次，而且那次經理呼叫還扛著完整任務清單加先前輸出。除非路由真的取決於輸出，否則換回 Sequential。
- **脆弱的交接。** 第 N 項任務的 `expected_output` 是「一份大綱」。第 N+1 項任務把它當成 `context` 讀進來，並試著解析出三個段落。LLM 產出了四個。下游的 Agent 就開始即興發揮。用第 N 項任務上的 `output_pydantic` 來修，讓第 N+1 項任務讀到的是具型別的物件，而不是自由文字。
- **拿 Crew 當生產。** 自由形式的 Crew 沒包 Flow 就出貨到生產。輸出變異度很高；重播不可能；值班的人沒辦法把一趟壞的執行跟一趟好的做 diff。用 Flow 包起來。

```figure
ae-crew-vs-flow
```

## 動手實作

`code/main.py` 用 stdlib 實作了兩種形狀，外加一個三代理 crew。

形狀：

- 對應 CrewAI 表面的 `Agent`、`Task` dataclass。
- `SequentialCrew.kickoff(inputs)` 按宣告順序跑任務，把輸出以 `context` 串下去。
- `HierarchicalCrew.kickoff(topic)` 加上一位經理 Agent，每輪挑下一位專家，在「done」時停下。
- `Flow`，帶 `@start` 與 `@listen(topic)` 裝飾器、一個很小的事件迴圈，以及一份軌跡。
- `tool(name)` 裝飾器，對應 CrewAI 的 `@tool` 形狀。
- `Memory`，含 `short_term`、`long_term`、`entity` 三種儲存；模擬的相似度用 numpy。
- 模擬的 LLM 回應是以「角色加輸入前綴」為鍵的硬寫字串。不連網。決定性。

具體示範：研究員、寫手、編輯組成的 crew，產出一份關於「agent engineering 2026」的摘要。研究員拉出（模擬的）來源。寫手起草。編輯收緊。同一個 crew 再跑一次 Flow 版本，用來展示決定性的形狀。

跑它：

```bash
python3 code/main.py
```

軌跡涵蓋：sequential crew 把輸出透過 `context` 串起來、hierarchical crew 與經理的選擇（研究員、寫手、編輯，然後「done」）、flow 用明寫的 topic（`researched`、`drafted`、`edited`）跑同樣三步、經由 `@tool` 路由的工具呼叫，以及跨兩次 kickoff 存活下來的長期記憶。

Crew 的軌跡是流動的；經理原則上可以重排順序。Flow 的軌跡是固定的。這個選擇就是本課的重點。

## 框架應用

- **CrewAI Flow** 給生產環境。就算那個 Flow 只有一步、而那一步就是呼叫 `Crew.kickoff()`，也一樣。Flow 給你那條稽核邊界。
- **CrewAI Crew（Sequential）** 給順序清楚的協作工作，尤其是初稿與審查迴圈。
- **CrewAI Crew（Hierarchical）** 給路由取決於輸出、而且你有四個以上專家的情況。
- **LangGraph**（第 13 課）給明寫的狀態機、持久續跑、嚴格順序。
- **AutoGen v0.4**（第 14 課）給演員模型的併發與故障隔離。
- **OpenAI Agents SDK**（第 16 課）給以 OpenAI 為先、需要 handoffs 與 guardrails 的產品。
- **Claude Agent SDK**（第 17 課）給以 Claude 為先、需要子代理與工作階段儲存的產品。

## 產出交付

`outputs/skill-crew-or-flow.md` 會替一項任務挑出 Crew 或 Flow，並搭出最小實作。對於沒有 backstory 的 Crew、沒有明寫 topic 的 Flow，以及專家少於三個的 Hierarchical，一律硬性拒絕。

## 常見陷阱

- **把 backstory 當成調味。** 它會形塑輸出。每個代理測三種變體；變異是真的。挑一個，凍住它。
- **跳過 `expected_output`。** 每項任務沒有契約，下游任務就會撿到 LLM 隨便產出的任何東西。Crew 跑得起來；稽核過不了。
- **記憶常開。** 長期記憶每趟都寫。向量 DB 一直長。檢索變吵。把寫入限縮到那些事實確實是持久的任務上。
- **經理提示詞漂移。** Hierarchical 的經理提示詞是隱含的。如果路由變怪，開 verbose 模式把它倒出來讀。
- **Crew 裡的工具副作用。** Crew 呼叫工具的次數可能比預期多。POST、DELETE、付款屬於 Flow 的步驟，絕不該當成 Crew 的工具。

## 練習

1. 把 Sequential crew 轉成 Flow。數一數變異度下降的接觸點有幾個。也記下可讀性在哪裡下降了。
2. 給這個 crew 加上實體記憶：關於某位客戶的事實要跨 kickoff 持久。驗證檢索拉出來的是對的實體。
3. 實作一個 Hierarchical 流程，讓經理在寫手的輸出不到三段之前，拒絕路由給編輯。把那次重試追出來。
4. 替一個（模擬的）網頁搜尋接上 `BaseTool` 子類別。跟 `@tool` 裝飾器版本比較軌跡形狀。
5. 給編輯任務加上 `output_pydantic=Brief`，其中 `Brief` 有 `title`、`summary`、`sections`。讓寫手任務有一次輸出畸形 JSON；在軌跡中驗證 CrewAI 的重試行為。
6. 讀 CrewAI 文件的導論。把這個玩具移植到真正的 `crewai` API。stdlib 版本跳過了哪些保證？
7. 對一趟真實執行接上 AgentOps 或 Langfuse（第 24 課）。stdlib 版本漏掉了哪些追蹤？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Agent | 「人設」 | 角色 + 目標 + backstory + 工具 |
| Task | 「工作單位」 | 描述 + 期望輸出 + 指派對象 + 選配的結構化輸出 |
| Crew | 「代理團隊」 | 裝 Agents + Tasks + Process 的容器 |
| Process | 「執行策略」 | Sequential／Hierarchical／Consensus（規劃中） |
| Flow | 「決定性的工作流」 | 事件驅動、由程式碼擁有、可測試 |
| Backstory | 「人設提示詞」 | 形塑 Agent 語氣與判斷力的東西 |
| `@tool` | 「函數工具」 | 把一個函數變成 Agent 可呼叫工具的裝飾器 |
| `BaseTool` | 「類別工具」 | 基於類別的工具，帶參數 schema、重試、非同步支援 |
| 實體記憶 | 「逐實體的事實」 | 範圍限定在某位客戶／帳號／議題的記憶 |
| 長期記憶 | 「跨執行的記憶」 | 由向量支撐、能在 kickoff 之間存活的記憶 |
| 脈絡式記憶 | 「即時檢索」 | 在 Agent 需要的那一刻才拉進來的記憶 |
| 經理 LLM | 「路由器代理」 | Hierarchical 流程中多出來、負責挑下一項任務的 LLM |
| `expected_output` | 「任務契約」 | 告訴 Agent（與稽核）該回傳什麼形狀的字串 |

## 延伸閱讀

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction)：概念與建議的生產路徑
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows)：事件驅動的形狀、`@start`、`@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools)：`@tool`、`BaseTool`、內建工具包
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory)：短期、長期、實體、脈絡式
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)：多代理何時有幫助、何時沒有
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)：狀態機那個替代方案
