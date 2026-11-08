# SGLang 101

SGLang 0.5.22, from one request on a laptop to a fleet of GPUs, with the judgment that the flag list leaves out. The documentation tells you what each of the 535 options of `sglang serve` does. This manual tells you which ones matter, why each feature exists, which defaults assume a machine you do not have, and what we measured when we changed them. The web edition is at [aiengineeringfromscratch.com/manual-sglang-101.html](https://aiengineeringfromscratch.com/manual-sglang-101.html), and each release of the course attaches the PDF as `aiefs-manual-sglang-101.pdf`.

## What is in it

- 29 sections in 7 parts, then seven reference sections. Part 1 installs SGLang, checks the server, and follows one request through it. Part 2 follows one request through the three processes and the scheduler. Part 3 is the KV cache. Part 4 makes each forward pass fast, and Part 5 measures a server. Part 6 spreads one model over many GPUs, and Part 7 operates SGLang and closes with SGLang as the rollout engine of Miles.
- Every section tells one story: the cost, the obvious fix and why it fails, what SGLang does, what to measure, our position on the default, and a real incident with its link.
- Every number carries one of four labels: we measured, the code, a field report from engineers outside the SGLang team, or a team or vendor claim.
- A cover plate, 63 figures drawn with the figure kit from the captures and the code, and charts plotted from the GPU runs.
- A capture kit in `capture/` that starts the real server on Apple silicon through MLX, sends requests, runs the official benchmark, and writes what it sees to `capture/out/`.
- A GPU kit in `capture/gpu/` that runs eight server configurations and three-seed benchmark sweeps on one NVIDIA GPU, with the GPU clock and temperature of every run.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/` | the kit and its recorded output in `capture/out/` |
| `capture/gpu/` | the GPU kit, its output in `capture/gpu/out-gb10/`, and the chart data in `capture/gpu/summary/` |

## The pin

| Item | Value |
|---|---|
| SGLang | 0.5.22, tag `v0.5.22`, commit `baa9befa381511cd4d56f83980951e5a45fffc6d`, tagged 2026-10-13 |
| Miles | v0.1.2, commit `a22fd824`, for section 7.2 only |
| Verified | 2026-10-16 |

## The recording host

| Item | Version |
|---|---|
| Host | macOS 26.2 on Apple silicon, arm64 |
| SGLang | 0.5.22 from the tag with the `srt_mps` extra |
| Frameworks | PyTorch 2.13.0, MLX 0.32.4, Python 3.12.12 |
| Model | `mlx-community/Qwen3-0.6B-4bit` |

The GPU runs were recorded on an NVIDIA DGX Spark with one GB10 (compute capability 12.1, aarch64), SGLang 0.5.22 from PyPI, PyTorch 2.14.1+cu130, and CUDA 13.0, with `Qwen/Qwen3-30B-A3B-Instruct-2507` and its FP8 checkpoint. `capture/README.md` describes how to run the GPU kit.

## Run the kit

```bash
cd manuals/sglang-101
python3 capture/run.py --check
```

Run it with the Python of the SGLang environment. The check starts the same four servers again, records into a temporary directory, and compares the facts that must not change: the text at temperature 0, token and cached-token counts, request counts, the KV bytes per token, the metric names, and the option list. Without SGLang 0.5.22 and MLX on Apple silicon, the check prints `skipped` with the reason and exits 0. A full run takes 20 to 25 minutes, and `capture/README.md` lists every file it writes.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/sglang-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual sglang-101
```

On a host with the kit installed, the audit runs the capture check, which takes about 25 minutes. Pass `--skip-capture` to skip it. The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
