# Troubleshoot by symptom

> Most failures have a known cause that one log line or one metric shows.

Something is wrong and you know what you see, not why. When you finish this section, you can match the symptom to a cause, run one check, and apply one fix.

Find your symptom in the list. Each entry gives the likely cause, the check that confirms it, and the fix. Issue numbers refer to the vLLM repository, with their state at version 0.31.0. The entries marked "from the vLLM documentation" come from the vLLM troubleshooting guide at 0.31.0, and we did not reproduce them.

```figure
id: fig-7-1
kind: decision
title: symptom to page
claim: Start from the symptom, check one number or log line, and then go to the page that fixes it.
caption: Each row is one entry below, in the same order. Read the symptom, the first check, and where the fix is. From our runs, the vLLM issues, and the vLLM documentation.
```

## The server does not start

### The start hangs while it downloads the model

- **Cause:** the download is slow, or the model needs a Hugging Face token. From the vLLM documentation.
- **Check:** the log stops before the `Model loading took` line, and the Hugging Face cache folder grows slowly or not at all.
- **Fix:** download the model first with the `hf download` command, and set `HF_TOKEN` for a model with restricted access. Then set `HF_HUB_OFFLINE=1`, so vLLM uses the local copy only.

### The start stops with a message that the model is not supported

- **Cause:** the model architecture is not in vLLM 0.31.0, or a missing package stops vLLM from importing the model code. From the vLLM documentation.
- **Check:** the error names the architectures that failed, such as `Model architectures [...] are not supported for now` or `failed to be inspected`.
- **Fix:** check the supported models list for your version. If the model is in the list, read the log above the error for an import failure.

### The start stops with a message about the driver or the PTX toolchain

- **Cause:** the CUDA build of vLLM is newer than your NVIDIA driver supports. From the vLLM documentation.
- **Check:** the error says `The NVIDIA driver on your system is too old`, or that the PTX was compiled with an unsupported toolchain.
- **Fix:** update the driver. In the official image, on some datacenter GPUs, `-e VLLM_ENABLE_CUDA_COMPATIBILITY=1` turns on the CUDA compatibility libraries.

### The start stops with a message about the KV cache and the maximum length

- **Cause:** one request at `--max-model-len` needs more KV cache than is left after the weights.
- **Check:** the error gives the largest length that fits.
- **Fix:** set `--max-model-len` to your longest request. [The startup page](#s-fix-out-of-memory-at-startup) has the details.

### The start stops with a message about free memory and the memory fraction

- **Cause:** another process holds GPU memory, so the share you asked for is not free.
- **Check:** run `nvidia-smi` and look at the processes on the GPU.
- **Fix:** lower `--gpu-memory-utilization` below the free share, or stop the other process.

### The server crashes at start after you set an FP8 KV cache

- **Cause:** the FP8 cache moved vLLM to the FlashInfer backend, and FlashInfer could not compile its kernels. Issue 60262 tracks this, and it is open.
- **Check:** find the line that names the attention backend, and the FlashInfer error after it.
- **Fix:** add `--attention-backend TRITON_ATTN`. [The FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) shows our case.

### The first start stops with a message that nvcc is missing

- **Cause:** FlashInfer compiles its kernels at the first start, and the host has a driver but no CUDA toolkit. We saw this on a new uv install of 0.31.0 on our L4 node.
- **Check:** the error comes from `flashinfer/jit/cpp_ext.py` and says `Could not find nvcc and default cuda_home='/usr/local/cuda' doesn't exist`.
- **Fix:** install a CUDA toolkit, set `CUDA_HOME` to it, and start again. Or use the official image, which has the toolkit.

### The sampler fails to compile after you set CUDA_HOME

- **Cause:** the toolkit on the host does not match the CUDA build of PyTorch, so the FlashInfer sampler cannot compile. With a host toolkit at nvcc 13.4, we saw this on our L4 node.
- **Check:** the error says `CUDA compiler and CUDA toolkit headers are incompatible`.
- **Fix:** install the toolkit version that matches your PyTorch build. Or start with `VLLM_USE_FLASHINFER_SAMPLER=0`, as [the FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) does.

### A DGX Spark runs out of memory although the fraction leaves room

- **Cause:** on unified memory, `--gpu-memory-utilization` does not always limit what vLLM takes. Issue 46307 reports about 112 GiB in use at a fraction of 0.70, and it was closed as stale with no fix. Issue 44740 reports a KV cache that was too large with MTP speculation on the GB10, and it is open.
- **Check:** compare the `Available KV cache memory` line with the share you expect, and watch `free -g` during the start.
- **Fix:** set the cache size in bytes with `--kv-cache-memory-bytes`. [The DGX Spark page](#s-size-memory-on-a-dgx-spark) has the details.

### The first start on a DGX Spark takes many minutes

- **Cause:** the weight load copies each tensor from the file map, and that copy is slow on the GB10. Issue 58726 tracks this, and it is open.
- **Check:** read the `Model loading took` line. Our 57 GiB load took 330 seconds.
- **Fix:** keep the weights on a local drive and keep the server running. [The DGX Spark page](#s-size-memory-on-a-dgx-spark) has the details.

### The start fails in the compile step

- **Cause:** a broken compile cache, or a Triton library that does not match your PyTorch. From the vLLM documentation.
- **Check:** the error comes from `torch.compile` or from the `torch/_inductor` folder.
- **Fix:** start once with `VLLM_DISABLE_COMPILE_CACHE=1`. If that works, delete `~/.cache/vllm/torch_compile_cache`. Use `-O0` to start without the compile while you debug.

### A server on several GPUs hangs at start

- **Cause:** the GPUs cannot reach each other through NCCL, because of the network, the drivers, or a missing shared memory mount. From the vLLM documentation.
- **Check:** start again with `NCCL_DEBUG=TRACE` and read where the log stops. Run the NCCL test that [the parallelism page](#s-choose-tensor-pipeline-or-data-parallelism) describes.
- **Fix:** give a container `--ipc=host` or a large `/dev/shm`. On PCIe machines, the vLLM guide suggests `NCCL_CUMEM_HOST_ENABLE=0` or a driver update for a peer access error.

### The maximum length is shorter after an upgrade

- **Cause:** release 0.30.0 changed how vLLM reads context scaling such as YaRN, and some models now get a shorter derived length.
- **Check:** compare the derived length in the startup log with the old one.
- **Fix:** set `--max-model-len` yourself, after you confirm that the model supports the length.

## Requests fail while the server runs

### A request returns HTTP 400 about the maximum context length

- **Cause:** the prompt tokens plus `max_tokens` are more than `--max-model-len`.
- **Check:** the error says `This model's maximum context length is` and gives the counts. When `max_tokens` alone is above the limit, the error says that `max_tokens` cannot be greater than `max_model_len`, as it did on our L4.
- **Fix:** send a shorter prompt or a smaller `max_tokens`, or start the server with a larger maximum length if the pool allows it.

### Every request fails after an error in the engine

- **Cause:** the engine core process stopped, for example after a GPU error. The API server stays up, but it cannot serve. From the vLLM source.
- **Check:** the log shows `EngineCore encountered an issue`, and the real error is in the lines above it.
- **Fix:** fix the cause in the earlier lines, then restart the server. Let your orchestrator restart it, because the server does not recover alone.

## The server is slow

### The first token takes seconds, but the stream is fast after it

- **Cause:** requests wait in the queue because the pool or the batch is full.
- **Check:** `vllm:num_requests_waiting` is above 0 and `vllm:kv_cache_usage_perc` is near 1.
- **Fix:** serve fewer users on the GPU, or make room in the pool with an FP8 KV cache or a shorter maximum length.

### The stream has long gaps when many users are active

- **Cause:** new prompts share decode steps with running requests, and long prompts take a large part of each step.
- **Check:** compare the P99 ITL with the median ITL. A large gap means stalls, not a slow GPU.
- **Fix:** lower the token budget, as [the token budget page](#s-keep-long-prompts-from-stalling-short-ones) shows. On our machines the gaps also depended on the prompt lengths and on the engine, as [the engine page](#s-decide-between-vllm-and-sglang) shows.

### The preemption counter rises

- **Cause:** a running request needed a new block and none was free. vLLM stops the request and computes it again later.
- **Check:** `vllm:num_preemptions_total` rises, and the periodic log line shows a preemption count.
- **Fix:** raise `--gpu-memory-utilization`, or lower `--max-num-seqs` or `--max-num-batched-tokens`.

### N-gram speculation gives less than you expected

- **Cause:** at 0.31.0, the n-gram method makes vLLM use the older model runner, and it turns off async scheduling.
- **Check:** the startup log has a warning that async scheduling is off.
- **Fix:** compare it with no speculation on your traffic, with the same model runner on both sides.

### The first requests after a start in eager mode are slow

- **Cause:** since 0.31.0, `--enforce-eager` also turns off the warmup that compiles kernels at startup, so the first requests compile them.
- **Check:** the first few requests are slower than the rest.
- **Fix:** send a few warmup requests before you serve traffic, or use `-O0` instead.

### NVFP4 decode is slower on a DGX Spark than on older releases

- **Cause:** issue 59770 reports a slower decode for one NVFP4 model on the GB10 since 0.29.0. It is open.
- **Check:** compare the time per token on your version and on 0.28.
- **Fix:** pin the faster release for that model until the issue closes.

## The output is wrong

### The answer starts with a long thinking block

- **Cause:** a reasoning model, such as Qwen3, runs without a reasoning parser.
- **Check:** the `content` field starts with `<think>`.
- **Fix:** start the server with the parser for the model, such as `--reasoning-parser qwen3`. [The reasoning models page](#s-serve-reasoning-models) has the details.

### The model repeats one token after a prefix-cache hit

- **Cause:** issue 60174 reports corrupt output on 0.30 and 0.31 when DFlash2 or DSpark speculation runs with the prefix cache. From the third request, each answer that starts from cached blocks is one token, over and over. It was closed on 2026-10-22, after 0.31.0, so check that your version has the fix.
- **Check:** the problem starts only after a cache hit, and it goes away with `--no-enable-prefix-caching`.
- **Fix:** turn off the prefix cache or the speculation method for that model.

### JSON output is invalid with speculative decoding on

- **Cause:** a JSON schema and a speculation method can disagree on the next tokens. Issue 60830 showed this for MTP on one model, and it is closed.
- **Check:** run the same requests without `--speculative-config`.
- **Fix:** upgrade, or turn off speculation for JSON traffic.

### The output changes from run to run

- **Cause:** vLLM does not promise the same output by default. The batch that a request joins changes the order of the sums. A prefix-cache hit can also change a greedy output. In our runs with Qwen3-0.6B at one user, a warm cache changed 11 of 32 greedy outputs. That GPU was a shared L4 with no clock lock. A change of dtype, such as BF16 to FP16, also changes most outputs.
- **Check:** send the same request alone twice. If the answers match, the batch causes the change. If they differ, the second request can hit the prefix cache. Repeat the test with `--no-enable-prefix-caching`. If the answers now match, the cache causes the change.
- **Fix:** offline, set `VLLM_ENABLE_V1_MULTIPROCESSING=0`. Online, the batch-invariant mode helps, but at 0.31.0 it does not cover every path. Reset the prefix cache between runs that you compare. [The reproducibility page](#s-get-reproducible-outputs) covers it.

## The benchmark is wrong

### The second benchmark run is faster than the first

- **Cause:** with a fixed seed, the random dataset sends the same prompts again, and the prefix cache serves them. In our test with Qwen3-0.6B at 16 users, a repeat with no reset read a median TTFT about 6 times lower. That GPU was a shared L4 with no clock lock.
- **Check:** `vllm:prefix_cache_hits_total` rises during the second run.
- **Fix:** reset the prefix cache before each run, use a new seed, and record the cached tokens. [The benchmark page](#s-benchmark-your-server-in-15-minutes) gives the protocol. The `POST /reset_prefix_cache` route exists only with `VLLM_SERVER_DEV_MODE=1`, so use it only on a server that is not exposed.

```takeaways
- Read the last log lines and the waiting and cache metrics before you change a flag.
- Check the open issue for your model, GPU, and version before you blame your setup.
- Test one change at a time, with the same benchmark and clock.
```

Sources: vLLM issues 44740, 46307, 58726, 59770, 60174, 60262, and 60830; the release notes for v0.30.0, v0.31.0, and v0.32.0; vLLM documentation at v0.31.0 (docs/usage/troubleshooting.md, docs/design/torch_compile.md, docs/configuration/optimization.md, docs/usage/reproducibility.md, docs/benchmarking/cli.md, docs/features/reasoning_outputs.md); the vLLM source at v0.31.0 (vllm/config/vllm.py, vllm/config/model.py, vllm/renderers/params.py, vllm/v1/engine/exceptions.py, vllm/envs.py); capture/gpu/out-gb10/server-load-vllm.log; Same Request, Different Answer: Quantization Amplifies Cache-Induced Divergence in LLM Serving (arXiv 2609.04748, 2026), capture/gpu/out-l4/livecheck-2026-10-22.txt, capture/gpu/out-l4/prefix-cache-flush.txt, capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt, capture/gpu/out-l4/livecheck-2026-10-23.txt.
