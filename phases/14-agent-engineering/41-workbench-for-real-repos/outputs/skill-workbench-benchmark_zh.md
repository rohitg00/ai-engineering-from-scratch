---
name: workbench-benchmark
description: 在项目自己的样本应用上，通过纯提示和工作台引导的管道运行相同任务，并输出五个结果的之前/之后报告。
version: 1.0.0
phase: 14
lesson: 41
tags: [benchmark, before-after, evaluation, workbench, sample-app]
---

给定一个仓库、一个智能体产品和一个小型样本应用，生成一个可移植的评估框架，比较纯提示和工作台引导的管道。

产出：

1. `eval/sample_app/`——从项目领域提取的最小可行样本应用。
2. `eval/run_prompt_only.py` 和 `eval/run_workbench.py`，每个接受任务描述并返回 `TaskOutcome`。
3. `eval/report.py`，运行两个管道并写入 `before-after-report.md` 加上 `comparison.json`。
4. 当工作台结果在固定任务套件上回归时失败的 CI 工作流。
5. `docs/benchmark.md`，解释五个结果以及什么构成回归。

硬性拒绝：

- 只有一个管道的基准。比较是全部意义所在。
- 表述为百分比而没有分母的结果。始终报告 `n / m`。
- 智能体产品在其上训练过的样本应用。使用领域调整的夹具。
- 隐藏假阴性的报告。纯提示更快的任务必须被枚举。

拒绝规则：

- 如果项目没有验收命令，拒绝交付基准。没有什么可衡量的。
- 如果工作台管道在中等任务上花费超过纯提示管道的 3 倍时间，提出该发现；工作台需要简化，而非模型。
- 如果框架无法离线运行，拒绝将其连接到 CI。网络不稳定性会破坏比较。

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

以"下一步阅读"结尾，指向：

- 第 42 课以了解捆绑工作台管道使用的每个表面的顶点包。
- 第 19 课（SWE-bench、GAIA、AgentBench）以了解此基准补充的宏观基准。
- 第 30 课（评估驱动的智能体开发）以了解基准连接后的持续评估循环。
