# Evidence: cheatsheets/miles-rl.md

Abbreviations: F = manuals/miles-101, G = manuals/miles-101/capture/gpu.

## Run layout on one GPU (architecture, 15)
- Host docker run: F/front.md:13
- Container radixark/miles: F/front.md:13
- Rollout engine SGLang, mem 0.4: G/miles_grpo.py:41
- Trainer FSDP on one GPU: G/miles_grpo.py:42
- Heat guard pause at 84 C: G/heat-guard.sh:24
- Watchdog 10 checks: G/watchdog.sh:4
- Launcher runs the job: G/miles_grpo.py:56
- Run log step lines: F/front.md:14
- Edge run: F/front.md:13
- Edge rollout: G/miles_grpo.py:41
- Edge samples: G/miles_grpo.py:56
- Edge lines: F/front.md:14
- Edge stop: G/watchdog.sh:33
- Edge pause: G/heat-guard.sh:24
- Edge start: G/miles_grpo.py:56

## One GRPO step (flow, 4)
- Rollout 8 answers for 32 prompts: G/miles_grpo.py:35
- Reward math: G/miles_grpo.py:34
- Train on 256 samples: G/miles_grpo.py:36
- Watch 503 errors every 30 s: G/watchdog.sh:22, 36

## First run, four commands (annotated-code, 4)
- docker pull radixark/miles:latest: F/front.md:10
- mkdir lab folder and cache: F/front.md:11
- docker run with GPUs: F/front.md:13
- grep raw_reward per step: F/front.md:14

## Run and check a step (task-table, 8)
- Pull the image: F/front.md:10
- Make the lab folder: F/front.md:11
- Start a run: F/front.md:13
- Read the reward: F/front.md:14
- MILES_NUM_ROLLOUT: G/miles_grpo.py:13
- MILES_RUN: G/miles_grpo.py:14
- MILES_SEED: G/miles_grpo.py:17
- MILES_EXTRA_ARGS: G/miles_grpo.py:47

## Stop and guard (command-table, 2)
- docker stop "$name": G/watchdog.sh:33
- docker pause "$c": G/heat-guard.sh:24

## Defaults that matter (defaults, 8)
- MILES_NUM_ROLLOUT 12: G/miles_grpo.py:13
- MILES_MODEL Qwen3-0.6B: G/miles_grpo.py:11
- rollout-batch-size 32: G/miles_grpo.py:35
- n-samples-per-prompt 8: G/miles_grpo.py:35
- mem fraction 0.4: G/miles_grpo.py:41
- update-weight-buffer-size 536870912: G/miles_grpo.py:41
- Watchdog limit 100: G/watchdog.sh:3
- Watchdog checks 10: G/watchdog.sh:4

## Signals in the scripts (concepts, 5)
- Heat guard pause at 84 C: G/heat-guard.sh:24
- Resume rule 74 C, 45 s, 120 s: G/heat-guard.sh:19
- Strike on more than limit: G/watchdog.sh:31
- Errors counted as 503 lines: G/watchdog.sh:22
- Done file path: G/heat-guard.sh:3

## Fix the common failures (troubleshooting, 8)
- Watchdog exits with 2 on docker ps failure: G/watchdog.sh:18
- Watchdog docker logs failed, check does not count: G/watchdog.sh:29
- Errors keep counting, watchdog stops run: G/watchdog.sh:22, 31, 33
- Heat guard never pauses, container filter: G/heat-guard.sh:23
- Heat guard exits at once, done file: G/heat-guard.sh:3, 14
- Heat guard does not resume, 74 C rule: G/heat-guard.sh:19
- Container stays paused, release on exit: G/heat-guard.sh:7-12
- Memory error, mem fraction 0.4: G/miles_grpo.py:41

## Questions (qa, 4)
- Limit 100 default: G/watchdog.sh:3
- 10 checks default: G/watchdog.sh:4
- 30 s wait: G/watchdog.sh:36
- Guard resume after 45 s or 120 s: G/heat-guard.sh:19

## Tips (tips, 5)
- Unique MILES_RUN name: G/miles_grpo.py:14
- 32 times 8 equals global batch 256: G/miles_grpo.py:35, 36
- MILES_SEED for repeat runs: G/miles_grpo.py:17
- Same container name for watchdog: G/watchdog.sh:2
- Done file queue2.done: G/heat-guard.sh:3, 14
