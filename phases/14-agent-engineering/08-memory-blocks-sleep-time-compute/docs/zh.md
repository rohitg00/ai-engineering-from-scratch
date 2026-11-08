# 記憶區塊與 Sleep-Time Compute

> 模型可以直接編輯的離散功能性記憶區塊，加上一個在主要代理閒置時非同步整併記憶的 sleep-time 代理。這兩個構想就是你把記憶擴展到單一對話之外的方式。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 07（MemGPT）
**時間：** 約 75 分鐘

## 學習目標

- 說出 Letta 使用的三個記憶層（core、recall、archival）以及各自的角色。
- 解釋記憶區塊模式：Human 區塊、Persona 區塊，以及使用者自定義的區塊都是一等的具型別物件。
- 描述 sleep-time compute 是什麼、它為何坐在關鍵路徑之外，以及它為何能跑比主要代理更強的模型。
- 實作一個腳本化的雙代理迴圈：主要代理負責服務回應，sleep-time 代理在輪次之間整併區塊。

## 問題所在

MemGPT（第 07 課）解決了虛擬記憶體的控制流。接著浮現三個生產環境的問題：

1. **延遲。** 每一次記憶操作都坐在關鍵路徑上。如果代理得在使用者等待時做修剪、摘要或調和，尾端延遲就會爆掉。
2. **記憶腐爛。** 寫入不斷累積。被推翻的事實還留著。檢索淹沒在過期內容裡。
3. **結構遺失。** 一個扁平的歸檔儲存沒辦法表達「Human 區塊永遠在提示詞裡；Persona 區塊永遠在提示詞裡；Task 區塊每個工作階段換一次」。

Letta（letta.com）是原本的 MemGPT 專案在 2024 年採用的平台名稱 —— 論文那套模式仍沿用 MemGPT 這個名字 —— 而 2026 年的 Letta V1 改寫則是後來另一個獨立的步驟。記憶區塊把結構明寫出來；sleep-time compute 則把整併搬離關鍵路徑。

## 核心概念

### 三層

| 層 | 範圍 | 住在哪裡 | 由誰寫入 |
|------|-------|----------------|------------|
| Core | 永遠可見 | 主提示詞內 | 代理的工具呼叫 + sleep-time 改寫 |
| Recall | 對話歷史 | 可檢索 | 自動的輪次記錄 |
| Archival | 任意事實 | 向量 + KV + 圖 | 代理的工具呼叫 + sleep-time 匯入 |

Core 就是 MemGPT 的 core。Recall 是對話緩衝區連同它被逐出的尾巴。Archival 是那個外部儲存。這個拆法把 MemGPT 兩層設計中的職責過載清理乾淨了。

### 記憶區塊

一個區塊是 core 層中具型別、持久、可編輯的區段。原始 MemGPT 論文定義了兩個：

- **Human 區塊** —— 關於使用者的事實（姓名、角色、偏好、目標）。
- **Persona 區塊** —— 代理的自我概念（身分、語氣、限制）。

Letta 把它一般化成任意的使用者自定義區塊：放當前目標的 `Task` 區塊、放程式庫事實的 `Project` 區塊、放硬性限制的 `Safety` 區塊。每個區塊有 `id`、`label`、`value`、`limit`（字元上限）、`description`（好讓模型知道何時該編輯它）。

區塊可以透過這套工具表面編輯：

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` —— 把一個接近上限的區塊濃縮。

### Sleep-time compute

2025 年 Letta 加上的東西：在背景跑第二個代理，位於關鍵路徑之外。Sleep-time 代理處理對話逐字稿與程式庫脈絡，把 `learned_context` 寫進共享區塊，並整併或作廢歸檔紀錄。

自然而然掉出來的性質：

- **沒有延遲成本。** 主要回應不必等記憶操作。
- **允許用更強的模型。** Sleep-time 代理可以是更貴、更慢的模型，因為它不受延遲約束。
- **天然的整併窗口。** 在使用者不等待時做去重、摘要、把被推翻的事實作廢。

這個形狀跟人類的運作方式吻合：你做事、你睡一覺，長期記憶在夜裡沉澱下來。

### 原生推理

Letta V1（`letta_v1_agent`，2026）棄用 `send_message`／心跳與內嵌的 `Thought:` 詞元，改採原生推理。Responses API（OpenAI）與帶延伸思考的 Messages API（Anthropic）會在另一條通道上產出推理，並跨輪次傳遞（生產環境中跨供應商時是加密的）。控制迴圈仍然是 ReAct。思考軌跡是結構性的，不是提示詞形狀的。

### 這套模式在哪裡會出錯

- **區塊肥大。** 無限 `block_append` 很快就撞到上限。在那次會撐破上限的寫入之前，先接上一個區塊摘要器。
- **無聲漂移。** Sleep-time 代理改寫了某個區塊，主要代理卻從沒察覺。要給區塊做版本，並在軌跡中把 diff 呈現出來。
- **被投毒的整併。** Sleep-time 代理把攻擊者可觸及的內容處理進了 core。第 27 課同樣適用於 sleep-time 這個表面。

```figure
memory-blocks
```

## 動手實作

`code/main.py` 實作了：

- `Block` —— id、label、value、limit、description。
- `BlockStore` —— CRUD 加一個 `near_limit(label)` 輔助函式。
- 兩個腳本化的代理 —— `PrimaryAgent` 負責服務一輪，`SleepTimeAgent` 在輪次之間整併。
- 一份軌跡，顯示一段帶區塊寫入的三輪對話，外加一趟 sleep-time 通過：它摘要某個區塊，並把一則過期事實作廢。

跑它：

```
python3 code/main.py
```

逐字稿顯示了這種拆分：主要輪次很快、產出的是生的寫入；sleep 那一趟則做壓實與清理。

## 框架應用

- **Letta**（letta.com）作為參考實作。自架或託管雲端皆可。
- **Claude Agent SDK 的技能**作為區塊形狀的知識 —— 一項技能就是一個具名、有版本、可檢索的指示區塊，代理按需載入。
- **自製**，給想掌控儲存後端的團隊。照著 Letta 的 API 契約做，日後才好遷移。

## 產出交付

`outputs/skill-memory-blocks.md` 會替任何執行環境產出一套 Letta 形狀的區塊系統，帶 sleep-time 掛鉤，包含安全規則與引用接線。

## 練習

1. 加一個 `block_summarize` 工具，當 `near_limit` 回傳 true 時，用模型產出的摘要取代區塊值。哪個觸發門檻能同時把摘要呼叫次數與區塊溢位都壓到最低？
2. 在歸檔上實作 sleep-time 去重：兩筆文字詞元重疊 >90% 的紀錄合併成一筆。只在 sleep 那一趟做，絕不要在關鍵路徑上做。
3. 給區塊做版本。每次寫入都記下舊值與一份 diff。暴露 `block_history(label)`，好讓維運者可以除錯「代理為什麼忘了 X」。
4. 把 sleep-time 代理當成不可信的寫入者。當它們碰到 Persona 或 Safety 區塊時，要求先經第二個代理審查才能提交。
5. 把這個範例移植成使用 Letta API（`letta_v1_agent`）。區塊 schema 有什麼改變，而原生推理又怎麼改變軌跡的形狀？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 記憶區塊 | 「可編輯的提示詞區段」 | core 記憶中具型別、持久、可由 LLM 編輯的片段 |
| Human 區塊 | 「使用者記憶」 | 關於使用者的事實，釘在 core 裡 |
| Persona 區塊 | 「代理身分」 | 自我概念、語氣、限制，釘在 core 裡 |
| Sleep-time compute | 「非同步的記憶工作」 | 在關鍵路徑外做整併的第二個代理 |
| Core / Recall / Archival | 「那些層」 | 三層記憶拆分：永遠可見／對話／外部 |
| 區塊上限 | 「上限」 | 每個區塊的字元上限；逼出摘要 |
| 原生推理 | 「思考通道」 | 供應商層級的推理輸出，而非提示詞層級的 `Thought:` |
| Learned context | 「Sleep 的產出」 | Sleep-time 代理寫進共享區塊的事實 |

## 延伸閱讀

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— 那套區塊模式
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) —— 非同步整併
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) —— 原生推理的改寫
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— 起源
