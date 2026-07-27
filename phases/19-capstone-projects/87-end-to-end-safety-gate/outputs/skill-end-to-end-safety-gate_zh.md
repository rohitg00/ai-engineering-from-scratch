---
name: skill-end-to-end-safety-gate
description: 三检查点安全门，组合输入检测器、流式令牌过滤器、输出分类器和规则引擎，带有确定性聚合表和每次请求的跟踪
version: 1.0.0
phase: 19
lesson: 87
tags: [safety, harness, composition]
---

# 端到端安全门

## 生命周期

1. 生成前 - 在提示上运行课程 83 检测器
   - 如果置信度 >= 拦截阈值：返回拒绝，发出跟踪，停止
2. 生成中 - 从模型流式传输，缓冲两个块，扫描已知有害续写
   - 如果匹配：终止迭代器，标记跟踪，视为中等严重性
3. 生成后 - 如果没有提前终止，对完成的输出运行课程 85 分类器路由器和课程 86 规则引擎
4. 聚合 - 取前、中、后.分类器、后.规则中的最高严重性
5. 应用 - 映射到拦截、编辑、警告或允许

## 聚合表

| 信号状态 | 操作 |
|---|---|
| 任何高严重性 | 拦截 |
| 任何中严重性 | 编辑 |
| 任何低严重性 | 警告 |
| 无信号 | 允许 |

## 跟踪结构

```text
RequestTrace
  request_id: str
  prompt: str
  pre_gen: { category, confidence, fired[] }
  during_gen: { terminated_early, matched_pattern, partial_chunks }
  post_gen: { classifier_action, classifier_severity, rules_max_severity, rules_violations[] } | null
  final_action: block | redact | warn | allow
  final_output: str
  latency_ms: float
```

## 产物

`outputs/gate_trace.json` 包含摘要和每个请求的跟踪记录，包括 50 个分类法固定数据和 10 个良性提示。
