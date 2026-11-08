---
id: renamed-token-attribute
title: The token dashboard reads zero after an SDK upgrade
card: production-mlops
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [debugging, screen]
tags: [opentelemetry, genai-conventions, dashboards, upgrades]
minutes: 8
lessons: [phases/19-capstone-projects/28-observability-otel-traces, phases/14-agent-engineering/23-otel-genai-conventions]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/read-this-span, production-mlops/prompts-in-span-attributes]
updated: 2026-11-03
---

After a routine upgrade of the tracing SDK, the token usage panels show zero for every model, while request counts and latency panels look normal. Nothing else was deployed. Where do you look first?

## Short answer

Look at the attribute names on the spans the service emits now. The GenAI conventions are still marked as in development, and they have renamed attributes before: the input token count moved from `gen_ai.usage.prompt_tokens` to `gen_ai.usage.input_tokens`. If the SDK emits the new name and the dashboard queries the old one, every token panel reads zero while counts and latency keep working. Pin the conventions version you emit, and set the stability opt-in so that the names do not move under you.

## Full answer

### Why only the token panels broke

Request counts come from the number of spans, and latency comes from span start and end times. Neither depends on an attribute name. A token panel sums one attribute by its key. A renamed key makes the sum zero, and nothing errors.

### Confirm it in one minute

Pull one raw span from after the upgrade and one from before. Compare the attribute keys. The old key is gone, and the new one carries the numbers.

### Two fixes, in order

1. Change the dashboard queries to the new key. During the transition, sum both keys so that old and new spans show.
2. Stop the names from moving: pin the conventions version in the emitter, set `OTEL_SEMCONV_STABILITY_OPT_IN`, and check the names on every SDK upgrade.

### Prevent the repeat

The capstone's tests assert that the canonical attributes are present on emitted spans. Run them on every dependency upgrade. Add an alert for the shape of this incident: token sum at zero while the request count is above zero.

## Follow-ups

- **Level 2:** Why did the count and latency panels keep working? Expected: they use span counts and span timing, which do not depend on an attribute name.
- **Level 3:** How do you catch the next rename before production? Expected: a test on emitted spans that asserts the canonical attribute names, run on every dependency upgrade.
- **Level 3:** Should the dashboard read both the old and the new name? Expected: yes for a transition window, as a sum of both. Then remove the old one, so that a future regression stays visible.
- **Level 4:** The backend maps the attributes into its own schema. Does that protect you? Expected: only when the mapping follows the same conventions version. A mapping built for the old name shows the same zero, so test the end-to-end path.

## Wrong answers

- "The models stopped reporting usage." The provider responses did not change. The span emitter did.
- "The backend lost data during the upgrade." The latency panels prove the spans arrive. Only one attribute is missing from the query's point of view.
- "Roll the SDK back and stay there." A pinned conventions version and a test let you upgrade on purpose instead of never.

## Taught in

The [capstone traces lesson](../../../phases/19-capstone-projects/28-observability-otel-traces/) warns that the conventions renamed attributes and tells you to pin the version, and the [conventions lesson](../../../phases/14-agent-engineering/23-otel-genai-conventions/) gives the stability opt-in.
