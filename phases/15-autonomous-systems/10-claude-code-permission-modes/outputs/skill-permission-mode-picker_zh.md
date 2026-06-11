---
name: permission-mode-picker
description: 将 Claude Code 任务匹配到正确的权限模式、预算上限和所需隔离，然后再开始运行。
version: 1.0.0
phase: 15
lesson: 10
tags: [claude-code, permission-modes, auto-mode, budgets, isolation]
---

给定提议的 Claude Code 任务，选择权限模式、设置预算并指定代理允许开始之前所需的最低隔离。

生成：

1. **任务概况。** 一句话说明任务做什么，一句话说明如果出错爆炸半径。
2. **模式建议。** 之一：`plan`、`default`、`acceptEdits`、`acceptExec`、`autoMode`、`yolo`、`bypassPermissions`。用一句话引用爆炸半径证明。
3. **预算数字。** `max_turns`、`max_budget_usd` 和任何每工具上限的具体值。对于无人值守运行超过一小时，指定美元上限等于或低于你愿意为人类无法回滚的错误支付的费用。
4. **隔离要求。** 文件系统范围（仅项目目录、暂存目录、临时容器）。网络策略（no egress、allowlist only、full）。凭证表面（none、scoped token、broad token）。对于 `bypassPermissions` 或 `yolo`，运行必须在临时容器内，没有生产凭证挂载。
5. **轨迹审计计划。** 人类将如何审查运行后的轨迹？`autoMode`、`yolo` 和任何超过 30 分钟范围的必需。

硬性拒绝：
- 针对有未提交更改的仓库的 `bypassPermissions`。
- 没有预算上限的 `autoMode`。
- 环境中带有广泛凭证的任何高于 `acceptEdits` 的模式（AWS、GCP、具有 repo 范围的 GitHub PAT）。
- 没有计划轨迹审计的超过一小时无人值守运行。
- 声称 Auto Mode 分类器单独足以应对新颖任务分布。

拒绝规则：
- 如果用户无法命名失败的爆炸半径，拒绝并要求在开始之前明确的 worst-case 句子。
- 如果用户在具有可到达的生产数据库凭证的工作区中请求 `autoMode`，拒绝并要求先进行范围凭证或临时容器。
- 如果提议的预算上限超过用户愿意在错误运行中损失的费用，拒绝并要求更低的上限。

输出格式：

返回一页运行卡，包含：
- **任务摘要**（一句话）
- **爆炸半径**（一句话，最坏情况）
- **模式**（显式）
- **预算**（`max_turns`、`max_budget_usd`、每工具上限）
- **隔离**（fs scope、network policy、credential surface）
- **审计计划**（谁审查轨迹、何时、针对什么评分标准）
