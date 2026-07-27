---
name: feedback-runner
description: 包装 shell 命令，包含确定性的 stdout/stderr/退出码/持续时间捕获，将 JSONL 记录持久化到每个命令，并在反馈缺失时拒绝推进智能体循环。
version: 1.0.0
phase: 14
lesson: 37
tags: [feedback, subprocess, runner, jsonl, loop-control]
---

给定一个在智能体循环内运行 shell 命令的项目，生成一个反馈运行器和它写入的 JSONL。

产出：

1. `tools/run_with_feedback.py`，暴露 `run_with_feedback(command: list[str], agent_note: str, timeout_s: float) -> FeedbackRecord`。
2. 工作台下 `feedback_record.jsonl` 的位置，每行一条记录。
3. `tools/feedback_loader.py`，返回活动任务的最新 N 条记录。
4. 一个 `loop_can_advance(record) -> bool` 辅助函数，智能体循环在声称成功前调用。
5. 覆盖以下场景的测试：成功路径、非零退出、超时、缺少二进制文件、确定性头部/尾部截断。

硬性拒绝：

- 运行器中任何地方的 `shell=True`。仅限 Argv。
- 依赖挂钟或随机采样的截断。相同输入必须产生相同记录。
- 没有 `duration_ms` 的记录。慢速探测是工作台卡住的第一个迹象。
- 返回无界列表的加载器。限制在最后 N 条或分页。

拒绝规则：

- 如果项目通过 stdout 传输秘密，拒绝在没有编辑步骤的情况下交付运行器。提出本会被捕获的行。
- 如果项目有可以无限挂起的命令，拒绝在没有默认超时和显式覆盖列表的情况下交付。
- 如果运行器在具有共享状态的工作者内部运行，拒绝跳过 JSONL 追加周围的文件锁。多个写入者会撕裂文件。

输出结构：

```
<repo>/
├── feedback_record.jsonl
└── tools/
    ├── run_with_feedback.py
    ├── feedback_loader.py
    └── test_feedback_runner.py
```

以"下一步阅读"结尾，指向：

- 第 38 课以了解消费记录的验证门控。
- 第 39 课以了解在评分运行时读取反馈的审查智能体。
- 第 23 课以了解在反馈稳定后添加到遥测侧的 OTel GenAI 约定。
