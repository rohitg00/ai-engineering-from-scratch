---
name: lm-eval-harness
description: 最小语言模型评估框架，支持 JSONL 任务规范、五个指标、可交换适配器和排行榜 JSON 输出。
version: 1.0.0
phase: 19
lesson: 49
tags: [evaluation, metrics, leaderboard, harness]
---

## 何时使用

比较两个模型、两个检查点或两个提示模板在一组固定任务上的表现。任何你发布并需要随时间监控的东西。

## 任务规范

每个示例一行 JSONL：

```json
{"id": "ex-001", "prompt": "...", "targets": ["..."], "metric": "exact_match", "extras": {}}
```

文件中所有示例共享一个指标。文件名就是任务名。

## 指标

| 指标 | 签名 | 用途 |
|--------|-----------|---------|
| exact_match | 标准化为小写 + 空白，相等性 | 算术、事实性答案 |
| substring_contains | 目标必须出现在标准化预测中 | 带有锚定词的自由形式生成 |
| multiple_choice | 首字母匹配 | A/B/C/D 类型问题 |
| rouge_l | 分词文本上的 LCS F1 | 摘要、释义 |
| code_exec | 在 io_pairs 上运行预测的 `f`，计数匹配 | 代码生成 |

所有指标返回 [0.0, 1.0] 范围内的浮点数。任务分数为均值。

## 适配器

```python
class Adapter(Protocol):
    name: str
    def generate(self, prompts: list[str]) -> list[str]: ...
```

适配器是唯一特定于模型的代码。

## 排行榜 JSON

模式字符串、时间戳、每个任务的分数和延迟、总体均值。比较运行时的逐示例记录，使预测级回归可见。

## 故障模式

- 指标返回超出 [0, 1]：总体分数变得不可解释。
- 一个任务文件中混合指标：断言触发；每个文件保持一个指标。
- 没有受限命名空间的 code_exec：任意代码执行。
- 没有模式字符串：格式演变破坏下游仪表板。
