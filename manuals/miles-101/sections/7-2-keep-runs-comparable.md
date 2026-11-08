# Keep runs comparable

> A run that you cannot compare with another run teaches you nothing, so record what each run used before you start it.

Two weeks into a project, you will want to know why last Tuesday's run learned faster than today's. You can only answer that if both runs recorded the same facts.

When you finish this section, you can record each run so that you can compare it later. You can also replay a step to debug it.

## Record these facts for every run

| Fact | How we record it |
|---|---|
| The image digest | `docker image inspect`, as in [section 1.1](#s-run-grpo-on-one-gpu-pull-the-image-and-record-what-you-pulled) |
| The Miles commit and the SGLang version | read from inside the image |
| The full command | the launcher prints it, and we keep the script |
| The seed | `--seed` and `--rollout-seed` |
| The trainer log and the engine log | one log file per run, not mixed with other runs |
| The GPU temperature and pauses | the heat-guard log, as in [section 1.2](#s-add-a-watchdog-guard-the-gpu-heat) |
| The exit code | one status line per run |

Keep the engine log next to the trainer log. Of the four failures we met, one began in the engine and three began in the trainer, so you need both.

## Change one thing per run

Compare two runs only when one setting differs. Our first offload run changed the offload setting and the engine memory fraction together, and it showed a 12 percent faster rollout. A same-day pair that changed only the offload setting showed 1 to 3 percent. [Section 2.2](#s-choose-what-to-offload) has both.

Compare times on the same step numbers. The rollout time follows the answer length, and the answers get shorter as the model learns. A median over different steps can differ for that reason alone, as [section 5.3](#s-repeat-a-run) shows.

## Save what you need to replay a step

Miles can save the data of a run so that you can replay one part without the other:

- `--save-debug-event-data` writes the events of each step. Our runs kept these for every run.
- `--save-debug-rollout-data` writes the rollout samples. Load them with `--load-debug-rollout-data` and `--debug-train-only` to train on the same samples again, with no engine.
- `--debug-rollout-only` runs the engine side alone.

Replay is the fastest way to test a loss or a reward change. Every replay sees the same samples, so a difference comes from your change and not from the sampler.

```takeaways
- Record the image digest, the commit, the command, the seed, and both logs for every run.
- Change one setting per run, and keep a baseline from the same session.
- Save rollout data when you plan to test a training change, and replay it with --debug-train-only.
```

Sources: capture/gpu/out-gb10/image-identity.txt; capture/gpu/miles_grpo.py; capture/gpu/heat-guard.sh; Miles debug arguments at main 08752a12.
