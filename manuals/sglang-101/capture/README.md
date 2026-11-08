# SGLang 101 capture kit

This kit starts the real SGLang 0.5.22 server on Apple silicon through its MLX backend, sends requests to it, runs the official benchmark, and writes what it sees to `out/`. Every listing and every measured number in the manual comes from these files.

## Requirements

- An Apple silicon Mac with macOS 14 or newer.
- SGLang 0.5.22 installed from the tag with the `srt_mps` extra (see the front matter of the manual).
- The `sglang` command on `PATH`, and network access the first time, to download `mlx-community/Qwen3-0.6B-4bit` into the Hugging Face cache.

## Run

```bash
python3 capture/run.py           # record everything into capture/out/
python3 capture/run.py --check   # record into a temporary directory and compare
python3 capture/run.py --only small-pool   # record one server configuration
```

Run the commands with the Python of the SGLang environment. A full run starts four servers and takes 20 to 25 minutes on the recording Mac. `--check` takes the same time. Without SGLang 0.5.22 and MLX on Apple silicon, `--check` prints `skipped` with the reason and exits 0.

## What it records

| Server | Flags added to the common flags | Files |
|---|---|---|
| default | none | `generate.txt`, `cache-experiment.txt`, `bench-random-c1.txt`, `bench-random-c8.txt`, `bench-random-c32.txt`, `bench-shared-prefix.txt`, `metrics.txt` |
| no-radix-cache | `--disable-radix-cache` | `no-radix-cache-bench-shared-prefix.txt`, `no-radix-cache-metrics.txt` |
| no-overlap | `--disable-overlap-schedule` | `no-overlap-bench-random-c8.txt` (the server crashes, see the log) |
| small-pool | `--max-total-tokens 4096` | `small-pool-bench-long-output-c16.txt`, `small-pool-metrics.txt` |

The common flags are `--model-path mlx-community/Qwen3-0.6B-4bit --disable-cuda-graph --enable-cache-report --enable-metrics --mem-fraction-static 0.4`, with `SGLANG_USE_MLX=1`. Each server writes `server-<name>.log`, and `server-<name>.command.txt` holds its exact command. `serve-help.txt` is the output of `sglang serve --help`, and `environment.json` records the versions. The benchmark JSONL files beside each `.txt` hold the per-run records the benchmark writes.

`one_request.py` sends one native `/generate` request and one OpenAI chat request. `cache_experiment.py` sends the same 3,000-token system prompt five times in three forms: unchanged, with a random request id at the start, and with the same id at the end.

## What `--check` compares

Timings change on every run, so the check compares the facts that must stay the same:

- the generated text and the token counts at temperature 0;
- the median cached tokens of each cache case, and whether the two id cases stay under 50 and over 2,900;
- the successful requests and the input and output token totals of each benchmark;
- `bytes_per_slot`, the tree cache line, and any `RuntimeError` line in each server log;
- the set of metric names and the set of `sglang serve` options;
- the server commands.

Absolute home paths in benchmark output are replaced with `~`.

`oom-exploratory.log` was not recorded by this kit. It comes from an exploratory run before the kit existed, with the default memory fraction, and section 3.2 says so.

## The GPU kit

`gpu/` holds a second kit for one NVIDIA GPU. It needs Linux, an NVIDIA driver, `sglang==0.5.22` from PyPI, and the `sglang` command on `PATH`. We recorded it on our own machines, not in CI. Before the first server starts, `run.py` and `sweep.py` download the models and the ShareGPT file that the `random` dataset of `sglang.benchmark.serving` reads, and pass that file with `--dataset-path`. They then set `HF_HUB_OFFLINE=1` for every server and benchmark, so no capture contacts the Hub. After one run, or with the models already in your Hugging Face cache, the kit works with no network if you set `HF_HUB_OFFLINE=1` yourself. Set `SGLANG_KIT_DATASET` to a local copy of `ShareGPT_V3_unfiltered_cleaned_split.json` to skip that download. Choose the hardware profile with `SGLANG_KIT_PROFILE`:

| Profile | Models | Memory fraction | Output |
|---|---|---|---|
| `gb10` | `Qwen/Qwen3-30B-A3B-Instruct-2507`, its FP8 checkpoint, and the EAGLE-3 draft `lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex` | 0.7 | `gpu/out-gb10/`, `gpu/summary/gb10.json` |
| `l4` | `Qwen/Qwen3-8B`, `Qwen/Qwen3-8B-FP8`, and the EAGLE-3 draft `Tengyunw/qwen3_8b_eagle3` | 0.85 | `gpu/out-l4/`, `gpu/summary/l4.json` |

```bash
SGLANG_KIT_PROFILE=gb10 python3 capture/gpu/run.py
SGLANG_KIT_PROFILE=gb10 python3 capture/gpu/run.py --check
python3 capture/gpu/sweep.py --profile gb10 --sweep load --configs default fp8 eagle3 no-cuda-graph
python3 capture/gpu/summarize.py gb10
```

| File | What it does |
|---|---|
| `gpu/run.py` | starts eight servers: default, no CUDA graph, no radix cache, no overlap, a 4,096-token pool, FP8 weights with an FP8 KV cache, EAGLE-3, and deterministic inference. `--only eagle3-no-env` checks the EAGLE-3 context length refusal, and `--only idle-probe` runs `ttft_idle_probe.py` |
| `gpu/offline.py` | downloads the models and the ShareGPT file once, then sets `HF_HUB_OFFLINE=1` and adds `--dataset-path` to every `random` benchmark |
| `gpu/sweep.py` | runs the `load`, `rate`, `prefix`, `waves`, `working-set`, and `mixed` sweeps with seeds 1, 2, and 3 and `--output-details`, into `gpu/runs/<profile>/<sweep>/<config>/`. The `dp2`, `dp2-tokens`, `tp2`, `pd`, and `pd-swap` configs need two GPUs in `CUDA_VISIBLE_DEVICES`, and `vllm` starts vLLM with the same KV pool as SGLang on that card |
| `gpu/miles_grpo.py` | runs a short GRPO job with Miles inside the `radixark/miles` image, plain or with `MILES_TRUE_ON_POLICY=1`, for `MILES_NUM_ROLLOUT` steps (12 by default), with an optional `MILES_SEED` for the train and rollout seeds |
| `gpu/miles_summary.py` | reduces Miles logs to `gpu/summary/miles-gb10.json`: per-step reward, response length, rollout time, the rollout and training log-probability gap, and the phase timers |
| `gpu/summarize.py` | reduces the runs to `gpu/summary/<profile>.json`: the median, lowest, and highest value of each point, goodput, and TTFT and TPOT quantiles |
| `gpu/determinism_probe.py` | sends one prompt at temperature 0 alone five times, then five times inside a batch of 16, and counts the different answers |
| `gpu/structured_probe.py` | sends one question without a schema, then with a new JSON schema, the same schema twice more, and a second new schema |
| `gpu/incidents/` | the evidence of the incidents the manual tells: the toolchain failures on the L4, the thermal throttle, the memory guard on the GB10, and the driver memory messages |

Before each sweep run, `gpu/sweep.py` waits up to 900 s for the GPU to cool to 65 C. During the run it samples `nvidia-smi` once a second into a `.gpu.csv` file beside the run. `gpu/summarize.py` adds the median SM clock, the highest temperature, and the share of samples with a thermal slowdown bit to each point. Goodput counts the requests with a first token under 1 s and a mean time per token under 100 ms.

The `vllm` config needs vLLM in its own environment, named by `VLLM_BIN`. It pins `--num-gpu-blocks-override` to the pool that SGLang got on the same card, 1,506 blocks of 16 tokens on a clean L4, and caps `--max-model-len` at 8,192, because vLLM refuses to start when its pool cannot hold one request at the full context. It also sets `VLLM_USE_FLASHINFER_SAMPLER=0`. On our L4 the FlashInfer 0.7.0.post1 sampler that `pip install vllm` brought did not compile with the CUDA 13.4 compiler of the same install, and the benchmark samples greedily.

The EAGLE-3 server of the `gb10` profile needs `SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1`, because the draft declares a 2,048-token context and the target declares 262,144. The kit sets it and writes it into `server-eagle3.command.txt`.

`--check` of the GPU kit compares the token and request counts of each benchmark, the generated token counts, whether each structured answer is valid, the number of different answers alone at temperature 0, the metric names, the server commands, and the `max_running_requests` line of each server log. Without Linux, CUDA, and enough GPU memory for the profile, it prints `skipped` with the reason and exits 0.
