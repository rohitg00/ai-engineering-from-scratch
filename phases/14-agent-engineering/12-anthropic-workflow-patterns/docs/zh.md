# Anthropic 的工作流模式：簡單優於複雜

> Schluntz 與 Zhang（Anthropic，2024 年 12 月）把工作流（預先定義的路徑）與代理（動態的工具使用）區分開來。五種工作流模式涵蓋多數情況。從直接 API 呼叫開始。只有在步驟無法預測時，才加上代理。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）
**時間：** 約 60 分鐘

## 學習目標

- 說出 Anthropic 的五種工作流模式：提示詞串接、路由、平行化、orchestrator-workers、evaluator-optimizer。
- 解釋代理與工作流的分野，以及各自的工程成本。
- 指認出何時該挑工作流而非代理（以及反過來）。
- 用 stdlib 對著一個腳本化 LLM 實作全部五種模式。

## 問題所在

團隊常為了一個只需要單次函數呼叫的問題，伸手去拿多代理框架。代價是真實的：框架加上的那些層會遮蔽提示詞、藏起控制流，並招來過早的複雜度。Schluntz 與 Zhang 2024 年 12 月那篇貼文是業界被引用最多的一次反推：從簡單開始，只有當複雜度掙得回它的成本時才加上去。

## 核心概念

### 工作流 vs 代理

- **工作流。** LLM 與工具被編排在預先定義的程式路徑裡。工程師擁有那張圖。
- **代理。** LLM 動態地指揮自己的工具、走自己的步驟。模型擁有那張圖。

兩者都有立足之地。工作流比較便宜、比較快、也比較好除錯。代理解鎖開放式問題，但讓失敗模式更難推敲。

### 增強型 LLM

五種模式的共同地基：一個 LLM 接上三種能力 —— 搜尋（檢索）、工具（行動）、記憶（持久性）。任何一次 API 呼叫都可以用上它們。

### 五種模式

1. **提示詞串接。** 第 1 次呼叫的輸出是第 2 次呼叫的輸入。當任務有乾淨的線性分解時使用。步驟之間可選擇性加上程式化的閘門。

2. **路由。** 一個分類器 LLM 挑出要調用哪個下游 LLM 或工具。當類別上不同的輸入需要不同處理時使用（一線客服 vs 退款 vs 臭蟲 vs 業務）。

3. **平行化。** 併發跑 N 次 LLM 呼叫，再彙整結果。兩種形狀：切段（不同區塊）與投票（同一段提示詞、跑 N 次、取多數或做綜合）。

4. **Orchestrator-workers。** 一個編排者 LLM 動態決定要跑哪些 worker（也是 LLM），並綜合它們的輸出。跟代理迴圈相似，但編排者不會無限迴圈。

5. **Evaluator-optimizer。** 一個 LLM 提出答案，另一個 LLM 評估它。反覆迭代直到評估器通過。這是 Self-Refine（第 05 課）的一般化。

### 工作流勝過代理的地方

- **可預測的任務。** 如果你列得出步驟，那就該列出來。
- **成本受限的任務。** 工作流的步數有界；代理則可能螺旋失控。
- **法遵受限的任務。** 稽核者想讀那張圖，不想從軌跡去推斷它。

### 代理勝過工作流的地方

- **開放式研究。** 當下一步取決於上一步回傳了什麼。
- **長度不定的任務。** 幾分鐘到幾小時的工作，步數未知。
- **新穎領域。** 當你還不知道正確的工作流是什麼 —— 先探索，之後再編纂。

### 脈絡工程這位同伴

〈Effective context engineering for AI agents〉（Anthropic，2025）把這門相鄰學科形式化了：那 200k 視窗是一筆預算，不是一個容器。該放什麼進去、何時壓實、何時讓脈絡長大。細節見階段 14 談脈絡壓縮的那一課（在本課程重新編號之前，是階段 14 較前面的第 06 課）。

```figure
workflow-chain
```

## 動手實作

`code/main.py` 對著一個 `ScriptedLLM` 實作全部五種工作流模式：

- `prompt_chain(input, steps)` —— 循序。
- `route(input, classifier, handlers)` —— 分類 + 分派。
- `parallel_vote(prompt, n, aggregator)` —— 跑 N 次、彙整。
- `orchestrator_workers(task, workers)` —— 編排者挑 worker。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` —— 迴圈直到通過。

跑它：

```
python3 code/main.py
```

每種模式都會印出自己的軌跡。每種模式的程式碼約 10-15 行；一個框架的成本則是以千行計的。

## 框架應用

- 多數任務用直接 API 呼叫。
- 只有當那個模式真的需要持久狀態（LangGraph）、演員模型的併發（AutoGen v0.4），或角色樣板（CrewAI）時才用框架。
- 當你想要 Claude Code 那種執行環境形狀、又不想重蓋一次時，就伸手拿 Claude Agent SDK。

## 產出交付

`outputs/skill-workflow-picker.md` 會替給定的任務描述挑出正確的模式，附上決策理由，以及萬一工作流不夠用時、改寫成代理的路徑。

## 練習

1. 實作帶信心門檻的路由。低於門檻 -> 升級給人。對一線客服的使用情境來說，那個門檻會落在哪裡？
2. 給 `parallel_vote` 加上逾時。當某次呼叫卡住時會發生什麼事？票數缺漏時你要怎麼彙整？
3. 把 `evaluator_optimizer` 變成一個 bandit：跨迭代保留最好的 2 個輸出，這樣後來一個好結果就不會被後來一個壞結果覆蓋掉。
4. 把提示詞串接跟路由結合：一個路由器從三條鏈裡挑一條。量它相對於「單一大提示詞」方案的詞元成本。
5. 挑一項你手上的生產功能。畫出它的工作流圖。數步數。在這裡換成代理真的會比較好嗎？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 工作流 | 「預先定義的流程」 | 由工程師擁有的 LLM 與工具呼叫之圖 |
| 代理 | 「自主 AI」 | 由模型擁有的圖；動態地指揮工具 |
| 增強型 LLM | 「帶工具的 LLM」 | LLM + 搜尋 + 工具 + 記憶；那個原子單位 |
| 提示詞串接 | 「循序呼叫」 | 第 N 次呼叫的輸出是第 N+1 次呼叫的輸入 |
| 路由 | 「分類器分派」 | 挑出由哪條鏈／哪個模型來處理該輸入 |
| 平行化 | 「扇出」 | N 次併發呼叫；以切段或投票彙整 |
| Orchestrator-workers | 「分派者代理」 | 編排者 LLM 動態挑出專家 LLM |
| Evaluator-optimizer | 「提議者 + 裁判」 | 迭代到評估器通過；Self-Refine 的一般化 |

## 延伸閱讀

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) —— 那五種工作流模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 那門同伴學科
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 有狀態的圖何時掙得回它的成本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 產品化後的 orchestrator-workers 模式
