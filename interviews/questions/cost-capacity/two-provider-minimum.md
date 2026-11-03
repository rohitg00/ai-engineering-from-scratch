---
id: two-provider-minimum
title: Survive a provider outage without a redeploy
card: cost-capacity
kind: design
level: 4
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [failover, gateway, model-alias, lock-in]
minutes: 18
lessons: [phases/17-infrastructure-and-production/01-managed-llm-platforms, phases/13-tools-and-protocols/21-llm-routing-layer, phases/17-infrastructure-and-production/19-ai-gateways, phases/11-llm-engineering/15-prompt-caching]
manuals: []
practice: []
cheatsheet: [llm-routing-gateways, managed-llm-platforms]
related: [cost-capacity/gateway-latency-budget, cost-capacity/cache-break-even]
updated: 2026-11-03
---

The CTO wants every product-critical model call to survive a full outage of one provider, with no redeploy and without doubling the bill. Design the setup: where the second provider sits, how a request moves between the two, what has to be identical on both sides, and what the design costs.

## Short answer

Put a gateway in front of the application with one model alias per use case, a priority list of two providers behind each alias, and a fallback rule on server errors and rate limits with a bounded retry budget. Keep the cacheable prefix layout, the tool order and the output schema identical on both providers, so that a failed-over request can hit the second provider's cache once that prefix is cached there, and still parses. The steady-state uplift is small, because the gateway sends traffic to the preferred provider most of the time, and the real price is paid in evals and prompt tests that run twice.

## Full answer

### Why two

The lesson on managed platforms argues that locking into one platform locks you out of most of the frontier, because the strongest model moves between vendors every few months, and that a single platform's regional outage is a product outage. Its policy is a two-provider minimum for any product-critical call. The cost uplift is negligible because the gateway routes to the better option in normal operation, and the availability gain during an outage is decisive.

### The gateway in front

The lesson on the routing layer gives the shape. Everyone speaks one API schema, so the gateway exposes one endpoint and translates behind it. Your code names an alias such as `our_smart_model`, and the gateway maps the alias to a concrete model on a concrete provider. Behind each alias sits a priority list: the primary, then the second provider on a server error or a rate limit, then refuse. Retries count against a budget, so that a failing primary cannot multiply the cost. The gateways lesson adds the rest of what the layer owns: rate limits per tenant, credentials pulled from a vault at runtime, observability and guardrails.

### What the two sides share

1. **The cacheable prefix layout.** The rule for cross-provider fallback in the lesson on prompt caching is to keep the layout identical, so that any hit works on either side. Stable parts first, the user message last.
2. **The tool serialization order.** A reshuffled tool list breaks the cache on every request.
3. **The output schema and the parser.** A failover that returns a shape the application cannot parse is still an outage.
4. **The eval set.** Both providers run the same regression suite on every prompt change, or the fallback path drifts without anyone noticing.

### What it costs

- Two sets of evals and prompt regressions per release.
- Cold caches on the second provider when the outage begins. The first requests pay the write premium, and the minimum cacheable block has to be met on both sides.
- The gateway's own latency, from a few milliseconds to tens, depending on its class.
- A log line per call that names the provider that served it, so that the bill splits and the failover rate is visible.

### Prove it before the outage

Inject rate-limit errors from the primary in staging and watch the traffic move. Measure the time to the first successful response on the second provider, and compare the first-token time and the cache reads during the failover with the steady state.

## Follow-ups

- **Level 3:** Why does the second provider cost little in steady state? Expected: the gateway sends most traffic to the preferred provider. The second one carries traffic only during failures and drills.
- **Level 4:** What breaks first on a failover without the identical prefix layout? Expected: the cache on the second provider misses on every request, so the outage hour costs full price and the first-token time jumps.
- **Level 4:** Which failures trigger the failover, and which do not? Expected: server errors, rate limits and timeouts on the primary. Not a guardrail block or a malformed response, which would fail the same way on the second provider.

## Wrong answers

- "Two providers double the bill." The second provider carries traffic only during failures. The gateway routes to the preferred one the rest of the time.
- "Tune a separate prompt per provider." Then every change ships twice and the fallback path drifts. Keep one layout and one eval set for both.
- "Fail over on any error." A guardrail block or a schema error repeats on the second provider and doubles the cost of a request that should fail fast.

## Taught in

The [managed platforms lesson](../../../phases/17-infrastructure-and-production/01-managed-llm-platforms/) sets the two-provider policy, the [routing layer lesson](../../../phases/13-tools-and-protocols/21-llm-routing-layer/) gives aliases and fallback chains, the [AI gateways lesson](../../../phases/17-infrastructure-and-production/19-ai-gateways/) lists the gateway features, and the [prompt caching lesson](../../../phases/11-llm-engineering/15-prompt-caching/) keeps the cacheable layout identical across providers.
