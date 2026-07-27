---
name: skill-freeze-inspector
description: 报告哪些参数是可训练的、哪些 BatchNorm 层处于评估模式，以及优化器是否实际消耗了可训练参数
version: 1.0.0
phase: 4
lesson: 5
tags: [computer-vision, transfer-learning, debugging, pytorch]
---

# 冻结检查器（Freeze Inspector）

迁移学习中的错误隐藏在三个地方：应该冻结但实际未冻结的参数、应该可训练但实际不可训练的参数，以及在冻结状态改变之前构建的优化器。本技能在一次遍历中揭示所有这三种情况。

## 何时使用

- 在设置部分参数的 `requires_grad` 之后立即使用。
- 在微调运行的第一个训练步骤之前。
- 在调用 `freeze_bn_stats` 或任何切换 BN 模式的辅助函数之后。
- 当验证准确率卡在随机水平且怀疑没有参数真正在训练时。

## 输入

- `model`：一个 PyTorch `nn.Module`。
- `optimizer`：即将用于训练的优化器。
- 可选 `expected_frozen_prefixes`：应该被冻结的参数名前缀列表（例如 `["conv1", "bn1", "layer1"]`）。

## 步骤

1. **遍历参数。** 对于每个 `(name, param)`：
   - 记录 `requires_grad`
   - 记录 `shape` 和 `numel`

2. **遍历模块。** 对于每个模块：
   - 如果是 BatchNorm，记录它是否处于评估模式以及其仿射参数是否可训练。

3. **检查优化器。** 对于每个参数组：
   - 将其 `params` 展平为一组 `id(p)`。
   - 与 `requires_grad == True` 的参数的所有 `id(p)` 集合进行比较。

4. **检测四种失败模式：**
   - `leaked_train`（泄漏训练）：参数 `requires_grad=True` 但未出现在优化器中（梯度被计算但从未应用）。
   - `ghost_train`（幽灵训练）：参数出现在优化器中但 `requires_grad=False`（优化器状态被浪费；如果以后重新启用 requires_grad 也可能导致错误）。
   - `bn_mismatch`（BN 不匹配）：(a) BN 层处于训练模式（累积运行统计量）而其仿射参数（`weight`、`bias`）被冻结，或 (b) BN 层处于评估模式（冻结统计量）而其仿射参数可训练。两种状态都不一致，几乎总是错误。
   - `expected_vs_actual`（期望 vs 实际）：任何在 `expected_frozen_prefixes` 中列出的前缀仍然有可训练的参数。

## 报告

```
[freeze-inspector]
  model trainable params: <N>
  model frozen params:    <N>
  batchnorm layers in eval mode: <计数>
  batchnorm layers in train mode: <计数>

[optimizer coverage]
  trainable params fed to optimizer: <M> of <N>
  leaked_train: <名称列表>（可训练但不在优化器中）
  ghost_train:  <名称列表>（在优化器中但已冻结）

[bn audit]
  mismatched layers: <名称列表>

[expectations]
  expected_frozen_prefixes: <...>
  violating params:         <列表>

[verdict]
  ok | <最严重问题的一行摘要>
```

## 规则

- 仅报告参数名称；绝不打印权重本身。
- 按参数名称字母顺序排序每个列表。
- 如果优化器覆盖率为 100% 且无不匹配，返回 `ok` 并停止。
- 对于 `leaked_train`，始终建议在冻结状态改变后重建优化器。
- 对于 `ghost_train`，建议删除参数组或将 `requires_grad=True`（如果意图是训练它）。
