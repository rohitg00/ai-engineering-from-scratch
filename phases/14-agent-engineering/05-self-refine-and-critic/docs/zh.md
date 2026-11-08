# Self-Refine 與 CRITIC：迭代式的輸出改善

> Self-Refine（Madaan 等人，2023）讓同一個 LLM 在迴圈中扮演三種角色 —— 生成、回饋、精修。平均收穫：7 項任務上絕對值 +20。CRITIC（Gou 等人，2023）把回饋那一步硬化，讓查證繞道外部工具。2026 年這套模式在每個框架裡都以「evaluator-optimizer」（Anthropic）或護欄迴圈（OpenAI Agents SDK）的形式出貨。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 03（Reflexion）
**時間：** 約 60 分鐘

## 學習目標

- 說出 Self-Refine 的三段提示詞（生成、回饋、精修），並解釋為何歷史對精修提示詞很重要。
- 解釋 CRITIC 的關鍵洞見：沒有外部接地時，LLM 做自我查證並不可靠。
- 用 stdlib 實作一個帶歷史、外加選配外部查證器的 Self-Refine 迴圈。
- 把這套模式對映到 Anthropic 的「evaluator-optimizer」工作流與 OpenAI Agents SDK 的輸出護欄。

## 問題所在

代理產出了一個幾乎對的答案。也許某一行程式碼有語法錯誤。也許摘要太長。也許某份計畫漏了一個邊界情況。你想要的是：代理批評自己的輸出，然後修好它。

Self-Refine 顯示這件事用單一模型就辦得到，不用訓練資料、不用 RL。但有個陷阱：LLM 在硬事實上很不擅長自我查證。CRITIC 指出了解法 —— 讓查證那一步繞道外部工具（搜尋、程式碼直譯器、計算機、測試執行器）。

這兩篇論文合起來定義了 2026 年迭代改善的預設做法：生成、查證（可能的話用外部的）、精修，查證器通過就停。

## 核心概念

### Self-Refine（Madaan 等人，NeurIPS 2023）

一個 LLM，三種角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

關鍵細節：`refine` 看得到完整歷史 —— 所有先前的輸出與批評 —— 所以它不會重犯同樣的錯。論文做了消融：拿掉歷史，品質急遽下降。

頭條數字：跨 7 項任務（數學、程式碼、縮寫、對話）平均絕對值改善 +20，GPT-4 也包含在內。不訓練、不用外部工具、單一模型。

### CRITIC（Gou 等人，arXiv:2305.11738，v4 於 2024 年 2 月）

Self-Refine 的弱點：回饋那一步是 LLM 在替自己評分。對事實性主張來說這並不可靠（一段幻覺對產出它的那個模型來說，往往看起來很有說服力）。CRITIC 把 `feedback(task, output)` 換成 `verify(task, output, tools)`，其中 `tools` 包含：

- 查事實性主張用的搜尋引擎。
- 查程式碼正確性用的程式碼直譯器。
- 算術用的計算機。
- 領域專屬的查證器（單元測試、型別檢查器、linter）。

查證器產出一份接地於工具結果的結構化批評。精修器再以這份批評為條件。

頭條數字：在事實性任務上 CRITIC 勝過 Self-Refine，因為批評是接地的。在沒有外部查證器的任務上（創意寫作、格式化），CRITIC 就退化成 Self-Refine。

### 停止條件

兩種常見形狀：

1. **查證器通過。** 外部測試回傳成功。有得用時優先（單元測試、型別檢查器、護欄斷言）。
2. **沒有提出回饋。** 模型說「這個輸出沒問題」。較便宜但不可靠；要搭配最大迭代次數上限。

2026 年的預設：兩者合用。「若查證器通過就停，或模型說沒問題且迭代次數 >= 2 就停，或迭代次數 >= max_iterations 就停。」

### Evaluator-Optimizer（Anthropic，2024）

Anthropic 2024 年 12 月那篇貼文，把這件事命名為五種工作流模式之一。兩種角色：

- Evaluator：替輸出評分並產出批評。
- Optimizer：依據批評修訂輸出。

一直迴圈到 evaluator 通過為止。這就是 Anthropic 語彙下的 Self-Refine／CRITIC。Anthropic 補上的關鍵工程細節是：evaluator 與 optimizer 的提示詞應該有實質差異，這樣模型才不會只是蓋個橡皮圖章。

### OpenAI Agents SDK 的輸出護欄

OpenAI Agents SDK 把這套模式以「輸出護欄」的形式出貨。護欄是一個驗證器，跑在代理的最終輸出上。若護欄被絆到（丟出 `OutputGuardrailTripwireTriggered`），該輸出就被拒絕，代理可以重試。護欄可以呼叫工具（CRITIC 式），也可以是純函數（Self-Refine 式）。

### 2026 年的坑

- **橡皮圖章迴圈。** 同一個模型、同一種提示詞風格既做生成又做批評，最後會收斂到「我看沒問題」。要用結構上不同的提示詞，或改用一個便宜的小模型來做批評。
- **過度精修。** 每一趟精修都增加延遲與詞元。編 1-3 趟的預算；再多就升級給人審。
- **在瑣碎任務上用 CRITIC。** 沒有外部查證器時，CRITIC 會退化成 Self-Refine；別為了一個樁函數查證器去付那筆延遲。

```figure
self-refine
```

## 動手實作

`code/main.py` 在一個玩具任務上實作 Self-Refine 與 CRITIC：給定一個主題，產出一份短短的項目符號清單。查證器檢查格式（3 個項目，每個少於 60 個字元）。CRITIC 另外加一個外部的「事實查證器」，會懲罰已知的幻覺。

組件：

- `generate` —— 腳本化的產生器。
- `feedback` —— LLM 式的自我批評。
- `verify_external` —— CRITIC 式的接地查證器。
- `refine` —— 依據歷史重寫輸出。
- 停止條件 —— 查證器通過，或最多 4 次迭代。

跑它：

```
python3 code/main.py
```

比較 Self-Refine 與 CRITIC 這兩趟。CRITIC 抓到了一個 Self-Refine 漏掉的事實錯誤，因為外部查證器擁有自我批評者沒有的接地。

## 框架應用

Anthropic 的 evaluator-optimizer 就是這套模式換成 Claude 友善的語言。OpenAI Agents SDK 的輸出護欄是 CRITIC 形狀的（護欄可以呼叫工具）。LangGraph 出貨了一個讀起來就像 Self-Refine 的反思節點。Google 的 Gemini 2.5 Computer Use 加了一個逐步的安全評估器，那是 CRITIC 的變體：每個行動在提交前都會被查證。

## 產出交付

`outputs/skill-refine-loop.md` 會依任務形狀、查證器是否可得與迭代預算，去設定一個 evaluator-optimizer 迴圈。它會產出生成器、評估器／查證器與最佳化器的提示詞，外加一份停止策略。

## 練習

1. 用 max_iterations=1 跑這個玩具。CRITIC 還有幫助嗎？
2. 把外部查證器換成很吵的那種（隨機 30% 偽陽性）。這個迴圈會怎麼做？這就是 2026 年多數護欄堆疊的現實。
3. 實作一個「生成器與批評者用不同模型」的變體：大模型生成、小模型批評。它勝過同模型的版本嗎？
4. 讀 CRITIC 第 3 節（arXiv:2305.11738 v4）。說出那三類查證工具，並各給一個例子。
5. 把 OpenAI Agents SDK 的 `output_guardrails` 對映到 CRITIC 的查證器角色。這個 SDK 哪裡做錯了，又哪裡做對了？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Self-Refine | 「會自己修自己的 LLM」 | 同一個模型內的生成 -> 回饋 -> 精修迴圈，帶歷史 |
| CRITIC | 「工具接地的查證」 | 把回饋換成外部查證器（搜尋、程式碼、計算、測試） |
| Evaluator-Optimizer | 「Anthropic 的工作流模式」 | 兩種角色 —— evaluator 評分、optimizer 修訂 —— 迴圈到收斂 |
| 輸出護欄 | 「事後檢查」 | OpenAI Agents SDK 中在代理產出輸出後才跑的驗證器 |
| 查證步驟 | 「批評階段」 | 那個承重的決策：是接地的，還是自評的 |
| 精修歷史 | 「模型已經試過什麼」 | 先前的輸出＋批評，接在精修提示詞前面；拿掉品質就崩 |
| 橡皮圖章迴圈 | 「自我同意的失效」 | 同一種提示詞的批評回傳「看起來不錯」；用結構上不同的提示詞來修 |
| 停止條件 | 「收斂測試」 | 查證器通過，或無回饋且達迭代上限；絕不要只用單一條件 |

## 延伸閱讀

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— 那篇典範論文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) —— 工具接地的查證
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— evaluator-optimizer 工作流模式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— 當成 CRITIC 形狀查證器的輸出護欄
