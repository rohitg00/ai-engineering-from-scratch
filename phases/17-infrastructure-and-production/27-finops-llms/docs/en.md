# FinOps for LLMs — Unit Economics and Multi-Tenant Attribution

> Traditional FinOps breaks on LLM spend. Costs are token-transactions, not resource-uptime. Tags don't map — an API call is a transaction, not an asset. Engineering decisions (prompt design, context window, output length) are financial decisions. The 2026 playbook has three attribution dimensions to instrument on day one: per-user (`user_id`) for seat pricing and expansion, per-task (`task_id` + `route`) for product surface cost and prioritization, per-tenant (`tenant_id`) for unit economics and renewal. Four token layers — prompt, tool, memory, response — one bucket hides spend. Enforcement ladder for multi-tenant products: rate limits per tenant (2-3x expected peak, clear 429 + retry-after); daily spend cap (1.5-3x contracted ceiling; triggers rate tightening + alert); kill switches on spend z-score > 4 (auto-pause + page on-call). Attribution patterns: tag-and-aggregate, telemetry-joiner (trace-ID → billing; highest accuracy), sampling-and-extrapolation, model-based allocation, event-sourced, real-time streaming. Unit metric: cost per resolved query, cost per generated artifact — not $/M tokens. Retroactive tagging always misses; instrument at request creation.

**Type:** Learn
**Languages:** Python (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Learning Objectives

- Explain why traditional FinOps (tags + tiers) breaks on LLM spend and name the three new attribution dimensions.
- Enumerate the four token layers (prompt, tool, memory, response) and why single-bucket billing hides cost.
- Design an enforcement ladder (rate → spend cap → kill switch) for a multi-tenant product.
- Pick a unit metric (cost per resolved query / artifact) instead of $/M tokens.

## The Problem

Your bill says $40,000. You don't know:
- Which tenant spent it.
- Which product feature drove it.
- Whether any individual user was abusive.
- Whether prompt bloat, tool calls, or memory amplification was the culprit.

Tag-and-aggregate on provider-side works for cloud resources (EC2, S3) where tags propagate to line items. LLM API calls do not auto-tag — you have to stamp user/task/tenant at the call site and carry through. Retroactive attribution always misses edge cases.

## The Concept

### Three attribution dimensions

**Per-user** (`user_id`): who is costing what. Drives seat pricing, expansion conversations, identifies power users.

**Per-task** (`task_id` + `route`): which product surface costs what. Drives feature prioritization, kill-expensive-features decisions.

**Per-tenant** (`tenant_id`): which customer is profitable. Drives unit economics, renewal pricing, tier thresholds.

Instrument all three at call site on day one. Retroactive is always worse.

### Four token layers

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

Bucketing all four together makes optimization blind. Break them out in your attribution schema.

### Enforcement ladder

1. **Rate limit** per tenant. 2-3x expected peak. Return 429 with `Retry-After`. Tenant sees friction; no surprise bill.

2. **Daily spend cap** per tenant. 1.5-3x contracted ceiling. Trigger: tighten rate limit + alert customer-success.

3. **Kill switch** on spend z-score > 4 relative to tenant baseline. Auto-pause tenant; page on-call; escalate to ops + CS.

### Attribution patterns

- **Tag-and-aggregate**: stamp metadata headers; aggregate later. Simple; rough.
- **Telemetry joiner**: join traces to billing via trace IDs. Highest accuracy. What mature teams do.
- **Sampling + extrapolation**: sample 5-10%, multiply. Cost-effective for rough spend; misses tails.
- **Model-based allocation**: regression to infer cost driver. For legacy data without tags.
- **Event-sourced**: cost as events in a stream (Kafka / Kinesis). Real-time.
- **Real-time streaming**: dashboard updates sub-second.

### Cost per X is the unit metric

$/M tokens is vendor speak. Product metrics:

- Cost per resolved support ticket.
- Cost per generated article.
- Cost per successful agent task.
- Cost per user-session-minute.

Tie cost to a product outcome. Otherwise optimization is unanchored.

### Cost attribution trace shape

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Emit on every call. Store in data lake. Aggregate per dimension. Phase 17 · 13 observability stack is where this lives.

### The compounded-savings stack

Stack: cache + batch + route + gateway. With all four:
- Cache L2 (Phase 17 · 14): ~10x cheaper input.
- Batch (Phase 17 · 15): 50% off.
- Route to cheap model (Phase 17 · 16): 60% cost reduction.
- Gateway efficiency (Phase 17 · 19): redundancy + retries.

Best-case stacked: ~5-10% of naive baseline. Most teams have 2-3 levers engaged; few stack all four.

### Numbers you should remember

- Attribution dimensions: per-user, per-task, per-tenant.
- Four token layers: prompt, tool, memory, response.
- Kill switch: spend z-score > 4.
- Unit metric: cost per resolved query, not $/M tokens.
- Stacked optimizations: ~5-10% of baseline possible.

## Use It

`code/main.py` simulates a multi-tenant LLM service with the three-tier enforcement ladder. Injects an abusive tenant and demonstrates the kill switch firing.

## Ship It

This lesson produces `outputs/skill-finops-plan.md`. Given product and scale, designs the attribution schema and enforcement ladder.

## Exercises

1. Run `code/main.py`. At what z-score does the kill switch fire? How do you pick the threshold?
2. Design a per-tenant, per-task cost dashboard. What are the 5 views you build first?
3. Your largest tenant is unit-economics-negative. Propose three interventions ordered by customer impact.
4. Compute cost per resolved ticket for a support product: 3M tokens/ticket, ~800 tickets/day, GPT-5 cached rate.
5. Argue whether retroactive tagging can ever work. When is it acceptable?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Further Reading

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
