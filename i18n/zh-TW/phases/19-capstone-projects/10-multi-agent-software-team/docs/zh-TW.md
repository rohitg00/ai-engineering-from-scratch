# 專案實戰 10——多 Agent 軟體工程團隊（Capstone 10 — Multi-Agent Software Engineering Team）

> 到了 2026 年，多 Agent 軟體工程團隊的標準組織形態已徹底收斂定型：架構師（Architect）負責全局拆解規劃、N 個程式設計師（coders）在平行獨立的 Git Worktree 中平行程式設計、審查員（Reviewer）充當程式碼門禁把關、測試員（Tester）負責沙盒驗證。SWE-AF 的「工廠架構」、MetaGPT 的角色扮演prompt體系、AutoGen 0.4 的強型別 Actor 拓撲圖、Cognition 的 Devin 以及 Factory 的 Droids，皆各自獨立演進並收斂到了完全相同的架構原型。透過平行 worktree，等待時間可轉化為工作吞吐量。而各角色之間的「共享狀態管理」與「上下文交接通訊協定（Handoff Protocol）」則成為系統中最核心的故障失效表面。本專案實戰要求你親手組建這支虛擬工程團隊，在嚴苛的 SWE-bench Pro 上全面驗收，並產出一份詳盡分析「交接在何處斷裂、斷裂頻率如何」的架構檢討報告。

**Type:** Capstone
**Languages:** Python / TypeScript (agents), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:** P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## Problem｜問題

單一 Agent 執行環境在面對大型工程專案時會遇到能力瓶頸。這並非因為單一 Agent 智力低落，而是因為哪怕 20 萬 Token 的上下文視窗，也絕不可能同時塞下高階架構規劃、4 個平行模組的程式碼切片、冗長繁複的審查評語以及龐大的終端測試錯誤紀錄。多 Agent 軟體工廠採用分治思維徹底解耦該難題：架構師牢牢掌控頂層設計，多個程式設計師在平行的獨立 Worktree 中專注於局部實作，審查員執行嚴苛把關，測試員在獨立環境驗收結果。SWE-AF 的「軟體工廠」架構、MetaGPT 的角色分工、AutoGen 的型別化 Actor 拓撲圖——皆精準刻畫了這一標準典範。

然而，全新的系統失效表面全部轉移至「角色之間的交接邊界（Handoff）」：架構師規劃了程式設計師根本無法落地的抽象介面；多個程式設計師產出了邏輯互斥的 Git 合併衝突；審查員被幻覺矇騙，批准了錯誤的修正；測試員在程式設計師尚未寫完程式碼前就搶跑引發競爭條件。你將在本專案實戰中親手組建這支虛擬團隊，驅動其攻克 50 道 SWE-bench Pro 真實 Issue，逐一記錄每一次跨角色交接的上下文軌跡，並最終發布一份嚴肅的架構復盤檢討報告。

## Concept｜核心概念

團隊中的所有角色皆為強型別的專屬 Agent。**架構師（Architect）**（調用 Claude Opus 4.7）深入精讀 GitHub Issue，產出全局執行計畫，並將任務拆解為具備清晰邊界與明確對外介面的平行子任務。**程式設計師（Coders）**（調用 Claude Sonnet 4.7，N 個平行實例，各自運行在獨立的 `git worktree` + Daytona 沙盒容器中）並行且獨立地實作分配到的子任務。**審查員（Reviewer）**（調用 GPT-5.4）審閱合併後的全量 Git Diff，做出核准放行或提出具體修改要求的裁決。**測試員（Tester）**（調用 Gemini 2.5 Pro）在乾淨的隔離沙盒中執行測試套件，並產出附帶測試紀錄的驗收報告。

角色間的通訊全面透過共享看板（檔案持久化或 Redis）進行解耦排程。每個角色僅領取其權限所允許處理的專屬任務。跨角色交接全面採用 Google 提出的 A2A（Agent-to-Agent）強型別標準通訊協定。核心協同工程難點：合併衝突解決（由專門的 Coordinator 角色或自動化三向合併演算法處理）、共享狀態同步（一旦程式設計師開始寫程式碼，頂層架構計畫即刻凍結；重新規劃必須作為獨立事件觸發），以及審查員門禁安全（審查員絕對嚴禁批准自己撰寫的程式碼或由自己主動提議的變更）。

Token 膨脹效應（Token Amplification）是多 Agent 體系中不可忽視的隱性成本。每一次跨角色的邊界交接，皆伴隨著額外的摘要 Prompt 與上下文裝填開銷。原本單一 Agent 只需 40 輪對話的任務，在四角色團隊中往往會膨脹為總計 160 輪對話。評分規準會特別衡量相較於單一 Agent 基準的 Token 使用效率，因為問題不是「多 Agent 是否能運作」，而是「每花一美元是否更划算」。

## 系統架構

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## 技術堆疊

- 流程編排引擎：LangGraph，具備全域共享狀態管理與單 Agent 專屬子圖
- 跨 Agent 訊息傳輸：A2A 通訊協定（Google 2025），用於強型別結構化訊息互動
- 模型矩陣：Claude Opus 4.7（架構師）、Claude Sonnet 4.7（平行程式設計師）、GPT-5.4（程式碼審查員）、Gemini 2.5 Pro（測試工程師）
- 平行實體隔離：按程式設計師動態執行 `git worktree add` + 綁定獨立 Daytona 沙盒容器
- 合併協調器：自定義三向合併演算法 + LLM 協助的語義衝突裁決機制
- 評測驗收基準：SWE-bench Pro（50 道真實難題）、SWE-AF 工廠場景庫、HumanEval++ 單元測試集
- 全鏈路可觀測性：Langfuse，打上角色專屬標籤，對每個 Agent 的 Token 消耗實施獨立記帳
- 叢集部署架構：Kubernetes 叢集，每個角色作為獨立的 Deployment 運作，依據任務積壓量動態 HPA 擴容

```figure
ce-team-handoff
```

## Build It｜動手實作

1. **強型別任務看板**。建構基於本地檔案的 JSONL 訊息匯流排，支援嚴格型別化事件：`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。每個 Agent 僅訂閱並監聽自身權限標籤。

2. **架構師 Agent 實作**。精讀 GitHub Issue 需求，調用 Claude Opus 4.7 並裝填結構化計畫模板，強制要求明確標註子任務的邊界合約（涉及檔案清單、暴露的公開函式簽名、對單元測試的潛在影響）。在看板上發布一筆 `plan_request` 事件，內含 DAG 有向無環圖依賴關係的子任務集合。

3. **平行程式設計師矩陣**。啟動 N 個平行工作者，各自分別從看板認領一個子任務。為每個程式設計師動態執行 `git worktree add` 建立全新branch，並掛載獨立的 Daytona 沙盒容器。程式設計實作完成後，在看板發布 `diff_ready` 事件，附帶產出的補丁與測試差異。

4. **智慧合併協調器**。當所有平行程式設計師皆完成任務後，協調器在 Staging 預備branch上執行 N 路branch的三向合併（Three-Way Merge）。僅在出現檔案層級重疊時，呼叫 LLM 協助解決語義衝突。

5. **審查員門禁**。GPT-5.4 審閱合併後的完整 Git Diff。系統內建安全約束：審查員絕對無法核准自己編寫的補丁。審查通過發布 `approved` 事件；審查未通過發布 `review_feedback` 事件，附帶極其具體的修改意見並自動路由回對應的程式設計師工作佇列。

6. **隔離測試驗證器**。Gemini 2.5 Pro 在一個乾淨的沙盒中執行測試套件。捕獲所有測試產出資產與報錯軌跡。測試通過發布 `test_passed`；測試失敗發布 `test_failed` 並附帶調用堆疊，將缺陷精確退回負責該模組的程式設計師。

7. **全鏈路交接記帳與膨脹率分析**。每一次跨角色邊界的訊息傳遞，皆在 Langfuse 中建立專屬 Span，記錄負載位元組與調用模型。精確計算單任務的 Token 膨脹倍率：(程式設計師 Token + 審查員 Token + 測試員 Token + 架構師分攤 Token) / 程式設計師基礎 Token。

8. **50 題真實難題大考**。在 SWE-bench Pro 50 道精選難題上啟動全自動化團隊運作。在 pass@1 首次通過率與每個已解決問題的成本兩個維度上，與「單一 Sonnet 4.7 單打獨鬥基準線」展開橫向對比。

9. **交接故障事後復盤分析**。針對所有未能成功解決的 Issue，精準定位其究竟是在哪一個交接環節發生了斷裂（架構師計畫過於模糊、Git 合併衝突無法解開、審查員虛假放行、測試偶發失敗）。繪製完整的「交接失敗頻次直方圖」。

## Use It｜實際應用

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-multi-agent-team.md`。輸入一個 GitHub Issue 網址與設定的平行度參數，該虛擬工程團隊將自動平行協同作業，產出可直接合併的正式 PR，並附帶各角色詳細的 Token 消耗分析報告。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 通過率 | 在匹配的 50 道題目子集上的首次修復成功率 |
| 20 | 平行化時間加速比 | 相較於單一 Agent 序列執行時的端到端物理耗時縮減倍率 |
| 20 | 程式碼審查防禦品質 | 在人為故意注入隱密 Bug 的探針測試集上，審查員虛假放行率的控制表現 |
| 20 | 總體 Token 效費比 | 解決單個任務所需的總 Token 消耗量與單 Agent 基準線的橫向比對 |
| 15 | 協同工程健壯度 | 複雜合併衝突自動解決成功率、交接失敗直方圖的客觀洞察力 |
| **100** | | |

## Exercises｜練習

1. 在某次運作的補丁中途，人為故意向 Git Diff 注入一個明顯的錯誤（例如在函式主體前突兀插入 `return None`）。實測審查員的「虛假核准（False-Approve）」頻率。持續調整審查員的prompt，直到虛假核准率穩定壓制在 5% 以下。
2. 將平行程式設計師數量縮減為單一程式設計師（架構師 + 1 名程式設計師 + 審查員 + 測試員，程式設計師依序序列完成多個子任務）。對比其端到端物理耗時與最終修復成功率。
3. 移除智慧合併協調器，改為採用極其嚴格的「單一寫入者約束（Single-Writer Constraint）」：強制要求架構師在拆分任務時，保證每個子任務所修改的檔案集合完全正交不重疊。度量該約束給架構師帶來的額外規劃負擔。
4. 將審查員主力模型從 GPT-5.4 替換為 Claude Opus 4.7。比較兩者的核准錯誤率與 Token 成本差異。
5. 在團隊中引入第五個專職角色：文件編寫員（調用輕量級 Haiku 4.5）。在審查通過後，文件員自動讀取 Diff 並產出標準的 Changelog 變更紀錄。客觀度量產出的文件品質是否足以抵消其額外帶來的 Token 支出。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Parallel worktree |「隔離的 branch」| 透過 `git worktree add` 為每位程式設計師建立新的工作樹 |
| Task board |「共用訊息匯流排」| agent 訂閱具型別訊息的檔案或 Redis 儲存區 |
| Handoff |「角色邊界」| 從一個角色的脈絡傳到另一個角色的任何訊息 |
| Token amplification |「多 agent 額外開銷」| 同一任務中各角色的 Token 總數除以單一 agent 的 Token 數 |
| A2A protocol |「agent 對 agent」| Google 在 2025 年制定的型別化 agent 間訊息規格 |
| Merge coordinator |「整合者」| 執行三向 merge 並協調衝突的元件 |
| False approval |「審查者幻覺」| 審查者核准含有已知錯誤的 diff |

## Further Reading｜延伸閱讀

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) — 2026 年多 Agent 軟體工廠權威參考儲存庫。
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — 基於角色扮演的多 Agent 經典協同框架。
- [AutoGen v0.4](https://github.com/microsoft/autogen) — 微軟開源的強型別 Actor 拓撲協同架構。
- [Cognition AI (Devin)](https://cognition.ai) — 商業級自主程式設計 Agent 典範產品。
- [Factory Droids](https://www.factory.ai) — 工廠化多 Agent 協同商業產品參考。
- [Google A2A protocol](https://a2a-protocol.org/latest/) — 跨 Agent 訊息傳輸官方標準規範。
- [git worktree documentation](https://git-scm.com/docs/git-worktree) — 本地平行branch實體隔離官方手冊。
- [SWE-bench Pro](https://www.swebench.com) — 專案實戰所依託的真實工業級難題基準。
