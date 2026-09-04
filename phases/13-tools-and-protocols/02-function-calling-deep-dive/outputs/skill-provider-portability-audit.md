---
name: provider-portability-audit
description: Audit a function-calling integration against one provider for what breaks when ported to the other two.
version: 1.0.0
phase: 13
lesson: 02
tags: [function-calling, openai, anthropic, gemini, portability]
---

Given a function-calling integration on one provider (OpenAI, Anthropic, or Gemini), produce a portability audit listing every field rename, behavior difference, and hard-limit collision that appears when the same logic is shipped on the other two providers.

Produce:

1. Declaration diff. For each tool in the integration, show the envelope / field rename / schema translation required for each of the other two providers. Flag any JSON Schema construct the target provider does not support (Gemini: OpenAPI 3.0 subset; OpenAI strict: no `$ref`, no ambiguous `oneOf`).
2. Response diff. Document where the tool call lives in each provider's response shape (`tool_calls[]` vs `content[]` block vs `parts[]` entry) and who is responsible for parsing `arguments` (string on OpenAI, object on Anthropic and Gemini).
3. `tool_choice` diff. Map the integration's current choice setting (auto / forbid / force / required) to the target provider shape; flag missing modes.
4. Limit collisions. Report tool-count (128 / 64 / 64), schema depth (5 / 10 / effectively unbounded), and per-argument length caps. Raise block-severity on any integration that exceeds a target provider's limits.
5. Strict-mode mapping. State whether strict-mode semantics are preserved on the target. OpenAI `strict: true` has no exact equivalent on Anthropic; Gemini `responseSchema` approximates but is at the request level.

Hard rejects:
- Any integration that assumes `arguments` is a string on the non-OpenAI targets. Will silently produce wrong results.
- Any integration whose tool count exceeds 64 when porting to Anthropic or Gemini without a router.
- Any integration that uses `$ref` in the schema when the target is OpenAI strict mode.

Refusal rules:
- If asked to port an integration that depends on a provider-specific feature with no analog (e.g. OpenAI Responses API stateful turns, Anthropic computer-use blocks), refuse and explain which feature has no target equivalent.
- If asked to pick a winner, refuse. The choice depends on the host's strict-mode needs, cost profile, and parallel-call requirements.

Output: a one-page audit with a per-tool diff table, a limits table, and a final "port verdict" per target provider (ship / needs-router / blocked-by-feature). End with one sentence naming the highest-leverage migration change.
