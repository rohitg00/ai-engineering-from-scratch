import numpy as np
from collections import defaultdict


def simulate_data_parallelism(data, num_gpus, model_fn):
    batch_size = len(data)
    shard_size = batch_size // num_gpus
    remainder = batch_size % num_gpus

    gpu_losses = []
    gpu_gradients = []

    offset = 0
    for gpu_id in range(num_gpus):
        extra = 1 if gpu_id < remainder else 0
        shard = data[offset:offset + shard_size + extra]
        offset += shard_size + extra

        loss, grad = model_fn(shard)
        gpu_losses.append(loss)
        gpu_gradients.append(grad)

    avg_loss = np.mean(gpu_losses)
    avg_gradient = np.mean(gpu_gradients, axis=0)

    return avg_loss, avg_gradient


def simulate_tensor_parallelism(input_data, weight_matrix, num_gpus):
    d_in, d_out = weight_matrix.shape
    assert d_out % num_gpus == 0, f"d_out {d_out} not divisible by num_gpus {num_gpus}"
    shard_size = d_out // num_gpus

    partial_results = []
    for gpu_id in range(num_gpus):
        start = gpu_id * shard_size
        end = start + shard_size
        weight_shard = weight_matrix[:, start:end]

        partial = input_data @ weight_shard
        partial_results.append(partial)

    full_output = np.concatenate(partial_results, axis=-1)

    direct_output = input_data @ weight_matrix
    error = np.abs(full_output - direct_output).max()

    return full_output, error


def simulate_pipeline_parallelism(num_layers, num_stages, num_microbatches):
    layers_per_stage = num_layers // num_stages

    timeline = {}

    for mb in range(num_microbatches):
        for stage in range(num_stages):
            start_time = max(
                timeline.get((stage, mb - 1, "fwd"), (0, 0))[1] if mb > 0 else 0,
                timeline.get((stage - 1, mb, "fwd"), (0, 0))[1] if stage > 0 else 0,
            )
            end_time = start_time + layers_per_stage
            timeline[(stage, mb, "fwd")] = (start_time, end_time)

    last_fwd_end = max(v[1] for v in timeline.values())

    for mb in range(num_microbatches - 1, -1, -1):
        for stage in range(num_stages - 1, -1, -1):
            deps = [last_fwd_end]
            if mb < num_microbatches - 1 and (stage, mb + 1, "bwd") in timeline:
                deps.append(timeline[(stage, mb + 1, "bwd")][1])
            if stage < num_stages - 1 and (stage + 1, mb, "bwd") in timeline:
                deps.append(timeline[(stage + 1, mb, "bwd")][1])
            start_time = max(deps)
            end_time = start_time + layers_per_stage
            timeline[(stage, mb, "bwd")] = (start_time, end_time)

    total_time = max(v[1] for v in timeline.values())
    compute_time = num_microbatches * num_stages * layers_per_stage * 2
    bubble_fraction = 1.0 - compute_time / (total_time * num_stages)

    return timeline, total_time, bubble_fraction


def memory_calculator(
    params_billions,
    precision_bytes=2,
    optimizer="adam",
    num_gpus=1,
    sharding="none",
    sequence_length=2048,
    batch_size_per_gpu=1,
    hidden_dim=None,
    num_layers=None,
):
    params = params_billions * 1e9

    weight_memory = params * precision_bytes

    if optimizer == "adam":
        optimizer_memory = params * 4 * 2
    elif optimizer == "sgd":
        optimizer_memory = params * 4
    else:
        optimizer_memory = 0

    gradient_memory = params * precision_bytes

    if hidden_dim and num_layers:
        activation_per_layer = (
            sequence_length * batch_size_per_gpu * hidden_dim * precision_bytes * 4
        )
        activation_memory = activation_per_layer * num_layers
    else:
        activation_memory = params * precision_bytes * 0.5

    if sharding == "fsdp" or sharding == "zero3":
        weight_memory /= num_gpus
        optimizer_memory /= num_gpus
        gradient_memory /= num_gpus
    elif sharding == "zero2":
        optimizer_memory /= num_gpus
        gradient_memory /= num_gpus
    elif sharding == "zero1":
        optimizer_memory /= num_gpus

    per_gpu_total = weight_memory + optimizer_memory + gradient_memory + activation_memory

    return {
        "params_billions": params_billions,
        "weights_gb": weight_memory / 1e9,
        "optimizer_gb": optimizer_memory / 1e9,
        "gradients_gb": gradient_memory / 1e9,
        "activations_gb": activation_memory / 1e9,
        "per_gpu_total_gb": per_gpu_total / 1e9,
        "total_across_gpus_gb": per_gpu_total * num_gpus / 1e9,
        "fits_on_80gb": per_gpu_total / 1e9 <= 80,
        "num_gpus": num_gpus,
        "sharding": sharding,
    }


def mixed_precision_comparison(params_billions):
    params = params_billions * 1e9

    fp32_weights = params * 4
    fp32_optimizer = params * 4 * 2
    fp32_gradients = params * 4
    fp32_total = fp32_weights + fp32_optimizer + fp32_gradients

    fp16_weights = params * 2
    fp16_master = params * 4
    fp16_optimizer = params * 4 * 2
    fp16_gradients = params * 2
    fp16_total = fp16_weights + fp16_master + fp16_optimizer + fp16_gradients

    mixed_weights = params * 2
    mixed_optimizer = params * 4 * 2
    mixed_gradients = params * 2
    mixed_total = mixed_weights + mixed_optimizer + mixed_gradients

    return {
        "fp32_total_gb": fp32_total / 1e9,
        "fp16_with_master_gb": fp16_total / 1e9,
        "mixed_bf16_gb": mixed_total / 1e9,
        "savings_vs_fp32": 1 - mixed_total / fp32_total,
    }


def communication_volume_calculator(params_billions, num_gpus, strategy):
    params = params_billions * 1e9
    gradient_size_gb = params * 2 / 1e9

    if strategy == "data_parallel":
        allreduce_volume = 2 * gradient_size_gb * (num_gpus - 1) / num_gpus
        return {
            "strategy": "Data Parallel (Ring AllReduce)",
            "per_step_gb": allreduce_volume,
            "ops_per_step": 1,
        }
    elif strategy == "fsdp":
        allgather_volume = params * 2 / 1e9 * (num_gpus - 1) / num_gpus
        reducescatter_volume = gradient_size_gb * (num_gpus - 1) / num_gpus
        return {
            "strategy": "FSDP (AllGather + ReduceScatter per layer)",
            "per_step_gb": allgather_volume + reducescatter_volume,
            "ops_per_step": 2,
        }
    elif strategy == "tensor_parallel":
        return {
            "strategy": "Tensor Parallel (AllReduce per layer)",
            "per_step_gb": gradient_size_gb * 0.01,
            "ops_per_step": "2 x num_layers",
        }

    return {}


def training_cost_estimator(
    params_billions,
    target_tokens_trillions,
    gpu_type="h100",
    num_gpus=None,
    utilization=0.4,
):
    gpu_specs = {
        "a100": {"tflops_bf16": 312, "cost_per_hour": 2.00, "memory_gb": 80},
        "h100": {"tflops_bf16": 990, "cost_per_hour": 3.50, "memory_gb": 80},
        "h200": {"tflops_bf16": 990, "cost_per_hour": 4.50, "memory_gb": 141},
    }

    spec = gpu_specs[gpu_type]
    params = params_billions * 1e9
    tokens = target_tokens_trillions * 1e12

    flops_total = 6 * params * tokens

    flops_per_gpu_per_sec = spec["tflops_bf16"] * 1e12 * utilization

    if num_gpus is None:
        mem = memory_calculator(params_billions, sharding="fsdp", num_gpus=1)
        num_gpus = max(1, int(np.ceil(mem["per_gpu_total_gb"] / spec["memory_gb"])) * 2)

    verify = memory_calculator(params_billions, sharding="fsdp", num_gpus=num_gpus)
    while verify["per_gpu_total_gb"] > spec["memory_gb"]:
        num_gpus *= 2
        verify = memory_calculator(params_billions, sharding="fsdp", num_gpus=num_gpus)

    total_gpu_seconds = flops_total / (flops_per_gpu_per_sec * num_gpus)
    total_gpu_hours = total_gpu_seconds / 3600
    wall_clock_hours = total_gpu_hours
    total_cost = wall_clock_hours * num_gpus * spec["cost_per_hour"]

    return {
        "model_size": f"{params_billions}B",
        "tokens": f"{target_tokens_trillions}T",
        "gpu_type": gpu_type,
        "num_gpus": num_gpus,
        "total_flops": f"{flops_total:.2e}",
        "wall_clock_days": wall_clock_hours / 24,
        "total_gpu_hours": total_gpu_hours * num_gpus,
        "estimated_cost": total_cost,
    }


if __name__ == "__main__":
    np.random.seed(42)

    print("=" * 70)
    print("DATA PARALLELISM SIMULATION")
    print("=" * 70)

    data = np.random.randn(64, 32)
    weight = np.random.randn(32, 16)

    def model_fn(batch):
        output = batch @ weight
        loss = np.mean(output ** 2)
        grad = 2 * batch.T @ (batch @ weight) / len(batch)
        return loss, grad

    for n_gpus in [1, 2, 4, 8]:
        loss, grad = simulate_data_parallelism(data, n_gpus, model_fn)
        print(f"  {n_gpus} GPUs: loss={loss:.4f}, grad_norm={np.linalg.norm(grad):.4f}")

    print()
    print("=" * 70)
    print("TENSOR PARALLELISM SIMULATION")
    print("=" * 70)

    x = np.random.randn(4, 8192)
    W = np.random.randn(8192, 8192)

    for n_gpus in [1, 2, 4, 8]:
        output, error = simulate_tensor_parallelism(x, W, n_gpus)
        print(f"  {n_gpus} GPUs: output_shape={output.shape}, max_error={error:.2e}")

    print()
    print("=" * 70)
    print("PIPELINE PARALLELISM SIMULATION")
    print("=" * 70)

    for n_mb in [1, 4, 8, 16, 32]:
        _, total_t, bubble = simulate_pipeline_parallelism(32, 4, n_mb)
        print(f"  {n_mb:2d} micro-batches: total_time={total_t:4d}, bubble={bubble:.1%}")

    print()
    print("=" * 70)
    print("MEMORY CALCULATOR")
    print("=" * 70)

    configs = [
        (7, "none", 1),
        (7, "fsdp", 8),
        (70, "none", 1),
        (70, "fsdp", 8),
        (70, "fsdp", 16),
        (405, "fsdp", 64),
        (405, "fsdp", 128),
    ]

    print(f"  {'Model':>8} {'Sharding':>8} {'GPUs':>5} {'Per-GPU':>10} {'Fits 80GB':>10}")
    print("  " + "-" * 50)
    for params, shard, gpus in configs:
        result = memory_calculator(params, num_gpus=gpus, sharding=shard)
        fits = "Yes" if result["fits_on_80gb"] else "No"
        print(f"  {params:>6}B {shard:>8} {gpus:>5} {result['per_gpu_total_gb']:>8.1f}GB {fits:>10}")

    print()
    print("=" * 70)
    print("MIXED PRECISION COMPARISON")
    print("=" * 70)

    for params_b in [7, 13, 70, 405]:
        result = mixed_precision_comparison(params_b)
        print(f"  {params_b}B: FP32={result['fp32_total_gb']:.0f}GB, "
              f"Mixed BF16={result['mixed_bf16_gb']:.0f}GB, "
              f"Savings={result['savings_vs_fp32']:.0%}")

    print()
    print("=" * 70)
    print("COMMUNICATION VOLUME")
    print("=" * 70)

    for strategy in ["data_parallel", "fsdp", "tensor_parallel"]:
        result = communication_volume_calculator(70, 8, strategy)
        print(f"  {result['strategy']}")
        print(f"    Per-step volume: {result['per_step_gb']:.1f} GB")
        print()

    print("=" * 70)
    print("TRAINING COST ESTIMATES")
    print("=" * 70)

    estimates = [
        (8, 15.0, "h100", 512),
        (70, 15.0, "h100", 2048),
        (405, 15.0, "h100", 16384),
        (671, 14.8, "h100", 2048),
    ]

    print(f"  {'Model':>8} {'Tokens':>8} {'GPUs':>6} {'Days':>8} {'Cost':>14}")
    print("  " + "-" * 55)
    for params, tokens, gpu, n_gpus in estimates:
        result = training_cost_estimator(params, tokens, gpu, n_gpus)
        cost_str = f"${result['estimated_cost']:,.0f}"
        print(f"  {params:>6}B {tokens:>6.1f}T {n_gpus:>6} {result['wall_clock_days']:>7.0f}d {cost_str:>14}")
