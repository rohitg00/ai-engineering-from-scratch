# Glossary

> Each term below has one meaning across the manual and names the section that defines it.

Every term is defined once, in the section the last column names. The meanings come from the SGLang source at the tag, the captures, and the papers that the sections cite.

| Term | Meaning in this manual | Defined in |
|---|---|---|
| Acceptance length | The number of tokens committed per verify pass: the accepted draft tokens plus one bonus token | [4.4](#s-speculative-decoding) |
| Attention backend | The class that computes attention over the paged KV cache for one batch | [4.2](#s-attention-backend) |
| Attention data parallelism | Inside one TP group, the attention layers run data parallel while the feed-forward or expert layers stay split across all GPUs | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Batch invariance | A kernel property: the result for one row does not depend on the other rows, because the reduction order is fixed | [4.6](#s-deterministic-inference-and-logprobs) |
| Bootstrap room | The number that a prefill server and a decode server use to find each other's half of one request | [6.3](#s-prefill-decode-disaggregation) |
| Breakable graph | A capture that ends a segment at each op that must run eagerly, runs that op, and starts the next segment | [4.1](#s-forwardmode-and-cuda-graphs) |
| Capture bucket | One batch size that SGLang records a decode graph for at startup | [4.1](#s-forwardmode-and-cuda-graphs) |
| Concurrency (benchmark) | The sum of the end-to-end latency of every request divided by the run duration | [5.1](#s-sglang-benchmark-serving) |
| Constrained decoding | Removing every token that would break the grammar before the sampler picks one | [4.5](#s-structured-outputs-with-xgrammar) |
| Counter | A Prometheus total that only grows, read with a rate over a window | [5.2](#s-the-metrics-endpoint) |
| CUDA graph | A record of kernel launches with fixed shapes and addresses that the GPU replays with one CPU call | [4.1](#s-forwardmode-and-cuda-graphs) |
| Data parallelism (DP) | Several complete copies of the model, each with its own requests and its own KV cache | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Decode | The loop that produces each next token, one forward pass per token per request | [1.3](#s-what-the-server-does-with-your-request) |
| DetokenizerManager | The process that turns output token ids into text and sends it back to the TokenizerManager | [2.1](#s-sglang-serve-and-the-three-processes) |
| Draft model | A small model or head that proposes the next few tokens cheaply | [4.4](#s-speculative-decoding) |
| EPLB | The expert parallelism load balancer, which records expert use and moves experts between GPUs | [6.2](#s-moe-serving-deepep-and-eplb) |
| Expert parallelism (EP) | The experts of each MoE layer are divided among GPUs, and tokens move to the experts | [6.2](#s-moe-serving-deepep-and-eplb) |
| ForwardMode | The label on a batch that tells the model runner what kind of pass to run | [4.1](#s-forwardmode-and-cuda-graphs) |
| Gauge | A value the scheduler overwrites on each log interval, so a scrape sees the latest value only | [5.2](#s-the-metrics-endpoint) |
| GEMM backend | The kernel library that multiplies quantized weights | [4.3](#s-quantization) |
| Goodput | Requests per second that meet a TTFT target and a TPOT target at the same time | [1.3](#s-what-the-server-does-with-your-request) |
| Grammar queue | The list of requests whose grammar is still compiling | [4.5](#s-structured-outputs-with-xgrammar) |
| Grouped-query attention | Several query heads share one key and value head, so a model has fewer KV heads than attention heads | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |
| HiCache | The hierarchical cache, which extends the radix tree from GPU memory to host memory and to storage | [3.5](#s-eviction-policies-and-hicache) |
| Histogram | A set of counters, one per bucket, from which you read percentiles with a rate over a window | [5.2](#s-the-metrics-endpoint) |
| ITL | Every gap between two streamed chunks, pooled across all requests | [5.1](#s-sglang-benchmark-serving) |
| KV cache | The stored keys and values of every earlier token, for every layer, kept so that decode does not compute them again | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |
| KV cache dtype | The format of the cached keys and values | [4.3](#s-quantization) |
| KV pool | The memory that holds the keys and values of every token the server keeps | [1.2](#s-check-that-the-server-is-healthy) |
| L1, L2, L3 | The HiCache tiers: the GPU pool, a pool in pinned host memory, and an optional shared storage backend | [3.5](#s-eviction-policies-and-hicache) |
| Logprob | The log probability of a token under the distribution the server sampled from | [4.6](#s-deterministic-inference-and-logprobs) |
| Mamba layer | A state-space or linear-attention layer that keeps one fixed-size state per sequence | [3.6](#s-hybrid-models-and-the-cache) |
| Match rate | The characters of a new request that match the gateway tree, divided by the request length | [6.4](#s-sgl-model-gateway) |
| Memory release | `POST /release_memory_occupation` frees GPU memory by tag, and `POST /resume_memory_occupation` gives it back | [7.2](#s-sglang-as-an-rl-rollout-engine) |
| Model world | The set of GPUs that together hold one copy of the model | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Multi-head latent attention (MLA) | DeepSeek attention, which stores one compressed latent per token in place of keys and values per head | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |
| Native API | The SGLang endpoints, mainly `POST /generate` | [2.5](#s-streaming-stop-strings-and-the-openai-api) |
| New token ratio | The share of remaining output that the scheduler expects a running request to use | [2.3](#s-admission-and-retraction) |
| Offline quantization | The checkpoint already stores low-bit weights and their scales | [4.3](#s-quantization) |
| Online quantization | SGLang converts full-precision weights at load time | [4.3](#s-quantization) |
| OpenAI API | The `/v1/chat/completions`, `/v1/completions`, and `/v1/models` endpoints in the OpenAI format | [2.5](#s-streaming-stop-strings-and-the-openai-api) |
| Overlap scheduling | Running the CPU work for one batch at the same time as the GPU work of another batch | [2.4](#s-the-overlap-scheduler) |
| Pause and resume | `POST /pause_generation` with a mode, whose default `abort` ends every running request | [7.2](#s-sglang-as-an-rl-rollout-engine) |
| Peak concurrent requests | The largest count of requests active at any point inside one second of a benchmark run | [5.1](#s-sglang-benchmark-serving) |
| Pipeline parallelism (PP) | Whole layers go to different GPUs in order, and `--pp-size` sets the number of stages | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Prefill | The forward pass over the whole prompt, which computes its keys and values and the first output token | [1.3](#s-what-the-server-does-with-your-request) |
| Prefill-decode disaggregation (PD) | Two kinds of SGLang servers, one for prefill and one for decode, with KV moved between them | [6.3](#s-prefill-decode-disaggregation) |
| RadixCache | A radix tree over token sequences whose nodes hold the KV slot indices of the tokens on their edges | [3.3](#s-radixcache) |
| ReqToTokenPool | A table with one row per running request and one column per token position | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |
| Retraction | Removing running requests from the decode batch to free their KV slots and putting them back in the queue | [2.3](#s-admission-and-retraction) |
| Schedule policy | The rule that orders the waiting queue before admission, set with `--schedule-policy` | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| Scheduler | The separate process that owns the GPU, builds each batch, runs it, and samples | [2.1](#s-sglang-serve-and-the-three-processes) |
| Scheduler loop | The function that runs forever in the scheduler process, one batch per turn | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| Sliding-window attention (SWA) | Attention that reads only the last few thousand tokens | [3.6](#s-hybrid-models-and-the-cache) |
| Stop condition | A rule that ends a request: a stop token, a stop string, a regex, a length limit, an abort, or the end of a grammar | [2.5](#s-streaming-stop-strings-and-the-openai-api) |
| Tail-Optimized LRU (tlru) | An eviction policy that keeps only the part of a conversation that the next turn's latency target needs | [3.5](#s-eviction-policies-and-hicache) |
| Tensor parallelism (TP) | The weight matrices of each layer are cut into `--tp-size` slices, one per GPU | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Throughput | Output tokens per second across all users | [1.3](#s-what-the-server-does-with-your-request) |
| TokenizerManager | The object in the main process that receives each request, applies the chat template, and tokenizes it | [2.1](#s-sglang-serve-and-the-three-processes) |
| TokenToKVPoolAllocator | The free list of KV slots | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |
| TPOT | For each request, the time after the first token divided by the remaining output tokens | [5.1](#s-sglang-benchmark-serving) |
| TreeNode | One node of the radix tree, with its children keyed by their first token and the token run on its edge | [3.3](#s-radixcache) |
| TTFT | The time from sending a request to receiving the first streamed chunk | [5.1](#s-sglang-benchmark-serving) |
| Two-batch overlap (TBO) | The scheduler cuts a batch into two micro-batches, so one runs attention while the other waits on communication | [6.2](#s-moe-serving-deepep-and-eplb) |
| Verify pass | One forward of the target model over all proposed tokens, which accepts the longest matching prefix and adds one token | [4.4](#s-speculative-decoding) |
| Weight quantization | Storing the model weights in fewer bits, such as FP8, FP4, or INT4 | [4.3](#s-quantization) |
| Weight-update session | `begin_weight_update`, one or more `update_weights_from_*` calls, then `end_weight_update` | [7.2](#s-sglang-as-an-rl-rollout-engine) |

Sources: the term definitions in every file under sections/; front.md.
