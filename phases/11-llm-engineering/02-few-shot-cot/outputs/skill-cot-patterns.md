---
name: skill-cot-patterns
description: Decision framework for choosing the right reasoning technique based on task complexity, accuracy requirements, and cost constraints
version: 1.0.0
phase: 11
lesson: 02
tags: [chain-of-thought, few-shot, self-consistency, tree-of-thought, react, reasoning, prompting]
---

# Reasoning Technique Selection Guide

When you need an LLM to reason through a problem, choose the technique before writing the prompt. The technique determines the reasoning architecture. The prompt fills it in.

## Quick Decision Tree

1. Is the task a simple factual lookup or single-step classification?
   - Yes: use **zero-shot**. CoT adds cost with no accuracy gain.
   - No: continue.

2. Does the task require multi-step reasoning (math, logic, planning)?
   - Yes: use **Chain-of-Thought**. Continue to step 3.
   - No: use **few-shot** if format matters, zero-shot if it does not.

3. Is a single reasoning error acceptable?
   - Yes: use **few-shot CoT** (single sample, temperature 0.0).
   - No: use **self-consistency** (N=5, temperature 0.7). Continue to step 4.

4. Is the problem a search/planning problem with many possible paths?
   - Yes: use **Tree-of-Thought**.
   - No: self-consistency is sufficient.

5. Does the task require external information or computation?
   - Yes: use **ReAct** (reasoning + tool calls).
   - No: pure reasoning techniques are sufficient.

## Technique Matrix

| Technique | Accuracy Lift | Cost Multiplier | Latency | Best For |
|-----------|--------------|-----------------|---------|----------|
| Zero-shot | Baseline | 1x | ~1s | Simple tasks, factual Q&A |
| Few-shot | +5-15% | 1.2x | ~1s | Format matching, classification |
| Zero-shot CoT | +10-20% | 1.3x | ~1.5s | Quick reasoning boost |
| Few-shot CoT | +15-25% | 1.5x | ~2s | Math, logic, multi-step |
| Self-Consistency (N=5) | +2-5% over CoT | 5x | ~5s | High-stakes reasoning |
| Self-Consistency (N=10) | +1-2% over N=5 | 10x | ~10s | Critical decisions only |
| Tree-of-Thought | Task-dependent | 10-40x | ~30s+ | Search, planning, puzzles |
| ReAct | Task-dependent | 3-10x | ~5-15s | Knowledge-grounded tasks |
| Prompt Chaining | +5-10% over single | 2-5x | ~5-10s | Complex multi-part tasks |

## Model-Specific Guidance

### GPT-4o / GPT-4.1
- Strong baseline reasoning. Zero-shot CoT often sufficient.
- Few-shot CoT with 3 examples hits 95% on GSM8K.
- Self-consistency gives marginal gains (95% to 97%) -- only worth it for critical tasks.
- Supports structured outputs natively for answer extraction.

### Claude 3.5 Sonnet / Claude 3.7 Sonnet
- Excellent at following structured prompt formats (XML tags).
- Few-shot CoT with XML-delimited examples works best.
- Extended thinking (Claude 3.7) is native CoT -- no need to prompt for it.
- Self-consistency is effective because Claude's reasoning varies well at temperature 0.7.

### Llama 3.1/3.3 70B
- Benefits most from few-shot CoT (larger accuracy gap vs zero-shot).
- Self-consistency with N=5 recommended for reasoning tasks.
- Needs more explicit format instructions than commercial models.
- ToT is expensive on local inference -- consider only for batch processing.

### Gemini 2.5 Pro
- Strong at multi-step reasoning out of the box.
- Thinking mode provides built-in CoT without prompt engineering.
- Few-shot examples help with format consistency more than accuracy.
- Large context window (1M) makes example-heavy few-shot practical.

## Anti-Patterns

**CoT for simple tasks**: asking "What is 2+2? Let's think step by step" wastes tokens. The model gets simple arithmetic right without reasoning traces. CoT helps when there are 3+ steps.

**Self-consistency at temperature 0.0**: all N samples will be identical. You must use temperature > 0 (0.5-0.8 recommended) for diverse reasoning paths.

**ToT for everything**: ToT requires O(b^d) LLM calls where b=branching factor and d=depth. A tree with b=3, d=3 needs up to 39 calls. Reserve for problems where cheaper techniques fail.

**Few-shot with bad examples**: examples with reasoning errors teach the model to make those errors. Every example must be verified. One wrong example can reduce accuracy more than zero examples.

**Extracting answers without a consistent format**: self-consistency requires comparing answers across samples. If the answer format varies ("$18", "18 dollars", "eighteen"), voting fails. Always enforce: "The answer is [number]."

## Cost Optimization

For a production system handling 10,000 queries/day at GPT-4o pricing ($2.50/1M input, $10/1M output):

| Technique | Avg Tokens/Query | Daily Cost | Accuracy |
|-----------|-----------------|------------|----------|
| Zero-shot | ~200 | ~$5 | 78% |
| Few-shot CoT | ~600 | ~$15 | 95% |
| Self-Consistency (N=5) | ~3,000 | ~$75 | 97% |
| ToT (b=3, d=2) | ~6,000 | ~$150 | Task-dependent |

The cost-optimal strategy for most applications: start with few-shot CoT. Add self-consistency only for queries where confidence is low (the escalation pattern from the Build It section).

## Integration with Prompt Chaining

Reasoning techniques compose with prompt chaining:

**Chain Step 1** (Extract): zero-shot, temperature 0.0
**Chain Step 2** (Reason): few-shot CoT, temperature 0.0
**Chain Step 3** (Verify): self-consistency with N=3, temperature 0.7

This three-step chain costs ~3x a single CoT call but catches extraction errors, reasoning errors, and provides a confidence score from the verification step.

## When to Move Beyond Prompting

If you are spending more time engineering prompts than writing application code, consider:

1. **Fine-tuning**: if you have 500+ labeled examples and the task is narrow
2. **DSPy compilation**: if you want automated prompt optimization
3. **Agent frameworks**: if the task requires multi-turn tool use (Phase 14)
4. **RAG**: if the model needs access to private/current knowledge (Lessons 06-07)

Prompting techniques are the foundation. They work with any model, any provider, and require no training data. But they have limits. Knowing when to graduate to the next level is as important as mastering the techniques themselves.
