---
id: read-this-span
title: Review one span from a new instrumentation branch
card: production-mlops
kind: code-reading
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, design-review]
tags: [opentelemetry, genai-conventions, pii, tracing]
minutes: 12
lessons: [phases/13-tools-and-protocols/20-opentelemetry-genai, phases/14-agent-engineering/23-otel-genai-conventions, phases/19-capstone-projects/28-observability-otel-traces]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/span-kind-client-or-internal, production-mlops/prompts-in-span-attributes]
updated: 2026-11-03
---

A colleague opens a review that adds tracing to the agent. The branch emits this span for every model call. List every problem you find before you approve it.

```json
{
  "traceId": "abcdefabcdefabcdefabcdefabcdefab",
  "spanId": "abcdefabcdefabcd",
  "parentSpanId": "",
  "name": "chat",
  "kind": "INTERNAL",
  "attributes": {
    "gen_ai.operation.name": "chat",
    "gen_ai.request.model": "our_smart_model",
    "gen_ai.usage.prompt_tokens": 500,
    "gen_ai.content.prompt": "You are a support agent. The customer's card number is ..."
  }
}
```

## Short answer

The span marks a model call as INTERNAL, has no parent, and uses an old attribute name for the input tokens. It omits the provider, the output tokens, the response model and the response id, and it writes the prompt text, with a card number in it, into the trace. Fix the kind and the parent link, use the current attribute names, add the missing attributes, and move the content out of the span.

## Full answer

### The problems, in order of damage

| Line | Problem | Fix |
|---|---|---|
| `parentSpanId: ""` | an orphan span; no backend can show which agent step made the call | pass the parent context from the `invoke_agent` span |
| `kind: INTERNAL` | a model call crosses a process boundary | `CLIENT` |
| `gen_ai.content.prompt` | prompt text with customer data in a store that operators read | capture off by default; store content outside and put a reference id on the span |
| `gen_ai.usage.prompt_tokens` | the attribute was renamed; backends read `gen_ai.usage.input_tokens` | use the current name and add `gen_ai.usage.output_tokens` |
| no `gen_ai.provider.name` | cost and error dashboards cannot split by provider | set it on every model span |
| no `gen_ai.response.model` | with routing, the served model can differ from the requested alias | record what the provider returned |
| no `gen_ai.response.id` | no way to match the span to the provider's own log | record the response id |

### Why the content line is the one to fight over

The conventions say instrumentations should not capture inputs and outputs by default. Capture is opt-in through an environment variable, and the production pattern stores content in your own log store and records a pointer on the span. A prompt with a card number in a trace backend is a data leak with a retention policy you did not choose.

### Why the renamed attribute will come back

The GenAI conventions are still marked as in development, and they have renamed attributes before. Pin the conventions version you emit, set the stability opt-in, and test the attribute names of emitted spans, or the next SDK upgrade reopens this review.

## Follow-ups

- **Level 3:** Why does the empty parent matter more than the wrong kind? Expected: with no parent the span is an orphan, the trace is no longer a tree, and you cannot see which step made the call.
- **Level 3:** The team needs the prompt text to debug failures. What do you offer? Expected: store prompts in a separate store with access control and put a reference id on the span, which is the pattern the conventions recommend for production.
- **Level 4:** How do you keep the old attribute name from returning after an upgrade? Expected: pin the conventions version, set the stability opt-in variable, and add a test that asserts the attribute names on emitted spans.

## Wrong answers

- "It has a trace id and a model name, so it is fine." A trace id alone does not link the span to its parent, and a model name without a provider cannot be attributed.
- "Keep the prompt in the span, it is useful." Prompts carry personal data and secrets into a store that operators read. The default is off, and production stores content outside the span.
- "The two token names are synonyms." Backends read the current name. The old one lands in an unknown attribute, and the token dashboard shows nothing.

## Taught in

The [OpenTelemetry GenAI lesson](../../../phases/13-tools-and-protocols/20-opentelemetry-genai/) lists the required attributes, the [conventions lesson](../../../phases/14-agent-engineering/23-otel-genai-conventions/) gives the content-capture rule, and the [capstone traces lesson](../../../phases/19-capstone-projects/28-observability-otel-traces/) notes the renamed token attribute.
