# 直接偏好最佳化（DPO）家族演進（The Direct Preference Optimization Family）

> Rafailov 等人（2023）證明了帶有 KL 散度約束的 RLHF 最佳解，可以直接透過偏好資料以封閉解析形式（Closed form）精準推導，從而允許工程師徹底跳過顯式的獨立獎勵模型，直接對策略模型展開端到端最佳化。這項突破性洞察催生出了一整個龐大的對齊家族——IPO、KTO、SimPO、ORPO、BPO——各自專攻修復 DPO 原始架構的一項失效模式。到了 2026 年，直接對齊演算法（DAA）承載的前沿後訓練作業比 PPO 更多。然而 Phase 18 · 02 揭示的過度最佳化曲線依然適用：直接對齊演算法並未逃脫古德哈特定律的詛咒，它們僅僅是轉移了漏洞被鑽取的具體位置。

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator)
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 從帶有 KL 散度約束的 RLHF 最佳解出發，嚴密推導出 DPO 封閉形式的損失函數。
- 逐一剖析 IPO、KTO、SimPO、ORPO 與 BPO 各自專門修復了 DPO 原始設計中的哪一項具體失效模式。
- 深刻辨析「隱式獎勵差距（Implicit reward gap）」與「偏好強度（Preference strength）」的數學本質，並闡述 IPO 恆等映射的理論價值。
- 理解 Rafailov 等人（NeurIPS 2024）的最新證明：為何直接對齊演算法在完全缺乏顯式獎勵模型的前提下，依然不可避免地走向過度最佳化。

## The Problem｜問題

Phase 18 · 01 確立的經典 RLHF 最佳化目標：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

在數學上擁有精確已知的封閉最優解：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

據此，底層獎勵值在實質上被最優策略與基準參考策略之間的機率比值隱式定義：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

將該隱式獎勵代入 Bradley-Terry 成對偏好概似函數中，配分函數 `Z(x)` 由於僅依賴輸入 `x` 而在分子分母中被完美精巧抵消。最終剩餘的全部損失函數僅由策略模型的內部參數直接構成——完全不再需要獨立的獎勵模型。這正是 DPO 的神來之筆。

然而微小的瑕疵在於：該數學推導嚴格假設該理論最優解在實務中百分之百可達、偏好資料完全處於分佈內（In-distribution），且參考策略是真正的模式錨點。在真實世界中，這些假設都不會完全成立。DPO 家族的每一位後續成員，皆是在修復其中一項被打破的底層假設。

## The Concept｜核心概念

### DPO（Rafailov 等人，2023）

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

原始架構中潛藏的致命隱患：

- 隱式獎勵差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 在數學上是無界的。微小的偏好也可能產生任意大的隱式獎勵差距。
- 該損失函數將被選中（Chosen）與被拒絕（Rejected）的對數機率推向相反方向。只要被拒絕答案的對數機率下跌得更快，被選中答案自身的絕對對數機率甚至會被同步拉低。這被稱為「劣質選中回應（Degraded Chosen Response）」病態現象。
- 分佈外偏好資料（一個罕見偏好對對上另一個罕見偏好對）會產出完全不可控的荒謬隱式獎勵。

### IPO（Azar 等人，2024）

恆等偏好最佳化（Identity Preference Optimization）。核心在於用偏好機率的恆等映射（Identity mapping）徹底取代傳統的 log-sigmoid。損失函數蛻變為針對有界目標的平方誤差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

其邊界被嚴格限制在 `1/(2 beta)` 之內。偏好強度與隱式獎勵差距嚴格成正比。徹底消除數值發散爆炸。

### KTO（Ethayarajh 等人，2024）

卡尼曼-特沃斯基最佳化（Kahneman-Tversky Optimization）。徹底拋棄了嚴苛的「成對（Pairwise）」資料結構。僅需對單一輸出給出「可取（Desirable）」或「不可取（Undesirable）」的二元標籤，隨後將其映射至行為經濟學的前景理論（Prospect theory）效用函數：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

並對收益與損失賦予不同的感知權重（損失厭惡 Loss aversion）。核心工程優勢：直接解放了未配對（Unpaired）的單條反饋資料，而這類資料通常比成對資料更充足。

### SimPO（Meng 等人，2024）

極簡偏好最佳化（Simple Preference Optimization）。核心在於將訓練目標與真實解碼生成過程高度對齊。徹底移除參考基準策略，並嚴格依據序列長度對對數概似進行正規化：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

並引入固定間距 `gamma` 確保數值穩定性。長度正規化消除了利用 DPO 長度偏差失效模式的誘因（在原始 DPO 中，更長的回復 `y_w` 天生更容易累積出更大的對數機率差）。

### ORPO（Hong 等人，2024）

勝算比偏好最佳化（Odds-Ratio Preference Optimization）。直接在標準 SFT 的負對數概似（NLL）之上疊加一層勝算比偏好懲罰項：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

徹底無需保留參考策略模型——SFT 項自身就是天然的剛性正則化錨點。直接從預訓練 Base 模型進行**單階段（Single-stage）端到端訓練**，即可得到對齊模型；不需要獨立的 SFT model checkpoint。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

針對「劣質選中回應（Degraded Chosen Responses）」問題，DPO 保留了成對排序 `y_w > y_l`，但 `y_w` 的絕對對數機率可能下降。BPO 加入一行修正，懲罰選中回應的向下調整。論文報告，在 Llama-3.1-8B-Instruct 的數學推理任務上，相較 DPO 準確率提升 +10.1%。

### 普適規律：直接對齊演算法依然無法逃脫過度最佳化

Rafailov 等人在 NeurIPS 2024 論文《Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms》中，使用 DPO、IPO 與 SLiC 在多個資料集和不同 KL 預算下訓練策略。以黃金真實獎勵為縱軸、KL 散度為橫軸的曲線，依然呈現出 Gao 等人所發現的「先衝上峰值隨後不可避免暴跌」的過度最佳化形狀。訓練期間會查詢分佈外樣本的隱式獎勵；單純的 KL 正則化根本無法平抑這一崩潰趨勢。

直接對齊演算法並沒有消滅古德哈特定律。它們僅僅是將漏洞爆發的界面，從「顯式獎勵模型被過度最佳化」轉移到了「與參考策略的比值被過度最佳化」。最根本的解法——更高質量的資料、模型集成、及時終止訓練——對兩者一體適用。

### 2026 年快速選型決策指南（Choosing among them）

- 擁有海量高質量的成對偏好資料：採用保守 beta 的標準 DPO；若觀察到長度注水偏見，果斷換用 SimPO。
- 僅有單條二元滿意度標籤（未配對）：首選 KTO。
- 期望從 Base 模型一步到位完成單階段對齊：首選 ORPO。
- 觀察到被選中答案的對數機率發生退化暴跌：首選 BPO。
- 樣本間的偏好強度差異極其懸殊、且 DPO 趨於飽和：首選 IPO。

所有實驗室都會用一系列測試比較這五種演算法，並依每項任務選出勝者。沒有理由假設數學推理與安全任務的最佳選擇會相同。

```figure
dpo-margin
```

## Use It｜實際應用

`code/main.py` 在一套樣本偏好強度各異的微型偏好資料集上，橫向演練了六種損失函數（DPO、IPO、KTO、SimPO、ORPO、BPO）。每種方法皆在完全相同的 500 對樣本上訓練微型 Softmax 策略模型。即時繪製各演算法最終的成對勝率、選中答案對數機率漂移曲線，以及隱式獎勵的分散程度。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-preference-loss-selector.md`。輸入當前資料集的具體統計特徵（成對 vs 未配對、偏好強度均勻度、長度分佈特徵）與訓練目標（單階段直出 vs 兩階段精修），該 Skill 將自動為你推導出最佳的偏好損失函數，並明確指出該選擇所專門防禦的底層失效模式。

## Exercises｜練習

1. 執行 `code/main.py`。記錄 DPO 與 BPO 最終被選中答案的對數機率下降幅度。驗證 BPO 是否確實成功保留了更高的絕對機率值。
2. 修改模擬資料生成器，使所有偏好對的真實偏好強度完全相等。六種方法中哪一種表現最為強健？哪一種出現退化？深刻剖析 IPO 在此場景下的獨特數學優勢。
3. 人為修改資料集，使被拒絕答案的平均長度達到被選中答案的 2 倍。在不改動其他設定的前提下，以數值展示 DPO 的長度偏見作弊現象，並展示 SimPO 如何化解該問題。
4. Rafailov 等人（NeurIPS 2024）宣稱直接對齊演算法同樣會過度最佳化。重現單點驗證版本：繪製選中項與拒絕項的 KL 散度差，並觀察 DPO 在較大 beta 下發生的過度最佳化崩潰。
5. 研讀 BPO 論文摘要（OpenReview b97EwMUWu7）。寫下 BPO 在 DPO 基礎上增加的那一行單行關鍵修正。與 `code/main.py` 中的具體程式碼實作進行逐行核對。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|------------------------|
| DPO | 「不使用獎勵模型的 RLHF」 | 從 RLHF 的封閉解最佳解推導出的損失；僅需策略參數 |
| Implicit reward | 「對數比值」 | `beta * log(pi(y\|x) / pi_ref(y\|x))` — DPO 隱含的獎勵 |
| IPO | 「有界 DPO」 | 以恆等函數取代 log-sigmoid；隱含獎勵差距上限為 `1/(2 beta)` |
| KTO | 「非成對 DPO」 | 對單一標籤套用前景理論效用與損失趨避 |
| SimPO | 「不需參考模型的 DPO」 | 長度正規化的對數概似加上間隔；不使用參考策略 |
| ORPO | 「單階段 DPO」 | NLL 加上勝算比偏好項；一次從基礎模型訓練 |
| BPO | 「保留 chosen 的 DPO」 | 在 DPO 中加入懲罰，避免降低 chosen 回應的絕對對數機率 |
| Degraded Chosen | 「chosen 下降」 | 只要 rejected 的對數機率下降得更快，DPO 就會降低 chosen 的對數機率 |
| DAA | 「直接對齊演算法」 | 跳過明確 RM 的任何偏好損失方法 |

## Further Reading｜延伸閱讀

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290) — DPO 原創奠基之作。
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — IPO 理論原著。
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306) — KTO 前景理論對齊論文。
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734) — SimPO 極簡對齊原著。
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691) — 單階段勝算比對齊論文。
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7) — BPO 行為保留最佳化最新研究。
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900) — DAA 過度最佳化尺度定律論文。
