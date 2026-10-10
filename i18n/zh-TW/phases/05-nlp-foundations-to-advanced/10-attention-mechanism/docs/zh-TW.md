# 注意力機制（attention mechanism）：那個突破

> 解碼器不再瞇著眼看一份壓縮過的摘要，改成看整段來源。這之後的一切，都是注意力加上工程。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## The Problem｜問題

第 09 課停在一個量過的失敗。在玩具複製任務上訓練的 GRU 編碼器－解碼器（encoder-decoder），長度 5 時準確率（accuracy）89%，長度 80 時接近隨機。原因是結構，不是訓練 bug：編碼器撈到的每一點資訊都得塞進一個固定大小的隱藏狀態（hidden state），解碼器別的什麼都看不到。

Bahdanau、Cho 和 Bengio 在 2014 年發表了一個三行的修法。不要只給解碼器最後的編碼器狀態，把每一個編碼器狀態都留著。解碼器每一步算編碼器狀態的加權平均（weighted average），權重說的是「解碼器現在有多需要看編碼器位置 `i`？」那個加權平均就是脈絡，而且每個解碼步驟都會變。

整個想法就是這個。transformer 把它延伸出去。自注意力（self-attention）把它用到單一序列上。多頭注意力（multi-head attention）把它平行跑。但 2014 年的版本已經打破瓶頸；一旦你有了它，轉到 transformer 是工程，不是觀念。

## The Concept｜核心概念

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

在每個解碼步驟 `t`：

1. 把前一個解碼器隱藏狀態 `s_{t-1}` 當成**查詢（query）**。
2. 拿它和每個編碼器隱藏狀態 `h_1, ..., h_T` 比分數。每個編碼器位置一個純量。
3. 對分數做 softmax，得到注意力權重 `α_{t,1}, ..., α_{t,T}`，加總為 1。
4. 脈絡向量（context vector）`c_t = Σ α_{t,i} * h_i`。編碼器狀態的加權平均。
5. 解碼器拿 `c_t` 加上前一個輸出 token，產出下一個 token。

重點是加權平均。解碼器要把「Je」翻成「I」時，它把「Je」上的編碼器狀態權重拉高，其他拉低。需要「not」時，把「pas」的權重拉高。脈絡向量每一步都重新成形。

## 形狀（人人都會被咬到的地方）

注意力的實作第一次幾乎都死在這裡。慢慢讀。

| 東西 | 形狀 | 說明 |
|-------|-------|-------|
| 編碼器隱藏狀態 `H` | `(T_enc, d_h)` | 如果是 BiLSTM，`d_h = 2 * d_hidden` |
| 解碼器隱藏狀態 `s_{t-1}` | `(d_s,)` | 一個向量 |
| 注意力分數 `e_{t,i}` | 純量 | 每個編碼器位置一個 |
| 注意力權重 `α_{t,i}` | 純量 | 對所有 `i` 做完 softmax 之後 |
| 脈絡向量 `c_t` | `(d_h,)` | 和一個編碼器狀態同形 |

**Bahdanau（加法注意力，additive attention）分數。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` 的形狀是 `(d_s,)`，`h_i` 的形狀是 `(d_h,)`。
- `W_a` 的形狀是 `(d_attn, d_s)`。`U_a` 的形狀是 `(d_attn, d_h)`。
- tanh 裡面的和，形狀是 `(d_attn,)`。
- `v_α` 的形狀是 `(d_attn,)`。和 `v_α` 的內積縮成一個純量。**`v_α` 做的就是這件事。** 不是魔法。它是把注意力維度（dimension）的向量投影成純量分數的那個投影。

**Luong（乘法注意力，multiplicative attention）分數。** 三種：

- `dot`：`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`。硬約束。編碼器若是雙向就跳過。
- `general`：`e_{t,i} = s_t^T * W * h_i`，`W` 的形狀是 `(d_s, d_h)`。拿掉維度必須相等的約束。
- `concat`：基本上就是 Bahdanau 的形式。前兩種較便宜，所以很少用。

**一個值得點名的 Bahdanau／Luong 陷阱。** Bahdanau 用 `s_{t-1}`（生成當前詞*之前*的解碼器狀態）。Luong 用 `s_t`（*之後*的狀態）。把兩者混了，梯度會微妙地錯，而且極難除錯。挑一篇論文，守住它的慣例。

```figure
attention-heatmap
```

## Build It｜動手實作

### 步驟 1：加法（Bahdanau）注意力

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

拿上面的表核對形狀。`encoder_states` 的形狀是 `(T_enc, d_h)`。`projected_enc` 的形狀是 `(T_enc, d_attn)`。`projected_dec` 的形狀是 `(d_attn,)`，會廣播。`combined` 的形狀是 `(T_enc, d_attn)`。`scores` 的形狀是 `(T_enc,)`。`weights` 的形狀是 `(T_enc,)`。`context` 的形狀是 `(d_h,)`。形狀對了就交出去。

### 步驟 2：Luong 的 dot 和 general

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

各三行。這正是 Luong 方法受到採用的原因。多數任務準確率一樣，程式少非常多。

### 步驟 3：完整數值範例

給三個編碼器狀態（大致是「cat」、「sat」、「mat」）和一個最對齊第一個的解碼器狀態，注意力分布會集中在位置 0。如果解碼器狀態改成對齊最後一個，注意力就移到位置 2。脈絡向量跟著走。

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

第一列贏。然後把解碼器狀態移近第三個編碼器狀態，看權重怎麼移。就是這樣。注意力是明示的對齊。

### 步驟 4：為什麼這是通往 transformer 的橋

把上面的語言翻成 Q／K／V：

- **查詢** = 解碼器狀態 `s_{t-1}`
- **鍵（Key）** = 編碼器狀態（我們拿來比分數的）
- **值（Value）** = 編碼器狀態（我們加權再加總的）

古典注意力裡，鍵和值是同一個東西。自注意力把它們分開：你可以拿一個序列查詢它自己，K 和 V 用不同的學來投影。多頭注意力用不同的學來投影平行跑。transformer 把整段堆很多次，並丟掉 RNN。

數學一樣。形狀一樣。從 Bahdanau 注意力跳到縮放點積注意力（scaled dot-product attention），主要是記法。

## Use It｜實際應用

PyTorch 和 TensorFlow 直接交付注意力。

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

這就是一層 transformer 注意力。查詢是 5 個位置的批次（batch），鍵／值是 10 個位置的批次，各 128 維，8 個頭。`output` 是加上脈絡之後的新查詢。`weights` 是 5 乘 10 的對齊矩陣，可以畫出來。

### 古典注意力什麼時候仍然要緊

- 教學。單頭、單層、以 RNN 為基礎的版本，讓每個觀念都看得見。
- 在裝置（device）上的序列任務，transformer 放不進去。
- 2014 到 2017 的任何論文。不懂 Bahdanau 的慣例，你會讀錯。
- 機器翻譯裡細粒度的對齊分析。原始注意力權重即使在 transformer 模型上也是可解釋性工具，而要讀它們，得先知道它們是什麼。

### 把注意力權重當成解釋的陷阱

注意力權重看起來可以解釋。它們是跨位置加總為一的權重；你可以畫；高表示「看了這裡」。審查者愛它們。

它們沒有看起來那麼能解釋。Jain 和 Wallace（2019）指出，對某些任務，可以把注意力分布置換、或換成任意替代，模型預測卻不變。沒有消融或反事實檢查，不要把注意力權重報成推理的證據。

## Ship It｜交付成果

存成 `outputs/prompt-attention-shapes.md`：

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Exercises｜練習

1. **簡單。** 實作 `softmax` 遮罩，讓編碼器裡的填充 token 注意力權重為零。在長度不一的批次上測試。
2. **中等。** 把多頭注意力加到 Luong 的 `general` 形式。把 `d_h` 拆成 `n_heads` 組，每一頭跑注意力，再接起來。驗證單頭的情況和你先前的實作一致。
3. **困難。** 在第 09 課的玩具複製任務上，訓練帶 Bahdanau 注意力的 GRU 編碼器－解碼器。畫準確率對序列長度。和沒有注意力的基準模型（baseline）比。長度一增加，差距應該變大，確認注意力抬起了瓶頸。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 注意力 | 在看東西 | 值序列的加權平均，權重由查詢和鍵的相似度算出。 |
| 查詢、鍵、值 | QKV | 三個投影：Q 發問，K 是拿來對的，V 是要回傳的。 |
| 加法注意力 | Bahdanau | 前饋分數：`v^T tanh(W q + U k)`。 |
| 乘法注意力 | Luong 的 dot／general | 分數是 `q^T k` 或 `q^T W k`。較便宜，多數任務準確率一樣。 |
| 對齊矩陣 | 那張好看的圖 | 注意力權重排成 `(T_dec, T_enc)` 格子。讀它，就知道模型注意了什麼。 |

## Further Reading｜延伸閱讀

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) ——那篇論文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) ——三種分數，以及它們的比較。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) ——可解釋性的警告。
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) ——可以用 PyTorch 跑的逐步說明。
