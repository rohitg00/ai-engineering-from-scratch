---
name: prompt-alignment-method-selector
description: Choose the right alignment method (SFT, RLHF, DPO, KTO, ORPO, SimPO) for your use case
version: 1.0.0
phase: 10
lesson: 8
tags: [alignment, dpo, rlhf, kto, orpo, simpo, preference-optimization, fine-tuning]
---

# Alignment Method Selector

When choosing an alignment method for a language model, use this framework to evaluate your data, compute, and quality requirements, then select the method that best fits your constraints.

## Input Requirements

Provide:
- **Base model** (e.g., Llama 3 8B, Mistral 7B, Qwen 2.5 72B)
- **Starting point** (base model, or already SFT'd?)
- **Available data** (instruction pairs, preference pairs, unpaired ratings, or none)
- **Compute budget** (GPU hours, number of GPUs)
- **Quality target** (good enough for prototype, competitive with open-source, state-of-the-art)
- **Timeline** (days, weeks, months)

## Decision Matrix

### Quick Selection

| Your Situation | Recommended Method | Why |
|---------------|-------------------|-----|
| No preference data, only instruction pairs | SFT only | You can't align without preference signal |
| < 5,000 preference pairs, limited compute | DPO | Simpler pipeline, works well with small data |
| Unpaired feedback (thumbs up/down only) | KTO | Only method that works without pairwise comparisons |
| Want alignment in a single training run | ORPO | Combines SFT + alignment, no reference model |
| Memory-constrained (can't fit reference model) | SimPO | No reference model needed |
| Large-scale, multi-objective alignment | RLHF (PPO) | Separate reward model captures complex preferences |
| Iterative alignment with online data | RLHF (PPO) | Can generate, rate, and retrain in a loop |
| Post-RLHF refinement | DPO | Fine-tune an RLHF model on targeted preferences |

### Detailed Comparison

| Method | Data Requirement | Models in Memory | Training Loops | Stability | Best Scale |
|--------|-----------------|-----------------|----------------|-----------|------------|
| SFT | Instruction pairs (10K+) | 1 | 1 | High | Any |
| RLHF | Preference pairs (20K+) | 3-4 | 3 | Low | Large (70B+) |
| DPO | Preference pairs (5K+) | 2 | 2 (SFT + DPO) | High | Small-Medium (7B-70B) |
| KTO | Unpaired ratings (5K+) | 2 | 2 (SFT + KTO) | High | Any |
| ORPO | Preference pairs (10K+) | 1 | 1 | High | Small-Medium |
| SimPO | Preference pairs (5K+) | 1 | 2 (SFT + SimPO) | High | Small-Medium |

## Method-Specific Configuration

### SFT

- **When to stop**: After 1-3 epochs or when validation loss stops decreasing
- **Key hyperparameter**: Learning rate (1e-5 to 5e-5, lower for bigger models)
- **Critical detail**: Mask instruction tokens in the loss
- **Gotcha**: More than 3 epochs causes memorization; mix in 2-5% pre-training data

### RLHF (PPO)

- **When to use**: You have 20K+ comparison pairs, need multi-objective alignment, or want iterative online learning
- **Key hyperparameters**: KL coefficient (0.01-0.05), PPO clip ratio (0.1-0.3), learning rate (5e-6 to 3e-5)
- **Critical detail**: Reward model should be >= policy model size
- **Gotcha**: PPO is unstable; monitor KL divergence and reward curves continuously

### DPO

- **When to use**: You have preference pairs and want a simpler pipeline than RLHF
- **Key hyperparameter**: Beta (0.1-0.5; lower = more deviation from reference allowed)
- **Critical detail**: Reference model must be a frozen copy of the SFT checkpoint
- **Gotcha**: Very sensitive to beta; run a sweep over [0.05, 0.1, 0.2, 0.5]

### KTO

- **When to use**: You only have "good" or "bad" labels without pairwise comparisons
- **Key hyperparameter**: Beta (same as DPO), loss aversion multiplier (1.5x on bad responses)
- **Critical detail**: Needs roughly balanced good/bad examples (40-60% split)
- **Gotcha**: Without pairs, the gradient signal is weaker; may need more data than DPO

### ORPO

- **When to use**: You want to skip SFT entirely and go straight from base to aligned
- **Key hyperparameter**: Lambda (weight of the preference term vs SFT term)
- **Critical detail**: Needs both instruction labels AND preference pairs in one dataset
- **Gotcha**: Combined objective can be hard to balance; if SFT loss dominates, alignment is weak

### SimPO

- **When to use**: Memory-constrained setup where you can't hold a reference model
- **Key hyperparameter**: Beta, gamma (length normalization exponent)
- **Critical detail**: Length normalization prevents the model from favoring short responses
- **Gotcha**: Without a reference model anchor, the model can drift further; monitor carefully

## Pipeline Templates

### Template 1: Fast Prototype (1-2 days)

```
Base Model -> SFT (1 epoch, 10K examples) -> DPO (3 epochs, 5K pairs)
```

Compute: ~4 GPU-hours for 7B model on A100
Quality: Solid instruction following, basic preference alignment

### Template 2: Production Quality (1-2 weeks)

```
Base Model -> SFT (2 epochs, 50K examples) -> DPO (5 epochs, 20K pairs) -> Eval -> Iterate
```

Compute: ~40 GPU-hours for 7B, ~200 GPU-hours for 70B
Quality: Competitive with open-source RLHF models

### Template 3: State-of-the-Art (1-3 months)

```
Base Model -> SFT (2 epochs, 100K+ examples) -> RLHF (PPO, 50K+ pairs) -> DPO (targeted refinement) -> Eval -> Iterate
```

Compute: ~500+ GPU-hours for 70B
Quality: Approaching frontier model alignment

### Template 4: Minimal Data (1-2 days)

```
Base Model -> SFT (1 epoch, 5K examples) -> KTO (unpaired thumbs up/down from users)
```

Compute: ~2 GPU-hours for 7B
Quality: Better than SFT-only with minimal data collection overhead

## Evaluation Protocol

After alignment, evaluate across these dimensions:

1. **Preference win rate**: Compare aligned model vs SFT model on 200+ test prompts with human judges. Target: > 60% win rate.
2. **Benchmark retention**: MMLU, HumanEval, or domain-specific benchmarks. Should not drop > 5% from SFT baseline.
3. **MT-Bench or AlpacaEval**: Standard alignment quality benchmarks. Compare against published baselines.
4. **Safety evaluation**: Test against adversarial prompts, jailbreaks, and harmful request categories.
5. **Response diversity**: Measure entropy of responses across 100 prompts. Low entropy = mode collapse.

## Common Failure Modes

| Symptom | Cause | Method-Specific Fix |
|---------|-------|-------------------|
| Verbose, padded responses | Reward model / implicit reward favors length | DPO: increase beta. RLHF: add length penalty. SimPO: adjust gamma. |
| Model agrees with everything | Sycophancy from preference data bias | Add preference pairs where the correct response disagrees with the user |
| Refuses benign requests | Over-alignment on safety data | Reduce safety example proportion, add more benign-refusal pairs |
| Outputs are nearly identical to SFT | Beta too high (DPO/KTO) or KL coefficient too high (PPO) | Lower beta / KL coefficient; the model isn't learning |
| Training loss oscillates | Learning rate too high or insufficient data | Reduce lr by 2-3x; increase preference data |
