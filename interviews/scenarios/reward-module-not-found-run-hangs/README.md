---
id: reward-module-not-found-run-hangs
title: A reward import error and a run that never stopped
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging]
tags: [rl, custom-reward, pythonpath, watchdog, run-queue, miles]
minutes: 20
lessons: []
manuals: [miles-101#s-write-a-custom-reward, miles-101#s-troubleshoot-by-symptom, miles-101#s-add-a-watchdog, miles-101#s-read-your-first-ten-steps]
practice: []
cheatsheet: []
related: [scenarios/dead-engine-and-watchdog]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/custom-rm-noenv-hang.txt
  - manuals/miles-101/capture/gpu/watchdog.sh
  - manuals/miles-101/sections/3-5-write-a-custom-reward.md
  - manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md
  - manuals/miles-101/sections/1-2-add-a-watchdog.md
---

## Situation

A team adds its own reward function to a GRPO run. The function lives in a file in the lab folder on the host, and the run names it with `--custom-rm-path my_rewards.custom_rm`. A run queue starts the job at night. In the morning the queue shows that the job reached its time limit and came back with code 124, and that it completed zero steps. The container had been up for about two hours.

The host also runs the watchdog from an earlier incident, the script that stops a run whose rollout engine died. It did not fire. A teammate reads that as proof that the engine was healthy, blames a slow GPU, and proposes to double the time limit and start the job again.

## Evidence

- [what the run queue recorded for this run](evidence/queue-record.txt)
- [the first and the last timestamped line, and the size of the log](evidence/log-span-and-size.txt)
- [every minute of the log that held a 503 line](evidence/errors-by-minute.txt)
- [the exception from the rollout executor](evidence/the-exception.txt)
- [the summary that the capture kit wrote for this run](evidence/kit-summary.txt)
- [the counting rule of the watchdog](evidence/watchdog-rule.txt)

## Questions

1. The exit code is 124 and the step count is zero. What does that pair tell you before you open the log?
2. The log holds 183,248 lines. Is this a hang, a crash, or something else? Where in the log do you read first?
3. Count the 503 lines per minute and apply the watchdog rule by hand. Was the watchdog wrong not to stop this run?
4. Read the exception. Which process raised it, and why does one missing environment variable reach that process?
5. Miles kept running after the error. Which second guard would have caught this run, and what does it watch?
6. What do you run before the next attempt, and which log line proves that the fix worked?

## Walkthrough

1. **Read the queue record.** The queue started the job at 00:19:01 and recorded RC 124 at 02:17:10 with `steps=0`. Code 124 is what the queue writes when its own time limit stops a job. So the run did not end by itself, and it did not finish a step in two hours. More time would not have changed the count.
2. **Read the span and the size.** The first timestamped line is at 00:19:02 and the last at 02:17:06, and the file holds 183,248 lines. A run that writes a log of that size for two hours is not asleep. It is busy with something that is not training. The reason is near the start, not at the end.
3. **Run the watchdog arithmetic yourself.** The log holds 44 lines of `503 Service Unavailable`, 40 of them in the minute of 00:24 and 4 in the minute of 00:25. The watchdog reads the last 60 s every 30 s and adds a strike only if the count is above 100. It needs 10 strikes in a row. This run never gave it one strike. The watchdog was correct. The rollout engine did not die, and a short burst like this can come from a healthy engine.
4. **Read the exception.** At 00:21:09 the rollout executor logged that a rollout task raised `ModuleNotFoundError: No module named 'my_rewards'`. The scoring of answers runs in the Ray workers, and that is where the import failed. After this line no `rollout 0` line ever appears, because no answer can be scored. The 503 burst three minutes later is noise next to this line.
5. **Find what the run did not pass.** The kit summary says it: the run passed `--custom-rm-path my_rewards.custom_rm` and not `-e PYTHONPATH=/root/lab`. The container sees the lab folder as `/root/lab`, but Python does not search that folder unless the variable names it. The launcher passes the variable on to the Ray workers, so the one setting fixes the import in the process that needs it.
6. **See why nothing stopped the run.** The manual records the same test: after this error the job stayed up for two hours with no rollout step, and the watchdog did not stop it because the engine wrote only 44 error lines. The watchdog watches for one failure shape, a dead engine. A run that cannot score its answers has a different shape, almost no errors and no progress.

## Resolution

The run failed at its first rollout because the reward module was not on the Python path of the Ray workers. Stop the container, add `-e PYTHONPATH=/root/lab` next to `MILES_EXTRA_ARGS`, and start again. Before that, test the import in the container with the one-line command from the manual, which scores one answer and should print `1.0`, and run the function on ten answers that you scored by hand, including an empty answer and an answer cut at the length limit.

The line that proves the fix is the first `rollout 0` line, which shows a `rollout/raw_reward` that your function computed. Then give the queue two rules. Treat a time-limit exit with `steps=0` as a failure, not as a slow run. Stop a run that shows no `rollout 0` line within ten minutes of its start, which is the manual's sign that the engine or the trainer did not start.

## Wrong turns

- "The watchdog missed a dead engine, so lower its limit." The run wrote 44 error lines in two hours, all inside two minutes. A healthy run with 16 answers per prompt wrote 2,209 in one minute. A limit low enough to catch 44 fires on every healthy burst, and still misses this run, which went quiet for the rest of the two hours.
- "Double the time limit and start it again." The log grew to 183,248 lines with no finished step. More time buys more lines and the same count.
- "Rebuild the image with the reward file inside." That works until the next change to the reward. The launcher already passes `PYTHONPATH` to the Ray workers, so one variable on the run command is the fix.
- "Write the reward as a plain function so the import gets simpler." The import failed on the module name, before any function ran. A plain function fails later and in a different way, because Miles awaits the result.

## Generalize

A job that cannot start its work and does not stop is the most expensive failure, because it spends its whole time limit and gives no signal. Every guard watches for one failure shape. The dead-engine guard counts errors, and an import error produces almost none. Add a guard for progress, such as a first step by a deadline, read the exit code of the queue as data, and read a log from its start, where the first exception sits.

## Taught in

The Miles manual gives the two settings for a custom reward and records this hang in [the custom reward page](../../../manuals/miles-101/sections/3-5-write-a-custom-reward.md), lists the symptom in [the troubleshooting page](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md), builds the error-count rule in [the watchdog page](../../../manuals/miles-101/sections/1-2-add-a-watchdog.md), and names the ten-minute rule for a missing first step in [the first ten steps page](../../../manuals/miles-101/sections/1-3-read-your-first-ten-steps.md).
