import time
import torch
import torch.nn as nn


def measure_latency(model, input_shape, device="cpu", warmup=5, iters=20):
    model = model.to(device).eval()
    x = torch.randn(input_shape, device=device)
    with torch.no_grad():
        for _ in range(warmup):
            model(x)
        if device == "cuda":
            torch.cuda.synchronize()
        times = []
        for _ in range(iters):
            if device == "cuda":
                torch.cuda.synchronize()
            t0 = time.perf_counter()
            model(x)
            if device == "cuda":
                torch.cuda.synchronize()
            times.append((time.perf_counter() - t0) * 1000)
    times.sort()
    return {
        "p50_ms": times[len(times) // 2],
        "p95_ms": times[int(len(times) * 0.95)],
        "p99_ms": times[-1],
        "mean_ms": sum(times) / len(times),
    }


def parameter_count(model):
    return sum(p.numel() for p in model.parameters())


def flops_estimate(model, input_shape):
    total = [0]

    def conv_hook(m, inp, out):
        c_out, c_in_per_group, kh, kw = m.weight.shape
        h, w = out.shape[-2:]
        # Groups account for depthwise / grouped convs: each output channel
        # only touches c_in_per_group inputs, not all c_in.
        total[0] += 2 * c_in_per_group * c_out * kh * kw * h * w

    def linear_hook(m, inp, out):
        total[0] += 2 * m.in_features * m.out_features

    hooks = []
    for m in model.modules():
        if isinstance(m, nn.Conv2d):
            hooks.append(m.register_forward_hook(conv_hook))
        elif isinstance(m, nn.Linear):
            hooks.append(m.register_forward_hook(linear_hook))

    model.eval()
    with torch.no_grad():
        model(torch.randn(input_shape))
    for h in hooks:
        h.remove()
    return total[0]


def compare_backbones(resolution=160):
    from torchvision.models import (
        mobilenet_v3_small, resnet18, efficientnet_v2_s, convnext_tiny,
    )
    candidates = [
        ("mobilenet_v3_small", mobilenet_v3_small(weights=None, num_classes=10)),
        ("resnet18", resnet18(weights=None, num_classes=10)),
        ("efficientnet_v2_s", efficientnet_v2_s(weights=None, num_classes=10)),
        ("convnext_tiny", convnext_tiny(weights=None, num_classes=10)),
    ]
    shape = (1, 3, resolution, resolution)
    results = []
    for name, model in candidates:
        params = parameter_count(model)
        flops = flops_estimate(model, shape)
        lat = measure_latency(model, shape, device="cpu")
        results.append({
            "model": name, "params_m": params / 1e6,
            "gflops": flops / 1e9,
            "p50_ms": lat["p50_ms"],
            "p95_ms": lat["p95_ms"],
        })
    return results


def main():
    torch.manual_seed(0)
    print("Comparing edge backbones on CPU at 160x160:\n")
    header = f"{'model':22s} {'params(M)':>10s} {'GFLOPs':>8s} {'p50(ms)':>9s} {'p95(ms)':>9s}"
    print(header)
    print("-" * len(header))
    for r in compare_backbones(resolution=160):
        print(f"{r['model']:22s} {r['params_m']:>10.2f} {r['gflops']:>8.2f} "
              f"{r['p50_ms']:>9.1f} {r['p95_ms']:>9.1f}")


if __name__ == "__main__":
    main()
