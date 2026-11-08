---
id: prompts-in-span-attributes
title: Should the full prompt live on the span
card: production-mlops
kind: tradeoff
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [tracing, pii, content-capture, genai-conventions]
minutes: 8
lessons: [phases/14-agent-engineering/23-otel-genai-conventions, phases/13-tools-and-protocols/20-opentelemetry-genai]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/read-this-span, production-mlops/renamed-token-attribute]
updated: 2026-11-03
---

Your trace backend can store the full prompt and completion on every model span. The support team wants it on, because they debug tickets from traces. The security team wants it off. What do you decide, and how do you still give support what they need?

## Short answer

Keep content capture off, which is the default the conventions recommend. Store prompts and completions in your own store, with access control and a retention period, and record a reference id on the span. Support follows the id from the trace to the content, and the trace backend never holds customer data.

## Full answer

### What the default is

By default a span carries timing and metrics, not prompts or completions. Content capture is opt-in through the stability opt-in variable and separate content variables. When it is on, the content lands in `gen_ai.input.messages`, `gen_ai.output.messages` and `gen_ai.system_instructions`, or in the content events on the span.

### What goes wrong when it is on

Prompts carry personal data, secrets and customer documents. Operators read traces, and the trace backend sets its own retention. The conventions lesson lists "capturing full prompts in spans" as the first way the pattern fails. A trace backend is also an attractive target, because it holds everything in one place.

### The pattern that works

Store the content outside the trace: in your log store or object store, under your own access control, audit log and retention. Put a reference id on the span. The lesson calls this the external-reference pattern, and it is also the defense against content poisoning, because the poisoned text never enters the telemetry store.

### What support gets

The same debugging path with one extra step: trace, span, reference id, content store. The store can redact known patterns on write and log every read. Most tickets do not need the content at all, because the span already shows the model, the tokens, the latency, the tool calls and the status.

### What you give up

A one-click view of the prompt inside the trace UI. That is the price, and it is small next to a trace backend full of customer data.

## Follow-ups

- **Level 2:** Which spans may carry raw content when capture is on? Expected: none in production. Keep one rule, references only, so nobody has to decide per span.
- **Level 3:** A developer turns capture on in staging for a day. What is the risk? Expected: staging often replays production prompts, and the backend keeps them for its retention period. Use synthetic prompts or scrub before export.
- **Level 3:** How do you keep the content store from becoming the same leak? Expected: access by role, an audit log of reads, a retention period, and redaction of known patterns before the write.

## Wrong answers

- "Turn it on, the trace backend is internal." Internal operators read traces, and the backend's retention is not your policy.
- "Store a hash of the prompt on the span." A hash shows a repeat but gives support nothing to read. A reference id into a controlled store does both.
- "Keep the content on the span and strip personal data with a regex." Patterns miss, and the span is still the wrong store with the wrong retention.

## Taught in

The [conventions lesson](../../../phases/14-agent-engineering/23-otel-genai-conventions/) sets the opt-in rule and the pattern of storing content outside the span, and the [OpenTelemetry GenAI lesson](../../../phases/13-tools-and-protocols/20-opentelemetry-genai/) names the content events.
