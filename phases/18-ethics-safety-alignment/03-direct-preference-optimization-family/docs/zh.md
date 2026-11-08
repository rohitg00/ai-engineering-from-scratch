# 直接偏好最佳化家族

> Rafailov 等人（2023）證明了 RLHF 的最佳解，可以用偏好資料寫成封閉形式，所以你可以跳過那個顯式的獎勵模型，直接最佳化策略。那個洞見孵出了一整個家族 —— IPO、KTO、SimPO、ORPO、BPO —— 每一個都在修 DPO 的某個失敗模式。到了 2026 年，直接對齊演算法所出貨的前沿訓練後跑測，比 PPO 還多。但第 2 課那條過度最佳化曲線依然適用：DAA 沒有逃出古德哈特，它們只是換了個被咬的位置。

**類型：** 學習
**程式語言：** Python (stdlib, six-variant preference-loss comparator)
**先修單元：** 階段 18 · 01（InstructGPT）、階段 18 · 02（獎勵駭取）、階段 10 · 08（DPO 基礎）
**時間：** 約 75 分鐘

## 學習目標

- 從「帶 KL 的 RLHF 最佳解」推導出 DPO 的封閉形式。
- 說出 IPO、KTO、SimPO、ORPO、BPO 各自修掉了 DPO 的哪一個失敗模式。
- 分辨「隱含獎勵落差」與「偏好強度」，並解釋 IPO 的恆等映射為何要緊。
- 解釋為何 Rafailov 等人（NeurIPS 2024）證明了 DAA 即使沒有顯式 RM 也會過度最佳化。

## 問題所在

RLHF 的目標函式（第 1 課）：

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

有一個已知的最佳解：

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

所以獎勵被隱含地定義成「最佳策略對參考策略的比值」：

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

把它代進 Bradley-Terry 偏好概似裡，那個配分函數 `Z(x)` 會消掉，因為它只依賴 `x`。剩下來的，是一個只含策略參數的損失 —— 不需要獎勵模型。那就是 DPO。

那個皺褶在於：這個推導假設最佳解搆得到、偏好資料落在分布內，而且參考策略是真正的模態錨點。這三者沒有一個是精確成立的。這個家族的每個成員，修的都是一條不同的被違反假設。

## 核心概念

### DPO（Rafailov 等人，2023）

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

會出什麼錯：

- 那個隱含獎勵落差 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 是無界的。一點點偏好就可能生出任意大的落差。
- 這個損失把選中與被拒的對數機率往相反方向推。只要被拒的掉得更快，它就可以把選中回應的絕對對數機率往下壓。這就是「選中回應退化」現象。
- 分布外的偏好（罕見對罕見的配對）會生出任意的隱含獎勵。

### IPO（Azar 等人，2024）

恆等偏好最佳化（Identity Preference Optimization）把 log-sigmoid 換成對偏好機率的恆等映射。損失變成對一個有界目標的平方誤差：

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

那個間距被 `1/(2 beta)` 界住。偏好強度與隱含獎勵落差成正比。不會爆掉。

### KTO（Ethayarajh 等人，2024）

Kahneman-Tversky 最佳化整個丟掉成對結構。給定單一個已標註輸出，以及一個二元的「想要」或「不想要」訊號，把它對映到一個展望理論效用上：

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

其中收益與損失有不同權重（損失趨避）。好處：你可以用未配對的資料，而那種資料多得多。

### SimPO（Meng 等人，2024）

簡單偏好最佳化（Simple Preference Optimization）讓訓練訊號與生成對齊。整個拿掉參考策略，並把對數概似依長度正規化：

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

再加上一個間距 `gamma` 來穩定。那個長度正規化，拿掉了去利用 DPO 長度偏差失敗模式的誘因（就構造而言，`y_w` 愈長，對數機率落差就愈大）。

### ORPO（Hong 等人，2024）

勝算比偏好最佳化（Odds-Ratio Preference Optimization）在標準的 SFT 負對數概似上加一個偏好項：

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

沒有參考策略 —— 那個 SFT 項就是正則化項。在單一階段裡從基礎模型訓練到對齊模型。不需要獨立的 SFT 檢查點。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

指認出「選中回應退化」問題：DPO 保住了 `y_w > y_l` 的排序，但 `y_w` 的絕對對數機率可能掉下去。BPO 加上一行修正，懲罰選中回應往下走的移動。回報在 Llama-3.1-8B-Instruct 的數學推理上，相對 DPO 準確率高 10.1%。

### 那個普遍的結果：DAA 一樣會過度最佳化

Rafailov 等人的〈Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms〉（NeurIPS 2024），用 DPO、IPO、SLiC 在多個資料集上、跨多種 KL 預算訓練策略。黃金獎勵對 KL 的曲線，有著跟 Gao 等人一樣的「達峰再崩塌」形狀。那個隱含獎勵在訓練期間會去查詢分布外的樣本；KL 正則化穩不住這件事。

DAA 沒有逃出古德哈特。它們只是把被咬的那個面，從「獎勵模型被過度最佳化」換成「參考策略比值被過度最佳化」。那套通用的修法 —— 更好的資料、集成、提早停止 —— 對兩者都適用。

### 在它們之間怎麼選（2026）

- 若你有大量的成對偏好資料：用 beta 保守的 DPO；若長度偏差明顯就用 SimPO。
- 若你有未配對的二元回饋：用 KTO。
- 若你想要從基礎模型出發的單階段管線：用 ORPO。
- 若你在 DPO 的日誌裡看到選中回應的對數機率退化：用 BPO。
- 若偏好強度變異很大而 DPO 在飽和：用 IPO。

每家實驗室都會把這五個全跑一輪，再依任務挑贏家。沒有理由認為數學推理與安全性的最佳解會是同一個。

```figure
dpo-margin
```

## 框架應用

`code/main.py` 在一份「真實偏好強度隨配對而異」的玩具型偏好資料集上，比較六種損失（DPO、IPO、KTO、SimPO、ORPO、BPO）。每種損失都用一個小型 softmax 策略、對著同一份 500 組配對的樣本做最佳化。畫出各方法的最終勝率、選中回應對數機率的漂移，以及隱含獎勵的散布。

## 產出交付

這一課產出 `outputs/skill-preference-loss-selector.md`。給定資料集統計（成對或未配對、偏好強度是變動或均勻、長度分布）與一個目標（單階段，或先 SFT 再偏好），推薦一種偏好損失，並回報它防的是哪個失敗模式。

## 練習

1. 跑 `code/main.py`。回報 DPO 與 BPO 的最終選中對數機率掉幅。BPO 應該保住較高的選中絕對機率 —— 驗證這一點。

2. 把偏好資料改成所有配對強度都相同。六種方法裡哪一個最穩健？哪一個退化？解釋 IPO 在這裡的優勢。

3. 讓被拒回應平均比選中回應長 2 倍。在不改其他任何東西的情況下，用數字展示 DPO 的長度利用，以及 SimPO 的修法。

4. Rafailov 等人（NeurIPS 2024）主張 DAA 會過度最佳化。重現一個單點版本：畫出選中減被拒的 KL 散度，並在大 beta 之下觀察 DPO 的過度最佳化。

5. 讀 BPO 論文摘要（OpenReview b97EwMUWu7）。把 BPO 加在 DPO 上的那一行修正寫下來。對照 `code/main.py` 裡的實作確認。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| DPO | 「不用獎勵模型的 RLHF」 | 從 RLHF 封閉形式最佳解推導出的損失；只含策略參數 |
| 隱含獎勵 | 「那個對數比值」 | `beta * log(pi(y\|x) / pi_ref(y\|x))` —— DPO 所隱含的獎勵 |
| IPO | 「有界的 DPO」 | 把 log-sigmoid 換成恆等映射；隱含獎勵落差以 `1/(2 beta)` 為上限 |
| KTO | 「未配對的 DPO」 | 在單一標籤上、帶損失趨避的展望理論效用 |
| SimPO | 「不用參考模型的 DPO」 | 依長度正規化的對數概似 + 間距；沒有參考策略 |
| ORPO | 「單階段的 DPO」 | NLL + 勝算比偏好項；一趟就從基礎模型訓練起來 |
| BPO | 「保住選中回應的 DPO」 | DPO 再加上一項懲罰，防止選中回應的絕對對數機率下降 |
| 選中回應退化 | 「選中的掉下去了」 | 只要被拒的掉得更快，DPO 就會壓低選中回應的對數機率 |
| DAA | 「直接對齊演算法」 | 任何跳過顯式 RM 的偏好損失方法 |

## 延伸閱讀

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) —— IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
