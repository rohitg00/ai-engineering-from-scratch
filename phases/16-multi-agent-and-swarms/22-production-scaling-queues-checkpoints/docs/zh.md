# 生產擴展 —— 佇列、檢查點、持久性

> 把多代理系統擴展到數千個併發執行，需要**持久執行** —— 工作佇列加檢查點，好讓任何 worker 都能在任何崩潰之後接續任何一趟執行，前提是租約處理、冪等副作用與決定性重播都就位。LangGraph 的執行環境是那個參考範例：它在每個 super-step 之後以 `thread_id` 為鍵寫下一個檢查點（預設 Postgres）；worker 崩潰就釋出租約，由另一個 worker 接續。代理可以無限期沉睡以等待人類輸入。**MegaAgent**（arXiv:2408.09955）跑的是逐代理的生產者—消費者佇列，帶三種狀態（Idle／Processing／Response）與兩層協調（組內聊天 + 組間管理聊天）。對 LLM 串流而言，**Fiber／非同步**勝過每個工作一條執行緒：執行緒 99% 的時間都閒著等詞元，fiber 則在 I/O 上協作式讓出。反面觀點：Ashpreet Bedi 的〈Scaling Agentic Software〉主張**FastAPI + Postgres，其他什麼都不要**，直到負載證明有必要為止 —— 簡單架構走得比預期還遠。這一課建出一份持久檢查點日誌、一個帶狀態轉移的逐代理工作佇列、一份非同步對執行緒的示範，並把那條務實的「從簡單開始」規則落實下來。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib, `asyncio`, `sqlite3`)
**先修單元：** 階段 16 · 09（平行 Swarm 網路）、階段 16 · 13（共享記憶）
**時間：** 約 75 分鐘

## 問題

一套原型多代理系統，在一台筆電上用記憶體內事件迴圈跑三個代理，運作良好。你搬到生產環境：

- 代理有時會跑好幾個小時（長時間研究、等待人類介入）。
- Worker 行程會崩潰。重啟就丟掉狀態。
- 尖峰負載是平均的 10 倍；你需要水平擴展。
- 使用者按代理執行付費；你需要計費上的恰好一次語意。

記憶體內事件迴圈一項都做不到。你需要底下有一層持久執行。2026 年的典範選項是：

1. 帶檢查點的工作流引擎（Temporal、LangGraph 執行環境）。
2. 訊息佇列配一個狀態儲存（Postgres + SQS/RabbitMQ）。
3. 演員模型框架（MegaAgent 的逐代理生產者—消費者）。
4. 手搓的 FastAPI + Postgres（Bedi 的論點）。

這一課把每一種都做成縮影。

## 概念

### 持久執行，那個模式

一個持久執行引擎會在每個「步驟」（用 LangGraph 的語彙就是 super-step）之後持久化完整的程式狀態。崩潰時：

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

要讓這件事成立的需求：

- **可序列化的狀態。** 所有代理狀態都必須持久化得了。帶著活著的資料庫連線的函數閉包活不下來。
- **決定性的續跑。** 給定同樣的狀態與同樣的輸入，代理產出同樣的行動（或把 LLM 呼叫交給一個外部的決定性神諭）。
- **冪等的副作用。** 外部呼叫（工具呼叫、付款）必須是冪等的，或使用去重鍵。

LangGraph 在每個 super-step 之後寫檢查點；Temporal 在每個 activity 之後寫；Restate 使用事件溯源式的日誌。三者實作的是同一個模式。

### 一個逐步存檢查點的執行環境

LangGraph 的執行環境就是那個實作範例：每個代理有一個 `thread_id`；狀態是一個具型別的 dict；每個 super-step 都往 checkpoints 表寫一列。續跑時，執行環境從最後一個檢查點重播，而不是從頭開始。代理可以 `interrupt()` 以等待人類輸入；執行環境會持久化狀態並釋出 worker。輸入抵達時，任何 worker 都能續跑。

這是 2026 年 4 月那份參考的生產設計。

### MegaAgent 的逐代理佇列

arXiv:2408.09955 描述了一次規模實驗：一個叢集中數千個併發代理。架構：

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

那兩層協調讓組內對話可以密集地發生，而組間維持稀疏 —— 這正是讓成本在數千個代理上維持線性的模式。

### 非同步 vs 每個工作一條執行緒

LLM 呼叫是 I/O 受限的。一條在等下一個詞元的執行緒，99% 的時間都閒著。執行緒每條約 1MB RAM；在 10,000 個併發呼叫下，光是堆疊就要 10GB。

Fiber（Python 的 `asyncio`、Go 的 goroutine、Rust 的 `tokio`）在 I/O 上協作式讓出。同樣的 10,000 個呼叫在一個行程裡就綽綽有餘。在 LLM 代理的規模上，非同步不是一項最佳化 —— 它就是那個架構。

例外：CPU 受限的後處理（嵌入、分詞器技巧）仍然想要執行緒或行程。把你的 I/O 層與 CPU 層分開。

### Bedi 的反面觀點

〈Scaling Agentic Software〉（Ashpreet Bedi，2026）主張多數團隊在量測負載之前就過度工程了。務實的預設：

- FastAPI + Postgres。
- 每趟代理執行是一列；用樂觀併發就地更新狀態。
- 背景工作透過 `pg_notify` 或一個簡單的 Celery worker。
- 重試政策寫在應用程式碼裡。

對於約 100 個併發代理執行以下、任務可控的負載，這往往就是你需要的全部。等你量到它撐不住時再升級。

規則是：當你撞上簡單架構解不掉的具體問題時，才採用持久執行框架。過早採用會把時間燒在回報不了本的儀式上。

### 恰好一次語意

對付費的代理執行，你需要「效果上恰好一次」（至少一次投遞 + 冪等消費者）。工程上的做法：

- **每趟執行一把去重鍵。** 把它放進每一次副作用呼叫。
- **Outbox 模式。** 副作用先寫進一張表，再由另一個行程去執行它們。兩步都冪等。
- **補償交易。** 當副作用成功、但它的追蹤寫入失敗時，排一次補償。

這些是資料庫工程的模式，不是 LLM 專屬的。LLM 這邊多繳的稅只是「LLM 呼叫很慢」；其他都是標準的分散式系統。

### 彩虹式部署

Anthropic 的多代理研究系統使用「彩虹式部署」：多個版本的代理執行環境併行運作，好讓長時間執行的代理不必在每次部署程式碼時被砍掉。把新版本金絲雀放量到一部分流量；等舊版本上的代理跑完再讓它退役。

這對長時間執行的有狀態系統是標準做法；2026 年的調適在於代理可以活好幾個小時，所以部署週期必須配合。

### 那份典範的生產檢查清單

- 持久狀態（檢查點、快照，或 outbox + 可重播日誌）。
- 冪等的副作用。
- 給 LLM 呼叫用的非同步 I/O 層。
- 帶去重的至少一次投遞。
- 給有狀態工作負載用的彩虹／金絲雀部署。
- 可觀測性：逐代理軌跡、super-step 稽核、重試計數。

```figure
sw-checkpoint-replay
```

## 動手實作

`code/main.py` 實作了：

- `CheckpointStore` —— 以 SQLite 為底、以 thread-id 為鍵的檢查點日誌。每個 super-step 附加一列。
- `run_with_checkpoint(agent, thread_id)` —— 模擬執行到一半崩潰；由第二個 worker 從最後一個檢查點續跑。
- `AgentQueue` —— 逐代理的 Idle／Processing／Response 狀態機，帶一個小小的工作佇列。
- `demo_async_vs_threads()` —— 分別用 asyncio 與執行緒跑 500 個併發的模擬「LLM 呼叫」；回報牆鐘與尖峰記憶體（近似值）。

跑：

```
python3 code/main.py
```

預期輸出：模擬崩潰後檢查點續跑成功；非同步版本在 < 1 秒內處理完 500 個併發呼叫；執行緒版本要花好幾秒，而且每個併發單位用掉的記憶體高出好幾個數量級。

## 框架應用

`outputs/skill-scaling-advisor.md` 針對持久執行的選擇給建議：FastAPI + Postgres、LangGraph 執行環境、Temporal，或自製。依負載、狀態保留需求與部署頻率校準。

## 產出交付

典範的生產硬化：

- **從簡單開始（Bedi 的規則）。** FastAPI + Postgres，直到你量到它撐不住為止。
- **最佳化之前先把一切儀器化。** 逐執行的延遲直方圖、逐步耗時、重試次數、失敗分類。
- **副作用用 outbox 模式。** 尤其是付款與外部 API 呼叫。
- **彩虹式部署。** 部署時絕不砍掉進行中的代理執行。
- **在撞到特定問題時再採用持久執行引擎（Temporal／LangGraph／Restate）：** 長達數小時的 human-in-the-loop 等待、跨區協調、複雜的重試／補償政策。
- **I/O 層用非同步。** 執行緒只留給 CPU 受限的後處理。

## 練習

1. 跑 `code/main.py`。確認檢查點續跑有效；量測非同步與執行緒在併發上的差異。
2. 實作一張 **outbox** 表：每一次工具呼叫都先寫進 outbox，再由另一個 goroutine／task 去執行。把工具呼叫跑兩次來驗證冪等性。
3. 模擬一次**彩虹式部署**：兩個併行的執行環境版本；把新的 thread_id 一半路由到各一邊；確認舊版本上進行中的執行緒沒有被打斷。
4. 讀 LangGraph 的執行環境文件（下方連結）。指認出該執行環境中哪些功能，在手搓的 FastAPI + Postgres 版本裡最花時間重現。那是採用它的理由，還是你可以延後？
5. 讀 MegaAgent（arXiv:2408.09955）第 3 節。那兩層協調（組內 + 組間管理聊天）是明寫的。勾勒出你會怎麼把它對映到帶兩個佇列家族的訊息佇列上。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 持久執行 | 「把程式狀態持久化」 | 引擎在每個 super-step 之後寫狀態；崩潰復原是決定性的。 |
| Super-step | 「交易邊界」 | 檢查點之間的工作單位。LangGraph 的用語。 |
| thread_id | 「代理執行的識別碼」 | 綁定檢查點與續跑邏輯的那把鍵。 |
| 冪等性 | 「重試很安全」 | 重複執行副作用，結果跟只做一次一樣。 |
| Outbox 模式 | 「把副作用解耦」 | 把意圖寫進一張表；由另一個執行器去執行並標記完成。 |
| 至少一次投遞 | 「可能有重複」 | 訊息佇列的語意；去重鍵讓消費者效果上恰好一次。 |
| 彩虹式部署 | 「版本重疊」 | 長時間執行的工作負載期間，多個執行環境版本併行。 |
| 非同步 fiber | 「協作式讓出」 | 使用者態的併發；對 I/O 受限的負載，比執行緒便宜。 |
| 檢查點 | 「狀態快照」 | super-step 邊界上被序列化的狀態；續跑的關鍵。 |

## 延伸閱讀

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) —— LangGraph 執行環境的設計
- [MegaAgent](https://arxiv.org/abs/2408.09955) —— 逐代理的生產者—消費者佇列；數千個併發代理下的兩層協調
- [Matrix](https://arxiv.org/abs/2511.21686) —— 以訊息佇列作為協調基底的去中心化框架
- [Temporal docs](https://docs.temporal.io/) —— 持久執行的參考工作流引擎
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) —— 含彩虹式部署在內的生產教訓
