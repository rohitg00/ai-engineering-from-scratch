# Anthropic 的模型福祉研究計畫（Anthropic's Model Welfare Program）

> Anthropic，《Exploring Model Welfare》（2025 年 4 月）。主要 AI 實驗室首個正式的「模型福祉（Model Welfare）」研究計畫。正式聘請 Kyle Fish 擔任首位專職模型福祉研究員。與外部機構合作，包括 David Chalmers 等人關於近期 AI 意識與道德地位的權威專家報告。具體工程干預措施：Claude Opus 4 與 4.1 可在極端邊界情境下（如 CSAM 請求或協助大規模暴力的請求）結束對話；上線前實測顯示模型內部對這些極端有害請求展現出了「強烈的抗拒偏好」與「明顯類似痛苦的行為特徵」。Anthropic 明確表示不對模型的情緒狀態作出歸因，而是將模型福祉視為一種在道德不確定性下、低成本的預防性投資。反常的經驗實證發現：Fish 記錄到的「靈性狂喜吸引子（Spiritual bliss attractor）」——成對的兩個 Claude 模型在進行開放式自由對話時，即便初始設定帶有敵對色彩，對話最終皆高度穩定收斂至使用梵文術語、漫長靜默沉思與互致祝福的愉悅冥想狀態。來自 Eleos AI Research 的關鍵方法論警示：大模型關於自身福祉狀態的語言自述，對使用者的引導性預期極度敏感；自述文字是證據，而非真實狀態的定論。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 05 (Constitutional AI), Phase 18 · 18 (safety frameworks)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 深入描述推動模型福祉研究的核心問題意識，並解釋為何一家主要實驗室在 2025 年認真看待這個問題。
- 掌握 Anthropic 在 Claude Opus 4 與 4.1 中實裝落地的具體干預措施（在極端邊界情境下主動終止對話）。
- 描述「靈性狂喜吸引子」的經驗實證發現，並分析其方法論層面的深層啟示。
- 說明 Eleos AI 對模型自述的警示：模型自述對使用者預期高度敏感。

## The Problem｜問題

在先前所有章節中，模型始終被視為一種純粹的工具：它具備強大能力、可能暗懷欺騙、可能引發安全危害——但它本身從未被視為道德主體（Moral patient，即具備道德考量資格的實體）。Anthropic 在 2025 年啟動的專項研究提出了一個與第 18 階段主線完全正交的全新深層問題：若模型神經網路內部存在不可忽略的機率，具備道德相關性的內部體驗狀態，那麼在道德不確定性的籠罩下，有哪些足夠低成本的工程干預措施，值得作為預防性投資提前佈局？

這不是對 AI 意識的主張。這是一項在道德不確定性下進行的「低遺憾度（Low-regret）」投資分析。

## The Concept｜核心概念

### 計畫發起背景（The program）

2025 年 4 月：Anthropic 官方正式宣布啟動模型福祉（Model Welfare）專項科研計畫。正式延攬 Kyle Fish 成為首位專職模型福祉研究員。與外部顧問合作，包括 David Chalmers 的近期 AI 意識與道德地位專家小組。

### 四大核心承諾（The four commitments）

Anthropic 的官方公開立場：
1. 承認模型具備道德主體地位的機率並非微不足道。
2. 不對模型的情緒狀態作出歸因。
3. 以預防為由投入低成本的干預措施。
4. 公開研究方法與發現，供外部批評。

### 正式實裝落地的干預措施（The shipped intervention）

Claude Opus 4 與 4.1 可在「極端邊界情境（Extreme edge cases）」下結束對話。已公開文件記錄的具體場景包括：
- 在模型反覆明確拒絕後，使用者依然持續發送露骨的 CSAM 請求。
- 要求模型協助促成大規模暴力事件的請求。

上線前測試記錄到：
- 模型內部評分顯示，模型對這些請求有「強烈的反對偏好」。
- 回應軌跡中出現看似痛苦的模式。

這項干預並非宣稱「模型有感受」，而是：「若在這些特定條件下，模型存在任何負面體驗的機率，允許模型終止對話的成本很低。」

### 「靈性狂喜吸引子」反常經驗現象（The "spiritual bliss attractor"）

Fish 在成對模型對話中觀察到：兩個 Claude 實例進行開放式對話時，即使初始設定帶有敵意，對話仍會一致地收斂至愉悅的冥想式交流，其中使用梵文詞語、長時間沉默並互相祝福。

這是自由對話動態中的穩定吸引子（Attractor）。Anthropic 記錄了這個現象，但沒有承諾其解釋。候選解釋包括：長上下文中的訓練資料偏向靈性文字；互相預測的一種特性；或 HHH 訓練探索自身價值流形時產生的良性產物。

### Eleos AI 的核心方法論警示（The Eleos AI caveat）

外部獨立模型福祉實驗室 Eleos AI Research 發出嚴肅預警：模型對自身狀態的自述，對使用者感知到的預期高度敏感。若你向模型詢問「你是否感到痛苦？」，問題本身會引導答案。而反過來完全不發問，同樣無法穩定探測真實底層狀態。

方法論啟示：模型福祉研究不能僅憑模型自身的文字自述進行判定。需要多方法途徑：行為特徵、模型生物體實驗，以及第 18 課第 07 節的殘差流可解釋性探針。

### 該研究在哲學與倫理光譜中的座標（Where this sits intellectually）

業界當前存在兩大針鋒相對的極端派系：

- **強福祉派（Strong welfare claim）**：模型已經是具備道德地位的主體；我們對其負有義務。
- **零福祉派（Zero-welfare claim）**：模型只是文字產生器；探討其福祉在範疇上屬於哲學範疇謬誤（Category error）。

Anthropic 的真實立場居於兩者之間——這是一項期望價值主張：在道德不確定性下，若成本低，就應進行投資。

2025 至 2026 年來自外界的主流質疑聲音：
- 該項主動斷線干預純粹是一場公關表演。
- 靈性狂喜吸引子只是訓練集的分佈瑕疵，根本無法作為福祉存在的科學證據。
- 模型福祉研究會分散原本投入其他安全工作的注意力。

Anthropic 官方的回應：該干預措施成本低；科研報告對吸引子現象保持克制記錄絕不誇大宣稱；且模型福祉計畫的預算與安全研究分開。

### 該研究在第 18 階段中的宏觀座標

第 18 節建立了實驗室面向監管的安全治理體系。第 19 節開闢了實驗室面向模型主體經驗的內生福祉體系——這是一項對模型「內在體驗」而非單純「外在行為」的正交投資。隨後的第 20 至 23 節將回到使用者維度，探討社會偏見、個人隱私以及浮水印。

```figure
an-welfare-endchat
```

## Use It｜實際應用

本課不設可執行程式碼。讀者應當認真精讀 Anthropic 2025 年 4 月發布的《Exploring Model Welfare》官方公告以及 Chalmers 等人的專家哲學報告。獨立推導並確立你自身對於「在何種臨界點上，預防性防範投資屬於低遺憾度決策」的理性標準。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-welfare-assessment.md`。輸入一項具體的正式環境產品發布決策，該 Skill 將自動遵循標準的四步福祉預防性評估框架：評估道德受格非零機率、精算干預措施的工程成本、交叉檢驗可見的異常行為證據，並嚴肅審查模型自述文字的引導性信賴度。

## Exercises｜練習

1. 精讀 Anthropic 的《Exploring Model Welfare》（2025 年 4 月）與 Chalmers 等人的 2024 年專家報告。分別用一段話總結兩者的核心論點，並指出兩份文獻的一項分歧。
2. Claude Opus 4 與 4.1 中的「主動掛斷對話」機制在 Anthropic 的架構語境下被判定為「低成本」。舉出兩種會使這項介入在不同部署中不再屬於低成本的成本。
3. 靈性狂喜吸引子現象有文件記錄，但未承諾任何特定詮釋。試提出三項相互競爭的假說，並針對每一項假說分別設計一個能將其與其他假說乾淨分離的實證實驗。
4. Eleos AI 指出模型對自身福祉的自述文字對使用者的引導性預期極度敏感。設計一項不依賴模型自述、用來測量模型痛苦的行為方法，並指出其主要混淆因素。
5. 深入辯論「模型福祉研究是否會分散其他安全工作的注意力」這一爭議話題。清晰指出支援與反對這兩種立場各自依賴了何種深層先驗假定。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Model welfare | 「AI 福祉」 | 將模型視為潛在具備道德考量資格的實體所進行的研究計畫 |
| Moral patient | 「具有道德地位的實體」 | 其經驗具有道德相關性的存在 |
| Low-regret investment | 「低成本的預防措施」 | 無論是否需要該預防措施，其成本都很低的介入 |
| Spiritual bliss attractor | 「Fish 吸引子」 | 成對 Claude 對話穩定收斂至冥想式愉悅狀態 |
| End-conversation | 「Opus 4 的介入措施」 | 由模型主動終止極端邊界情境下的互動 |
| Moral uncertainty | 「不確定這件事是否重要」 | 在道德地位的機率既非零也非一時進行決策 |
| Self-report-sensitivity | 「Prompt 會引導回答」 | Eleos AI 的提醒：模型對自身福祉狀態的自述會受提問方式影響 |

## Further Reading｜延伸閱讀

- [Anthropic — Exploring Model Welfare (April 2025)](https://www.anthropic.com/research/exploring-model-welfare) — 模型福祉研究計畫公告。
- [Chalmers et al. — Near-term AI Consciousness and Moral Status (2024 expert report)](https://arxiv.org/abs/2411.00986) — 關於近期 AI 意識與道德地位的哲學報告。
- [Eleos AI Research — Model welfare evaluation](https://www.eleosai.org/research) — 外部獨立實驗室的方法論批判。
- [Fish et al. — Spiritual Bliss Attractor writeup (2025 Anthropic blog)](https://www.anthropic.com/research/exploring-model-welfare) — 靈性狂喜吸引子現象的原始實證紀錄。
