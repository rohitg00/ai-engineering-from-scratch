import time
import sys


def _sync(backend):
    """Block until queued GPU work finishes, for accurate timing."""
    if backend == "cuda":
        import torch
        torch.cuda.synchronize()
    elif backend == "mps":
        import torch
        torch.mps.synchronize()


def check_gpu():
    try:
        import torch
    except ImportError:
        print("PyTorch not installed. Run: pip install torch")
        return

    print("=== GPU Check ===\n")
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"MPS (Apple Silicon) available: {torch.backends.mps.is_available()}")

    if torch.cuda.is_available():
        backend = "cuda"
    elif torch.backends.mps.is_available():
        backend = "mps"
    else:
        print("\nNo GPU detected. That's fine for most lessons.")
        print("For GPU-heavy lessons, use Google Colab (free).")
        return

    props = None
    if backend == "cuda":
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        props = torch.cuda.get_device_properties(0)
        print(f"Memory: {props.total_memory / 1e9:.1f} GB")
        print(f"Compute capability: {props.major}.{props.minor}")
    else:
        print("GPU: Apple Silicon (MPS) — unified memory shared with system RAM")

    print("\n=== CPU vs GPU Benchmark ===\n")
    size = 4000

    a = torch.randn(size, size)
    b = torch.randn(size, size)

    start = time.time()
    _ = a @ b
    cpu_time = time.time() - start
    print(f"CPU matrix multiply ({size}x{size}): {cpu_time:.3f}s")

    a_gpu = a.to(backend)
    b_gpu = b.to(backend)
    _sync(backend)

    start = time.time()
    _ = a_gpu @ b_gpu
    _sync(backend)
    gpu_time = time.time() - start
    print(f"GPU matrix multiply ({size}x{size}): {gpu_time:.3f}s")
    print(f"Speedup: {cpu_time / gpu_time:.0f}x")

    if props is not None:
        vram_gb = props.total_memory / 1e9
        params_fp16 = vram_gb * 1e9 / 2
        params_billions = params_fp16 / 1e9
        print(f"\nEstimated max model size (fp16): ~{params_billions:.0f}B parameters")
    else:
        print("\nApple Silicon shares memory with the system; max model size depends")
        print("on total RAM, not a dedicated VRAM pool.")


if __name__ == "__main__":
    check_gpu()
