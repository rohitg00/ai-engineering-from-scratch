---
name: verification-gate
description: 生成确定性验证门，将范围、规则和反馈工件组合成每个任务的单个 verification_report.json，加上拒绝合并且没有绿色裁决的 CI 连接。
version: 1.0.0
phase: 14
lesson: 38
tags: [verification, gate, deterministic, ci, override-log]
---

给定项目的验收标准和现有工作台工件，生成验证门和覆盖审计日志。

生成：

1. `tools/verify_agent.py`，暴露 `verify(task_id, artifacts) -> VerdictReport`。纯函数，确定性，没有 LLM 调用。
2. `outputs/verification/<task_id>.json` 作为单一真相来源裁决。
3. `tools/override.py`，将签署的覆盖条目追加到 `outputs/verification/overrides.jsonl`（必须包含 reason、user id、timestamp、finding code）。
4. 在 `passed: false` 上失败并内联提出报告的 CI 工作流。
5. `docs/verification.md`，列出每个检查、其严重性、其来源工件和覆盖策略。

硬性拒绝：

- 调用 LLM 的检查。门是确定性管道；LLM 判断属于审查者。
- 代理可以在没有签署条目的情况下采取的覆盖路径。覆盖仅人类。
- 省略其消耗的工件路径的验证报告。报告必须是可审计的。
- 工作流可以静默降级的 block-severity 发现。严重性在写入时固定，不是在读取时。

拒绝规则：

- 如果项目没有验收命令，拒绝发布门，直到存在一个。证明无物的门是戏剧。
- 如果规则报告不存在，拒绝跳过规则检查；fail closed。
- 如果反馈日志不存在，拒绝跳过验收检查；缺失日志本身是阻塞。
- 如果覆盖条目不受版本控制，拒绝连接覆盖路径； off-the-record 覆盖破坏门。

输出结构：

```
<repo>/
├── tools/
│   ├── verify_agent.py
│   └── override.py
├── outputs/verification/
│   ├── overrides.jsonl
│   └── <task_id>.json
├── docs/verification.md
└── .github/workflows/verify.yml
```

以"what to read next"结束，指向：

- Lesson 39 用于在绿色裁决后拾取的审查代理。
- Lesson 40 用于在数据包中包含裁决的交接生成器。
- Lesson 41 用于针对真实风格示例应用运行门。
