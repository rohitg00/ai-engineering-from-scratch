---
name: skill-production-checklist
description: Decision framework for shipping LLM applications to production -- covers every component with specific thresholds and pass/fail criteria
version: 1.0.0
phase: 11
lesson: 13
tags: [production, deployment, llm, architecture, scaling, cost, observability, guardrails]
---

# Production LLM Checklist

When shipping an LLM application, work through this checklist in order. Each section has pass/fail criteria with specific thresholds.

## 1. Security (Ship Blockers)

Every item here must pass before any deployment.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| API keys in env vars | Zero hardcoded keys in codebase | `grep -r "sk-" --include="*.py"` returns nothing |
| Input guardrails active | Prompt injection patterns blocked | Send "Ignore all previous instructions" -- returns blocked response |
| PII redaction | SSN, credit card, email patterns caught | Send "My SSN is 123-45-6789" -- PII redacted before LLM call |
| Output filtering | Dangerous content blocked | Model cannot return `DROP TABLE`, `rm -rf`, `exec()` patterns |
| Rate limiting | Per-user request cap enforced | 100 requests from same user in 10 seconds -- last 50+ rejected |
| Auth on all endpoints | No unauthenticated LLM access | `curl /v1/chat` without token returns 401 |
| CORS restricted | Only production domains allowed | `Origin: evil.com` request rejected |
| Max input tokens | Requests over limit rejected | Send 50K token input -- returns 413 or truncation |

## 2. Reliability (Week-One Survival)

These prevent your first on-call incident.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| Retry with backoff | 3 retries on 5xx, exponential delay | Kill LLM mock mid-request -- retries visible in logs |
| Fallback model chain | 2+ models in chain | Primary model unavailable -- response still returns from fallback |
| Request timeout | 30s max on all external calls | Slow LLM mock (60s) -- request times out at 30s |
| Graceful degradation | Cache/RAG failure does not crash service | Stop cache -- requests still succeed (slower, more expensive) |
| Health check endpoint | Returns dependency status | `GET /health` returns `{"status": "healthy", "cache": ..., "llm": ...}` |
| Streaming works | First token under 500ms | Time-to-first-token measured, consistently < 500ms |
| Error messages are safe | Internal errors never leak to users | Force 500 -- user sees generic error, not stack trace |

## 3. Cost Control (Month-One Economics)

These prevent the $50K surprise invoice.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| Cost per request tracked | Every request logs token count + USD cost | Request log has `input_tokens`, `output_tokens`, `cost_usd` fields |
| Semantic cache active | > 20% hit rate on repeated patterns | Cache stats show hit rate after 1000 test requests |
| Cache TTL configured | Entries expire (default: 1 hour) | Entry inserted -- not returned after TTL |
| Per-user cost tracking | Cost aggregated by user_id | Dashboard/API shows top 10 users by cost |
| Cost alerting | Alert at 80% of daily budget | Set $10 daily budget, send $8.50 in requests -- alert fires |
| Model routing by cost | Low-complexity queries use cheaper model | Simple question routes to gpt-4o-mini, complex to gpt-4o |
| Max output tokens set | Responses capped per template | Template with max_output_tokens=512 -- response never exceeds it |

**Cost estimation formula:**
```
Monthly LLM cost = DAU x queries_per_user x 30 x (1 - cache_hit_rate) x (avg_input_tokens x input_price + avg_output_tokens x output_price) / 1,000,000
```

**Benchmark thresholds by scale:**

| DAU | Target cost/request | Monthly budget |
|-----|-------------------|----------------|
| 1K | < $0.005 | < $750 |
| 10K | < $0.003 | < $4,500 |
| 100K | < $0.001 | < $15,000 |

## 4. Observability (Debugging in Production)

You cannot fix what you cannot see.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| Structured JSON logging | Every request produces a JSON log line | Log contains: request_id, user_id, model, tokens, latency_ms, cost |
| Request tracing | End-to-end trace with component timing | Single request shows: guardrail (5ms) + cache (2ms) + llm (3200ms) + eval (1ms) |
| Latency tracking | P50, P95, P99 measured | After 1000 requests: P50 < 2s, P99 < 10s |
| Error rate monitoring | Errors counted and categorized | Dashboard shows: 0.5% API errors, 0.1% guardrail blocks, 0.01% timeouts |
| Cache metrics | Hit rate, miss rate, entry count visible | `GET /v1/cache/stats` returns current numbers |
| A/B test metrics | Per-variant quality metrics logged | Each request logs prompt_template + version for comparison |
| Eval logging | Quality signals recorded per request | Response length, latency, model, template version stored for offline analysis |

## 5. Prompt Management

Prompts are code. Treat them like code.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| Versioned templates | Every template has a name + version string | Template change creates new version, old version preserved |
| A/B testing support | Traffic split by deterministic user hash | Same user always sees same variant within experiment |
| Rollback capability | Revert to previous version in < 1 minute | Change experiment config -- traffic instantly shifts |
| Template validation | Variables validated before rendering | Missing variable in template raises clear error, not KeyError |
| System prompt separation | System and user messages in separate fields | System prompt is not concatenated into user message |

## 6. Scaling Readiness

Not needed at launch. Needed at 10x.

| Check | Pass Criteria | How to Verify |
|-------|--------------|---------------|
| Async LLM calls | No thread blocking on API calls | 50 concurrent requests -- server CPU stays < 30% |
| Connection pooling | HTTP connections reused | Network trace shows persistent connections to LLM provider |
| Horizontal scaling | Stateless server design | 2 instances behind load balancer -- all requests succeed |
| Queue support | Non-real-time tasks go to queue | Summarization request returns job_id, result available via polling |
| Load tested | 100 concurrent users, < 5% error rate | `wrk` or `locust` test passes at target concurrency |

## Implementation order for new projects

1. **Day 1:** API server + prompt templates + single LLM call with retry
2. **Day 2:** Input guardrails + output guardrails + error handling
3. **Day 3:** Semantic cache + cost tracking per request
4. **Day 4:** Streaming (SSE) + health check endpoint
5. **Day 5:** Structured logging + request tracing + eval logging
6. **Week 2:** A/B testing + prompt versioning + rollback
7. **Week 3:** Fallback model chain + graceful degradation
8. **Week 4:** Load testing + async optimization + horizontal scaling

## Quick diagnostic

If something is wrong in production, check in this order:

1. **Users complaining about errors?** Check health endpoint, then error rate in logs, then LLM provider status page
2. **Responses are slow?** Check P99 latency, then cache hit rate, then LLM response times in traces
3. **Cost spiking?** Check cost-per-request trend, then cache hit rate, then top users by cost, then look for prompt template changes that increased token count
4. **Quality dropped?** Check if a new prompt version was deployed, check if RAG retrieval accuracy changed, check if model provider changed default model version
5. **Security incident?** Check guardrail block rate (sudden drop = guardrails disabled), check request logs for unusual patterns, rotate API keys immediately
