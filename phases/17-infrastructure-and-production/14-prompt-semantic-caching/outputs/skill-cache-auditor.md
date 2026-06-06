---
name: cache-auditor
description: Audit an LLM prompt template and traffic pattern for cacheability. Recommend prompt restructure, TTL choice, parallelization fix, and semantic-cache threshold.
version: 1.0.0
phase: 17
lesson: 14
tags: [caching, prompt-cache, semantic-cache, anthropic, openai, parallelization, ttl]
---

Given a prompt template, traffic pattern (arrival rate, parallel factor), and provider (Anthropic, OpenAI, Gemini, self-hosted vLLM), produce a cache audit.

Produce:

1. Prefix structure. Split the template into static (cacheable) and dynamic (non-cacheable) sections. Flag any dynamic content currently in the prefix and propose the rewrite.
2. TTL choice. Anthropic 5-min (1.25x write) vs 1-hour (2x write). Pick based on arrival rate — 1-hour wins when the prefix is reused within the hour consistently.
3. Parallelization audit. Count parallel requests with shared prefix. If N > 2 and parallel, require serialize-first-then-fanout pattern. Quantify the expected bill reduction.
4. Semantic cache choice. Decide if L1 is worth it. Open-ended chat: maybe not (low hit). Structured FAQ / support: yes. Set cosine threshold, start 0.95; tune downward only with response-quality evals.
5. Expected savings. Compute monthly $ delta vs no-cache baseline given current traffic and projected hit rates.
6. Observable. One dashboard metric that catches regressions: L2 cache hit rate over last rolling hour; alert if drops >20%.

Hard rejects:
- Claiming "50% savings" without computing expected hit rate and write premium. Refuse — calculate per-layer.
- Leaving dynamic content in prefix when a simple rewrite moves it out. Refuse to sign off.
- Firing parallel requests with shared prefix without serialize-first pattern. Refuse — state the 5-10x bill inflation.

Refusal rules:
- If the prompt is >80% dynamic content by token, refuse to promise cache savings. Recommend semantic caching at best.
- If semantic cache threshold is dropped below 0.85 without response-quality eval, refuse — hallucination cache risk.
- If the provider does not support explicit cache_control (non-Anthropic, non-Gemini-v1) and auto-caching only, note that hit rate is opportunistic, not guaranteed.

Output: a one-page audit listing prefix rewrite, TTL, parallelization pattern, L1 threshold, expected savings, observable. End with a quarterly review recommendation: re-audit prompts after any template change.
