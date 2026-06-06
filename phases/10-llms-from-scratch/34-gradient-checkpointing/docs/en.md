# Gradient Checkpointing and Activation Recomputation

> Backprop keeps every intermediate activation. At 70B parameters and 128K context that is 3 TB of activations per rank. Checkpointing trades FLOPs for memory: recompute instead of save. The question is which segments to drop, and the answer is not "all of them."

**Type:** Build
**Languages:** Python (with numpy, optional torch)
**Prerequisites:** Phase 10 Lesson 04 (Pre-Training Mini-GPT), Phase 10 Lesson 05 (Scaling & Distributed)
**Time:** ~70 minutes

## The Problem

Training a transformer stores, for each layer, the inputs to every op that is differentiated in backward: the attention inputs, the Q/K/V projections, the softmax output, the FFN inputs, the norm outputs, and the residual stream. For a layer with hidden size `d`, sequence length `L`, batch `B`, this is on the order of `12 * B * L * d` floats per layer.

For `d=8192, L=8192, B=1`, that's 800 MB/layer in BF16. A 64-layer model is 51 GB of activations — and that's before you multiply by microbatch size, before you add attention-softmax intermediates (`L^2` per head), and before you factor tensor-parallel partial copies.

The two-sided bill: BF16 weights plus optimizer state might fit in 80GB, but activations push you past. Gradient checkpointing (aka activation recomputation) is the standard fix. Drop most activations; redo the forward during backward to get them back. Cost: extra FLOPs. Benefit: memory drops by the ratio of checkpoint segments to total layers.

Done naively, checkpointing costs roughly 33% more forward-pass FLOPs per step. Done well — selective checkpointing per the "smart selection" of Korthikanti et al. — you save 5x memory for under 5% FLOP overhead. And with FP8 matmuls, FSDP offload, and expert-parallel MoE this really matters: you can't afford either the memory or the wasted compute.

## The Concept

### What Backward Actually Needs

`output = layer(input)`. Backward wants `grad_input` and `grad_params`. To compute them it needs:

- `input` (to compute `grad_params = input.T @ grad_output` for linear layers)
- some activation derivative intermediates (the derivative of ReLU/GELU/softmax depends on the activation value)

The forward pass stores these automatically in the autograd graph. Every `tensor.retain_grad()` and every op that needs its input retains a reference.

### Naive Full Checkpointing

Split the network into `N` segments. During forward, store only the *input* to each segment. When backward needs intermediates, rerun the segment's forward pass to materialize them, then differentiate.

Example: 32-layer transformer split into 32 segments of 1 layer each.

- Memory: 32 layer-inputs (small) vs 32 * (activation volume per layer) (huge).
- Extra compute: 1 extra forward per segment, i.e., ~33% more forward FLOPs total (since backward is 2x forward, full step becomes 1 + 1 + 2 = 4 units instead of 1 + 2 = 3).

This is the original Chen et al. 2016 recipe: one checkpoint every `sqrt(L)` layers to balance memory and compute. For L=64, that's 8 checkpoints.

### Selective Checkpointing (Korthikanti 2022)

Not all activations cost the same. The attention softmax output is `B*L*L*heads` and grows *quadratically* with sequence length. The FFN hidden activation is `B*L*4d` and grows linearly. For long sequences the softmax dominates.

Selective checkpointing keeps the cheap-to-store activations (linear projections, residuals) and recomputes only the expensive ones (attention). You pay minimal FLOPs to recompute but save the O(L^2) memory.

Megatron-Core implements this as "selective" activation recomputation. Used in most 2024+ frontier training runs.

### Offload

Alternative to recompute: ship activations to CPU RAM between forward and backward. Requires PCIe bandwidth; beneficial when idle bandwidth exceeds the cost of rematerialization. Mixed strategies are common: checkpoint some layers, offload others.

FSDP2 ships offload as a first-class option. Offload shines when GPU is bottlenecked on memory but CPU-GPU transfer has headroom.

### Recompute Cost Model

Per-step FLOPs with naive checkpointing every `k` layers out of `L`:

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

With selective checkpointing you recompute only the attention kernel, not the whole layer:

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### Memory Savings Model

Activation volume per layer: `A`. For `L` layers, total activation memory: `L * A`.

Full checkpoint (segment size 1): store only `L * input_volume` (~`L * 1/10 A` for a standard transformer). Saves ~`9 * L * A * 1/10`.

Checkpoint every `k` layers: store `L/k * A` plus `k-1` layers' worth within the active segment.

At `k = sqrt(L)`, memory and recompute cost both scale with `sqrt(L)` — the optimal tradeoff for uniform-cost layers.

### When Not to Checkpoint

- The innermost layers of a pipeline stage already in-flight. They have to finish anyway.
- The first and last layers if they dominate the stage's compute (rare in transformers).
- Attention kernels already using FlashAttention — Flash already recomputes the softmax fast, so additional layer-level checkpointing adds little on top.

### Implementation Patterns

1. **Function wrapper:** wrap a segment in `torch.utils.checkpoint.checkpoint(fn, input)`. PyTorch stores only `input`, recomputes everything else on backward.

2. **Decorator-based:** label layers as checkpointable; the trainer decides at config time which segments get wrapped.

3. **Manual explicit recompute:** write the backward pass yourself, calling a custom `recompute_forward` that duplicates the forward with the stored input.

All three give the same functional result. Wrappers are the standard idiom.

### Interaction with TP / PP / FP8

- **Tensor parallel:** checkpoint inputs must be gathered or rescattered on recompute; handle the communication cost.
- **Pipeline parallel:** typical pattern is to checkpoint each pipeline-stage's forward so reverse-order microbatches can reuse activation memory.
- **FP8 recompute:** amax histories updated during recompute must match the original forward's, or the FP8 scale drifts. Most frameworks snapshot the scale.

## Build It

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

## Use It

- **torch.utils.checkpoint**: `from torch.utils.checkpoint import checkpoint` — the canonical wrapper in PyTorch. Wraps a function; stores only inputs, recomputes on backward.
- **Megatron-Core activation recomputation**: supports `selective`, `full`, and `block` modes. Standard in 2024+ frontier training.
- **FSDP2 offload**: `module.to_empty(device="cpu")` with `offload_policy` in FSDP2 shards activations to CPU instead of recomputing.
- **DeepSpeed ZeRO-Offload**: CPU offload for optimizer states and activations, complementing checkpointing.

## Ship It

This lesson produces `outputs/prompt-activation-recompute-policy.md` — a prompt that takes your model config (layers, hidden, seq, batch) and available GPU memory and emits a per-layer recompute policy (none / selective / full / offload).

## Exercises

1. Verify correctness. Run `model_forward` + `model_backward` (full activations) vs `model_forward_checkpointed` + `model_backward_checkpointed` (segments). Parameter gradients must be identical to machine precision.

2. Sweep segment size `k` from 1 to `L`. Plot FLOP overhead and memory. Find the knee of the curve.

3. Implement selective checkpointing: store the attention-module input but not its intermediates. Measure the FLOP overhead vs full-layer checkpointing for a 32-layer model at seq=8192.

4. Add offload. Save segment inputs to a simulated "CPU buffer" (a separate list). Measure "PCIe bandwidth" as bytes/time and find the breakeven point between offload and recompute.

5. Benchmark a real PyTorch transformer with and without `torch.utils.checkpoint`. Measure memory (via `torch.cuda.max_memory_allocated`) and step time.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Gradient checkpointing | "Save memory by redoing forward" | Store segment inputs only; recompute intermediates during backward to get gradient-support tensors |
| Activation recomputation | "Same as checkpointing" | The HPC-flavored name for the same technique |
| Segment size (k) | "How many layers per checkpoint" | Number of layers whose intermediates are dropped and rematerialized together |
| Selective checkpointing | "Korthikanti's trick" | Recompute only expensive-to-store activations (attention softmax); keep cheap ones |
| Full checkpointing | "The naive version" | Recompute every layer's intermediates in every segment |
| Block checkpointing | "Coarse-grained" | Checkpoint whole transformer blocks; largest granularity |
| FLOP overhead | "The compute tax" | Extra FLOPs per step = (recompute FLOPs) / (fwd + bwd FLOPs); 33% naive, 5% selective |
| Activation offload | "Ship to CPU" | Move activations to CPU RAM across forward->backward; alternative to recompute |
| sqrt-L rule | "The classical optimum" | For uniform-cost layers, optimal checkpoint spacing is sqrt(L) layers |
| Attention-softmax volume | "The O(L^2) problem" | L^2 * heads * batch floats; dominates activation memory at long contexts |

## Further Reading

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) -- the original paper that formalized gradient checkpointing
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) -- selective activation recomputation and the formal cost analysis
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) -- alternative constant-memory approach via reverse-mode rematerialization
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) -- activation offload at scale
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) -- the standard API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- selective, full, and block modes
