# 注意力的變體 —— 滑動視窗、稀疏、差分

> 完整注意力是一個圓。每個詞元都看見每個詞元，代價由記憶體來付。有四種變體把這個圓的形狀折彎，省回一半的成本。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 7 · 02（自注意力）、階段 7 · 03（多頭注意力）、階段 7 · 12（KV 快取／Flash Attention）
**時間：** 約 60 分鐘

## 問題所在

完整注意力在序列長度上要付 `O(N²)` 記憶體與 `O(N²)` 運算。對一個 128K 脈絡的 Llama 3 70B 來說，那是每層 160 億個注意力項目，再乘上 80 層。Flash Attention（單元 12）藏起了 `O(N²)` 的激活記憶體，但沒有改變算術成本 —— 每個詞元還是要注意其他每一個詞元。

有三類變體，改動的是注意力矩陣本身的拓撲：

1. **滑動視窗注意力（SWA）。** 每個詞元只注意固定大小的鄰居視窗，而不是整段前綴。記憶體與運算降到 `O(N · W)`，其中 `W` 是視窗大小。Gemma 2/3、Mistral 7B 的前幾層、Phi-3-Long 都是這一路。
2. **稀疏／分塊注意力。** 只有被挑中的配對 `(i, j)` 會被計分，其餘一律強制為零權重。Longformer、BigBird、OpenAI 的 sparse transformer。
3. **差分注意力。** 用兩組獨立的 Q/K 投影算出兩張注意力圖，再相減。這會消滅那個把權重洩到最前面幾個詞元上的「注意力匯聚點」（attention sink）。出自微軟的 DIFF Transformer（2024）。

它們可以並存。2026 年的前沿模型常常混著用：大多數層是 SWA-1024，每第五層是全域的完整注意力，另外還有少數幾個差分頭負責把檢索理乾淨。Gemma 3 的 5:1 SWA 對全域比例，是目前的教科書預設值。

## 核心概念

### 滑動視窗注意力（SWA）

位置 `i` 的每個 query 只注意 `[i - W, i]` 範圍內的位置（因果式 SWA），或 `[i - W/2, i + W/2]`（雙向式）。視窗之外的詞元在分數矩陣裡拿到 `-inf`。

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

在 `N = 8192`、`W = 1024` 時，分數矩陣的非零列期望值是 1024 × 8192 —— 縮減了 8 倍。

**SWA 會讓 KV 快取縮小。** 每層只需要保留 K 與 V 最後 `W` 個詞元。以 Gemma 3 那類的設定（1024 視窗、128K 脈絡）為例，KV 快取降到 1/128。

**品質上的代價。** 純 SWA 的 transformer 在長距離檢索上很吃力。解法是：把 SWA 層與完整注意力層交錯。Gemma 3 用 5:1 的 SWA 對全域比例。Mistral 7B 用的是因果式 SWA 堆疊，讓資訊透過重疊的視窗「往前流」 —— 每一層把有效感受野再延伸 `W`，經過 `L` 層之後，模型能回頭注意 `L × W` 個詞元。

### 稀疏／分塊注意力

事先挑好一個 `N × N` 的稀疏模式。有三種標準形狀：

- **局部 + 跨步（OpenAI sparse transformer）。** 注意最後 `W` 個詞元，加上在那之前每隔 `stride` 個取一個。以 `O(N · sqrt(N))` 的運算量同時抓到局部與長距離。
- **Longformer／BigBird。** 局部視窗 + 少數幾個全域詞元（例如 `[CLS]`），這些詞元注意所有人、也被所有人注意，再加上隨機稀疏連結。實測在同等品質下脈絡長度加倍。
- **原生稀疏注意力（DeepSeek，2025）。** 學出哪些 `(Q, K)` 區塊重要，在核心層級直接跳過零區塊。與 FlashAttention 相容。

稀疏注意力本質上是一個核心工程的故事。數學很簡單（把分數矩陣遮掉）；真正的收益來自從頭到尾都不把零項載進 SRAM。FlashAttention-3 與 2026 年的 FlexAttention API，讓自訂稀疏模式在 PyTorch 裡成為一等公民。

### 差分注意力（DIFF Transformer，2024）

一般的注意力有個「注意力匯聚點」的問題：softmax 強迫每一列加總為 1，所以那些其實沒有特別想注意任何東西的詞元，就把權重倒到第一個詞元（或最前面幾個）上。這偷走了本該分給真正內容的容量。

差分注意力的修法是算**兩張**注意力圖再相減：

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

其中 `λ` 是一個學習出來的純量（通常在 0.5 到 0.8 之間）。A1 抓的是真正內容的權重，A2 抓的是匯聚點。相減就把匯聚點消掉，把權重重新分配給相關的詞元。

論文報告的結果（微軟，2024）：困惑度低 5% 到 10%，在同樣的訓練長度下有效脈絡長 1.5 到 2 倍，大海撈針式的檢索也更銳利。

### 各變體比較

| 變體 | 運算量 | KV 快取 | 相對完整注意力的品質 | 生產環境用途 |
|---------|---------|----------|-----------------|----------------|
| 完整注意力 | O(N²) | 每層 O(N) | 基準線 | 每個模型的預設層 |
| SWA（視窗 1024） | O(N·W) | 每層 O(W) | -0.1 ppl，搭配全域層時表現好 | Gemma 2/3、Phi-3-Long |
| 局部 + 跨步稀疏 | O(N·√N) | 混合 | 與 SWA 相近 | OpenAI sparse transformer、Longformer |
| BigBird（局部 + 全域 + 隨機） | 約 O(N) | 混合 | 在 2 倍脈絡下追平完整注意力 | 早期的長脈絡 BERT |
| 原生稀疏（DeepSeek-V3.2） | O(N · 活躍比例) | O(N) | 差距在 0.05 ppl 之內 | DeepSeek-V3.2，2025 |
| 差分 | O(2·N²) | O(2N) | ppl 低 5% 到 10% | DIFF Transformer、2026 年初的模型 |

```figure
gqa-kv-sharing
```

## 動手實作

請看 `code/main.py`。我們會實作一個因果遮罩比較器，在一段玩具序列上把完整注意力、SWA、局部+跨步與差分注意力並排展示。

### 步驟 1：完整因果遮罩（基準線）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

來自單元 07 的基準線。下三角矩陣；對角線以上權重為零。

### 步驟 2：滑動視窗因果遮罩

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

只有一個參數 —— `window`。當 `window >= n`，你就退回完整的因果注意力。當 `window = 1`，每個詞元只注意自己。

### 步驟 3：局部 + 跨步稀疏遮罩

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

密集的局部視窗，加上一路回到序列開頭、每隔 `stride` 個取一個的詞元。感受野會隨著層數以對數步幅成長。

### 步驟 4：差分注意力

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

兩趟注意力，用一個學習出來的混合係數相減。程式裡我們會比較單一注意力與差分注意力的匯聚點熱圖，看著匯聚點塌下去。

### 步驟 5：KV 快取大小

印出在 `N = 131072` 時，各變體每層的快取大小。SWA 與稀疏變體降到 1/10 到 1/100，差分則加倍。記憶體帳單，要付得清楚明白。

## 框架應用

2026 年的生產環境做法：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ 的 FlexAttention 接受一個遮罩函式：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

這會編譯成一個自訂的 Triton 核心。對常見模式，速度落在 FlashAttention-3 的 10% 之內，而遮罩函式就是一個 Python callable。

**什麼時候選哪一種：**

- **純完整注意力** —— 脈絡約 16K 以內的每一層，或檢索品質至上的時候。
- **SWA + 全域混搭** —— 長脈絡（>32K）、訓練與推論都卡在記憶體上。這是 2026 年超過 32K 的預設做法。
- **稀疏分塊注意力** —— 自訂核心、自訂模式。留給特殊工作負載（檢索、音訊）。
- **差分注意力** —— 任何會被注意力匯聚點污染所拖累的工作負載（長脈絡 RAG、大海撈針）。

## 產出交付

請看 `outputs/skill-attention-variant-picker.md`。這項技能會依目標脈絡長度、檢索需求，以及訓練／推論的運算輪廓，為一個新模型挑選注意力拓撲。

## 練習

1. **簡單。** 執行 `code/main.py`。確認 `window=4` 的 SWA 會把每列最後 4 個詞元以外的位置全部歸零。確認 `window=n` 能逐位元重現完整的因果注意力。
2. **中等。** 在單元 07 的總結專案之上，實作 `window=1024` 的因果式 SWA。在 tinyshakespeare 上訓練 1,000 步。相較於完整注意力，驗證損失退步多少？峰值記憶體降了多少？
3. **困難。** 在總結專案的模型裡實作 Gemma 3 風格的 5:1 層混搭（5 層 SWA、1 層全域）。在參數量相同的條件下，把損失、記憶體與生成品質拿去跟純 SWA、純全域的基準線比較。
4. **困難。** 實作每個頭各有一個學習式 `λ` 的差分注意力。在一個合成檢索任務上訓練（一根針、2,000 個干擾項）。在參數量相同的條件下，量測檢索準確率與單一注意力基準線的差距。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 滑動視窗注意力（SWA） | 「局部注意力」 | 每個 query 只注意它前面 `W` 個詞元；KV 快取縮到 `O(W)`。 |
| 有效感受野 | 「模型能往回看多遠」 | 在視窗為 `W` 的 `L` 層 SWA 堆疊裡，最多 `L × W` 個詞元。 |
| Longformer／BigBird | 「局部 + 全域 + 隨機」 | 帶有少數永遠參與注意的全域詞元的稀疏模式；早期的長脈絡做法。 |
| 原生稀疏注意力 | 「DeepSeek 的核心把戲」 | 學出區塊層級的稀疏性，在核心層級跳過零區塊又不掉品質。 |
| 差分注意力 | 「兩張圖，一張拿來減」 | DIFF Transformer：從第一張注意力圖減去學習出的 `λ` 倍的第二張，消掉注意力匯聚點。 |
| 注意力匯聚點 | 「權重洩到詞元 0」 | softmax 正規化強迫每列加總為 1；沒有資訊需求的 query 就把權重倒在位置 0。 |
| FlexAttention | 「遮罩即 Python」 | PyTorch 2.5+ 的 API，把任意遮罩函式編譯成 FlashAttention 形狀的核心。 |
| 層型混搭 | 「5:1 的 SWA 對全域」 | 在堆疊中交錯稀疏層與完整注意力層，用更低的記憶體維持品質。 |

## 延伸閱讀

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) —— 滑動視窗 + 全域詞元的標準論文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) —— 局部 + 全域 + 隨機。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) —— OpenAI 的局部+跨步模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) —— 1:1 的 SWA 對全域混搭。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) —— 視窗 1024、5:1 混搭，現在的教科書預設值。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) —— DIFF Transformer 論文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) —— DeepSeek-V3.2 的學習式稀疏注意力。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) —— 框架應用一節裡「遮罩即 callable」模式的 API 參考。
