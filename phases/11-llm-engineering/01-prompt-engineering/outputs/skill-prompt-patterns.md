---
name: skill-prompt-patterns
description: Decision framework for choosing the right prompt pattern based on task type, reliability requirements, and target model
version: 1.0.0
phase: 11
lesson: 01
tags: [prompt-engineering, patterns, llm, temperature, cross-model, few-shot, chain-of-thought]
---

# Prompt Pattern Selection Guide

When building an LLM-powered feature, choose your prompt pattern before writing the prompt. The pattern determines the structure. The content fills it in.

## Pattern Decision Matrix

| Task Type | Primary Pattern | Secondary Pattern | Temperature | Few-Shot Needed? |
|-----------|----------------|-------------------|-------------|-----------------|
| Data extraction | Template Fill | Few-Shot | 0.0 | Yes (2-3 examples) |
| Classification | Few-Shot | Guardrail | 0.0 | Yes (3-5 examples) |
| Summarization | Persona + Template | Audience Adapt | 0.3 | No |
| Code generation | Persona | Chain-of-Thought | 0.0 | Optional |
| Creative writing | Persona | Critique | 0.7-1.0 | No |
| Multi-step reasoning | Chain-of-Thought | Decomposition | 0.3 | Optional |
| Question answering | Persona + Guardrail | Boundary | 0.3 | No |
| Prompt generation | Meta-Prompt | Critique | 0.7 | Yes (1-2 examples) |
| Content moderation | Guardrail + Boundary | Few-Shot | 0.0 | Yes (5+ examples) |
| Translation/adaptation | Audience Adapt | Few-Shot | 0.3 | Yes (2-3 examples) |

## When to Use Each Pattern

**Persona Pattern**: use for every prompt as a baseline. The only question is how specific to make the role. For generic tasks, a broad role suffices. For domain-specific tasks, the role should name the domain, seniority level, and context.

**Few-Shot Pattern**: use when output format matters more than content. If the model needs to produce a specific JSON shape, CSV format, or classification label, examples are more effective than instructions. Rule of thumb: 2-3 examples for simple formats, 5+ for complex or ambiguous formats.

**Chain-of-Thought Pattern**: use for math, logic, multi-step analysis, and any task where the model needs to "show its work." Improves accuracy by 10-40% on reasoning tasks (Wei et al., 2022). Do NOT use for simple factual lookups or extraction -- it wastes tokens.

**Template Fill Pattern**: use for structured extraction where every output must have the same shape. Works best with temperature=0.0 and explicit "N/A" handling for missing fields.

**Critique Pattern**: use when quality matters more than speed. The model generates, critiques, and improves. Roughly doubles token cost but significantly improves accuracy and completeness. Best for high-stakes outputs (reports, recommendations, public-facing content).

**Guardrail Pattern**: use for any user-facing system. Always include: scope boundaries, refusal behavior for out-of-scope requests, and explicit "I don't know" handling. Combine with input validation on the application side.

**Meta-Prompt Pattern**: use to generate prompts for new tasks. Instead of writing a prompt from scratch, describe the task and let the model write the prompt. Then test and iterate. Saves time on initial prompt development.

**Decomposition Pattern**: use for complex problems that benefit from divide-and-conquer. The model breaks the problem into parts, solves each, and combines. Most effective for tasks with 3-7 sub-problems.

**Audience Adaptation Pattern**: use when the same content needs to serve different audiences. Specify the audience explicitly -- do not rely on the model guessing from context.

**Boundary Pattern**: use for production systems that must NEVER answer certain types of questions. Stronger than guardrails because it defines a hard scope with an exact refusal message. Essential for compliance-sensitive domains.

## Cross-Model Compatibility

Patterns ranked by how consistently they work across GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, and Llama 3:

| Pattern | Cross-Model Consistency | Notes |
|---------|------------------------|-------|
| Few-Shot | Very high | Examples transfer well across all models |
| Template Fill | Very high | Explicit structure leaves little room for divergence |
| Chain-of-Thought | High | All major models support "think step by step" |
| Persona | High | Works everywhere but different models respond to different role specificity levels |
| Guardrail | Moderate | Claude follows guardrails most strictly; GPT-4o sometimes drifts in long conversations |
| Critique | Moderate | Quality of self-critique varies significantly by model |
| Meta-Prompt | Moderate | GPT-4o and Claude produce different prompt styles |
| Boundary | Low-Moderate | Refusal behavior varies; test per model |

## Common Mistakes

1. **Using Chain-of-Thought for everything**: CoT adds tokens and latency. Only use it when reasoning steps are needed.
2. **Too many constraints**: more than 5-7 constraints and the model starts dropping some. Prioritize the 3 most important.
3. **Contradictory persona + constraints**: "You are a creative writer" + "Never use metaphors" confuses the model.
4. **No temperature specification**: leaving temperature at default (usually 1.0) when you need deterministic output.
5. **Copy-pasting prompts across models**: always test. A prompt tuned for GPT-4o may underperform on Claude and vice versa.
6. **Ignoring system message**: putting everything in the user message instead of using the system message for persistent rules.
7. **Over-relying on negative constraints**: "Do NOT do X, Y, Z, A, B, C" is less effective than "ONLY do W." Positive framing gives the model a clear target.

## Reliability Targets

| Use Case | Pattern Combination | Expected Accuracy | Token Cost |
|----------|-------------------|-------------------|------------|
| Production extraction | Template + Few-Shot | 95%+ | Low (500-1K) |
| User-facing Q&A | Persona + Guardrail + Boundary | 90%+ | Medium (1-2K) |
| Code generation | Persona + Chain-of-Thought | 85%+ | Medium (1-3K) |
| Content generation | Persona + Critique | 90%+ quality | High (2-4K, double pass) |
| Classification | Few-Shot + Guardrail | 95%+ | Low (300-800) |
| Complex analysis | Decomposition + Chain-of-Thought | 85%+ | High (3-5K) |
