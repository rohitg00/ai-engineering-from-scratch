# 執行環境即函式庫 —— 子代理與工作階段儲存

> 一個你可以 import 進來的執行環境：內建工具、用於脈絡隔離的子代理、掛鉤、W3C 追蹤傳播、工作階段持久化。Claude Agent SDK 就是那個參考範例 —— Claude Code 執行環境的函式庫形態 —— 而 Claude Managed Agents 則是給長時間非同步工作的託管替代方案。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 10（技能庫）
**時間：** 約 75 分鐘

## 學習目標

- 解釋 Anthropic Client SDK（原始 API）與 Claude Agent SDK（執行環境形狀）之間的差別。
- 描述子代理 —— 平行化與脈絡隔離 —— 以及何時該伸手去拿它們。
- 說出 Python SDK 的工作階段儲存表面（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）與 `--session-mirror` 的角色。
- 用 stdlib 實作一個執行環境，含內建工具、帶隔離脈絡的子代理生成、生命週期掛鉤，以及工作階段儲存。

## 問題所在

原始的 LLM API 只給你一次來回。生產級的代理需要工具執行、MCP 伺服器、生命週期掛鉤、子代理生成、工作階段持久化、追蹤傳播。Claude Agent SDK 把這個形狀當成函式庫出貨 —— 就是 Claude Code 用的那個執行環境，暴露出來給自訂代理用。

## 核心概念

### Client SDK vs Agent SDK

- **Client SDK（`anthropic`）。** 原始的 Messages API。迴圈、工具、狀態都由你擁有。
- **Agent SDK（`claude-agent-sdk`）。** 內建工具執行、MCP 連線、掛鉤、子代理生成、工作階段儲存。Claude Code 那個迴圈的函式庫形態。

### 內建工具

這個 SDK 開箱出貨 10 種以上的工具：檔案讀寫、shell、grep、glob、網頁抓取，還有更多。自訂工具透過標準的工具 schema 介面註冊。

### 子代理

Anthropic 文件寫下的兩個用途：

1. **平行化。** 併發跑相互獨立的工作。「替這 20 個模組各找出它的測試檔」就是 20 項平行的子代理任務。
2. **脈絡隔離。** 子代理用自己的脈絡視窗；只有結果會回到編排者身上。編排者的預算得以保全。

Python SDK 近期新增：`list_subagents()`、`get_subagent_messages()`，用來讀子代理的逐字稿。

### 工作階段儲存

與 TypeScript 版協定對等：

- `append(session_id, message)` —— 加一輪。
- `load(session_id)` —— 還原對話。
- `list_sessions()` —— 列舉。
- `delete(session_id)` —— 會連帶級聯刪除子代理的工作階段。
- `list_subkeys(session_id)` —— 列出子代理的鍵。

`--session-mirror`（CLI 旗標）會在逐字稿串流的同時，把它鏡射到一個外部檔案，供除錯用。

### 掛鉤

你可以註冊的生命週期掛鉤：

- `PreToolUse`、`PostToolUse` —— 對工具呼叫設閘門或做稽核。
- `SessionStart`、`SessionEnd` —— 建立與拆除。
- `UserPromptSubmit` —— 在模型看到使用者輸入之前先動手。
- `PreCompact` —— 在脈絡壓實之前跑。
- `Stop` —— 代理離開時做清理。
- `Notification` —— 側通道的警示。

掛鉤就是 pro-workflow（階段 14 課程中提到的參考）與類似系統加上橫切行為的方式。

### W3C 追蹤脈絡

呼叫端上活躍的 OTel span，會透過 W3C 追蹤脈絡標頭傳播進 CLI 子行程。整條跨行程的追蹤在你的後端會顯示成單一條 trace。

### Claude Managed Agents

那個託管的替代方案（beta 標頭 `managed-agents-2026-04-01`）。長時間的非同步工作、內建提示詞快取、內建壓實。拿掌控權換託管基礎設施。

### 這套模式在哪裡會出錯

- **子代理生成過頭。** 為了 100 項小任務生出 100 個子代理。開銷會主導一切。改用批次。
- **掛鉤蔓生。** 每個團隊都加掛鉤；啟動時間膨脹。每季審一次掛鉤。
- **工作階段肥大。** 工作階段一直累積；體積長大。用 `list_sessions` 加一套到期策略。

```figure
ae-subagent-isolation
```

## 動手實作

`code/main.py` 用 stdlib 實作這個 SDK 的形狀：

- `Tool`、`ToolRegistry`，內建 `read_file`、`write_file`、`list_dir`。
- `Subagent` —— 私有脈絡、隔離執行、回傳結果。
- `SessionStore` —— append、load、list、delete、list_subkeys。
- `Hooks` —— `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一個示範：主代理平行生出 3 個子代理（各自隔離）、彙整結果、持久化工作階段。

跑它：

```
python3 code/main.py
```

軌跡顯示子代理的脈絡隔離（編排者的脈絡大小維持有界）、掛鉤執行，以及工作階段持久化。

## 框架應用

- **Claude Agent SDK** 給想要 Claude Code 執行環境形狀、以 Claude 為先的產品。
- **Claude Managed Agents** 給託管的長時間非同步工作。
- **OpenAI Agents SDK**（第 16 課）給以 OpenAI 為先的對應物。
- **LangGraph + 自訂工具** 給你想要圖形狀狀態機的時候。

## 產出交付

`outputs/skill-claude-agent-scaffold.md` 會搭出一個 Claude Agent SDK 應用的鷹架，含子代理、掛鉤、工作階段儲存、MCP 伺服器掛載，以及 W3C 追蹤傳播。

## 練習

1. 加一個子代理生成器，把 20 項任務分批成每組 5 個平行子代理。量它相對於「一項任務一個子代理」的編排者脈絡大小。
2. 實作一個 `PreToolUse` 掛鉤，替 `write_file` 呼叫做速率限制（每個工作階段每分鐘 5 次）。把行為追出來。
3. 把 `list_subkeys` 接起來，畫出一棵子代理樹。深層巢狀長什麼樣子？
4. 把這個玩具移植到真正的 `claude-agent-sdk` Python 套件。工具註冊有什麼改變？
5. 讀 Claude Managed Agents 的文件。什麼時候你會從自架換到託管？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Agent SDK | 「函式庫形態的 Claude Code」 | 執行環境形狀：工具、MCP、掛鉤、子代理、工作階段儲存 |
| 子代理 | 「子代理程式」 | 獨立脈絡、自己的預算；結果往上冒 |
| 工作階段儲存 | 「對話 DB」 | 持久化、載入、列出、刪除輪次，並級聯到子代理 |
| 掛鉤 | 「生命週期回呼」 | 工具前後、工作階段、提示詞送出、壓實、停止 |
| W3C 追蹤脈絡 | 「跨行程的追蹤」 | 父 span 傳播進 CLI 子行程 |
| Managed Agents | 「託管的執行環境」 | 由 Anthropic 託管的長時間非同步工作 |
| `--session-mirror` | 「逐字稿鏡射」 | 在工作階段輪次串流時把它們寫到外部檔案 |
| MCP 伺服器 | 「工具表面」 | 掛到代理上的外部工具／資源來源 |

## 延伸閱讀

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Code 的函式庫形態
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 生產模式
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— 託管的替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 對應物
