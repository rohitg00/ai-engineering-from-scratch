# 專案實戰 09——程式碼遷移 Agent（儲存庫層級語言與執行環境升級）（Capstone 09 — Code Migration Agent (Repo-Level Language / Runtime Upgrade)）

> 亞馬遜的 MigrationBench（Java 8 到 Java 17）與 Google App Engine 的 Python 2 到 Python 3 遷移器訂定 2026 年基準。Moderne 的 OpenRewrite 負責大規模確定性 AST 語法樹重寫。Grit 則透過 Codemod 風格的 DSL 攻克對等問題。正式環境的成熟架構將兩者深度結合：由確定性底座執行高安全性的機械重寫，由 Agent 智慧層解決語義模糊的棘手邊界，在branch 層級隔離沙盒中持續進行建置測試，並確保在自動開啟 PR 前 CI 測試全線翻綠。本專案實戰要求你針對 50 個真實儲存庫執行全自動遷移，產出精確的通過率資料，並建立一套系統化的遷移失敗分類學。

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problem｜問題

大規模程式碼遷移是 2026 年程式設計 Agent 最明確的正式環境應用之一。其 Ground Truth 客觀真值極為明確（遷移後測試套件是否通過？）、商業價值具體直接（大規模 Java 8 遷移往往是需要大量人力投入的專案），且具備公開的客觀基準測試（包含 50 個真實程式碼儲存庫的 MigrationBench 子集）。Moderne 的 OpenRewrite 完美掌控了確定性重寫。然而 Agent 智慧層則負責收拾 OpenRewrite 預設配方所無法應對的一切混亂：語義模糊的重寫、建置系統版本漂移、冷門語法邊界，以及傳遞性依賴破壞（Transitive Dependency Breakage）。

你將親手建構一個 Agent：輸入一個遺留的 Java 8 儲存庫（或 Python 2 儲存庫），自動輸出一個 CI 綠燈通過的升級branch。你將嚴格度量遷移通過率、測試覆蓋率保持率、每個儲存庫耗費成本，並建置一套詳盡的失敗分類學。透過將其與純確定性工具展開平行對比，你將清晰看到 Agent 智慧層的核心增益價值究竟體現在何處。

## Concept｜核心概念

整個遷移管線採用雙層架構。**確定性基座（Deterministic Substrate）**（Java 端採用 OpenRewrite，Python 端採用 libcst）安全高效地完成絕大多數機械性重寫：import 語句替換、方法簽名修正、空值安全相關改寫、try-with-resources 語法轉換、已棄用 API 替換。其特點是執行極速且產出的 Git Diff 完全具備審計性。**Agent 智慧層**（基於 OpenAI Agents SDK 或 LangGraph 編排 Claude Opus 4.7 與 GPT-5.4-Codex）專門攻克配方無法覆蓋的死角：建置配置檔案升級（Maven pom.xml / Gradle / pyproject.toml）、傳遞性依賴版本衝突、不穩定的 Flaky 測試修復、垂直自訂註解調整。

每個待遷移儲存庫皆分配一個預先安裝好目標執行環境（Java 17 或 Python 3.12）的 Daytona 獨立沙盒容器。Agent 展開自動化迭代迴圈：執行建置、分類故障原因、實施修補、重新建置。系統設定硬性熔斷邊界：每個儲存庫最多運行 30 分鐘、花費封頂 8 美元、最多執行 20 輪 Agent 控制迴圈。若所有測試全綠通過且測試覆蓋率未發生負向回退，系統會為該 branch 開啟 GitHub Pull Request；否則，該儲存庫將連同完整的錯誤紀錄與復現步驟被歸檔至專屬的失敗分類目錄中。

失敗分類學（Failure Taxonomy）是本專案實戰的核心研究交付物。遍歷 50 個程式碼儲存庫後，究竟是什麼原因導致了遷移中斷？傳遞性相依套件衝突？冷門自定義註解？建置工具自身版本不相容？還是原本就存在的脆弱測試？每個失敗大類皆必須統計發生頻次並附帶經典的 Git Diff 案例。未來的規則編寫者即可精準針對前三大失敗類別研製新的自動化確定性配方。

## 系統架構

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## 技術堆疊

- 確定性重寫基座：OpenRewrite（Java 領域）或 libcst（Python 領域）
- Agent 編排引擎：OpenAI Agents SDK 或 LangGraph，後台對接 Claude Opus 4.7 + GPT-5.4-Codex
- 隔離沙盒環境：Daytona branch 層級 devcontainer 容器，預裝目標執行環境（Java 17 / Python 3.12）
- 專案建置系統：Maven、Gradle、Python uv 高效能套件管理器
- 權威評測基準：亞馬遜 MigrationBench 50 個儲存庫精選子集（Java 8 至 17）、Google App Engine Py2 至 Py3 儲存庫集
- 自動化測試套件：並行測試執行器，使用 Jacoco（Java）或 coverage.py（Python）度量覆蓋率
- 全鏈路可觀測性：Langfuse，記錄每個儲存庫的完整探索軌跡並快照每一段產出的 Diff 區塊
- 視覺化儀表板：失敗分類學儀表板，即時呈現各類別統計計數與典型 Diff 範例

```figure
ce-migration-funnel
```

## Build It｜動手實作

1. **確定性配方批次掃描**。首先調用 OpenRewrite（Java）或 libcst（Python）官方重寫配方。自動吃下 70% 至 80% 的機械性語法升級。將變更打包成「recipe」初始 commit。

2. **沙盒建置試驗**。啟動 Daytona 隔離沙盒：載入目標高版本執行環境，在沙盒中啟動專案編譯。若建置通過，跳過 Agent 直接進入測試環節；若建置失敗，無縫交接給 Agent 智慧層。

3. **Agent 修復控制迴圈**。使用 LangGraph 封裝五大專屬工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。Agent 智能辨析編譯報錯類型（依賴缺失、語法棄用、測試失敗、建置工具問題）並對原始碼實施精準修補。重新觸發建置。

4. **嚴苛的成本與超時熔斷**。設置硬性物理保護：每個儲存庫最多執行 30 分鐘、花費上限 8 美元、最多進行 20 輪工具調用。任何一項指標突破紅線，系統即刻強制終止，並將當前變更歸檔至 budget_exhausted 類別中。

5. **測試與覆蓋率嚴格閘門**。專案編譯綠燈通過後，強制執行完整測試套件。嚴格計算測試覆蓋率並與遷移前的基準進行比對。若測試覆蓋率出現超過 2% 的下滑，強制歸檔至 coverage_regression 失敗類別。

6. **自動開啟 Pull Request**。全部測試綠燈通過後，系統自動將 branch push 至遠端 GitHub，自動發起 PR，並在 PR 正文中詳細列出：哪些修改是由確定性配方自動完成的、哪些 Commit 是由 Agent 智慧層自主修復的。

7. **失敗原因分類體系建置**。針對所有未能全自動跑通的程式碼儲存庫，自動打上精確的分類標籤：`dep_upgrade_required`（需要手動升級外部依賴）、`build_tool_drift`（建置工具底層行為變更）、`custom_annotation`（私有自定義註解失效）、`test_flake`（測試本身存在隨機波動）、`syntax_edge_case`（極端冷門語法）、`budget_exhausted`（算力預算耗盡）。開發前端儀表板集中呈現。

8. **50 個儲存庫端到端實戰大考**。在 MigrationBench 的 50 個儲存庫子集上啟動全量遷移。輸出詳細報告：各類別遷移成功率、每個儲存庫平均成本、測試覆蓋率保存情況，並產出相對於「純確定性工具」的橫向對照資料。

## Use It｜實際應用

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-migration-agent.md`。輸入一個程式碼儲存庫，該 Skill 將自動調度確定性配方與 Agent 智慧修復迴圈，輸出綠燈通過的升級branch，或將該儲存庫歸檔至精確的分類學目錄。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | MigrationBench 遷移通過率 | 在 50 個真實專案子集上的 pass@1 首次成功率 |
| 20 | 測試覆蓋率保存完整度 | 遷移成功branch相較於基準branch的平均覆蓋率變動 Delta |
| 20 | 每個儲存庫平均遷移成本 | 遷移成功儲存庫的每個儲存庫的成本（$/repo） |
| 20 | 確定性工具與 Agent 協同效率 | 統計分析由 OpenRewrite 處理與由 Agent 撰寫的修正比例 |
| 15 | 失敗分類學研究報告品質 | 分類體系的完備性、資料統計維度以及典型 Git Diff 案例的深刻度 |
| **100** | | |

## Exercises｜練習

1. 僅調用 OpenRewrite 確定性配方（完全不啟用 Agent 智慧修復迴圈）運行整條遷移管線。對比兩者在 50 個儲存庫上的通過率差距。指出哪些案例中 Agent 帶來額外改善。
2. 引入「程式碼風格（Lint-Clean）」強制檢查：遷移完成後，在沙盒中調用靜態程式碼檢查工具（Java 端使用 Spotless，Python 端使用 Ruff）。若遷移後的程式碼引入了新的風格違規，強制打回 PR。度量「測試全過但因程式碼風格退化而失敗」的發生比例。
3. 為系統加入一個「最小 Diff（Minimal-Diff）最佳化器」：在 Agent branch成功跑通所有測試後，啟動第二輪清理掃描，精確剔除所有不必要的格式更動或無效冗餘程式碼。度量開啟該模組後 Git Diff 大小的縮減幅度。
4. 將該架構橫向遷移至第三種升級情境：Node.js 18 升級至 Node.js 22。複用相同的沙盒隔離機制；將配方層替換為自定義的 JavaScript Codemod 腳本。
5. 將「首個綠燈建置耗時（TTFGB，Time-to-first-green-build）」作為關鍵工程體驗指標進行度量。目標：p50 低於 10 分鐘。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Deterministic substrate |「配方引擎」| OpenRewrite／libcst：具安全性保證的宣告式 AST 改寫 |
| Codemod |「修改程式碼的程式」| 以機械方式改寫原始碼的規則 |
| Build drift |「工具版本差異」| Maven／Gradle／uv 的主要版本之間細微的行為變化 |
| Failure class |「分類項目」| 儲存庫遷移失敗的標籤原因：相依套件、語法、測試、建置工具或預算 |
| Coverage delta |「覆蓋率維持情況」| 從基礎版本到遷移後 branch 的測試覆蓋率變化 |
| Agent turn |「工具呼叫輪次」| agent 迴圈中一輪「規劃 → 行動 → 觀察」 |
| Budget exhaustion |「達到上限」| 儲存庫已用完 30 分鐘／8 美元／20 輪限制，但仍未通過 |

## Further Reading｜延伸閱讀

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年程式碼遷移領域權威基準測試集。
- [Moderne.io OpenRewrite platform](https://www.moderne.io) — 確定性 AST 語法樹重寫基座官方平台。
- [OpenRewrite documentation](https://docs.openrewrite.org) — 自動化程式碼重寫配方開發指南。
- [Grit.io](https://www.grit.io) — 基於自定義 DSL 的新型 Codemod 框架。
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — 基於 Agents SDK 的沙盒程式碼遷移實例指南。
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) — 經典大規模語言遷移工程參考。
- [libcst](https://github.com/Instagram/LibCST) — Python 確定性語法樹解析與重寫核心庫。
- [Daytona sandboxes](https://daytona.io) — branch 層級安全開發沙盒官方平台。
