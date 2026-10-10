# Agent 框架選型權衡——圖、角色與 Actor 編排（Agent Framework Tradeoffs — Graph, Role, and Actor Orchestration）

> 每個框架都提供相同的示範（研究型 agent 自動生成研究報告），背後也都隱藏著相同的陷阱（狀態 Schema 與編排層之間的衝突）。挑選框架的標準，是其核心抽象層能否自然契合你問題的本質形態；除此以外的所有東西，都是你必須重複手寫兩遍的膠水程式碼。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## The Problem｜問題

你手上有一個需要多次呼叫 LLM 的複雜任務。它可能是研究調研工作流程（規劃、搜尋、摘要、引用）；它可能是程式碼審查管線（解析 diff、批判、產出修補程式、驗證測試）；它也可能是需要預訂機票、撰寫郵件與報銷費用的多輪日常助理。你興沖沖選用了一個現成框架。

三天後，你發現該框架的抽象層開始出現問題：CrewAI 賦予了你角色人設，但當「研究員」需要將結構化計畫交接給「寫作者」時，狀態傳遞很笨拙；AutoGen 讓多個 agent 彼此對話，卻缺乏一等公民的狀態管理，導致你所謂的檢查點只能是一份以 pickle 序列化的對話紀錄；LangGraph 賦予了你狀態圖，卻迫使你在還沒完全摸清 agent 行為模式前，就必須預先明確命名每一條條件轉移邊；Agno 提供了開箱即用的單一 agent 封裝，但當你試圖平行扇出到三個並行工作者時，抽象設計不易配合。

正確的工程思維不是盲目「挑選最強的框架」，而是將框架的核心抽象層與你的問題本質形態進行對齊匹配。本課為你繪製這張選型地圖。

## The Concept｜核心概念

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

2026 年的主流生態被四大框架所主導。它們的核心抽象概念並不相同：

| 框架名稱 | 核心抽象原語 | 最佳適用場景 | 最不適合的場景 |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph`——具型別狀態、節點（node）、條件邊、檢查點儲存器。 | 具備顯式狀態與人工介入中斷的工作流；需要時光旅行除錯的正式環境 agent。 | 拓撲結構未定、自由鬆散且由角色驅動的發散型頭腦風暴。 |
| **CrewAI** | `Crew`——角色人設（目標、背景故事）、任務清單、運作程序（循序或階層式）。 | 具備角色扮演或多重人設、任務規劃呈短鏈線性／階層式的工作流程。 | 超越團隊輪次歷史紀錄的深層狀態管理；複雜的條件動態分岔。 |
| **AutoGen** | `ConversableAgent` 成對互動——兩個或多個 agent 輪流對話，直至觸發終止條件。 | 多 agent 深度**對話**（師生問答、提案—批判、執行—審查），思考會從對話互動中湧現。 | 拓撲已知且確定性的 DAG 工作流；需要跨行程重啟的持久化狀態儲存。 |
| **Agno** | `Agent`——單一 LLM + 工具庫 + 記憶體，可彈性組合為小型團隊。 | 快速建構的獨立 agent 與輕量團隊；強大多模態支援與內建多種儲存驅動。 | 具備客製化歸約器、層級深邃且顯式分岔的複雜狀態圖。 |

### 「抽象層」究竟意味著什麼？

一個框架的核心抽象，正是當你向團隊簡報架構時，你在白板上親手畫出的那個圖形：

- **LangGraph** → 你在白板上畫出一張**圖（Graph）**。節點是具體步驟，邊是狀態轉移，每個點上的狀態物件皆具有型別。其心智模型是一座狀態機。
- **CrewAI** → 你在白板上畫出一張**組織架構圖（Org Chart）**。每個角色有職稱與職責描述，並由主管經理分派任務。其心智模型是一支各司其職的專家團隊。
- **AutoGen** → 你在白板上畫出一個 **Slack 私聊群組**。兩位 agent 彼此傳訊討論；若有需要，加入第三位 agent 擔任主持人。其心智模型是一場對話。
- **Agno** → 你在白板上畫出一個掛載各種工具的**單一盒子**。將盒子並排擺放即構成團隊。其心智模型是「內建完整功能的 agent」。

### 狀態管理的關鍵抉擇

在正式環境中，框架選擇最容易在狀態管理上出問題：

- **LangGraph**：具型別狀態（`TypedDict` 或 Pydantic 模型）、每欄位專屬歸約器、一等公民的檢查點儲存器（SQLite/Postgres/Redis）。接續重啟、人工介入與時光旅行開箱即用。（詳見 Phase 11 · 16）
- **CrewAI**：狀態透過 `context` 欄位以字串形式在任務間傳遞，或透過 `output_pydantic` 輸出結構化資料。未內建開箱即用的持久化團隊儲存庫；若團隊需在行程重啟後存活，必須自行加裝儲存層。
- **AutoGen**：狀態等同於聊天歷史紀錄以及使用者自訂的 `context`。對話文字能完整保留，但任意的複雜業務狀態則無法自動持久化，除非自行編寫適配器。
- **Agno**：透過 `storage=` 為 `Agent` 內建多種儲存驅動（SQLite、Postgres、Mongo、Redis、DynamoDB）——對話工作階段／以對話工作階段為範圍的狀態與使用者記憶自動持久化。其本質是工作階段儲存庫，而非完整的圖檢查點狀態機。

### 條件分岔的決策機制

任何複雜的 agent 皆需面臨路徑分岔。由誰來決定走向很重要：

- **LangGraph**——由**開發者決定**，透過條件邊實現。路由邏輯是傳回具名分岔目標的 Python 函式。分岔在編譯後的圖中是一等公民，檢查點會記錄走過哪條路徑。
- **CrewAI**——在階層模式下由**經理 Agent 決定**；在循序模式下由你在建置期靜態決定。路由隱含於任務清單中，在經理的 Prompt 之外缺乏一等公民的顯式條件控制。
- **AutoGen**——由各 Agent 透過**對話互動湧現決定**。分岔取決於由誰接續發言。由 `GroupChatManager` 挑選下一位發言者；你可自訂 `speaker_selection_method`，但預設由 LLM 驅動。
- **Agno**——由 Agent 透過**決定呼叫何種工具**來實現分岔。團隊具備協調者／路由器／協作者模式；超越該範疇的更深層分岔需由開發者自行承擔。

### 可觀測性生態整合

- **LangGraph**——透過 LangSmith 或任何標準 OTel 匯出器支援 OpenTelemetry。每一次節點轉移皆為獨立的追蹤 Span，檢查點同時身兼可重放的除錯軌跡。LangSmith 為原生的預設選擇，Langfuse/Phoenix 亦有專屬適配器。
- **CrewAI**——自 2025 年底起原生支援 OpenTelemetry；整合 Langfuse、Phoenix、Opik、AgentOps。
- **AutoGen**——透過 `autogen-core` 整合 OpenTelemetry；提供 AgentOps 與 Opik 連接器。追蹤粒度以「Agent 訊息」為單位，而非圖節點。
- **Agno**——內建 `monitoring=True` 旗標與 OpenTelemetry 匯出器；與 Langfuse 緊密整合，以記錄工作階段軌跡。

### 成本與延遲開銷

四大框架皆會引入額外的單次呼叫開銷（框架內部邏輯、校驗與序列化）。由低至高的開銷順序大致為：Agno ≈ LangGraph < CrewAI ≈ AutoGen。差異主要在於框架內部額外消耗了多少 LLM 路由 token。CrewAI 的階層式經理需消耗額外 token 思考下一步分派給誰；AutoGen 的 `GroupChatManager` 亦然。LangGraph 僅在你顯式撰寫 `llm.invoke` 之處消耗 token，Agno 的單 agent 路徑開銷也很低。

當每次執行的成本很重要時，請優先選擇顯式路由（LangGraph 條件邊、AutoGen 的 `speaker_selection_method`），而非全權放任 LLM 自由路由。

### 生態系互通性

- **LangGraph** ↔ **LangChain** 工具庫、檢索器與 LLM。原生支援一等公民 MCP 適配器（直接將外部工具作為 MCP 伺服器匯入）。
- **CrewAI** ↔ 工具繼承自 `BaseTool`；相容 LangChain、LlamaIndex 與 MCP 工具。透過 `allow_delegation=True` 支援團隊間委派。
- **AutoGen** → `FunctionTool` 可封裝任意 Python 可呼叫物件；提供 MCP 適配器。與 AG2 生態緊密耦合，以實現 agent 間通訊。
- **Agno** → 提供 `@tool` 裝飾器或繼承 BaseTool；支援 MCP 適配器；工具能在不同 agent 與團隊間自由共享。

## The Skill｜核心技能

> 能用一句話，清楚解釋為何某個框架最適合當前特定的 Agent 業務問題。

動手編碼前的決策檢核清單：

1. **繪製形態**。這是一張圖（具型別狀態、具名轉移）？一場角色扮演（專家之間遞交成果）？一場對話（agent 們交談直至收斂）？還是一個自帶工具的獨立單兵 agent？
2. **決定由誰控制路徑分岔**。開發者確定性掌控 → 選 LangGraph。經理 Agent 自主決策 → 選 CrewAI 階層模式。對話即興湧現 → 選 AutoGen。工具呼叫自主驅動 → 選 Agno。
3. **評估狀態管理預算**。是否需要自檢查點恢復執行？是否需要時光旅行？執行中途是否需等待人工審核？若答案為是，LangGraph 是預設選擇；若僅需以對話工作階段為範圍的狀態，Agno 足堪勝任。
4. **評估財務成本預算**。由 LLM 決策下一步由誰發言，每輪都會額外消耗 token。若該 agent 每日需執行數千次，請優先採用顯式路由。
5. **評估框架額外負擔**。每個框架都是一個額外的外部相依。若任務僅需兩次 LLM 呼叫搭配一個小工具，30 行純 Python 就能完成；沒有任何框架比「不依賴框架」更經濟、輕快且穩固。

在未能在白板上畫出圖、組織圖、對話流或單一盒子之前，不要引入框架。也不要挑選一個讓你為了實現真正需求，而不得不與其底層狀態模型纏鬥的框架。

## The Decision Matrix｜決策矩陣

| 問題本質形態 | 優先推薦框架 | 選型成因剖析 |
|---------------|---------------------|-----|
| 具備型別化狀態、人工介入審核、長生命週期的 DAG 工作流 | LangGraph | 具備一等公民的狀態管理／狀態、檢查點機制、中斷能力與時光旅行。 |
| 具備鮮明角色分工的調研／文章撰寫管線 | CrewAI（循序模式）或 LangGraph 子圖 | 任務配角色在 CrewAI 中表達很自然；若後續條件分岔變得複雜，可升級為 LangGraph。 |
| 提案—批判或師生問答的思維碰撞型雙向對話 | AutoGen | 雙 Agent 即時對話是其最原生的設計形態。 |
| 自帶工具、工作階段與記憶體的單兵獨立 Agent | Agno | 依賴最輕、整合最快，內建多種持久化儲存與記憶庫。 |
| 包含上千個平行扇出並需狀態合流的任務 | LangGraph + `Send` | 唯一具備一等公民平行分發 API 的框架。 |
| 快速驗證可行性，不想被特定框架綁定 | 純 Python + 服務供應商 SDK | 「無框架」通常是最快的做法。 |

```figure
l5-framework-fit
```

## Exercises｜練習

1. **基礎題**。針對同一項任務——「調研 Anthropic 總部地址、撰寫一份 200 字簡報並標註資料來源」——分別在 LangGraph（4 個節點：規劃、搜尋、撰寫、引用）與 CrewAI（3 個角色：研究員、作家、編輯）中各實作一套。記錄並比對兩者在單次執行下的 token 消耗量與程式碼行數。
2. **進階題**。在 AutoGen（研究員 ↔ 作家對話，編輯透過 `GroupChat` 加入）與 Agno（帶有 `search_tools` 與 `write_tools` 的單一 agent 搭配工作階段儲存）中分別實作相同任務。針對以下維度為全部 4 種實作進行綜合排名：(a) 單次執行成本、(b) 遇崩潰後的斷點接續能力、(c) 在撰寫步驟前注入人工審核確認的能力。
3. **挑戰題**。編寫一套決策樹指令碼 `pick_framework.py`，接收簡短的業務問題特徵描述（JSON 格式：`{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`），並回傳框架推薦建議與一句話成因剖析。設計 6 組涵蓋不同維度的測試案例驗證該指令碼的判斷準確性。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 編排（orchestration） | 「多個 Agent 怎麼協同運作」 | 負責決策下一個步驟該由哪個節點、角色或 Agent 執行的控制協調層 |
| 持久化狀態（Durable state） | 「伺服器重啟後能接續」 | 在行程被殺死後依然能在外部檢查點或儲存庫中留存的業務狀態 |
| LLM 決策路由（LLM-selected routing） | 「讓大模型自己看著辦」 | 由規劃模型在每輪對話中動態挑選下一步由誰接手；靈活，但每次決策皆需額外消耗 token |
| 顯式路由（Explicit routing） | 「由工程師預先寫死」 | 由 Python 路由函式或靜態圖連接邊決定下一步走向；成本低、可預期且便於審計 |
| Crew | 「CrewAI 的團隊」 | 將角色（Roles）、任務（Tasks）與運作程序（Process）封裝為單一可執行實體的最高層抽象 |
| GroupChat | 「AutoGen 的多人聊天室」 | 在 N 個 Agent 之間由發言挑選機制主持的受控對話 |
| Team (Agno) | 「Agno 的多 Agent 團隊」 | 在一組 Agent 之上執行的路由／協調／協作高階模式 |
| StateGraph | 「LangGraph 的核心狀態圖」 | 在編譯之前用於宣告型別化狀態、節點、條件邊與檢查點儲存器的建造者抽象 |

## Further Reading｜延伸閱讀

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) ——StateGraph、檢查點儲存器、中斷機制與時光旅行官方技術手冊
- [CrewAI documentation](https://docs.crewai.com/) ——Crews、Flows、Agents、Tasks 與 Processes 使用指南
- [AutoGen documentation](https://microsoft.github.io/autogen/) ——ConversableAgent、GroupChat、teams 與 tools 官方手冊
- [Agno documentation](https://docs.agno.com/) ——Agent、Team、Workflow、儲存驅動與記憶體架構
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) ——框架無關的五大高階模式庫（Prompt 串接、路由、平行化、編排器—工作者、評估器—最佳化器）
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) ——各大框架外層包裝所共同依賴的 ReAct 迴圈論文
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) ——AutoGen 的設計架構論文
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) ——史丹佛小鎮論文，為 CrewAI 等角色人設堆疊所依據的角色扮演理論基礎
- Phase 11 · 16 (LangGraph) ——本課作為比較基準的框架實作
- Phase 11 · 19 (Reflexion) ——在 LangGraph 中映射很自然但在 CrewAI 中稍顯彆扭的反思架構模式
- Phase 11 · 22 (Production observability) ——如何為你所挑選的任何框架加上可觀測性
