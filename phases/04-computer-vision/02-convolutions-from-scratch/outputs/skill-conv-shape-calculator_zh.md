---
name: skill-conv-shape-calculator
description: 逐层遍历 CNN 规格，报告每个模块的输出形状、感受野和参数量
version: 1.0.0
phase: 4
lesson: 2
tags: [computer-vision, cnn, architecture, debugging]
---

# 卷积形状计算器（Conv Shape Calculator）

一个用于规划或调试 CNN 的确定性辅助工具。给定输入形状和层规格列表，在不运行模型的情况下追踪形状、感受野和参数量。

## 何时使用

- 设计新的 CNN，希望验证每次下采样都落在整齐的尺寸上。
- 阅读论文并将其架构表格转化为代码。
- 预训练骨干网络在分类头处因形状不匹配而崩溃，需要找出是哪一层改变了空间尺寸。
- 在训练之前比较两个骨干网络的参数效率。

## 输入

- `input_shape`：`(C, H, W)`。
- `layers`：有序的层字典列表。每个支持：
  - `{type: "conv", c_out, k, s, p, groups=1, bias=true}`
  - `{type: "pool", mode: "max"|"avg", k, s, p=0}`
  - `{type: "adaptive_pool", out_h, out_w}`
  - `{type: "flatten"}`
  - `{type: "linear", out_features, bias=true}`

## 步骤

1. **初始化追踪**，以 `(C, H, W)`、感受野 `1`、有效步长 `1`、累计参数 `0` 开始。

2. **对于每一层**，按顺序更新：
   - 计算 `C_out`（卷积/线性层）或沿用 `C_in`（池化层）。
   - 使用 `(H + 2P - K) / S + 1` 计算卷积和池化的空间输出；自适应池化使用 `out_h/out_w`；展平层在展平后（线性层之前）输出形状为 `(C * H * W, 1, 1)`；线性层输出标量 `1x1`。
   - 更新感受野和有效步长：
     - 卷积/池化：`RF_new = RF_old + (K - 1) * effective_stride`，`effective_stride *= S`。
     - 自适应池化：视为有效 `S = H_in / out_h`（向下取整）的池化。`RF_new = RF_old + (H_in - 1) * effective_stride_old`；`effective_stride *= S`。注意自适应池化的感受野等于之前全部空间范围。
     - 展平/线性层：感受野和有效步长不再有意义；冻结为展平前的值，并在后续行中省略。
   - 计算参数量：
     - 卷积：`C_out * (C_in / groups) * K * K + (C_out if bias else 0)`。
     - 线性层：`out_features * in_features + (out_features if bias else 0)`。
     - 池化和展平：0。

3. **检测问题**并标记：
   - 非整数输出尺寸（步长/填充未对齐）。
   - 在堆叠结束前出现 `H_out <= 0`。
   - 感受野超过输入尺寸（可能导致之后的计算浪费）。
   - 每层参数量突然增加 10 倍，表明通道规划可能错误。

4. **报告**为单一表格：

```
idx  layer                C_in  C_out  K  S  P  H_out  W_out  RF    params     cum_params
1    conv 3x3 s=1 p=1     3     32     3  1  1  224    224    3     896        896
2    conv 3x3 s=2 p=1     32    64     3  2  1  112    112    7     18,496     19,392
3    pool max 2x2         64    64     2  2  0  56     56     11    0          19,392
...
```

5. **摘要行**：最终 `(C, H, W)`、最终感受野、总参数、警告信息。

## 规则

- 空间尺寸始终返回整数。如果公式产生非整数，标记为错误，不要静默向下取整。
- 当 `groups > 1` 时，验证 `C_in % groups == 0` 和 `C_out % groups == 0`；否则报错。
- 对于深度可分离卷积（`groups == C_in`），在 `layer` 列中标注，以便读者了解参数为何较少。
- 如果用户提供了 BatchNorm 或激活层，忽略其形状影响但计入参数量（每个 BatchNorm 增加 `2 * C` 参数）。
- 绝不猜测缺失字段的默认值。要求每个卷积和池化层提供 `k`、`s`、`p`。
