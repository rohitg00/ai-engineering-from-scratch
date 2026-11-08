# Supervisor／Orchestrator-Worker 模式

> 一個主導代理負責規劃與委派；特化的 worker 在各自的脈絡中平行執行並回報。這就是 Anthropic 的 Research 系統背後那個模式（Claude Opus 4 當主導、Sonnet 4 當子代理），在內部研究評測上量到比單一代理 Opus 4 高 90.2%。Anthropic 的工程貼文回報，BrowseComp 上 80% 的變異可以單靠詞元用量解釋 —— 多代理之所以勝出，主要是因為每個子代理都拿到一個全新的脈絡視窗。這一課從原語把 supervisor 模式建出來，並涵蓋 2026 年來自生產部署的工程教訓。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib, `threading`)
**先修單元：** 階段 16 · 04（原語模型）
**時間：** 約 75 分鐘

## 問題

研究是那種單一代理系統會失敗的典型任務。你問「多代理系統在 2023 到 2026 年之間變了什麼？」單一代理循序讀五篇論文、把一半脈絡填滿它們的文字，然後得把全部一起拿來推理。等它讀到第五篇時，早就忘了第一篇。它也沒辦法平行化。

Supervisor 模式修好這件事：一個主導代理規劃搜尋、把每個子問題委派給一個 worker，然後綜合。每個 worker 拿到自己那 200k 詞元的視窗去處理一個很窄的問題。主導代理從不看那些原始論文 —— 只看 worker 的摘要。

Anthropic 的生產 Research 系統回報，在內部研究評測上比單一 Opus 4 高 90.2%。同一篇貼文指出，BrowseComp 的變異有 80% 可以*單靠詞元用量*解釋。每個子代理都有全新脈絡，就是那個主要機制。

## 概念

### 那個模式

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

主導代理從不讀原始素材。在主導代理綜合之前，worker 也看不到彼此的工作。每一支箭頭都是一次帶著窄產物的交接。

### 它為什麼會贏

三種機制：

1. **每個子代理都有全新脈絡。** 一個在探索「FIPA-ACL 傳承」的 worker，不必扛著主導代理規劃時花掉的那 4 萬詞元。它拿到一個 200k 視窗去處理一個問題。
2. **透過提示詞做特化。** 主導代理的提示詞是「分解並綜合」，不是「做研究」。每個 worker 的提示詞很窄：「找出 X 變了什麼」。聚焦的提示詞產出聚焦的輸出。
3. **平行性。** Worker 併發執行。牆鐘時間大約是 `max(worker_times) + 規劃 + 綜合`，而不是 `sum(worker_times)`。

### 工程教訓（Anthropic 2025）

Anthropic 那篇貼文列了幾項到 2026 年仍然相關的生產教訓：

- **讓投入的力氣隨查詢複雜度縮放。** 簡單查詢：一個代理、3-10 次工具呼叫。複雜查詢：10 個以上代理。這件事必須由主導代理估算，不是由呼叫者。
- **先廣後窄。** 先分解成廣泛的子問題，若答案值得深挖，再替每個子問題生出更多 worker。
- **彩虹式部署。** 代理是長時間執行且有狀態的。傳統的藍綠部署行不通。Anthropic 用彩虹式：新版本逐步放量，同時舊版本慢慢排空。
- **詞元用量主導一切。** 多代理大約是單一代理的 15 倍詞元。只有在任務價值撐得起那個成本時才跑它。

### 那次圖原生的轉向

LangGraph 原本出貨了一個 `langgraph-supervisor` 函式庫，帶一個高階的 `create_supervisor` 輔助函式。2025 年 LangChain 把建議改成直接用工具呼叫來實作 supervisor 模式，因為工具呼叫對*supervisor 看到什麼*給了更多掌控（脈絡工程）。那個函式庫仍然可用；文件現在建議工具呼叫那種形式。

### 那些失敗模式

- **主導代理幻覺出計畫。** 若主導代理產出的子問題並沒有真的分解那個真問題，worker 就會對錯的標靶做精確的研究。
- **Worker 過度探索。** 沒有明寫的範圍邊界，worker 就會飄出它被指派的子問題，並汙染綜合那一步。
- **綜合衝突。** 兩個 worker 回傳互相矛盾的事實。主導代理要嘛重問（多加一輪）、要嘛明白註記這項分歧。默默挑一邊是最糟的失敗：使用者永遠不知道曾經有分歧。

### Supervisor 什麼時候是錯的

- **循序任務。** 若第 2 步真的需要第 1 步的輸出，平行性什麼都買不到。用管線（CrewAI 的 Sequential、LangGraph 的線性圖）。
- **簡單查詢。** 單一代理處理得更快也更便宜。在生出 worker 之前先用主導代理那個「縮放力氣」的檢查。
- **嚴格的決定性。** Supervisor 用的是 LLM 選擇式的委派。當稽核／重播比適應性更重要時，靜態圖比較好。

```figure
supervisor-hierarchy
```

## 動手實作

`code/main.py` 用 `threading` 實作一個帶三個平行 worker 的 supervisor。主導代理把查詢分解成子問題、worker 併發地各跑一個子問題，然後主導代理綜合。沒有真正的 LLM —— worker 是腳本化的，用來模擬抓取並摘要。

關鍵結構：

- `Lead.plan(query)` 把一個查詢切成 3 個子問題。
- `Worker.run(sub_q)` 回傳一份假的摘要（在生產環境中可以是任何會用工具的代理）。
- `Lead.run(query)` 在執行緒中啟動 worker、join，然後綜合。

跑：

```
python3 code/main.py
```

輸出顯示那份計畫、帶起訖時間戳的平行 worker 軌跡，以及最終的綜合。你看得到牆鐘上的斬獲：三個 0.3 秒的 worker 在約 0.35 秒內跑完，不是 0.9 秒。

## 框架應用

`outputs/skill-supervisor-designer.md` 接收一則使用者查詢，並產出一份 supervisor 模式設計：主導代理的系統提示詞、worker 角色、子問題分解規則，以及綜合的樣板。在建構新的研究型代理系統之前用它。

## 產出交付

部署 supervisor 模式之前的檢查清單：

- **模型配對。** 主導代理用推理層級的模型（Opus 等級、`o3` 等級）。Worker 用更快、更便宜的模型（Sonnet、`o4-mini`）。
- **Worker 逾時。** 任何超過中位執行時間 2 倍的 worker 就砍掉；主導代理要嘛用更窄的範圍重新生一個，要嘛就少了它繼續。
- **逐 worker 的詞元上限。** 硬上限（例如預期綜合輸入的 10 倍）能防止某個失控的 worker 把預算炸掉。
- **可觀測性。** 追蹤主導代理的計畫、每個 worker 的工具呼叫，以及綜合。這是任何事後除錯的基礎。
- **彩虹式放量。** 長時間執行且有狀態的代理需要漸進式的版本轉換，不是熱抽換。

## 練習

1. 跑 `code/main.py`，然後把主導代理改成生 5 個 worker 而不是 3 個。觀察牆鐘上的效果。在這個示範裡，worker 數到多少時，生成開銷會超過平行帶來的節省？
2. 實作 worker 逾時：砍掉任何跑超過 0.5 秒的 worker，並讓主導代理用剩下的結果做綜合。你需要什麼可觀測性才知道某個 worker 被砍了？
3. 替主導代理的綜合加上一個衝突偵測步驟：若兩個 worker 回傳互相矛盾的答案，主導代理要註記這項分歧，而不是挑一個。不呼叫 LLM 的話，你要怎麼偵測矛盾？
4. 讀 Anthropic 那篇 Research 系統的工程貼文。列出這個玩具示範若要在生產環境執行，需要採用的三項實務做法。
5. 比較 LangGraph 的 `create_supervisor`（舊版）與新的工具呼叫建議。哪一個讓你對「supervisor 看到什麼」有更好的掌控？為什麼 Anthropic 明確地只把子答案、而不是 worker 的原始脈絡傳進綜合？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Supervisor | 「主導代理」 | 負責規劃、委派與綜合的編排者代理。自己不做那份工作。 |
| Worker | 「子代理」 | 由 supervisor 以窄範圍調用、擁有自己脈絡視窗的聚焦代理。 |
| Orchestrator-worker | 「Supervisor 模式」 | 同一件事，不同名字。2026 年的文獻兩種都用。 |
| 全新脈絡 | 「乾淨視窗」 | Worker 的脈絡從它的系統提示詞與被指派的問題開始，而不是主導代理的歷史。 |
| 彩虹式部署 | 「漸進式放量」 | 長時間執行、有狀態的代理需要帶版本的排空替換，不是藍綠。 |
| 詞元主導 | 「脈絡才是那個變數」 | 依 Anthropic，研究評測 80% 的變異來自總詞元用量，不是模型選擇。 |
| 縮放力氣 | 「讓代理數量配上複雜度」 | 主導代理估算查詢難度，據此生出 1 個或 10 個以上 worker。 |
| 綜合衝突 | 「Worker 意見不合」 | 兩個 worker 回傳互相矛盾的事實；主導代理必須把分歧攤開，不能默默挑一個。 |

## 延伸閱讀

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) —— supervisor 模式的生產參考
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 工具呼叫式的 supervisor 現在是建議的形式
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) —— 那個舊版輔助函式，2026 年生產環境仍在用
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 基於交接的 supervisor 變體
