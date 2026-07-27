---
name: migration-agent
description: 构建一个仓库级代码迁移智能体，将确定性配方与智能体回退循环相结合，通过 MigrationBench，并发布故障分类体系。
version: 1.0.0
phase: 19
lesson: 09
tags: [capstone, code-migration, openrewrite, libcst, migrationbench, agent, sandbox]
---

给定一个 Java 8 或 Python 2 仓库，生成一个迁移后的分支（到 Java 17 或 Python 3.12），带有通过测试套件和最小的覆盖率回归。在 50 个仓库的 MigrationBench 子集上进行评估。

构建计划：

1. 确定性阶段：OpenRewrite（Java）或 libcst（Python）首先运行机械重写。提交为"recipe"提交，带有干净的差异。
2. Daytona 沙箱：目标运行时预装；每个分支构建；只读源挂载。
3. 智能体循环：基于 Claude Opus 4.7 + GPT-5.4-Codex 的 LangGraph 或 OpenAI Agents SDK。工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。分类失败（依赖、语法、测试、构建工具），应用目标修复，重新运行。
4. 预算上限：30 分钟、8 美元、20 轮。任何一项超出即停止，并将当前差异归档到 `budget_exhausted` 下。
5. 测试 + 覆盖率门控：构建通过后测试通过；覆盖率下降不得超过 2%。
6. 打开 PR，包含配方提交 + 智能体提交 + 摘要评论。
7. 故障分类：每个仓库标签来自 `{dep_upgrade_required, build_tool_drift, custom_annotation, test_flake, syntax_edge_case, budget_exhausted, coverage_regression}`。
8. 在 MigrationBench 上运行 50 个仓库；发布每类别通过率、每仓库成本和覆盖率保持情况；与仅确定性基线进行比较。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持 | 与基础分支相比的平均覆盖率差异 |
| 20 | 每迁移仓库的成本 | 通过运行中的平均 $/仓库 |
| 20 | 智能体/确定性工具集成 | OpenRewrite 与智能体处理的修复比例 |
| 15 | 故障分析报告 | 带有示例的分类体系完整性 |

硬性拒绝：

- 跳过确定性阶段的管道。OpenRewrite 以更低成本和更高可靠性处理机械性的 70-80%。
- 超过 2% 的覆盖率回归视为通过。
- 将机械性和智能体编写的变更打包到一次提交中的 PR。必须分开。
- 报告通过率时没有在同一 50 个仓库上的匹配的仅确定性基线。

拒绝规则：

- 拒绝强制推送迁移分支覆盖基础分支。始终是新分支 + PR。
- 拒绝打开 CI 在沙箱中尚未变绿的 PR。
- 拒绝在没有明确修改许可的情况下对企业仓库运行。

输出：一个包含两层迁移管道、50 仓库 MigrationBench 运行日志、故障分类仪表板、匹配的仅确定性基线运行，以及一份关于最常见的三个故障类别及可消除每个类别的配方变更的仓库。
