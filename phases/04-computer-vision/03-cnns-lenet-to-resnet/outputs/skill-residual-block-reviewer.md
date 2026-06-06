---
name: skill-residual-block-reviewer
description: Review a PyTorch residual block for skip-connection correctness, BN placement, activation order, and shape alignment
version: 1.0.0
phase: 4
lesson: 3
tags: [computer-vision, resnet, code-review, pytorch]
---

# Residual Block Reviewer

A focused reviewer for any PyTorch `nn.Module` claiming to implement a residual block. Catches the four mistakes that account for almost every broken ResNet rewrite.

## When to use

- Someone wrote a custom BasicBlock or Bottleneck and loss is NaN or accuracy is stuck.
- You are porting a block from one framework to another and want to verify equivalence.
- You are reviewing a PR that changes ResNet internals (pre-activation, squeeze-excite, anti-alias).
- A model ships fine on CIFAR-sized input but crashes on ImageNet resolution because the shortcut is wrong.

## Inputs

- A PyTorch class definition, either as source text or an importable path.
- Optional `variant`: `basic` | `bottleneck` | `preact` | `seblock`.

## Four checks

### 1. Shortcut shape alignment

For any block with `stride != 1` or `in_channels != out_channels`, the shortcut path **must** be a shape-matching module — typically a 1x1 conv plus BN. A bare `nn.Identity()` in this case is a guaranteed shape-mismatch error at forward time.

Diagnostic:
```
[shortcut]
  detected:  nn.Identity | 1x1 Conv + BN | 1x1 Conv + BN + ReLU | other
  required:  shape-matching Conv if (stride != 1 or in_c != out_c) else Identity
  verdict:   ok | wrong | unnecessarily heavy
```

### 2. BN placement relative to the addition

The addition `out + shortcut(x)` must happen **before** the final ReLU (post-activation, original ResNet) or the final ReLU must be absent entirely (pre-activation ResNet v2). A block that applies ReLU in the main branch and then adds a raw shortcut produces an asymmetric activation range that hurts training.

Diagnostic:
```
[activation order]
  pattern:  post-act (conv-BN-ReLU-conv-BN-add-ReLU) | pre-act (BN-ReLU-conv-BN-ReLU-conv-add) | other
  verdict:  ok | suspect
```

### 3. Bias on conv layers

Convs followed immediately by BatchNorm should have `bias=False`. BN's beta already parameterises the bias, so an extra conv bias wastes parameters and can slow convergence.

Diagnostic:
```
[bias]
  convs with BN and bias=True: <count>
  recommended fix: set bias=False on those layers
```

### 4. In-place ReLU and autograd

`nn.ReLU(inplace=True)` on the tensor that will be added to the shortcut overwrites values that may still be needed for the residual add. Flag any `inplace=True` that is not followed by a layer that produces a new tensor before the add.

Diagnostic:
```
[in-place]
  risky inplace ops: <list>
  fix: inplace=False before the residual add
```

## Report

```
[block-review]
  variant:       basic | bottleneck | preact | se | other
  shortcut:      ok | wrong | heavy
  activation:    ok | suspect
  bias-bn:       ok | <N> convs need bias=False
  in-place:      ok | <N> risky ops
  summary:       one sentence
```

## Rules

- Do not rewrite the block. Report only.
- If the block is correct, say `ok` everywhere and stop. No suggestions.
- If multiple things are wrong, list them in the order above (shortcut first because it is the most common cause of crashes).
- Never flag a deliberate pre-activation or squeeze-excite variant as wrong when the user has specified it.
