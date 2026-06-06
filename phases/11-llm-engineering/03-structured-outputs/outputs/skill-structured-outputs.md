---
name: skill-structured-outputs
description: Decision framework for choosing the right structured output strategy based on provider, reliability, and complexity
version: 1.0.0
phase: 11
lesson: 03
tags: [structured-output, json, schema, constrained-decoding, pydantic, function-calling]
---

# Structured Output Strategy

When building an LLM application that requires structured data, apply this decision framework.

## When to use each approach

**Prompt-based ("Return JSON"):** Prototyping only. Acceptable for internal tools where occasional parse failures are tolerable. Add a try/except with retry. Never use in production pipelines.

**JSON mode (API flag):** You need guaranteed valid JSON but the schema is simple or flexible. Works when you validate the shape on the application side. Available: OpenAI, Anthropic (via tool use), Google.

**Schema mode (constrained decoding):** Production systems where every output must match a specific schema. Zero parse failures. Zero schema violations. Use this by default for any production extraction or classification task. Available: OpenAI structured outputs, Outlines, Guidance.

**Function calling / tool use:** The model needs to choose which function to call, not just fill parameters. You have multiple schemas and the model selects the appropriate one. Also use when integrating with existing tool/function infrastructure.

**Instructor library:** You want Pydantic validation with automatic retry across any provider. Best DX for Python projects. Wraps OpenAI, Anthropic, Google, and open-source models.

## Provider-specific guidance

**OpenAI:** Use `response_format` with `json_schema` type. Constrained decoding is built in. Pydantic models work directly. Most reliable structured output implementation.

**Anthropic:** Use tool use for structured output. Define a single tool with the desired schema. The model returns tool call arguments matching the schema. Reliable but requires the tool use API pattern.

**Open-source models (vLLM, Ollama):** Use Outlines or Guidance for constrained decoding. These libraries compile JSON Schemas into finite state machines that mask invalid tokens during generation. Requires running inference locally.

## Schema design guidelines

1. Keep schemas flat when possible. Nested objects beyond 2 levels increase extraction errors.
2. Use enums for categorical fields. Do not rely on the model inventing the right string.
3. Make ambiguous fields required with explicit null support rather than optional. Forces the model to make a decision.
4. Add descriptions to schema properties. The model reads these as instructions.
5. Avoid union types (oneOf/anyOf) unless necessary. They increase decoding complexity.
6. Set minimum/maximum on numbers. Catches hallucinated extreme values.
7. Use minItems/maxItems on arrays to prevent empty or unbounded outputs.

## Common failure patterns and fixes

- **Model wraps JSON in markdown fences**: switch from prompt-based to JSON mode or schema mode
- **Schema-valid but factually wrong**: add an LLM-as-judge validation step after extraction
- **Inconsistent enum values**: switch to constrained decoding or add post-processing normalization
- **Missing optional fields**: make them required or add default values in application code
- **Very slow extraction**: constrained decoding adds 5-15% latency, reduce schema complexity if latency-sensitive
- **Large arrays with varied items**: chunk the input and extract per-chunk, then merge results

## Reliability ladder

| Approach | Parse Success | Schema Match | Setup Effort |
|----------|-------------|-------------|-------------|
| Prompt-based | ~90% | ~80% | 1 minute |
| JSON mode | 100% | ~90% | 5 minutes |
| Schema mode | 100% | ~99% | 15 minutes |
| Constrained decoding | 100% | 100% | 30 minutes |
| Instructor + retry | 100% | ~99.5% | 10 minutes |
