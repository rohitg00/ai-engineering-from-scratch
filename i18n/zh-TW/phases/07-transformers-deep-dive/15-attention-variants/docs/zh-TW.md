# 注意力變體——滑動視窗（sliding window）、稀疏（sparse）、差分（differential）

> 完整注意力的矩陣形狀是正方形。每個 token 都看得到每個 token，記憶體（memory）需求也隨之增加。四種變體把圓的形狀折彎，把一半的成本拿回來。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## The Problem｜問題

序列長度為 N 時，完整注意力要 `O(N²)` 的記憶體和 `O(N²)` 的運算。12.8 萬脈絡的 Llama 3 70B，每一層是 160 億筆注意力項目，再乘 80 層。Flash Attention（第 12 課）把 `O(N²)` 的活化（activation）記憶體藏起來，但沒有改算術成本——每個 token 仍然注意所有其他 token。

三類變體改的是注意力矩陣本身的拓樸（topology）：

1. **滑動視窗注意力（SWA）。** 每個 token 注意的是鄰居的固定視窗（window），不是整個前綴。記憶體和運算降到 `O(N · W)`，`W` 是視窗。Gemma 2／3、Mistral 7B 的前幾層、Phi-3-Long。
2. **稀疏／區塊注意力（block attention）。** 只有挑中的配對 `(i, j)` 會被打分；其餘被強制成零權重。Longformer、BigBird、OpenAI 的稀疏 transformer。
3. **差分注意力（differential attention）。** 用分開的 Q／K 投影算兩張注意力圖，一張減另一張。殺掉「注意力匯（attention sink）」，也就是權重滲進前幾個 token 的那個現象。Microsoft 2024 年的 DIFF Transformer。

這些可以並存。2026 年的前沿模型常常混著用：大多層是 SWA-1024，每第五層是全域的完整注意力，再有少數差分頭把檢索清乾淨。Gemma 3 的 5:1、SWA 對全域，是目前的教科書預設。

## The Concept｜核心概念

### 滑動視窗注意力（SWA）

位置 `i` 的每個查詢，只注意 `[i - W, i]` 裡的位置（因果 SWA），或 `[i - W/2, i + W/2]`（雙向）。視窗外的位置在分數矩陣中設為 `-inf`。

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

`N = 8192`、`W = 1024` 時，分數矩陣預期只有 1024 × 8192 個非零項目，約為完整矩陣的八分之一。

**KV cache 隨 SWA 縮小。** 每一層只需要留 K 和 V 的最後 `W` 個 token。像 Gemma 3 的設定，視窗 1024、脈絡 12.8 萬，KV cache 降到 128 分之一。

**品質成本。** 只有 SWA 的 transformer 做不好長程檢索。修法：把 SWA 層和完整注意力層交錯。Gemma 3 用 5:1 的 SWA 對全域。Mistral 7B 用因果 SWA 堆疊，資訊經由重疊視窗「往前流」——每一層把有效感受野（receptive field）延伸 `W`，`L` 層之後模型可以往回注意 `L × W` 個 token。

### 稀疏／區塊注意力

事先挑一個 `N × N` 的稀疏模式（sparse pattern）。三種經典形狀：

- **局部加步幅（OpenAI 稀疏 transformer）。** 注意最後 `W` 個 token，再加上更前面每隔 `stride` 的 token。局部和長程都抓得到，運算是 `O(N · sqrt(N))`。
- **Longformer／BigBird。** 局部視窗，加上一小群全域 token（例如 `[CLS]`），它們注意所有人、也被所有人注意，再加隨機稀疏連結。品質相當時，經驗上可支援約兩倍長的脈絡。
- **原生稀疏注意力（DeepSeek，2025）。** 學哪些 `(Q, K)` 區塊要緊；在核（kernel）的層級跳過零區塊。和 FlashAttention 相容。

稀疏注意力是核的工程故事。數學很單純（把分數矩陣遮掉）；勝利來自零的項目根本不載進 SRAM。FlashAttention-3 和 2026 年的 FlexAttention API，讓自訂稀疏模式在 PyTorch 中成為一級功能。

### 差分注意力（DIFF Transformer，2024）

一般注意力有「注意力匯」問題：softmax 強迫每一列加總為 1，所以不想特別注意任何東西的 token，就把權重集中到第一個 token（或前幾個）上。這偷走了本該給真正內容的容量（capacity）。

差分注意力的修法是算**兩張**注意力圖再相減：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是學來的純量（通常 0.5 到 0.8）。A1 抓住真正的內容權重；A2 抓住那個匯。相減把匯消掉，把權重重新分給相關的 token。

報告的結果（Microsoft，2024）：困惑度（perplexity）低 5% 到 10%，同樣訓練長度下有效脈絡長 1.5 到 2 倍，大海撈針的檢索更精準。

### 變體比較

| 變體 | 運算 | KV cache | 相對完整注意力的品質 | 正式環境（production）用法 |
|---------|---------|----------|-----------------|----------------|
| 完整注意力 | O(N²) | 每層 O(N) | 基準 | 每個模型的預設層 |
| SWA（視窗 1024） | O(N·W) | 每層 O(W) | 困惑度差大約 0.1，搭配全域層就好 | Gemma 2／3、Phi-3-Long |
| 局部加步幅的稀疏 | O(N·√N) | 混合 | 和 SWA 差不多 | OpenAI 稀疏 transformer、Longformer |
| BigBird（局部加全域加隨機） | 大約 O(N) | 混合 | 2 倍脈絡時對得上完整注意力 | 早期的長脈絡 BERT |
| 原生稀疏（DeepSeek-V3.2） | O(N · 活躍比例) | O(N) | 困惑度差在 0.05 以內 | DeepSeek-V3.2，2025 |
| 差分 | O(2·N²) | O(2N) | 困惑度低 5% 到 10% | DIFF Transformer，2026 年初的模型 |

```figure
gqa-kv-sharing
```

## Build It｜動手實作

見 `code/main.py`。我們實作一個因果遮罩比較器，在玩具序列上並排顯示完整、SWA、局部加步幅、和差分注意力。

### 步驟 1：完整因果遮罩，當作基準（baseline）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

來自第 07 課的基準。下三角矩陣；對角線上方的權重為零。

### 步驟 2：滑動視窗的因果遮罩

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

只有一個參數（parameter）——`window`。`window >= n` 時你回到完整因果注意力。`window = 1` 時每個 token 只注意自己。

### 步驟 3：局部加步幅的稀疏遮罩

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

稠密的局部視窗，加上往序列起點每隔 `stride` 個 token 取一個。感受野隨額外的層，以對數步數擴大。

### 步驟 4：差分注意力

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

兩次注意力，用一個學來的混合係數相減。程式裡我們比單一注意力和差分注意力的注意力匯熱圖，看匯怎麼塌掉。

### 步驟 5：KV cache 的大小

在 `N = 131072` 印每種變體每一層的快取大小。SWA 和稀疏變體降 10 到 100 倍。差分變兩倍。明確衡量記憶體成本。

## Use It｜實際應用

2026 年的正式環境模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5 以上的 FlexAttention 接受一個遮罩函數：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

這會編譯成自訂的 Triton 核。常見模式的速度和 FlashAttention-3 差在 10% 以內，遮罩函數是一個 Python 可呼叫物件。

**何時選哪一種：**

- **純完整注意力**——脈絡大約到 1.6 萬以前每一層都用，或檢索品質最要緊的時候。
- **SWA 加全域的混合**——長脈絡（大於 3.2 萬），訓練和推論（inference）被記憶體卡住。3.2 萬以上的 2026 預設。
- **稀疏區塊注意力**——自訂核、自訂模式。留給專門工作負載（檢索、音訊）。
- **差分注意力**——容易受注意力匯污染影響的工作負載（長脈絡 RAG、大海撈針）。

## Ship It｜交付成果

見 `outputs/skill-attention-variant-picker.md`。這個 skill 依目標脈絡長度、檢索需求、訓練和推論的運算輪廓，為新模型挑注意力拓樸。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認 `window=4` 的 SWA 把每一列最後 4 個 token 以外清成零。確認 `window=n` 和完整因果注意力位元完全相同。
2. **中等。** 在第 07 課的成品模型上，實作 `window=1024` 的因果 SWA。在 tinyshakespeare 上訓練 1,000 步。相對完整注意力，驗證損失（loss）退步多少？峰值記憶體降多少？
3. **困難。** 在總驗收模型裡實作 Gemma 3 風格的 5:1 層混合，5 層 SWA、1 層全域。在參數對上的情況下，和純 SWA、純全域的基準比損失、記憶體、生成品質。
4. **困難。** 實作差分注意力，每個頭一個學來的 `λ`。在合成檢索任務上訓練（一根針、2,000 個干擾項）。在參數對上的情況下，量檢索準確率（accuracy）相對單一注意力基準差多少。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 滑動視窗注意力（SWA） | 「局部注意力」 | 每個查詢注意自己最後 `W` 個 token；KV cache 縮到 `O(W)`。 |
| 有效感受野 | 「模型往回看得多遠」 | `L` 層、視窗 `W` 的 SWA 堆疊裡，最多 `L × W` 個 token。 |
| Longformer／BigBird | 「局部加全域加隨機」 | 稀疏模式，有幾個永遠在注意的全域 token；早期的長脈絡做法。 |
| 原生稀疏注意力 | 「DeepSeek 的核手法」 | 學區塊級的稀疏；在核的層級跳過零區塊，品質還在。 |
| 差分注意力 | 「兩張圖，一張拿來減」 | DIFF Transformer：從第一張注意力圖減掉學來的 `λ` 乘上第二張，把注意力匯消掉。 |
| 注意力匯 | 「權重滲到 token 0」 | Softmax 正規化（normalization）強迫每一列加總為 1；沒有資訊的查詢把權重倒在位置 0。 |
| FlexAttention | 「遮罩就是 Python」 | PyTorch 2.5 以上的 API，把任意遮罩函數編譯成 FlashAttention 形狀的核。 |
| 層類型混合 | 「5:1 的 SWA 對全域」 | 在堆疊裡交錯稀疏層和完整注意力層，用更少記憶體保住品質。 |

## Further Reading｜延伸閱讀

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) ——滑動視窗加全域 token 的經典論文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) ——局部加全域加隨機。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) ——OpenAI 的局部加步幅模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) ——1:1 的 SWA 對全域混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) ——視窗 1024 的 5:1 混合，現在的教科書預設。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) ——DIFF Transformer 論文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) ——DeepSeek-V3.2 學來的稀疏注意力。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) ——實際應用那節「遮罩是可呼叫物件」模式的 API 參考。
