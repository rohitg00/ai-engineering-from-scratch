---
id: resume-that-started-fresh
title: A resumed run that started from step 0 in silence
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [rl, checkpoints, resume, runbook, miles]
minutes: 20
lessons: []
manuals: [miles-101#s-survive-failures]
practice: []
cheatsheet: []
related: [scenarios/dead-engine-and-watchdog]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/resume-check.txt
  - manuals/miles-101/capture/gpu/out-gb10/live-check-summary.txt
  - manuals/miles-101/sections/6-3-survive-failures.md
---

## Situation

A long GRPO run saves a checkpoint every 20 steps into a host folder that is mounted into the container. One night the run dies. The on-call engineer starts the same command again at once. To be safe, she points `--load` at the newest `iter_` folder inside the checkpoint folder, and she keeps the same `> runs/plain.log` redirect, because the dashboard reads that file.

In the morning the reward curve of the new run begins where the first run began days ago. The first step line in the new log reads `step 0`. The team splits: one side says the checkpoints are corrupt, the other says the resume feature does not work on this trainer. Nobody can say why the first run died, because the old log is gone.

## Evidence

- [the two runs of the restart check](evidence/check-setup.txt)
- [the first run: its save line, and its silence about the empty folder](evidence/first-run-saved.txt)
- [the second run: what a real resume prints](evidence/resume-lines.txt)
- [what the checkpoint folder holds after both runs](evidence/folder.txt)
- [the manual's rule for the load flag and the log file](evidence/load-rule.txt)
- [the lines a resumed run must show, and the test before a long run](evidence/resume-checklist.txt)
- [the files that the checkpoint converter wrote](evidence/converter.txt)

## Questions

1. The new log starts at `step 0`. Which lines must appear above it when a resume works, and what does their absence prove?
2. How loudly does Miles complain when the folder it loads from holds no checkpoint? What does that mean for the runbook?
3. The flag named the newest `iter_` folder. Why is that the wrong path, and which file does Miles read to find the last step?
4. The restart also destroyed something that the team now misses. What, and how do you restart so that it survives?
5. Write the test that every long run passes before it starts, with the step numbers you expect to see.
6. The team wants to serve the model from a saved step. Which tool does that, and what does it need besides the checkpoint?

## Walkthrough

1. **Read the shape of the check.** The manual ran two short runs with the same flags: `--save /ckpt/run-a --save-interval 20 --load /ckpt/run-a`. The first ran 2 steps on an empty folder. The second ran 4 steps on the folder the first one left. This is the smallest test of a resume, and it is what the team should have run before the long run.
2. **Read the first run.** It wrote `[FSDP] Saved checkpoint to /ckpt/run-a/iter_0000002`, because Miles always saves after the last step. The count of lines that mention a missing tracker or a missing folder is 0. The load folder was empty and Miles said nothing about it. That silence is the whole incident: a run that finds nothing to load looks exactly like a run that was never asked to load.
3. **Read the second run.** It printed three `Loaded` lines, for the model, the optimizer and the LR scheduler, each with the folder of the step. Its first step line is `step 2`, not `step 0`, and it saved `iter_0000004` at its end. These three lines and that first step number are the proof of a resume. The team's log has none of them, so the new run started fresh.
4. **Read the folder.** It holds `iter_0000002`, `iter_0000004`, a `rollout` folder and one file, `latest_checkpointed_iteration.txt`. That file is the tracker. It sits in the parent folder, not inside an `iter_` folder.
5. **Apply the rule for the flag.** `--load` names the parent folder, never one `iter_` folder inside it, because Miles reads the tracker file there to find the last saved step. The engineer pointed the flag at a folder with no tracker, so Miles had no step to resume, which is the same case as an empty folder, and the manual's test shows that this case prints nothing.
6. **Apply the rule for the log.** The manual asks for a new log file on a restart, such as `> runs/plain-resume.log`, because the redirect empties the old log and the old log is where the cause of the failure is. The team lost the cause of the night's crash with the same keystroke that lost the resume.
7. **Read the converter output.** The FSDP trainer writes distributed checkpoints that other tools cannot load. The converter turned the step 2 checkpoint into a model folder with the weights, the configuration and the tokenizer files, given the base model folder for the configuration and the tokenizer.

## Resolution

The checkpoints were fine. The resume did not happen because `--load` named an `iter_` folder, which holds no tracker file, and Miles starts fresh without a message when it finds no step to load. Point `--load` at the parent folder, `/ckpt/run-a`, start again with a new log file, and read the three `Loaded` lines and the first step number before you walk away. The run then continues from the last saved step, as the check run did from `step 2`.

Make the check part of the runbook. Before a long run, run the command with `MILES_NUM_ROLLOUT=2`, then again with `MILES_NUM_ROLLOUT=4`, and require `step 2` as the first step line of the second run. Choose `--save-interval` from the step time, so that a crash costs less than you accept: with a step of five minutes, an interval of 12 loses at most one hour. To serve a saved step, run the converter inside the container with the step folder, an output folder and the base model folder.

## Wrong turns

- "The checkpoints are corrupt." The folder holds the step folders and the tracker file, and the manual's second run loaded the model, the optimizer and the LR scheduler from the same kind of folder. Nothing in the new log says that a load failed, because no load was attempted.
- "The resume feature does not work on the FSDP trainer." The check run resumed at `step 2` on the FSDP trainer and saved `iter_0000004`. The feature needs the parent folder, and it got a step folder.
- "Point the flag at the step folder to be sure it loads the right step." The tracker file in the parent folder names the last step. A step folder has no tracker, so the flag loads nothing.
- "Keep the same log file so the dashboard does not break." The redirect empties the old log and destroys the only record of the crash. Use a new file for each restart and point the dashboard at a folder.

## Generalize

A feature that fails silently must be verified by its positive signal, never by the absence of an error. For every resume, every cache load and every state restore, know the log lines that prove it happened and the first value that must differ from a cold start, and test the whole restart path on a short run before you rely on it. Never let a restart overwrite the evidence of the failure that caused it.

## Taught in

The Miles manual gives the checkpoint flags, the resume lines, the two-step test and the converter in [the failures page](../../../manuals/miles-101/sections/6-3-survive-failures.md).
