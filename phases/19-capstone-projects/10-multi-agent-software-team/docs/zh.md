# 綜合專案 10 —— 多代理軟體工程團隊

> 2026 年多代理工程團隊的形狀已經收斂：一位架構師負責規劃、N 位程式設計師在平行 worktree 中工作、一位審查者把關、一位測試者驗證。SWE-AF 的工廠架構、MetaGPT 的角色式提示、AutoGen 0.4 的型別化行動者圖、Cognition 的 Devin，以及 Factory 的 Droids，都各自獨立地落到了這個形狀上。平行 worktree 把實際時間換成吞吐量。共享狀態與交接協定則成了那個失敗面。這個綜合專案就是要建出這支團隊、在 SWE-bench Pro 上評估，並回報哪些交接會壞、多常壞。

**類型：** 總結專案
**程式語言：** Python / TypeScript (agents), Shell (worktree scripts)
**先修單元：** 階段 11（LLM 工程）、階段 13（工具）、階段 14（代理）、階段 15（自主）、階段 16（多代理）、階段 17（基礎設施）
**演練到的階段：** P11 · P13 · P14 · P15 · P16 · P17
**時間：** 40 小時

## 問題

單代理的寫程式框架在大型任務上會撞到天花板。不是因為任何單一代理很弱，而是因為一個 20 萬詞元的脈絡，塞不下一份架構計畫加上四片平行的程式碼庫切片、加上審查者的評論、再加上測試輸出。多代理工廠把問題拆開：架構師擁有計畫、程式設計師在平行 worktree 中擁有實作、審查者把關、測試者驗證。SWE-AF 的「工廠」架構、MetaGPT 的角色、AutoGen 的型別化行動者圖 —— 這三種說法描述的是同一個形狀。

失敗面在那些交接上。架構師規劃了程式設計師實作不了的東西。程式設計師產出互相衝突的差異。審查者核可了一份幻覺出來的修正。測試者搶在程式設計師還在寫的時候就跑了。你會建一支這樣的團隊、在 50 個 SWE-bench Pro 議題上跑它、追蹤每一次交接，並發表事後檢討。

## 概念

角色就是型別化的代理。**架構師**（Claude Opus 4.7）讀議題、寫計畫，並把它拆成帶明確介面的子任務。**程式設計師**（Claude Sonnet 4.7，N 個平行實例，各自在一個 `git worktree` + Daytona 沙箱裡）各自獨立地實作子任務。**審查者**（GPT-5.4）讀合併後的差異，然後核可或提出具體的修改要求。**測試者**（Gemini 2.5 Pro）在隔離環境跑測試套件，並回報通過／失敗與產出物。

溝通透過一塊共享的任務看板（以檔案或 Redis 為後盾）。每個角色只消費它被允許處理的任務。交接是 A2A 協定型別化的訊息。協調上的關注點：合併衝突的解決（協調者角色或自動三方合併）、共享狀態的同步（程式設計師一開工，計畫就凍結；重新規劃是另外的事件），以及審查者把關（審查者不能核可自己寫的、或自己提議的改動）。

詞元放大是那個隱藏成本。每一道角色邊界都會加上摘要提示詞與交接脈絡。一次 40 輪的單代理執行，跨四個角色後會變成總共 160 輪。評分表特別把「詞元效率相對單代理基線」納入權重，因為問題不是「多代理行不行得通」，而是「它每一塊錢有沒有贏」。

## 架構

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

- 編排：帶共享狀態 + 逐代理子圖的 LangGraph
- 訊息傳遞：A2A 協定（Google 2025），用於型別化的代理間訊息
- 模型：Opus 4.7（架構師）、Sonnet 4.7（程式設計師）、GPT-5.4（審查者）、Gemini 2.5 Pro（測試者）
- Worktree 隔離：每位程式設計師一次 `git worktree add` + 一個 Daytona 沙箱
- 合併協調者：自製的三方合併 + 由 LLM 居中調解的衝突解決
- 評估：SWE-bench Pro（50 個議題）、SWE-AF 情境、單元測試用 HumanEval++
- 可觀測性：帶角色標記 span 的 Langfuse、逐代理的詞元記帳
- 部署：K8s，每個角色一份獨立的 Deployment + 以待辦積壓做 HPA

```figure
ce-team-handoff
```

## 動手實作

1. **任務看板。** 以檔案為後盾的 JSONL，帶型別化訊息：`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。代理依標籤訂閱。

2. **架構師。** 讀 GitHub 議題、用一份要求明確標出子任務介面（動到哪些檔案、公開函式、測試影響）的計畫樣板跑 Opus 4.7。發出一則帶子任務 DAG 的 `plan_request`。

3. **程式設計師。** N 個平行工作者，每個從看板認領一項子任務。各自開一條全新的 `git worktree add` 分支加一個 Daytona 沙箱。實作那項子任務。發出帶修補檔 + 測試差異的 `diff_ready`。

4. **合併協調者。** 所有程式設計師完工後，把那 N 條分支三方合併進一條暫存分支。只有在檔案層級有重疊時，才由 LLM 居中調解衝突。

5. **審查者。** GPT-5.4 讀合併後的差異。不能核可自己寫的差異。發出 `approved`（無動作）或帶具體修改要求的 `review_feedback`，路由回相關的程式設計師。

6. **測試者。** Gemini 2.5 Pro 在乾淨的沙箱裡跑測試套件。擷取產出物。發出 `test_passed` 或帶堆疊追蹤的 `test_failed`。失敗的測試繞回擁有該失敗子任務的程式設計師。

7. **交接記帳。** 每一則跨越角色邊界的訊息，都在 Langfuse 裡拿到一個帶酬載大小與所用模型的 span。計算逐子任務的詞元放大率（(coder_tokens + reviewer_tokens + tester_tokens + architect_share) / coder_tokens）。

8. **評估。** 在 50 個 SWE-bench Pro 議題上跑。把 pass@1 與「每解決一個議題的花費」拿去和單代理基線（單一個 Sonnet 4.7 跑在單一 worktree 裡）比較。

9. **事後檢討。** 對每一個失敗的議題，指出是哪一次交接壞了（計畫太籠統、合併衝突、審查者誤核可、測試不穩定）。產出一張交接失敗的直方圖。

## 框架應用

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

## 產出交付

`outputs/skill-multi-agent-team.md` 就是那份交付物。給定一個議題網址與平行度，這支團隊會產出一份可合併的 PR，並附上逐角色的詞元記帳。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 配對的 50 議題子集上的 pass@1 |
| 20 | 平行加速 | 實際時間相對單代理基線 |
| 20 | 審查品質 | 在注入臭蟲探測上的誤核可率 |
| 20 | 詞元效率 | 每解決一個議題的總詞元數相對單代理 |
| 15 | 協調工程 | 合併衝突的解決、交接失敗直方圖 |
| **100** | | |

## 練習

1. 在執行中途往某份差異裡注入一個明顯的臭蟲（在主體之前多加一行 `return None`）。量測審查者的誤核可率。調整審查者提示詞，直到誤核可率低於 5%。

2. 減少到兩位程式設計師（架構師 + 程式設計師 + 審查者 + 測試者，程式設計師依序跑兩項子任務）。比較實際時間與通過率。

3. 把合併協調者換成一項單一寫入者約束（各子任務只動互不重疊的檔案集）。量測這對架構師造成的規劃負擔。

4. 把審查者從 GPT-5.4 換成 Claude Opus 4.7。量測誤核可率與詞元成本的差值。

5. 加上第五個角色：文件撰寫者（Haiku 4.5）。審查之後，它產出一則變更紀錄。量測文件品質對不對得起那筆額外的詞元花費。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 平行 worktree | 「隔離的分支」 | 用 `git worktree add` 替每位程式設計師開出一份全新工作樹 |
| 任務看板 | 「共享訊息匯流排」 | 存放型別化訊息、供代理訂閱的檔案或 Redis 儲存 |
| 交接 | 「角色邊界」 | 任何從一個角色的脈絡跨到另一個角色脈絡的訊息 |
| 詞元放大 | 「多代理的額外開銷」 | 同一任務下，跨角色的總詞元數 / 單代理的詞元數 |
| A2A 協定 | 「代理對代理」 | Google 2025 年替型別化代理間訊息所訂的規格 |
| 合併協調者 | 「整合者」 | 負責執行三方合併並調解衝突的元件 |
| 誤核可 | 「審查者的幻覺」 | 審查者核可了一份帶已知臭蟲的差異 |

## 延伸閱讀

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) —— 2026 年那份參考的多代理工廠
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) —— 以角色為基礎的多代理框架
- [AutoGen v0.4](https://github.com/microsoft/autogen) —— 微軟的型別化行動者框架
- [Cognition AI (Devin)](https://cognition.ai) —— 參考產品
- [Factory Droids](https://www.factory.ai) —— 另一個參考產品
- [Google A2A protocol](https://a2a-protocol.org/latest/) —— 代理間訊息傳遞的規格
- [git worktree documentation](https://git-scm.com/docs/git-worktree) —— 那層隔離基底
- [SWE-bench Pro](https://www.swebench.com) —— 那個評估標的
