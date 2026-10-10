# Agent 狀態機——圖、節點與檢查點（Agent State Machines — Graphs, Nodes, Checkpoints）

> 純手寫的 ReAct 迴圈本質上就是一個 `while True`。而將同一個迴圈以顯式的圖（Graph）形式表達，它就進化成了可設定檢查點（checkpoint）、隨時中斷（interrupt）、支援多路分岔與時光旅行的本課採用的心智模型，直接取自官方文件。Agent 的核心能力並未改變，改變的是包覆在它外層的調度框架。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 14 (Model Context Protocol)
**Time:** ~75 minutes

## The Problem｜問題

你部署了一個具備函式呼叫能力的 agent。它流暢運作了三輪對話，接著意外降臨：模型呼叫了一個回傳 500 錯誤的工具、使用者在中途改變了心意，或者 agent 在未經人工核准的情況下逕自為訂單執行了退款操作。純手寫的 `while True:` 迴圈毫無攔截掛鉤可言：你無法暫停它、無法倒帶回溯，更無法分岔去探索「如果模型當時選了另一個工具會如何」。一旦這套系統走出展示 Demo 進入真實世界，它便淪為一個要嘛完全成功、要嘛徹底崩潰的黑盒子。

一旦你看清了本質，下一步的演進便理所當然：Agent 本身早已是一座狀態機——系統提示 + 訊息歷史 + 待處理工具呼叫 + 下一步行動。將這座狀態機顯式化：定義代表「模型思考」、「工具執行」、「人工審批」的**節點（Nodes）**，以及代表它們之間條件轉移的**邊（Edges）**。一旦計算圖被顯式宣告，調度框架便能免費解鎖四大超能力：檢查點（步驟間狀態持久化）、中斷機制（暫停等待人工審核）、串流分發（逐字串流 token 與中間事件），以及時光旅行（回滾至先前狀態並探索不同分岔路徑）。

這項抽象概念的標準實作範本正是 LangGraph。它絕非傳統 LangChain 意義下那種「丟給你一個 AgentExecutor，祝你好運」的黑盒子封裝，而是一套將狀態、持久化儲存與中斷機制視為一等公民的圖執行期執行引擎（Graph Runtime）。Agent 迴圈變成了由你親自繪製的計算圖，而非在程式碼中寫死的一行行迴圈。

## The Concept｜核心概念

![LangGraph StateGraph: nodes, edges, and the checkpointer](../assets/langgraph-stategraph.svg)

一個 `StateGraph` 由三大核心要素構成：

1. **狀態（State）**：在圖中流轉的型別化字典（TypedDict 或 Pydantic 模型）。每個節點接收全量狀態並回傳局部增量更新，LangGraph 依據各欄位設定的**歸約器（Reducer）**進行合併——例如針對需要累積保留的訊息清單使用 `operator.add`，其餘欄位預設為覆寫。
2. **節點（Nodes）**：函式簽章（function signature）為 `state -> partial_state` 的 Python 函式。每個節點代表一個離散的執行步驟：「呼叫模型」、「執行工具」、「產生摘要」。
3. **邊（Edges）**：節點之間的流轉轉移。靜態邊直接指向固定目標；條件邊（conditional edge）則接受一個路由函式 `state -> next_node_name`，使計算圖能根據模型的輸出動態分岔。

你編譯該計算圖。Compile 動作鎖定圖的拓撲結構、掛載檢查點儲存器（Checkpointer，對正式環境至關重要），並回傳一個可執行的 Runnable 實體。你在呼叫時傳入初始狀態與一個專屬的 `thread_id`。執行的每一個步驟，皆會自動持久化儲存一筆以 `(thread_id, checkpoint_id)` 為鍵值的檢查點快照（snapshot）。

### 四大超能力

**檢查點機制（Checkpointing）**：每一次節點轉移皆會將全新狀態寫入持久化儲存庫（測試環境用記憶體，正式環境用 Postgres/Redis/SQLite）。藉由帶入相同的 `thread_id` 再次呼叫圖即可隨時恢復執行，計算圖會精確從上次暫停處接續運作。

**中斷機制（Interrupts）**：為節點標註 `interrupt_before=["human_review"]`，執行流程便會在該節點執行前安全暫停，當前狀態完整持久化。你的 API 能從容回傳給使用者「等待人工審核中」；後續請求帶著相同的 `thread_id` 並附帶 `Command(resume=...)`，即可無縫恢復執行。

**串流分發（Streaming）**：`graph.stream(state, mode="updates")` 能在狀態增量（state delta）發生的瞬間即時產出事件；`mode="messages"` 能逐字串流模型節點內部的 LLM token；`mode="values"` 則在每一步產出完整的狀態快照。你能依據前端 UI 的需求自由挑選。

**時光旅行（Time-travel）**：`graph.get_state_history(thread_id)` 能回傳完整的檢查點歷史日誌。將任何過往的 `checkpoint_id` 傳入 `graph.invoke`，即可從該歷史節點直接分岔出全新執行線。這在除錯（「如果模型當時選了工具 B 會怎樣？」）以及重放線上日誌的回歸測試中極為強大。

### 歸約器才是關鍵核心

狀態中的每個欄位皆需依賴歸約器（Reducer）。多數純文字或數值的預設行為很合適——新值直接覆寫舊值。但對話訊息清單必須採用 `operator.add`，新訊息才能以附加（append）而非覆蓋的方式保留。平行分岔路徑在合流時同樣透過歸約器合併更新。若兩個節點同時更新 `messages`，而你忘記標註 `Annotated[list, add_messages]`，後者將無聲覆蓋前者，導致你丟失半輪對話紀錄。歸約器是這套框架中唯一微小卻極其關鍵的概念；把它搞對，其餘架構皆能順理成章優雅組合。

### 4 個節點實現的 ReAct 圖

一個生產級的 ReAct agent 僅需 4 個節點與 2 條邊即可成型：

1. `agent`——以當前的對話訊息歷史呼叫 LLM，回傳助理訊息（其中可能包含工具呼叫 tool_calls）。
2. `tools`——執行上一個助理訊息中的所有 tool_calls，並將工具回傳結果作為工具訊息附加至清單。
3. 一條自 `agent` 出發的條件邊：若最新訊息包含 tool_calls 則路由至 `tools`，否則流向 `END` 終點。
4. 一條自 `tools` 流回 `agent` 的靜態邊。

僅此而已。你用了大約 40 行程式碼，就建構出了具備完整檢查點、人工中斷與串流能力的完整 ReAct 迴圈（Thought → Action → Observation → Thought → …）。

### StateGraph vs Send（扇出 fanout）

`Send(node_name, state)` 允許節點平行分發多個子圖（subgraph）任務。例如：agent 決定同時向三個檢索器發起查詢。每一次 `Send` 皆會針對目標節點啟動一個獨立的平行執行個體，各路輸出最後透過狀態歸約器安全合流。這正是 LangGraph 在不需手寫複雜多執行緒原語的前提下，優雅表達編排器—工作者（Orchestrator-Workers）模式的秘訣。

### 子圖

編譯後的圖本身也能作為另一個大圖中的單一節點。外層圖將其視為黑盒子步驟，內層子圖則擁有自己專屬的獨立狀態與檢查點命名空間。這正是打造督導者—工作者（Supervisor-Worker）階層式 Agent 系統的標準架構：督導圖負責分析使用者意圖，並將任務分派給各專業領域的子圖獨立消化。

```figure
l5-state-graph-ledger
```

## Build It｜動手實作

### 步驟 1：狀態與節點定義

```python
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

def agent_node(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: State) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

tool_node = ToolNode(tools=[search_web, read_file])

graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")

app = graph.compile(checkpointer=MemorySaver())
```

其中 `add_messages` 扮演累加歸約器的關鍵角色，確保訊息清單持續增長而非被整份覆寫。遺漏它是初學者最常踩的 LangGraph 大坑。

### 步驟 2：帶有 Thread 執行圖

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

每個事件皆為 `{node_name: state_delta}` 的增量字典。你的前端能直接將這些事件即時串流反映至使用者畫面上，例如呈現「Agent 正在思考……正在呼叫 search_web……取得搜尋結果……整理答案中」。

### 步驟 3：加入真人介入中斷機制

標記特定節點，使程式碼在該節點被執行之前自動安全暫停：

```python
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["tools"],  # pause before every tool call
)

state = app.invoke({"messages": [HumanMessage("delete the production database")]}, config)
# state["__interrupt__"] is set. Inspect proposed tool calls.
# If approved:
from langgraph.types import Command
app.invoke(Command(resume=True), config)
# If denied: write a rejection message and resume
app.update_state(config, {"messages": [AIMessage("Blocked by human reviewer.")]})
```

當前狀態、檢查點紀錄與 Thread ID 在中斷期間完整持久化於外部儲存中，在等待審批期間完全不佔用任何行程記憶體。

### 步驟 4：用於除錯的時間旅行

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# Fork from a prior checkpoint
target = history[3].config  # three steps back
for event in app.stream(None, target, stream_mode="values"):
    pass  # replay from that point forward
```

傳入 `None` 作為輸入會精準從給定的歷史檢查點重放；傳入一個值則會在該檢查點狀態上附加增量後再接續重跑。這讓你能重現某次糟糕的 Agent 執行歷程，而無需重新執行整場完整對話。

### 步驟 5：在正式環境中替換檢查點儲存庫

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

官方已開箱支援 SQLite、Redis 與 Postgres。`MemorySaver` 僅供測試之用；任何需要在伺服器重啟後依然保留狀態的正式服務，皆應配置真實的外部資料庫儲存。

## The Skill｜核心技能

> 將 Agent 建構為狀態圖，而非死板的 `while True` 迴圈。

在動手編寫 LangGraph 之前，請先進行 60 秒的架構設計：

1. **命名所有節點**。每一個獨立的決策或具備副作用的操作皆應獨立成節點。「Agent 思考」、「工具執行」、「審核員審批」、「串流回應」。若無法具體列舉，代表任務尚未被拆解為適合 Agent 的形態。
2. **宣告明確的狀態模型**。定義精簡的 TypedDict，並為每個清單欄位指派專屬歸約器。不要把所有內容塞進 `messages`；將任務專屬的欄位（如當前執行的 `plan`、`budget` 計數器、`retrieved_docs` 檢索文件清單）提升至最外層獨立存放。
3. **繪製連接邊**。預設皆為靜態邊，除非下一步的走向依賴於模型輸出的內容。每一條條件邊都必須綁定具備具名分岔目標的路由函式。
4. **預先決定檢查點儲存方案**。本機單元測試用 `MemorySaver`，其餘情境一律採用 Postgres/Redis/SQLite。絕不發布沒有檢查點的系統——沒有檢查點意味著失去接續執行、人工介入與時間旅行的能力。
5. **在工具執行前設定中斷，而非在執行後**。審批攔截必須設在通往副作用節點的邊上，以便在危害發生前取消操作；資料校驗則設在模型輸出的邊上，以便能以最低成本攔截錯誤呼叫。
6. **預設啟用串流傳輸**。前端 UI 採用 `mode="updates"`，模型節點內部採用 `mode="messages"` 實現逐字串流，離線評估時則採用 `mode="values"` 檢視全量狀態快照。

絕不要交付沒有檢查點儲存器的 LangGraph 系統；絕不要交付在副作用發生**之後**才觸發中斷的危險系統；絕不要交付未宣告 `add_messages` 歸約器的 `messages` 欄位。

## Exercises｜練習

1. **基礎題**。實作上述包含計算機與網路搜尋工具的 4 節點 ReAct 圖。驗證在一場 2 輪對話中，`list(app.get_state_history(config))` 能正確回傳至少 4 個歷史檢查點。
2. **進階題**。新增一個在 `agent` 前執行的 `planner` 節點，並在狀態中寫入結構化的 `plan: list[str]`。指示 `agent` 將已完成的步驟標記為 done。若在檢查點恢復執行時 `plan` 發生丟失（因歸約器配置錯誤），測試應自動報錯。
3. **挑戰題**。建構一個透過 `Send` 在三個子圖（`researcher` 調研、`writer` 寫作、`reviewer` 審查）之間進行路由的督導者圖。每個子圖皆擁有自己獨立的狀態與檢查點。在外層圖加上 `interrupt_before=["writer"]`，使人類能在寫作開始前審核調研簡報。驗證從過往檢查點分岔重放時，系統僅重新執行被分岔的路徑。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| StateGraph | 「LangGraph 的那張圖」 | 在編譯之前用於新增節點與邊的建造者（Builder）物件 |
| 歸約器（Reducer） | 「欄位如何合併」 | 當節點回傳該欄位的增量更新時所套用的 `(old, new) -> merged` 函式；預設為覆寫，`add_messages` 為累積追加 |
| Thread | 「對話 Session ID」 | 用於在儲存層界定單一工作階段所有相關檢查點範圍的 `thread_id` 字串 |
| 檢查點（Checkpoint） | 「暫存狀態快照」 | 節點轉移完成後整張圖狀態的持久化快照，以 `(thread_id, checkpoint_id)` 為索引鍵 |
| 中斷（Interrupt） | 「暫停等真人確認」 | `interrupt_before` / `interrupt_after` 在節點邊界處暫停執行；後續使用 `Command(resume=...)` 接續運作 |
| 時光旅行（Time-travel） | 「從舊歷史重開一條線」 | 透過 `graph.invoke(None, config_with_old_checkpoint_id)` 從特定歷史檢查點分岔並向後重放 |
| Send | 「平行分發多個子任務」 | 節點可回傳的建構子，用於平行分發並執行 N 個目標節點的運算實例 |
| 子圖（Subgraph） | 「圖裡面的小圖」 | 編譯後被作為另一個圖中單一節點引用的 StateGraph；保全自己完全獨立的狀態作用域 |

## Further Reading｜延伸閱讀

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) ——StateGraph、歸約器、檢查點儲存器與中斷機制的權威官方手冊
- [LangGraph concepts: state, reducers, checkpointers](https://langchain-ai.github.io/langgraph/concepts/low_level/) ——本課採用的心智模型架構原創技術解析
- [LangGraph Persistence and Checkpoints](https://langchain-ai.github.io/langgraph/concepts/persistence/) ——關於 Postgres/SQLite/Redis 儲存庫、檢查點命名空間與 Thread ID 的深度細節
- [LangGraph Human-in-the-loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) ——`interrupt_before`、`interrupt_after`、`Command(resume=...)` 與狀態手動編輯模式指南
- [Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (ICLR 2023)](https://arxiv.org/abs/2210.03629) ——所有 LangGraph Agent 所實作的核心 ReAct 架構模式原創論文
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) ——如何評估何時採用鏈式、路由式、編排器—工作者或評估器—最佳化器等圖拓撲
- Phase 11 · 09 (Function Calling) ——每個 LangGraph Agent 節點底層重複使用的工具呼叫核心原語
- Phase 11 · 14 (Model Context Protocol) ——透過 MCP 轉接器接入 LangGraph `ToolNode` 的外部標準化工具探索機制
- Phase 11 · 17 (Agent framework tradeoffs) ——探討何時該選用 LangGraph，何時該選用 CrewAI、AutoGen 或 Agno 的選型權衡
