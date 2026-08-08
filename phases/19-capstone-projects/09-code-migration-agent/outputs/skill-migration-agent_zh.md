---
name: migration-agent
description: 构建仓库级代码迁移代理，结合确定性配方与代理回退循环，通过MigrationBench并发布失败分类。
version: 1.0.0
phase: 19
lesson: 09
tags: [capstone, code-migration, openrewrite, libcst, migrationbench, agent, sandbox]
---

给定Java 8或Python 2仓库，生成迁移分支（到Java 17或Python 3.12），具备绿色测试套件和最小覆盖率回归。在50仓库MigrationBench子集上评估。

构建计划：

1. 确定性通道：OpenRewrite（Java）或libcst（Python）首先运行机械重写。作为"配方"提交，附带干净差异。
2. Daytona沙箱：目标运行时预安装；每分支构建；只读源挂载。
3. 代理循环：LangGraph或OpenAI Agents SDK上的Claude Opus 4.7 + GPT-5.4-Codex。工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。分类失败（依赖、语法、测试、构建工具），应用针对性修复，重跑。
4. 预算上限：30分钟、8美元、20轮。突破任何上限即停止，并将当前差异归档到`budget_exhausted`。
5. 测试+覆盖率门：构建绿色然后测试绿色；覆盖率下降不得超过2%。
6. 打开PR，含配方提交 + 代理提交 + 摘要评论。
7. 失败分类：每仓库标签来自`{dep_upgrade_required, build_tool_drift, custom_annotation, test_flake, syntax_edge_case, budget_exhausted, coverage_regression}`。
8. 跨MigrationBench的50仓库运行；发布每类通过率、每仓库成本、覆盖率保持；与仅确定性基线比较。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | MigrationBench通过率 | 50仓库子集pass@1 |
| 20 | 测试覆盖率保持 | 与基础分支的平均覆盖率增量 |
| 20 | 每迁移仓库成本 | 通过运行的平均$/仓库 |
| 20 | 代理/确定性工具集成 | OpenRewrite与代理处理的修复比例 |
| 15 | 失败分析撰写 | 带示例的分类完整性 |

硬性拒绝：
- 跳过确定性通道的管道。OpenRewrite处理机械性70-80%比任何代理更便宜更可靠。
- 覆盖率回归超过2%被视为通过。
- 将机械和代理编写的变更打包到一个提交的PR中。必须分离。
- 未在同一50仓库上匹配仅确定性基线的通过率报告。

拒绝规则：
- 拒绝强制推送迁移分支覆盖基础。始终是新分支 + PR。
- 拒绝打开CI未在沙箱中翻绿的PR。
- 拒绝在没有明确修改许可的情况下在企业仓库上运行。

输出：包含两层迁移管道、50仓库MigrationBench运行日志、失败分类仪表板、匹配的仅确定性基线运行，以及一份关于三个最常见失败类别及消除每个的配方变更的撰写的仓库。
