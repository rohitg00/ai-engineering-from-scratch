# vLLM Serving Internals: PagedAttention, Continuous Batching, Chunked Prefill

> vLLM's dominance in 2026 rests on three compounding defaults, not a single trick. PagedAttention is always on. Continuous batching injects new requests into the active batch between decode iterations. Chunked prefill slices long prompts so decode tokens never starve. Turn all three on and a Llama 3.3 70B FP8 on one H100 SXM5 pushes 2,200-2,400 tok/s at 128 concurrent — roughly 25% above vLLM's own default and 3-4x a naive PyTorch loop. This lesson reads the scheduler and attention kernel at a level you can diagram, and ends with a toy continuous batcher in `code/main.py` that schedules prefill and decode the way vLLM does.

**Type:** Learn
**Languages:** Python (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Learning Objectives

- Explain PagedAttention as a KV cache allocator: blocks, block tables, and why fragmentation stays under 4% at production load.
- Diagram continuous batching at the iteration level: how finished sequences leave the batch and new ones join without draining.
- Describe chunked prefill in one sentence and name which latency metric it protects (hint: it is TTFT tail, not mean throughput).
- Name the 2026 vLLM v0.18.0 gotcha that bites teams enabling every optimization at once.

## The Problem

A naive PyTorch serve loop runs one request at a time: tokenize, prefill, decode until EOS, return. At one user this works. At one hundred, it is a queue of patient people. The obvious fix — static batching — pads every request to the longest prompt in the window, pads every decode to the longest expected output, and stalls the whole batch on the slowest sequence. You pay for padding you never use, and fast requests wait for slow ones.

vLLM solves three problems at once. PagedAttention stops KV cache fragmentation from eating 60-80% of GPU memory the way classic contiguous allocation does. Continuous batching lets requests join and leave the batch between each decode iteration, so the batch is always full of real work. Chunked prefill breaks a 32k-token prompt into ~512-token slices that interleave with decode, so a long prompt does not freeze every decode token on the GPU.

The 2026 production default is all three on. You need to understand what each one does because the failure modes are all on the scheduler, not the model.

## The Concept

### PagedAttention as a virtual memory system

A KV cache is `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element` per sequence. For Llama 3.3 70B at 8192 tokens, that is roughly 1.25 GB per sequence in BF16. If you pre-reserve 8192 slots for every request but the average request only uses 1500 tokens, you waste roughly 82% of the HBM you reserved. Classic batching pays this waste.

PagedAttention borrows the idea from OS virtual memory. KV cache is not contiguous per sequence. It is allocated in fixed-size blocks (default 16 tokens). Each sequence has a block table that maps its logical token positions to physical block IDs. When a sequence grows past its allocated blocks, one more block is added. When it finishes, its blocks return to the pool.

Fragmentation drops from 60-80% (classic) to under 4% (PagedAttention). You do not enable PagedAttention with a flag — it is the only allocator vLLM ships. The knob is `--gpu-memory-utilization` (default 0.9), which tells vLLM how much HBM to reserve for KV blocks after loading weights and activations.

### Continuous batching at the iteration level

The old "dynamic batching" waited for a window (say 10 ms) to fill a batch, then ran prefill + decode + decode + decode until every sequence finished. Fast sequences left early and sat idle while the GPU finished the slow ones.

Continuous batching operates between each decode step. Call the set of running sequences the `RUNNING` list. At each iteration:

1. Any sequence in `RUNNING` that just hit EOS or max_tokens is removed.
2. The scheduler looks at the waiting queue. If there are free KV blocks, it admits new sequences (prefill or resumed).
3. The forward pass runs on whatever is now in `RUNNING`, emitting one new token per sequence.

The batch size is never padded to a fixed number. Sequences at different positions in their output share one fused forward. In 2026 vLLM this is called the `V1 scheduler`. The key invariant: the scheduler runs once per decode iteration, not once per request.

### Chunked prefill protects TTFT tail

Prefill is compute-bound. A 32k-token prompt on Llama 3.3 70B takes ~800 ms of pure prefill on one H100. While prefill runs, decode tokens for every other sequence in the batch wait. In a serving loop, the first-token latency (TTFT) of one long prompt becomes the inter-token latency (ITL) blip for dozens of other users.

Chunked prefill splits prefill into fixed-size chunks (default 512 tokens) and schedules each chunk as a unit. Between chunks the scheduler can advance decode sequences by one token. You trade a small absolute prefill latency hit (a few ms per chunk) for much lower decode-time jitter. P99 ITL under mixed load drops from ~50 ms to ~15 ms in published benchmarks.

### The three defaults interact

All three features assume each other. PagedAttention gives the scheduler a fine-grained KV resource to trade against. Continuous batching needs that fine-grained resource so admitting a new sequence does not force a global reshuffle. Chunked prefill is a decision the scheduler makes on the same `RUNNING` list — it is one more scheduler policy, not a separate system.

You do not need to know every flag. You need to know what the scheduler optimizes: goodput under KV-block budget, subject to chunked prefill slicing.

### The 2026 v0.18.0 gotcha

In vLLM v0.18.0 you cannot combine `--enable-chunked-prefill` with draft-model speculative decoding (`--speculative-model`). The documented exception is N-gram GPU speculative decoding in the V1 scheduler. Teams that flip every flag on without reading the release notes get a run-time error at startup, not a soft regression. If your speculative gain was worth enabling chunked prefill for, revisit the choice — the right answer in 2026 is often EAGLE-3 without chunked prefill, not a draft model plus chunked prefill that does not compile.

### Numbers you should remember

- Llama 3.3 70B FP8, H100 SXM5, 128 concurrent, all three on: 2,200-2,400 tok/s.
- Same model, default vLLM (no chunked prefill): ~1,800 tok/s.
- Same model, naive PyTorch forward loop: ~600 tok/s.
- KV fragmentation waste under PagedAttention at production load: <4%.
- P99 ITL under mixed load: ~15 ms with chunked prefill, ~50 ms without.

### What the scheduler looks like

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py` is exactly this loop in stdlib Python with fake token counts and fake forward latency. Running it shows how chunked prefill keeps decode sequences alive during a long prefill.

## Use It

`code/main.py` simulates a vLLM-style scheduler with toggleable features. Run it to see:

- `NAIVE` mode: one request at a time, no batching.
- `STATIC` mode: pad and wait, classic batching.
- `CONTINUOUS` mode: iteration-level admission and release.
- `CONTINUOUS + CHUNKED` mode: prefill slices interleaved with decode.

The output shows total throughput (tokens per virtual second), TTFT mean, and P99 ITL. The `CONTINUOUS + CHUNKED` row should dominate on mixed traffic.

## Ship It

This lesson produces `outputs/skill-vllm-scheduler-reader.md`. Given a serving config (batch size, KV memory utilization, chunked prefill size, speculative config), it produces a scheduler diagnosis that names which of the three defaults is bottlenecking and what to tune.

## Exercises

1. Run `code/main.py`. Compare `STATIC` to `CONTINUOUS` on a workload with mixed short and long requests. Where does the throughput gap come from — prefill efficiency, decode efficiency, or tail latency?
2. Modify the toy scheduler to add `--max-num-batched-tokens`. What is the right value for an H100 running Llama 3.3 70B FP8? (Hint: it is a function of KV block size and number of free blocks, not raw HBM.)
3. Re-read the vLLM v0.18.0 release notes. Which combinations of flags are mutually exclusive? List them.
4. Compute the KV cache fragmentation waste for a trace of 1,000 requests with mean 1,500 output tokens, std 600 tokens, under (a) contiguous per-request allocation at 8192 max, (b) PagedAttention with 16-token blocks.
5. Explain in one paragraph why chunked prefill helps P99 ITL but not throughput in isolation. Where does the throughput win come from in practice?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Tokens/sec where every request still hit TTFT and ITL targets |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; N-gram spec decode is the chunked-prefill-compatible path |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Further Reading

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) — official source on chunked-prefill and speculative-decoding compatibility.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 release cadence and version-specific behavior.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — the original write-up that still defines how to think about the allocator.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — fragmentation analysis and scheduler design.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — detailed V1 scheduler walkthrough with flame graphs.
