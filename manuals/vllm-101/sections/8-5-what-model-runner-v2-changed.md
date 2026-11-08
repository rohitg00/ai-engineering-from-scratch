# What Model Runner V2 changed

> This page explains the new model runner and why async scheduling needs it.

At 0.31.0, vLLM has two model runners, and the one you get depends on your flags. When you finish this section, you can say which runner your server uses, and why a speculation method can change it.

## What a model runner does

The model runner lives in each GPU worker. It takes the batch that the scheduler chose, builds the input tensors, runs the forward pass, and samples the next tokens. It also loads the weights, runs the startup profile, and captures the CUDA graphs.

The first runner of the V1 engine grew to more than 7,500 lines. The design notes of the vLLM team say that the first version had design mistakes and technical debt. The team then built Model Runner V2 from first principles. The new runner is about a third of that size.

## Two ideas

**A fixed table of request rows.** Model Runner V2 keeps a persistent batch with one row for each `--max-num-seqs` slot, 256 on our GPUs. Each request owns one row for its whole life. A preempted request leaves its row, the same as a finished one. The runner updates only what changed in each step, instead of building the batch again.

**No waits for the CPU.** The runner keeps its work on one CUDA stream and avoids points where the CPU must wait for the GPU. That lets the scheduler plan the next step while the GPU still runs the current one. The name for this is async scheduling, and it is on by default for most generate models.

## When you get the old runner

Model Runner V2 is the default on CUDA when Triton is installed. vLLM 0.31.0 uses the old runner instead in these cases, among others:

- The n-gram, suffix, Medusa, or MLP speculator methods.
- The Mamba cache mode `all`, which release 0.32 removed.
- The stock torch.compile mode, and some parallel features such as sequence parallelism with tensor parallelism.

`VLLM_USE_V2_MODEL_RUNNER=0` or `=1` pins the choice.

This matters most for speculation. EAGLE3 keeps the new runner and async scheduling. N-gram speculation moves you to the old runner and turns async scheduling off. A comparison of the two methods is then also a comparison of two runners.

## Where it goes next

The vLLM roadmap for the fourth quarter of 2026 lists the full removal of the old runner. Each release since 0.30 moved more features to the new one. If a flag puts you on the old runner, check the next release before you build on that combination.

```takeaways
- Model Runner V2 keeps a fixed row for each request and avoids CPU waits.
- It is the default on CUDA, and some speculation methods move you back to the old runner.
- Pin the runner with VLLM_USE_V2_MODEL_RUNNER when you compare two methods.
```

Sources: the vLLM source at v0.31.0 (vllm/config/vllm.py, vllm/v1/worker/gpu_model_runner.py, vllm/v1/worker/gpu/model_runner.py, vllm/envs.py), vLLM documentation at v0.31.0 (docs/design/model_runner_v2.md), the vLLM roadmap for Q4 2026 (issue 61024), the release notes for v0.30.0 and v0.32.0.
