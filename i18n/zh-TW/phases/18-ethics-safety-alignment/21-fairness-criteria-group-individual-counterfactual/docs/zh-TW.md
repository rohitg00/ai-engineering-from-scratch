# 公平性準則——群體、個體與反事實（Fairness Criteria — Group, Individual, Counterfactual）

> 三類準則構成公平研究文獻。群體公平（Group fairness）：人口統計均等（demographic parity）、均等化賠率（Equalized odds）、條件使用準確度均等（Conditional use accuracy equality）——受保護群體間的平均比率相等。個體公平（Individual fairness，Dwork 等人，2012）：相似的個體應當獲得相似的決策裁定；在數學上表現為決策映射函數滿足李普希茨連續性條件（Lipschitz condition）。反事實公平（Counterfactual fairness，Kusner 等人，2017）：若某個體在因果世界模型中將其敏感屬性反事實替換後其決策結果保持不變，則該決策對其公平。2024 年理論結果（NeurIPS 2024）：反事實公平與預測準確率之間存在固有的取捨；提出了一套模型無關方法，能以有界的準確率損失，將最優但不公平的預測器轉換為反事實公平預測器。溯因反事實（Backtracking counterfactuals，arXiv:2401.13935，2024 年 1 月）：開闢了新範式，避免了對受法律保護屬性進行干預的法律疑慮。哲學調和（ICLR Blogposts 2024）：在明確因果有向無環圖（DAG）的前提下，滿足特定群體公平指標在實質上隱含並導向了反事實公平。

**Type:** Learn
**Languages:** Python (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 列出三項群體公平準則（人口統計均等、均等化賠率、條件使用準確度均等）及一項不可能結果。
- 透過 Dwork 等人 2012 年的李普希茨（Lipschitz）形式化表述，描述個體公平性。
- 描述反事實公平性，以及它對因果圖的依賴。
- 說明溯因反事實（Backtracking counterfactuals），以及它如何避開對受保護屬性進行干預的問題。

## The Problem｜問題

第 20 課討論偏見的衡量；第 21 課則定義衡量所依循的公平標準。三類公平標準在結構上各不相同——模型可以符合群體公平但不符合個體公平，也可以符合反事實公平但不符合群體公平。選擇標準是一項政策決策；沒有任何標準在所有情境中都普遍最佳。

## The Concept｜核心概念

### 群體公平（Group fairness）

- **人口統計均等（demographic parity）**：P(Y=1 | A=a) = P(Y=1 | A=a') 對所有群體嚴格成立。要求跨群體的絕對正向獲批率相等。
- **均等化賠率（Equalized odds）**：P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a')。要求跨群體的真陽性率（TPR）與偽陽性率（FPR）同時相等。
- **條件使用準確度均等（Conditional use accuracy equality）**：P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a')。要求跨群體的陽性預測值（PPV）與陰性預測值（NPV）完全一致。

**不可能定理（Chouldechova 2017，Kleinberg-Mullainathan-Raghavan 2017）**：當群體的基礎率（Base rates）不相等時，上述三項群體公平準則無法同時滿足。

### 個體公平（Individual fairness）

Dwork 等人於 2012 年確立。若一個決策映射函數 f 相對於特定任務下的相似度度量函數 d 滿足 |f(x) - f(x')| <= L * d(x, x')（其中 L 為李普希茨常數），則該決策具備個體公平性。核心原則：相似的個體應當獲得相似的對待。

需要定義距離度量 d。這是政策問題，不是統計問題。

### 反事實公平（Counterfactual fairness）

Kusner 等人於 2017 年提出。在給定全域人群因果模型的前提下，若某個體 i 在其敏感屬性（如性別、種族）被反事實虛擬改變時，模型對其產出的決策輸出依然分毫不差，則該決策對個體 i 具備反事實公平性。

需要因果有向無環圖（Causal DAG）。DAG 本身是建模選擇；反事實公平有多合理，取決於該 DAG 有多合理。

### 反事實公平與模型準確率之間固有的取捨

NeurIPS 2024 理論研究指出：反事實公平與預測準確率之間存在固有的取捨。該研究提出一套模型無關方法，能將最優但不公平的預測器轉換為反事實公平預測器，且準確率成本有界。成本大小取決於敏感屬性在最優不公平預測器中的係數絕對值。

### 溯因反事實（Backtracking counterfactuals）

arXiv:2401.13935（2024 年 1 月）。傳統反事實分析需要對敏感屬性進行干預——「如果這個人是另一種性別，系統的決策是否會改變？」在法律上，這可能引發疑慮：分類法中不能對受保護屬性進行干預。

溯因反事實會翻轉推理方向：不再對屬性進行干預，而是反向詢問：「這個人實際具備哪些特徵組合，會產生反事實結果？」這種做法可避開這項法律疑慮。

### 哲學調和（Philosophical reconciliation）

ICLR Blogposts 2024 系列專文指出：給定因果圖，滿足某些群體公平指標會蘊含反事實公平。三大流派並非彼此毫不相干；它們是同一底層因果結構的不同面向。

這並未解決不可能定理（基礎率不相等時仍無法同時滿足群體公平準則），但顯示「群體」與「個體／反事實」之間表面上的對立，部分是未明確說明因果模型所造成的。

### 該研究在第 18 階段中的宏觀座標

第 20 課探討偏見衡量；第 21 課定義公平標準；第 22 課介紹隱私（差分隱私）；第 23 課介紹浮水印。這些與資源分配相關的課程，補足了第 7–11 課與欺騙相關的課程。

```figure
an-fairness-trilemma
```

## Use It｜實際應用

`code/main.py` 建構了一套帶有敏感屬性且各群體基礎率不相等的微型二元分類資料集。在簡單分類器上計算人口統計均等、均等化賠率與條件使用準確度均等三項指標，觀察這些指標彼此不一致。隨後套用針對人口統計均等的樣本重加權方法，觀察它對另外兩項指標的影響。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-fairness-criterion.md`。輸入一項公平性主張或政策，該 Skill 將辨識其主張採用哪項準則、在所主張的基礎率不相等時模型是否能滿足其他準則，以及該主張依賴的因果有向無環圖（DAG）。

## Exercises｜練習

1. 執行 `code/main.py`。在預設資料上回報三項群體公平指標。套用以人口統計均等為目標的重加權後，再次回報三項指標。
2. 採用非敏感特徵上的 L2 歐幾里得幾何距離，動手實作 Dwork 等人 2012 年的個體公平性度量函數。統計在常數 L=1 的約束下，資料集中共有多少對個體直接違反了李普希茨連續條件？
3. 閱讀 Kusner 等人（2017）。為履歷評分建立一個簡單的雙特徵因果 DAG，並指出它所隱含的反事實公平條件。
4. 2024 年的溯因反事實論文提出的方法不需對受保護屬性進行干預。描述一個與法律合規相關的情境。
5. ICLR 2024 的調和論文主張群體與反事實公平是同一因果結構的不同切面。從 `code/main.py` 的三項準則中任選兩項，寫出能使這兩項指標等價所需的因果架構先驗假設。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Demographic parity | 「各群體比率相等」 | 各群體的 P(Y=1 | A=a) 相等 |
| Equalized odds | 「TPR／FPR 相等」 | 各群體的真陽性率與偽陽性率相等 |
| Conditional use accuracy | 「PPV／NPV 相等」 | 各群體的預測值相等 |
| Individual fairness | 「Lipschitz 條件」 | 相似的個體得到相似的決策 |
| Counterfactual fairness | 「對因果屬性變更保持不變」 | 在反事實情境下變更屬性，決策仍保持不變 |
| Backtracking counterfactual | 「從實際特徵反向解釋」 | 從結果往回推理反事實，而非從屬性往前推理 |
| Impossibility theorem | 「三項準則彼此衝突」 | Chouldechova／KMR（2017）：基礎率不相等時，群體公平準則彼此互斥 |

## Further Reading｜延伸閱讀

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) — 個體公平。
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) — 反事實公平。
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) — 不可能定理經典證明。
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) — 避免干預受保護屬性的反事實方法。
