---
name: skill-frame-sampler-auditor
description: 审计视频流水线的帧采样器是否存在差一错误、短视频段处理和裁剪一致性问题
version: 1.0.0
phase: 4
lesson: 12
tags: [computer-vision, video, sampling, debugging]
---

# 帧采样器审计器

帧采样是视频流水线中最容易出问题的地方。这里的错误会传播到所有下游指标中。

## 使用时机

- 编写新的视频数据加载器。
- 复现论文数据时训练准确率低于报告值。
- 调试评估准确率在不同运行间不稳定的视频模型。

## 输入

- `sampler_code`：接收 (num_frames_total, T) 并返回 T 个索引的 Python 函数。
- `T`：目标片段长度。
- 可选测试用例：`num_frames_total` 的取值（如 `[3, T-1, T, T+1, 30, 300, 3000]`）。

## 检查项

### 1. 短视频段处理
传入 `num_frames_total < T`。每个返回的索引都必须在 `[0, num_frames_total - 1]` 范围内。标准的填充策略是用最后一帧重复填充剩余位置。

### 2. 边界索引
传入 `num_frames_total == T`。返回的索引应该正好是 `[0, 1, ..., T-1]`。

### 3. 均匀分布
传入 `num_frames_total == 10 * T`。返回的索引应单调递增且大致等间距。

### 4. 密集窗口边界
对于密集采样，传入 `num_frames_total == 3 * T`。返回的索引应形成连续窗口，绝不超出片段末尾。

### 5. 确定性
用相同的输入（对于确定性采样器）和相同的随机数生成器两次调用采样器。索引应匹配。

### 6. 裁剪一致性
如果流水线还返回每帧的空间裁剪，用相同种子对同一片段运行两次采样器，确认每帧使用相同的裁剪框（相同 `(x, y, w, h)`）。同一片段内每帧不同的裁剪会破坏时间一致性，这是一个经典的静默错误。可接受的变体：每个 *片段* 做数据增强，在片段内保持一致。

## 报告

```
[sampler audit]
  name: <函数名>
  T:    <整数>

[short-clip handling]
  passed | failed（<详情>）

[boundary]
  passed | failed

[uniform spacing]
  passed | failed（<间隙标准差>）

[dense window]
  passed | failed（<详情>）

[determinism]
  passed | failed

[crop consistency]
  passed | failed（<每帧裁剪是否变化：yes/no>）

[verdict]
  ok | fix required
```

## 规则

- 如果短视频段处理返回了超出范围的索引，绝不要将采样器标记为 "ok"。
- 密集采样器不应返回跨越 `num_frames_total - 1` 的窗口。
- 如果采样器是随机的（密集采样），仅在使用显式种子 RNG 时测试确定性。
- 建议但不静默修复标准策略：用最后一帧填充、将窗口限制在末尾、四舍五入半开区间。
