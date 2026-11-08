# vLLM 101

vLLM 0.31.0, from your first server to a deployment you can size, tune, and debug, with a measured answer for each decision. The documentation tells you what each flag does. This manual tells you which flags matter for your GPU and your traffic, and what happened when we changed them. The web edition is at [aiengineeringfromscratch.com/manual-vllm-101.html](https://aiengineeringfromscratch.com/manual-vllm-101.html), and each release of the course attaches the PDF as `aiefs-manual-vllm-101.pdf`.

## What is in it

- 44 sections in 8 parts, then eight reference sections. Parts 1 to 7 follow the order of your work. You start a server, size it, tune it for your traffic, and add speed features. Then you measure it, scale it out, and operate and debug it. Part 8 explains how vLLM works inside, for when a default surprises you.
- Each page answers one question and ends with a check that proves the change worked.
- Each measured number names its machine, its date, its clock, and its seed count. Pages that we could not measure say so.
- A cover plate and 26 figures drawn with the figure kit, with charts plotted from the GPU runs.
- A reference part with the flag table, the metrics, and an index of the GitHub issues the manual cites. It also has the version pins, a glossary, the sources, and the lab notes with the full tables.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/gpu/summary/` | the summaries of the GPU sweeps that the tables and charts read: `l4.json`, `l4-gpu1.json`, `gb10.json` |
| `capture/gpu/out-l4/`, `capture/gpu/out-gb10/` | the server logs and the live checks that the listings are cut from |
| `capture/gpu/incidents/` | the logs of the failures that the troubleshooting pages show |

## The pin

| Item | Value |
|---|---|
| vLLM | 0.31.0, commit `db9527a46873454610df6dbedf79a36d6bf1a7f6`, released 2026-10-05 |
| PyTorch that the CUDA wheel requires | 2.13.0 |
| Verified | 2026-10-22 |

## The recording hosts

| Item | NVIDIA L4 | DGX Spark |
|---|---|---|
| GPU | NVIDIA L4, compute capability 8.9, 24 GB | NVIDIA GB10, compute capability 12.1, 128 GB of unified memory |
| CPU architecture | x86_64 | aarch64 |
| Driver | 615.71.09 | 580.159.03 |
| How vLLM ran | the pip wheel in a virtual environment | the image `vllm/vllm-openai:v0.31.0` |
| Model | `Qwen/Qwen3-8B`, its FP8 checkpoint, and the EAGLE3 draft `Tengyunw/qwen3_8b_eagle3` | `Qwen/Qwen3-30B-A3B-Instruct-2507` |

The L4 clock changed with its temperature and with other work on the node, so the front matter splits the L4 runs into four sessions. Compare two L4 numbers only inside one session.

## How to read it

Start with the front matter, "How to read this manual". It gives five commands that start a server, then the order of the parts and the four L4 sessions. Read Part 1 once and completely. After that, go to the page that answers your question. Use [the lab notes](https://aiengineeringfromscratch.com/manual-vllm-101.html#s-ref-lab-notes) to check a number or to repeat a run.

## Run the sweeps again

The GPU runs come from the sweep tool of SGLang 101, `manuals/sglang-101/capture/gpu/sweep.py`. It has a profile for each machine and a vLLM configuration for each table. It needs an NVIDIA GPU, vLLM 0.31.0, and the SGLang 0.5.22 benchmark client. [The lab notes](https://aiengineeringfromscratch.com/manual-vllm-101.html#s-ref-lab-notes) give the seeds, the server settings, the pool sizes, and the clock rule. [The benchmark page](https://aiengineeringfromscratch.com/manual-vllm-101.html#s-benchmark-your-server-in-15-minutes) prints the full client command.

This manual has no offline capture check. The stored logs and summaries in `capture/gpu/` are the record, and the audit checks every listing against them.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/vllm-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual vllm-101
```

The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
