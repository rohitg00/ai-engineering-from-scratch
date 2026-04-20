import torch
import torch.nn as nn
import math


class LoRALayer(nn.Module):
    def __init__(self, in_features, out_features, rank=8, alpha=16):
        super().__init__()
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank

        self.A = nn.Parameter(torch.randn(in_features, rank) * (1 / math.sqrt(rank)))
        self.B = nn.Parameter(torch.zeros(rank, out_features))

    def forward(self, x):
        return (x @ self.A @ self.B) * self.scaling


class LinearWithLoRA(nn.Module):
    def __init__(self, linear, rank=8, alpha=16):
        super().__init__()
        self.linear = linear
        self.lora = LoRALayer(
            linear.in_features, linear.out_features, rank, alpha
        )

        for param in self.linear.parameters():
            param.requires_grad = False

    def forward(self, x):
        return self.linear(x) + self.lora(x)


def inject_lora(model, target_modules, rank=8, alpha=16):
    for param in model.parameters():
        param.requires_grad = False

    lora_layers = {}
    for name, module in list(model.named_modules()):
        if isinstance(module, nn.Linear):
            if any(t in name for t in target_modules):
                parent_name = ".".join(name.split(".")[:-1])
                child_name = name.split(".")[-1]
                if parent_name:
                    parent = dict(model.named_modules())[parent_name]
                else:
                    parent = model
                lora_linear = LinearWithLoRA(module, rank, alpha)
                setattr(parent, child_name, lora_linear)
                lora_layers[name] = lora_linear
    return lora_layers


def count_parameters(model):
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    frozen = total - trainable
    return {
        "total": total,
        "trainable": trainable,
        "frozen": frozen,
        "trainable_pct": 100 * trainable / total if total > 0 else 0,
    }


def merge_lora_weights(model):
    for name, module in list(model.named_modules()):
        if isinstance(module, LinearWithLoRA):
            with torch.no_grad():
                merged = (module.lora.A @ module.lora.B) * module.lora.scaling
                module.linear.weight.data += merged.T

            parent_name = ".".join(name.split(".")[:-1])
            child_name = name.split(".")[-1]
            if parent_name:
                parent = dict(model.named_modules())[parent_name]
            else:
                parent = model
            setattr(parent, child_name, module.linear)


def quantize_to_nf4(tensor, block_size=64):
    original_shape = tensor.shape
    flat = tensor.reshape(-1)

    pad_size = (block_size - flat.shape[0] % block_size) % block_size
    if pad_size > 0:
        flat = torch.cat([flat, torch.zeros(pad_size)])

    blocks = flat.reshape(-1, block_size)
    scales = blocks.abs().max(dim=1, keepdim=True).values / 7.0
    scales = torch.clamp(scales, min=1e-8)
    quantized = torch.round(blocks / scales).clamp(-8, 7).to(torch.int8)

    return quantized, scales, original_shape, pad_size


def dequantize_from_nf4(quantized, scales, original_shape, pad_size):
    dequantized = quantized.float() * scales
    flat = dequantized.reshape(-1)
    if pad_size > 0:
        flat = flat[:-pad_size]
    return flat.reshape(original_shape)


def quantize_model(model):
    quantized_state = {}
    for name, param in model.named_parameters():
        if not param.requires_grad and param.dim() >= 2:
            q, scales, shape, pad = quantize_to_nf4(param.data)
            quantized_state[name] = {
                "quantized": q,
                "scales": scales,
                "shape": shape,
                "pad_size": pad,
            }
            param.data = dequantize_from_nf4(q, scales, shape, pad)
    return quantized_state


def train_lora(model, data, epochs=5, lr=1e-3, batch_size=4):
    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad], lr=lr
    )
    criterion = nn.MSELoss()

    losses = []
    for epoch in range(epochs):
        epoch_loss = 0.0
        n_batches = 0
        indices = torch.randperm(len(data["inputs"]))

        for i in range(0, len(indices), batch_size):
            batch_idx = indices[i : i + batch_size]
            x = data["inputs"][batch_idx]
            y = data["targets"][batch_idx]

            output = model(x)
            loss = criterion(output, y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_loss = epoch_loss / max(n_batches, 1)
        losses.append(avg_loss)

    return losses


def save_lora_adapter(model, path):
    adapter_state = {}
    for name, module in model.named_modules():
        if isinstance(module, LoRALayer):
            adapter_state[f"{name}.A"] = module.A.data.clone()
            adapter_state[f"{name}.B"] = module.B.data.clone()
            adapter_state[f"{name}.rank"] = module.rank
            adapter_state[f"{name}.alpha"] = module.alpha
    torch.save(adapter_state, path)
    return len(adapter_state) // 4


def load_lora_adapter(model, path):
    adapter_state = torch.load(path, weights_only=False)
    for name, module in model.named_modules():
        if isinstance(module, LoRALayer):
            a_key = f"{name}.A"
            b_key = f"{name}.B"
            if a_key in adapter_state:
                module.A.data = adapter_state[a_key]
                module.B.data = adapter_state[b_key]


def create_demo_model(d_model=256, hidden=512, n_classes=10):
    return nn.Sequential(
        nn.Linear(d_model, hidden),
        nn.ReLU(),
        nn.Linear(hidden, hidden),
        nn.ReLU(),
        nn.Linear(hidden, n_classes),
    )


def create_demo_data(n_samples=500, d_model=256, n_classes=10):
    x = torch.randn(n_samples, d_model)
    y = torch.randint(0, n_classes, (n_samples,))
    y_onehot = torch.zeros(n_samples, n_classes).scatter_(1, y.unsqueeze(1), 1.0)
    return {"inputs": x, "targets": y_onehot}


if __name__ == "__main__":
    torch.manual_seed(42)

    print("=" * 60)
    print("STEP 1: Create Base Model")
    print("=" * 60)

    model = create_demo_model()
    params = count_parameters(model)
    print(f"  Architecture: Linear(256->512) -> ReLU -> Linear(512->512) -> ReLU -> Linear(512->10)")
    print(f"  Total parameters: {params['total']:,}")
    print(f"  Trainable: {params['trainable']:,} ({params['trainable_pct']:.1f}%)")

    print("\n" + "=" * 60)
    print("STEP 2: Inject LoRA (rank=8, alpha=16)")
    print("=" * 60)

    lora_layers = inject_lora(model, target_modules=["0", "2"], rank=8, alpha=16)
    params = count_parameters(model)
    print(f"  LoRA injected into: {list(lora_layers.keys())}")
    print(f"  Total parameters: {params['total']:,}")
    print(f"  Trainable (LoRA only): {params['trainable']:,} ({params['trainable_pct']:.2f}%)")
    print(f"  Frozen (base model): {params['frozen']:,}")

    print("\n" + "=" * 60)
    print("STEP 3: Rank Comparison")
    print("=" * 60)

    data = create_demo_data()

    for rank in [2, 4, 8, 16, 32]:
        m = create_demo_model()
        inject_lora(m, target_modules=["0", "2"], rank=rank, alpha=rank * 2)
        p = count_parameters(m)
        losses = train_lora(m, data, epochs=10, lr=1e-3)
        print(
            f"  rank={rank:>2d}: trainable={p['trainable']:>6,} ({p['trainable_pct']:.2f}%)  "
            f"loss: {losses[0]:.4f} -> {losses[-1]:.4f}"
        )

    print("\n" + "=" * 60)
    print("STEP 4: Simulated QLoRA (4-bit quantization)")
    print("=" * 60)

    model_q = create_demo_model()
    inject_lora(model_q, target_modules=["0", "2"], rank=8, alpha=16)

    weight_before = model_q[0].linear.weight.data.clone()
    q_state = quantize_model(model_q)
    weight_after = model_q[0].linear.weight.data

    mse = ((weight_before - weight_after) ** 2).mean().item()
    max_err = (weight_before - weight_after).abs().max().item()
    corr = torch.corrcoef(torch.stack([weight_before.flatten(), weight_after.flatten()]))[0, 1].item()

    print(f"  Quantized layers: {len(q_state)}")
    print(f"  Quantization error (layer 0):")
    print(f"    MSE: {mse:.6f}")
    print(f"    Max absolute error: {max_err:.6f}")
    print(f"    Correlation: {corr:.6f}")

    original_bytes = sum(p.numel() * 4 for p in model_q.parameters())
    quantized_bytes = sum(
        v["quantized"].numel() * 1 + v["scales"].numel() * 4
        for v in q_state.values()
    )
    lora_bytes = sum(
        p.numel() * 4 for p in model_q.parameters() if p.requires_grad
    )

    print(f"\n  Memory comparison:")
    print(f"    Full model (fp32): {original_bytes / 1024:.1f} KB")
    print(f"    Quantized base (simulated NF4): {quantized_bytes / 1024:.1f} KB")
    print(f"    LoRA adapters (fp32): {lora_bytes / 1024:.1f} KB")
    print(f"    QLoRA total: {(quantized_bytes + lora_bytes) / 1024:.1f} KB")

    print("\n" + "=" * 60)
    print("STEP 5: Train with QLoRA")
    print("=" * 60)

    losses = train_lora(model_q, data, epochs=20, lr=1e-3)
    print(f"  Training loss: {losses[0]:.4f} -> {losses[-1]:.4f}")
    print(f"  Epoch losses: ", end="")
    for i in range(0, 20, 5):
        print(f"  e{i}={losses[i]:.4f}", end="")
    print()

    print("\n" + "=" * 60)
    print("STEP 6: Merge and Verify")
    print("=" * 60)

    test_input = torch.randn(10, 256)
    output_before_merge = model_q(test_input).detach()

    merge_lora_weights(model_q)
    params_merged = count_parameters(model_q)

    output_after_merge = model_q(test_input).detach()
    merge_diff = (output_before_merge - output_after_merge).abs().max().item()

    print(f"  Parameters after merge: {params_merged['total']:,}")
    print(f"  LoRA layers remaining: {sum(1 for _, m in model_q.named_modules() if isinstance(m, LinearWithLoRA))}")
    print(f"  Max output difference (should be ~0): {merge_diff:.8f}")

    print("\n" + "=" * 60)
    print("STEP 7: Save and Load Adapter")
    print("=" * 60)

    base_weights = create_demo_model().state_dict()

    model_a = create_demo_model()
    model_a.load_state_dict(base_weights)
    inject_lora(model_a, target_modules=["0", "2"], rank=8, alpha=16)
    train_lora(model_a, data, epochs=10, lr=1e-3)

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
        adapter_path = f.name

    n_saved = save_lora_adapter(model_a, adapter_path)
    adapter_size = os.path.getsize(adapter_path)

    model_b = create_demo_model()
    model_b.load_state_dict(base_weights)
    inject_lora(model_b, target_modules=["0", "2"], rank=8, alpha=16)
    load_lora_adapter(model_b, adapter_path)

    test_in = torch.randn(5, 256)
    out_a = model_a(test_in).detach()
    out_b = model_b(test_in).detach()
    load_diff = (out_a - out_b).abs().max().item()

    print(f"  Adapter layers saved: {n_saved}")
    print(f"  Adapter file size: {adapter_size / 1024:.1f} KB")
    print(f"  Base model size: {sum(p.numel() * 4 for p in model_b.parameters()) / 1024:.1f} KB")
    print(f"  Adapter is {adapter_size / sum(p.numel() * 4 for p in model_b.parameters()) * 100:.1f}% of base model")
    print(f"  Output match after load (max diff): {load_diff:.8f}")

    os.unlink(adapter_path)

    print("\n" + "=" * 60)
    print("STEP 8: Multi-Adapter Serving")
    print("=" * 60)

    base = create_demo_model()

    data_even = {
        "inputs": data["inputs"][::2],
        "targets": data["targets"][::2],
    }
    data_odd = {
        "inputs": data["inputs"][1::2],
        "targets": data["targets"][1::2],
    }

    model_even = create_demo_model()
    model_even.load_state_dict(base.state_dict())
    inject_lora(model_even, target_modules=["0", "2"], rank=8, alpha=16)
    train_lora(model_even, data_even, epochs=15, lr=1e-3)

    model_odd = create_demo_model()
    model_odd.load_state_dict(base.state_dict())
    inject_lora(model_odd, target_modules=["0", "2"], rank=8, alpha=16)
    train_lora(model_odd, data_odd, epochs=15, lr=1e-3)

    test_in = torch.randn(5, 256)
    out_even = model_even(test_in).detach()
    out_odd = model_odd(test_in).detach()
    adapter_diff = (out_even - out_odd).abs().mean().item()

    print(f"  Adapter A trained on {len(data_even['inputs'])} even-indexed samples")
    print(f"  Adapter B trained on {len(data_odd['inputs'])} odd-indexed samples")
    print(f"  Mean output difference between adapters: {adapter_diff:.4f}")
    print(f"  (Different adapters produce different outputs from the same base model)")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("  LoRA: freeze base weights, train low-rank A and B matrices")
    print("  QLoRA: quantize base to 4-bit, LoRA adapters in fp16")
    print("  Typical trainable parameters: 0.5-2% of the base model")
    print("  Adapters are small (10-100MB) and swappable")
    print("  Merged model = original size, no inference overhead")
    print("  Quality: within 1% of full fine-tuning on most benchmarks")
