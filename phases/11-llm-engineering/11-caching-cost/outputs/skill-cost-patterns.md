---
name: skill-cost-patterns
description: Decision framework for LLM cost optimization -- caching strategies, rate limiting, model routing, and budget controls
version: 1.0.0
phase: 11
lesson: 11
tags: [caching, cost-optimization, rate-limiting, model-routing, budget, llm-ops]
---

# LLM Cost Optimization Patterns

When building an LLM application that needs to control costs, apply this decision framework.

## When to optimize

**Optimize immediately when:**
- Monthly LLM spend exceeds $500 or 10% of infrastructure budget
- Cost per query is above $0.01 for a consumer product
- Your system prompt is over 1,000 tokens and sent with every request
- More than 30% of queries are duplicates or near-duplicates
- You are scaling from 100 to 10,000+ daily users

**Do not optimize yet when:**
- You have fewer than 100 DAU and are still validating product-market fit
- Monthly spend is under $100 and growing slowly
- You are still iterating on prompt design (caching locks you into a prompt)

## Caching strategy selection

### Exact caching

**Use when:** temperature=0, identical prompts repeat, deterministic outputs needed.

```python
key = sha256(json.dumps({"model": m, "messages": msgs, "temp": 0}))
```

- Implementation: 30 minutes
- Hit rate: 10-25% for most apps, 40-60% for FAQ bots
- Latency: <1ms (dict lookup)
- Risk: stale responses if underlying data changes

**Skip when:** temperature > 0, every query is unique, real-time data needed.

### Semantic caching

**Use when:** users ask the same question in different words, FAQ-heavy products, customer support.

- Implementation: 2-4 hours (embedding + similarity + storage)
- Hit rate: 15-35% on top of exact cache
- Latency: 10-50ms (embedding + ANN search)
- Risk: false positives (returning wrong cached answer for a similar but different question)

**Threshold guidelines:**
- 0.98+: very conservative, almost no false positives, lower hit rate
- 0.95: good balance for factual Q&A
- 0.90: aggressive, higher hit rate but risk of wrong answers
- 0.85: only for low-stakes applications (suggestions, autocomplete)

**Skip when:** every query has unique context (code generation), responses must reflect latest data, query space is unbounded.

### Provider prompt caching

**Use when:** system prompt > 1,024 tokens (OpenAI) or model-specific minimum, same prefix sent repeatedly.

| Provider | Action | Savings |
|----------|--------|---------|
| Anthropic | Add `cache_control: {"type": "ephemeral"}` to system message | 90% on cached prefix (after 25% write premium) |
| OpenAI | Nothing (automatic) | 50% on cached prefix |
| Google | Use Context Caching API with explicit TTL | ~75% on cached context |

**Skip when:** system prompt changes per request, prompt is under minimum length.

## Model routing rules

### Keyword-based (simple, fast)

```
simple:  <= 5 words OR matches FAQ keywords -> gpt-4o-mini ($0.15/$0.60)
medium:  general queries, summaries        -> claude-sonnet ($3/$15)
complex: "analyze", "compare", "debug"     -> gpt-4o ($2.50/$10)
```

- Implementation: 1 hour
- Accuracy: 70-80%
- Savings: 40-60% of model costs

### Embedding-based (more accurate)

Embed 50-100 labeled queries per category. Classify new queries by nearest neighbor.

- Implementation: 4-8 hours
- Accuracy: 85-92%
- Savings: 50-70% of model costs
- Additional cost: ~$0.02/1M tokens for classification embeddings (negligible)

### ML-based (production grade)

Train a small classifier (logistic regression or small BERT) on historical query/model pairs.

- Implementation: 1-2 weeks
- Accuracy: 90-95%
- Savings: 60-75% of model costs
- Requires: labeled training data from production traffic

## Rate limiting configuration

### Token bucket parameters by tier

| Tier | Bucket Size | Refill Rate | Max RPM | Daily Cap |
|------|-------------|-------------|---------|-----------|
| Free | 50K tokens | 500/sec | 10 | 50K |
| Pro | 500K tokens | 5K/sec | 60 | 500K |
| Enterprise | 5M tokens | 50K/sec | 300 | 5M |

### Implementation checklist

1. Store buckets in Redis (not in-memory) for multi-instance apps
2. Use atomic operations (MULTI/EXEC) to prevent race conditions
3. Return `Retry-After` header with rejection responses
4. Track rejected requests as a metric (>5% rejection = tier limits too tight)
5. Implement graceful degradation: reject expensive model requests first, keep cheap model access

## Budget controls

### Three-threshold circuit breaker

| Threshold | Action | Reversible |
|-----------|--------|------------|
| 70% of monthly budget | Log warning, alert team via Slack/PagerDuty | Yes (auto) |
| 85% of monthly budget | Route all traffic to cheapest model | Yes (auto, next billing cycle) |
| 95% of monthly budget | Serve cached responses only, reject new LLM calls | Yes (manual reset or next cycle) |

### Per-user cost tracking

Track cumulative cost per user. Flag users exceeding 10x the median. Common causes:
- Legitimate power user (upgrade their tier)
- Prompt injection loop (bot sending automated requests)
- Inefficient integration (client retrying on every error)

## Cost tracking fields

Log every API call with these fields:

```json
{
  "timestamp": "2026-04-02T10:30:00Z",
  "model": "gpt-4o",
  "input_tokens": 1523,
  "output_tokens": 487,
  "cached_input_tokens": 1024,
  "latency_ms": 1847,
  "cost_usd": 0.006142,
  "user_id": "user_abc123",
  "cache_status": "partial_hit",
  "request_category": "customer_support",
  "complexity_class": "medium",
  "routed_from": "gpt-4o"
}
```

### Key metrics to dashboard

- **Cost per query** (P50, P95, P99) -- by model, by feature, by user tier
- **Cache hit rate** -- exact vs semantic, trend over time
- **Model distribution** -- % of traffic per model, cost per model
- **Budget burn rate** -- current spend vs projected monthly at current rate
- **Rejection rate** -- % of requests rate-limited, by tier

## Common mistakes

| Mistake | Why it hurts | Fix |
|---------|-------------|-----|
| Caching with temperature > 0 | Non-deterministic outputs, stale cache gives wrong variety | Only cache temp=0 calls, or accept that cached responses lose randomness |
| Semantic cache threshold too low | Returns wrong answers for superficially similar queries | Start at 0.95, lower only after measuring false positive rate |
| No cache invalidation | Responses go stale when underlying data changes | Set TTL (1 hour for dynamic data, 24 hours for static), invalidate on data updates |
| Routing all traffic to cheapest model | Quality drops, users notice | Route by complexity, measure quality per tier, set minimum quality thresholds |
| No per-user limits | One abusive user burns entire budget | Always implement per-user quotas, even if generous |
| Ignoring output tokens | Output costs 2-5x more than input per token | Set max_tokens appropriately, use stop sequences, compress outputs |
| Caching before prompt is stable | Cache fills with responses from old prompts | Only enable caching after prompt is finalized, flush cache on prompt changes |

## Pricing reference (as of April 2026)

| Model | Input ($/1M) | Output ($/1M) | Cached Input ($/1M) | Best For |
|-------|-------------|--------------|--------------------|---------| 
| gpt-4.1-nano | $0.10 | $0.40 | $0.025 | High-volume simple tasks |
| gpt-4o-mini | $0.15 | $0.60 | $0.075 | Simple routing, classification |
| gemini-2.5-flash | $0.15 | $0.60 | $0.0375 | Budget multimodal |
| claude-haiku-3.5 | $0.80 | $4.00 | $0.08 | Fast mid-tier tasks |
| o4-mini | $1.10 | $4.40 | $0.275 | Reasoning on a budget |
| gemini-2.5-pro | $1.25 | $10.00 | $0.3125 | Long context, multimodal |
| gpt-4o | $2.50 | $10.00 | $1.25 | General purpose, function calling |
| claude-sonnet-4 | $3.00 | $15.00 | $0.30 | Balanced quality/cost |
| claude-opus-4 | $15.00 | $75.00 | $1.50 | Maximum quality, complex reasoning |
