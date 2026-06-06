# Prompt Caching and Semantic Caching Economics

> **Pricing snapshot dated 2026-04.** Numeric claims below reflect vendor rate cards captured at this lesson's publication; verify against the linked docs before quoting them downstream.

> Caching happens at two layers. L2 (provider-level) prompt/prefix caching reuses attention KV for repeated prefixes — Anthropic's prompt-caching docs advertise up to 90% cost reduction and 85% latency reduction on long prompts; for Claude 3.5 Sonnet cache reads are $0.30/M vs $3.00/M fresh with a 5-minute TTL and a 2x write premium for the 1-hour TTL option (docs.anthropic.com, 2026-04). OpenAI prompt caching applies automatically for prompts ≥1024 tokens and prices cached input at roughly a 90% discount vs fresh (platform.openai.com, 2026-04); the exact per-model cached rate depends on the live rate card. L1 (app-level) semantic caching skips the LLM entirely on embedding similarity hits. Vendor "95% accuracy" refers to match correctness, not hit rate — reported production hit rates range from 10% (open-ended chat) up to 70% (structured FAQ); neither provider publishes an official baseline, so treat these as community telemetry rather than guarantees. The production pitfalls: parallelization kills caching (N parallel requests issued before the first cache write can inflate spend several-fold), and dynamic content inside the prefix prevents cache hits entirely. ProjectDiscovery reported moving from 7% to 74% hit rate (2025-11) by moving dynamic text out of the cacheable prefix.

**Type:** Learn
**Languages:** Python (stdlib, toy two-layer cache simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Learning Objectives

- Distinguish L2 prompt/prefix caching (KV reuse at provider) from L1 semantic caching (LLM bypass on similar prompts).
- Explain Anthropic's `cache_control` explicit marking and the two TTL options (5-min vs 1-hour) with their price multipliers.
- Compute expected monthly savings given hit rate, prompt/response mix, and token prices.
- Name the parallelization anti-pattern that inflates bills by 5-10x and the dynamic-content anti-pattern that collapses hit rate.

## The Problem

You add prompt caching to your RAG service. The bill stays flat. You measure the hit rate; it is 7%. Your prompts look static but they are not — the system prompt includes the current date formatted to the minute, a request ID, and a randomized example reorder for diversity. Every request writes a new cache entry, reads zero.

Separately, your agent runs ten parallel tool calls per user question. All ten arrive at the provider before the first cache write completes. Ten writes, zero reads. Your bill is 5-10x what "with caching" was supposed to cost.

Caching is a protocol, not a flag. Two layers, two different failure modes.

## The Concept

### L2 — provider prompt/prefix caching

Provider stores the attention KV for a cacheable prefix and reuses it on the next request that matches the prefix. You pay a write cost once, reads nearly free.

**Anthropic (Claude 3.5 / 3.7 / 4 series)**: explicit `cache_control` marker in the request. You tag which blocks are cacheable. TTL: 5-minute (write costs 1.25x base) or 1-hour (write costs 2x base). Cache reads: $0.30/M on Claude 3.5 Sonnet vs $3.00/M fresh — 10x cheaper (docs.anthropic.com, as of 2026-04). Rates differ per model (Opus/Haiku published separately); always cross-check the live pricing page.

**OpenAI**: automatic caching for prompts ≥1024 tokens (platform.openai.com, 2026-04). No explicit flag. Cached input is roughly 10x cheaper than fresh on current gpt-4o/gpt-5 rate cards. Neither docs nor release notes publish an official hit-rate baseline; community reports cluster around 30–60% with careful prompt design. Monitor `usage.cached_tokens` to measure your own.

**Google (Gemini)**: context caching via explicit API; 1M-token context means caching pays even more.

**Self-hosted (vLLM, SGLang)**: Phase 17 · 06 covers RadixAttention — same pattern at your own compute.

### L1 — app-level semantic caching

Before calling the LLM at all, hash the prompt, embed it, and look for a similar cached request (cosine similarity above threshold, typically 0.95+). On hit, return the cached response. On miss, call LLM and cache the result.

Open-source: Redis Vector Similarity, GPTCache, Qdrant. Commercial: Portkey Cache, Helicone Cache.

Vendor accuracy claims refer to how often the returned cached response was semantically appropriate — not how often you hit. Production hit rates:

- Open-ended chat: 10-15%.
- Structured FAQ / support: 40-70%.
- Code questions: 20-30% (small variants kill hits).
- Voice agents repeating prompts: 50-80% (voice normalization fixed set).

### The parallelization anti-pattern

Your agent makes 10 tool calls in parallel. All 10 have the same 4K-token system prompt. Anthropic cache writes are per-request; the first cache-write completes around 300 ms after the provider sees the prompt. Requests 2-10 arrive in the same millisecond window and each sees cache miss. You pay 10 write premiums, 0 read discounts.

Fix: batch with sequential-first — make request 1 alone, then fire 2-10 once 1's cache has populated. Adds 300 ms to the first tool call; saves 5-10x the bill.

### The dynamic content anti-pattern

Your system prompt looks like:

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

Every request is unique. Every request writes. Zero hits.

Fix: move everything truly static to the cacheable prefix; append dynamic content after the cache boundary:

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery moved from 7% to 74% cache hit rate this way and published the anatomy.

### Stack batch + cache for overnight workloads

Batch APIs (Phase 17 · 15) give 50% discount at 24-hour turnaround. Cached input on top gets you ~10x on top of that. Overnight classification, labeling, and report generation workloads can drop to ~10% of synchronous-uncached cost by stacking.

### Numbers you should remember

Pricing points are captured 2026-04 from the linked vendor docs and drift every few months — re-check before relying on them.

- Anthropic cached read: $0.30/M on Claude 3.5 Sonnet, roughly 10x cheaper than fresh input (docs.anthropic.com).
- Anthropic cache write premium: 1.25x (5-min TTL) or 2x (1-hour TTL).
- OpenAI auto-cache: applies to prompts ≥1024 tokens; cached input priced at roughly 10% of fresh input on current rate cards (platform.openai.com).
- Semantic cache hit rate (community-reported): ~10% open chat; up to ~70% structured FAQ. Not a vendor-documented baseline.
- ProjectDiscovery: 7% → 74% hit rate by moving dynamic out of prefix (project blog, 2025-11).
- Parallelization anti-pattern: typical reports of 5–10x bill inflation when N parallel requests miss the first cache write.

## Use It

`code/main.py` simulates L1 + L2 caching on mixed workloads. Reports hit rates, bill, and shows the parallelization penalty.

## Ship It

This lesson produces `outputs/skill-cache-auditor.md`. Given prompt template and traffic, audits cacheability and recommends restructure.

## Exercises

1. Run `code/main.py`. Toggle the parallelization flag. How much does the bill change?
2. Your system prompt has a date. Move it out. Show before/after hit rate math.
3. Calculate break-even for 1-hour TTL (2x write) vs 5-minute TTL (1.25x write) given your request arrival rate.
4. Semantic cache at 0.95 threshold hits 20%. At 0.85 it hits 50% but you see incorrect cached responses. Pick the right threshold and justify.
5. You batch 10 parallel sub-queries per user question. Rewrite for cache-friendliness without adding end-to-end latency.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| L2 prompt cache | "prefix cache" | Provider stores KV for repeated prefix |
| `cache_control` | "Anthropic cache marker" | Explicit attribute marking cacheable blocks |
| Cache write premium | "write tax" | Extra cost for first miss-to-cache (1.25x or 2x) |
| L1 semantic cache | "embedding cache" | App-level hash-and-embed before calling LLM |
| GPTCache | "LLM caching lib" | Popular OSS L1 cache library |
| Cache hit rate | "hits / total" | Fraction of requests served from cache |
| Parallelization anti-pattern | "the N-write trap" | N parallel requests miss cache N times |
| Dynamic content trap | "the time-in-prompt trap" | Dynamic bytes in prefix kill hit rate |
| RadixAttention | "intra-replica cache" | SGLang's prefix-cache implementation |

## Further Reading

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — official `cache_control` semantics and TTLs.
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic caching behavior and eligibility.
- [TianPan — Semantic Caching for LLMs Production](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Cut LLM Costs 59% With Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
