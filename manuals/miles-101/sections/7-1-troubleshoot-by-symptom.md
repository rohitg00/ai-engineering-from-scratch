# Troubleshoot by symptom

> Start from what you see, and each entry gives the likely cause, the check, and the fix.

The first six entries are problems we met on a GB10: five symptoms of failed runs and one timing effect of heat. The seventh uses our healthy runs as the reference. The eighth comes from the Miles and SGLang source and documentation. The others come from reports in the Miles issue tracker. We have not reproduced the eighth or the others.

When you finish this section, you can find the cause of a failed or wrong run from its first symptom.

```figure
id: fig-7-1
kind: decision
title: Start from what you see
claim: Each of the five symptoms we hit has one first check and one fix.
caption: Five of the symptoms from our runs. The entries below also cover a run that hangs on a missing reward module. They add a check against healthy runs, one entry from the documentation, and five from issue reports.
```

## The GPU is idle and the log keeps growing

- **Cause:** the rollout engine died, and the trainer keeps sending requests to it.
- **Check:** count `503 Service Unavailable` in each of the last few minutes of the log. Our failed run wrote more than 2,600 in every full minute for an hour. A healthy run with 16 answers for each prompt wrote short bursts of up to a minute, then none.
- **Fix:** stop the run, then read the engine lines above the first 503 error. Start every unattended run with the watchdog in [section 1.2](#s-add-a-watchdog).

## The run hangs after a reward import error

- **Cause:** Miles cannot import the module that `--custom-rm-path` names, usually because `PYTHONPATH` does not reach the lab folder.
- **Check:** look for `ModuleNotFoundError` with the name of your reward module in the log. No `rollout 0` line follows it.
- **Fix:** the run does not stop by itself, and the watchdog does not stop it, because the engine writes only a few 503 errors. In our test the job stayed up for two hours. Stop the container, fix `PYTHONPATH` as in [section 3.5](#s-write-a-custom-reward), and start the run again.

## The engine stops at start with a FlashAttention 3 error

- **Cause:** the run asked for FlashAttention 3, usually through true on-policy mode, on a GPU outside its range.
- **Check:** look for `FlashAttention v3 Backend requires SM>=80 and SM<=90` in the engine log.
- **Fix:** on a non-Hopper GPU, drop true on-policy mode and use the default backend. [Section 4.6](#s-know-the-true-on-policy-limits) explains the limit.

## The job stops with a Ray OutOfMemoryError

- **Cause:** on unified memory, Ray reads one memory for the whole node, and the node is close to full. Ray stops a worker above its threshold.
- **Check:** the line `Memory on the node ... was 115.86GB / 121.69GB` or similar, and no CUDA out-of-memory error.
- **Fix:** use a smaller model or less work per step, and leave the Ray threshold at its default. A lower engine memory fraction did not help our 4B run. [Section 2.3](#s-stop-ray-killing-the-job) has the details.

## The trainer rejects the attention implementation

- **Cause:** a trainer attention name that the installed transformers library does not accept, such as `triton`.
- **Check:** a `ValueError` that lists the attention implementations transformers accepts.
- **Fix:** pick one from that list. On our GB10 we left the trainer setting at its default.

## Step times change from run to run

- **Cause:** thermal pauses or a lower clock on a hot GPU. We expect the samples and the rewards to stay the same, but we have not tested that.
- **Check:** the pause log of the heat guard from [section 1.2](#s-add-a-watchdog-guard-the-gpu-heat), and the GPU clock during the run.
- **Fix:** time only steps without a pause, and compare times only within one session. [Section 5.3](#s-repeat-a-run) gives the rule.

## The gap at step 0 is far above your range

- **Cause:** the engine and the trainer do not start from the same weights, or they read the same weights in different formats.
- **Check:** compare `train/train_rollout_logprob_abs_diff` at step 0 with your healthy runs. Ours were 0.0148 to 0.0157 for Qwen3-0.6B.
- **Fix:** stop the run before it trains on wrong numbers. Check the checkpoint paths of both sides.

## The engine runs out of memory at start

- **Cause:** `--sglang-mem-fraction-static` does not fit the GPU. With `--colocate`, the trainer can already hold GPU memory when the engine starts. A fraction that is too high leaves no room for activations and CUDA graphs. A fraction that is too low leaves no room for the KV cache.
- **Check:** a CUDA out-of-memory error in the engine lines during startup or on the first batch, and no `Ray OutOfMemoryError`. A fraction that is too low does not always stop the engine. Read `#tokens` in the `KV Cache is allocated` line. In our check at 0.02, the engine started with 3,082 tokens, and the first rollout took 386 s against 61 s at 0.25.
- **Fix:** lower the fraction for the first case, or raise it for the second, by 0.05 or 0.1 at a time. The Miles documentation asks for 0.8 or lower with `--colocate`. Our runs used 0.4. [SGLang 101, section 3.2](https://aiengineeringfromscratch.com/manual-sglang-101.html#s-mem-fraction-static-and-startup-sizing) explains how the engine divides its memory.

## A reward function with fractions moves a group that should stay still

- **Cause:** a report in the tracker shows that a group of 16 answers, each scored 0.3, got small nonzero advantages from float32 rounding. Binary rewards of 0 and 1 do not hit this.
- **Check:** a group where every answer has the same reward but the advantages are not 0.
- **Fix:** use rewards that a float32 can hold exactly, or check the advantages of such groups yourself.

## Training goes wrong after offload on FSDP

- **Cause:** a report in the tracker shows that offloading the trainer state with FSDP2 on two or more GPUs can corrupt shards of uneven size.
- **Check:** nonfinite values, a jump in the loss or the gradient norm, or a collective timeout after the first offload. The model has layers that do not split evenly across ranks.
- **Fix:** run once with `--no-offload-train` and compare. Follow the issue for the code fix.

## The weight update fails on many GPUs

- **Cause:** two reports in the tracker. A colocated update with pipeline stages crashed in NCCL 2.29 and 2.30 with a tuner plugin, and NCCL 2.31 fixed it. Deterministic serving on two GPUs set a different number of NCCL channels than the trainer, and the transfer failed with a size mismatch.
- **Check:** a segmentation fault or a `Message truncated` error during the weight update.
- **Fix:** update NCCL to 2.31 or later for the first case. For the second case, turn off deterministic serving on multi-GPU engines until a fix is released.

## Rollout gets slow with hundreds of open requests

- **Cause:** a report in the tracker measured a client cost that grows with the number of open requests. It was 4.8 s at 256 open requests and 43.7 s at 1,536.
- **Check:** rollout time that grows faster than the number of samples.
- **Fix:** keep the number of open requests per engine lower, or follow the issue for the client change.

## The launcher stops a Ray cluster you started yourself

- **Cause:** a report in the tracker shows that six agent example launchers stop every process with `sglang` in its command line. With `MILES_SCRIPT_EXTERNAL_RAY=1`, that stops your Ray cluster too.
- **Check:** your other Ray jobs stop when a Miles run ends.
- **Fix:** remove the cleanup from those launchers, or give Miles its own Ray cluster until the issue is fixed.

```takeaways
- Start from the first symptom in the log, and read the engine lines before the trainer lines.
- Add a watchdog to every unattended run.
- Treat entries from the issue tracker as reports to check, not as results we measured.
```

Sources: Miles training backend documentation at main 08752a12; SGLang memory sizing code in the image build 0.5.22.dev46; capture/gpu/out-gb10/engine-died-503.log; capture/gpu/out-gb10/engine-died-count.txt; capture/gpu/out-gb10/503-bursts.txt; capture/gpu/out-gb10/ray-oom-4b.log; capture/gpu/out-gb10/thermostat.log; capture/gpu/summary/miles-gb10-lab.json; manuals/sglang-101/capture/gpu/out-miles/true-on-policy-error.log; Miles issues 3649, 3714, 4003, 4019, 4134, 4238; capture/gpu/out-gb10/custom-rm-noenv-hang.txt (live check, 2026-10-23); capture/gpu/out-gb10/frac-low-kv.txt (live check, 2026-10-23).
