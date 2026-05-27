# SGLang and RadixAttention for Prefix-Heavy Workloads

> SGLang treats the KV cache as a first-class, reusable resource stored in a radix tree. Where vLLM schedules requests FCFS (first-come, first-served), SGLang's cache-aware scheduler prioritizes requests with longer shared prefixes — effectively a depth-first radix traversal so hot branches stay resident in HBM. On Llama 3.1 8B with ShareGPT-like 1K prompts, SGLang hits ~16,200 tok/s to vLLM's ~12,500, a ~29% edge. On prefix-heavy RAG workloads the advantage reaches 6.4x. On voice-cloning-shaped workloads cache hit rate cleared 86%. Deployed on 400,000+ GPUs in 2026 across xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. The gotcha is that the 6.4x number evaporates when prefix ordering is inconsistent — ordering is the engineer's lever.

**Type:** Learn
**Languages:** Python (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Learning Objectives

- Diagram RadixAttention: how prefixes are stored in a radix tree and how KV blocks are shared across sequences rooted at the same branch.
- Explain cache-aware scheduling and why FCFS is wrong for prefix-heavy traffic.
- Compute expected speedup for a workload given prefix-cache hit rate and prompt length distribution.
- Name the prompt-ordering discipline that makes the 6.4x number real vs a lost upside.

## The Problem

Classic serving treats each request's prompt as opaque. Even when 5,000 RAG requests all start with the same 2,000-token system prompt plus same retrieval preamble, vLLM prefills that 2,000-token prefix 5,000 times. The GPU does the same work over and over.

The observation: prompts in agentic and RAG workloads share long prefixes almost always. System prompt, tool schemas, few-shot examples, retrieval headers, conversation history — all repeat across requests. If you stored the KV cache for that prefix once and reused it, you would not prefill it again.

RadixAttention does exactly this. Tokens are indexed in a radix tree; each node owns KV blocks for the token sequence on its path from root. A new request walks the tree: any node whose token matches re-uses that node's KV blocks. Prefill cost becomes proportional to the "new" suffix, not the full prompt.

The challenge is scheduling. If two requests share a 2,000-token prefix and a third shares only 200 tokens of the same prefix, you want to serve the two long-shared requests together so the long prefix stays in HBM. FCFS does the opposite — it serves whoever arrived first, potentially evicting the hot branch before the next long-prefix request hits.

## The Concept

### The radix tree as a KV index

A radix tree (compact trie) stores token sequences. Each node owns a token range and the KV blocks computed for that range. Children extend the sequence one or more tokens.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

A new request comes in with system prompt + "Context: <doc A>" + "Question: Carol". The scheduler walks: system prefix matches (124 blocks reused), doc-A branch matches (31 blocks reused), then allocates fresh blocks only for "Question: Carol" (4 blocks). Prefill cost: 4 blocks of new tokens. Without the tree: 160 blocks. ~40x savings on prefill.

### Cache-aware scheduling

Radix-tree-backed reuse is pointless if the cache churns. Two key policies:

1. **Depth-first dispatch**. When picking the next request from the queue, prefer requests rooted at the same branch as the current running set. This keeps the hot branch pinned.
2. **LRU at branch level, not block level**. Evict whole branches (starting from shortest-used leaves) rather than individual blocks, so cache shape matches radix shape.

FCFS violates both. A request sharing 2,000 tokens sits behind a request sharing 50, then the 2,000-token branch gets evicted to admit the 50-token one.

### Benchmark numbers you should memorize

- Llama 3.1 8B, H100, ShareGPT 1K prompts: SGLang ~16,200 tok/s vs vLLM ~12,500 (~29% edge).
- Prefix-heavy RAG (same system + same doc, varying question): up to 6.4x on SGLang.
- Voice cloning workloads: 86.4% prefix-cache hit rate.
- Production hit rates across SGLang customers: 50-99% depending on prompt discipline.
- Deployed on 400,000+ GPUs in 2026.

### The ordering gotcha

The 6.4x number relies on consistent prompt-template ordering. If your client constructs prompts as `[system, tools, context, history, question]` in some requests and `[system, context, tools, history, question]` in others, the tree cannot find the shared prefix. What looks like a shared prefix to a human is two distinct sequences to the radix tree.

Engineer's lever: your prompt template is a cache key. Fix the order. Put everything immutable (system, tools, schemas) first. Put retrieval context next. Put user question last. Do not interleave dynamic content into the prefix.

Real case from the research: moving dynamic content out of the cacheable prefix took one deployment from 7% to 74% cache hit rate in one change.

### Where RadixAttention wins and loses

Wins:
- RAG (same retrieval preamble, varying question).
- Agents (same tool schemas, varying query).
- Chat with long system prompt.
- Voice / vision workloads with repeated preambles.

Loses (returns to vLLM-level throughput):
- Single-shot generation with unique prompts (code completion, open-ended chat without system prompt).
- Dynamic prompts where every request interleaves unique content into the prefix.

### Why this is a scheduler problem, not just a kernel problem

You can implement KV reuse as a kernel trick. SGLang's insight is that reuse only pays if the scheduler keeps the hot branch resident. A naive "reuse if available" policy will churn the cache under mixed load. The radix-tree-indexed scheduler is what turns the kernel trick into a 29% production edge.

### Interplay with vLLM

The two systems are not strict competitors. In 2026 vLLM added prefix caching (`--enable-prefix-caching`) and a cache-aware router (vLLM Router in Rust). The gap closed but did not fully disappear — SGLang's whole stack is radix-first; vLLM grafted it on. For workloads dominated by prefix reuse, SGLang remains the default. For general-purpose serving without strong prefix patterns, vLLM remains equal or better.

## Use It

`code/main.py` implements a toy radix-tree KV cache plus a scheduler with two policies: FCFS and cache-aware. Runs the same workload through both, reports prefix-cache hit rate and throughput delta. Then runs a "scrambled ordering" workload to show the 6.4x collapse.

## Ship It

This lesson produces `outputs/skill-radix-scheduler-advisor.md`. Given a workload description (prompt-template shape, retrieval pattern, number of concurrent tenants), it produces a prompt-ordering prescription and a go/no-go for SGLang adoption.

## Exercises

1. Run `code/main.py`. Compare FCFS and cache-aware on the same workload. Where does the delta come from — prefill savings, decode savings, or queue delay?
2. Modify the workload so prompts randomly permute `[system, tools, context]`. Re-run. What happens to hit rate? Why?
3. Compute the HBM cost of keeping a 2,000-token system prompt resident as one radix branch on Llama 3.1 8B. Compare to the cost of a 16-sequence batch without prefix reuse.
4. Read the SGLang RadixAttention paper. Explain in three sentences why tree-shaped LRU eviction beats block-shaped LRU under prefix-heavy load.
5. A customer reports only 8% cache hit rate. Name three likely causes and the diagnostic you would run for each.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Further Reading

- [SGLang GitHub](https://github.com/sgl-project/sglang) — source and docs.
- [SGLang documentation](https://sgl-project.github.io/) — RadixAttention and scheduling details.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — the design reference.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) — benchmark numbers and scheduler rationale.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/prefix_caching.html) — vLLM's own radix-like implementation, for comparison.
