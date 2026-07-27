# 顶点项目 09 — 代码迁移智能体（仓库级语言/运行时升级）

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2-to-Py3 迁移工具设定了 2026 年的标准。Moderne 的 OpenRewrite 以大规模方式进行确定性 AST 重写。Grit 通过 codemod 风格的 DSL 解决相同问题。生产模式将两者结合：用于安全重写的确定性基底 + 处理模糊情况的智能体层、用于每分支构建的沙箱，以及在 PR 打开前确保测试通过的正确性验证工具。本顶点项目的目标是迁移 50 个真实仓库，并发布通过率及失败分类报告。

**类型：** 顶点项目
**语言：** Python（智能体）、Java / Python（目标）、TypeScript（仪表板）
**前置条件：** 阶段 5（NLP）、阶段 7（Transformer）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 15（自主系统）、阶段 17（基础设施）
**涉及的阶段：** P5 · P7 · P11 · P13 · P14 · P15 · P17
**时间：** 30 小时

## 问题

大规模代码迁移是 2026 年代码智能体最清晰的生产应用之一。事实依据显而易见（迁移后测试套件是否通过？），收益是真实的（Java 8 集群迁移是一个按人头计费的大项目），且基准测试是公开的（MigrationBench 50 仓库子集）。Moderne 的 OpenRewrite 处理确定性部分。智能体层处理 OpenRewrite 配方无法解决的所有问题：模糊重写、构建系统漂移、长尾语法、传递性依赖断裂。

你将构建一个智能体，它接收一个 Java 8 仓库（或 Python 2 仓库），并生成一个 CI 通过的分支。你将衡量通过率、测试覆盖率保持情况、每个仓库的成本，并构建一个失败分类报告。与纯确定性基线的对比分析能告诉你智能体的实际价值所在。

## 概念

该流水线包含两层。**确定性基底**（Java 用 OpenRewrite，Python 用 libcst）安全地执行大部分机械性重写：导入、方法签名、空安全编辑、try-with-resources、已弃用 API 替换。它速度快且生成可审计的 diff。**智能体层**（OpenAI Agents SDK 或基于 Claude Opus 4.7 和 GPT-5.4-Codex 的 LangGraph）处理配方无法处理的场景：构建文件升级（Maven/Gradle/pyproject）、传递性依赖冲突、测试不稳定、自定义注解。

每个仓库会获得一个预装了目标运行时的 Daytona 沙箱。智能体迭代执行：运行构建、分类失败、应用修复、重新运行。硬限制：每个仓库 30 分钟、8 美元、20 个智能体轮次。如果所有测试通过且覆盖率差不为负，则分支打开 PR。否则，仓库将附带证据归入某个失败类别。

失败分类报告是最终交付物。在 50 个仓库中，哪些出了问题？传递性依赖？自定义注解？构建工具版本？与迁移无关的测试不稳定？每个类别都有计数和示例 diff。未来的配方作者可以针对前三类进行优化。

## 架构

```
目标仓库
      |
      v
OpenRewrite / libcst 确定性配方
   （安全、快速、可审计，约修复 70-80% 的问题）
      |
      v
每分支 Daytona 沙箱
      |
      v
智能体循环（Claude Opus 4.7 / GPT-5.4-Codex）：
   - 运行构建 -> 捕获失败
   - 分类失败（构建、测试、代码检查）
   - 应用修复（补丁或重试配方）
   - 重新运行
   - 预算：30 分钟、8 美元、20 轮次
      |
      v
测试 + 覆盖率差门控
      |
      v（通过）
打开 PR
      |
      v（失败）
归入失败类别 + 附上复现步骤
```

## 技术栈

- 确定性基底：OpenRewrite（Java）或 libcst（Python）
- 智能体：OpenAI Agents SDK 或基于 Claude Opus 4.7 + GPT-5.4-Codex 的 LangGraph
- 沙箱：每分支 Daytona devcontainer，预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv（Python）
- 基准测试：Amazon MigrationBench 50 仓库子集（Java 8 到 17）、Google App Engine Py2-to-Py3 仓库
- 测试框架：并行运行器，通过 Jacoco（Java）或 coverage.py（Python）测量覆盖率
- 可观测性：Langfuse + 每个仓库的跟踪包，包含每个 diff 片段
- 仪表板：失败分类仪表板，包含每类计数和示例 diff

## 构建步骤

1. **配方阶段。** 首先运行 OpenRewrite（Java）或 libcst（Python）配方。处理 70-80% 的机械性迁移。提交为"recipe"提交。

2. **构建试用。** Daytona 沙箱：安装目标运行时，运行构建。如果通过，跳转到测试。如果失败，交给智能体处理。

3. **智能体循环。** 使用 LangGraph 及以下工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。智能体分类失败类型（依赖、语法、测试、构建工具）并应用针对性修复。重新运行。

4. **预算上限。** 每个仓库 30 分钟墙钟时间、8 美元成本、20 个智能体轮次。任何一项超限即停止，并将当前 diff 归入"预算耗尽"类别。

5. **测试 + 覆盖率门控。** 构建通过后，运行测试套件。与基准仓库比较覆盖率。如果覆盖率下降超过 2%，归入"覆盖率回退"类别。

6. **打开 PR。** 成功后，推送分支，打开 PR，附带 diff 以及应用的配方和智能体提交的摘要。

7. **失败分类。** 对每个失败的仓库，打上类别标签：`dep_upgrade_required`（依赖需升级）、`build_tool_drift`（构建工具漂移）、`custom_annotation`（自定义注解）、`test_flake`（测试不稳定）、`syntax_edge_case`（语法边缘情况）、`budget_exhausted`（预算耗尽）。构建仪表板。

8. **50 仓库运行。** 在 MigrationBench 子集上执行。报告每类通过率、每仓库成本、覆盖率保持情况，以及与纯确定性基线的对比分析。

## 使用示例

```
$ migrate legacy-java-service --target java17
[recipe]    应用了 27 项重写（JUnit 4->5、HashMap 初始化器、try-with-resources）
[build]    失败：找不到符号 sun.misc.BASE64Encoder
[agent]    第 1 轮 分类：removed_jdk_api
[agent]    第 2 轮 应用：sun.misc.BASE64Encoder -> java.util.Base64
[build]    通过
[tests]    412/412 通过；覆盖率 84.1% -> 84.3%
[pr]       已打开 #1841  成本=$3.20  轮次=4
```

## 交付标准

`outputs/skill-migration-agent.md` 是最终交付物。给定一个仓库，它执行确定性配方，然后通过智能体循环生成一个通过 CI 的迁移分支，或者将仓库归入某个分类类别。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持 | 相对于基准的平均覆盖率差 |
| 20 | 每迁移仓库成本 | 成功运行中的 $/仓库 |
| 20 | 智能体/确定性工具集成 | OpenRewrite 处理 vs 智能体编写的修复比例 |
| 15 | 失败分析报告 | 分类完整性及示例 |
| **100** | | |

## 练习

1. 仅使用 OpenRewrite（无智能体）运行迁移流水线。比较通过率与完整流水线。找出智能体单独发挥作用的情况。

2. 实现"代码检查清洁"检查：迁移后运行样式检查器（Java 用 spotless，Python 用 ruff）。如果出现新的代码检查错误，则拒绝 PR。衡量覆盖率保持但样式回退的比例。

3. 添加"最小化 diff"优化器：智能体的分支通过测试后，通过第二轮清理不必要的更改。报告 diff 大小缩减情况。

4. 扩展到第三种迁移：Node 18 到 Node 22。复用沙箱封装；将配方层替换为自定义 codemod。

5. 测量首次构建通过时间（TTFGB）作为用户体验指标。目标：p50 在 10 分钟以内。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| 确定性基底 | "配方引擎" | OpenRewrite / libcst：具有安全保障的声明式 AST 重写 |
| Codemod | "代码修改程序" | 机械性更改源代码的重写规则 |
| 构建漂移 | "工具版本偏差" | Maven / Gradle / uv 在主要版本之间微妙的行为变化 |
| 失败类别 | "分类桶" | 仓库未能迁移的标记原因：依赖、语法、测试、构建工具、预算 |
| 覆盖率差 | "覆盖率保持" | 从基准到迁移分支的测试覆盖率百分比变化 |
| 智能体轮次 | "工具调用回合" | 智能体循环中的一个计划 -> 行动 -> 观察周期 |
| 预算耗尽 | "触及上限" | 仓库在未通过的情况下消耗完 30 分钟/8 美元/20 轮次的限制 |

## 延伸阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年权威基准测试
- [Moderne.io OpenRewrite 平台](https://www.moderne.io) — 确定性基底参考
- [OpenRewrite 文档](https://docs.openrewrite.org) — 配方编写
- [Grit.io](https://www.grit.io) — 替代 codemod DSL
- [OpenAI 沙箱化迁移指南](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK 参考
- [Google App Engine Py2 到 Py3 迁移工具](https://cloud.google.com/appengine) — 替代迁移基准
- [libcst](https://github.com/Instagram/LibCST) — Python 确定性基底
- [Daytona 沙箱](https://daytona.io) — 每分支沙箱参考
