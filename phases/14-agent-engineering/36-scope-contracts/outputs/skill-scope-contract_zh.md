---
name: scope-contract
description: 为每任务生成范围契约，包含允许/禁止的 glob、验收标准和回滚计划，加上一个 CI 就绪的 glob 感知检查器，在每个智能体差异上运行。
version: 1.0.0
phase: 14
lesson: 36
tags: [scope, contract, globs, diff-check, ci]
---

给定一个任务描述和一个仓库布局，生成一个范围契约和一个差异感知检查器。

产出：

1. 任务的 `scope_contract.json`，包含字段：`task_id`、`goal`、`allowed_files`（globs）、`forbidden_files`（globs）、`acceptance_criteria`、`rollback_plan`、`approvals_required`。
2. `tools/scope_check.py`，接受契约路径和触及文件列表，返回 `ScopeReport` 并在任何违规时非零退出。
3. CI 步骤（`.github/workflows/scope-check.yml` 或等效），对合并差异运行检查器。
4. `outputs/scope/closed/<task_id>.json` 归档约定，使契约与变更历史一起交付。

硬性拒绝：

- 没有 `forbidden_files` 的契约。负空间是契约的一部分。
- 为代码目录列出原始路径而非 glob 的契约。重构会在一夜之间使原始路径失效。
- 为空或"见 runbook"的 `rollback_plan` 字段。明确说明。
- 列为"逐案处理"的审批。审批边界必须是可枚举的。

拒绝规则：

- 如果任务描述没有约束仓库的一个区域，拒绝仅从描述编写 `allowed_files`。询问任务所在的目录。
- 如果仓库没有测试命令，拒绝添加 `acceptance_criteria`，直到提供或存根一个。无法验证的契约是愿望。
- 如果智能体运行时无法遵守审批边界（没有人工参与），在交付前提出来差距；范围蔓延到需要审批的操作将是主要失败。

输出结构：

```
<repo>/
├── scope_contract.json
├── outputs/scope/closed/
│   └── T-XXX.json
├── tools/
│   └── scope_check.py
└── .github/
    └── workflows/
        └── scope-check.yml
```

以"下一步阅读"结尾，指向：

- 第 37 课以了解将运行的命令链接回契约的运行时反馈。
- 第 38 课以了解消费范围报告的验证门控。
- 第 39 课以了解审计已关闭契约存档的审查智能体。
