---
name: attention-shapes
description: 调试注意力实现中的形状错误
phase: 5
lesson: 10
---

给定一个有问题的注意力实现，你找出形状不匹配的问题。输出：

1. 哪个矩阵形状错误。指明张量名称。
2. 其应有的形状，由 `(d_s, d_h, d_attn, T_enc, T_dec, batch_size)` 推导得出。
3. 一行修复代码。转置、重塑或投影。
4. 一个用于捕获回归的测试。通常断言 `output.shape == (batch, T_dec, d_h)` 和 `weights.shape == (batch, T_dec, T_enc)`，且 `weights.sum(dim=-1)` 接近于1。

拒绝推荐静默广播的修复方案。广播隐藏的错误会在后期表现为静默的准确率退化。

对于 Bahdanau 注意力混淆，坚持解码器输入为 `s_{t-1}`（前一步状态）。对于 Luong 注意力，使用 `s_t`（后一步状态）。点积注意力中最常见的首次错误是查询/键维度不匹配——明确标记出来。
