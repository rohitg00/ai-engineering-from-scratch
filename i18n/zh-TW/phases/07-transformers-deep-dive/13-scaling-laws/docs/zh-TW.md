# 縮放定律（Scaling Laws）

> 2020 年的 Kaplan 論文說：模型更大，損失（loss）更低。2022 年的 Hoffmann 論文說：你訓練得不夠。運算分成兩部分——參數（parameter）和 token——怎麼分並不明顯。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## The Problem｜問題

你有 C FLOPs 的訓練運算（training compute），想要最好的模型，面前兩個旋鈕：

1. **多少參數（N）？** 模型更大，容量（capacity）更高。
2. **多少訓練 token（D）？** 資料更多，容量用得更好。

FLOPs 大約依 `6 × N × D` 縮放。你可以把 N 往上推、D 往下，或 D 往上、N 往下。哪個更好？

2022 年以前的答案是「把 N 用力推」。GPT-3（2020）是 1750 億參數，訓練在大約 3000 億 token 上。大約每個參數 1.7 個 token。Kaplan 縮放定律支持這個。

Hoffmann 等人（2022）訓練了一系列 Chinchilla 模型，發現不一樣的事：最佳比例更接近**每個參數 20 個 token**。GPT-3 少訓練了 10 倍。Chinchilla（700 億參數、1.4 兆 token）在每項效能基準測試上打贏 GPT-3（1750 億、3000 億 token），推論（inference）成本是它的 2.5 分之一。

2026 年是 Chinchilla 的世界——有一個重要轉折。Llama 3 8B 訓練在 15 兆 token 上，比例是每個參數 1,875 個 token。超過 Chinchilla 最佳 94 倍。對會被大規模使用的模型，推論成本比訓練成本更要緊，所以過度訓練（超過 Chinchilla）、換成較小且可部署（deployment）的模型，是 2026 年的預設。

## The Concept｜核心概念

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Hoffmann 定律

依 Chinchilla 論文，損失長這樣：

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = 參數（不含 embedding）。
- `D` = 訓練 token。
- `α ≈ 0.34`、`β ≈ 0.28`（大致對稱）。
- `E ≈ 1.69`，不可約損失天花板（loss floor）。
- `A ≈ 406`、`B ≈ 411`。

你放大時，兩項互相交換。在固定運算（C = 6ND）下對 `N` 取導數再解：

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

運算最佳（compute-optimal）：每個參數 20 個 token。

### 為什麼還是要過度訓練

Chinchilla 最佳是把每個訓練 FLOP 的訓練損失壓到最低。但訓練成本只支付一次，推論成本則會持續累積。

對一個每個月服務 1 兆 token 的聊天機器人，總成本由推論主導。Llama 的做法：訓練更小的、訓練更久。80 億配 15 兆 token，是為推論深度調過的：

- 消費級 GPU 放得下。
- 延遲（latency）僅為 Chinchilla 最佳的 700 億模型的一小部分。
- 品質對大多數任務夠接近。

DeepMind 2024 年的論文《過度訓練是新的最佳》把這件事形式化。對推論主導的工作負載，正確比例更接近每個參數 100 到 500 個 token，依服務量而定。

### 突現對上平滑

說法：某些能力（算術、多步推理、跟著思維鏈（chain-of-thought））在某個規模「突然出現」。

Schaeffer 等人（2023）主張這是測量假象：突現指標用不連續的計分，像完全相符、或過閾值的準確率（accuracy），把底層 logits 裡平滑的進步藏起來。連續指標（交叉熵（cross-entropy））呈現平滑曲線。

2026 年的共識是：用連續損失做的預測可靠。每項效能基準測試上的跳躍，常常是評分方式造成的假象。預算要對著連續指標來規劃。

### 2026 年的圖像

縮放定律仍然成立，但是：

| 因素 | 怎麼變了 |
|--------|-------------|
| 資料品質 | 策展「好」token（Phi 風格）把曲線挪超過 2 倍的有效運算（effective compute） |
| MoE | 參數總數和活躍 FLOPs 拆開；縮放定律按每個活躍 FLOP |
| 後訓練 | 有些能力（指令跟隨、程式碼）隨 SFT+RLHF 移動，比預訓練（pretraining）多 |
| 多模態 | 圖像和文字 token 一起縮放；每種模態各自一條曲線 |
| 合成資料 | 模型產生訓練資料；有效運算量能複利成長 |

Muon 調校器（optimizer，Kimi Moonlight，2024）在資料條件相同時，相對 AdamW 可使有效運算量提升約 2 倍。有些 2026 年的訓練預設用 Muon。改的是縮放定律裡的乘數常數，不是形狀。

```figure
scaling-laws
```

## Build It｜動手實作

見 `code/main.py`。我們實作 Chinchilla 損失方程式，並在好幾個運算預算上解出運算最佳的 `(N, D)`。

### 步驟 1：Chinchilla 損失

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

在固定 `C = 6ND` 下，繪製 `L` 在 `(N, D)` 上的等高線。找最小值。

### 步驟 2：運算最佳的前緣（compute-optimal frontier）

運算預算從 `1e17` 到 `1e25` FLOPs，在 `6ND = C` 的限制下找讓損失最小的 `(N, D)`。驗證比例 `D/N ≈ 20`。

### 步驟 3：過度訓練的成本

算你為了訓練一個小 10 倍的模型（最佳 N 的 1/10、最佳 D 的 10 倍）多付的損失。回報換來的推論 FLOP 節省（和 N 成正比）。

### 步驟 4：和真實模型比

丟進 GPT-3、Chinchilla、Llama 3 8B、DeepSeek-V3（活躍參數）已知的 `(N, D)` 配對，比預測損失和報告的損失。

## Use It｜實際應用

你自己不太會去訓練前沿模型。但縮放定律告訴你：

1. **你的 fine-tune 資料夠不夠。** 如果任務專用資料低於基模型每個參數 20 個 token，預期會在某個損失下限處飽和。
2. **要不要挑更大的基模型。** 如果你的預算全花在推論，偏好更小、訓練更久的模型。
3. **報酬在哪裡遞減。** 超過 Chinchilla 最佳 1000 倍之後，對數損失的變化變成雜訊。

**2026 年的研究軌跡：**

- **資料受限的區間。** 網頁上高品質 token 的數量有限（過濾後英文大約 5 到 10 兆）。前沿預訓練正在靠近這個天花板。合成資料、多語、多模態、以及用 RLHF 放大的 fine-tuning，是下一組槓桿。
- **運算乘數手法。** Muon 調校器、MoE、更好的資料策展（data curation）——每一個挪的是乘數常數，不是漸近線（asymptote）。
- **強化學習的縮放定律。** 開放問題。早期證據暗示強化學習樣本上是冪律，但指數（exponent）和預訓練差很多。

## Ship It｜交付成果

見 `outputs/skill-training-budget-estimator.md`。這個 skill 依運算預算、部署限制、目標損失，為新的訓練挑 `(N, D, hours, GPU)`。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。印出運算預算 `1e20`、`1e22`、`1e24` 的 Chinchilla 最佳 `(N, D)`。和真實模型表比。
2. **中等。** 實作 Hoffmann 那個「損失是運算的函數」曲線。對運算最佳前緣，畫損失對 `log10(C)`。找出定律預測下一次交叉熵再降 0.1，需要 `>10^28` FLOPs 的地方。
3. **困難。** 在同一個資料集上訓練 5 個極小模型（10 萬到 1000 萬參數），擬合你自己的縮放定律。估計 `α` 和 `E`。你的指數和發表的差多少？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 參數（N） | 「模型大小」 | 不含 embedding 的權重數量；決定容量。 |
| Token（D） | 「訓練資料」 | 看過的訓練 token 數；決定參數被用得多好。 |
| 運算（C） | 「花掉的 FLOPs」 | 標準 transformer 大約是 `6 × N × D`。 |
| Chinchilla 最佳 | 「D/N ≈ 20」 | 把預訓練每個 FLOP 的損失壓到最低的比例。 |
| 過度訓練 | 「超過 Chinchilla」 | 多花訓練 FLOPs 來省推論 FLOPs；D/N 遠大於 20。 |
| 不可約損失 | 「那個地板」 | 縮放定律裡的 `E` 項；資料本身的熵（entropy）。 |
| 突現能力（emergent abilities） | 「規模上的突然跳躍」 | 常常是評分器的假象；連續損失是平滑的。 |
| 有效運算 | 「訓練效率的乘數」 | 更好的資料、調校器、或架構，把一個 FLOP 能走多遠乘上去。 |

## Further Reading｜延伸閱讀

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) ——第一篇縮放定律論文；訓練不足。
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) ——Chinchilla。
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) ——突現是測量假象。
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) ——為什麼 Llama 的過度訓練對它的工作負載是對的。
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) ——2 倍的運算乘數。
