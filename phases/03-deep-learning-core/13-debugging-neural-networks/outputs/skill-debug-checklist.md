---
name: skill-debug-checklist
description: Decision-tree checklist for debugging neural network training failures
version: 1.0.0
phase: 3
lesson: 13
tags: [debugging, neural-networks, training, diagnostics, deep-learning]
---

# Neural Network Debug Checklist

Systematic debugging protocol for when training goes wrong. Work through these in order -- most bugs are caught in the first 3 steps.

## Before training (prevent bugs)

1. Print model architecture and parameter count. Does the size make sense for your data?
2. Run a single forward pass with random input. Does the output shape match your target shape?
3. Check that labels are the correct dtype (CrossEntropyLoss needs Long, BCELoss needs Float)
4. Verify data normalization: inputs should have mean near 0 and std near 1
5. Print 5 random (input, label) pairs. Do the labels match what you expect?
6. Confirm train/test split has no duplicate samples

## Overfit-one-batch test (60 seconds, catches 80% of bugs)

1. Take 8-32 samples from your training set
2. Train for 200 steps with a reasonable learning rate
3. Loss should approach 0. Training accuracy should hit 100%
4. If it fails: the bug is in your model, loss function, or training loop -- not your data or hyperparameters
5. If it passes: proceed to full training

## Loss not decreasing

1. Check learning rate. Try 3 values: current/10, current, current*10
2. Print gradient norms per layer. All zeros means dead network or detached graph
3. Check `requires_grad=True` on parameters. Check that `loss.backward()` is called
4. Check that `optimizer.zero_grad()` is called before `loss.backward()`
5. Check that `optimizer.step()` is called after `loss.backward()`
6. Verify model parameters are passed to the optimizer: `optimizer = Adam(model.parameters())`

## Loss is NaN or Inf

1. Reduce learning rate by 10x
2. Add epsilon to all log() calls: `torch.log(x + 1e-7)`
3. Add epsilon to all division: `x / (y + 1e-8)`
4. Clamp predictions: `torch.clamp(pred, 1e-7, 1 - 1e-7)` before BCE loss
5. Use `torch.autograd.detect_anomaly()` to find the exact operation
6. Check for NaN in input data: `assert not torch.isnan(x).any()`

## Loss oscillating

1. Reduce learning rate by 3-10x
2. Increase batch size (reduces gradient noise)
3. Add gradient clipping: `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)`
4. Switch from SGD to Adam (adaptive LR per parameter)
5. Add learning rate warmup for the first 5-10% of training

## Overfitting (train acc high, test acc low)

1. Add dropout (start with p=0.1, increase to 0.5)
2. Add weight decay to optimizer: `Adam(params, weight_decay=1e-4)`
3. Reduce model size (fewer layers or narrower layers)
4. Add data augmentation
5. Use early stopping: stop when validation loss increases for 5+ epochs
6. Check for data leakage between train and test sets

## Underfitting (both train and test acc low)

1. Increase model capacity (more layers, wider layers)
2. Train for more epochs
3. Increase learning rate (carefully)
4. Remove regularization temporarily to verify the model can learn
5. Check that your model is expressive enough for the task

## Dead ReLU neurons

1. Check fraction of zero activations per layer. >50% is a problem
2. Switch to LeakyReLU(0.01) or GELU
3. Use Kaiming initialization for weights
4. Reduce learning rate (large updates can push neurons into the dead zone)
5. Add batch normalization before activation functions

## Quick reference: learning rate starting points

| Optimizer | Task | Starting LR |
|-----------|------|------------|
| Adam | Training from scratch | 1e-3 |
| Adam | Fine-tuning pretrained | 1e-5 |
| SGD + momentum | Training from scratch | 1e-1 |
| SGD + momentum | Fine-tuning pretrained | 1e-3 |
| AdamW | Transformer training | 3e-4 |

## Quick reference: batch size effects

| Batch size | Gradient noise | Memory | Generalization |
|-----------|---------------|--------|---------------|
| 8-16 | High (noisy) | Low | Often better |
| 32-64 | Moderate | Moderate | Good default |
| 128-256 | Low (smooth) | High | May need warmup |
| 512+ | Very low | Very high | Needs LR scaling |

## When nothing works

1. Simplify the model to 1 hidden layer. Does it learn?
2. Simplify the data to 100 samples. Does it overfit?
3. Replace your loss with MSE. Does it converge?
4. Replace your optimizer with SGD(lr=0.01). Does it make progress?
5. Replace your data with synthetic data (e.g., y = x[0] > 0). Does it learn?
6. If none of these work: the bug is in code you are not looking at (data loading, preprocessing, tensor shapes)
