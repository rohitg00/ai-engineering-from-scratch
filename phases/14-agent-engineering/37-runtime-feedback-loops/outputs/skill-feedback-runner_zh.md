---
name: feedback-runner
description: 包装 shell 命令，带有确定性的 stdout/stderr/exit/duration 捕获，每个命令持久化 JSONL 记录，并在反馈缺失时拒绝推进代理循环。
version: 1.0.0
phase: 14
lesson: 37
tags: [feedback, subprocess, runner, jsonl, loop-control]
---

给定在代理循环内运行 shell 命令的项目，生成反馈运行器和它写入的 JSONL。

生成：

1. `tools/run_with_feedback.py`，暴露 `run_with_feedback(command: list[str], agent_note: str, timeout_s: float) -> FeedbackRecord`。
2. 工作台下方的 `feedback_record.jsonl` 位置，每行一个记录。
3. `tools/feedback_loader.py`，返回活动任务的最近 N 条记录。
4. 代理循环在声称成功之前调用的 `loop_can_advance(record) -> bool` 辅助器。
5. 测试覆盖：success path、non-zero exit、timeout、missing binary、deterministic head/tail truncation。

硬性拒绝：

- 运行器中任何地方的 `shell=True`。仅 Argv。
- 依赖 wall clock 或随机抽样的截断。相同输入必须产生相同记录。
- 没有 `duration_ms` 的记录。慢探测是工作台楔入的第一个迹象。
- 返回无界列表的加载器。限制在最后 N 或分页。

拒绝规则：

- 如果项目通过 stdout 管道传输秘密，拒绝在没有编校步骤的情况下发布运行器。提出将被捕获的行。
- 如果项目有可以无限期挂起的命令，拒绝在没有默认超时和显式覆盖列表的情况下发布。
- 如果运行器在具有共享状态的 worker 内运行，拒绝跳过 JSONL 追加周围的文件锁。多个写入器将撕裂文件。

输出结构：

```
<repo>/
├── feedback_record.jsonl
└── tools/
    ├── run_with_feedback.py
    ├── feedback_loader.py
    └── test_feedback_runner.py
```

以"what to read next"结束，指向：

- Lesson 38 用于消耗记录的验证门。
- Lesson 39 用于在评分运行时读取反馈的审查代理。
- Lesson 23 用于一旦反馈稳定就添加到遥测侧的 OTel GenAI 约定。
