---
name: skill-fine-tuning-guide
description: Decision tree for when and how to fine-tune LLMs with LoRA and QLoRA
version: 1.0.0
phase: 11
lesson: 8
tags: [fine-tuning, lora, qlora, peft, llm-engineering]
---

# Fine-Tuning Decision Guide

Before fine-tuning, try these in order:

```
1. Prompt engineering (minutes, $0)
2. Few-shot examples in prompt (minutes, $0)
3. RAG for knowledge retrieval (days, $10-100/month)
4. Fine-tuning with LoRA/QLoRA (days, $5-50 per experiment)
5. Full fine-tuning (weeks, $100-10,000 per run)
```

Only move to the next step if the previous one is measurably insufficient.

## When to fine-tune

- Model needs a consistent output style or format that prompting cannot achieve
- You're distilling a larger model (GPT-4 quality from an 8B model)
- Latency matters and few-shot examples add too many tokens
- You need the model to reliably follow a complex reasoning pattern
- You have 1,000+ high-quality examples of the desired input-output behavior

## When NOT to fine-tune

- The model already does what you want with the right prompt
- You need the model to know facts (use RAG instead)
- You have fewer than 500 training examples (likely to overfit)
- The task changes frequently (retraining is expensive)
- You need to audit which data influenced a specific output (fine-tuning is a black box)

## Method selection

| GPU VRAM | 7B model | 13B model | 70B model |
|----------|----------|-----------|-----------|
| 16GB (T4) | QLoRA | Not feasible | Not feasible |
| 24GB (3090/4090) | QLoRA or LoRA | QLoRA | Not feasible |
| 40GB (A100) | LoRA or Full | QLoRA or LoRA | QLoRA |
| 80GB (A100/H100) | Full | LoRA or Full | QLoRA or LoRA |

## LoRA configuration checklist

1. Start with r=16, alpha=32 (safe default for most tasks)
2. Target q_proj and v_proj first (minimum viable LoRA)
3. Use learning rate 2e-4 for QLoRA, 5e-5 for LoRA fp16
4. Set lora_dropout=0.05
5. Train for 1-3 epochs (more risks overfitting)
6. Evaluate every 100 steps on a held-out set
7. Save checkpoints and pick the best by eval loss

## Common mistakes

- Training for too many epochs (overfitting after epoch 2-3 on small datasets)
- Using the same learning rate as full fine-tuning (LoRA needs higher LR)
- Forgetting to set the pad token (causes NaN losses with Llama models)
- Not freezing the base model (defeats the purpose of LoRA)
- Evaluating only on training data (always hold out 10-20% for eval)
- Skipping the prompt engineering baseline (fine-tuning a problem that prompting already solves)

## Quality verification

After training, compare on 200+ held-out examples:
1. Base model with best prompt (baseline)
2. Base model with LoRA adapter (your fine-tuned model)
3. GPT-4 or Claude with same prompt (ceiling)

If the LoRA model does not beat the prompted baseline, your training data or configuration needs work, not more compute.

## Adapter management

- Keep adapters separate for multi-task serving (swap adapters per request)
- Merge adapters into base weights for single-task deployment
- Store adapters on Hugging Face Hub (10-100MB, easy to version and share)
- Test merged model outputs match unmerged outputs before deploying
- Use TIES-Merging or DARE to combine multiple adapters into one

## Debugging training

If loss does not decrease:
1. Check learning rate (too low for LoRA, try 2e-4)
2. Verify LoRA layers are actually receiving gradients
3. Confirm base model weights are frozen
4. Check data formatting (tokenizer must match model's expected format)

If loss decreases but eval quality is bad:
1. Training data quality issue (garbage in, garbage out)
2. Overfitting (reduce epochs, increase dropout, add more data)
3. Wrong target modules (add MLP layers for complex tasks)
4. Rank too low (try r=32 or r=64)
