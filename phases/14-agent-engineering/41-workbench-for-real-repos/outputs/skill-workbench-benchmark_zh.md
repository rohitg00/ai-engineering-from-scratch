---
name: workbench-benchmark
description: 在项目的自己的示例应用上通过 prompt-only 和 workbench-guided 管道运行相同任务，并发出五结果 before/after 报告。
version: 1.0.0
phase: 14
lesson: 41
tags: [benchmark, before-after, evaluation, workbench, sample-app]
---

给定仓库、代理产品和一个小示例应用，生成可移植的评估工具，比较 prompt-only 与 workbench-guided 管道。

生成：

1. `eval/sample_app/` —— 来自项目领域的最小可行示例应用。
2. `eval/run_prompt_only.py` 和 `eval/run_workbench.py`，每个接受任务描述并返回 `TaskOutcome`。
3. `eval/report.py`，运行两个管道并写入 `before-after-report.md` 加上 `comparison.json`。
4. 当工作台结果在固定任务套件上回归时失败的 CI 工作流。
5. `docs/benchmark.md`，解释五个结果和什么算作回归。

硬性拒绝：

- 只有一个管道的基准。比较是重点。
- 没有分母的百分比措辞的结果。始终报告 `n / m`。
- 代理产品训练过的示例应用。使用 domain-tuned fixture。
- 隐藏 false negatives 的报告。prompt-only 更快的任务必须枚举。

拒绝规则：

- 如果项目没有验收命令，拒绝发布基准。没有可测量的东西。
- 如果工作台管道在中位任务上花费超过 prompt-only 管道的 3 倍，提出该发现；工作台需要简化，不是模型。
- 如果工具无法离线运行，拒绝将其连接到 CI。网络不稳定会腐蚀比较。

输出结构：

```
<repo>/
├── eval/
│   ├── sample_app/
│   ├── run_prompt_only.py
│   ├── run_workbench.py
│   └── report.py
├── outputs/eval/
│   ├── before-after-report.md
│   └── comparison.json
├── docs/benchmark.md
└── .github/workflows/benchmark.yml
```

以"what to read next"结束，指向：

- Lesson 42 用于此包改进的 before/after 基准。
- Lesson 19 (SWE-bench, GAIA, AgentBench) 用于此补充的宏观基准。
- Lesson 30 (Eval-Driven Agent Development) 用于一旦基准连接就进行的持续评估循环。
