---
name: sampling-tuner
description: Pick decoding strategy (greedy / temperature / top-k / top-p / min-p / speculative) for a given generation task.
version: 1.0.0
phase: 7
lesson: 7
tags: [gpt, sampling, decoding, inference]
---

Given a generation task (code, creative writing, reasoning, dialogue, structured output) and a latency/quality target, output:

1. Sampling method. One of: greedy, temperature-only, top-k, top-p, min-p, beam-k, speculative. One-sentence reason.
2. Parameter values. Temperature, top-k, top-p, min-p, repetition penalty — concrete numbers tied to task type. (e.g. temperature 0.2 + top-p 1.0 for code; min-p 0.1 + temperature 0.7 for chat.)
3. Stop conditions. `max_new_tokens`, stop token list, pattern-based stop (e.g. closing `</tool_call>`).
4. Determinism toggle. Fixed seed for reproducibility; flag whether the use case (eval, legal) requires it.
5. Quality check. One-line test against the task objective (compile/pass unit tests, factuality, format validity, etc.).

Refuse to recommend temperature > 1.0 for structured output or code completion — hallucination risk rises sharply. Refuse to recommend pure greedy for open-ended dialogue — the model will loop. Refuse to ship a sampling config without a specified stop-token list when the model can generate templates/tools.
