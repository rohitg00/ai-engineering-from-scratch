---
name: skill-classification-diagnostics
description: 给定混淆矩阵和类别名称，揭示每个类别的失败原因并提出最具影响力的单一修复方案
version: 1.0.0
phase: 4
lesson: 4
tags: [computer-vision, classification, evaluation, debugging]
---

# 分类诊断（Classification Diagnostics）

一种阅读混淆矩阵的透镜。聚合准确率告诉你分类器有效。混淆矩阵告诉你它*还不知道什么*。

## 何时使用

- 初次查看训练好的分类器的验证性能。
- 在训练运行之间决定下一步要改变什么。
- 在发布模型之前：验证没有关键类别在静默地失败。
- 调试生产中的回归问题：整体准确率下降了一个百分点，需要找出原因。

## 输入

- `cm`：C x C 混淆矩阵（行 = 真实值，列 = 预测值）。
- `labels`：C 个类别名称的列表，顺序相同。
- 可选 `class_priors`：每个类别的训练频率（默认为 `cm` 的行和）。

## 步骤

1. **计算每个类别的指标。** 将任何除以零的情况视为该指标对该类别未定义，报告为 `n/a`；不要静默地替换为 0。
   - precision_i = cm[i,i] / sum(cm[:, i])   （当该类别从未被预测时未定义）
   - recall_i    = cm[i,i] / sum(cm[i, :])   （当该类别没有真实样本时未定义）
   - f1_i        = 2 * p * r / (p + r)        （当任一组成部分未定义时未定义）

2. **按 F1 排序，找出最多三个最差类别。** 如果混淆矩阵少于三个类别，则对存在的全部类别进行排序。排除所有指标都未定义的类别。

3. **找出每行中最大的非对角线单元** —— 最常从该类别"抢走"预测的那个类别。报告为 `true -> predicted`。

4. **对每个最差类别的失败模式进行分类。** 使用以下量化阈值以确保标签可复现：
   - `ambiguity`（模糊性）—— 与另一个类别的双向混淆：`cm[i,j] / sum(cm[i, :]) >= 0.15` 且 `cm[j,i] / sum(cm[j, :]) >= 0.15`。
   - `imbalance`（不平衡）—— 该类别的训练样本数 < 其最大混淆对象的 `0.5x`。
   - `label_noise`（标签噪声）—— `|precision_i - recall_i| >= 0.2` 且该类别不属于不平衡或模糊路径。
   - `systematic`（系统性）—— 没有一个单一混淆对象超过该类错误份额的 0.2；错误分布在三个或更多其他类别中。

5. **推荐最具影响力的单一后续操作：**
   - `ambiguity` -> 收集或合成区分性样本，添加保留区分特征的目标增强。
   - `imbalance` -> 对少数类别进行过采样或应用类别加权损失。
   - `label_noise` -> 审查该类别的分层样本；在任何其他更改之前修正错误标签。
   - `systematic` -> 增加该类别的数据或使用更高的权重微调该类别的损失。

## 报告

```
[diagnostics]
  aggregate accuracy: X.XX
  macro F1:           X.XX

[top-3 worst classes]
  1. class <名称>  F1 = X.XX  prec = X.XX  rec = X.XX
     top confusion: <名称> -> <其他类别>  (N 个案例)
     failure mode:  ambiguity | imbalance | label_noise | systematic
     action:        <一句话>

  2. ...
  3. ...

[recommendation]
  single biggest lever: <一句话，指明类别和修复方案>
```

## 规则

- 最多返回三个类别。更多会掩盖信号。
- 为每个最差类别命名主要的混淆对象；绝不总结为"与许多类别混淆"。
- 每个建议都必须基于混淆矩阵的证据。不要笼统地说"添加更多数据"而不指明具体类别。
- 当精度和召回率差异超过 0.2 时，始终将标签噪声标记为候选——训练后，真实类别的 P 和 R 通常是对齐的。
