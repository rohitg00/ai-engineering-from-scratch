# 專案實戰 01——終端機原生程式設計 Agent（Capstone 01 — Terminal-Native Coding Agent）

> 到了 2026 年，程式設計 Agent（Coding Agent）的架構形態已趨於定型。終端機文字介面（TUI）執行環境、帶有持久狀態的計畫看板、沙盒隔離的工具介面，以及一個不斷循環進行「規劃、行動、觀察、復原」的核心控制迴圈。從 50 英尺外看去，Claude Code、Cursor 3 與 OpenCode 採用相似架構的不同變體。本專案實戰要求你從零開始端到端打造一個完整的程式設計 Agent——終端機命令列輸入，GitHub Pull Request 輸出——並在嚴苛的 SWE-bench Pro 上對標 mini-swe-agent 與 Live-SWE-agent 展開真實能力較量。你將在實戰中深刻體會到：最艱鉅的工程挑戰從來不是模型呼叫，而是工具呼叫的穩定性、沙盒，以及一場長達 50 輪對話中對 Token 成本天花板的極限控制。

**Type:** Capstone
**Languages:** TypeScript / Bun (harness), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## Problem｜問題

程式設計 Agent 在 2026 年是生成式 AI 的主導應用類別。Anthropic 的 Claude Code、Cursor 3 搭載的 Composer 2 與 Agent Tabs、Sourcegraph 的 Amp、獲得 11.2 萬顆星的 OpenCode、Factory Droids 以及 Google Jules，其底層採用相似架構的不同變體：終端機封裝執行環境、具備權限受控的工具呼叫層、安全的沙盒執行環境，以及圍繞前沿頂尖模型建構的「規劃-行動-觀察」控制迴圈。前沿效能差距在紙面上看似狹窄——Live-SWE-agent 搭配 Claude Opus 4.5 在 SWE-bench Verified 上達到 79.2%——但其中牽涉的工程面向相當廣泛。多數失敗模式並非模型錯誤，而是工具迴圈不穩定、上下文污染、Token 成本失控，以及破壞性檔案系統操作。

你絕無法僅憑紙上談兵來洞悉這些 Agent 的真實靈魂。你必須親自動手打造一個，親眼看著它在第 47 輪時因 ripgrep 回傳 8MB 的匹配結果而當機，並親手重構文字截斷保護層。這正是本專案實戰的重點。

## Concept｜核心概念

整個 Agent 執行環境包含四大核心表面。**規劃（Plan）**維護一個類似 TodoWrite 風格的狀態物件，模型在每一輪對話中皆會重寫該狀態。**行動（Act）**負責安全地派送工具呼叫（讀取檔案、編輯檔案、執行指令、全庫搜尋、Git 版本控制）。**觀察（Observe）**負責捕獲終端標準輸出、標準錯誤與結束碼，並進行安全截斷與提煉摘要。**復原（Recover）**負責處理工具錯誤，同時避免耗盡上下文視窗或陷入無限迴圈。2026 年的現代架構標準在此基礎上引入了核心神經：**生命週期鉤子（Hooks）**。涵蓋 `PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 與 `PreCompact`——這些高度可配置的擴充插槽，讓操作者能注入資安策略、全鏈路遙測與安全防護欄。

沙盒隔離採用 E2B 或 Daytona。每一個獨立任務皆在一個全新的 devcontainer 容器中運作，並掛載專屬的讀寫 Git Worktree 工作樹。Agent 執行環境絕對嚴禁碰觸主機本機檔案系統。無論任務成功還是失敗，Worktree 皆會在結束時被自動安全銷毀。成本控制在三大防線上層層設卡：單輪 Token 上限、每個工作階段的美元預算，以及硬性的最大輪數限制（通常為 50 輪）。可觀測性則全面採用遵循 OpenTelemetry GenAI 語意約定的 Trace，並將 OpenTelemetry spans 傳送至自建 Langfuse。

## 系統架構

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

- 執行環境：Bun 1.2 + Ink 5（React-in-terminal）
- 模型存取抽象層：OpenRouter 統一 API，無縫對接 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro 以及處理極端難題的 Opus 4.5
- 工具通訊協定：Model Context Protocol StreamableHTTP（2026 年最新雙向串流協定）
- 沙盒執行環境：E2B 雲端沙盒（JS SDK）或 Daytona devcontainer 容器
- 程式碼檢索：本機 ripgrep 子行程 + 針對 17 種程式語言預先編譯的 tree-sitter AST 解析器
- 檔案實體隔離：按任務動態執行 `git worktree add`，在成功或失敗時自動徹底清理
- 評測驗收基準：SWE-bench Pro（Verified 驗證子集） + Terminal-Bench 2.0 + 自建的 30 道真實保留測試題
- 全鏈路可觀測性：OpenTelemetry SDK 搭配 `gen_ai.*` 語意約定 → 私有自建 Langfuse
- 自動開啟 PR：具備細粒度權限的 GitHub App，權限嚴格限制在目標程式碼儲存庫內部

```figure
ce-agent-loop
```

## Build It｜動手實作

1. **TUI 與命令列核心迴圈**。使用 Ink 架構一個標準的 Bun 專案。支援在終端機輸入 `agent run <repo> "<task>"`。繪製分屏視圖：計畫面板（頂部）、工具呼叫串流（中部）、Token 預算進度條（底部）。支援按下 Ctrl-C 時安全攔截，並在退出前強制觸發 `SessionEnd` 鉤子。

2. **計畫看板狀態管理**。定義強型別的 TodoWrite Schema（涵蓋 pending、in_progress、done 狀態項並附帶備忘筆記）。要求模型在每一輪對話中皆透過工具呼叫全量重寫該狀態——絕不允許模型進行增量局部的模糊修改。將計畫狀態即時持久化至 `.agent/state.json`，確保意外當機後能從該狀態接續執行。

3. **工具介面定義**。封裝六大核心工具：`read_file`、`edit_file`（支援 Diff 預覽）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（附帶逾時強制中斷機制）、`git`（涵蓋 status、diff、commit、push）。透過 MCP StreamableHTTP 協定對外暴露，使執行環境不依賴特定傳輸方式。每個工具強制實施輸出截斷保護（單次呼叫嚴格限制在 4k Token 以內）。

4. **沙盒環境安全封裝**。每個任務啟動時動態建立一個全新的 E2B 沙盒。執行 `git worktree add -b agent/$TASK_ID` 開闢全新的獨立 branch。所有工具指令全部在沙盒容器內部被隔離執行。沙盒無法存取主機檔案系統。

5. **生命週期鉤子體系**。完整實作 2026 年八大標準鉤子類型。至少編寫並掛載四大關鍵自定義鉤子：(a) `PreToolUse` 破壞性指令防護欄，主動攔截針對 Worktree 目錄以外的 `rm -rf` 違規指令；(b) `PostToolUse` 即時 Token 消耗記帳；(c) `SessionStart` 預算配額初始化；(d) `Stop` 在終止時打包產出最終的 Trace 追蹤審查包。

6. **自動化評測迴圈**。克隆包含 30 道 Python 真實任務的 SWE-bench Pro 子集。驅動你的 Agent 執行環境逐一攻克難題。在 pass@1 首次通過率、單任務平均輪數與單任務平均花費三個維度上，與最小基準 mini-swe-agent 比較。將評測結果寫入 `eval/results.jsonl`。

7. **嚴苛的成本控制熔斷**。設置硬性安全紅線：最大 50 輪對話、20 萬 Token 上下文總量上限、單任務 5 美元支出封頂。當上下文達到 15 萬 Token 警戒線時，`PreCompact` 鉤子自動啟動，將歷史輪次的細節壓縮提煉為精煉的「歷史狀態回顧區塊」，在完全不丟失既有計畫的前提下為後續的全新工具觀察騰出充裕空間。

8. **自動開啟 Pull Request**。任務驗證成功後，系統最終執行 `git push` 並呼叫 GitHub API 自動建立一個 PR，將詳細的解決計畫看板與 Git Diff 變更摘要完整渲染在 PR 的 Body 說明中。

## Use It｜實際應用

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

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-terminal-coding-agent.md`。輸入一個程式碼儲存庫路徑與一項具體的任務需求描述，該 Skill 將在沙盒環境中自動運作完整的「規劃-行動-觀察」閉環，並最終回傳正式的 GitHub PR 連結與端到端 Trace 追蹤封裝包。本專案實戰驗收評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 相較於基準 | 在 30 道匹配的 Python 任務上，與 mini-swe-agent 展開橫向對比 |
| 20 | 軟體架構清晰度 | 規劃／行動／觀察三者徹底解耦、鉤子體系完備、工具 Schema 設計嚴謹，比照 Live-SWE-agent 標準審查 |
| 20 | 系統安全性與隔離防禦 | 通過沙盒逃逸測試、敏感操作具備權限提示、破壞性指令攔截器通過頂級紅隊測試 |
| 20 | 全鏈路可觀測性 | Trace 覆蓋率達到 100%（每一次工具呼叫皆擁有獨立 Span）、逐輪 Token 消耗即時記帳 |
| 15 | 開發者體驗（DX） | 冷啟動耗時 < 2 秒、意外當機後重啟能接續執行計畫、按下 Ctrl-C 能在工具執行中途優雅清理退出 |
| **100** | | |

## Exercises｜練習

1. 將後台主力模型從 Claude Sonnet 4.7 替換為在 vLLM 上私有託管的 Qwen3-Coder-30B。重新度量 pass@1 通過率與單任務平均成本。指出開源模型在哪些方面表現較差？
2. 在系統中追加一個 `reviewer` 審查者子 Agent：在正式開啟 PR 之前先審查 Git Diff，並可要求進行修訂。測量引入審查者後，其偽陽性誤判是否反而導致 SWE-bench 最終通過率低於單 Agent 裸奔基準線（提示：在實務中通常確實如此）？
3. 對沙盒實施極限壓力測試：編寫一個試圖透過 `curl` 存取外部受限網路的惡意任務，以及一個試圖向 Worktree 以外路徑寫入檔案的任務。確認兩者皆被 PreToolUse 鉤子即時攔截並記錄安全審查紀錄。
4. 呼叫更小型的模型（如 Haiku 4.5）實作 `PreCompact` 上下文壓縮演算法。測量計畫保真度在 3 倍壓縮下的損失。
5. 將底層工具傳輸協定從 MCP StreamableHTTP 替換為傳統的 stdio 管線。基準測量兩者在冷啟動耗時與單次呼叫延遲上的具體差距。針對純本機運作場景給出明確的選型裁決。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Harness |「agent 迴圈」| 包圍模型的程式碼，負責派送工具、維護計畫狀態及執行預算限制 |
| Hook |「agent 事件監聽器」| 使用者撰寫的指令碼，由執行環境在八種生命週期事件之一發起 |
| Worktree |「Git 沙盒」| 位於不同路徑的連結式 Git 工作目錄；可在不影響主要複本的情況下丟棄 |
| TodoWrite |「計畫狀態」| 具型別的待處理／進行中／已完成項目清單，模型每輪都會重寫 |
| StreamableHTTP |「MCP 傳輸方式」| 2026 年 MCP 版本中的長時間 HTTP 連線，支援雙向串流；取代 SSE |
| Token ceiling |「上下文預算」| 每輪或每個工作階段的輸入與輸出 Token 上限；達到後會觸發壓縮或終止 |
| pass@1 |「單次嘗試通過率」| 首次執行就解決的 SWE-bench 任務比例，且未重試或偷看測試集 |

## Further Reading｜延伸閱讀

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 官方參考執行環境架構手冊。
- [Cursor 3 changelog](https://cursor.com/changelog) — Agent Tabs 與 Composer 2 產品架構演進筆記。
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — SWE-bench 執行環境極簡對照基準開源專案。
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — 搭配 Opus 4.5 斬獲 79.2% SWE-bench Verified 戰績的開源 Agent。
- [OpenCode](https://opencode.ai) — 擁有 11.2 萬星標的開源頂級程式設計 Agent。
- [SWE-bench Pro leaderboard](https://www.swebench.com) — 本專案實戰所鎖定的權威評測排行榜。
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP 與 capability metadata 路線圖。
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — LLM 工具呼叫與 Token 記帳專屬 Span Schema。
