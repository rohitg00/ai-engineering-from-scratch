# Leave async scheduling on

> Async scheduling is on by default for most generate models, and a few settings turn it off without an error.

You read about async scheduling and you want to know whether to set it. When you finish this section, you can check whether your server runs with it, and name the settings that turn it off.

**Our result:** on a throttled L4, turning async scheduling off made one user about 3 percent slower per token. Treat it as an unconfirmed result, because the clock was low and we had two seeds.

## Know what it does

Without async scheduling, each step runs in order. The scheduler picks a batch, the GPU runs it, and the scheduler reads the result before it picks the next batch. While the scheduler works, the GPU waits.

With async scheduling, the scheduler picks the next batch while the GPU still runs the current one. It counts the tokens that are not sampled yet as placeholders, so it does not schedule a request past its token limit. The GPU spends less time idle between steps. [The Model Runner V2 page](#s-what-model-runner-v2-changed) explains why the new model runner makes this possible.

## Know when it is on

In vLLM 0.31.0, the setting has three values. `--async-scheduling` turns it on, `--no-async-scheduling` turns it off, and no flag lets vLLM decide. When you set no flag, vLLM turns it on unless, among other cases, one of these holds:

- The model is a pooling model, such as an embedding model.
- The speculation method is n-gram, suffix, Medusa, or MLP speculator. EAGLE, MTP, DFlash, and DSpark methods, the GPU n-gram method, and a draft model keep it on.
- Pipeline parallelism is on and the old model runner runs.
- The executor does not support it.

In those cases, vLLM turns it off. For most of them it writes a warning to the log, but for a pooling model only a debug line. The server runs, so the change is easy to miss. Read the startup log after you add a speculation method or change the parallel layout.

## See how much two runs of one setting differ

We ran the L4 load sweep twice on 2026-10-21 with `Qwen/Qwen3-8B`, in [the full-clock session](#l4-sessions). One run had no flag, and one had `--async-scheduling`. For this model with no speculation, the flag sets what the default already sets, so the two runs are the same setting.

The two runs differed by at most 1.8 percent of output and 0.8 percent of time per token. Their seed ranges overlapped at every concurrency. So on this card, a gap of a few percent between two configs is run-to-run variation unless the seed ranges separate. [The lab notes](#s-ref-lab-notes) have the full table under the configs `vllm-b` and `vllm-async`.

## See what turning it off costs

**We measured** `--no-async-scheduling` against the default in [the shared-GPU session](#l4-sessions) of our L4 node on 2026-10-22, with `Qwen/Qwen3-8B`. That GPU held a pool of 2,928 tokens, so we tested 1 and 4 users.

| Users, L4 shared-GPU session | Median TPOT, on / off | Output tok/s, on / off | Median SM clock, on / off | Seeds, on / off |
|---|---|---|---|---|
| 1 | 241.7 / 249.6 ms | 3.98 / 3.87 | 375 / 368 MHz | 2 / 2 |
| 4 | 272.6 / 277.2 ms | 13.02 / 12.85 | 428 / 450 MHz | 2 / 1 |

At one user, the time per token rose by 3.3 percent with async scheduling off, and the seed ranges did not overlap. That gap is larger than the 0.8 percent that two runs of one setting differed by. But we measured that variation on the other GPU at full clocks. At four users, it rose by 1.7 percent, from one seed only.

The GPU ran at 368 to 450 MHz, far below its full clock. The runs with async scheduling off at one user had a clock 2 percent lower, close to the size of the effect. So read this as an unconfirmed result. The gain is small at these batch sizes, and we did not test it at a full clock or at high concurrency.

## Decide

Set no flag, and let vLLM choose. If you add a speculation method or pipeline parallelism, read the log for the warning. If the warning appears, measure the time per token with and without the feature, because you lose async scheduling together with the feature.

```takeaways
- Set no flag, and let vLLM turn async scheduling on.
- Read the startup log for the warning after you add speculation or pipeline parallelism.
- Treat a small gap with overlapping seed ranges as run-to-run variation.
```

Sources: capture/gpu/summary/l4.json (load.vllm-b, load.vllm-async, load.vllm), capture/gpu/summary/l4-gpu1.json (load.vllm-fast-b, load.vllm-no-async), the vLLM source at v0.31.0 (vllm/config/scheduler.py, vllm/config/vllm.py, vllm/v1/core/sched/async_scheduler.py), vLLM documentation at v0.31.0 (docs/design/model_runner_v2.md).
