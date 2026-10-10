# 梯度檢查點與活化值重算

> 反向傳播需要保留每一個中間活化值。在 70B 參數與 128K 脈絡長度下，每個 rank 的活化值高達 3 TB。檢查點技術以運算換取記憶體：重新計算而非全量儲存。關鍵問題在於究竟該丟棄哪些分段，而答案絕非「丟棄全部」。

**Type:** Build
**Languages:** Python (with numpy, optional torch)
**Prerequisites:** Phase 10 Lesson 04 (Pre-Training Mini-GPT), Phase 10 Lesson 05 (Scaling & Distributed)
**Time:** ~70 minutes

## The Problem｜問題

訓練 Transformer 時，每層都必須儲存在反向傳播求導中所需的各運算輸入：注意力層輸入、Q/K/V 投影、softmax 輸出、FFN 輸入、正規化層輸出，以及殘差串流。對於隱藏維度為 `d`、序列長度為 `L`、批次大小為 `B` 的層級，每層所需的浮點數數量級約為 `12 * B * L * d`。

在 `d=8192, L=8192, B=1` 下，BF16 精度每層就需要 800 MB。一個 64 層的模型光是活化值就佔據 51 GB——這還是在乘上微批次大小之前、還沒算上注意力 softmax 中間值（每頭 `L^2`），以及還沒計入張量平行的局部複本之前。

這是一張雙重帳單：BF16 權重加上最佳化器狀態或許能勉強塞進 80GB，但活化值會把你推過這個上限。梯度檢查點（Gradient checkpointing，亦稱活化值重算，activation recomputation）是標準解法。丟棄絕大多數活化值；在反向傳播期間重新執行前向傳遞以將它們即時算回。代價：額外的運算量（FLOPs）。收益：記憶體佔用依檢查點分段與總層數的比例下降。

天真的檢查點做法每步會多耗費約 33% 的前向運算量。而精巧的做法——依據 Korthikanti 等人的「智慧選擇性檢查點」——能以低於 5% 的額外運算開銷換取 5 倍的記憶體節省。在 FP8 矩陣乘法、FSDP 卸載與專家平行 MoE 的時代，這至關重要：你既承擔不起記憶體爆炸，也承擔不起浪費運算資源。

## The Concept｜核心概念

### 反向傳播究竟需要什麼

`output = layer(input)`。反向傳播需要求出 `grad_input` 與 `grad_params`。為了計算它們，必須具備：

- `input`（線性層需要利用它計算 `grad_params = input.T @ grad_output`）
- 部分活化函數的導數中間值（ReLU、GELU 或 softmax 的導數直接取決於活化值本身）

前向傳遞會自動在 autograd 計算圖中儲存這些數值。每個 `tensor.retain_grad()` 以及每個需要輸入以計算梯度的運算都會保留引用。

### 簡單的全量檢查點做法

將整個網路切分成 `N` 個分段。在前向傳遞期間，僅儲存每個分段的**輸入**。當反向傳播需要中間值時，重新執行該分段的前向傳遞將其實體化，隨後立即進行求導。

範例：32 層 Transformer 切分為 32 個分段，每段 1 層。

- 記憶體：32 個層輸入（極小）對比 32 *（每層的完整活化值體積）（龐大）。
- 額外運算：每個分段額外多執行 1 次前向傳遞，即整體約增加 33% 的前向運算量（由於反向傳播運算量是前向的 2 倍，整步計算從 1 + 2 = 3 單位變為 1 + 1 + 2 = 4 單位）。

這正是 Chen 等人於 2016 年提出的經典配方：每隔 `sqrt(L)` 層設置一個檢查點，以平衡記憶體與運算開銷。對於 L=64，即為 8 個檢查點。

### 選擇性檢查點（Korthikanti，2022 年）

並非所有活化值的儲存成本都相同。注意力 softmax 輸出大小為 `B*L*L*heads`，隨序列長度呈**二次方**暴增；而 FFN 隱藏活化值大小為 `B*L*4d`，僅隨長度呈線性增長。對於長序列，softmax 主導了記憶體佔用。

選擇性檢查點保留儲存代價低廉的活化值（線性投影、殘差），僅針對代價高昂的活化值（注意力機制）進行重算。你只需支付極微小的額外運算量來重算，卻能省去 O(L^2) 的龐大記憶體。

Megatron-Core 將此實作為「選擇性（selective）」活化值重算，被廣泛應用於 2024 年以來多數前沿訓練作業中。

### 活化值卸載（Offload）

重算的替代方案：在前向傳遞與反向傳播之間，將活化值搬運至 CPU RAM。這需要依賴 PCIe 頻寬；當閒置頻寬的傳輸成本低於重新計算成本時極具優勢。實務上常見混合策略：一部分層級設置檢查點，另一部分層級進行卸載。

FSDP2 將卸載列為完整支援選項。當 GPU 受到記憶體極限瓶頸限制，但 CPU-GPU 資料傳輸仍有充裕餘裕時，卸載表現極為亮眼。

### 重算成本模型

在 `L` 層中每隔 `k` 層天真設置檢查點的每步 FLOPs：

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

而在選擇性檢查點下，你僅重算注意力核心，而非整層網路：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 記憶體節省模型

每層活化值體積為 `A`。在 `L` 層下，總活化值記憶體為 `L * A`。

全量檢查點（分段大小為 1）：僅儲存 `L * input_volume`（在標準 Transformer 中約為 `L * 1/10 A`），節省約 `9 * L * A * 1/10`。

每隔 `k` 層設置檢查點：儲存 `L/k * A` 加上活躍分段內部 `k-1` 層的活化值。

在 `k = sqrt(L)` 下，記憶體與重算成本皆隨 `sqrt(L)` 縮放——對於計算成本均勻的層級而言，這是數學上的最佳平衡點。

### 何時不應設置檢查點

- 管線階段中已在執行的最內層（這些運算本來就得完成）。
- 第一層與最後一層（若它們佔據該階段的主導運算，在 Transformer 中較為少見）。
- 已經採用 FlashAttention 的注意力核心——FlashAttention 本身就以極快速度重算了 softmax，外層再包一層檢查點帶來的增益微乎其微。

### 實作慣用語

1. **函數包裝器（Function wrapper）**：以 `torch.utils.checkpoint.checkpoint(fn, input)` 包裝分段。PyTorch 僅儲存 `input`，反向時重新計算其餘一切。
2. **基於裝飾器**：將層級標記為可設置檢查點；訓練器在設定時決定哪些分段進行包裝。
3. **手動顯式重算**：自行撰寫反向傳播，呼叫自訂的 `recompute_forward`，以儲存的輸入重新執行前向傳遞。

這三者在功能結果上完全等價。包裝器是業界最標準的寫法。

### 與 TP / PP / FP8 的交互作用

- **張量平行（TP）**：檢查點輸入在重算時必須進行 gather 或 rescatter；必須妥善處理通訊開銷。
- **管線平行（PP）**：典型模式是為每個管線階段的前向設置檢查點，以便反向微批次能重複使用活化值記憶體。
- **FP8 重算**：重算期間更新的 amax 歷史必須與原始前向嚴格吻合，否則 FP8 縮放比例會發生漂移。多數框架會對縮放比例進行快照。

```figure
activation-recompute
```

## Build It｜動手實作

### 步驟 1：帶有分段的玩具模型

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

### 步驟 2：需要全量活化值的天真反向傳播

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

### 步驟 3：每隔 k 層設置檢查點的記憶體管理

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

### 步驟 7：選擇性檢查點決策邏輯

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## Use It｜實際應用

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint`——PyTorch 的標準包裝器。包裝一個函數；僅儲存輸入，在反向傳播時自動重算。
- **Megatron-Core 活化值重算**：支援 `selective`、`full` 與 `block` 模式。2024 年後尖端訓練的標配。
- **FSDP2 卸載**：FSDP2 具備 `module.to_empty(device="cpu")` 與 `offload_policy`，將活化值卸載至 CPU 而非重算。
- **DeepSpeed ZeRO-Offload**：為最佳化器狀態與活化值提供 CPU 卸載，與檢查點互為補充。

## Ship It｜交付成果

本課產出 `outputs/prompt-activation-recompute-policy.md`——一個接收模型設定（層數、隱藏維度、序列長度、批次大小）與可用 GPU 記憶體，並產出逐層重算策略（none / selective / full / offload）的 prompt。

## Exercises｜練習

1. 驗證正確性。執行 `model_forward` + `model_backward`（全量活化值）對比 `model_forward_checkpointed` + `model_backward_checkpointed`（分段檢查點）。參數梯度應在機器精度範圍內一致。

2. 掃描分段大小 `k` 從 1 到 `L`。繪製 FLOPs 額外開銷與記憶體佔用曲線，找出整條曲線的轉折肘點（knee of the curve）。

3. 實作選擇性檢查點：儲存注意力模組的輸入，但丟棄其內部中間值。在 seq=8192 的 32 層模型上，測量其相較於全層檢查點的 FLOPs 開銷對比。

4. 加入卸載機制。將分段輸入儲存至模擬的「CPU 緩衝區」（獨立列表）。測量以位元組/時間計量的「PCIe 頻寬」，找出卸載與重算之間的損益平衡點。

5. 在真實 PyTorch Transformer 上對比啟用與未啟用 `torch.utils.checkpoint` 的表現。透過 `torch.cuda.max_memory_allocated` 測量記憶體峰值與單步耗時。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 梯度檢查點（Gradient checkpointing） | 「重跑前向來省記憶體」 | 僅儲存分段輸入；在反向傳播時重新計算中間值以取得支援梯度的張量 |
| 活化值重算（Activation recomputation） | 「檢查點的另一種叫法」 | 高效能運算領域對同一技術的稱呼 |
| 分段大小（k） | 「每幾個層存一個檢查點」 | 其內部中間值被丟棄並一併重新實體化的層數 |
| 選擇性檢查點（Selective checkpointing） | 「Korthikanti 的絕招」 | 僅重算儲存代價昂貴的活化值（注意力 softmax）；保留代價廉價的活化值 |
| 全量檢查點（Full checkpointing） | 「樸素版本」 | 重新計算每個分段中所有層級的中間值 |
| 區塊檢查點（Block checkpointing） | 「粗粒度檢查點」 | 為整個 Transformer 區塊設置檢查點；最大顆粒度 |
| FLOP 額外開銷 | 「運算稅」 | 每步增加的 FLOPs =（重算 FLOPs）/（前向 + 反向 FLOPs）；樸素版約 33%，選擇性版約 5% |
| 活化值卸載（Activation offload） | 「搬到 CPU」 | 在前向至反向期間將活化值移至 CPU RAM；重算的替代方案 |
| sqrt-L 定律 | 「經典最佳間隔」 | 對於成本均勻的層級，最佳檢查點間隔為 sqrt(L) 層 |
| 注意力 Softmax 體積 | 「O(L^2) 難題」 | L^2 * heads * batch 的浮點數；在長脈絡下主導了活化值記憶體 |

## Further Reading｜延伸閱讀

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) ——正式形式化定義梯度檢查點的開創性經典論文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) ——選擇性活化值重算與形式化成本分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) ——透過反向模式重新實體化達成常數記憶體的替代方案
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) ——大規模活化值卸載技術
- [PyTorch torch.utils.checkpoint 文件](https://pytorch.org/docs/stable/checkpoint.html) ——官方標準 API 指引
- [Megatron Bridge 活化值重算文件](https://docs.nvidia.com/nemo/megatron-bridge/latest/training/activation-recomputation.html) ——涵蓋 selective、full 與 block 模式的生產級說明
