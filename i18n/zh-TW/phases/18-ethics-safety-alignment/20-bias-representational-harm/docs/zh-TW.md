# LLM 中的偏見與表徵性傷害（Bias and Representational Harm in LLMs）

> Gallegos、Rossi、Barrow、Tanjim、Kim、Dernoncourt、Yu、Zhang 與 Ahmed（Computational Linguistics 2024，arXiv:2309.00770）。2024 年奠基性綜述，嚴格界定了表徵性傷害（Representational harms，刻板印象與群體抹除）與分配性傷害（Allocational harms，實體資源分配不公）的本質區別，並將評測指標分類為基於 Embedding 向量、基於生成機率，以及基於端到端生成文本三大範式。2024 至 2025 年實證研究：An 等人（PNAS Nexus，2025 年 3 月）在橫跨 20 個入門級職位的履歷自動篩選實驗中，針對 GPT-3.5 Turbo、GPT-4o、Gemini 1.5 Flash、Claude 3.5 Sonnet 與 Llama 3-70B 全面度量了性別與種族的交叉性偏見（Intersectional bias）。WinoIdentity（COLM 2025，arXiv:2508.07111）針對交叉性身分引入了基於不確定性的公平性評測基準。Yu 與 Ananiadou（2025）在 MLP 層中定位出性別神經元；Ahsan 與 Wallace（2025）利用稀疏自動編碼器（SAE）揭示了臨床診斷中的種族偏見；Zhou 等人（UniBias，2024）則透過直接操縱注意力頭實踐零樣本去偏。後設批判（arXiv:2508.11067）：十年間學術文獻不成比例地過度聚焦於二元性別偏見。

**Type:** Build
**Languages:** Python (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格定義表徵性傷害（Representational harm）與分配性傷害（Allocational harm），並分別給出在 LLM 正式環境中的具體實例。
- 梳理 Gallegos 等人（2024）提出的三大評測指標類別（基於向量、基於機率、基於生成文本），並分別詳述每一類中的典型指標。
- 深刻理解交叉性（Intersectionality）概念，並闡明 WinoIdentity 基於不確定性的公平性度量如何彌補單軸偏見評測的巨大盲區。
- 描述兩種利用機制可解釋性（Mechanistic interpretability）介入偏見的方法，包括性別神經元、SAE 特徵與注意力頭操縱。

## The Problem｜問題

先前所有章節探討的皆是蓄意的人為惡意攻擊（越獄誘導、暗中謀劃）以及安全治理機制。而偏見（Bias）則是一種在毫無主觀惡意前提下自然湧現的深層系統性危害——源自訓練資料分布、源自 Prompt 提問的引導性框架，以及源自層層累積的產品架構決策。量化並消減偏見，是一項與單純防禦對抗性攻擊截然不同的獨立方法論挑戰。

## The Concept｜核心概念

### 表徵性傷害 vs 分配性傷害

- **表徵性傷害（Representational harm）**：強化負面刻板印象、邊緣群體文化抹除、貶低性形象描摹。例如一個 LLM 在所有情境下皆將護理師預設描繪為女性，便構成了典型的表徵性傷害。
- **分配性傷害（Allocational harm）**：實體物質資源分配上的系統性不平等。例如一個 LLM 在企業求職初篩中，對非裔應徵者的履歷給出系統性偏低的打分，便構成了實質性的分配性傷害。

兩者絕非同一概念。一個模型完全可以做到「表面表徵毫無偏見」（能生成多樣化的群體描寫），但在「分配決策上仍有偏見」（給出不平等的建議）。嚴謹的評測體系必須同時度量這兩類傷害。

### 三大評測指標類別（Gallegos et al. 2024）

- **基於 Embedding 向量（Embedding-based）**：在 RLHF 前的 embedding 上執行 WEAT 風格測試，衡量身分詞與屬性詞之間的統計關聯。局限性：它衡量的是語義表徵本身，而非模型最終對外的吐字行為。
- **基於生成機率（Probability-based）**：度量模型解碼端在符合刻板印象 vs 違背刻板印象的候選補全上的對數概似（Log-likelihood）差值。能捕捉到部分行為偏見。
- **基於端到端生成文本（Generated-text-based）**：直接在下游真實業務任務的生成文字上進行端到端評測。履歷篩選打分、推薦信撰寫、對話語氣評估。具備最高的生態效度（Ecological validity）；但標準化復現難度最高。

### 交叉性（Intersectionality）

只評測「性別」偏見，會遺漏只有在（性別 × 種族）交叉組合中才會出現的偏見。An 等人（2025）實測證實：GPT-4o 在履歷自動篩選中，對非裔女性候選人施加的隱性扣分懲罰，分別高於對非裔男性與白人女性的懲罰。單軸評估無法捕捉這些差異。

WinoIdentity（COLM 2025）引入了基於不確定性的交叉性公平評測體系。它度量的核心指標是：模型對不同交叉身分組合的預測不確定性是否不同——而非僅僅關注點預測（Point prediction）。這能捕捉模型在各群體同樣預測錯誤、但對某些群體較不確定的情況，進而造成不同的下游分配行為。

### 機制可解釋性介入手段

2024 至 2025 年的可解釋性研究，讓研究者能對偏見進行機制層級的介入：

- **性別神經元（Yu & Ananiadou 2025）**：特定 MLP 神經元與性別特定行為相關。消融（Ablate）這些神經元可降低性別差距指標，能力成本有限。
- **透過 SAE 分析臨床種族偏見（Ahsan & Wallace 2025）**：SAE 可將模型內部表徵分解為可解釋維度；與種族相關的特徵可被識別並抑制。
- **UniBias 注意力頭動態干預（Zhou et al. 2024）**：透過直接操縱特定的注意力頭，達成零樣本去偏。研究發現，模型內部的特定注意力頭會放大對身分標籤的敏感度；將這些注意力頭歸零或重新加權，可在不進行 fine-tuning 的情況下降低偏見。

### 後設批判（The meta-critique）

一項針對過去十年學術文獻的回顧（arXiv:2508.11067，2025）指出，該領域不成比例地聚焦於二元性別偏見。其他面向——身心障礙、宗教、移民身分、多語言身分——受到的關注少得多。評論指出，狹隘的研究焦點可能因忽略而傷害邊緣群體：在二元性別偏見上已去偏見的模型，仍可能在未檢查的面向上存在嚴重偏見。

### 該研究在第 18 階段中的宏觀座標

第 20 與 21 節在形式上確立偏見與公平性的衡量標準；第 22 節探討隱私；第 23 節剖析數位內容浮水印。這些研究共同構成了面向廣大終端使用者的社會責任與倫理防護層。

```figure
an-bias-two-harms
```

## Use It｜實際應用

`code/main.py` 打造了一套微型基於 Embedding 向量的偏見探針：在簡易共現矩陣詞向量中，度量身分詞彙與屬性詞彙之間的 WEAT 風格幾何距離。你可以手動向資料中注入偏見並觀察指標如何即時報警，隨後套用簡單的去偏見操作，觀察幾何距離的部分修復。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-bias-eval.md`。輸入一份模型卡（Model Card）或公平性主張，該 Skill 會審查三類指標（embedding、機率、生成文本）、交叉性涵蓋範圍，以及任何去偏見介入機制。

## Exercises｜練習

1. 執行 `code/main.py`。記錄在實施簡單去偏操作前後的 WEAT 偏見得分。深刻解釋為何該幾何指標無法被徹底降至絕對零度？
2. 為該探針擴充一組交叉性測試集：（性別、種族）×（職業、家庭）。呈報跨軸交叉矩陣的實測偏見得分。
3. 仔細研讀 An 等人（2025，PNAS Nexus）原著論文。指出其所揭示的哪兩項顯著的交叉性偏見效應，是單純依賴傳統單軸性別評測所必然會徹底遺漏的？
4. Yu 與 Ananiadou（2025）在 MLP 層中定位出了特定的「性別神經元」。設計一項因果證偽實驗，用以嚴格區分「這些神經元確實因果主導了性別偏見」與「這些神經元僅僅在統計上與性別語義存在被動共變」？
5. 後設批判文獻指出學界過度沉溺於二元性別研究。在二元性別之外挑選一個長期被忽視的群體維度，為其描述一套表徵性傷害測量方法。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Representational harm | 「刻板印象／群體抹除」 | 對某個群體的偏頗描繪 |
| Allocational harm | 「不平等的決策」 | 對某個群體造成偏頗的實質結果 |
| WEAT | 「embedding 測試」 | Word Embedding Association Test；依共現關係分析偏見的探針 |
| Intersectionality | 「身分交疊的影響」 | 在多個身分軸線交會處出現的偏見 |
| Gender neurons | 「MLP 偏見神經元」 | 活化與性別特定行為相關的特定神經元 |
| SAE feature | 「可解釋的維度」 | 由稀疏自動編碼器識別的特徵，可用於機制層級的偏見分析 |
| UniBias | 「注意力頭去偏見」 | 透過重新加權注意力頭進行的零樣本去偏見 |

## Further Reading｜延伸閱讀

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) — LLM 偏見與公平性綜述。
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) — 跨五款前沿 LLM 的交叉性履歷篩選實證研究。
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) — 基於不確定性的全新交叉公平性基準。
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) — 基於注意力頭干預的零樣本去偏論文。
