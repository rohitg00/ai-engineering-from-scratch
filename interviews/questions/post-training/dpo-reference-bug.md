---
id: dpo-reference-bug
title: A DPO trainer whose loss never moves
card: post-training
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, debugging]
tags: [dpo, reference-model, code-reading, gradient-sign]
minutes: 12
lessons: [phases/19-capstone-projects/40-dpo-from-scratch, phases/10-llms-from-scratch/08-dpo]
manuals: []
practice: [dpo-loss]
cheatsheet: [rlhf-dpo]
related: [post-training/dpo-implicit-reward]
updated: 2026-11-03
---

A teammate wrote the core of a DPO trainer. The loss stays at its starting value for the whole run, and the logged margin never moves. Read the code and find what is wrong.

```python
policy = TinyGPT(config)
reference = policy


def sequence_log_prob(model, prompt_ids, completion_ids):
    ids = torch.cat([prompt_ids, completion_ids])
    logits = model(ids[:-1].unsqueeze(0))[0]
    log_probs = logits.log_softmax(-1)
    targets = ids[1:]
    return log_probs[torch.arange(len(targets)), targets].sum()


def dpo_loss(prompt, chosen, rejected, beta=0.1):
    pi_w = sequence_log_prob(policy, prompt, chosen)
    pi_l = sequence_log_prob(policy, prompt, rejected)
    ref_w = sequence_log_prob(reference, prompt, chosen)
    ref_l = sequence_log_prob(reference, prompt, rejected)
    z = beta * ((pi_l - ref_l) - (pi_w - ref_w))
    return -torch.nn.functional.logsigmoid(z)
```

## Short answer

Three things. The reference is the same object as the policy, so both log ratios are zero by construction and the loss is a constant with no gradient; build the reference as a separate copy, freeze it, and run it under no gradient. The margin has the wrong sign, so once the aliasing is fixed the trainer promotes the rejected answer. The log-probability also sums over the prompt positions, which the capstone masks out.

## Full answer

### Bug 1: the reference is the policy

`reference = policy` binds a second name to one module. Every forward pass through `reference` uses the current policy weights, so `pi_w - ref_w` and `pi_l - ref_l` are exactly zero, and the loss is a constant. The optimizer sees a zero gradient. A deep copy alone is not enough either: the reference needs `requires_grad=False` on every parameter, its forward passes belong under `torch.no_grad()`, and the policy must start from the same weights, for example with `policy.load_state_dict(reference.state_dict())`.

### Bug 2: the margin has the wrong sign

The loss is minus the log sigmoid of beta times the chosen log ratio minus the rejected log ratio. The code subtracts in the other order. The gradient with respect to the chosen log-probability must be negative, so that raising it lowers the loss. With the reversed sign, the trainer lowers the chosen answer and raises the rejected one. A unit test that checks the gradient sign on one pair catches this.

### Observation 3: the prompt is in the sum

`sequence_log_prob` sums over every position, the prompt included. With one shared prompt, the prompt terms cancel in the margin, so the value is right. But the trainer computes and backpropagates through positions that carry no preference signal, and the cancellation breaks when a long sequence is cut at a maximum length. Start the sum at the first answer position, as the capstone does.

### How to test the fix

- The loss on one pair falls when you raise the chosen log-probability by hand.
- The reference log-probabilities are identical between epochs.
- The mean chosen minus rejected margin under the policy grows over training.

## Follow-ups

- **Level 2:** After the fix, how do you confirm that the reference never moves? Expected: assert that no reference parameter requires a gradient, and compare its log-probabilities on a fixed pair before and after an epoch.
- **Level 3:** Why does every pair start at the same loss before training? Expected: the policy equals the reference, so both log ratios are zero and the sigmoid sits at one half; the margin grows from there.
- **Level 3:** The margin grows, but the generated answers get worse. What do you log next? Expected: the absolute chosen log-probability; DPO can push it down as long as the rejected falls faster.
- **Level 4:** Would you keep the prompt positions if the two answers had different prompts? Expected: no, and the loss would be wrong anyway; the derivation needs one prompt per pair, because the partition term cancels only then.

## Wrong answers

- "Lower the learning rate; the loss is flat because the steps are too small." The gradient is exactly zero while the reference aliases the policy; no step size fixes that.
- "The sign does not matter, the optimizer finds the direction." The sign decides which answer the trainer promotes; reversed, it trains the model to prefer the rejected answers.
- "Replace the sum with a mean to stabilize the loss." That turns the objective into a length-normalized variant; it is a design choice, not the fix for a constant loss.

## Taught in

The [DPO capstone](../../../phases/19-capstone-projects/40-dpo-from-scratch/) pins the reference invariance and the gradient sign with tests, and the [DPO lesson](../../../phases/10-llms-from-scratch/08-dpo/) computes the four log-probabilities for each pair.
