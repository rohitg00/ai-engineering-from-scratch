---
name: skill-evaluation
description: Decision framework for choosing the right LLM evaluation strategy based on task type, budget, and requirements
version: 1.0.0
phase: 10
lesson: 10
tags: [evaluation, evals, benchmarks, llm-as-judge, elo, metrics]
---

# LLM Evaluation Strategy

When evaluating an LLM system, apply this decision framework to choose the right approach.

## When to use each eval type

**Benchmarks (MMLU, HumanEval, SWE-bench):** You are doing initial model selection. You need to narrow 10 candidate models to 3. Benchmarks give rough ranking at zero cost. Do not use benchmarks as your final evaluation.

**Custom evals:** You are building for production. You have a specific task with specific failure modes. Custom evals are the only evaluation that predicts real-world performance. Minimum 50 test cases for prototype, 200+ for production.

**LLM-as-judge:** Your task is open-ended (summarization, writing, conversation). Exact match and token overlap metrics are too rigid. LLM-as-judge costs ~$0.01 per judgment and agrees with humans ~80% of the time. Always use a rubric, not a vague prompt.

**Human evals:** The stakes are high and automated metrics disagree. Human eval is the ground truth but costs $0.10-$2.00 per judgment. Reserve for ambiguous cases and periodic calibration of automated metrics.

**ELO from pairwise comparisons:** You are comparing multiple models on the same task. Pairwise is more reliable than absolute scoring because humans (and LLM judges) are better at relative judgments.

## Scoring function selection

- **Exact match**: classification, entity extraction, structured outputs with known answers
- **Token F1**: extraction tasks where partial credit matters
- **ROUGE-L**: summarization, translation
- **BLEU**: machine translation
- **LLM-as-judge**: open-ended generation, conversational quality, helpfulness
- **Execution-based**: code generation (run the code, check if tests pass)
- **Schema compliance**: structured outputs (does the JSON match the schema?)

## Red flags in eval design

- Eval set smaller than 50 cases: results are statistically meaningless
- No edge cases: you are measuring happy-path performance, which is always higher than real-world
- Single metric: different metrics tell different stories, use at least two
- No versioning: you cannot track improvement without versioned eval sets
- Eval set contamination: never include eval examples in fine-tuning data or few-shot prompts
- Testing only one model: you need a baseline (even a simple heuristic) for comparison

## Eval pipeline checklist

1. Define the task precisely (not "answer questions" but "classify support tickets into 5 categories")
2. Create test cases across happy path, edge cases, and known regressions
3. Select 2-3 scoring functions appropriate for the task type
4. Set pass/fail thresholds based on production requirements
5. Automate execution: one command runs the full suite
6. Version everything: test cases, scoring functions, prompts, model versions
7. Run on every change: prompt updates, model swaps, code deployments
8. Track trends: a single score is noise, a trendline is signal
9. Calibrate against human judgment quarterly
10. Add regression cases whenever a production failure is discovered
