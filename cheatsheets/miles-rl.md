---
id: miles-rl
title: RL Post-Training with Miles
code: PM
subtitle: Run GRPO on one GPU, watch the run, stop a dead engine and fix the common failures.
hue: 205
sources: manuals/miles-101
source_hash: b3fd372636af8146
---

## Run layout on one GPU
type: architecture
from: manuals/miles-101/front.md, manuals/miles-101/capture/gpu/miles_grpo.py, manuals/miles-101/capture/gpu/watchdog.sh, manuals/miles-101/capture/gpu/heat-guard.sh

```arch
node | host | 1,1 | Host | docker run | client
node | box | 2,1 | Container | radixark/miles | process
node | eng | 3,1 | Rollout engine | SGLang, mem 0.4 | gpu
node | trn | 4,1 | Trainer | FSDP on one GPU | gpu
node | guard | 1,2 | Heat guard | pause at 84 C | process
node | wd | 2,2 | Watchdog | 10 checks | queue
node | launch | 3,2 | Launcher | execute_train | process
node | log | 4,2 | Run log | step lines | store
edge | host | box | run
edge | box | eng | rollout
edge | eng | trn | samples
edge | trn | log | lines
edge | wd | box | stop
edge | guard | host | pause
edge | launch | eng | start
```

## One GRPO step
type: flow
from: manuals/miles-101/capture/gpu/miles_grpo.py, manuals/miles-101/capture/gpu/watchdog.sh

1. **Rollout**: the engine writes 8 answers for each of 32 prompts.
2. **Reward**: `--rm-type math` scores each answer.
3. **Train**: one update on 256 samples.
4. **Watch**: the watchdog counts 503 errors every 30 s.

## First run, four commands
type: annotated-code
lang: bash
from: manuals/miles-101/front.md

```bash
docker pull radixark/miles:latest                 # the tag moves, so record the digest
mkdir -p ~/miles-lab/runs ~/.cache/huggingface    # lab folder and model cache
docker run --rm --name miles-plain --gpus all     # start the container with the GPUs
grep -o "'rollout/raw_reward': [0-9.]*" runs/plain.log   # reward of each step
```

## Run and check a step
type: task-table
from: manuals/miles-101/front.md, manuals/miles-101/capture/gpu/miles_grpo.py

| Task | Code |
|---|---|
| Pull the image | `docker pull radixark/miles:latest` |
| Make the lab folder | `mkdir -p ~/miles-lab/runs ~/.cache/huggingface` |
| Start a run | `docker run --rm --name miles-plain --gpus all` |
| Read the reward | `grep -o "'rollout/raw_reward': [0-9.]*" runs/plain.log` |
| Set the step count | `-e MILES_NUM_ROLLOUT=<steps>` |
| Name the run | `-e MILES_RUN=<name>` |
| Fix the seed | `-e MILES_SEED=<seed>` |
| Add Miles flags | `-e MILES_EXTRA_ARGS="<flags>"` |

## Stop and guard
type: command-table
from: manuals/miles-101/capture/gpu/watchdog.sh, manuals/miles-101/capture/gpu/heat-guard.sh

| Command | What it does |
|---|---|
| `docker stop "$name"` | The watchdog stops the run after the strike count is reached. |
| `docker pause "$c"` | The heat guard pauses the container at 84 C. |

## Defaults that matter
type: defaults
from: manuals/miles-101/capture/gpu/miles_grpo.py, manuals/miles-101/capture/gpu/watchdog.sh

| Setting | Default | Note |
|---|---|---|
| `MILES_NUM_ROLLOUT` | 12 | Steps in one run |
| `MILES_MODEL` | Qwen3-0.6B | Model the launcher downloads |
| `--rollout-batch-size` | 32 | Prompts per step |
| `--n-samples-per-prompt` | 8 | Answers per prompt |
| `--sglang-mem-fraction-static` | 0.4 | Engine share of GPU memory |
| `--update-weight-buffer-size` | 536870912 | Bucket size in bytes |
| Watchdog limit | 100 | Errors in 60 s that count as a strike |
| Watchdog checks | 10 | Strikes in a row before the stop |

## Signals in the scripts
type: concepts
from: manuals/miles-101/capture/gpu/heat-guard.sh, manuals/miles-101/capture/gpu/watchdog.sh

- **Heat guard**: pauses the container when the GPU reaches 84 C.
- **Resume rule**: the guard resumes at 74 C or below after 45 s, or after 120 s at most.
- **Strike**: one check that counts more than 100 lines of `503 Service Unavailable`.
- **Errors**: the 503 lines counted in the last 60 s of the container log.
- **Done file**: the guard stops when `queue2.done` exists.

## Fix the common failures
type: troubleshooting
from: manuals/miles-101/capture/gpu/watchdog.sh, manuals/miles-101/capture/gpu/heat-guard.sh, manuals/miles-101/capture/gpu/miles_grpo.py

| Symptom | Cause | Fix |
|---|---|---|
| Watchdog exits with 2 | Docker ps failed, so the watchdog cannot see the run | Start Docker, then restart the watchdog |
| Watchdog prints docker logs failed | One check could not read the logs | The check does not count. Confirm the container name |
| Run keeps going with 503 errors | The rollout engine died and the trainer keeps sending requests | The watchdog stops it after 10 strikes. Read the engine lines above the first 503 |
| Heat guard never pauses | The container image is not radixark/miles:latest | Start the run with radixark/miles:latest |
| Heat guard exits at once | The done file exists from an earlier session | Remove queue2.done if no queue uses it |
| Container stays paused | The guard stopped while it held a pause | The guard resumes the container on exit. Start the guard again |
| Heat guard does not resume | GPU stays above 74 C | It resumes after 120 s at most. Check the GPU temperature |
| Start fails with a memory error | The engine memory share is too high for the GPU | Lower `--sglang-mem-fraction-static` |

## Questions
type: qa
from: manuals/miles-101/capture/gpu/watchdog.sh, manuals/miles-101/capture/gpu/heat-guard.sh

- **Why is the limit 100?** It is the default errors per 60 s. Errors above it count as a strike.
- **Why 10 checks?** Ten strikes in a row stop the run.
- **Why 30 s?** Each watchdog check waits 30 s.
- **Why does the guard wait before it resumes?** It resumes at 74 C after 45 s, or after 120 s at most.

## Tips
type: tips
from: manuals/miles-101/capture/gpu/miles_grpo.py, manuals/miles-101/capture/gpu/watchdog.sh, manuals/miles-101/capture/gpu/heat-guard.sh

- Give each run a unique `MILES_RUN` name.
- Keep 32 prompts times 8 answers equal to the global batch of 256.
- Set `MILES_SEED` for repeat runs.
- Start the watchdog with the same container name as the run.
- Remove `queue2.done` before you start the guard, if no queue uses it.
