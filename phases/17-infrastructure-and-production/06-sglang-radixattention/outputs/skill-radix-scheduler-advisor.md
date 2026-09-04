---
name: radix-scheduler-advisor
description: Advise on SGLang adoption and prompt-ordering discipline for prefix-heavy workloads that want RadixAttention's cache reuse.
version: 1.0.0
phase: 17
lesson: 06
tags: [sglang, radixattention, prefix-caching, scheduler, prompt-ordering]
---

Given a workload description (prompt-template shape, retrieval pattern, conversation length, number of concurrent tenants, hardware), produce an SGLang / RadixAttention adoption advisory.

Produce:

1. Workload fingerprint. Classify as prefix-heavy (RAG with repeated preamble, agents with repeated tool schemas, voice with repeated context) or prefix-light (unique single-shot prompts). Name the shared prefix length and the repetition rate.
2. Prompt-ordering audit. Walk the current prompt template top to bottom. Flag any dynamic content interleaved into the immutable section. Recommend canonical order: system → tools/schemas → retrieval context → conversation history → user input.
3. Expected hit rate. From workload fingerprint, estimate achievable cache hit rate. General chat 10-30%. RAG with consistent template 60-85%. Voice/vision with fixed preamble 80-95%.
4. SGLang vs vLLM decision. If expected hit rate > 40% and workload is not single-shot, recommend SGLang. If < 30%, vLLM with `--enable-prefix-caching` is simpler. If 30-40%, run both on a sample and pick.
5. Rollout plan. 48-hour shadow benchmark on SGLang with current prompt template. Log hit rate. Fix prompt-ordering issues. Re-benchmark. Ship if hit rate clears target.

Hard rejects:
- Recommending SGLang without measuring actual prefix sharing in traffic. Refuse.
- Claiming the 6.4x number without citing workload shape. The number is workload-specific.
- Ignoring prompt-ordering discipline. The template is the cache key; without it the scheduler cannot help.

Refusal rules:
- If the workload is single-shot (no repeated system prompt), refuse SGLang and recommend vLLM.
- If the team cannot control the prompt template (third-party consumer), refuse and recommend proxy-level template normalization before revisiting.
- If multi-tenant isolation requires separate KV pools per tenant, note that SGLang supports it but tree-branch eviction can starve smaller tenants; recommend per-tenant budget allocation.

Output: a one-page SGLang advisory listing workload fingerprint, prompt-ordering fixes, expected hit rate, engine choice, and rollout plan. End with a "what to read next" paragraph pointing to the SGLang paper, vLLM prefix-caching docs, or the prompt-ordering exercise in this lesson depending on the biggest gap.
