# 梯度檢查點與啟動值重算

> 反向傳播會把每一個中間啟動值都留著。700 億參數配上 128K 上下文，每個 rank 就是 3 TB 的啟動值。檢查點拿 FLOPs 換記憶體：不存，改成重算。問題在於要丟掉哪些分段，而答案不是「全部」。

**類型：** 實作
**程式語言：** Python (with numpy, optional torch)
**先修單元：** 階段 10 · 04（預訓練一個迷你 GPT）、階段 10 · 05（規模化：分散式訓練）
**時間：** 約 70 分鐘

## 問題所在

訓練 transformer 時，每一層都要存下反向階段會被微分的每個運算的輸入：注意力輸入、Q/K/V 投影、softmax 輸出、FFN 輸入、正規化輸出，以及殘差流。對一個隱藏維度 `d`、序列長度 `L`、批次 `B` 的層來說，這大約是每層 `12 * B * L * d` 個浮點數。

以 `d=8192, L=8192, B=1` 來算，BF16 下就是每層 800 MB。64 層的模型就是 51 GB 的啟動值 —— 而這還沒乘上微批次大小、還沒加上注意力 softmax 的中間值（每個 head `L^2`），也還沒把張量平行的部分副本算進去。

兩頭夾擊的帳單：BF16 權重加上優化器狀態或許塞得進 80GB，但啟動值會把你推爆。梯度檢查點（又稱啟動值重算）是標準解法。丟掉大部分啟動值；反向時重跑一次前向把它們補回來。代價：額外的 FLOPs。好處：記憶體按檢查點分段數與總層數的比例下降。

天真地做，檢查點每一步大約多付 33% 的前向傳播 FLOPs。做得好 —— 照 Korthikanti 等人的「聰明選法」做選擇性檢查點 —— 你能省下 5 倍記憶體，而 FLOP 開銷不到 5%。而在 FP8 矩陣乘法、FSDP 卸載與專家平行 MoE 的世界裡這真的很要緊：記憶體和被浪費掉的運算，你哪一邊都付不起。

## 核心概念

### 反向到底需要什麼

`output = layer(input)`。反向要算出 `grad_input` 與 `grad_params`。為此它需要：

- `input`（線性層要用它算 `grad_params = input.T @ grad_output`）
- 一些啟動函式的導數中間值（ReLU/GELU/softmax 的導數取決於啟動值本身）

前向傳播會自動把這些存進 autograd 圖裡。每一次 `tensor.retain_grad()`、每一個需要自己輸入的運算，都會留下一份參照。

### 天真的完全檢查點

把網路切成 `N` 個分段。前向時只存每個分段的*輸入*。當反向需要中間值時，重跑該分段的前向傳播把它們具體算出來，然後再微分。

例子：32 層的 transformer 切成 32 個分段，每段 1 層。

- 記憶體：32 份層輸入（小）對比 32 x（每層的啟動值體積）（大）。
- 額外運算：每個分段多一次前向，也就是總前向 FLOPs 多約 33%（因為反向是前向的 2 倍，完整一步從 1 + 2 = 3 單位變成 1 + 1 + 2 = 4 單位）。

這就是 Chen 等人 2016 年的原始配方：每 `sqrt(L)` 層放一個檢查點，在記憶體與運算之間取得平衡。L=64 的話就是 8 個檢查點。

### 選擇性檢查點（Korthikanti 2022）

不是所有啟動值的代價都一樣。注意力 softmax 的輸出是 `B*L*L*heads`，隨序列長度*平方成長*。FFN 的隱藏啟動值是 `B*L*4d`，只線性成長。長序列下 softmax 會壓倒一切。

選擇性檢查點保留便宜存的啟動值（線性投影、殘差），只重算昂貴的那些（注意力）。你付出極少的 FLOPs 去重算，卻省下 O(L^2) 的記憶體。

Megatron-Core 把這個實作成「selective」啟動值重算模式。2024 年以後的前沿訓練大多都在用。

### 卸載

重算之外的另一條路：在前向與反向之間把啟動值送到 CPU RAM。這需要 PCIe 頻寬；當閒置頻寬的成本低於重新具現化的成本時就划算。混合策略很常見：一部分層做檢查點，另一部分卸載。

FSDP2 把卸載做成一級選項。當 GPU 卡在記憶體上、而 CPU-GPU 傳輸還有餘裕時，卸載最能發揮。

### 重算成本模型

在 `L` 層中每 `k` 層做一次天真檢查點時，每一步的 FLOPs：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # one extra forward per layer in the segment
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

改用選擇性檢查點，你只重算注意力核心，而不是整層：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 記憶體節省模型

每層的啟動值體積為 `A`。`L` 層的話，啟動值記憶體總量是 `L * A`。

完全檢查點（分段大小為 1）：只存 `L * input_volume`（標準 transformer 大約是 `L * 1/10 A`）。省下約 `9 * L * A * 1/10`。

每 `k` 層一個檢查點：存 `L/k * A`，再加上目前作用中的分段內 `k-1` 層的份量。

在 `k = sqrt(L)` 時，記憶體與重算成本都隨 `sqrt(L)` 成長 —— 這是各層成本一致時的最佳取捨點。

### 什麼時候不該做檢查點

- 管線階段中已經在飛行的最內層。它們反正得跑完。
- 若第一層與最後一層主導了該階段的運算量（在 transformer 裡很少見）。
- 已經在用 FlashAttention 的注意力核心 —— Flash 本來就會快速重算 softmax，再疊一層層級的檢查點加不了多少。

### 實作樣式

1. **函式包裝器：** 用 `torch.utils.checkpoint.checkpoint(fn, input)` 把一個分段包起來。PyTorch 只存 `input`，其他一切都在反向時重算。

2. **裝飾器式：** 把層標記成可檢查點；由訓練器在設定階段決定哪些分段要被包起來。

3. **手動明確重算：** 自己寫反向傳遞，呼叫一個自訂的 `recompute_forward`，用存下的輸入把前向重跑一遍。

三種做法在功能上結果相同。包裝器是標準慣用寫法。

### 與 TP / PP / FP8 的交互作用

- **張量平行：** 檢查點的輸入在重算時必須重新 gather 或 scatter；要把通訊成本算進去。
- **管線平行：** 典型做法是替每個管線階段的前向做檢查點，讓反序的微批次可以重複利用啟動值記憶體。
- **FP8 重算：** 重算期間更新的 amax 歷史必須與原本的前向一致，否則 FP8 的 scale 會漂移。大多數框架會把 scale 快照下來。

```figure
activation-recompute
```

## 動手實作

### 步驟 1：一個帶分段的玩具模型

```python
import numpy as np


def linear_forward(x, w, b):
    return x @ w + b


def relu(x):
    return np.maximum(x, 0)


def layer_forward(x, w1, b1, w2, b2):
    h = relu(linear_forward(x, w1, b1))
    return linear_forward(h, w2, b2)


def model_forward(x, params):
    activations = [x]
    h = x
    for w1, b1, w2, b2 in params:
        h = layer_forward(h, w1, b1, w2, b2)
        activations.append(h)
    return h, activations
```

### 步驟 2：需要全部啟動值的天真反向

```python
def model_backward(grad_output, activations, params):
    grads = [None] * len(params)
    g = grad_output
    for i in range(len(params) - 1, -1, -1):
        w1, b1, w2, b2 = params[i]
        x_in = activations[i]
        h_pre = linear_forward(x_in, w1, b1)
        h = relu(h_pre)
        gh = g @ w2.T
        gw2 = h.T @ g
        gb2 = g.sum(axis=0)
        g_pre = gh * (h_pre > 0)
        gx = g_pre @ w1.T
        gw1 = x_in.T @ g_pre
        gb1 = g_pre.sum(axis=0)
        grads[i] = (gw1, gb1, gw2, gb2)
        g = gx
    return g, grads
```

### 步驟 3：每 k 層一個檢查點的記憶體

```python
def model_forward_checkpointed(x, params, k=4):
    saved_inputs = [x]
    h = x
    for i, (w1, b1, w2, b2) in enumerate(params):
        h = layer_forward(h, w1, b1, w2, b2)
        if (i + 1) % k == 0:
            saved_inputs.append(h)
    return h, saved_inputs


def model_backward_checkpointed(grad_output, saved_inputs, params, k=4):
    grads = [None] * len(params)
    g = grad_output
    segments = [(j * k, min((j + 1) * k, len(params))) for j in range(len(saved_inputs))]
    for seg_idx in range(len(saved_inputs) - 1, -1, -1):
        start, end = segments[seg_idx]
        if start >= end:
            continue
        x_in = saved_inputs[seg_idx]
        _, seg_acts = model_forward(x_in, params[start:end])
        g, seg_grads = model_backward(g, seg_acts, params[start:end])
        for j, gr in enumerate(seg_grads):
            grads[start + j] = gr
    return g, grads
```

### 步驟 4：成本模型

```python
def checkpoint_cost(n_layers, segment_size, flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }


def selective_checkpoint_cost(n_layers, attention_fraction=0.15,
                              flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * attention_fraction * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }
```

### 步驟 5：記憶體估算器

```python
def activation_memory_mb(n_layers, hidden=8192, seq=8192,
                        batch=1, bytes_per_value=2):
    per_layer = 12 * batch * seq * hidden * bytes_per_value
    return n_layers * per_layer / 1e6


def memory_after_checkpoint(n_layers, segment_size, hidden=8192,
                           seq=8192, batch=1, bytes_per_value=2):
    n_seg = max(1, n_layers // segment_size)
    saved = (n_seg + segment_size) * 1 * batch * seq * hidden * bytes_per_value
    return saved / 1e6
```

### 步驟 6：最佳分段大小

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### 步驟 7：選擇性檢查點的決策

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## 框架應用

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint` —— PyTorch 裡的標準包裝器。包住一個函式；只存輸入，反向時重算。
- **Megatron-Core 啟動值重算**：支援 `selective`、`full` 與 `block` 三種模式。2024 年以後前沿訓練的標配。
- **FSDP2 卸載**：在 FSDP2 中用 `module.to_empty(device="cpu")` 搭配 `offload_policy`，把啟動值分片到 CPU 而不是重算。
- **DeepSpeed ZeRO-Offload**：把優化器狀態與啟動值卸載到 CPU，與檢查點互補。

## 產出交付

這個單元會產出 `outputs/prompt-activation-recompute-policy.md` —— 一份提示詞，接收你的模型設定（層數、隱藏維度、序列長度、批次）與可用的 GPU 記憶體，產出逐層的重算策略（none / selective / full / offload）。

## 練習

1. 驗證正確性。跑 `model_forward` + `model_backward`（完整啟動值）對比 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。參數梯度必須在機器精度內完全相同。

2. 掃過分段大小 `k`，從 1 到 `L`。把 FLOP 開銷與記憶體畫出來。找出曲線的拐點。

3. 實作選擇性檢查點：存下注意力模組的輸入，但不存它的中間值。以 seq=8192 的 32 層模型量測它相對於整層檢查點的 FLOP 開銷。

4. 加上卸載。把分段輸入存到一個模擬的「CPU 緩衝區」（另一個 list）。用 bytes/time 量測「PCIe 頻寬」，找出卸載與重算之間的損益兩平點。

5. 對一個真實的 PyTorch transformer 做基準測試，比較有無 `torch.utils.checkpoint` 的差別。量測記憶體（透過 `torch.cuda.max_memory_allocated`）與每步耗時。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 梯度檢查點 | 「重跑一次前向來省記憶體」 | 只存分段輸入；反向期間重算中間值，取回支撐梯度計算所需的張量 |
| 啟動值重算 | 「跟檢查點是同一回事」 | 同一個技巧在 HPC 圈的叫法 |
| 分段大小（k） | 「每個檢查點涵蓋幾層」 | 中間值被一起丟棄、又一起重新具現化的層數 |
| 選擇性檢查點 | 「Korthikanti 的招式」 | 只重算存起來昂貴的啟動值（注意力 softmax）；便宜的就留著 |
| 完全檢查點 | 「天真版本」 | 每個分段裡每一層的中間值都重算 |
| 區塊檢查點 | 「粗粒度」 | 以整個 transformer 區塊為單位做檢查點；粒度最大 |
| FLOP 開銷 | 「運算稅」 | 每步的額外 FLOPs =（重算 FLOPs）/（前向 + 反向 FLOPs）；天真做法 33%，選擇性 5% |
| 啟動值卸載 | 「送去 CPU」 | 在前向到反向之間把啟動值搬到 CPU RAM；重算之外的另一種選擇 |
| sqrt-L 法則 | 「經典最佳解」 | 各層成本一致時，最佳的檢查點間距是 sqrt(L) 層 |
| 注意力 softmax 體積 | 「O(L^2) 問題」 | L^2 * heads * batch 個浮點數；長上下文下主導啟動值記憶體 |

## 延伸閱讀

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) —— 把梯度檢查點形式化的原始論文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) —— 選擇性啟動值重算與正式的成本分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) —— 透過反向模式重新具現化達成定量記憶體的另一條路
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) —— 大規模下的啟動值卸載
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) —— 標準 API
- [Megatron Bridge activation recomputation documentation](https://docs.nvidia.com/nemo/megatron-bridge/latest/training/activation-recomputation.html) —— selective、full 與 block 三種模式
