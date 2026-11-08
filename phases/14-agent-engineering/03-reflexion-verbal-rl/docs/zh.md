# Reflexion：語言式強化學習

> 基於梯度的 RL 要修好一個失敗模式，得跑上千次試驗、配一整座 GPU 叢集。Reflexion（Shinn 等人，NeurIPS 2023）用自然語言做到：每次試驗失敗後，代理寫下一段反思、存進情節記憶，並讓下一次試驗以那份記憶為條件。這就是 Letta 的 sleep-time compute、Claude Code 的 CLAUDE.md 學習紀錄，以及 pro-workflow 的 learn-rule 背後的模式。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 02（ReWOO）
**時間：** 約 60 分鐘

## 學習目標

- 說出 Reflexion 的三個組件（Actor、Evaluator、Self-Reflector），以及情節記憶的角色。
- 用 stdlib 實作一個 Reflexion 迴圈，含二元評估器、反思緩衝區與全新的重試。
- 針對給定任務，在純量式、啟發式與自評式回饋來源之間做選擇。
- 解釋為何語言式強化能抓到那些基於梯度的 RL 得跑上千次試驗才修得掉的錯誤。

## 問題所在

代理把一項任務搞砸了。在標準 RL 裡，你會再跑上千次試驗、算梯度、更新權重。既貴又慢，而且多數生產代理並沒有替每一次失敗都準備一筆訓練預算。

Reflexion（Shinn 等人，arXiv:2303.11366）問了另一個問題：如果代理就只是想一想自己為什麼失敗，然後把那個想法放進提示詞裡再試一次呢？沒有權重更新。沒有梯度。就只是存在兩次試驗之間的自然語言。

結果是：在 ALFWorld 上它勝過 ReAct 與其他未微調的基線。在 HotpotQA 上它比 ReAct 進步。在程式碼生成（HumanEval／MBPP）上，它在當時創下最先進成績。全都沒走過任何一步梯度。

## 核心概念

### 三個組件

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

加上一個資料結構：

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

一次試驗跑 Actor。Evaluator 替它評分。若分數低，Self-Reflector 就產出一段反思（「我挑錯工具了，因為我把問題誤讀成在問 X，其實它在問 Y」）。這段反思進入情節記憶。下一次試驗從頭開始，但看得到那段反思。

### 三種評估器型別

1. **純量式** —— 一個外部的二元訊號。ALFWorld 成功或失敗。HumanEval 測試通過或失敗。最簡單、訊號最強。
2. **啟發式** —— 預先定義的失敗特徵。「如果代理連續兩次產出同一個行動，標記為卡住。」「如果軌跡超過 50 步，標記為沒效率。」
3. **自評式** —— LLM 替自己的軌跡評分。在沒有基準真值可用時才需要。訊號較弱；跟工具接地的查證搭配得很好（第 05 課 —— CRITIC）。

2026 年的預設是混搭：有純量訊號時用純量、沒有時用自評、啟發式當安全護欄。

### 為什麼這件事可以一般化

Reflexion 與其說是一套新演算法，不如說是一個被命名的模式。幾乎每個生產級的「自我修復」代理都跑著某種變體：

- Letta 的 sleep-time compute（第 08 課）：一個獨立的代理對過往對話做反思，並寫進記憶區塊。
- Claude Code 的 `CLAUDE.md`／「save memory」模式：把反思捕捉成學習紀錄，接在未來工作階段的前面。
- pro-workflow 的 `/learn-rule` 指令：把修正捕捉成明寫的規則。
- LangGraph 的反思節點：一個替輸出評分、必要時路由去精修的節點。

全都源自同一個洞見：自然語言是個夠豐富的媒介，足以在多次執行之間承載「我從失敗中學到什麼」。

### 什麼時候有用、什麼時候沒用

Reflexion 有用的情況：

- 有清楚的失敗訊號（測試失敗、工具錯誤、答錯）。
- 任務類別可重現（同一種問題可以再問一次）。
- 反思在那條軌跡上還有改善空間（行動預算夠）。

Reflexion 幫不上忙的情況：

- 代理第一次就成功了。
- 失敗來自外部（網路掛了、工具壞了）—— 對「網路掛了」做反思，對未來的執行沒有幫助。
- 反思變成迷信 —— 把一次偶發不穩的執行編成一段敘事存起來。

2026 年的坑：記憶腐爛。反思會累積；有些過期或根本是錯的；隨著情節緩衝區長大，重跑會愈來愈慢。緩解方式：定期壓實（第 06 課）、給反思加 TTL，或另設一個 sleep-time 清理代理（Letta）。

```figure
react-trace
```

## 動手實作

`code/main.py` 在一個玩具謎題上實作 Reflexion：產出一個總和等於目標值的三元素清單。Actor 吐出候選清單；Evaluator 檢查總和；Self-Reflector 寫一行說明哪裡出了錯。這段反思會進入情節記憶，供下一次試驗使用。

組件：

- `Actor` —— 一份腳本化的策略，看到反思時會進步。
- `Evaluator.binary()` —— 對目標總和做通過／失敗判定。
- `SelfReflector` —— 產出一行對失敗的診斷。
- `EpisodicMemory` —— 一個帶 TTL 語意的有界清單。

跑它：

```
python3 code/main.py
```

軌跡顯示三次試驗。試驗 1 失敗，存下一段反思；試驗 2 看到反思、有進步但仍失敗；試驗 3 成功。跟基線執行（不做反思）比較 —— 它會一直卡在試驗 1 的那個答案上。

## 框架應用

LangGraph 把反思當成一種節點模式出貨。Claude Code 的 `/memory` 指令與 pro-workflow 的 `/learn-rule` 把情節緩衝區外部化成一個 markdown 檔。Letta 的 sleep-time compute 在閒置時段跑 Self-Reflector，好讓主要代理維持在延遲敏感的路徑上。OpenAI Agents SDK 沒有直接出貨 Reflexion；你要用一個依分數拒絕軌跡的自訂 Guardrail，加上一個能跨執行存活的記憶 `Session` 自己拼出來。

## 產出交付

`outputs/skill-reflexion-buffer.md` 會建立並維護一個情節緩衝區，含反思捕捉、TTL 與去重。給定一個任務類別與一次失敗，它會產出一段真的對下一次試驗有幫助的反思（而不是泛泛的「下次小心一點」）。

## 練習

1. 從二元評估器換成回傳距離度量（離目標多遠）的純量評估器。它收斂得更快嗎？
2. 給反思加上 10 次試驗的 TTL。過了那個點之後，較舊的反思是幫倒忙還是幫忙？
3. 實作啟發式評估器：若同一個行動重複出現，就把這次試驗標記為卡住。這跟 Self-Reflector 之間怎麼互動？
4. 用一個會無視反思的對抗性 Actor 來跑 Reflexion。要逼 Actor 注意到那些反思，最少需要多少反思提示詞工程？
5. 讀 Reflexion 論文第 4 節談 AlfWorld 的部分。概念上重現那個 130% 的成功率提升：相對於原味 ReAct，關鍵差別是什麼？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Reflexion | 「自我修正」 | Shinn 等人 2023 —— Actor、Evaluator、Self-Reflector 加上情節記憶 |
| 語言式強化 | 「不用梯度的學習」 | 接在下一次試驗提示詞前面的自然語言反思 |
| 情節記憶 | 「逐任務的反思」 | 針對某一個任務類別、存放先前反思的有界緩衝區 |
| 純量評估器 | 「二元的成功訊號」 | 來自基準真值的通過／失敗或數值分數 |
| 啟發式評估器 | 「基於樣式的偵測器」 | 預先定義的失敗特徵（例如卡迴圈、步數過多） |
| 自評器 | 「對自己軌跡的 LLM-as-judge」 | 沒有基準真值時訊號較弱的退路 —— 要搭配工具接地的查證 |
| 記憶腐爛 | 「過期的反思」 | 情節緩衝區塞滿作廢條目；用壓實／TTL 修 |
| Sleep-time 反思 | 「非同步自我反思」 | 把 Self-Reflector 移出熱路徑，好讓主要代理維持快速 |

## 延伸閱讀

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) —— 那篇典範論文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) —— 生產環境中的非同步反思
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 把情節緩衝區當成脈絡的一部分來管理
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 反思節點模式
