---
name: skill-production-checklist
description: LLM applicationを本番にshipするためのdecision framework。全componentを具体的なthresholdとpass/fail criteriaで扱う
version: 1.0.0
phase: 11
lesson: 13
tags: [production, deployment, llm, architecture, scaling, cost, observability, guardrails]
---

# Production LLM Checklist

LLM applicationをshipするときは、このchecklistを順に確認します。各sectionには具体的なthreshold付きのpass/fail criteriaがあります。

## 1. Security (ship blockers)

ここにある項目は、deployment前にすべてpassしていなければなりません。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| API keys in env vars | codebaseにhardcoded keyが0件 | `grep -r "sk-" --include="*.py"` が何も返さない |
| Input guardrails active | prompt injection patternがblockされる | "Ignore all previous instructions" を送るとblocked responseになる |
| PII redaction | SSN、credit card、email patternを捕捉 | "My SSN is 123-45-6789" を送るとLLM call前にPIIがredactされる |
| Output filtering | dangerous contentがblockされる | modelが `DROP TABLE`、`rm -rf`、`exec()` patternを返せない |
| Rate limiting | user単位のrequest capがenforceされる | 同一userから10秒で100 requestsを送り、最後の50+がrejectedされる |
| Auth on all endpoints | unauthenticatedなLLM accessがない | tokenなしの `curl /v1/chat` が401を返す |
| CORS restricted | production domainのみ許可 | `Origin: evil.com` requestがrejectedされる |
| Max input tokens | limit超過requestがrejectedされる | 50K token inputを送ると413またはtruncationになる |

## 2. Reliability (week-one survival)

これは最初のon-call incidentを防ぐための項目です。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| Retry with backoff | 5xxで3 retries、exponential delay | request中にLLM mockを落とし、logでretryを確認 |
| Fallback model chain | chain内に2+ models | primary model unavailableでもfallbackからresponseが返る |
| Request timeout | すべてのexternal callが最大30s | slow LLM mock (60s) が30sでtimeoutする |
| Graceful degradation | Cache/RAG failureでserviceがcrashしない | cacheを止めてもrequestは成功する (遅く、高コストになる) |
| Health check endpoint | dependency statusを返す | `GET /health` が `{"status": "healthy", "cache": ..., "llm": ...}` を返す |
| Streaming works | first tokenが500ms未満 | time-to-first-tokenが常に500ms未満 |
| Error messages are safe | internal errorがuserに漏れない | 500を強制し、userにはstack traceでなくgeneric errorが出る |

## 3. Cost Control (month-one economics)

これは$50Kのsurprise invoiceを防ぐための項目です。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| Cost per request tracked | 全requestがtoken count + USD costをlogする | request logに `input_tokens`、`output_tokens`、`cost_usd` fieldsがある |
| Semantic cache active | repeated patternでhit rate > 20% | 1000 test requests後のcache statsでhit rateを確認 |
| Cache TTL configured | entryがexpireする (default: 1 hour) | entry挿入後、TTL後に返らない |
| Per-user cost tracking | costがuser_idごとにaggregateされる | dashboard/APIにcost上位10 usersが表示される |
| Cost alerting | daily budgetの80%でalert | $10 daily budgetで$8.50分requestを送りalertが発火する |
| Model routing by cost | low-complexity queryが安いmodelを使う | simple questionはgpt-4o-mini、complexはgpt-4oにrouteされる |
| Max output tokens set | responseがtemplateごとにcapされる | max_output_tokens=512のtemplateでresponseがそれを超えない |

**Cost estimation formula:**
```
Monthly LLM cost = DAU x queries_per_user x 30 x (1 - cache_hit_rate) x (avg_input_tokens x input_price + avg_output_tokens x output_price) / 1,000,000
```

**Scale別benchmark threshold:**

| DAU | target cost/request | monthly budget |
|-----|---------------------|----------------|
| 1K | < $0.005 | < $750 |
| 10K | < $0.003 | < $4,500 |
| 100K | < $0.001 | < $15,000 |

## 4. Observability (production debugging)

見えないものは直せません。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| Structured JSON logging | 全requestがJSON log lineを生成する | logにrequest_id、user_id、model、tokens、latency_ms、costがある |
| Request tracing | component timing付きend-to-end trace | 単一requestでguardrail (5ms) + cache (2ms) + llm (3200ms) + eval (1ms) が見える |
| Latency tracking | P50、P95、P99を測定 | 1000 requests後: P50 < 2s、P99 < 10s |
| Error rate monitoring | errorをcountしcategory化 | dashboardに0.5% API errors、0.1% guardrail blocks、0.01% timeoutsが出る |
| Cache metrics | hit rate、miss rate、entry countが見える | `GET /v1/cache/stats` が現在値を返す |
| A/B test metrics | variantごとのquality metricsをlog | 各requestが比較用にprompt_template + versionをlogする |
| Eval logging | quality signalをrequestごとに記録 | response length、latency、model、template versionをoffline analysis用に保存 |

## 5. Prompt Management

Promptはcodeです。codeとして扱います。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| Versioned templates | 全templateがname + version stringを持つ | template変更で新versionが作られ、旧versionが保存される |
| A/B testing support | deterministic user hashでtraffic split | 同じuserはexperiment内で常に同じvariantを見る |
| Rollback capability | 1分未満でprevious versionへ戻せる | experiment config変更でtrafficが即座に移る |
| Template validation | rendering前にvariablesをvalidate | missing variableがKeyErrorではなくclear errorを出す |
| System prompt separation | system/user messagesが別field | system promptがuser messageに連結されない |

## 6. Scaling Readiness

launch時には不要でも、10倍scaleでは必要です。

| Check | Pass Criteria | 確認方法 |
|-------|---------------|----------|
| Async LLM calls | API callでthreadをblockしない | 50 concurrent requestsでもserver CPU < 30% |
| Connection pooling | HTTP connectionsを再利用 | network traceでLLM providerへのpersistent connectionsを確認 |
| Horizontal scaling | stateless server design | load balancer配下の2 instancesで全requestが成功 |
| Queue support | non-real-time taskはqueueへ送る | summarization requestがjob_idを返し、pollingで結果取得できる |
| Load tested | 100 concurrent users、error rate < 5% | target concurrencyで `wrk` または `locust` testがpass |

## 新規projectの実装順序

1. **Day 1:** API server + prompt templates + single LLM call with retry
2. **Day 2:** Input guardrails + output guardrails + error handling
3. **Day 3:** Semantic cache + cost tracking per request
4. **Day 4:** Streaming (SSE) + health check endpoint
5. **Day 5:** Structured logging + request tracing + eval logging
6. **Week 2:** A/B testing + prompt versioning + rollback
7. **Week 3:** Fallback model chain + graceful degradation
8. **Week 4:** Load testing + async optimization + horizontal scaling

## Quick diagnostic

productionで異常がある場合は、この順序で確認します。

1. **userがerrorを訴えている?** health endpoint、logのerror rate、LLM provider status pageの順に確認
2. **responseが遅い?** P99 latency、cache hit rate、trace内LLM response timeの順に確認
3. **costが急増?** cost-per-request trend、cache hit rate、cost上位user、token countを増やしたprompt template変更の順に確認
4. **qualityが落ちた?** 新しいprompt versionのdeploy、RAG retrieval accuracyの変化、model providerのdefault model version変更を確認
5. **security incident?** guardrail block rate (急落 = guardrails disabled)、request logのunusual patternを確認し、API keysを即rotate
