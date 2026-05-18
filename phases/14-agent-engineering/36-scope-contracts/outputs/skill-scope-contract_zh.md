---
name: scope-contract
description: 生成带有 allowed/forbidden globs、验收标准和回滚计划的每任务范围契约，加上在每次代理差异上运行的 CI-ready glob-aware 检查器。
version: 1.0.0
phase: 14
lesson: 36
tags: [scope, contract, globs, diff-check, ci]
---

给定任务描述和仓库布局，生成范围契约和差异感知检查器。

生成：

1. 任务的 `scope_contract.json`，带有字段：`task_id`、`goal`、`allowed_files`（globs）、`forbidden_files`（globs）、`acceptance_criteria`、`rollback_plan`、`approvals_required`。
2. `tools/scope_check.py`，接受契约路径和触及文件列表，返回 `ScopeReport` 加上任何违规的非零退出。
3. CI 步骤（`.github/workflows/scope-check.yml` 或等效），针对合并差异运行检查器。
4. `outputs/scope/closed/<task_id>.json` 归档约定，以便契约随更改历史一起发布。

硬性拒绝：

- 没有 `forbidden_files` 的契约。负面空间是契约的一部分。
- 为代码目录列出原始路径而不是 globs 的契约。重构使原始路径一夜之间无效。
- 为空或"see runbook"的 `rollback_plan` 字段。拼写出来。
- 列为"case by case"的审批。审批边界必须是可枚举的。

拒绝规则：

- 如果任务描述没有约束仓库的区域，拒绝仅从描述创作 `allowed_files`。询问任务所在的目录。
- 如果仓库没有测试命令，拒绝添加 `acceptance_criteria`，直到提供或存根。无法验证的契约是愿望。
