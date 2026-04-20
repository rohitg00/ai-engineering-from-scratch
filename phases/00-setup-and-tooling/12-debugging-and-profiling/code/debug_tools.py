import sys
import time
import tracemalloc
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


def debug_print(name, tensor):
    print(f"  {name}: shape={tensor.shape}, dtype={tensor.dtype}, "
          f"device={tensor.device}, "
          f"min={tensor.min().item():.4f}, max={tensor.max().item():.4f}, "
          f"mean={tensor.mean().item():.4f}, "
          f"has_nan={tensor.isnan().any().item()}")


class Timer:
    def __init__(self, name=""):
        self.name = name
        self.elapsed = 0.0

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed = time.perf_counter() - self.start
        print(f"  [{self.name}] {self.elapsed:.4f}s")


def check_shapes(model, sample_input):
    print(f"  Input: {sample_input.shape}")
    hooks = []

    def make_hook(name):
        def hook(module, inp, out):
            in_shape = inp[0].shape if isinstance(inp, tuple) else inp.shape
            out_shape = out.shape if hasattr(out, "shape") else type(out).__name__
            print(f"    {name}: {in_shape} -> {out_shape}")
        return hook

    for name, module in model.named_modules():
        if name:
            hooks.append(module.register_forward_hook(make_hook(name)))

    with torch.no_grad():
        model(sample_input)

    for h in hooks:
        h.remove()


def detect_nan(model, loss, step):
    if torch.isnan(loss):
        print(f"  NaN loss detected at step {step}")
        for name, param in model.named_parameters():
            if param.grad is not None:
                if torch.isnan(param.grad).any():
                    print(f"    NaN gradient in {name}")
                if torch.isinf(param.grad).any():
                    print(f"    Inf gradient in {name}")
        return True
    return False


def check_devices(model, *tensors):
    model_device = next(model.parameters()).device
    print(f"  Model device: {model_device}")
    for i, t in enumerate(tensors):
        status = "OK" if t.device == model_device else "MISMATCH"
        print(f"    Tensor {i}: {t.device} [{status}]")


def check_gradient_health(model):
    total_norm = 0.0
    for name, param in model.named_parameters():
        if param.grad is not None:
            grad_norm = param.grad.data.norm(2).item()
            total_norm += grad_norm ** 2
            if grad_norm > 100:
                print(f"    WARNING: large gradient in {name}: {grad_norm:.2f}")
            if grad_norm == 0:
                print(f"    WARNING: zero gradient in {name}")
    total_norm = total_norm ** 0.5
    print(f"  Total gradient norm: {total_norm:.4f}")
    return total_norm


def demo_print_debugging():
    print("\n--- 1. Print Debugging for Tensors ---")
    x = torch.randn(32, 784)
    debug_print("input batch", x)

    w = torch.randn(784, 128)
    out = x @ w
    debug_print("after matmul", out)

    with_nan = out.clone()
    with_nan[0, 0] = float("nan")
    debug_print("with injected NaN", with_nan)


def demo_timing():
    print("\n--- 2. Timing Code Sections ---")

    with Timer("matrix multiply 1000x1000"):
        a = torch.randn(1000, 1000)
        b = torch.randn(1000, 1000)
        _ = a @ b

    with Timer("matrix multiply 5000x5000"):
        a = torch.randn(5000, 5000)
        b = torch.randn(5000, 5000)
        _ = a @ b


def demo_memory_tracking():
    print("\n--- 3. Memory Tracking (tracemalloc) ---")
    tracemalloc.start()

    data = [torch.randn(100, 100) for _ in range(100)]
    more_data = torch.randn(1000, 1000)

    snapshot = tracemalloc.take_snapshot()
    top_stats = snapshot.statistics("lineno")
    print("  Top 5 memory allocations:")
    for stat in top_stats[:5]:
        print(f"    {stat}")

    del data, more_data
    tracemalloc.stop()


def demo_shape_checking():
    print("\n--- 4. Shape Checking Through Model ---")

    model = nn.Sequential(
        nn.Linear(784, 256),
        nn.ReLU(),
        nn.Linear(256, 64),
        nn.ReLU(),
        nn.Linear(64, 10),
    )

    sample = torch.randn(4, 784)
    check_shapes(model, sample)


def demo_nan_detection():
    print("\n--- 5. NaN Detection ---")

    model = nn.Sequential(
        nn.Linear(784, 256),
        nn.ReLU(),
        nn.Linear(256, 10),
    )

    x = torch.randn(4, 784)
    target = torch.randint(0, 10, (4,))
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

    optimizer.zero_grad()
    output = model(x)
    loss = criterion(output, target)
    loss.backward()
    print(f"  Normal loss: {loss.item():.4f}")
    nan_found = detect_nan(model, loss, step=0)
    print(f"  NaN detected: {nan_found}")

    fake_nan_loss = torch.tensor(float("nan"))
    print(f"  Simulated NaN loss: {fake_nan_loss.item()}")
    nan_found = detect_nan(model, fake_nan_loss, step=99)
    print(f"  NaN detected: {nan_found}")


def demo_device_checking():
    print("\n--- 6. Device Checking ---")

    model = nn.Linear(10, 5)
    t1 = torch.randn(4, 10)
    t2 = torch.randn(4, 10)

    check_devices(model, t1, t2)

    if torch.cuda.is_available():
        model_gpu = model.cuda()
        t_cpu = torch.randn(4, 10)
        t_gpu = torch.randn(4, 10).cuda()
        print("  With mixed devices:")
        check_devices(model_gpu, t_cpu, t_gpu)


def demo_gradient_health():
    print("\n--- 7. Gradient Health Check ---")

    model = nn.Sequential(
        nn.Linear(784, 256),
        nn.ReLU(),
        nn.Linear(256, 10),
    )

    x = torch.randn(4, 784)
    target = torch.randint(0, 10, (4,))
    criterion = nn.CrossEntropyLoss()

    output = model(x)
    loss = criterion(output, target)
    loss.backward()
    check_gradient_health(model)


def demo_gpu_memory():
    print("\n--- 8. GPU Memory Summary ---")

    if not torch.cuda.is_available():
        print("  No GPU available. Skipping GPU memory demo.")
        print("  On a GPU machine, torch.cuda.memory_summary() shows:")
        print("    - Allocated memory per block size")
        print("    - Cached (reserved) memory")
        print("    - Peak memory usage")
        return

    print(f"  GPU: {torch.cuda.get_device_name(0)}")
    print(f"  Allocated: {torch.cuda.memory_allocated() / 1e6:.1f} MB")
    print(f"  Cached: {torch.cuda.memory_reserved() / 1e6:.1f} MB")

    large_tensor = torch.randn(10000, 10000, device="cuda")
    print(f"  After 10k x 10k tensor:")
    print(f"    Allocated: {torch.cuda.memory_allocated() / 1e6:.1f} MB")

    del large_tensor
    torch.cuda.empty_cache()
    print(f"  After cleanup:")
    print(f"    Allocated: {torch.cuda.memory_allocated() / 1e6:.1f} MB")


def demo_logging():
    print("\n--- 9. Structured Logging ---")

    logger.info("Training started: lr=0.001, batch_size=32, epochs=10")
    logger.info("Step 100: loss=2.3026, accuracy=0.10")
    logger.warning("Loss spike detected: 15.7 at step 450")
    logger.info("Step 1000: loss=0.4512, accuracy=0.87")
    logger.info("Training complete: best_loss=0.3201")


def demo_conditional_breakpoint():
    print("\n--- 10. Conditional Breakpoint Pattern ---")
    print("  In real code, use this pattern:")
    print()
    print("    for step in range(num_steps):")
    print("        loss = train_step(model, batch)")
    print("        if loss.item() > 10 or torch.isnan(loss):")
    print("            breakpoint()  # drops into pdb")
    print()
    print("  Useful pdb commands once inside:")
    print("    p tensor.shape       # print shape")
    print("    p tensor.device      # check device")
    print("    p tensor.grad        # inspect gradients")
    print("    p tensor.isnan().sum()  # count NaNs")
    print("    c                    # continue execution")
    print("    q                    # quit debugger")


def main():
    print("=" * 60)
    print("  AI Debugging and Profiling Toolkit")
    print("  Phase 0, Lesson 12")
    print("=" * 60)

    if not HAS_TORCH:
        print("\nPyTorch not installed. Install with:")
        print("  uv pip install torch")
        print("\nRunning non-PyTorch demos only...\n")
        demo_memory_tracking()
        demo_logging()
        return 1

    demo_print_debugging()
    demo_timing()
    demo_memory_tracking()
    demo_shape_checking()
    demo_nan_detection()
    demo_device_checking()
    demo_gradient_health()
    demo_gpu_memory()
    demo_logging()
    demo_conditional_breakpoint()

    print("\n" + "=" * 60)
    print("  All demos complete.")
    print("  Next: introduce bugs intentionally and practice catching them.")
    print("=" * 60 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
