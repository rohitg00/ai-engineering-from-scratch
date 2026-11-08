# 綜合專案 09 —— 程式碼遷移代理（儲存庫層級的語言／執行環境升級）

> Amazon 的 MigrationBench（Java 8 到 17）與 Google 的 App Engine Py2 轉 Py3 遷移器立下了 2026 年的標準。Moderne 的 OpenRewrite 大規模執行確定性的 AST 改寫。Grit 則用 codemod 風格的 DSL 瞄準同一個問題。生產上的模式把兩者結合：一層確定性的基底做安全改寫，加上一層代理處理那些模稜兩可的案例、一個做逐分支建置的沙箱，以及一套在 PR 開出去之前就轉綠的測試框架。這個綜合專案就是要遷移 50 個真實儲存庫，並發表一份通過率與一套失敗分類法。

**類型：** 總結專案
**程式語言：** Python (agent), Java / Python (targets), TypeScript (dashboard)
**先修單元：** 階段 5（NLP）、階段 7（transformer）、階段 11（LLM 工程）、階段 13（工具）、階段 14（代理）、階段 15（自主）、階段 17（基礎設施）
**演練到的階段：** P5 · P7 · P11 · P13 · P14 · P15 · P17
**時間：** 30 小時

## 問題

大規模程式碼遷移是 2026 年寫程式代理最乾淨的生產應用之一。標準答案很明顯（遷移後測試套件過不過？）、回報是實在的（一支 Java 8 艦隊的遷移是人力規模等級的專案），而且基準是公開的（MigrationBench 的 50 個儲存庫子集）。Moderne 的 OpenRewrite 處理確定性那一側。代理層處理 OpenRewrite 配方做不到的一切：模稜兩可的改寫、建置系統的漂移、長尾語法、傳遞相依性的斷裂。

你會建一個代理，吃下一個 Java 8 儲存庫（或 Python 2 儲存庫），產出一條 CI 全綠的遷移分支。你會量測通過率、測試覆蓋率保存度、每個儲存庫的成本，並建出一套失敗分類法。與「只用確定性工具」基線的並排比較，會告訴你代理的價值實際落在哪裡。

## 概念

這條管線有兩層。**確定性基底**（Java 用 OpenRewrite，Python 用 libcst）安全地跑完大部分機械式改寫：匯入、方法簽章、空值安全的編輯、try-with-resources、被棄用 API 的替換。它很快，而且產出可稽核的差異。**代理層**（OpenAI Agents SDK 或跑在 Claude Opus 4.7 與 GPT-5.4-Codex 上的 LangGraph）處理那些配方做不到的案例：建置檔升級（Maven/Gradle/pyproject）、傳遞相依性衝突、測試不穩定、自訂註解。

每個儲存庫都拿到一個預裝目標執行環境的 Daytona 沙箱。代理反覆迭代：跑建置、把失敗分類、套用修正、再跑一次。硬性上限：每個儲存庫 30 分鐘、8 美元、20 個代理輪次。若所有測試通過、且覆蓋率差值不為負，那條分支就開一份 PR。若不然，這個儲存庫就連同證據被歸到某個失敗類別底下。

那套失敗分類法才是交付物。橫跨 50 個儲存庫，是什麼壞了？傳遞相依性？自訂註解？建置工具版本？跟遷移無關的測試不穩定？每一類都給一個計數與一份範例差異。未來寫配方的人就能瞄準前三名。

## 架構

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

- 確定性基底：OpenRewrite（Java）或 libcst（Python）
- 代理：OpenAI Agents SDK，或跑在 Claude Opus 4.7 + GPT-5.4-Codex 上的 LangGraph
- 沙箱：每條分支一個 Daytona devcontainer，預裝目標執行環境（Java 17 / Python 3.12）
- 建置系統：Maven、Gradle、uv（Python）
- 基準：Amazon MigrationBench 的 50 個儲存庫子集（Java 8 到 17）、Google App Engine 的 Py2 轉 Py3 儲存庫
- 測試框架：平行執行器，覆蓋率用 Jacoco（Java）或 coverage.py（Python）
- 可觀測性：Langfuse + 每個儲存庫一份含所有差異片段的軌跡打包檔
- 儀表板：帶逐類別計數與範例差異的失敗分類法儀表板

```figure
ce-migration-funnel
```

## 動手實作

1. **配方階段。** 先跑 OpenRewrite（Java）或 libcst（Python）配方。抓下那 70-80% 屬於機械式的遷移。以一次「recipe」提交存下來。

2. **建置試跑。** Daytona 沙箱：安裝目標執行環境、跑建置。綠燈就跳到測試。紅燈就交棒給代理。

3. **代理迴路。** 帶這些工具的 LangGraph：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。代理把失敗分類（相依性、語法、測試、建置工具），並套用針對性的修正。再跑一次。

4. **預算上限。** 每個儲存庫 30 分鐘實際時間、8 美元成本、20 個代理輪次。任一項超標就停下，並連同當前的差異歸到「budget_exhausted」底下。

5. **測試 + 覆蓋率閘門。** 建置轉綠之後，跑測試套件。把覆蓋率與基底儲存庫比較。若覆蓋率掉超過 2%，就歸到「coverage_regression」底下。

6. **開 PR。** 成功時推送那條分支、開一份 PR，附上差異，以及一份「套用了哪些配方、哪些提交是代理寫的」的摘要。

7. **失敗分類法。** 對每個失敗的儲存庫，貼上一個類別標籤：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。建一個儀表板。

8. **50 個儲存庫的跑測。** 在 MigrationBench 子集上執行。回報逐類別通過率、每個儲存庫的成本、覆蓋率保存度，以及與「只用確定性工具」基線的比較。

## 框架應用

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

## 產出交付

`outputs/skill-migration-agent.md` 就是那份交付物。給定一個儲存庫，它先執行確定性配方、再跑代理迴路，產出一條綠燈的遷移分支，或把該儲存庫歸到某個分類法類別底下。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | MigrationBench 通過率 | 50 個儲存庫子集上的 pass@1 |
| 20 | 測試覆蓋率保存度 | 相對基底的平均覆蓋率差值 |
| 20 | 每個已遷移儲存庫的成本 | 通過的跑測上每個儲存庫的花費 |
| 20 | 代理／確定性工具的整合 | OpenRewrite 處理掉的修正與代理撰寫的修正各佔多少比例 |
| 15 | 失敗分析報告 | 分類法的完整度與範例 |
| **100** | | |

## 練習

1. 只用 OpenRewrite（不用代理）跑一次遷移管線。把通過率與完整管線比較。指出那些「只有代理才做得到」的案例。

2. 實作一項「lint 乾淨」檢查：遷移後跑一個風格檢查器（Java 用 spotless、Python 用 ruff）。出現新的 lint 錯誤就讓 PR 失敗。量測「覆蓋率保住了但風格退步」的比率。

3. 加上一個「最小差異」最佳化器：代理的分支通過測試之後，用第二趟把不必要的改動修掉。回報差異大小的縮減幅度。

4. 擴充到第三種遷移：Node 18 到 Node 22。重用那層沙箱包裝；把配方層換成自訂的 codemod。

5. 把「到第一次綠燈建置的時間」（TTFGB）當成一項使用體驗指標來量。目標：p50 低於 10 分鐘。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 確定性基底 | 「配方引擎」 | OpenRewrite / libcst：帶安全保證的宣告式 AST 改寫 |
| Codemod | 「會改程式碼的程式」 | 一條機械式改動原始碼的改寫規則 |
| 建置漂移 | 「工具版本落差」 | Maven / Gradle / uv 在主要版本之間細微的行為變化 |
| 失敗類別 | 「分類法的桶子」 | 某個儲存庫沒遷移成功的標註原因：相依性、語法、測試、建置工具、預算 |
| 覆蓋率差值 | 「覆蓋率保存度」 | 從基底到遷移分支之間測試覆蓋率百分比的變化 |
| 代理輪次 | 「一輪工具呼叫」 | 代理迴路裡的一次規劃 -> 行動 -> 觀察循環 |
| 預算耗盡 | 「撞到上限」 | 這個儲存庫用光了 30 分鐘 / 8 美元 / 20 輪的額度卻沒通過 |

## 延伸閱讀

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) —— 2026 年那份經典基準
- [Moderne.io OpenRewrite platform](https://www.moderne.io) —— 確定性基底的參考
- [OpenRewrite documentation](https://docs.openrewrite.org) —— 配方撰寫
- [Grit.io](https://www.grit.io) —— 另一套 codemod DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) —— Agents SDK 的參考
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) —— 另一份遷移基準
- [libcst](https://github.com/Instagram/LibCST) —— Python 的確定性基底
- [Daytona sandboxes](https://daytona.io) —— 逐分支沙箱的參考
