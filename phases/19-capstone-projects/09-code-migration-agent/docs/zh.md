# 综合项目 09 — 代码迁移智能体（仓库级语言/运行时升级）

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2 到 Py3 迁移器设定了 2026 年的标准。Moderne 的 OpenRewrite 在大规模上执行确定性的 AST 重写。Grit 用 codemod 风格的 DSL 解决同样的问题。生产模式结合了两者：用于安全重写的确定性底层，加上用于模糊案例的智能体层、每个分支构建的沙箱，以及在 PR 打开之前翻绿的测试框架。本综合项目是迁移 50 个真实仓库，并发布带有失败分类法的通过率。

**类型：** 综合项目
**语言：** Python（智能体）、Java / Python（目标）、TypeScript（仪表板）
**前置条件：** 第 5 阶段（NLP）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 15 阶段（自主）、第 17 阶段（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P14 · P15 · P17
**时间：** 30 小时

## 问题描述

大规模代码迁移是 2026 年编程智能体最清晰的生产应用之一。地面实况是显而易见的（迁移后测试套件是否通过？），回报是真实的（Java-8 舰队迁移是一个人数规模的项目），基准测试是公开的（MigrationBench 50 仓库子集）。Moderne 的 OpenRewrite 处理确定性侧。智能体层处理 OpenRewrite 配方无法处理的所有事情：模糊重写、构建系统漂移、长尾语法、传递依赖破坏。

你将构建一个智能体，它接受一个 Java 8 仓库（或 Python 2 仓库）并生成一个绿 CI 的迁移分支。你将测量通过率、测试覆盖率保持情况、每个仓库的成本，并构建失败分类法。与仅确定性基线的并排对比告诉你智能体的价值实际在哪里。

## 核心概念

管道有两层。**确定性底层**（Java 用 OpenRewrite，Python 用 libcst）安全运行大部分机械重写：导入、方法签名、空安全编辑、try-with-resources、已弃用 API 替换。它快速且产生可审计的 diff。**智能体层**（基于 Claude Opus 4.7 和 GPT-5.4-Codex 的 OpenAI Agents SDK 或 LangGraph）处理配方无法处理的案例：构建文件升级（Maven/Gradle/pyproject）、传递依赖冲突、测试 flakes、自定义注解。

每个仓库获得一个预装目标运行时的 Daytona 沙箱。智能体迭代：运行构建、分类失败、应用修复、重新运行。硬性限制：每个仓库 30 分钟、$8、20 个智能体轮次。如果所有测试通过且覆盖率增量不为负，分支打开 PR。如果不通过，仓库被归档在带有证据的失败类别下。

失败分类法是可交付成果。在 50 个仓库中，什么出错了？传递依赖？自定义注解？构建工具版本？与迁移无关的测试 flakes？每个类别获得一个计数和一个示例 diff。未来的配方作者可以针对前三名。

## 架构

```
目标仓库
      |
      v
OpenRewrite / libcst 确定性配方
   （安全、快速、可审计，约 70-80% 的修复）
      |
      v
每个分支的 Daytona 沙箱
      |
      v
智能体循环（Claude Opus 4.7 / GPT-5.4-Codex）：
   - 运行构建 -> 捕获失败
   - 分类失败（构建、测试、lint）
   - 应用修复（补丁或重试配方）
   - 重新运行
   - 预算：30 分钟、$8、20 轮
      |
      v
测试 + 覆盖率增量门控
      |
      v（通过）
打开 PR
      |
      v（失败）
归档在失败类别 + 附加重现
```

## 技术栈

- 确定性底层：OpenRewrite（Java）或 libcst（Python）
- 智能体：基于 Claude Opus 4.7 + GPT-5.4-Codex 的 OpenAI Agents SDK 或 LangGraph
- 沙箱：每个分支的 Daytona devcontainers，预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv（Python）
- 基准测试：Amazon MigrationBench 50 仓库子集（Java 8 到 17）、Google App Engine Py2 到 Py3 仓库
- 测试框架：并行运行器，通过 Jacoco（Java）或 coverage.py（Python）的覆盖率
- 可观测性：每个仓库带有每个 diff 块的 Langfuse + 追踪包
- 仪表板：带有每个类别计数和示例 diff 的失败分类法仪表板

## 构建步骤

1. **配方通行。** 先运行 OpenRewrite（Java）或 libcst（Python）配方。捕获 70-80% 的机械迁移。作为"配方"提交进行提交。

2. **构建试验。** Daytona 沙箱：安装目标运行时，运行构建。如果绿，跳到测试。如果红，移交给智能体。

3. **智能体循环。** 带有工具的 LangGraph：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。智能体分类失败（依赖、语法、测试、构建工具）并应用针对性修复。重新运行。

4. **预算上限。** 每个仓库实际时间 30 分钟、成本 $8、20 个智能体轮次。任何违反都停止并将当前 diff 归档在"budget_exhausted"下。

5. **测试 + 覆盖率门控。** 构建变绿后，运行测试套件。将覆盖率与基础仓库进行比较。如果覆盖率下降超过 2%，归档在"coverage_regression"下。

6. **PR 打开。** 成功后，推送分支，打开 PR，附带 diff 和应用的配方以及智能体创作的提交的摘要。

7. **失败分类法。** 对于每个失败的仓库，用类别标记：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。构建仪表板。

8. **50 仓库运行。** 在 MigrationBench 子集上执行。报告每个类别的通过率、每个仓库的成本、覆盖率保持情况，以及与仅确定性基线的比较。

## 使用示例

```
$ migrate legacy-java-service --target java17
[recipe]   应用了 27 个重写（JUnit 4->5、HashMap 初始化器、try-with-resources）
[build]    FAIL：找不到符号 sun.misc.BASE64Encoder
[agent]    轮次 1 分类：removed_jdk_api
[agent]    轮次 2 应用：sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]     412/412 通过；覆盖率 84.1% -> 84.3%
[pr]        打开的 #1841  成本=$3.20  轮次=4
```

## 交付成果

`outputs/skill-migration-agent.md` 是可交付成果。给定一个仓库，它执行确定性配方，然后执行智能体循环以生成绿迁移分支，或将仓库归档在分类法类别下。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持 | 与基础的平均覆盖率增量 |
| 20 | 每个迁移仓库的成本 | 通过运行的 $/仓库 |
| 20 | 智能体 / 确定性工具集成 | OpenRewrite 处理的修复 vs 智能体创作的修复的比例 |
| 15 | 失败分析撰写 | 带有示例的分类法完整性 |
| **100** | | |

## 练习

1. 仅用 OpenRewrite 运行迁移管道（无智能体）。将通过率与完整管道进行比较。识别智能体单独产生差异的案例。

2. 实施"lint-clean"检查：迁移后，运行样式 linter（Java 用 spotless，Python 用 ruff）。如果出现新的 lint 错误，则 PR 失败。测量覆盖率保持但样式回归的比例。

3. 添加"最小 diff"优化器：智能体的分支通过测试后，用第二遍修剪不必要的更改。报告 diff 大小减少量。

4. 扩展到第三次迁移：Node 18 到 Node 22。重用沙箱封装；将配方层交换为自定义 codemod。

5. 测量首次绿构建时间（TTFGB）作为 UX 指标。目标：p50 在 10 分钟内。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 确定性底层 | "配方引擎" | OpenRewrite / libcst：带有安全保证的声明式 AST 重写 |
| Codemod | "代码修改程序" | 机械地更改源代码的重写规则 |
| 构建漂移 | "工具版本偏差" | 主要版本之间微妙的 Maven / Gradle / uv 行为变化 |
| 失败类别 | "分类法桶" | 仓库未迁移的标记原因：依赖、语法、测试、构建工具、预算 |
| 覆盖率增量 | "覆盖率保持" | 从基础到迁移分支的测试覆盖率 % 变化 |
| 智能体轮次 | "工具调用轮次" | 智能体循环中的一个 plan -> act -> observe 周期 |
| 预算耗尽 | "触及天花板" | 仓库消耗了其 30 分钟 / $8 / 20 轮限制而未通过 |

## 延伸阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年规范基准测试
- [Moderne.io OpenRewrite 平台](https://www.moderne.io) — 确定性底层参考
- [OpenRewrite 文档](https://docs.openrewrite.org) — 配方创作
- [Grit.io](https://www.grit.io) — 备选 codemod DSL
- [OpenAI 沙箱迁移食谱](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK 参考
- [Google App Engine Py2 到 Py3 迁移器](https://cloud.google.com/appengine) — 备选迁移基准测试
- [libcst](https://github.com/Instagram/LibCST) — Python 确定性底层
- [Daytona 沙箱](https://daytona.io) — 每个分支的参考沙箱
