---
name: skill-residual-block-reviewer
description: 审查 PyTorch 残差块的跳跃连接正确性、BN 放置位置、激活顺序和形状对齐
version: 1.0.0
phase: 4
lesson: 3
tags: [computer-vision, resnet, code-review, pytorch]
---

# 残差模块审查器（Residual Block Reviewer）

一个专注于审查任何声称实现残差块的 PyTorch `nn.Module` 的审查器。捕获几乎所有破坏 ResNet 重写的四个常见错误。

## 何时使用

- 有人编写了自定义 BasicBlock 或 Bottleneck，损失为 NaN 或准确率停滞。
- 将一个模块从一个框架移植到另一个框架，希望验证等价性。
- 审查更改 ResNet 内部实现的 PR（预激活、squeeze-excite、抗锯齿）。
- 模型在 CIFAR 尺寸输入上运行正常，但在 ImageNet 分辨率上因跳跃连接错误而崩溃。

## 输入

- 一个 PyTorch 类定义，可以是源码文本或可导入路径。
- 可选 `variant`：`basic` | `bottleneck` | `preact` | `seblock`。

## 四项检查

### 1. 跳跃连接形状对齐

对于任何 `stride != 1` 或 `in_channels != out_channels` 的模块，跳跃连接路径**必须**是一个形状匹配的模块——通常是 1x1 卷积加 BN。在此情况下使用裸的 `nn.Identity()` 将保证在前向传播时出现形状不匹配错误。

诊断：
```
[shortcut]
  detected:  nn.Identity | 1x1 Conv + BN | 1x1 Conv + BN + ReLU | other
  required:  shape-matching Conv if (stride != 1 or in_c != out_c) else Identity
  verdict:   ok | wrong | unnecessarily heavy
```

### 2. BN 相对于加法操作的位置

加法操作 `out + shortcut(x)` 必须发生在**最终 ReLU 之前**（后激活，原始 ResNet），或者最终 ReLU 必须完全不存在（预激活 ResNet v2）。在主分支中应用 ReLU 然后添加原始跳跃连接的模块会产生不对称的激活范围，损害训练。

诊断：
```
[activation order]
  pattern:  post-act (conv-BN-ReLU-conv-BN-add-ReLU) | pre-act (BN-ReLU-conv-BN-ReLU-conv-add) | other
  verdict:  ok | suspect
```

### 3. 卷积层的偏置

紧接 BatchNorm 的卷积层应将 `bias=False`。BN 的 beta 已经参数化了偏置，因此额外的卷积偏置浪费参数并可能减慢收敛速度。

诊断：
```
[bias]
  convs with BN and bias=True: <计数>
  recommended fix: set bias=False on those layers
```

### 4. 原地 ReLU 与自动求导

在将要与跳跃连接相加的张量上使用 `nn.ReLU(inplace=True)` 会覆盖可能仍为残差加法所需的数值。标记任何在加法操作之前没有产生新张量的层之后的 `inplace=True`。

诊断：
```
[in-place]
  risky inplace ops: <列表>
  fix: inplace=False before the residual add
```

## 报告

```
[block-review]
  variant:       basic | bottleneck | preact | se | other
  shortcut:      ok | wrong | heavy
  activation:    ok | suspect
  bias-bn:       ok | <N> 个卷积需要 bias=False
  in-place:      ok | <N> 个风险操作
  summary:       一句话
```

## 规则

- 不要重写模块。仅报告。
- 如果模块正确，全部返回 `ok` 并停止。不提供建议。
- 如果存在多个问题，按上述顺序列出（跳跃连接优先，因为它是导致崩溃的最常见原因）。
- 当用户已明确指定时，不要将有意的预激活或 squeeze-excite 变体标记为错误。
