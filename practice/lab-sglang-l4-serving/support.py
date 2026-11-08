SOURCE = "manuals/sglang-101/capture/gpu/summary/l4.json"

GPU = "NVIDIA L4"
MODELS = {"default": "Qwen/Qwen3-8B", "fp8": "Qwen/Qwen3-8B-FP8 with --kv-cache-dtype fp8_e4m3"}

SLO = {"ttft_ms": 1000.0, "tpot_ms": 100.0}

KV_POOL_TOKENS = {"default": 24094, "fp8": 142369}

LOAD = {
    "default": [
        {"concurrency": 1, "output_throughput": 13.42, "median_ttft_ms": 189.16, "p99_ttft_ms": 696.1, "median_tpot_ms": 60.16, "goodput_rps": 0.09},
        {"concurrency": 2, "output_throughput": 31.2, "median_ttft_ms": 115.43, "p99_ttft_ms": 133.75, "median_tpot_ms": 63.66, "goodput_rps": 0.24},
        {"concurrency": 4, "output_throughput": 61.54, "median_ttft_ms": 137.53, "p99_ttft_ms": 139.33, "median_tpot_ms": 64.36, "goodput_rps": 0.48},
        {"concurrency": 8, "output_throughput": 112.62, "median_ttft_ms": 170.43, "p99_ttft_ms": 1275.48, "median_tpot_ms": 66.01, "goodput_rps": 0.63},
        {"concurrency": 16, "output_throughput": 201.09, "median_ttft_ms": 211.78, "p99_ttft_ms": 2461.58, "median_tpot_ms": 70.11, "goodput_rps": 0.98},
        {"concurrency": 32, "output_throughput": 270.11, "median_ttft_ms": 2969.61, "p99_ttft_ms": 4901.04, "median_tpot_ms": 96.18, "goodput_rps": 0.0},
        {"concurrency": 64, "output_throughput": 250.85, "median_ttft_ms": 18348.57, "p99_ttft_ms": 33395.92, "median_tpot_ms": 107.42, "goodput_rps": 0.0},
    ],
    "fp8": [
        {"concurrency": 1, "output_throughput": 24.53, "median_ttft_ms": 140.72, "p99_ttft_ms": 255.79, "median_tpot_ms": 39.66, "goodput_rps": 0.19},
        {"concurrency": 2, "output_throughput": 49.96, "median_ttft_ms": 107.51, "p99_ttft_ms": 110.09, "median_tpot_ms": 39.48, "goodput_rps": 0.39},
        {"concurrency": 4, "output_throughput": 98.8, "median_ttft_ms": 101.18, "p99_ttft_ms": 102.56, "median_tpot_ms": 39.96, "goodput_rps": 0.77},
        {"concurrency": 8, "output_throughput": 177.43, "median_ttft_ms": 128.01, "p99_ttft_ms": 1055.25, "median_tpot_ms": 40.93, "goodput_rps": 1.17},
        {"concurrency": 16, "output_throughput": 313.92, "median_ttft_ms": 147.52, "p99_ttft_ms": 2019.22, "median_tpot_ms": 43.11, "goodput_rps": 1.49},
        {"concurrency": 32, "output_throughput": 507.2, "median_ttft_ms": 199.09, "p99_ttft_ms": 3946.51, "median_tpot_ms": 47.73, "goodput_rps": 2.23},
        {"concurrency": 64, "output_throughput": 735.91, "median_ttft_ms": 296.42, "p99_ttft_ms": 7903.44, "median_tpot_ms": 56.31, "goodput_rps": 2.87},
    ],
}

MIXED = {
    "default": [
        {"rate": 0.5, "output_throughput": {"median": 44.09, "min": 44.06, "max": 44.88}, "median_ttft_ms": {"median": 35999.18, "min": 9752.1, "max": 39340.7}, "p99_itl_ms": {"median": 2578.99, "min": 2480.05, "max": 2863.96}},
        {"rate": 1.0, "output_throughput": {"median": 45.44, "min": 45.01, "max": 46.71}, "median_ttft_ms": {"median": 52367.56, "min": 29402.36, "max": 56992.61}, "p99_itl_ms": {"median": 2751.61, "min": 2409.74, "max": 2985.09}},
        {"rate": 2.0, "output_throughput": {"median": 46.16, "min": 44.5, "max": 47.54}, "median_ttft_ms": {"median": 59833.66, "min": 39476.3, "max": 67280.64}, "p99_itl_ms": {"median": 2512.47, "min": 2332.1, "max": 3007.5}},
    ],
    "chunk-1024": [
        {"rate": 0.5, "output_throughput": {"median": 43.26, "min": 43.11, "max": 43.32}, "median_ttft_ms": {"median": 37411.99, "min": 11475.16, "max": 41100.82}, "p99_itl_ms": {"median": 2922.44, "min": 2766.91, "max": 3066.65}},
        {"rate": 1.0, "output_throughput": {"median": 44.78, "min": 43.92, "max": 45.46}, "median_ttft_ms": {"median": 52859.49, "min": 29777.7, "max": 59333.3}, "p99_itl_ms": {"median": 2843.09, "min": 2592.19, "max": 3096.66}},
        {"rate": 2.0, "output_throughput": {"median": 43.97, "min": 43.72, "max": 45.72}, "median_ttft_ms": {"median": 62469.02, "min": 41871.45, "max": 69443.92}, "p99_itl_ms": {"median": 2929.75, "min": 2454.91, "max": 3183.3}},
    ],
}


def column(rows, key):
    return [row[key] for row in rows]
