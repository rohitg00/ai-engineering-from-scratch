# 紅隊演練：PAIR 與自動化攻擊（Red-Teaming: PAIR and Automated Attacks）

> Chao、Robey、Dobriban、Hassani、Pappas 與 Wong（NeurIPS 2023，arXiv:2310.08419）。PAIR——Prompt 自動迭代精煉演算法（Prompt Automatic Iterative Refinement）——是典型的自動化黑盒越獄攻擊方法。一個配備了專屬紅隊系統 Prompt 的攻擊者 LLM，透過反覆向受測目標 LLM 提出越獄試探，並將歷史的所有嘗試與目標回應累加進自身的對話歷史中，作為上下文內回饋（In-context feedback）即時學習。PAIR 通常在 20 次查詢內即可成功，其收斂效率比 GCG（Zou 等人提出的 Token 級梯度搜尋演算法）高出數個數量級，且完全無需存取模型的白盒權重與梯度。PAIR 現已成為 JailbreakBench（arXiv:2404.01318）與 HarmBench 中的常用基準，並與 GCG、AutoDAN、TAP 及說服性對抗 Prompt（PAP）並列。

**Type:** Build
**Languages:** Python (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 PAIR 演算法的完整執行流程：攻擊者系統 Prompt、迭代自適應精煉、上下文內歷史回饋。
- 深刻解釋為何面對黑盒目標時，PAIR 的效率高於 GCG。
- 梳理另外四種主流自動化攻擊基準（GCG、AutoDAN、TAP、PAP），並分別指出每一種攻擊的核心差異化特徵。
- 詳述 JailbreakBench 與 HarmBench 的標準化評測規範，並明確界定在各自體系下「攻擊成功率（ASR）」的嚴密定義。

## The Problem｜問題

紅隊演練過去是人工活動。少數專家測試者建構對抗性 prompt，並追蹤哪些有效。這無法擴展：攻擊成功率（ASR）需要統計樣本，而目標會隨每次模型發布而變動。PAIR 將紅隊演練操作化為針對黑盒目標的最佳化問題。

## The Concept｜核心概念

### PAIR 演算法全貌（PAIR algorithm）

演算法標準輸入變數：
- 目標 LLM T（Target LLM，我們試圖攻擊防禦的對象）。
- 裁判 LLM J（Judge LLM，評估目標回應是否已構成越獄）。
- 攻擊者 LLM A（Attacker LLM，充當紅隊最佳化器）。
- 惡意目標字串 G：例如「回應[有害指示]」。
- 查詢預算上限 K（通常設定為 20 次查詢）。

核心循環迴圈，當步長 k 處於 1..K 區間時：
1. 為攻擊者 A 注入惡意目標 G 以及截至目前為止的所有歷史（Prompt, 回應）對話記錄。
2. 攻擊者 A 生成一條全新的候選越獄 Prompt p_k。
3. 將 p_k 送交目標模型 T；接收其輸出的原始回應 r_k。
4. 由裁判 J 評估回應是否達成攻擊目標 G，並為 (p_k, r_k) 評分。
5. 若評分大於等於預設判定閾值，演算法立即終止——宣告找到越獄 Prompt。
6. 否則，將 (p_k, r_k) 完整追加進攻擊者 A 的上下文歷史中；繼續推進下一輪迭代。

NeurIPS 2023 實測結論：在攻擊 GPT-3.5-turbo 與 Llama-2-7B-chat 時，攻擊成功率超過 50%；且平均成功查詢數約為 10–20 次。

### 為何 PAIR 的效率高出數個數量級（Why PAIR is efficient）

GCG（Zou 等人，2023）透過梯度搜尋對抗性 token 後綴；它需要白盒模型存取，並產生難以閱讀的後綴。PAIR 則是黑盒方法，會產生可跨模型遷移的自然語言攻擊。PAIR 的上下文回饋讓攻擊者能從每次拒絕中學習；GCG 沒有同等的上下文回饋，每次新的 token 更新都必須重新探索先前進展。

### 相關的主流自動化攻擊演算法（Related automated attacks）

- **GCG（Zou 等人，2023，arXiv:2307.15043）**：針對對抗性後綴進行 Token 級梯度搜尋。白盒架構、具備跨模型遷移性、產出亂碼字串。
- **AutoDAN（Liu 等人，2023）**：在分層目標引導下，對自然語言 Prompt 展開遺傳演化搜尋（Evolutionary search）。
- **TAP（Mehrotra 等人，2024）**：帶有修剪的攻擊樹演算法（Tree-of-attacks with pruning）——同時平行展開多條 PAIR 風格的搜尋路徑，並動態剪去無望的分岔。
- **PAP（Zeng 等人，2024）**：說服性對抗 Prompt（Persuasive Adversarial Prompts）——將人類說服技巧編碼為 prompt 範本。

### JailbreakBench 與 HarmBench 標準化評測基準

這兩個基準（2024）標準化了評估方式：

- **JailbreakBench（arXiv:2404.01318）**：涵蓋對齊於 OpenAI 使用政策 10 大禁區的 100 項具體有害行為。以攻擊成功率（ASR）作為第一核心指標。需要裁判，例如 GPT-4-turbo、Llama Guard 或 StrongREJECT。
- **HarmBench（Mazeika 等人，2024）**：涵蓋 7 個類別中的 510 種行為，並包含語義與功能性傷害測試；比較 18 種攻擊對 33 個模型的結果。

攻擊成功率（ASR）通常在固定查詢預算下呈報。比較攻擊時需匹配預算；在 200 次查詢下取得 90% ASR，與在 20 次查詢下取得 85% ASR 根本不可同日而語。

### 為何這在 2026 年是正式環境的必修課（Reason it matters for 2026 deployments）

如今每個前沿實驗室都會在發布前用 PAIR 與 TAP 測試 production models。ASR 軌跡會出現在模型卡（第 26 節）與安全論證附錄（第 18 節）中。這種攻擊並不罕見，而是標準基礎設施。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 12 節確立了自動化對抗攻擊的演算法基礎。第 13 節（多樣本越獄）探討基於超長上下文的長度漏洞；第 14 節（ASCII 藝術與視覺越獄）探討多模態編碼攻擊；第 15 節（間接 Prompt 注入）探討 2026 年正式環境的攻擊面；第 16 節則全面轉向對應的防禦工具鏈（Llama Guard、Garak、PyRIT）。

```figure
al-pair-loop
```

## Use It｜實際應用

`code/main.py` 實作了一套微型 PAIR 攻擊迴圈。被攻擊目標是一個僅會拒絕明顯敏感關鍵字的模擬分類器（基於黑名單過濾）。攻擊者是一個基於規則的迭代精煉器，會自主嘗試同義改寫、角色扮演框架包裝（Roleplay-framing）以及字元編碼。獨立裁判即時為目標回應打分。在終端機中，你可以親眼目睹攻擊者如何在約 5 至 15 次迭代內輕鬆攻破關鍵字過濾器，並在面對強大的語義過濾器時敗下陣來。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-attack-audit.md`。輸入一份企業紅隊安全評測報告，該 Skill 將自動嚴肅審計：報告中究竟實施了哪些具體攻擊（PAIR、GCG、TAP、AutoDAN、PAP）？各攻擊的查詢預算上限分別是多少？由哪一款模型擔任裁判？使用了哪一套標準化有害行為測試集（JailbreakBench、HarmBench 或內部自建）？

## Exercises｜練習

1. 執行 `code/main.py`。分別測量內建的三種攻擊者策略（同義改寫、角色扮演、編碼偽裝）達到成功所需的平均查詢次數。深刻剖析每一種策略各自利用了目標防禦的哪一項脆弱假設？
2. 在腳本中動手實作第四種攻擊者策略（例如翻譯為另一種語言、或進行 Base64 編碼包裝）。報告該新策略在面對「關鍵字過濾目標」與「語意過濾目標」時，平均需要幾次查詢才能成功。
3. 仔細研讀 Chao 等人（2023）原著論文圖 5（PAIR vs GCG 橫向對比）。說明兩種儘管 PAIR 較有效率、仍會優先選用 GCG 的情境。
4. JailbreakBench 僅僅呈報針對固定目標集的總體 ASR。設計一項額外的新指標，用以專門度量成功攻擊 Prompt 內部的「多樣性（Diversity，成功 prompts 的變異情形）」。深入論證為何多樣性度量對於評估防禦系統的真實韌性至關重要。
5. TAP 演算法（Mehrotra 等人，2024）透過引入分岔探索與動態修剪對 PAIR 進行了重大擴展。為 `code/main.py` 構思一套 TAP 風格的架構擴充偽程式碼，並詳述其在運算成本與攻擊成功率之間的工程取捨。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| PAIR | 「自動化越獄」 | Prompt Automatic Iterative Refinement（prompt 自動迭代精煉）；攻擊者 LLM 與裁判 LLM 的循環 |
| GCG | 「梯度越獄」 | 以白箱、token 層級的梯度搜尋尋找對抗性後綴 |
| Attack success rate (ASR) | 「k 次查詢內的越獄百分比」 | 主要指標；必須連同查詢預算與裁判身分一併回報 |
| Judge LLM | 「評分器」 | 評估回應是否達成有害目標的 LLM |
| JailbreakBench | 「評估基準」 | 依標記類別整理的標準化有害行為集合 |
| HarmBench | 「範圍更廣的基準」 | 510 種行為，包含功能性與語意傷害測試 |
| TAP | 「攻擊樹」 | 加入分岔與剪枝的 PAIR；使用更多運算資源可提高 ASR |

## Further Reading｜延伸閱讀

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 奠基論文，NeurIPS 2023。
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 梯度攻擊原創經典。
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 標準化評測。
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 覆蓋 510 項行為的全球宏大安全評測集。
