# 綜合專案 01 —— 終端機原生的寫程式代理

> 到了 2026 年，寫程式代理的形狀已經定下來了。一套 TUI 框架、一份有狀態的計畫、一個沙箱化的工具介面，以及一條會規劃、行動、觀察、復原的迴路。Claude Code、Cursor 3 與 OpenCode 從五十英尺外看都長一個樣。這個綜合專案要你把它從頭到尾建出來 —— 輸入是 CLI，輸出是一份拉取請求 —— 並在 SWE-bench Pro 上拿它與 mini-swe-agent 和 Live-SWE-agent 比較。你會學到為什麼難的不是模型呼叫，而是那條工具迴路、那個沙箱，以及一次 50 輪運行的成本上限。

**類型：** 總結專案
**程式語言：** TypeScript / Bun (harness), Python (eval scripts)
**先修單元：** 階段 11（LLM 工程）、階段 13（工具與協定）、階段 14（代理）、階段 15（自主系統）、階段 17（基礎設施）
**演練到的階段：** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**時間：** 35 小時

## 問題

寫程式代理在 2026 年成了主導性的 AI 應用類別。Claude Code（Anthropic）、帶 Composer 2 與 Agent Tabs 的 Cursor 3（Cursor）、Amp（Sourcegraph）、OpenCode（11.2 萬星）、Factory Droids，以及 Google Jules，全都出貨了同一套架構的變體：一個終端機框架、一個帶權限控管的工具介面、一個沙箱，以及一條圍繞前沿模型建起來的規劃－行動－觀察迴路。前沿很窄 —— Live-SWE-agent 配 Opus 4.5 在 SWE-bench Verified 上達到 79.2% —— 但工程手藝很寬。多數失敗模式不是模型犯的錯。它們是工具迴路不穩、脈絡中毒、詞元成本失控，以及破壞性的檔案系統操作。

你沒辦法從外面推理這些代理。你得建一個出來，看著迴路在第 47 輪、ripgrep 回傳 8MB 比對結果時崩掉，然後把那層截斷邏輯重寫一遍。那就是這個綜合專案的重點。

## 概念

這套框架有四個介面。**規劃**維護一個 TodoWrite 式的狀態物件，模型每一輪把它重寫一次。**行動**派送工具呼叫（讀取、編輯、執行、搜尋、git）。**觀察**擷取 stdout / stderr / 結束碼、做截斷，再把摘要餵回去。**復原**處理工具錯誤，同時不把脈絡窗口撐爆、也不無限迴圈。2026 年的形狀又多了一樣東西：**掛鉤**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 與 `PreCompact` —— 這些是可設定的擴充點，讓運營方在其中注入政策、遙測與護欄。

沙箱是 E2B 或 Daytona。每項任務都跑在一個全新的 devcontainer 裡，並掛載一份可讀寫的 git worktree。框架永遠不碰主機的檔案系統。不論成功或失敗，那份 worktree 都會被拆掉。成本控制在三層強制執行：每輪的詞元上限、每個工作階段的美元預算，以及一個硬性的輪數上限（通常是 50）。可觀測性層是帶 GenAI 語意慣例的 OpenTelemetry span，送到一套自架的 Langfuse。

## 架構

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## 技術堆疊

- 框架執行環境：Bun 1.2 + Ink 5（終端機裡的 React）
- 模型存取：OpenRouter 統一 API，搭配 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（供最難的任務使用）
- 工具傳輸：Model Context Protocol StreamableHTTP（MCP 2026 修訂版）
- 沙箱：E2B sandboxes（JS SDK）或 Daytona devcontainers
- 程式碼搜尋：ripgrep 子行程、17 種語言的 tree-sitter 剖析器（預先編譯）
- 隔離：每項任務跑一次 `git worktree add`，成功／失敗後清理
- 評估框架：SWE-bench Pro（verified 子集）+ Terminal-Bench 2.0 + 你自己的 30 題保留集
- 可觀測性：帶 `gen_ai.*` 語意慣例的 OpenTelemetry SDK → 自架 Langfuse
- PR 張貼：GitHub App 配細緻權限的權杖，範圍限縮在目標儲存庫

```figure
ce-agent-loop
```

## 動手實作

1. **TUI 與指令迴路。** 用 Ink 搭一個 Bun 專案的骨架。接受 `agent run <repo> "<task>"`。印出一個分割畫面：計畫窗格（上）、工具呼叫串流（中）、詞元預算（下）。加上 Ctrl-C 取消，並在退出前先觸發 `SessionEnd` 掛鉤。

2. **計畫狀態。** 定義一份有型別的 TodoWrite schema（含備註的 pending / in_progress / done 項目）。模型每一輪以一次工具呼叫重寫整份狀態 —— 不要讓它增量地就地修改。把計畫持久化到 `.agent/state.json`，好讓當機之後能續跑。

3. **工具介面。** 定義六個工具：`read_file`、`edit_file`（帶差異預覽）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（帶逾時）、`git`（status / diff / commit / push）。透過 MCP StreamableHTTP 暴露出去，讓框架與傳輸方式無關。每個工具都回傳截斷過的輸出（每次呼叫上限 4k 詞元）。

4. **沙箱包裝。** 每項任務都開一個 E2B 沙箱。用 `git worktree add -b agent/$TASK_ID` 開一條全新分支。所有工具呼叫都在沙箱內執行。主機檔案系統搆不到。

5. **掛鉤。** 實作 2026 年那八種掛鉤型別的全部。至少接上四個使用者自撰的掛鉤：(a) `PreToolUse` 的破壞性指令守衛，擋掉 worktree 之外的 `rm -rf`；(b) `PostToolUse` 的詞元記帳；(c) `SessionStart` 的預算初始化；(d) `Stop` 寫出最終的軌跡打包檔。

6. **評估迴路。** 複製一份 30 題的 SWE-bench Pro Python 子集。拿你的框架跑過每一題。在 pass@1、每題輪數與每題花費上，與 mini-swe-agent（那個最小基線）做比較。把結果寫進 `eval/results.jsonl`。

7. **成本控制。** 硬性斷點：50 輪、20 萬脈絡、每題 5 美元。`PreCompact` 掛鉤在 15 萬字元處把較舊的輪次摘要成一段先前狀態區塊，替新觀察騰出空間又不弄丟計畫。

8. **PR 張貼。** 成功時，最後一步是 `git push` 加上一次 GitHub API 呼叫，開一份 PR，內文帶上計畫與差異摘要。

## 框架應用

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## 產出交付

交付的技能放在 `outputs/skill-terminal-coding-agent.md`。給定一個儲存庫路徑與一段任務描述，它會在沙箱裡跑完整條規劃－行動－觀察迴路，並回傳一個 PR 網址加上一份軌跡打包檔。這個綜合專案的評分表：

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 對比基線 | 在 30 題配對的 Python 任務上，你的框架 vs mini-swe-agent |
| 20 | 架構清晰度 | 規劃／行動／觀察的分離、掛鉤介面、工具 schema —— 對照 Live-SWE-agent 的佈局檢視 |
| 20 | 安全性 | 沙箱逃逸測試、權限提示、破壞性指令守衛通過紅隊測試 |
| 20 | 可觀測性 | 軌跡完整度（100% 的工具呼叫都有 span）、逐輪的詞元記帳 |
| 15 | 開發者體驗 | 冷啟動 < 2 秒、當機復原能續回計畫、Ctrl-C 能在工具執行到一半時乾淨取消 |
| **100** | | |

## 練習

1. 把背後的模型從 Claude Sonnet 4.7 換成跑在 vLLM 上的 Qwen3-Coder-30B。比較 pass@1 與每題花費。回報這個開源模型在哪裡表現較差。

2. 加上一個 `reviewer` 子代理，在張貼 PR 之前讀那份差異，並能要求進入修訂迴路。量測偽陽性的審查會不會把 SWE-bench 通過率壓到單代理基線之下（提示：通常會）。

3. 對沙箱做壓力測試：寫一個會嘗試 `curl` 外部網址的任務，以及一個會往 worktree 之外寫檔的任務。確認兩者都被 PreToolUse 掛鉤擋下。把那些嘗試記錄下來。

4. 用一個較小的模型（Haiku 4.5）實作 `PreCompact` 摘要。量測在 3 倍壓縮之下，計畫的忠實度損失了多少。

5. 把 MCP 的 StreamableHTTP 傳輸換成 stdio。對冷啟動與逐次呼叫延遲做基準測試。替純本地使用挑出贏家。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 框架（Harness） | 「那條代理迴路」 | 圍繞模型、負責派送工具、維護計畫狀態並強制執行預算的那些程式碼 |
| 掛鉤（Hook） | 「代理事件監聽器」 | 由框架在八個生命週期事件之一上執行、由使用者自撰的腳本 |
| Worktree | 「Git 沙箱」 | 位在另一路徑上的連結式 git 簽出；可拋棄，不會動到主複本 |
| TodoWrite | 「計畫狀態」 | 模型每一輪重寫一次、有型別的 pending/in-progress/done 清單 |
| StreamableHTTP | 「MCP 傳輸」 | 2026 年的 MCP 修訂版：長生命週期的 HTTP 連線配雙向串流；取代 SSE |
| 詞元上限 | 「脈絡預算」 | 每輪或每個工作階段的輸入+輸出詞元上限；會觸發壓縮或終止 |
| pass@1 | 「單次嘗試通過率」 | 第一次執行就解出、不重試也不偷看測試集的 SWE-bench 任務比例 |

## 延伸閱讀

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) —— Anthropic 的參考框架
- [Cursor 3 changelog](https://cursor.com/changelog) —— Agent Tabs 與 Composer 2 的產品說明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) —— 供 SWE-bench 框架比較用的最小基線
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) —— 配 Opus 4.5 在 SWE-bench Verified 上達 79.2%
- [OpenCode](https://opencode.ai) —— 開源框架，11.2 萬星
- [SWE-bench Pro leaderboard](https://www.swebench.com) —— 這個綜合專案瞄準的那份評估
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— StreamableHTTP、能力中繼資料
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 工具呼叫與詞元用量的 span schema
