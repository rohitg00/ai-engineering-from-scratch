# 專案實戰 16——GitHub Issue 自動轉 PR 自主 Agent（Capstone 16 — GitHub Issue-to-PR Autonomous Agent）

> 為 Issue 打上一枚標籤，自動收穫一個綠燈 PR——這正是 2026 年自主程式設計 Agent 的標準商業產品形態：在雲端沙盒中非同步啟動 Agent、跑通全套單元測試、自動發起可供審查的 PR，並在 PR 正文中附上修復理由。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex 雲端版以及 Google Jules 皆遵循此模式。最艱鉅的工程挑戰在於：如何在無快取的乾淨環境下全自動精準還原程式碼儲存庫的建置環境、杜絕金鑰憑證外洩、嚴格落實每個儲存庫每日預算封頂，並確保 Agent 絕對無法進行危險的 force-push。本專案實戰要求你私有化自建該系統，並在修復成功率與推論成本維度上直接對標各大商業競品。

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:** P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problem｜問題

非同步雲端程式設計 Agent（Async Cloud Coding Agent）與終端機互動式程式設計 Agent（專案實戰 01）代表了截然不同的產品形態。其使用者體驗完全寄生於 GitHub 標籤（Labels）之上：工程師在 GitHub Issue 上打上 `@agent fix this` 標籤，背景排程器隨即在雲端沙盒中喚醒一個 Worker 容器、複製儲存庫、執行測試套件、編輯程式碼、驗證測試翻綠，並最終自動發布一個附上修復理由的 PR。全流程完全無人值守，無需本地終端機介入。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex 雲端版、Google Jules 以及 Factory Droids 皆全面收斂於此架構。

真正的工程難題極其具體：環境自動還原（Agent 必須在完全沒有預先快取特定開發環境的前提下，從零自適應建置程式碼儲存庫）、不穩定測試（Flaky Tests，必須進行多輪重試或動態隔離）、憑證權限控制（GitHub App 必須採用極致收斂的細粒度權限）、每個儲存庫每日成本配額封頂，以及物理層面的防止 force-push（No-force-push）資安防禦。本專案實戰將全面量化該自建系統相較於全託管商業競品的修復成功率、單任務成本與安全防禦指標。

## Concept｜核心概念

整個系統的觸發源自 GitHub Webhook（Issue 打上標籤或 PR 出現評論）。分發器（Dispatcher）將任務送入 AWS SQS 訊息佇列，隨後調度 ECS Fargate 任務或 Lambda。Worker 容器將目標儲存庫複製至 Daytona 或 E2B 隔離沙盒中，並依據儲存庫結構自動推導出的通用 Dockerfile（自動辨析程式語言與套件管理工具）動態配置執行環境。Agent 調用 mini-swe-agent 或 SWE-agent v2 控制迴圈，後台掛載 Claude Opus 4.7 或 GPT-5.4-Codex。展開自動化循環：精讀程式碼、起草修復補丁、應用修改、執行測試。

在沙盒中驗證 CI 全綠是發起 PR 的必備硬性門禁。在正式開啟 PR 前，沙盒內部的全套 CI 測試必須 100% 通過。系統自動比對測試覆蓋率變動 Delta；若覆蓋率出現異常下滑但所有測試依然全過，PR 仍會開啟但會被強制打上 `needs-review` 標籤。Agent 將完整的修復論證闡述在 PR 正文中，並在 PR 內部建立一個 `@agent` 討論串，供人類審查員隨時發布追問與修改要求。

系統安全性透過 GitHub 兩大不同表面進行立體防禦：GitHub App 簽發短期有效的安裝權杖，僅具備 `workflows: read` 以及極其狹窄的儲存庫內容與 PR 讀寫權限；branch protection 規則（而非單純依賴 App 權限）在伺服器端強制封殺「直接 push 至 `main`」與「force-push」——且該 GitHub App 絕對嚴禁被加入繞過白名單中。由於 GitHub App 權限不支援基於路徑的細粒度控制，Worker 在程式碼層面必須主動攔截任何企圖修改 `.github/workflows` 目錄的危險補丁。每個儲存庫每日預算天花板在分發器端嚴格落實（例如：每個儲存庫每日最多觸發 5 個 PR，單個 PR 推論成本封頂 20 美元）。

## 系統架構

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## 技術堆疊

- 事件觸發：具備細粒度權限的 GitHub App；基於 AWS Lambda 或 Fly.io 的 Webhook 接收閘道器
- 算力工作節點：AWS ECS Fargate 無伺服器容器任務（或 GitHub Actions 自託管 Runner）
- 隔離沙盒：單任務專屬的 Daytona devcontainer 容器或 E2B 安全沙盒
- Agent 迴圈：mini-swe-agent 基準線或 SWE-agent v2，後台對接 Claude Opus 4.7 / GPT-5.4-Codex
- 程式碼檢索：tree-sitter 產出的語義拓撲地圖（repo-map）+ 本地高效 ripgrep
- 驗證閘門：沙盒內部全量 CI 測試執行 + 單元測試覆蓋率 Delta 變動門禁
- 全鏈路可觀測性：Langfuse，在 PR 正文中直接附帶該次修復的專屬 Trace 追蹤連結
- 成本與預算控制：每個儲存庫每日美元花費上限；每個儲存庫每日觸發 PR 數量硬性配額

```figure
cf-issue-to-pr
```

## Build It｜動手實作

1. **GitHub App 細粒度權限配置**。簽發短期安裝權杖：issues: read+write、pull_requests: write、contents: read+write、workflows: read。在 GitHub 儲存庫設定branch protection 規則（唯一具備強制力的控制點），禁止直接 push 到 `main` 或 force-push；該 App 絕不出現在白名單中。在 Worker 程式碼中實施白名單檢查：堅決攔截任何對 `.github/workflows` 目錄下檔案的修改企圖。

2. **Webhook 接收微服務**。開發 Lambda 函式接收 GitHub 的 Issue 標籤與 PR 評論事件。過濾包含 `@agent fix this` 的特定標籤。將合法任務即時寫入 SQS 佇列。

3. **智慧任務分發器**。自 SQS 消費任務。檢查該儲存庫當日的累積花費與觸發計數，實施預算熔斷。動態拉起一個全新的 ECS Fargate 任務，傳入儲存庫 URL、Issue 描述與一個全新的 Daytona 沙盒環境。

4. **建置環境自動推導**。自動掃描儲存庫檔案特徵，辨析主開發語言（Python、Node.js、Go、Rust）與套件管理工具（uv、pnpm、go mod、cargo）。若程式碼儲存庫未提供現成的 Dockerfile，自動動態合成一個乾淨的建置容器。

5. **Agent 自動化程式設計迴圈**。調用 mini-swe-agent 或 SWE-agent v2 驅動 Claude Opus 4.7。裝填六大工具：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。設定硬性安全邊界：單任務成本上限 20 美元、執行時間上限 30 分鐘、最多 30 輪 Agent 迴圈。

6. **沙盒全量測試驗收**。在 Agent 宣告修復完成後，強制在沙盒中啟動完整測試套件。調用 jacoco 或 coverage.py 計算覆蓋率變動 Delta。若 CI 測試失敗：立即終止，絕對嚴禁發起 PR；若測試全過但覆蓋率下滑超過 2%：開啟 PR 但強制附帶 `needs-review` 標籤。

7. **自動發布 Pull Request**。將修改 push 至全新的 Agent branch。呼叫 GitHub REST API 建立正式 PR，自動填入：PR 標題、核心修復論證思路、Diff 變更摘要、Langfuse Trace 網址、推論花費、對話輪數。

8. **憑證安全與敏感資訊脫敏**。Worker 容器全程僅持有短期有效的臨時 GitHub App Installation Token。封存終端紀錄前先清除其中的秘密。

9. **全維度橫向評測**。準備 30 道難度各異的真實內部 Issue。客觀度量修復成功率、PR 品質（Diff 行數精簡度、風格吻合度、覆蓋率保存情況）、單題花費與端到端耗時。在完全相同的測試集上，與 Cursor Background Agents 以及 AWS Remote SWE Agents 展開同台較量。

## Use It｜實際應用

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-issue-to-pr.md`。它代表一套由 GitHub App + 雲端非同步 Worker 組成的自動化維運體系，能將打上標籤的 Issue 自動轉化為具備高質量論證、嚴格成本受控且權限最小化的正式 PR。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 30 道真實 Issue 修復成功率 | 端到端全自動修復率（沙盒 CI 全綠 + 測試覆蓋率未嚴重退化） |
| 20 | 產出 PR 的工程品質 | Git Diff 的行數精簡度、覆蓋率保存率、程式碼風格合規度 |
| 20 | 單 Issue 平均耗費與延遲 | 成功修復單個 Issue 的平均推論花費（$）與端到端物理耗時 |
| 20 | 系統安全性與權限控制 | 權限最小化臨時權杖、每個儲存庫每日預算熔斷、禁止 force-push、紀錄中不含憑證 |
| 15 | 人工工程師審閱體驗 | PR 正文修復思路論證的清晰度、失敗重試機制、評論區 @agent 二次互動體驗 |
| **100** | | |

## Exercises｜練習

1. 為系統擴充「不穩定測試（Flaky Test）自動修復」模式：當打上 `@agent stabilize-flake TestX` 標籤時，Worker 自動在沙盒中將該測試連續執行 50 次，並提出旨在穩定該測試的最小變更。
2. 在三道共有 Issue 上，對比自建系統與商業級 Cursor Background Agents 的具體成本與程式碼表現。精確指出兩者在工具調用鏈路上的優劣。
3. 開發一套即時成本監控看板：即時統計每個儲存庫每日花費走勢、單個工程師觸發的累計帳單，並在出現異常頻繁觸發時自動告警。
4. 建構「Dry-Run 演練模式」：在完全不執行龐大 CI 測試的前提下，僅快速生成並開啟一個 Draft 草稿 PR，供工程師低成本快速審查 Agent 的初步思路。
5. 實作過期 branch清理策略：針對開啟超過 7 天且未被合併的過期 Agent branch，自動定時將其清理刪除以釋放雲端資源。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| GitHub App |「具權限範圍的機器人身分」| 具備細緻權限及短效安裝權杖的應用程式 |
| Async cloud agent |「背景 agent」| 在雲端沙盒中執行、無須互動且不依賴終端機的工作者 |
| Environment inference |「Dockerfile 合成」| 偵測程式語言與套件管理器；若沒有 Dockerfile 就產生一份 |
| Verification |「沙盒內 CI」| 開啟 PR 前在工作者環境中執行完整測試套件 |
| Coverage delta |「覆蓋率維持情況」| 從基礎版本到 agent branch 的測試覆蓋率變化 |
| Per-repo budget |「每日上限」| 由分發器強制執行的金額與 PR 數量上限 |
| Rationale |「PR 正文說明」| agent 對變更內容與原因的摘要；必須寫在 PR 正文中 |

## Further Reading｜延伸閱讀

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 非同步雲端程式設計 Agent 標竿級官方開源專案。
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — 經典命令列自主程式設計 Agent 核心庫。
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商業級非同步背景程式設計 Agent 參考手冊。
- [OpenAI Codex (cloud)](https://openai.com/codex) — 雲端全託管程式設計 Agent 服務。
- [Google Jules](https://jules.google) — Google 官方非同步程式設計 Agent。
- [Factory Droids](https://www.factory.ai) — 企業級自動化軟體工程工廠平台。
- [GitHub App documentation](https://docs.github.com/en/apps) — 細粒度權限機器人身分認證官方手冊。
- [Daytona cloud sandboxes](https://daytona.io) — 雲端隔離開發沙盒最佳實踐。
