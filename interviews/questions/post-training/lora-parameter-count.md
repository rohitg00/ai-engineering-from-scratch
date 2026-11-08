---
id: lora-parameter-count
title: Count the parameters of one LoRA adapter
card: post-training
kind: estimate
level: 1
roles: [applied-ai-engineer, inference-engineer]
rounds: [screen, ml-depth]
tags: [lora, rank, parameter-count, adapters]
minutes: 6
lessons: [phases/11-llm-engineering/08-fine-tuning-lora]
manuals: []
practice: [lora-forward]
cheatsheet: [lora-fine-tuning]
related: [post-training/qlora-on-one-gpu]
updated: 2026-11-03
---

An attention projection in your model is a square matrix with 4,096 rows and 4,096 columns. You add a LoRA adapter of rank 16 to it. How many values does the adapter train, and what share of the frozen matrix is that? Then say what changes when you double the rank.

## Short answer

The adapter is two thin matrices: A with 16 rows and 4,096 columns, and B with 4,096 rows and 16 columns. Each holds 65,536 values, so the adapter trains 131,072 parameters. The frozen matrix holds 16,777,216, so the adapter is 0.78 percent of it. A doubled rank doubles the adapter, because its size is linear in the rank.

## Full answer

### The count

```text
y = W x + (alpha / r) B A x
A: r x d_in  = 16 x 4096 = 65,536
B: d_out x r = 4096 x 16 = 65,536
adapter      = 131,072
W            = 4096 x 4096 = 16,777,216
share        = 0.78 percent
```

### Why so few parameters work

The update that fine-tuning makes to a weight matrix has a low intrinsic rank. A rank of 16 or 32 captures most of it. The lesson reports LoRA at rank 16 within about one point of full fine-tuning on the benchmarks it lists.

### The rank table

| Rank | Parameters for one 4096 by 4096 matrix |
|---|---|
| 4 | 32,768 |
| 8 | 65,536 |
| 16 | 131,072 |
| 32 | 262,144 |
| 64 | 524,288 |

### Alpha

The scale `alpha / r` sets how much the adapter output counts. With alpha equal to the rank, the scale is one; a common convention sets alpha to twice the rank. Alpha changes the effective step size, not the parameter count.

### Which matrices

The count above is one matrix. Adapters on the query and value projections of every layer are the usual start. Adding the key and output projections and the MLP layers raises quality a little and, on the lesson's 7B table, raises the count from 9.4M to 37.7M.

## Follow-ups

- **Level 1:** Why does B start at zero? Expected: the product B A is then zero, so the model starts from its original behavior and learns the change step by step.
- **Level 2:** How does the count change for a matrix that is not square? Expected: A is r by the input width and B is the output height by r, so the count is r times the sum of the two sides; still linear in the rank.
- **Level 2:** At what rank does the memory advantage start to fade? Expected: the lesson puts the point of diminishing returns past 64, where quality stops improving and the adapters stop being small.
- **Level 3:** After training, how do you remove the cost of the second matrix product at inference? Expected: merge, compute W plus alpha over r times B A once, and save a full matrix of the original size.

## Wrong answers

- "The adapter trains r squared parameters." It trains r times the sum of the two matrix sides; r squared would be a tiny block, not the two thin matrices.
- "Doubling the rank doubles the quality." The gain flattens fast; the lesson finds rank 16 within about one point of full fine-tuning and little gain past 64.
- "Alpha adds parameters." Alpha is a fixed scalar on the adapter output; it changes the effective step size, not the count.

## Taught in

The [LoRA lesson](../../../phases/11-llm-engineering/08-fine-tuning-lora/) counts the adapter parameters and builds the layer in PyTorch.
