# Gradient Checkpointing and Activation Recomputation

> Backprop はすべての intermediate activation を保持します。70B parameters かつ 128K context では、rank あたり 3 TB の activations になります。Checkpointing は FLOPs と memory を交換します。保存する代わりに recompute するのです。問題はどの segments を捨てるかであり、答えは「全部」ではありません。

**種別:** 構築
**言語:** Python (with numpy, optional torch)
**前提条件:** Phase 10 Lesson 04 (Pre-Training Mini-GPT), Phase 10 Lesson 05 (Scaling & Distributed)
**所要時間:** 約70分

## 問題

Transformer の training では、backward で微分される各 op の inputs を layer ごとに保存します。Attention inputs、Q/K/V projections、softmax output、FFN inputs、norm outputs、residual stream です。Hidden size `d`、sequence length `L`、batch `B` の layer では、おおよそ `12 * B * L * d` floats per layer になります。

`d=8192, L=8192, B=1` の場合、BF16 で 800 MB/layer です。64-layer model では activations だけで 51 GB になります。これは microbatch size を掛ける前、attention-softmax intermediates (`L^2` per head) を足す前、tensor-parallel partial copies を考慮する前の数字です。

両側から請求が来ます。BF16 weights と optimizer state は 80GB に収まるかもしれませんが、activations がそれを押し出します。Gradient checkpointing (aka activation recomputation) は標準的な対策です。ほとんどの activations を捨て、backward 中に forward をやり直して取り戻します。コストは extra FLOPs。利点は、memory が checkpoint segments と total layers の比率に応じて下がることです。

素朴に行うと、checkpointing は step あたりの forward-pass FLOPs をおよそ 33% 増やします。うまく行えば、Korthikanti et al. の "smart selection" による selective checkpointing のように、5x の memory を節約しつつ FLOP overhead を 5% 未満にできます。FP8 matmuls、FSDP offload、expert-parallel MoE がある場合、これは非常に重要です。memory も無駄な compute も、どちらも余裕がないからです。

## コンセプト

### Backward が実際に必要とするもの

`output = layer(input)`。Backward は `grad_input` と `grad_params` を必要とします。それらを計算するには次が必要です。

- `input` (linear layers で `grad_params = input.T @ grad_output` を計算するため)
- いくつかの activation derivative intermediates (ReLU/GELU/softmax の derivative は activation value に依存する)

Forward pass はこれらを autograd graph に自動的に保存します。すべての `tensor.retain_grad()` と、input を必要とするすべての op が reference を保持します。

### 素朴な Full Checkpointing

Network を `N` segments に分割します。Forward 中は各 segment の *input* だけを保存します。Backward が intermediates を必要としたら、その segment の forward pass を再実行して materialize し、それから微分します。

例: 32-layer transformer を 1 layer ずつ 32 segments に分割する。

- Memory: 32 layer-inputs (小さい) vs 32 * (activation volume per layer) (巨大)。
- Extra compute: segment ごとに 1 回の追加 forward。つまり total forward FLOPs は約 33% 増えます (backward は forward の 2x なので、full step は 1 + 2 = 3 units ではなく 1 + 1 + 2 = 4 units になる)。

これは元の Chen et al. 2016 のレシピです。memory と compute のバランスを取るため、`sqrt(L)` layers ごとに 1 つ checkpoint を置きます。L=64 なら 8 checkpoints です。

### Selective Checkpointing (Korthikanti 2022)

すべての activations が同じコストではありません。Attention softmax output は `B*L*L*heads` で、sequence length に対して *二乗* で増えます。FFN hidden activation は `B*L*4d` で、線形に増えます。長い sequences では softmax が支配的です。

Selective checkpointing は、保存コストが安い activations (linear projections、residuals) を保持し、高価なもの (attention) だけを recompute します。Recompute の FLOPs は最小限に抑えながら、O(L^2) memory を節約できます。

Megatron-Core はこれを "selective" activation recomputation として実装しています。2024+ の frontier training runs の多くで使われています。

### Offload

Recompute の代替は、forward と backward の間に activations を CPU RAM へ送ることです。PCIe bandwidth が必要で、idle bandwidth が rematerialization のコストを上回る場合に有利です。混合戦略も一般的です。一部の layers を checkpoint し、他を offload します。

FSDP2 は offload を first-class option として提供します。GPU が memory に詰まっている一方で CPU-GPU transfer に headroom があるとき、offload は効果を発揮します。

### Recompute Cost Model

`L` layers のうち `k` layers ごとに素朴な checkpointing を行う場合の per-step FLOPs:

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

Selective checkpointing では、layer 全体ではなく attention kernel だけを recompute します。

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### Memory Savings Model

Activation volume per layer: `A`。`L` layers では total activation memory は `L * A` です。

Full checkpoint (segment size 1): `L * input_volume` だけを保存します (standard transformer では約 `L * 1/10 A`)。約 `9 * L * A * 1/10` を節約します。

`k` layers ごとに checkpoint する場合: `L/k * A` に加え、active segment 内の `k-1` layers 分を保存します。

`k = sqrt(L)` では、memory と recompute cost の両方が `sqrt(L)` で scale します。Uniform-cost layers に対する optimal tradeoff です。

### Checkpoint しない方がよい場合

- Pipeline stage の innermost layers がすでに in-flight の場合。どのみち完了する必要があります。
- Stage の compute を支配する first と last layers (transformers ではまれ)。
- Attention kernels がすでに FlashAttention を使っている場合。Flash はすでに softmax を高速に recompute するため、追加の layer-level checkpointing の上乗せ効果は小さいです。

### 実装パターン

1. **Function wrapper:** segment を `torch.utils.checkpoint.checkpoint(fn, input)` で wrap します。PyTorch は `input` だけを保存し、backward でそれ以外を recompute します。

2. **Decorator-based:** layers を checkpointable として label し、trainer が config time にどの segments を wrap するか決めます。

3. **Manual explicit recompute:** backward pass を自分で書き、保存した input で forward を複製する custom `recompute_forward` を呼びます。

3 つとも functional result は同じです。Wrappers が標準的な idiom です。

### TP / PP / FP8 との相互作用

- **Tensor parallel:** checkpoint inputs は recompute 時に gather または rescatter する必要があります。Communication cost を扱ってください。
- **Pipeline parallel:** 典型的な pattern は、各 pipeline-stage の forward を checkpoint し、reverse-order microbatches が activation memory を再利用できるようにすることです。
- **FP8 recompute:** recompute 中に更新される amax histories は元の forward と一致する必要があります。一致しないと FP8 scale が drift します。多くの frameworks は scale を snapshot します。

## 作るもの

### Step 1: A Toy Model With Segments

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

### Step 2: Naive Backward Needing All Activations

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

### Step 3: Checkpoint-Every-k Memory

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

### Step 4: Cost Model

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

### Step 5: Memory Estimator

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

### Step 6: Optimal Segment Size

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### Step 7: Selective Checkpoint Decision

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## 使い方

- **torch.utils.checkpoint**: `from torch.utils.checkpoint import checkpoint` — PyTorch の canonical wrapper。Function を wrap し、inputs だけを保存して backward で recompute します。
- **Megatron-Core activation recomputation**: `selective`、`full`、`block` modes をサポートします。2024+ の frontier training で標準的です。
- **FSDP2 offload**: FSDP2 shards の `offload_policy` と `module.to_empty(device="cpu")` により、recompute ではなく activations を CPU に移します。
- **DeepSpeed ZeRO-Offload**: Optimizer states と activations の CPU offload。Checkpointing を補完します。

## Ship It

この lesson は `outputs/prompt-activation-recompute-policy.md` を生成します。これは model config (layers、hidden、seq、batch) と利用可能な GPU memory を受け取り、per-layer recompute policy (none / selective / full / offload) を出力する prompt です。

## 演習

1. 正しさを検証してください。`model_forward` + `model_backward` (full activations) と `model_forward_checkpointed` + `model_backward_checkpointed` (segments) を比較します。Parameter gradients は machine precision まで一致する必要があります。

2. Segment size `k` を 1 から `L` まで sweep します。FLOP overhead と memory を plot し、curve の knee を見つけます。

3. Selective checkpointing を実装してください。Attention-module input は保存し、その intermediates は保存しないようにします。seq=8192 の 32-layer model で、full-layer checkpointing に対する FLOP overhead を測定します。

4. Offload を追加してください。Segment inputs を simulated "CPU buffer" (別の list) に保存します。"PCIe bandwidth" を bytes/time として測定し、offload と recompute の breakeven point を見つけます。

5. `torch.utils.checkpoint` の有無で real PyTorch transformer を benchmark してください。Memory (`torch.cuda.max_memory_allocated` 経由) と step time を測定します。

## 重要用語

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Gradient checkpointing | "Save memory by redoing forward" | Segment inputs だけを保存し、backward 中に intermediates を recompute して gradient-support tensors を得る |
| Activation recomputation | "Same as checkpointing" | 同じ手法を指す HPC 風の名前 |
| Segment size (k) | "How many layers per checkpoint" | Intermediates を捨て、まとめて rematerialize する layers 数 |
| Selective checkpointing | "Korthikanti's trick" | 保存コストが高い activations (attention softmax) だけを recompute し、安いものは保持する |
| Full checkpointing | "The naive version" | 各 segment 内の全 layer intermediates を recompute する |
| Block checkpointing | "Coarse-grained" | Transformer blocks 全体を checkpoint する。最も粗い granularity |
| FLOP overhead | "The compute tax" | Step あたり extra FLOPs = (recompute FLOPs) / (fwd + bwd FLOPs)。naive で 33%、selective で 5% |
| Activation offload | "Ship to CPU" | Forward->backward の間に activations を CPU RAM へ移動する。Recompute の代替 |
| sqrt-L rule | "The classical optimum" | Uniform-cost layers では optimal checkpoint spacing が sqrt(L) layers になる |
| Attention-softmax volume | "The O(L^2) problem" | L^2 * heads * batch floats。Long contexts で activation memory を支配する |

## 参考資料

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) -- gradient checkpointing を形式化した original paper
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) -- selective activation recomputation と formal cost analysis
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) -- reverse-mode rematerialization による alternative constant-memory approach
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) -- scale した activation offload
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) -- standard API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- selective、full、block modes
