# Evidence: cheatsheets/vllm-serving.md

Abbreviations: A = manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, B = manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md, C = manuals/vllm-101/sections/8-1-why-vllm-runs-three-kinds-of-process.md, D = manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md, E = manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md, F = manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md, G = manuals/vllm-101/sections/r-1-flags-and-defaults.md

## Serving stack (architecture, 6 nodes, 5 edges)
- Client, curl request to the chat route: A:108
- API server, HTTP and tokenizer: C:11
- Engine core, scheduler: C:12
- GPU worker, weights and forward pass: C:13
- KV block pool, 16-token blocks: E:9
- Metrics, /metrics endpoint: B:52
- Edge client to API, HTTP: A:108
- Edge API to engine, requests: C:5
- Edge engine to GPU, one step: D:11
- Edge engine to KV, allocate: E:15
- Edge API to metrics, read: B:52

## One request (flow, 4 steps)
1. Budget set by --max-num-batched-tokens: D:9
2. Running requests get tokens first: D:11
3. Waiting requests admitted, --max-num-seqs limit: D:12
4. Memory full, request stopped and computed again: D:30

## Start the server (annotated-code, 5 lines)
- uv venv --python 3.12 --seed: A:32
- source .venv/bin/activate: A:33
- uv pip install vllm==0.31.0 --torch-backend=auto: A:34
- vllm serve with --reasoning-parser qwen3 and tee: A:63
- curl /v1/models: B:31

## Tasks (task-table, 5 rows)
- Install vLLM 0.31.0: A:34
- Start with the reasoning parser: A:63
- Health route curl -i: B:10
- Model list curl: B:31
- Thinking off JSON field: A:110

## Commands (command-table, 3 rows)
- vllm --version: A:54
- docker logs: A:52
- nvidia-smi query fields: A:12

## Defaults (defaults, 8 rows)
- --host, every network interface: G:13
- --port 8000: G:14
- --gpu-memory-utilization 0.92: G:26
- --max-num-batched-tokens 2048 and 8192 from 70 GiB: G:37
- --max-num-seqs 256 and 1024 from 70 GiB: G:38
- --block-size 16: G:29
- --kv-cache-dtype auto: G:30
- -O0 to -O3, default -O2: G:57

## Key terms (concepts, 2 bullets)
- Prefix hash chain: E:15
- Preemption by recompute: D:30

## Troubleshooting (troubleshooting, 6 rows)
- KV cache and maximum length, fix --max-model-len: F:39, 41
- nvcc missing, install toolkit and set CUDA_HOME: F:57, 59
- FP8 KV cache crash, --attention-backend TRITON_ATTN: F:51, 53
- Long thinking block, --reasoning-parser qwen3: F:153, 155
- HTTP 400 maximum context, shorter prompt: F:101, 103
- Second benchmark run faster, reset prefix cache and new seed: F:179, 181

## Glossary (glossary, 4 terms)
- API server: C:11
- Engine core: C:12
- Block: E:9
- Preemption: D:30

## Questions (qa, 4 bullets)
- /health does not generate a token: B:26
- Empty answer with finish_reason length: A:115
- Running requests take budget first: D:11
- No memory reserved per request: E:11

## Tips (tips, 4 bullets)
- tee server.log and read startup lines: A:68
- Install CUDA toolkit on the pip path: A:56
- Health route for liveness: B:26
- Read the symptom section first: F:3
