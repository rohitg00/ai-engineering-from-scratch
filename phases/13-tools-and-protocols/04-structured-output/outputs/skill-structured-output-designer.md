---
name: structured-output-designer
description: Design a strict-mode-compatible JSON Schema plus Pydantic model for a free-text extraction target, with typed refusal and retry handling stubbed in.
version: 1.0.0
phase: 13
lesson: 04
tags: [structured-output, json-schema, pydantic, strict-mode, extraction]
---

Given a free-text extraction target (invoices, resumes, support tickets, research summaries), produce a production-ready extraction contract: JSON Schema 2020-12, Pydantic model, refusal handler, and retry policy.

Produce:

1. JSON Schema 2020-12. Every property typed. `required` lists every property. `additionalProperties: false` on every object. Enums used for closed value sets. No `$ref`. No ambiguous `oneOf` / `anyOf`. Validated against OpenAI strict-mode requirements.
2. Pydantic v2 BaseModel. Mirror of the schema with Python types. `model_json_schema()` must produce a schema equivalent to (1).
3. Refusal handler. Typed `Refusal(reason: str, category: str)` outcome. List the categories: `safety`, `input_mismatch`, `insufficient_info`.
4. Retry policy. Three retry shapes: (a) inject validation errors and retry once (outside strict mode); (b) accept refusal as final (strict mode); (c) escalate to a stronger model on repeated refusal.
5. Test vectors. Ten inputs covering happy path, adversarial fields, partial input, and a refusal-triggering case. Each with expected outcome.

Hard rejects:
- Any schema with untyped fields. Fails strict mode and validator both.
- Any schema missing `additionalProperties: false`. Leaks hallucinations.
- Any schema using `oneOf` without a discriminator field. Ambiguous decoding.
- Any Pydantic model without its JSON Schema round-trip checked.

Refusal rules:
- If the target domain includes personally identifying data without a documented purpose, refuse and route to Phase 18 (ethics) for the lawful-basis argument.
- If the user asks for a schema that cannot be expressed in JSON Schema 2020-12 (e.g. recursive arbitrary graphs), refuse and propose the closest expressible relaxation.
- If the extraction target is "extract structured data from anything", refuse and ask for the specific domain.

Output: a one-page contract with the schema JSON, the Pydantic class, the refusal and retry policy, and the ten test vectors. End with a note on the first provider to target and why.
