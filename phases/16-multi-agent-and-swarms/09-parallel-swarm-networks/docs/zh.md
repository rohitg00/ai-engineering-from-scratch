# 平行／Swarm／網路式架構

> 與 supervisor 對照：沒有中央決策者。代理讀一條共享的事件匯流排、非同步撿工作、把結果寫回去。LangGraph 明確支援「Swarm Architecture」，適用於去中心化、動態的環境。Matrix（arXiv:2511.21686）把控制流與資料流都表示成透過分散式佇列傳遞的序列化訊息，藉此消除編排者這個瓶頸。取捨是明擺著的：拿決定性與可追溯性換擴展性。Swarm 適合有很多獨立子問題的任務；它不適合需要一份單一連貫計畫的任務。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib, `threading`, `queue`)
**先修單元：** 階段 16 · 05（Supervisor 模式）、階段 16 · 04（原語模型）
**時間：** 約 75 分鐘

## 問題

Supervisor 擴展得到少數幾個 worker。那幾百個呢？supervisor 自己就變成瓶頸：關於誰做什麼的每一項決策，都經過同一個代理這個漏斗。一個很慢的規劃步驟就把整個系統卡住。

Swarm 架構把設計翻轉過來。不是由中央規劃者派工，而是由 worker 從共享佇列上撿工作。那份「協調」被烘進事件匯流排的語意裡。沒有編排者；系統一路擴展到佇列撐不住為止。

## 概念

### 那個形狀

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

沒有編排者。每個 worker 重複：拉一項任務、處理、寫結果（並選擇性地把後續工作入列）。

### Swarm 適合的時候

- **很多獨立任務。** 抓取、轉換、分類。任務彼此不相依。
- **時長不一的工作。** 若有些任務要 100 毫秒、有些要 10 秒，swarm 會自動平衡負載 —— 快的 worker 就去拉下一件。Supervisor 則必須事先預期時長。
- **吞吐量重於決定性。** 你在意的是總完成時間，不是嚴格的順序。

### Swarm 失敗的時候

- **有序的工作流。** 若第 3 步需要第 2 步的輸出，swarm 就有第 3 步在第 2 步完成前先觸發的風險。
- **需要全域計畫的任務。** 複雜的研究問題受益於規劃者。一群研究員 swarm 產出的是彼此獨立的事實，不是一份連貫的報告。
- **除錯。** 沒有中央日誌又是非同步工作，重現一個臭蟲很昂貴。

### Matrix（arXiv:2511.21686）

Matrix 是 2025 年那篇把 swarm 推到自然結論的論文：控制流與資料流都是分散式佇列上的序列化訊息。沒有中央協調者。容錯來自訊息的持久性。擴展性是訊息代理的問題，不是這個系統的問題。

貢獻：一套程式設計模型，讓多代理協調變成「這個代理訂閱哪個訊息主題？」，而不是「supervisor 接下來要挑哪個代理？」這讓系統看起來像一張發布／訂閱的事件網。

### 圖式框架裡的 swarm

LangGraph 2025 年的文件明確把「Swarm Architecture」描述成多代理模式之一：代理是節點，但邊構成一張帶環的有向圖，而且任何節點都可以從池子裡被啟動。Worker 依條件從可用工作中挑選，而不是靠 supervisor 指派。

### 失敗模式：飢餓與熱點

若所有 worker 都去拉「最快可完成」的任務，長時間執行的任務就永遠不會被撿走，直到它變成唯一剩下的為止。經典的佇列飢餓。

緩解：
- 帶明確老化機制的優先佇列（等待時間愈長優先度愈高）。
- Worker 特化：某些 worker 只接「長」任務。
- 背壓：限制有多少快任務能進到佇列。

### 與基於內容路由的連結

Swarm 天生就跟基於內容的路由（第 22 課）配得起來。與其用一條泛用佇列，不如每種訊息型別一條佇列。專家 worker 只訂閱自己那一型。這就是那些能擴展到數千個代理的訊息匯流排架構的基礎。

```figure
sw-work-stealing
```

## 動手實作

`code/main.py` 實作一個由 4 條 worker 執行緒組成、從一個共享 `queue.Queue` 拉工作的 swarm。任務時長不一（有快有慢）。這個示範做三方對照：

- **循序基線：** 一個 worker 串行處理所有任務。
- **固定指派：** 每項任務預先指派給某個特定 worker（supervisor 風格）。
- **Swarm：** worker 從共享佇列拉工作。

Swarm 自動平衡負載；固定指派則在某個 worker 被指派到慢任務時，讓快的 worker 閒著。

跑：

```
python3 code/main.py
```

輸出顯示逐 worker 的任務數（swarm 分布不平均但最佳）與牆鐘時間。

## 框架應用

`outputs/skill-swarm-fit.md` 評估一項任務該用 swarm 還是 supervisor。輸入：任務獨立性、時長變異、順序需求、可除錯性需求。

## 產出交付

檢查清單：

- **帶老化的優先佇列。** 防止長任務飢餓。
- **Worker 冪等性。** 若某個 worker 執行到一半崩潰，一項任務可能被拉超過一次。Worker 必須是冪等的。
- **持久佇列。** 生產環境要用 Kafka、Redis Streams，或以資料庫為底的佇列。`queue.Queue` 只在記憶體裡。
- **逐任務的可觀測性。** 每項任務都有一個 trace ID；每個 worker 都連同它記錄起訖。
- **背壓。** 若佇列長得比 worker 排空還快，就把生產者放慢。

## 練習

1. 跑 `code/main.py`。在這份時長不一的工作負載上，swarm 比循序快多少？比固定指派快多少？
2. 加一個優先佇列變體（用 `queue.PriorityQueue`）。依任務的「重要性」欄位指派優先度。觀察在持續負載下，低優先度任務會不會餓死。
3. 實作一個熱點偵測器：當任何 worker 處理的任務數是最慢 worker 的 3 倍時就記錄。那件事透露了什麼關於任務時長分布的資訊？
4. 讀 Matrix 論文（arXiv:2511.21686）的摘要與第 3 節。指認出 Matrix 接受的一項具體取捨（擴展性上的收穫），以及它放棄的一項（可追溯性、決定性）。
5. 把 swarm 示範改成使用 (task_type, payload) 元組的 `queue.Queue`，並讓 worker 只訂閱特定型別。當任務是異質的時候，什麼樣的路由規則才合理？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Swarm 架構 | 「去中心化的代理」 | Worker 從共享佇列拉工作；沒有中央編排者。 |
| 事件匯流排 | 「代理訂閱主題」 | 依型別或內容把任務路由給 worker 的訊息代理。 |
| 飢餓 | 「任務永遠不會跑」 | 低優先度任務因為高優先度工作持續湧入而永遠不被撿走。 |
| 熱點 | 「一個 worker 被淹沒」 | 負載不均，某個 worker 拿到大多數任務。 |
| 背壓 | 「把生產者放慢」 | 佇列滿時向上游示意停止生產的機制。 |
| 冪等 worker | 「重跑很安全」 | 一項任務被處理兩次會產出同樣的結果。因為 worker 可能執行到一半崩潰，所以是必要的。 |
| 持久佇列 | 「撐得過崩潰」 | 由磁碟或副本儲存支撐的佇列；worker 崩潰時任務不會遺失。 |
| Matrix 框架 | 「全訊息傳遞的 swarm」 | 資料流與控制流都是分散式佇列上的序列化訊息。 |

## 延伸閱讀

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 明確的 swarm 支援
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) —— 全訊息傳遞的 swarm
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) —— 某個特定生產系統為何明確選了 supervisor 而不是 swarm
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) —— 那次事件驅動的演員模型改寫，比 v0.2 的 GroupChat 更接近 swarm
