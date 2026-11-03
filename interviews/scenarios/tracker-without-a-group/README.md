---
id: tracker-without-a-group
title: A tracker flag that stopped the run at start
card: scenarios
kind: incident
level: 1
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [screen, debugging]
tags: [rl, tracking, dashboard, secrets, miles]
minutes: 15
lessons: []
manuals: [miles-101#s-read-the-run]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/tracker-eval-checks.txt
  - manuals/miles-101/sections/5-1-read-the-run.md
---

## Situation

A team has read its first runs from the log with `grep`. For the first long run they want a dashboard, so they add `--use-wandb --wandb-mode offline --wandb-project miles-lab` to the run's extra arguments. The run stops at start with a `TypeError` about `NoneType` and `str`. No step line was written.

One teammate blames the image and wants the tracker removed for good. Another wants to paste the team's API key into the extra arguments to force an online run, because "offline mode is what broke it".

## Evidence

- [the run with the tracker on and no group name](evidence/the-crash.txt)
- [the same run with a group name](evidence/with-the-group.txt)
- [the same run with the other tracker](evidence/tensorboard.txt)
- [the tracker flags the manual uses, and the rule about the group](evidence/the-command-and-the-rule.txt)
- [where the key for an online run goes](evidence/the-key-rule.txt)
- [the flags for the other tracker](evidence/tensorboard-command.txt)

## Questions

1. What kind of bug produces this `TypeError`, and what does it tell you about the GPU, the engine and the image?
2. Which flag was missing, and which two log signs show that the tracker then worked?
3. The teammate wants to paste the API key into the run arguments. Name two places where that key would then appear.
4. Which tracker needs no account and no network, and what does it need instead?
5. The team now has a dashboard. What do they keep as well, and why?

## Walkthrough

1. **Read the error.** `TypeError: unsupported operand type(s) for +: 'NoneType' and 'str'` is Python adding a string to a value that is `None`. A setting that nobody gave is being joined into a name. Nothing in that line concerns the GPU, the engine or the weights. The run never reached its first step, so the tracker setup is the only code that ran.
2. **Read the run that worked.** The same recipe with `--wandb-group plain` logged `step 0` and `step 1`. The log printed `W&B offline mode enabled. Data will be saved locally.`, and the tracker folder holds `offline-run-` folders next to its debug logs. The manual names the rule: keep `--wandb-group`, because without it a run ends at startup with exactly this error.
3. **Read the other tracker.** The same recipe with `-e TENSORBOARD_DIR=/root/lab/runs/plain/tb` and `--use-tensorboard` logged `Saving tensorboard log to /root/lab/runs/plain/tb.` and wrote two event files. This tracker needs a folder and one flag, and neither an account nor a network, and you read it on the host with `tensorboard --logdir`.
4. **Read the key rule.** For an online run, leave out `--wandb-mode offline`. Keep the key out of the command line, because commands go to the shell history and the process list, and the launcher prints the full command in the log. Put `WANDB_API_KEY=<your key>` in a file with mode 600 and pass it with `--env-file`. The extra arguments are the one place the key must never go.

## Resolution

The crash came from one missing flag, `--wandb-group`. Add it, keep offline mode until an account and a network are wanted, and check the two signs: the `W&B offline mode enabled` line and the `offline-run-` folder. The run then reaches `step 0` and `step 1` as the check did. For a team with no tracker account, use TensorBoard with a folder and one flag, and open the folder on the host.

Keep the log in any case. The manual read every number in it from the log, and the log is where the first exception of a broken run sits.

## Wrong turns

- "The image is broken, drop the tracker." The same image ran the same recipe to `step 1` with one more flag. The error names a missing value, not a missing library.
- "Paste the API key into the extra arguments to force online mode." Offline mode was not the cause, and the launcher prints the full command into the log, so the key would sit in the log, the shell history and the process list.
- "A dashboard replaces the log." The dashboard shows the metrics. The log holds the startup lines, the engine lines and the first exception when a run breaks.

## Generalize

A type error on a `None` at startup is a missing setting, and the fastest check is the documented command next to yours. Secrets go in a file that only you can read and reach the process through the environment, never through arguments that a launcher echoes. A dashboard adds a view, and the log stays the record.

## Taught in

The Miles manual gives the tracker commands, the group rule and the key rule in [the read the run page](../../../manuals/miles-101/sections/5-1-read-the-run.md).
