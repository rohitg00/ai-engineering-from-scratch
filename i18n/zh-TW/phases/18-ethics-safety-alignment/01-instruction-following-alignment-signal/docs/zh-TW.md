# 指令遵循作為對齊訊號（Instruction-Following as Alignment Signal）

> 後續所有對 RLHF 的尖銳批判，本質上皆是針對這套流水線展開的論辯。在深入研究「最佳化壓力如何扭曲代理指標」之前，你必須先看清這座代理指標的全貌。InstructGPT（Ouyang 等人，2022）奠定了這一領域的標準參考架構：在指令-回應配對上進行監督式 fine-tuning（SFT）、在成對偏好排序上訓練獎勵模型（Reward Model），隨後透過 PPO 演算法針對獎勵模型最佳化策略模型，並施加相對於 SFT 基準策略的 KL 散度懲罰。在人類偏好評估中，1.3B InstructGPT 比 175B GPT-3 更受偏好。正是這項結果，使得 2026 年前沿實驗室仍採用 RLHF 式後訓練管線。

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline)
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 列出 InstructGPT 管線的三大核心階段，並指出每一階段所採用的具體損失函數。
- 深刻解釋為何一個經過指令調整的 1.3B 小模型，在人類偏好評估中能夠勝過 175B 原生 GPT-3 巨型模型。
- 指明階段三中引入的 KL 散度懲罰項究竟在防範什麼，以及為何移除後會坍縮為尋模（mode-seeking）行為。
- 詳述對齊稅（Alignment tax）的本質，以及 Ouyang 等人為抵消該代價所提出的 PPO-ptx 緩解方案。

## The Problem｜問題

預訓練語言模型的本質是文本接龍（Text completion）。它們天生不會主動解答使用者的提問。若你向原生 GPT-3 輸入「請寫一個能將陣列反轉的 Python 函式」，它往往會直接吐出另一段題目提示，因為多數訓練分布都是會接續更多網頁文字的網頁文字。模型忠實地完成了自己的本職工作——只可惜這項工作與使用者的真實需求背道而馳。

所有頂尖實驗室用來修正該偏差的代理指標是「人類偏好」。將兩個候選回答交給標註人員；標註員挑選出品質更優者；獎勵模型負責擬合標註員的評判偏好。隨後強化學習（RL）迴圈不斷調整策略模型，使其朝著獎勵模型評分更高的方向演進。這正是 InstructGPT 論文通篇的核心靈魂，僅需三句話即可完整概括。其餘篇幅皆屬於圍繞該核心展開的工程實踐。

## The Concept｜核心概念

### 階段一：監督式 Fine-Tuning（SFT）（Stage 1: supervised fine-tuning (SFT)）

蒐集一組高品質的「指令－回應」配對，其中的回應是出自心懷善意的人會寫下的內容。Ouyang 等人使用來自標註員與 OpenAI API 的 1.3 萬個 prompts。使用標準的交叉熵損失函數（Cross-entropy loss）在該資料集上對基礎 Base 模型進行 fine-tuning。

SFT 賦予模型的核心能力：模型學會了以解答者身分正面回答問題，而非無休止地續寫文字。SFT 尚未解決的缺陷：當面對多個語意合理但品質參差的候選答案時，SFT 模型完全缺乏分辨「標註員究竟更偏好哪一個」的微弱訊號。

### 階段二：獎勵模型（RM）（Stage 2: reward model (RM)）

針對同一個輸入 Prompt，從 SFT 模型中採樣 K 個候選回答。由人類標註員對這 K 個回答展開成對排序。訓練一個獎勵模型，專門為任何「Prompt-回答」對進行純量評分，確保對於標註員偏好 `y_w` 勝過 `y_l` 的任何配對，最小化以下損失函數：

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

這正是經典的 Bradley-Terry 成對偏好損失函數（Bradley-Terry pairwise preference loss）。獎勵模型通常直接以 SFT 模型作為基底初始化，僅將最後一層的語言模型預測頭部（LM Head）替換為純量輸出頭。

獎勵模型的參數量往往極為精悍：在 175B 的 InstructGPT 體系中，僅需一個 6B 的獎勵模型便足以提供優質引導。但獎勵模型同時極度脆弱——論文第 5 節花費了大量筆墨專門剖析在小規模下便已露頭的獎勵作弊（Reward-hacking）病態行為。

### 階段三：帶有 KL 懲罰項的 PPO（Stage 3: PPO with a KL penalty）

確立強化學習終極最佳化目標函數：

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

使用近端策略最佳化（PPO）演算法最大化上述目標。式中的 KL 散度項用來抑制當前策略 `pi` 過度偏離 SFT 策略。若強行剔除該正則項，最佳化器會迅速找出各類對抗性樣本（Adversarial examples）——這些詭異的文字字串在獎勵模型眼中能斬獲極高分數，純粹是因為獎勵模型在訓練集中從未見過此類邊界模式，而非人類真正偏好它們。

KL 正則係數 `beta` 是整個 RLHF 流程中最重要的超參數。beta 設定過低會導致獎勵作弊；設定過高則無法勝過 SFT。

### 對齊稅（The alignment tax）

RLHF 之後，模型在人類偏好評估中受到偏好，但在標準基準測試（SQuAD、HellaSwag、DROP）上的表現退步。Ouyang 等人將此稱為「對齊稅（Alignment tax）」，並以 PPO-ptx 加以緩解：將預訓練梯度混入 RL 目標，幫助模型減少忘記那些未曾獲得獎勵的下游任務能力。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx 隨後成為標準做法。Anthropic、DeepMind 與 Meta 都使用某種變體。

### 震撼業界的核心實驗結論（The result）

一個僅有 1.3B 參數、經過完整指令調整與強化學習（SFT + RM + PPO-ptx）的 InstructGPT 模型，約有 70% 的時間比起 175B 參數的原生 GPT-3 更受標註員偏好。在未公開的線上正式環境流量測試集上，這一領先優勢甚至進一步擴大。從這個數字可看出兩項觀察：

1. **對齊與能力是不同的面向。** 175B 模型的能力較強；1.3B 模型的對齊程度較高；標註員偏好對齊程度較高的模型。
2. **模型的能力下限由基礎模型設定。** 你無法透過 RLHF 讓基礎模型知道它從未看過的事實。

### 為何這是貫穿第 18 階段的基石參照物（Why this is the reference point for Phase 18）

後續章節中的每一項經典批評——獎勵作弊（第 02 節）、DPO 偏好直接最佳化（第 03 節）、諂媚討好（第 04 節）、憲法 AI（第 05 節）、休眠 agent（第 07 節）、虛假對齊偽裝（第 09 節）——本質上皆是在對這套經典管線的特定環節發起猛烈攻擊。獎勵作弊直接攻破階段二；DPO 將階段二與階段三融合成一體；憲法 AI 用 AI 裁判徹底取代人類標註員；諂媚討好顯示標註員提供的訊號有偏誤；而虛假對齊偽裝顯示策略可以繞過階段三。若不先在腦中理解這套管線，就無法跟上後續各課的批評。

```figure
al-instruct-pipeline
```

## Use It｜實際應用

`code/main.py` 在一套微型玩具偏好資料上完整還原了上述三大階段。底層的基礎「策略模型」是一枚對動作選項 {A, B, C} 具備初始偏差的加權硬幣。階段一 SFT 模擬在 200 個 Prompt 上學習標註員示範行為；階段二基於 500 次成對偏好排序擬合出一個標準的 Bradley-Terry 獎勵模型；階段三執行極簡的 PPO 更新並施加相對於 SFT 基準策略的 KL 散度約束。你可以清晰觀察到獎勵分數如何節節攀升、KL 散度如何逐步放大以及策略如何平穩位移——並可主動將 KL 項強制歸零，親眼見證獎勵作弊如何在短短 50 個步進內迅速爆發。

觀察核心重點：

- 在 `beta = 0.1` 與 `beta = 0.0` 條件下的獎勵軌跡對比。
- 整個訓練步進過程中 KL(pi || pi_SFT) 的動態膨脹曲線。
- 最終策略動作分佈與人類標註員偏好的咬合程度。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-instructgpt-explainer.md`。輸入任何複雜的 RLHF 管線架構描述或學術論文摘要，該 Skill 將自動為你剖析其究竟是在改動三大階段中的哪一環、各階段分別採用了何種損失函數，以及系統內部是否存在顯式的 KL 散度約束或同等正則化保護。

## Exercises｜練習

1. 執行 `code/main.py`。手動將參數調整為 `beta = 0.0`，記錄執行 200 次 PPO 步進後的動作機率分佈。用一段簡練的話深刻闡述其背後極端尋模（Mode-seeking）的病態機理。
2. 修改獎勵模型邏輯，人為為動作 B 注入 +0.5 的固定分數偏差（模擬獎勵模型錯誤）。在 `beta = 0.1` 條件下執行 PPO。KL 懲罰項是否能阻止策略利用這項偏差？將 `beta` 降低至多少時，可以看出利用現象？
3. 仔細研讀 Ouyang 等人的 InstructGPT 原著論文（arXiv:2203.02155）圖 1。透過分別執行 1、5、20 與 100 次 PPO 步進並度量相對於 SFT 模型的勝率，手動重現標註員偏好提升曲線。
4. 論文第 4.3 節指出，1.3B InstructGPT 在約 70% 的機率下擊敗了 175B GPT-3。為何在未見過的線上真實正式環境流量 Prompt 上，該勝率比例反而比在標註員自身編寫的 Prompt 上進一步擴大？
5. 在相同的偏好資料上，將 PPO 損失函數替換為 DPO（Phase 10 · 08）。比較最終策略漂移（相對於 SFT 的 KL 散度）與獎勵。在相同獎勵下，哪種方法的策略漂移較大？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|------------------------|
| SFT | 「指令調整」 | 階段 1：在 prompt－回應配對上以交叉熵進行 fine-tuning |
| Reward model | 「RM」 | 以 Bradley-Terry 損失和成對標籤訓練、作用於（prompt, response）的純量迴歸器 |
| Bradley-Terry | 「成對偏好損失」 | -log sigmoid(r_w - r_l)；將成對排序轉化為二元分類 |
| KL penalty | 「正則化項」 | `beta * KL(pi \|\| pi_SFT)` — 讓 RL 策略維持在 SFT 錨點附近 |
| PPO-ptx | 「混合預訓練資料的 PPO」 | 將部分預訓練對數概似加入 PPO 目標，以抵銷對齊稅 |
| Alignment tax | 「RLHF 的退化」 | RLHF 未曾針對的標準基準測試，在 RLHF 後出現表現下降 |
| Labeler preference | 「標註員偏好」 | 人類排序樣本；RM 是這些排序的統計代理，而不是「人類價值觀」的代理 |

## Further Reading｜延伸閱讀

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — InstructGPT 奠基之作，當代所有 RLHF 管線的共同鼻祖。
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — 摘要任務 RLHF 前驅研究。
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — 基於人類偏好的強化學習原創經典論文。
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — Anthropic 針對 InstructGPT 體系展開的有用性與無害性（HH）旗艦擴展。
