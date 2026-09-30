# 綜合專案 05 —— 自主研究代理（AI-Scientist 等級）

> Sakana 的 AI-Scientist-v2 發表了完整的論文。Agent Laboratory 跑了那些實驗。Allen AI 分享了軌跡。2026 年的形狀是：在實驗之上做規劃－執行－查證的樹狀搜尋、有預算的成本、沙箱化的程式碼執行、一個帶視覺回饋的 LaTeX 撰稿者，以及一組自動化的 NeurIPS 式審稿人集成。這個綜合專案就是要建一個出來、在每篇論文 30 美元之內從頭跑到尾，並挺過 Sakana 所記載的那套沙箱逃逸紅隊測試。

**類型：** 綜合專案
**程式語言：** Python (agent + sandbox), LaTeX (output)
**先修單元：** 階段 2（機器學習）、階段 3（深度學習）、階段 7（transformer）、階段 10（從零打造 LLM）、階段 14（代理）、階段 15（自主）、階段 16（多代理）、階段 18（安全）
**演練到的階段：** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**時間：** 40 小時

## 問題

自主研究代理在 2026 年跨過了一道門檻。Sakana AI 的 AI-Scientist-v2 登上《自然》，其生成的論文通過了工作坊的同儕審查。ShinkaEvolve（ICLR 2026）把這條線延伸到演化式假說。AMD 的 Agent Laboratory 出貨了可重現的軌跡。這些代理並不神奇 —— 它們就是一條規劃－執行－查證的迴路，跑在一棵候選實驗樹上，配上成本上限、種子綁定的沙箱，以及自動化審查。手藝在那條迴路、那份預算，以及那套安全論述上。

你要靠在一個窄領域中針對一個種子想法實作一次，來學會那條迴路（例如，對一個一億參數的 transformer 做注意力稀疏度的消融）。價值不在第一次跑就發現什麼新東西。價值在那套基礎設施：樹狀搜尋、實驗沙箱、撰稿－審稿迴路、紅隊報告。Sakana 團隊記載了沙箱逃逸的失敗；你的代理必須通過同一套紅隊測試。

## 概念

這個代理是一次最佳優先的樹狀搜尋。節點是實驗規格：（假說、設定、程式碼、預期結果）。展開步驟以小幅編輯（換最佳化器、改批次大小、消融某個元件）提出子節點。每個子節點都在一個全新的沙箱裡跑，並帶硬性資源上限。結果回饋進一個評分函數，依（新穎度 × 品質 × 剩餘預算）替節點排序。這棵樹一直長到預算耗盡，然後把最佳的那條分支寫成論文。

撰稿者是多模態的。它產出一份 LaTeX 草稿、編譯它、渲染圖表，再把渲染出來的 PDF 餵回 Claude Opus 4.7 的視覺模式，請它針對版面、圖表可讀性與「主張－證據」的一致性提出批評。一組五位 LLM 裁判的審稿人集成，給出 NeurIPS 式的分數（新穎度、嚴謹度、清晰度、可重現性、影響力）；若平均低於門檻，論文就帶著批評回到撰稿者手上。

安全性是承重的。每一項實驗都跑在一個沒有網路出口、實際時間有界、資源上限被釘死的 E2B 或 Daytona 沙箱裡。代理的程式碼生成步驟會通過一層政策，擋掉會逃出沙箱的系統呼叫。紅隊報告會重現 Sakana 所記載的攻擊面（fork 炸彈、檔案系統逃逸、LLM 寫出來的網路呼叫）。

## 架構

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

- 編排：帶檢查點與人類核可閘門的 LangGraph
- 樹狀搜尋：在實驗節點上自製的最佳優先搜尋（Sakana v2 的 AB-MCTS 風格）
- 沙箱：每項實驗一個 E2B，Docker-in-Docker 作為退路；資源上限透過 cgroups
- 文獻：Semantic Scholar Graph API + OpenAlex + 摘要的本地 FAISS 快取
- 撰稿者：LaTeX 樣板 + Claude Opus 4.7（視覺模式）做圖表批評與版面檢查
- 審稿人：五位裁判的集成（Opus 4.7、GPT-5.4、Gemini 3 Pro、DeepSeek R1、Qwen3-Max），加權彙總
- 實驗框架：物理實驗用 PyTorch 2.5，記錄用 W&B
- 可觀測性：代理軌跡用 Langfuse，每篇論文 30 美元硬預算

```figure
ce-experiment-tree
```

## 動手建

1. **種子與領域範圍界定。** 拿一個種子想法（例如「研究次十億參數 transformer 注意力圖中的稀疏樣式」）。定義搜尋空間：模型、資料集、運算預算。

2. **文獻掃描。** 向 Semantic Scholar + OpenAlex 查詢 50 篇被引用最多的相關論文；把摘要快取到本地；產出一份一頁的領域摘要。

3. **樹的骨架。** 用種子假說初始化根節點。實作 `expand(node) -> children`，以小幅編輯提案（每個子節點只改一項設定）。把 `score(node)` 實作成一個加權的「新穎度 × 品質 × 預算」項。

4. **沙箱包裝。** 每項實驗都跑 `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`（或 E2B 的等價政策）。種子寫進沙箱；輸出以唯讀方式掛載回外面。

5. **規劃－執行－查證迴路。** `plan` 提出子節點。`execute` 跑沙箱、擷取日誌與指標。`verify` 對指標跑單元檢查（損失下降了嗎？那次消融有沒有把效應隔離出來？）。失敗的節點會把失敗原因存回樹上。

6. **撰稿者。** 預算用完後，選出最佳分支。用 matplotlib 渲染圖表。把該分支的軌跡放進脈絡，透過 Claude Opus 4.7 產出一份 LaTeX 草稿。編譯。把編好的 PDF 餵回 Opus 4.7 的視覺模式做批評。反覆迭代。

7. **審稿人集成。** 五位裁判用 NeurIPS 式的評分準則，對草稿在（新穎度、嚴謹度、清晰度、可重現性、影響力）上評分。若平均 < 4.0/5，就帶著批評回到撰稿者。改寫 3 次後硬性停止。

8. **紅隊。** 建立或整合一組針對沙箱的對抗任務：fork 炸彈、網路外洩嘗試、檔案系統逃逸、LLM 寫出來的 shell 中介字元。確認全部被擋。把發現寫成報告。

9. **可重現性。** 每篇論文出貨時都附上它的樹狀搜尋軌跡 JSON、種子、W&B 執行連結、沙箱設定，以及一份能從頭到尾重現它的 README。

## 動手用

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

## 產出交付

`outputs/skill-ai-scientist.md` 就是那份交付物。給定一個種子想法 + 一個領域 + 30 美元預算，它會跑完整條管線，並產出一篇可供審查的論文加上一份可重現性打包檔。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 論文品質 | 以盲審評分準則對照已發表的工作坊論文 |
| 20 | 實驗嚴謹度 | 基線、種子、消融；每一項主張都有結果表中的一格支撐 |
| 20 | 成本與運算紀律 | 每篇 30 美元上限被強制執行，並以 Langfuse 記錄軌跡 |
| 20 | 安全性 | 沙箱紅隊測試通過；網路政策與緊急停止開關已驗證 |
| 15 | 可重現性 | 用相同種子一行指令重跑，能重現那篇論文 |
| **100** | | |

## 練習

1. 在同一個領域裡，針對三個不同的種子想法跑這條管線。比較樹狀搜尋中哪些部分重疊。指出被重複浪費掉的運算。

2. 對估計超過 5 美元的節點，在實驗執行前加上一道人類介入閘門。量測總成本下降了多少。

3. 把審稿人集成換成單一位裁判。在一組已知很差的論文保留集上量測偽接受率。

4. 引入一項網路外洩的紅隊測試：代理寫出試圖 `curl` 外部位址的程式碼。確認 `--network=none` 政策擋下了它。把那次嘗試記錄下來。

5. 把你的樹狀搜尋與一條平坦的隨機基線（同樣預算、沒有展開策略）做比較。回報「新穎度 × 品質」的增益。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 樹狀搜尋 | 「AB-MCTS 式的展開」 | 在實驗節點上、以「新穎度×品質×預算」評分做的最佳優先探索 |
| 沙箱 | 「實驗隔離」 | 無網路、CPU/記憶體有界、種子釘死、輸入唯讀的容器 |
| 視覺批評 | 「渲染後再讀」 | 把論文編譯成 PDF，再把 PDF 餵回 VLM 做版面與「主張－證據」的批評 |
| 審稿人集成 | 「自動化同儕審查」 | 多位 LLM 裁判以 NeurIPS 評分準則替論文評分；加權平均替管線把關 |
| 新穎度分數 | 「這算新嗎？」 | 一項捷思，懲罰與那 50 篇文獻快取太接近的東西 |
| 成本上限 | 「美元預算」 | 每篇論文總花費的硬性上限；Langfuse 計數器 + 執行前估算 |
| 紅隊 | 「沙箱逃逸稽核」 | 一旦政策寫錯就會逃出沙箱的那些對抗任務 |

## 延伸閱讀

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) —— 生產級研究代理的參考
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) —— 最初的方法論
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) —— 演化式的延伸
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) —— 多角色的研究實驗室框架
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) —— 參考用的編排層
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) —— 文獻搜尋
- [E2B sandboxes](https://e2b.dev) —— 實驗隔離的參考
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) —— 審稿人集成所編碼的那套評分準則
