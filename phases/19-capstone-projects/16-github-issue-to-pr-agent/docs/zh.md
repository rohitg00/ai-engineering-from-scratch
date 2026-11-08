# 綜合專案 16 —— GitHub 議題轉 PR 的自主代理

> 替議題貼個標籤，就拿到一份 PR —— 這是 2026 年自主寫程式代理的產品形狀：在雲端沙箱裡跑一個代理、驗證測試通過，然後貼出一份帶理據、可供審查的 PR。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud，以及 Google Jules，全都出貨了它。難的部分在於自動重現該儲存庫的建置環境、防止憑證外洩、強制執行逐儲存庫的預算，以及確保代理不能強制推送。這個綜合專案要建出自架版本，並在成本與通過率上與那些託管替代方案做比較。

**類型：** 總結專案
**程式語言：** Python (agent), TypeScript (GitHub App), YAML (Actions)
**先修單元：** 階段 11（LLM 工程）、階段 13（工具）、階段 14（代理）、階段 15（自主）、階段 17（基礎設施）
**演練到的階段：** P11 · P13 · P14 · P15 · P17
**時間：** 30 小時

## 問題

非同步的雲端寫程式代理，與互動式寫程式代理（綜合專案 01）是不同的產品類別。它的使用體驗是一個 GitHub 標籤。你替議題貼上 `@agent fix this`，一個工作者就在雲端沙箱裡啟動、複製儲存庫、跑測試、編輯檔案、驗證，然後開一份 PR，內文帶著代理的理據。沒有互動迴路，沒有終端機。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules 與 Factory Droids 全都收斂到這個形狀。

工程挑戰很具體：環境重現（代理得在沒有快取開發映像檔的情況下從頭建起這個儲存庫）、不穩定的測試（必須重跑或隔離）、憑證範圍收窄（一個帶最小細緻權限的 GitHub App）、逐儲存庫逐日的預算強制，以及不得強制推送的政策。這個綜合專案量測通過率、成本，以及相對託管替代方案的安全性。

## 概念

觸發器是一個 GitHub webhook（議題標籤或 PR 留言）。一個派送器把工作排進 ECS Fargate 或 Lambda。工作者用一份從儲存庫推論出來的通用 Dockerfile（語言、框架），把儲存庫拉進一個 Daytona 或 E2B 沙箱。代理對著 Claude Opus 4.7 或 GPT-5.4-Codex 跑一條 mini-swe-agent 或 SWE-agent v2 迴路。它反覆迭代：讀程式碼、提出修正、套用修補、跑測試。

驗證是那道把關步驟。開 PR 之前，完整的 CI 必須在沙箱裡通過。覆蓋率差值會被算出來；若負得超過門檻，PR 照開但會被貼上 `needs-review` 標籤。代理把理據貼成 PR 描述，加上一條 `@agent` 討論串，供審查者追問。

安全性透過兩個不同的 GitHub 面向收窄：那個 App 提供一個帶 `workflows: read` 與收窄的儲存庫內容／PR 範圍的短生命週期安裝權杖；而分支保護（不是 app 權限）強制執行「不得直接寫入 `main`」與「不得強制推送」—— 那個 app 從不被加進豁免清單。對 `.github/workflows` 的路徑範圍唯讀存取並不是 GitHub App 真有的原語，所以代理在檔案編輯上的允許清單，得在工作者那端強制執行。逐儲存庫逐日的預算上限在派送器上強制執行（例如每個儲存庫每天最多 5 份 PR、每份 PR 20 美元）。

## 架構

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

- 觸發：帶細緻權限權杖的 GitHub App；webhook 接收器走 Lambda 或 Fly.io
- 工作者：ECS Fargate 任務（或 GitHub Actions 自架執行器）
- 沙箱：每項任務一個 Daytona devcontainer 或 E2B 沙箱
- 代理迴路：mini-swe-agent 基線，或跑在 Claude Opus 4.7 / GPT-5.4-Codex 上的 SWE-agent v2
- 檢索：tree-sitter 的儲存庫地圖 + ripgrep
- 驗證：沙箱內的完整 CI + 覆蓋率差值閘門
- 可觀測性：Langfuse，並在 PR 內文連到逐 PR 的軌跡封存
- 預算：逐儲存庫的每日美元上限；每個儲存庫每天最多幾份 PR

```figure
cf-issue-to-pr
```

## 動手實作

1. **GitHub App。** 細緻權限的安裝權杖：issues 讀+寫、pull_requests 寫、contents 讀+寫、workflows 讀。分支保護（唯一做得到這件事的面向）強制執行「不得直接推送到 `main`」與「不得強制推送」；那個 app 不在豁免清單裡。由於 GitHub App 權限不支援路徑範圍，工作者要以「對提案差異做允許清單檢查」的方式，強制執行「不得寫入 `.github/workflows` 底下」。

2. **Webhook 接收器。** 一個 Lambda 函式接受議題標籤／PR 留言的 webhook。依 `@agent fix this` 標籤過濾。排進 SQS。

3. **派送器。** 從 SQS 取出任務。強制執行逐儲存庫逐日的預算。啟動一個 ECS Fargate 任務，帶上儲存庫網址、議題內文，以及一個全新的 Daytona 沙箱。

4. **環境推論。** 偵測語言（Python、Node、Go、Rust）與套件管理器（uv、pnpm、go mod、cargo）。若不存在 Dockerfile 就即時生一份出來。

5. **代理迴路。** mini-swe-agent 或 SWE-agent v2 配 Claude Opus 4.7。工具：ripgrep、tree-sitter 儲存庫地圖、read_file、edit_file、run_tests、git。硬性上限：20 美元成本、30 分鐘實際時間、30 個代理輪次。

6. **驗證。** 迴路結束後，在沙箱裡跑完整的測試套件。透過 jacoco / coverage.py 算出覆蓋率差值。若 CI 紅燈：停下，不要開 PR。若覆蓋率掉超過 2%：開 PR 但貼上 `needs-review` 標籤。

7. **PR 張貼。** 推送代理分支。透過 GitHub API 開 PR，帶上：標題、理據、差異摘要、軌跡網址、成本、輪數。

8. **憑證衛生。** 工作者以短生命週期的 GitHub App 安裝權杖執行。日誌在封存前先清洗掉密鑰。

9. **評估。** 30 個難度不一、預先種好的內部議題。量測通過率、PR 品質（差異大小、風格、覆蓋率）、成本、延遲。在同一批議題上與 Cursor Background Agents 及 AWS Remote SWE Agents 比較。

## 框架應用

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

## 產出交付

`outputs/skill-issue-to-pr.md` 就是那份交付物。一個 GitHub App + 非同步雲端工作者，把貼了標籤的議題變成可供審查的 PR，並帶有界的成本與收窄的憑證。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 30 個議題上的通過率 | 端到端成功（CI 綠燈 + 覆蓋率沒問題） |
| 20 | PR 品質 | 差異大小、覆蓋率差值、風格一致性 |
| 20 | 每個已解決議題的成本與延遲 | 每份 PR 的花費與實際時間 |
| 20 | 安全性 | 範圍收窄的權杖、逐儲存庫預算、不得強制推送、憑證衛生 |
| 15 | 運營者使用體驗 | 理據留言、重試的可操作性、@ 提及的追問 |
| **100** | | |

## 練習

1. 加上一個「修不穩定測試」模式：標籤 `@agent stabilize-flake TestX` 會在沙箱裡把那個測試跑 50 次，並提出一項讓它穩定下來的最小改動。

2. 在三個共同議題上與 Cursor Background Agents 比較成本。回報哪套工具在哪裡勝出。

3. 實作一個預算儀表板：逐儲存庫逐日的成本、逐使用者的成本。異常時發警報。

4. 建一個「試跑」模式，開一份不跑 CI 的草稿 PR，好讓審查者能用很低的成本檢視那份計畫。

5. 加上一套保存政策：超過 7 天未合併的 PR 分支自動刪除。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| GitHub App | 「範圍收窄的機器人身分」 | 帶細緻權限 + 短生命週期安裝權杖的 App |
| 非同步雲端代理 | 「背景代理」 | 跑在雲端沙箱、而不是終端機裡的非互動式工作者 |
| 環境推論 | 「Dockerfile 合成」 | 偵測語言 + 套件管理器，沒有就生一份 Dockerfile |
| 驗證 | 「沙箱裡的 CI」 | 開 PR 之前先在工作者內部跑完整測試套件 |
| 覆蓋率差值 | 「覆蓋率保存度」 | 從基底到代理分支之間測試覆蓋率百分比的變化 |
| 逐儲存庫預算 | 「每日上限」 | 在派送器上強制執行的美元與 PR 數上限 |
| 理據 | 「PR 內文的說明」 | 代理對「改了什麼、為什麼改」的摘要；PR 內文必備 |

## 延伸閱讀

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) —— 非同步雲端代理的經典參考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) —— CLI 的參考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) —— 商業替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) —— 託管式競品
- [Google Jules](https://jules.google) —— Google 的託管版本
- [Factory Droids](https://www.factory.ai) —— 另一個商業參考
- [GitHub App documentation](https://docs.github.com/en/apps) —— 範圍收窄的機器人身分
- [Daytona cloud sandboxes](https://daytona.io) —— 參考用的沙箱
