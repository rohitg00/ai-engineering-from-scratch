---
name: skill-cost-patterns
description: LLM cost optimization のための decision framework -- caching strategies、rate limiting、model routing、budget controls
version: 1.0.0
phase: 11
lesson: 11
tags: [caching, cost-optimization, rate-limiting, model-routing, budget, llm-ops]
---

# LLM Cost Optimization Patterns

costs を control する必要がある LLM application を構築するときは、この decision framework を適用してください。

## Optimize するタイミング

**すぐ optimize する場合:**
- monthly LLM spend が $500 または infrastructure budget の 10% を超える
- consumer product で cost per query が $0.01 を超える
- system prompt が 1,000 tokens を超え、every request で送られる
- queries の 30% 超が duplicates または near-duplicates
- 100 から 10,000+ daily users へ scale している

**まだ optimize しない場合:**
- DAU が 100 未満で、まだ product-market fit を検証中
- monthly spend が $100 未満でゆっくり増えている
- まだ prompt design を iterate している (caching は prompt に lock される)

## Caching strategy selection

### Exact caching

**使う場合:** temperature=0、identical prompts が繰り返される、deterministic outputs が必要。

```python
key = sha256(json.dumps({"model": m, "messages": msgs, "temp": 0}))
```

- Implementation: 30 分
- Hit rate: ほとんどの apps で 10-25%、FAQ bots で 40-60%
- Latency: <1ms (dict lookup)
- Risk: underlying data が変わると stale responses

**使わない場合:** temperature > 0、every query が unique、real-time data が必要。

### Semantic caching

**使う場合:** users が同じ質問を違う言い回しで聞く、FAQ-heavy products、customer support。

- Implementation: 2-4 時間 (embedding + similarity + storage)
- Hit rate: exact cache に加えて 15-35%
- Latency: 10-50ms (embedding + ANN search)
- Risk: false positives (似ているが異なる質問に wrong cached answer を返す)

**Threshold guidelines:**
- 0.98+: very conservative、false positives はほぼないが hit rate は低い
- 0.95: factual Q&A の良い balance
- 0.90: aggressive、hit rate は高いが wrong answers の risk
- 0.85: low-stakes applications (suggestions、autocomplete) 専用

**使わない場合:** every query が unique context を持つ (code generation)、responses が latest data を反映する必要がある、query space が unbounded。

### Provider prompt caching

**使う場合:** system prompt > 1,024 tokens (OpenAI) または model-specific minimum を超え、同じ prefix が繰り返し送られる。

| Provider | Action | Savings |
|----------|--------|---------|
| Anthropic | Add `cache_control: {"type": "ephemeral"}` to system message | 90% on cached prefix (after 25% write premium) |
| OpenAI | Nothing (automatic) | 50% on cached prefix |
| Google | Use Context Caching API with explicit TTL | ~75% on cached context |

**使わない場合:** system prompt が request ごとに変わる、prompt が minimum length 未満。

## Model routing rules

### Keyword-based (simple, fast)

```
simple:  <= 5 words OR matches FAQ keywords -> gpt-4o-mini ($0.15/$0.60)
medium:  general queries, summaries        -> claude-sonnet ($3/$15)
complex: "analyze", "compare", "debug"     -> gpt-4o ($2.50/$10)
```

- Implementation: 1 時間
- Accuracy: 70-80%
- Savings: model costs の 40-60%

### Embedding-based (more accurate)

category ごとに 50-100 labeled queries を embed します。new queries は nearest neighbor で classify します。

- Implementation: 4-8 時間
- Accuracy: 85-92%
- Savings: model costs の 50-70%
- Additional cost: classification embeddings に約 $0.02/1M tokens (negligible)

### ML-based (production grade)

historical query/model pairs で small classifier (logistic regression または small BERT) を train します。

- Implementation: 1-2 週間
- Accuracy: 90-95%
- Savings: model costs の 60-75%
- Requires: production traffic からの labeled training data

## Rate limiting configuration

### Token bucket parameters by tier

| Tier | Bucket Size | Refill Rate | Max RPM | Daily Cap |
|------|-------------|-------------|---------|-----------|
| Free | 50K tokens | 500/sec | 10 | 50K |
| Pro | 500K tokens | 5K/sec | 60 | 500K |
| Enterprise | 5M tokens | 50K/sec | 300 | 5M |

### Implementation checklist

1. multi-instance apps では buckets を in-memory ではなく Redis に保存する
2. race conditions を防ぐため atomic operations (MULTI/EXEC) を使う
3. rejection responses で `Retry-After` header を返す
4. rejected requests を metric として track する (>5% rejection = tier limits が厳しすぎる)
5. graceful degradation を実装する。expensive model requests を先に reject し、cheap model access は維持する

## Budget controls

### Three-threshold circuit breaker

| Threshold | Action | Reversible |
|-----------|--------|------------|
| monthly budget の 70% | warning を log し、Slack/PagerDuty で team に alert | Yes (auto) |
| monthly budget の 85% | all traffic を cheapest model に route | Yes (auto、next billing cycle) |
| monthly budget の 95% | cached responses のみ serve し、new LLM calls を reject | Yes (manual reset または next cycle) |

### Per-user cost tracking

user ごとの cumulative cost を track します。median の 10x を超える users を flag します。よくある原因:
- legitimate power user (tier を upgrade)
- prompt injection loop (bot が automated requests を送る)
- inefficient integration (client が every error で retry)

## Cost tracking fields

すべての API call を次の fields で log します。

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

### Dashboard 化すべき key metrics

- **Cost per query** (P50、P95、P99) -- model 別、feature 別、user tier 別
- **Cache hit rate** -- exact vs semantic、trend over time
- **Model distribution** -- model ごとの traffic 割合、cost per model
- **Budget burn rate** -- current spend vs current rate での projected monthly
- **Rejection rate** -- rate-limited requests の割合、tier 別

## Common mistakes

| Mistake | 問題 | Fix |
|---------|-------------|-----|
| Caching with temperature > 0 | non-deterministic outputs のため stale cache が wrong variety を返す | temp=0 calls のみ cache、または cached responses が randomness を失うことを受け入れる |
| Semantic cache threshold too low | superficially similar queries に wrong answers を返す | 0.95 から始め、false positive rate 測定後にだけ下げる |
| No cache invalidation | underlying data が変わると responses が stale になる | TTL を設定 (dynamic data は 1 時間、static は 24 時間)、data updates 時に invalidate |
| Routing all traffic to cheapest model | quality が落ち users が気づく | complexity で route、tier ごとに quality を測定、minimum quality thresholds を設定 |
| No per-user limits | abusive user 1 人が budget 全体を消費する | generous でも per-user quotas を必ず実装 |
| Ignoring output tokens | output は token あたり input の 2-5x 高い | `max_tokens` を適切に設定し、stop sequences を使い、outputs を compress |
| Caching before prompt is stable | old prompts の responses で cache が埋まる | prompt finalized 後にのみ caching を enable、prompt changes で cache を flush |

## Pricing reference (2026 年 4 月時点)

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
