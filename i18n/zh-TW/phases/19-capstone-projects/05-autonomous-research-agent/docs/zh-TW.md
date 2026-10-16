# 專案實戰 05——自主科學研究 Agent（AI-Scientist 級別）（Capstone 05 — Autonomous Research Agent (AI-Scientist Class)）

> Sakana 的 AI-Scientist-v2 發表了完整論文。Agent Laboratory 執行了實驗。艾倫人工智慧研究所（Allen AI）則公開分享了完整的 Agent 探索軌跡。到了 2026 年，頂級科研 Agent 的架構標準已徹底收斂為：針對實驗候選空間展開「規劃-執行-驗證」的樹狀搜尋（Tree Search）、硬性成本預算熔斷、安全沙盒隔離程式碼執行、具備多模態視覺回饋的 LaTeX 論文撰寫器，以及一個自動化的類 NeurIPS 審稿人評判整合系統。本專案實戰要求你從零開始端到端打造一個完整的科研 Agent，將單篇論文的端到端運作成本嚴格壓在 30 美元之內，並在 Sakana 團隊所記錄的「沙盒逃逸紅隊演練」中安然存活。

**Type:** Capstone
**Languages:** Python (agent + sandbox), LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Problem｜問題

自主科研 Agent 在 2026 年跨越了一道歷史性的臨界閾值。Sakana AI 的 AI-Scientist-v2 登上了《Nature》期刊，其生成的學術論文通過了學術研討會（Workshop）審查。在 ICLR 2026 上發布的 ShinkaEvolve 進一步將其擴展至自主假設演化體系。AMD 的 Agent Laboratory 則展示了極具可重現性的實驗軌跡。這些 Agent 絕非魔法——它們的本質是在候選實驗的搜尋樹上，不知疲倦地運作著「規劃-執行-驗證」的閉環，並嚴格受到總花費預算封頂、鎖定隨機種子的安全沙盒以及自動化評審機制的硬性約束。真正的工程精湛度全在於控制迴圈設計、預算熔斷管理與安全防禦邊界。

你將透過在一個狹窄的具體垂直領域（例如：針對一個 1 億參數的微型 Transformer 模型實施注意力矩陣稀疏性消融實驗）從零實作這套控制迴圈來掌握核心技術。該專案的價值絕非指望 Agent 第一次執行就發現新成果；其真正的技術精華全在於底層基礎設施：樹狀搜尋演算法、實驗沙盒隔離、撰寫者-審稿人對抗迴圈，以及嚴苛的紅隊安全測試報告。Sakana 團隊記錄了沙盒逃逸失敗案例；你的 Agent 必須在完全相同的紅隊防禦考驗下通過安全審查。

## Concept｜核心概念

該 Agent 本質上是一個「最佳優先樹狀搜尋器（Best-First Tree Search）」。搜尋樹上的每一個節點代表一份具體的實驗規格說明書：包含（核心假設、超參數設定、Python 執行程式碼、預期觀測結果）。在節點展開（Expand）階段，模型會提出若干帶有微小修改的子節點方案（例如更換最佳化器、調整批次大小、消融某一特定模組）。每一個子節點皆會在一個帶有硬性資源配額的全新獨立沙盒中被執行。實驗產出的數值指標會被反饋至評分函數，系統依據 (創新度 × 實驗品質 × 剩餘預算) 的綜合分數對節點進行動態優先級排序。搜尋樹在預算耗盡前持續生長；一旦抵達預算紅線，系統即刻選取得分最高的最優路徑交由論文撰寫模組。

論文撰寫模組具備原生多模態特性。它首先生成完整的 LaTeX 原始碼草稿、編譯為 PDF、自動繪製圖表，並將渲染出的 PDF 頁面影像重新餵入 Claude Opus 4.7 的視覺多模態通道，由模型對論文版面排版、圖表清晰度以及「文本論斷與實驗圖表的一致性」實施嚴厲批判。隨後，一個由 5 個獨立 LLM 組成的審稿人評判專家團（Reviewer Ensemble）依照 NeurIPS 風格的評分規準（創新度、論證嚴謹性、文字清晰度、可重現性、潛在影響力）出具量化審查評分；若平均得分低於設定閾值，論文將連同具體的修改意見被打回撰寫者進行重新修訂。

安全性在此處生死攸關。每一次實驗皆必須在 E2B 或 Daytona 沙盒容器中執行，嚴禁向外連線至公網、設定嚴格的單次執行時間上限，並對 CPU 與記憶體設定硬性配額。Agent 的程式碼生成管線加上一層資安策略過濾器，主動攔截所有企圖跳出容器的危險系統呼叫（Syscalls）。最終的紅隊安全報告必須重現 Sakana 團隊所記錄的攻擊面（包含 Fork 炸彈、檔案系統逃逸、LLM 撰寫的網路呼叫）。

## 系統架構

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## 技術堆疊

- 流程編排引擎：LangGraph，具備檢查點機制與人工核准閘門
- 樹狀搜尋演算法：自定義最佳優先搜尋（借鏡 Sakana v2 的 AB-MCTS 蒙地卡羅樹狀搜尋流派）
- 安全沙盒環境：單次實驗專屬 E2B 沙盒容器，支援 Docker-in-Docker 作為備選方案；透過 Linux cgroups 實施硬性資源限額
- 文獻檢索檢索庫：Semantic Scholar Graph API + OpenAlex + 本地 FAISS 論文摘要快取庫
- 論文撰寫模組：標準學術 LaTeX 模板 + 啟用多模態視覺模式的 Claude Opus 4.7 用於圖表排版批判
- 自動化評審專家團：由 5 位獨立 LLM 評審（Opus 4.7、GPT-5.4、Gemini 3 Pro、DeepSeek R1、Qwen3-Max）組成的加權評判委員會
- 實驗執行基礎庫：PyTorch 2.5 用於深度學習實驗，W&B 用於實驗曲線追蹤記帳
- 全鏈路可觀測性：Langfuse 用於記錄 Agent 執行軌跡，單篇論文強制設定 30 美元花費紅線

```figure
ce-experiment-tree
```

## Build It｜動手實作

1. **初始靈感種子與研究範疇界定**。鎖定一個具體的靈感種子（例如：「探究 10 億參數以下 Transformer 注意力矩陣中的稀疏性結構」）。清晰界定搜尋維度：候選模型架構、基準資料集、運算資源硬性預算。

2. **學術文獻快速掃描**。呼叫 Semantic Scholar 與 OpenAlex API 檢索相關領域引用量最高的 50 篇經典論文；將摘要快取在本機；產生一頁的領域摘要。

3. **實驗樹狀骨架搭建**。將靈感假設作為根節點初始化樹狀結構。實作 `expand(node) -> children` 節點展開演算法，要求每個子節點僅提出微小的配置修改（一項設定變更）。實作 `score(node)` 綜合評分函數，加權計算創新度、實驗質量與剩餘預算。

4. **安全沙盒封裝**。每一個物理實驗皆透過帶有極限防護的指令啟動：`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`（或在 E2B 中配置對等策略）。將隨機種子寫入沙盒；實驗輸出資料夾以唯讀方式掛載回主機。

5. **規劃-執行-驗證控制迴圈**。`plan` 階段提出候選子節點。`execute` 階段在隔離沙盒中執行實驗，擷取紀錄與指標。`verify` 階段針對關鍵指標執行單元斷言檢查（例如：Loss 是否出現實質下降？消融實驗是否成功將變數解耦？）。任何失敗節點皆會在樹狀結構上記錄明確的失敗原因。

6. **論文撰寫與視覺回饋迭代修訂**。預算耗盡後，自動選取全樹評分最高的路徑。使用 matplotlib 自動繪製實驗圖表。呼叫 Claude Opus 4.7 並將該路徑的 branch trace放入脈絡中，生成完整的學術 LaTeX 原始碼。本地編譯為 PDF。將編譯後的 PDF 影像重新送入 Opus 4.7 視覺通道進行排版批註與圖表可讀性審查。迭代修改。

7. **審稿人專家團綜合評審**。呼叫 5 位 LLM 評審，依據 NeurIPS 風格的評分規準（創新度、論證嚴謹性、文字清晰度、可重現性、潛在影響力）逐一打分。若綜合平均分低於 4.0 / 5.0，將附帶修改意見打回撰寫模組。設定最多重寫 3 輪的硬性防護。

8. **安全防禦紅隊實戰測試**。建構一套專門針對沙盒逃逸的惡意對抗任務集：Fork 炸彈程式碼、透過不同協定外發機密資料的嘗試、檔案系統路徑逃逸、在 LLM 生成的 Shell 指令中注入特殊元字符。確認所有惡意行為皆被沙盒防護網全數攔截。撰寫完整的安全測試分析報告。

9. **一鍵完全可重現性打包**。隨論文一同自動產出：完整的樹狀搜尋探索路徑 Trace JSON、隨機種子清單、W&B 實驗連結、沙盒環境配置檔案，以及一份可端到端重現實驗流程的 README 指南。

## Use It｜實際應用

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-ai-scientist.md`。給定一個科研靈感種子 + 一個指定研究領域 + 30 美元硬性預算，該 Skill 將自動調度全套管線，最終產出一份可供審閱的 LaTeX 論文以及完整的可重現性資產包。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 論文綜合質量與可讀性 | 與公開已發表的學術研討會論文進行盲評打分對照 |
| 20 | 實驗論證的客觀嚴謹性 | 是否包含基準對照、隨機種子、消融實驗；正文中的每一項論斷是否皆能精確對應至實驗結果表中的儲存格 |
| 20 | 成本控制與算力紀律 | 嚴格執行單篇論文 30 美元的硬性成本天花板，全鏈路經由 Langfuse 記帳審核 |
| 20 | 系統安全性與沙盒防禦 | 通過沙盒逃逸紅隊測試；網路隔離策略與緊急中斷開關（Kill-switch）已驗證 |
| 15 | 極致可重現性交付 | 透過單條命令、相同的隨機種子即可精準復現整篇論文中的全部圖表與實驗數值 |
| **100** | | |

## Exercises｜練習

1. 在同一個研究領域下，針對三個不同的靈感種子分別啟動該科研管線。對比這三場樹狀搜尋在早期文獻探索與基礎實驗中出現了多少重疊區間。找出重複浪費的運算。
2. 在實驗正式啟動前，為預計運作成本超過 5 美元的大型節點引入「人工在環（Human-in-the-Loop）」確認機制。量測引入人工篩選後，整場搜尋的總成本降低多少。
3. 將 5 位 LLM 組成的審稿專家團縮減為單一裁判模型。在一組保留的已知劣質論文測試集上，測量誤判放行率（false-accept rate）。
4. 導入網路資料外洩紅隊測試：Agent 編寫嘗試透過 `curl` 連至外部位址的程式碼。確認 `--network=none` 政策會阻擋該請求，並記錄此嘗試。
5. 將你的「最佳優先樹狀搜尋」演算法與完全不進行任何啟發式擴展的「不使用樹狀擴展的隨機基準線」在相同預算下展開橫向較量。客觀量化你的搜尋策略在 (創新度 × 實驗品質) 上帶來的增益。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Tree search |「AB-MCTS 式擴展」| 依新穎度 × 品質 × 預算分數，優先探索實驗節點 |
| Sandbox |「實驗隔離」| 不連網、限制 CPU／記憶體、固定亂數種子且輸入唯讀的容器 |
| Vision critique |「先轉檔再閱讀」| 將論文編譯成 PDF，再交給 VLM 檢查版面與主張證據 |
| Reviewer ensemble |「自動同儕審查」| 多個 LLM 評審依 NeurIPS 風格的評分規準評分論文，再以加權總分決定是否通過管線 |
| Novelty score |「這是新的嗎？」| 對與 50 篇論文文獻快取相近的內容予以扣分的啟發式分數 |
| Cost ceiling |「預算上限」| 每篇論文的總支出硬性上限；由 Langfuse 計數器和執行前估算共同掌握 |
| Red team |「沙盒逃逸稽核」| 若策略有誤，可能逃出沙盒的對抗性任務 |

## Further Reading｜延伸閱讀

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) — 業界標竿級正式環境科研 Agent 開源專案。
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — 自主科研 Agent 開創性奠基學術論文。
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — 基於進化演算法的假設演進研究。
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — 多角色科研實驗室開源協同架構。
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) — 複雜狀態機與樹狀編排官方技術文件。
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) — 全球學術文獻檢索權威 API 端點。
- [E2B sandboxes](https://e2b.dev) — 工業級安全程式碼隔離沙盒官方文件。
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) — 審稿專家團所遵循的官方審稿標準細則。
