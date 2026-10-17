# How to read this manual

> The SGLang documentation tells you what each flag does, and this manual tells you which ones matter, why they exist, and what we measured when we changed them.

`sglang serve --help` lists 535 options at version 0.5.22. Its documentation describes each of them. That list answers the question "what does this flag do".

It does not answer the questions that cost money. Which three settings matter on your first day? Which defaults assume a machine you do not have? Which published benchmark describes your workload?

This manual answers those questions. Every feature in SGLang is a receipt for something that cost too much. The radix cache is the receipt for computing the same system prompt twice. The overlap scheduler is the receipt for a GPU that waits while Python plans the next batch. Prefill and decode disaggregation is the receipt for long prompts that stall every other user.

Each section tells one of those stories. It gives the cost, the obvious fix and why it fails, and what SGLang does. Then it says what to measure and when to change the default.

## Who this manual is for

You have called a model through an API, and now you want to serve an open model yourself. You know what a token and a GPU are. You have not read the scheduler or the cache of a serving engine. You want to know which settings matter before you pay for them.

After the last part, you can:

- Start SGLang, send a request, and read every line the scheduler logs about it.
- Compute the KV cache cost of a model, size the pool on purpose, and explain why a server runs out of memory.
- Write prompts that hit the prefix cache, and prove the hit rate with `cached_tokens` and `/metrics`.
- Benchmark a server, find the concurrency knee, and report TTFT, TPOT, and throughput together.
- Choose between tensor, data, and expert parallelism and prefill-decode disaggregation from measurements.
- Judge a published SGLang benchmark: its version, its workload, and the mechanism that explains its result.

Seven lessons go deeper into the ideas this manual applies. [The serving internals lesson](phases/17-infrastructure-and-production/04-vllm-serving-internals) builds paged attention and continuous batching. [The goodput lesson](phases/17-infrastructure-and-production/08-inference-metrics-goodput) defines the metrics. [The speculative decoding lesson](phases/17-infrastructure-and-production/05-eagle3-speculative-decoding) builds EAGLE-3, and [the quantization lesson](phases/17-infrastructure-and-production/09-production-quantization) covers the formats. [The serving selection lesson](phases/17-infrastructure-and-production/28-self-hosted-serving-selection), [the inference optimization lesson](phases/10-llms-from-scratch/12-inference-optimization), and [the prompt caching lesson](phases/11-llm-engineering/15-prompt-caching) complete the set. This manual stays with SGLang.

## How it was made

The manual pins SGLang 0.5.22, tagged on 2026-10-13 at commit `baa9befa381511cd4d56f83980951e5a45fffc6d`. The facts were verified on 2026-10-16. SGLang releases about every three weeks, and several defaults changed between 0.5.20 and 0.5.22. A recipe written for an older version can be wrong at this one, and the sections say where.

Facts come from seven sources, ranked by authority. When two of them disagree, the higher one wins and the text says so.

| Rank | Source | What the manual takes from it | Cited as |
|---|---|---|---|
| 1 | the SGLang source at the tag, `baa9befa` | every default and every mechanism | the file list in the Sources line of each section |
| 2 | the captured runs in `capture/out/` and `capture/gpu/` | every listing and every number marked as measured | the capture file name |
| 3 | SGLang issues and pull requests | incidents and the design history of each feature | `issue` and its number |
| 4 | papers | the original design of RadixAttention and the methods SGLang implements | `paper` and a title |
| 5 | the SGLang documentation at the tag | documented behaviour, checked against the code | `docs` and a heading |
| 6 | independent field reports | GPU setups that we could not run, such as many GPUs in one server | `field`, the author, and the month |
| 7 | SGLang team and vendor reports | claims, always labeled as the claim of the author | `team` or the vendor, and the month |

The documentation ranks below the code on purpose. At 0.5.22 the documentation still lists two attention backends that the code removed. It also gives other HiCache prefetch timeouts than the code uses. When we say the default, we mean the value the code sets.

## Four kinds of evidence

Every number in this manual carries one of four labels in the text.

**We measured:** the number comes from `capture/out/` or `capture/gpu/`, recorded on the machines in the tables below. You can run the kit and get the same facts.

**The code:** the default or the mechanism comes from the SGLang source at the tag. The Sources line names the files.

**A field report:** an engineer or a company outside the SGLang team ran SGLang and published the result. The text names them, the month, the version when they stated it, and what they tuned.

**The team reports** or **the vendor reports:** the SGLang team, RadixArk, or a hardware vendor published the number. We repeat it as their claim and set it against independent results where they exist.

The GPU kit ran on one NVIDIA GB10. CUDA graphs, FP8, EAGLE-3, deterministic inference, and the cost of MoE decode on one GPU now carry the label we measured. DeepEP and prefill-decode disaggregation need many GPUs. For those sections, the code and the field reports carry the argument, and the label says so.

## The capture kit

The capture kit in `capture/` starts the real SGLang server on Apple silicon through its MLX backend. It sends requests, runs the official benchmark, and writes what it sees to `capture/out/`. `python3 capture/run.py` records everything. `python3 capture/run.py --check` records again into a temporary directory and compares the facts that must not change. Those facts are the generated text at temperature 0, the token and cached-token counts, and the request counts. The KV bytes per token and the metric names are facts too.

Timings change on every run, so the check does not compare them.

The kit needs SGLang 0.5.22 with its MLX extra on Apple silicon, so it cannot run in the repository CI. Without that setup, `--check` prints `skipped` with the reason and exits 0. Every file in `capture/out/` was recorded on one machine:

| Item | Value |
|---|---|
| Host | an Apple silicon laptop, macOS 26.2, build 25C56, arm64 |
| SGLang | 0.5.22, installed from the tag with the `srt_mps` extra |
| Frameworks | PyTorch 2.13.0, MLX 0.32.4, Python 3.12.12 |
| Model | `mlx-community/Qwen3-0.6B-4bit` |
| Server flags | `SGLANG_USE_MLX=1`, `--disable-cuda-graph`, `--enable-cache-report`, `--enable-metrics`, `--mem-fraction-static 0.4` |
| Recorded on | 2026-10-16 |

The kit starts four servers. They are the default configuration, one without the radix cache, one without the overlap scheduler, and one with a 4,096-token pool. The server without the overlap scheduler crashed on its first real batch at 0.5.22, and the kit records that crash on purpose. [Section 2.4](#s-the-overlap-scheduler) reads it.

## The GPU kit

The GPU kit in `capture/gpu/` runs the same idea on an NVIDIA GPU. `capture/gpu/run.py` starts eight server configurations and writes `capture/gpu/out-gb10/`. `capture/gpu/sweep.py` repeats each benchmark point with three seeds and records the GPU clock and temperature of every run. `capture/gpu/summarize.py` writes `capture/gpu/summary/gb10.json`, and every chart in this manual reads that file.

Every file in `capture/gpu/out-gb10/` and `capture/gpu/summary/gb10.json` was recorded on one machine:

| Item | Value |
|---|---|
| Host | an NVIDIA DGX Spark, Ubuntu 24.04, aarch64 |
| GPU | NVIDIA GB10, compute capability 12.1, 121.7 GiB of memory shared with the CPU |
| SGLang | 0.5.22 from PyPI, sglang-kernel 0.4.9, flashinfer 0.7.1 |
| Frameworks | PyTorch 2.14.1+cu130, CUDA 13.0, driver 580.159.03, Python 3.12.3 |
| Models | `Qwen/Qwen3-30B-A3B-Instruct-2507`, its FP8 checkpoint, and the EAGLE-3 draft `lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex` |
| Server flags | `--enable-cache-report`, `--enable-metrics`, `--mem-fraction-static 0.7` |
| Recorded on | 2026-10-16 |

The kit also has an `l4` profile for Qwen3-8B on an NVIDIA L4. Our first L4 sweep ran hot and throttled, and [section 5.1](#s-sglang-benchmark-serving) tells it as an incident. We then ran the L4 again with a cool-down to 72°C before each run. [Section 4.3](#s-quantization), [section 4.4](#s-speculative-decoding), and section 5.1 use those runs, and section 5.1 shows that the cooled card still lowered its clock under long load.

## Conventions

`sglang serve` starts the server in every command. The older `python -m sglang.launch_server` still works at 0.5.22 and prints a deprecation warning. Ports are the default `30000`. `~` stands for the home directory in recorded output.

Citations name a place. `{{issue #35129}}` names an issue in the SGLang repository. `{{field Jarvislabs 2026-05}}` names a field report by its author and month, and the text links it. The SGLang source files a section was written from are listed once, in the Sources line at its end. A listing copies lines from a capture file unchanged, and a `…` marks a cut that the note explains.

Figures animate on the web, where a Replay button runs the steps again. Print and reduced motion show the final frame.

## A first run

You need an Apple silicon Mac with macOS 14 or newer and about 8 GB of free disk. Install SGLang from the tag with the MLX extra, as its Apple silicon page describes:

```bash
git clone --branch v0.5.22 --depth 1 https://github.com/sgl-project/sglang.git
cd sglang
uv venv -p 3.12 .venv && source .venv/bin/activate
cp python/pyproject_other.toml python/pyproject.toml
uv pip install -e "python[srt_mps]"
```

On the capture Mac, the install took 3 minutes and 15 seconds. Start a server in one terminal:

```bash
SGLANG_USE_MLX=1 sglang serve --model-path mlx-community/Qwen3-0.6B-4bit \
  --disable-cuda-graph --enable-cache-report --mem-fraction-static 0.4
```

Wait for the line "The server is fired up and ready to roll!". Then send one request from a second terminal:

```bash
curl -s http://127.0.0.1:30000/generate \
  -H 'Content-Type: application/json' \
  -d '{"text": "The capital of France is", "sampling_params": {"max_new_tokens": 12, "temperature": 0}}'
```

The capture recorded the answer like this:

```listing
title: the first answer
source: capture/out/generate.txt
lang: json
note: Cut to the text and the first fields of meta_info. The token ids and the timing fields are cut.
---
  "text": " Paris, and the capital of Germany is Berlin. The capital",
…
  "meta_info": {
…
    "finish_reason": {
      "type": "length",
      "length": 12
    },
    "prompt_tokens": 5,
```

Set `--mem-fraction-static` on a Mac you also use for other work. [Section 3.2](#s-mem-fraction-static-and-startup-sizing) shows the crash we got without it.

## How the parts are ordered

Part 1 puts SGLang on one page. Part 2 follows one request through the three processes and the scheduler. Part 3 is the KV cache, the part that decides how many users one GPU serves.

Part 4 makes each forward pass fast, and Part 5 measures a server. Part 6 spreads one model over many GPUs. Part 7 operates SGLang and closes with reinforcement learning, and the Reference holds the lookup tables:

```parts
```

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure 0.1](#fig-0-1) teaches the arrow styles with exchanges from our capture.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each arrow style marks one kind of exchange, and every label is a real name, message, or number from our recorded runs.
caption: Read each numbered row from the tail of the arrow to its head, and the note under each label names the style. From capture/out/cache-experiment.txt, server-default.log, and the out-of-memory run in section 3.2.
```

Sources: manual.json; capture/README.md; capture/run.py; capture/gpu/run.py, capture/gpu/sweep.py, capture/gpu/summarize.py, capture/gpu/out-gb10/environment.json; capture/out/environment.json, generate.txt, cache-experiment.txt, server-default.log, server-no-overlap.log; docs/docs/hardware-platforms/apple_metal.mdx and python/pyproject_other.toml at v0.5.22; python/sglang/srt/managers/io_struct.py at v0.5.22.
