# ReWOO 與 Plan-and-Execute：解耦的規劃

> ReAct 把思考與行動交錯在同一條串流裡。ReWOO 把它們分開：先出一份大計畫，再執行。詞元少 5 倍、在 HotpotQA 上準確率 +4%，而且你可以把規劃器蒸餾進一個 7B 模型。Plan-and-Execute 把它一般化；Plan-and-Act 把它擴到網頁導航。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）
**時間：** 約 60 分鐘

## 學習目標

- 解釋為何 ReWOO 的 Planner／Worker／Solver 拆法，比 ReAct 的交錯迴圈更省詞元、也更穩健。
- 只用 stdlib 實作一張計畫 DAG、一個依相依序執行的執行器，以及一個把 worker 輸出組起來的求解器。
- 用 2026 年那套「五種工作流模式」的框架（Anthropic）來判斷一項任務該跑先規劃後執行、還是交錯式 ReAct。
- 認出何時長時程的網頁或行動任務需要 Plan-and-Act 那種合成計畫資料。

## 問題所在

ReAct 交錯的思考—行動—觀察迴圈簡單又有彈性，但每一次工具呼叫都得扛著完整的先前脈絡 —— 包括先前每一次思考。詞元用量隨深度呈平方成長。更糟的是：當某項工具在迴圈中途失敗，模型得從那段錯誤觀察裡把整份計畫重新推導一遍。

ReWOO（Xu 等人，arXiv:2305.18323，2023 年 5 月）注意到這點，並下了一個賭注：整件事先規劃好，平行抓證據，最後再把答案組出來。一次 LLM 呼叫做規劃、N 次工具呼叫取證據（可以平行）、一次 LLM 呼叫做求解。這筆交易是拿彈性（計畫是靜態的）換來好得多的詞元效率與更清楚的失敗模式。

## 核心概念

### 三種角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner 產出一張 DAG。每個節點指名一項工具、它的參數，以及它相依於哪些先前節點（像 `#E1`、`#E2` 這樣的參照）。Workers 依拓撲順序執行節點。Solver 再把所有東西縫起來。

### 為什麼詞元少 5 倍

ReAct 的提示詞長度隨步數線性成長。到第 10 步時，提示詞裡裝著思考 1 加行動 1 加觀察 1 加思考 2 加行動 2 加觀察 2，依此類推。每個中間步驟還冗餘地夾帶了原始提示詞。

ReWOO 付的是一份規劃器提示詞（大）、N 份小小的 worker 提示詞（每份就只有那次工具呼叫，沒有鏈條），加一份求解器提示詞。在 HotpotQA 上，論文量到約少 5 倍的詞元，同時準確率絕對值高 4 分。

### 為什麼它更穩健

在 ReAct 裡，如果 worker 3 失敗，迴圈得在串流中途推理著脫困。在 ReWOO 裡，worker 3 回傳一段錯誤字串；求解器會連同原始計畫一起在脈絡中看到它，並能優雅降級。失敗定位是逐節點的，不是逐步的。

### 規劃器蒸餾

論文的第二項結果：因為規劃器看不到觀察，你可以拿一個 175B 教師模型的規劃器輸出，去微調一個 7B 模型。小模型負責規劃；推論時不需要大模型。這如今已是標準做法 —— 2026 年許多生產代理用小規劃器配大執行器，或反過來。

### Plan-and-Execute（2023）

LangChain 團隊 2023 年 8 月那篇貼文，把 ReWOO 一般化成一個模式名稱：Plan-and-Execute。前置規劃器吐出一份步驟清單、執行器逐步跑、選配的重規劃器可以在觀察到結果後修訂。這比 ReWOO 更靠近 ReAct（重規劃器把觀察帶回規劃裡），但保住了省詞元的好處。

### Plan-and-Act（Erdogan 等人，arXiv:2503.09572，ICML 2025）

Plan-and-Act 把這套模式擴到長時程的網頁與行動代理。關鍵貢獻是合成計畫資料：一個有標註的軌跡產生器，做出計畫是明寫的訓練資料。它被用來微調規劃器模型，讓它們在 WebArena 這類任務上跨過 30–50 步之後還能運作，而單一條 ReAct 軌跡在那裡早就失去連貫。

### 什麼時候挑哪個

| 模式 | 何時 |
|---------|------|
| ReAct | 短任務、環境未知、需要反應式的例外處理 |
| ReWOO | 工具已知的結構化任務、對詞元敏感、證據可平行 |
| Plan-and-Execute | 像 ReWOO，但在部分執行後會重規劃 |
| Plan-and-Act | 長時程（>30 步）、網頁／行動／computer-use |
| Tree of Thoughts | 搜尋值得花那筆錢時（第 04 課） |

Anthropic 2024 年 12 月的指引：從最簡單的開始。如果任務是一次工具呼叫加一段摘要，別去蓋 ReWOO。如果任務是一份 40 步的研究作業，別只用 ReAct。

```figure
rewoo-plan
```

## 動手實作

`code/main.py` 實作一個玩具版 ReWOO：

- `Planner` —— 一份腳本化的策略，從提示詞吐出一張計畫 DAG。
- `Worker` —— 透過註冊表分派每個節點的工具呼叫。
- `Solver` —— 腳本化的組合，讀證據並產出最終答案。
- 相依解析 —— 像 `#E1` 這樣的參照會被代換成先前 worker 的輸出。

這個示範用一份兩步計畫回答「法國首都的人口是多少，取到百萬位？」：(1) 查首都、(2) 查人口，然後求解。

跑它：

```
python3 code/main.py
```

軌跡先顯示完整計畫，再顯示 worker 結果，最後顯示求解器的組合。把詞元數（我們印出一個粗略的字元計數）拿去跟 ReAct 式的交錯執行比較 —— 在這類結構化任務上，ReWOO 勝出。

## 框架應用

LangGraph 把 Plan-and-Execute 當成一份食譜出貨（ReAct 用 `create_react_agent`，plan-execute 用自訂圖）。CrewAI 的 Flows 直接把這套模式編碼進去：你先定義好任務，Flow 的 DAG 就去執行它們。Plan-and-Act 那套合成資料的做法目前大致仍屬研究；而執行期的模式（明寫的計畫 DAG）已經透過 LangGraph 與 CrewAI Flows 在生產環境出貨。

## 產出交付

`outputs/skill-rewoo-planner.md` 會在給定一份工具目錄的前提下，從使用者請求產出一張 ReWOO 計畫 DAG。它會在交給執行器之前驗證這份計畫（無環、每個參照都解析得到、每項工具都存在）。

## 練習

1. 讓相互獨立的計畫節點平行執行。在一張有 2 個平行群組的 6 節點 DAG 上，這替你換到了什麼？
2. 加一個重規劃器節點，只要任何 worker 回傳錯誤就觸發。把 ReWOO 變成 Plan-and-Execute 的最小改動是什麼？
3. 把 `Planner` 換成小模型（7B 等級），`Solver` 留在前沿模型上。比較端到端品質 —— 這種拆法在哪裡失效？
4. 讀 ReWOO 論文第 4 節談規劃器蒸餾的部分。概念上重現 175B -> 7B 那個結果：你需要什麼訓練資料，又要怎麼替計畫品質評分？
5. 把這個玩具移植到 Plan-and-Act 的軌跡形狀：計畫是一個序列，不是 DAG。有哪些取捨變了？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| ReWOO | 「不看觀察的推理」 | 先規劃、再平行取證據、最後求解 —— 規劃提示詞裡沒有觀察 |
| Plan-and-Execute | 「LangChain 那套 plan-execute」 | ReWOO 加上執行後一個選配的重規劃器節點 |
| Plan-and-Act | 「放大版的 plan-execute」 | 明寫的規劃器／執行器拆分，配上長時程任務用的合成計畫訓練資料 |
| 證據參照 | 「#E1、#E2、……」 | 計畫節點裡的佔位符，在分派時代換成先前 worker 的輸出 |
| 規劃器蒸餾 | 「小規劃器、大執行器」 | 拿大教師模型的規劃器軌跡去微調一個小模型 |
| 詞元效率 | 「更少來回」 | 論文中在 HotpotQA 上比 ReAct 少 5 倍詞元 |
| DAG 執行器 | 「拓撲分派器」 | 依相依順序跑計畫節點；同一層可平行 |

## 延伸閱讀

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) —— 那篇典範論文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) —— 配上合成計畫、放大後的規劃器—執行器
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) —— 框架版的食譜
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 挑能奏效的最簡單模式
