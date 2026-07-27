---
name: verification-gate
description: 生成一个确定性的验证门控，将范围、规则和反馈产物组合成每个任务的单个 verification_report.json，加上拒绝在没有绿色裁决的情况下合并的 CI 连接。
version: 1.0.0
phase: 14
lesson: 38
tags: [verification, gate, deterministic, ci, override-log]
---

给定项目的验收标准和现有的工作台产物，生成验证门控和覆盖审计日志。

产出：

1. `tools/verify_agent.py`，暴露 `verify(task_id, artifacts) -> VerdictReport`。纯函数，确定性，无 LLM 调用。
2. `outputs/verification/<task_id>.json` 作为裁决的唯一真相来源。
3. `tools/override.py`，将签名的覆盖条目追加到 `outputs/verification/overrides.jsonl`（必须包含原因、用户 id、时间戳、发现代码）。
4. 在 `passed: false` 时失败并在行内展示报告的 CI 工作流。
5. `docs/verification.md`，列出每个检查、其严重性、其来源产物和覆盖策略。

硬性拒绝：

- 调用 LLM 的检查。门控是确定性的管道工作；LLM 判断属于审查者。
- 智能体可以在没有签名条目的情况下采取的覆盖路径。覆盖仅限人类。
- 省略其消费的产物路径的验证报告。报告必须是可审计的。
- 工作流可以静默降级的阻塞严重性发现。严重性在写入时固定，而非在读取时。

拒绝规则：

- 如果项目没有验收命令，拒绝交付门控，直到存在一个。证明不了什么的门控是剧场。
- 如果规则报告不存在，拒绝跳过规则检查；失败关闭。
- 如果反馈日志不存在，拒绝跳过验收检查；缺失的日志本身就是阻塞。
- 如果覆盖条目没有版本控制，拒绝连接覆盖路径；记录外的覆盖会打败门控。

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

以"下一步阅读"结尾，指向：

- 第 39 课以了解在绿色裁决后接手的审查智能体。
- 第 40 课以了解在数据包中包含裁决的交接生成器。
- 第 41 课以了解对真实风格样本应用运行门控。
