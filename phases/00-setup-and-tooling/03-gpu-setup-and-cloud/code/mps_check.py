import torch
import time
import platform
import os

def check_mps():
    print("====MPS Check====\n")
    print(f"pytorch_version: {torch.__version__}")
    print(f"mps_available: {torch.backends.mps.is_available()}")

    if not torch.backends.mps.is_available():
        print("\nNo MPS detected. That's fine for most lessons.")
        print("For GPU-heavy lessons, use Google Colab (free).")
        return

    print(f"MPS device: Apple {platform.processor()} (MPS backend)")


    print("\n=== CPU vs MPS Benchmark ===\n")
    size = 4000
    a = torch.randn(size, size)
    b = torch.randn(size, size)


    start = time.time()
    _ = a @ b
    cpu_time = time.time() - start
    print(f"CPU matrix multiply ({size}x{size}): {cpu_time:.3f}s")

    if torch.backends.mps.is_available():
        a_mps = a.to("mps")
        b_mps = b.to("mps")
        torch.mps.synchronize()

        start = time.time()
        _ = a_mps @ b_mps
        torch.mps.synchronize()
        mps_time = time.time() - start
        print(f"MPS matrix multiply ({size}x{size}): {mps_time:.3f}s")
        print(f"Speedup: {cpu_time / mps_time:.0f}x")

        total_ram = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
        vram_gb = total_ram / 1e9
        params_fp16 = vram_gb * 1e9 / 2
        params_billions = params_fp16 / 1e9
        print(f"\nEstimated max model size (fp16): ~{params_billions:.0f}B parameters")


if __name__ == "__main__":
    check_mps()