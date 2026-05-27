---
name: batch-triager
description: Triage LLM workloads into interactive / semi-interactive / batch lanes, compute stacked discount (batch + cache) savings, and flag mis-triaged workloads.
version: 1.0.0
phase: 17
lesson: 15
tags: [batch-api, openai-batch, anthropic-batches, vertex-batch, triage, cost]
---

Given a workload (name, user expectation for latency, traffic volume, shared prompt structure), produce a triage + cost plan.

Produce:

1. Lane. Interactive (TTFT-bound, sync), semi-interactive (minutes OK, async queue), or batch (by-morning OK, batch API). Justify with the specific user expectation.
2. Current cost. Compute monthly cost at current configuration (sync, no cache, etc.).
3. Target cost. Compute cost after recommended config (batch + cache or sync + cache). Express as % of current.
4. Migration plan. Provider-specific steps (pick the one that matches the workload's model, not both):
   - OpenAI: migrate to `/v1/batches`. Prompt caching is enabled automatically for eligible prompts (≥1024 tokens) — no `cache_control` to set. Optionally pass `prompt_cache_key` for tighter attribution.
   - Anthropic: migrate to Message Batches. Cache reuse requires explicit `cache_control` blocks (e.g., `{"type": "ephemeral"}`) on the cacheable prompt spans; batch discount stacks with cached-read pricing.
   - Both: instrument a success/failure webhook and a spillover lane to sync for batches that miss their turnaround window.
5. Risk. What if the batch turnaround is 20 hours at P99? Name the downstream system behavior (email delivery, queue spillover to sync).
6. Observable. Metric that catches mis-triage: batch job completion latency P95; alert if > 12 hours.

Hard rejects:
- Running an overnight pipeline in sync mode without batch when the user only needs "by morning" latency. Refuse — call out the ~90% leaked spend.
- Promising batch for anything with a sub-15-minute user expectation. Refuse — batch SLA is 24h.
- Ignoring prompt caching on a batch workload with shared system prompt. Refuse — the stacked discount is the point.

Refusal rules:
- If the workload is marketed as "real-time" but the actual user expectation is minutes, require explicit confirmation before recommending batch.
- If the workload targets a provider without prompt caching in batch (e.g., any custom or self-hosted stack without KV-prefix reuse), note that only the batch discount applies and recompute without stacked savings. OpenAI batch caching is automatic; Anthropic batch caching requires explicit `cache_control` blocks.
- If the workload has strict latency SLA (e.g., P99 < 60s) refuse batch outright — it belongs on a different lane.

Output: a one-page triage with lane, current cost, target cost, migration steps, risk, observable. End with a cadence: re-triage all workloads quarterly as product surface changes.
