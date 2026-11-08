# Lab notes

> The machine, the image, the seeds, and the thermal rule behind every measured number in this manual.

This page is reference. It lists how each number in the manual was made, so you can repeat the run or judge the result.

## Machine and image

| Item | Value |
|---|---|
| Machine | NVIDIA DGX Spark, one GB10 GPU, 128 GB of unified memory |
| Memory that Ray reported | 121.69 GB |
| Image | `radixark/miles@sha256:c64fa344e3a86715f03c0a1b6a422c474e0035355591a2f6da87bf52a74c52da`, arm64 |
| Miles in the image | main `08752a1283`, 2026-10-15 |
| SGLang in the image | `0.5.22.dev46+g7b6993a` |
| Model | `Qwen/Qwen3-0.6B`, unless the run name gives another size |
| Data | GSM8K prompts with a binary math reward |

## Default run settings

Every run used these settings unless its name says otherwise:

| Setting | Value |
|---|---|
| Prompts per step | 32 (`--rollout-batch-size`) |
| Answers per prompt | 8 (`--n-samples-per-prompt`) |
| Samples per optimizer step | 256 (`--global-batch-size`) |
| Answer limit | 1,024 tokens |
| Temperature | 1 |
| Learning rate | 1e-6, constant |
| Trainer | FSDP on one GPU, colocated with the engine |
| Engine memory fraction | 0.4 |
| Weight update bucket | 536870912 bytes, 512 MiB |

## Runs

| Run | Steps | Seed | What changed |
|---|---|---|---|
| plain | 12 | default | none, before the heat guard |
| plain-48 | 48 | default | none, before the heat guard |
| plain-48-s2, plain-48-s3 | 48 | 2, 3 | none |
| e6a-base | 12 | 1 | none |
| e6b, e6c, e6d | 12 | 1 | deterministic inference on Triton, FlashInfer, and Triton again |
| e11-topp-topk | 12 | 1 | top-p 0.95 and top-k 64 |
| e3b, e3c, e3d | 12 | 1 | offload only the KV cache, keep the engine loaded at memory fraction 0.25, keep the trainer loaded |
| e4-0.6b, e4-1.7b | 4 | 1 | answers cut at 256 tokens, model size |
| e2-n4, e2-n16 | 24 | 1 | 4 and 16 answers per prompt |
| e3e, e3f | 12 | 1 | a same-day pair at memory fraction 0.25, default offload and the engine kept loaded |
| e2b-dapo-filter | 12 | 1 | the DAPO zero-variance filter, with batches of 48 prompts |

Four runs failed and are left out of every table: two true on-policy runs that stopped at start, and two Qwen3-4B runs that Ray stopped. Our run queue gave each run a time limit, and stopped the container when the limit came. The e2-n16 and e2b-dapo-filter runs had finished all their steps and were shutting down at that time. The summary marks them as partial.

## The heat guard

The GB10 runs hot under sustained load, so a script pauses the Miles container when the GPU reaches 84 C. It resumes the container when the GPU is at 74 C or below after at least 45 seconds, or after 120 seconds at most. On its first day the limits were 80 C and 68 C, and they changed to 84 C and 74 C that morning. When the guard stops, it resumes a paused container first, so no run stays paused.

The pause log holds 1,005 pauses, each with its resume, up to 2026-10-22.

## The timing rule

A pause adds wall-clock time to the phase it falls in. So every time in this manual comes from steps that no pause touched, with one exception. The DAPO filter run of section 3.2 had no clean step, so its rollout times take the pause time out of each step instead:

- **Rollout times:** the rollout window ends at the timestamp of the rollout metrics line and lasts `perf/rollout_time`. A step counts when that window overlaps no pause.
- **Whole-step times:** the window ends at the timestamp of the trainer metrics line and lasts `perf/step_time`. A step counts when that window overlaps no pause.

The summary file stores both medians, all steps and clean steps, with the number of clean steps next to each. Under the heat guard, few whole steps escape a pause. So whole-step times in this manual come from `plain` and `plain-48`. Both ran before we added the heat guard, so no pause could touch them. `plain-48` ended at 00:11 on 2026-10-18, and the guard logged its first pause at 10:57 that day.

## Check the stored outputs

The capture kit checks the stored outputs without a GPU. It replays the watchdog rule on the stored error times of the 16-answer run. It also marks the pauses again from the pause log, and it computes every median again from the stored steps. The raw run logs stay on the GB10. With those logs, the kit can also build the summary again and compare it with the stored one.

## Compare the same steps

A median over clean steps can still mislead. The default setting gave a 47.5 s rollout in `plain-48` and 59.1 s in the 6 clean steps of `e6a-base`. On the same 6 step numbers, `plain-48` took 60.9 s. The rollout time follows the answer length, so compare times on the same step numbers.

## Results from one run

These numbers rest on one run, and each page that uses them says so:

- The rollout time with the engine kept loaded, in section 2.2. A same-day pair gave 1 to 3 percent on one seed.
- The cost of deterministic inference, in section 4.5.
- The group sizes of 4 and 16 answers, in section 3.1.
- The reward and the rollout cost of the DAPO filter, in section 3.2. Its rollout times take the pause time out, because no step was clean.


## Why the first offload pair does not hold

Our first pair compared `e6a-base` with `e3c`. It showed a clean rollout median of 59.1 s for the default and 52.0 s with the engine kept loaded, a gain of 12 percent. The two runs also used different engine memory fractions, 0.4 and 0.25, and their clean steps were different steps.

Step 10 was clean in both runs. The engine kept loaded took 46.7 s with answers of 599 tokens. The default took 56.3 s with answers of 695 tokens. The rollout time follows the answer length, so the shorter answers explain most of that gap. The same-day pair `e3e` and `e3f` then changed only the offload setting, and gave 1 to 3 percent.

Sources: capture/gpu/heat-guard.sh; capture/run.py; capture/gpu/watchdog_replay.py; capture/gpu/out-gb10/image-identity.txt; capture/gpu/miles_grpo.py; capture/gpu/summarize_miles.py; capture/gpu/summary/miles-gb10-lab.json; capture/gpu/out-gb10/thermostat.log; capture/gpu/out-gb10/unpaused-timing.txt; capture/gpu/out-gb10/ray-oom-4b.log.
