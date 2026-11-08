# Miles 101

Reinforcement learning on language models with Miles, from one GRPO run on one GPU to a run you can trust. The manual gets a run going first, then shows how to size it, check that it is correct, and find the cause when it fails. The web edition is at [aiengineeringfromscratch.com/manual-miles-101.html](https://aiengineeringfromscratch.com/manual-miles-101.html), and each release of the course attaches the PDF as `aiefs-manual-miles-101.pdf`.

## What is in it

- 34 sections in 8 parts, then five reference sections. Part 1 runs GRPO on one GPU, adds a watchdog, and reads the first ten steps. Part 2 sizes the run, Part 3 gives recipes, and Part 4 covers speed and stability. Part 5 checks a run, Part 6 scales it out, Part 7 debugs it, and Part 8 explains how Miles works inside.
- Every measured line comes from recorded runs on one DGX Spark, and each page says how far the result goes. Pages that one GPU cannot show say what we could only read in the source.
- A cover plate and 18 figures drawn with the figure kit from the runs and the code.
- A capture kit in `capture/` that checks the stored outputs without a GPU.
- A GPU kit in `capture/gpu/` that starts the runs on the DGX Spark.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/run.py` | the capture kit: `--check` compares the stored outputs, and a plain run rebuilds the summary from the raw run logs |
| `capture/gpu/` | the GPU kit: `miles_grpo.py` starts a run, `watchdog.sh` stops a run whose engine died, `heat-guard.sh` pauses the container when the GPU is too hot, `summarize_miles.py` writes the summary |
| `capture/gpu/out-gb10/`, `capture/gpu/out-l4/` | the logs and checks that the listings are cut from |
| `capture/gpu/summary/miles-gb10-lab.json` | the per-step data and the medians that the tables and charts read |

## The pin

| Item | Value |
|---|---|
| Image | `radixark/miles@sha256:c64fa344e3a86715f03c0a1b6a422c474e0035355591a2f6da87bf52a74c52da`, arm64 |
| Miles in the image | main `08752a1283`, 2026-10-15 |
| SGLang in the image | `0.5.22.dev46+g7b6993a` |
| Verified | 2026-10-22 |

## The recording host

| Item | Value |
|---|---|
| Machine | NVIDIA DGX Spark, one GB10 GPU, 128 GB of memory that the CPU and the GPU share |
| Model | `Qwen/Qwen3-0.6B`, unless the run name gives another size |
| Data | GSM8K prompts with a binary math reward |
| Trainer | FSDP on one GPU, colocated with the SGLang engine |

The GB10 got hot under hours of load, so a heat guard paused the container at 84 C. Timing numbers come from clean steps that no pause touched, or from runs made before the guard. Two logprob checks ran on an NVIDIA L4 with SGLang 0.5.22 outside the Miles image, and their files say so.

## How to read it

Start with the front matter, "How to read this manual". It gives the five commands of a first run and the five results that change what you do. It also defines three terms: heat guard, pause, and clean step. Run section 1.1 with the watchdog of section 1.2 in a second terminal, because a run whose engine dies does not stop by itself. Use [the lab notes](https://aiengineeringfromscratch.com/manual-miles-101.html#s-ref-lab-notes) to check a number or to repeat a run.

## Run the kit

```bash
cd manuals/miles-101
python3 capture/run.py --check
```

The check needs no GPU and no network. It replays the watchdog rule on the stored error times of the 16-answer run. It marks the pauses from the pause log and computes every median from the stored steps. Then it checks that each quoted value is still in its file. The raw run logs stay on the DGX Spark. Without them, the check prints `skipped` for the fresh summary and compares only the stored outputs. Set `MILES_LAB_RUNS` to a runs folder that holds `status.txt` to also build the summary again and compare it. `python3 capture/run.py` with that folder replaces the stored summary and the pause log.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/miles-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual miles-101
```

The audit runs the capture check. It must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
