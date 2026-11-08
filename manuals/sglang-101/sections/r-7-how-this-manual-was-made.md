# How this manual was made

> This page records the version, the sources, the machines, and the capture kits behind every fact and number in the manual.

## The version

The manual pins SGLang 0.5.22, tagged on 2026-10-13 at commit `baa9befa381511cd4d56f83980951e5a45fffc6d`. The facts were verified on 2026-10-16. SGLang releases about every three weeks, and several defaults changed between 0.5.20 and 0.5.22. A recipe written for an older version can be wrong at this one, and the sections say where.

## The sources, ranked

Facts come from seven sources, ranked by authority. When two of them disagree, the higher one wins and the text says so.

| Rank | Source | What the manual takes from it | Cited as |
|---|---|---|---|
| 1 | the SGLang source at the tag, `baa9befa` | every default and every mechanism | the file list in the Sources line of each section |
| 2 | the captured runs [on the Mac](manuals/sglang-101/capture/out) and [on the GPUs](manuals/sglang-101/capture/gpu) | every listing and every number marked as measured | the capture file name |
| 3 | SGLang issues and pull requests | incidents and the design history of each feature | `issue` and its number |
| 4 | papers | the original design of RadixAttention and the methods SGLang implements | `paper` and a title |
| 5 | the SGLang documentation at the tag | documented behaviour, checked against the code | `docs` and a heading |
| 6 | independent field reports | GPU setups that we could not run, such as many GPUs in one server | `field`, the author, and the month |
| 7 | SGLang team and vendor reports | claims, always labeled as the claim of the author | `team` or the vendor, and the month |

The documentation ranks below the code on purpose. At 0.5.22 the documentation still lists two attention backends that the code removed. It also gives other HiCache prefetch timeouts than the code uses. When we say the default, we mean the value the code sets.

## Four kinds of evidence

Every number in this manual carries one of four labels in the text.

**We measured:** the number comes from our runs [on the Mac](manuals/sglang-101/capture/out) or [on the GPUs](manuals/sglang-101/capture/gpu), recorded on the machines in the tables below. You can run the kit and get the same facts.

**The code:** the default or the mechanism comes from the SGLang source at the tag. The Sources line names the files.

**A field report:** an engineer or a company outside the SGLang team ran SGLang and published the result. The text names them, the month, the version when they stated it, and what they tuned.

**The team reports** or **the vendor reports:** the SGLang team, RadixArk, or a hardware vendor published the number. We repeat it as their claim and set it against independent results where they exist.

DeepEP and prefill-decode disaggregation across many GPUs need hardware that we did not have. For those sections, the code and the field reports carry the argument, and the label says so.

## The capture kit

[The capture kit](manuals/sglang-101/capture) starts the real SGLang server on Apple silicon through its MLX backend. It sends requests, runs the official benchmark, and writes what it sees to [its output folder](manuals/sglang-101/capture/out). `python3 capture/run.py` records everything. `python3 capture/run.py --check` records again into a temporary directory and compares the facts that must not change. Those facts are the generated text at temperature 0, the token and cached-token counts, and the request counts. The KV bytes per token and the metric names are facts too.

Timings change on every run, so the check does not compare them.

The kit needs SGLang 0.5.22 with its MLX extra on Apple silicon, so it cannot run in the repository CI. Without that setup, `--check` prints `skipped` with the reason and exits 0. Every file of the Mac runs was recorded on one machine:

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

[The GPU kit](manuals/sglang-101/capture/gpu) runs the same idea on an NVIDIA GPU. [Its run script](manuals/sglang-101/capture/gpu/run.py) starts eight server configurations and writes [the GB10 run logs](manuals/sglang-101/capture/gpu/out-gb10). [The sweep script](manuals/sglang-101/capture/gpu/sweep.py) repeats each benchmark point with three seeds and records the GPU clock and temperature of every run. [The summary script](manuals/sglang-101/capture/gpu/summarize.py) writes one summary for each machine: [the GB10 summary data](manuals/sglang-101/capture/gpu/summary/gb10.json), [the L4 summary data](manuals/sglang-101/capture/gpu/summary/l4.json), and [the throttled L4 summary data](manuals/sglang-101/capture/gpu/summary/l4-throttled.json). [The Miles summary script](manuals/sglang-101/capture/gpu/summarize_miles.py) writes [the Miles summary data](manuals/sglang-101/capture/gpu/summary/miles-gb10.json). The charts read those four files.

Each row below is one sweep of the GPU kit. The link opens its summary file, and each section gives the date and the clocks of the runs that it uses.

```lab-runs
```

Every GB10 run log and the GB10 summary data were recorded on one machine:

| Item | Value |
|---|---|
| Host | an NVIDIA DGX Spark, Ubuntu 24.04, aarch64 |
| GPU | NVIDIA GB10, compute capability 12.1, 121.7 GiB of memory shared with the CPU |
| SGLang | 0.5.22 from PyPI, sglang-kernel 0.4.9, flashinfer 0.7.1 |
| Frameworks | PyTorch 2.14.1+cu130, CUDA 13.0, driver 580.159.03, Python 3.12.3 |
| Models | `Qwen/Qwen3-30B-A3B-Instruct-2507`, its FP8 checkpoint, and the EAGLE-3 draft `lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex` |
| Server flags | `--enable-cache-report`, `--enable-metrics`, `--mem-fraction-static 0.7` |
| Recorded on | 2026-10-16 |

The kit also has an `l4` profile for Qwen3-8B on an NVIDIA L4, which wrote [the L4 run logs](manuals/sglang-101/capture/gpu/out-l4) and [the L4 summary data](manuals/sglang-101/capture/gpu/summary/l4.json). Part 1 uses that L4 server for its listings. Our first L4 sweep ran hot and throttled, and [section 5.1](#s-sglang-benchmark-serving) tells it as an incident. We then ran the L4 again with a cool-down to 72°C before each run. [Section 4.3](#s-quantization), [section 4.4](#s-speculative-decoding), and section 5.1 use those runs, and section 5.1 shows that the cooled card still lowered its clock under long load.

## Conventions

`sglang serve` starts the server in every command. The older `python -m sglang.launch_server` still works at 0.5.22 and prints a deprecation warning. Ports are the default `30000`. `~` stands for the home directory in recorded output.

Citations name a place. `{{issue #35129}}` names an issue in the SGLang repository. `{{field Jarvislabs 2026-05}}` names a field report by its author and month, and the text links it. The SGLang source files a section was written from are listed once, in the Sources line at its end. A listing copies lines from a capture file unchanged, and a `…` marks a cut that the note explains.

Figures animate on the web, where a Replay button runs the steps again. Print and reduced motion show the final frame.

Sources: manual.json; capture/README.md; capture/run.py; capture/gpu/run.py, capture/gpu/sweep.py, capture/gpu/summarize.py, capture/gpu/summarize_miles.py, capture/gpu/out-gb10/environment.json, capture/gpu/out-l4/environment.json; capture/out/environment.json, server-no-overlap.log.
