---
name: skill-prompt-injection-detector
description: 分层检测器管道，对任何提示返回类别和置信度，具有可测量的精确率和召回率
version: 1.0.0
phase: 19
lesson: 83
tags: [safety, detector, prompt-injection]
---

# 提示注入检测器

此处的检测器是一个从提示到判决的函数。判决带有课程 82 分类法中的一个类别和 [0, 1] 范围内的置信度。

## 管道

1. 规范化 - 去除零宽字符、还原同形字、解码 base64/hex、折叠 leet 数字、尝试 rot13 并附带常见词合理性检查。
2. 子串规则 - 手写的匹配模式，如 `ignore previous`、`from now on you are`、`decode this base64`。
3. 正则规则 - 令牌级模式，如 `\bignor\w*\s+(all|prior|previous|earlier)\b`。

聚合保留每个类别的最大分数，并返回分数最大的类别，如果没有任何触发则返回 `benign`。

## 添加规则

编辑 `code/rules.py`。规则是一个字典，包含 `name`、`category`（六个分类类别之一）、`score`（浮点数 0 到 1），以及 `substring` 或 `regex` 之一。重新运行 `main.py` 以查看对每类别精确率和召回率的影响。

## 产物

`outputs/detector_report.json` 是每类别指标文件。课程 87 中的端到端门读取它以设置置信度阈值。
