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
   - No: evaluate **self-consistency** on a held-out set. Treat N=5 and temperature 0.7 only as an experiment starting point, then tune both and keep the technique only when its quality gain justifies the measured inference cost. Continue to step 4.

4. Is the problem a search/planning problem with many possible paths?
   - Yes: use **Tree-of-Thought**.
   - No: self-consistency is sufficient.

5. Does the task require external information or computation?
   - Yes: use **ReAct** (reasoning + tool calls).
   - No: pure reasoning techniques are sufficient.

## Technique Matrix

| Technique | Quality evidence to collect | Relative inference work | Best For |
|-----------|-----------------------------|-------------------------|----------|
| Zero-shot | Held-out baseline | One generation | Simple tasks, factual Q&A |
| Few-shot | Compare example sets and ordering | One longer generation | Format matching, classification |
| Zero-shot CoT | Compare against direct answers | One longer generation | Quick reasoning experiment |
| Few-shot CoT | Test transfer beyond demonstrations | One longer generation | Math, logic, multi-step |
| Self-Consistency | Plot quality against sample count | N independent generations | High-stakes reasoning |
| Tree-of-Thought | Track node count, solve rate, and pruning errors | One generation per explored node | Search, planning, puzzles |
| ReAct | Track tool accuracy and task success | Multiple model/tool turns | Knowledge-grounded tasks |
| Prompt Chaining | Validate each intermediate contract | One generation per chain step | Complex multi-part tasks |

## Model-Specific Guidance

### GPT-4o / GPT-4.1
- Strong baseline reasoning. Zero-shot CoT often sufficient.
- Benchmark direct answers, explicit reasoning, and few-shot CoT on the target workload; do not transfer accuracy figures from a different model snapshot or prompt.
- Add self-consistency only when independently sampled paths improve held-out quality enough to justify the extra inference.
- Supports structured outputs natively for answer extraction.

### Claude 3.5 Sonnet / Claude 3.7 Sonnet
- Excellent at following structured prompt formats (XML tags).
- Few-shot CoT with XML-delimited examples works best.
- Extended thinking (Claude 3.7) is native CoT -- no need to prompt for it.
- For self-consistency experiments, temperature 0.7 is a starting point rather than a default; tune for useful path diversity and verify the quality gain and inference cost on held-out tasks.

### Llama 3.1/3.3 70B
- Benefits most from few-shot CoT (larger accuracy gap vs zero-shot).
- For reasoning tasks, treat self-consistency with N=5 as an experiment starting point; choose the final sample count from held-out quality and measured inference cost.
- Needs more explicit format instructions than commercial models.
- ToT is expensive on local inference -- consider only for batch processing.

### Gemini 2.5 Pro
- Strong at multi-step reasoning out of the box.
- Thinking mode provides built-in CoT without prompt engineering.
- Few-shot examples help with format consistency more than accuracy.
- Large context window (1M) makes example-heavy few-shot practical.

## Anti-Patterns

**CoT for simple tasks**: asking "What is 2+2? Let's think step by step" wastes tokens. The model gets simple arithmetic right without reasoning traces. CoT helps when there are 3+ steps.

**Self-consistency at temperature 0.0**: deterministic decoding does not intentionally create diverse reasoning paths. Start experiments with a nonzero temperature (0.5-0.8 is a useful search range), then tune it against held-out quality, agreement, and inference cost instead of treating the range as a universal recommendation.

**ToT for everything**: ToT requires O(b^d) LLM calls where b=branching factor and d=depth. A tree with b=3, d=3 needs up to 39 calls. Reserve for problems where cheaper techniques fail.

**Few-shot with bad examples**: examples with reasoning errors teach the model to make those errors. Every example must be verified. One wrong example can reduce accuracy more than zero examples.

**Extracting answers without a consistent format**: self-consistency requires comparing answers across samples. If the answer format varies ("$18", "18 dollars", "eighteen"), voting fails. Always enforce: "The answer is [number]."

## Cost Optimization

Measure cost with the provider's current prices and the application's observed input, output, and reasoning-token counts. Do not pair a generic accuracy claim with a vendor price: both vary by model snapshot, workload, prompt, and date.

| Technique | Cost inputs to record | Quality input to record |
|-----------|-----------------------|-------------------------|
| Zero-shot | Input and output tokens for one generation | Held-out baseline |
| Few-shot CoT | Demonstration tokens plus generated reasoning | Held-out result for the exact example set |
| Self-Consistency | Per-sample tokens multiplied by sample count | Majority-vote result and agreement rate |
| Tree-of-Thought | Tokens across every generated and evaluated node | Solve rate and nodes explored |

Start with the cheapest measured baseline. Add examples or self-consistency only where the observed quality gain justifies the additional inference work.

## Integration with Prompt Chaining

Reasoning techniques compose with prompt chaining:

**Chain Step 1** (Extract): zero-shot, temperature 0.0
**Chain Step 2** (Reason): few-shot CoT, temperature 0.0
**Chain Step 3** (Verify): self-consistency; N=3 and temperature 0.7 are experiment starting points to tune on held-out tasks

This chain can catch extraction and reasoning errors and expose the verification vote's agreement rate. Its cost depends on the tuned sample count and observed token usage, so retain it only when held-out quality gains justify that measured cost.

## When to Move Beyond Prompting

If you are spending more time engineering prompts than writing application code, consider:

1. **Fine-tuning**: if you have 500+ labeled examples and the task is narrow
2. **DSPy compilation**: if you want automated prompt optimization
3. **Agent frameworks**: if the task requires multi-turn tool use (Phase 14)
4. **RAG**: if the model needs access to private/current knowledge (Lessons 06-07)

Prompting techniques are the foundation. They work with any model, any provider, and require no training data. But they have limits. Knowing when to graduate to the next level is as important as mastering the techniques themselves.
