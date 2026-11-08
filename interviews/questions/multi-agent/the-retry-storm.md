---
id: the-retry-storm
title: A payment failure took the inventory service down
card: multi-agent
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, system-design]
tags: [retry-storm, circuit-breaker, cascading-failure, retry-budget, mast]
minutes: 12
lessons: [phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink]
manuals: []
practice: []
cheatsheet: [agent-failure-modes, multi-agent]
related: [multi-agent/a-worker-died-mid-run]
updated: 2026-11-03
---

A payment service starts failing about 10 percent of its requests. Within minutes the inventory service, which never failed, is down, and the order agents that call both are stalled. The payment service itself recovered on its own. Explain the chain, name the failure family, and say what you add so that it cannot repeat.

## Short answer

This is a retry storm, a cascading reliability failure. The order agent retried each failed payment, each retry ran a fresh inventory check, inventory saw twice its normal load and began to time out, every order then retried the inventory check as well, and inventory saw ten times its load and fell over. The fix is classical: a circuit breaker on every outbound call that opens when the downstream error rate passes a threshold and serves a cached or default result, plus a capped retry budget per request.

## Full answer

### The chain

```text
payment fails about 10 percent of requests
  -> the order agent retries payment, with backoff but no cap
  -> each retry runs a new order-inventory check
  -> inventory sees about twice its normal load
  -> inventory starts to time out
  -> every order retries the inventory check
  -> inventory sees about ten times its normal load
  -> the cluster goes down
```

Nothing in the chain is a model error. It is a coordination failure between components whose retry logic was written one component at a time.

### The family

The lesson's taxonomy puts this under cascading reliability failures, one of the five patterns where agents amplify each other's errors. It sits beside monoculture, conformity, a missing model of each other's beliefs, and compromise drift. Of all the mitigations in the taxonomy, the circuit breaker is one of the few you take from distributed systems without changing it.

### The breaker

| State | Behavior |
|---|---|
| Closed | Calls pass, and the breaker records each outcome over a window |
| Open | Calls are refused and a cached or default result is served, until a cooldown passes |
| Half-open | One probe call passes; a success closes the breaker and a failure reopens it |

The lesson's shipping default is to open at an error rate of 5 to 10 percent. In the lesson's simulation the breaker caps the amplification: the success count may fall, and the downstream survives.

### The retry budget

A breaker protects the callee. A retry budget per request protects the system from the caller: a fixed number of attempts, after which the request fails and the failure is recorded. Retries without a cap are the storm.

### Detect it earlier

Retry rate is one of the slow-failure proxies the lesson lists, with agreement rate, output-length distribution and the edit distance between agent versions. A detection agent that watches for a retry spike names the pattern before inventory falls over.

## Follow-ups

- **Level 3:** Why does the inventory service fail when payment is the one with errors? Expected: the order agent's retry loop re-runs the inventory check on every payment retry, so inventory's load tracks payment's failures.
- **Level 3:** What does the breaker serve while it is open? Expected: a cached or default result that the order agent can act on in a degraded mode, so the user gets a slower answer instead of none.
- **Level 4:** Where does the breaker threshold belong, and who owns it? Expected: in the caller's configuration per downstream service, owned by the team that runs the caller, and reviewed when the dependency's normal error rate changes.
- **Level 4:** How do you test the fix without a production incident? Expected: a simulator that injects a 10 percent failure rate downstream and measures total calls with and without the breaker, as the lesson does.

## Wrong answers

- "Add exponential backoff to the payment retries." Backoff slows the storm and does not cap it, and the inventory check still runs on every retry.
- "Scale the inventory service to absorb the peak." The peak is ten times normal and made of wasted retries, and scaling pays for the storm instead of stopping it.
- "This is a model problem, so improve the agent's prompt." No model decision is in the chain, and a prompt cannot see the error rate of a downstream service.

## Taught in

The [failure modes lesson](../../../phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/) simulates the retry storm with and without the circuit breaker.
