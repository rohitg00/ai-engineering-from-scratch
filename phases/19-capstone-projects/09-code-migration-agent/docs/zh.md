# 顶点项目 09 —— 代码迁移智能体（仓库级语言/运行时升级）

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2-to-Py3 迁移器设定了 2026 年的标准。Moderne 的 OpenRewrite 在大规模上进行确定性 AST 重写。Grit 用 codemod 风格 DSL 针对相同问题。生产模式结合两者：确定性基底用于安全重写，加上智能体层用于模糊案例，沙盒用于每分支构建，以及在 PR 打开前变绿的测试工具。顶点项目是迁移 50 个真实仓库并发布通过率和失败分类法。

**类型：** 顶点项目
**语言：** Python（智能体）、Java / Python（目标）、TypeScript（仪表板）
**先决条件：** Phase 5（NLP）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（智能体）、Phase 15（自主系统）、Phase 17（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P14 · P15 · P17
**时间：** 30 小时

## 问题

大规模代码迁移是 2026 年编码智能体最清晰的生产应用之一。地面真相明显（迁移后测试套件是否通过？），回报真实（Java-8 舰队迁移是一个人头规模的项目），基准公开（MigrationBench 50 仓库子集）。Moderne 的 OpenRewrite 处理确定性方面。智能体层处理 OpenRewrite 配方无法处理的一切：模糊重写、构建系统漂移、长尾语法、传递依赖破坏。

你将构建一个智能体，接收 Java 8 仓库（或 Python 2 仓库）并生成绿色 CI 迁移分支。你将测量通过率、测试覆盖率保持、每个仓库成本，并构建失败分类法。与仅确定性基线的并排对比告诉你智能体价值实际所在之处。

## 概念

管道有两层。**确定性基底**（Java 用 OpenRewrite，Python 用 libcst）安全地运行大部分机械重写：导入、方法签名、空安全编辑、try-with-resources、弃用 API 替换。它快速并产生可审计的差异。**智能体层**（OpenAI Agents SDK 或 LangGraph 上的 Claude Opus 4.7 和 GPT-5.4-Codex）处理配方无法处理的案例：构建文件升级（Maven/Gradle/pyproject）、传递依赖冲突、测试抖动、自定义注解。

每个仓库获得一个 Daytona 沙盒，预装目标运行时。智能体迭代：运行构建、分类失败、应用修复、重新运行。硬限制：每个仓库 30 分钟、每个仓库 8 美元、20 个智能体轮次。如果所有测试通过且覆盖率差异不为负，分支打开 PR。如果没有，仓库归入失败类别并附证据。

失败分类法是可交付成果。在 50 个仓库中，什么坏了？传递依赖？自定义注解？构建工具版本？与迁移无关的测试抖动？每个类别获得计数和示例差异。未来的配方作者可以针对前三个。

## 架构

```
目标仓库
      |
      v
OpenRewrite / libcst 确定性配方
   （安全、快速、可审计，约 70-80% 的修复）
      |
      v
每分支 Daytona 沙盒
      |
      v
智能体循环（Claude Opus 4.7 / GPT-5.4-Codex）：
   - 运行构建 -> 捕获失败
   - 分类失败（构建、测试、lint）
   - 应用修复（补丁或重试配方）
   - 重新运行
   - 预算：30 分钟、8 美元、20 轮次
      |
      v
测试 + 覆盖率差异门
      |
      v（通过）
打开 PR
      |
      v（失败）
归入失败类别 + 附加复现
```

## 技术栈

- 确定性基底：OpenRewrite（Java）或 libcst（Python）
- 智能体：OpenAI Agents SDK 或 LangGraph 上的 Claude Opus 4.7 + GPT-5.4-Codex
- 沙盒：每分支 Daytona devcontainers，预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv（Python）
- 基准：Amazon MigrationBench 50 仓库子集（Java 8 到 17）、Google App Engine Py2-to-Py3 仓库
- 测试工具：并行运行器，通过 Jacoco（Java）或 coverage.py（Python）的覆盖率
- 可观察性：Langfuse + 每个仓库的追踪包，带每个差异块
- 仪表板：失败分类法仪表板，带每类别计数和示例差异

## 构建它

1. **配方通过。** 首先运行 OpenRewrite（Java）或 libcst（Python）配方。捕获 70-80% 的机械迁移。提交为"配方"提交。

2. **构建试验。** Daytona 沙盒：安装目标运行时，运行构建。如果绿色，跳到测试。如果红色，交给智能体。

3. **智能体循环。** LangGraph，带工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。智能体分类失败（依赖、语法、测试、构建工具）并应用针对性修复。重新运行。

4. **预算上限。** 每个仓库 30 分钟挂钟时间、8 美元成本、20 个智能体轮次。任何违规停止并归入"budget_exhausted"，带当前差异。

5. **测试 + 覆盖率门。** 构建变绿后，运行测试套件。与基础仓库比较覆盖率。如果覆盖率下降超过 2%，归入"coverage_regression"。

6. **PR 打开。** 成功时，推送分支，打开 PR，带差异和哪些配方应用、哪些提交由智能体撰写的摘要。

7. **失败分类法。** 对于每个失败的仓库，用类别标记：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。构建仪表板。

8. **50 仓库运行。** 在 MigrationBench 子集上执行。报告每类别通过率、每仓库成本、覆盖率保持，以及与仅确定性基线的对比。

## 使用它

```
$ migrate legacy-java-service --target java17
[配方]   27 次重写应用（JUnit 4->5、HashMap 初始化器、try-with-resources）
[构建]    失败：找不到符号 sun.misc.BASE64Encoder
[智能体]    轮次 1 分类：removed_jdk_api
[智能体]    轮次 2 应用：sun.misc.BASE64Encoder -> java.util.Base64
[构建]    正常
[测试]    412/412 通过；覆盖率 84.1% -> 84.3%
[pr]       打开 #1841  成本=$3.20  轮次=4
```

## 交付它

`outputs/skill-migration-agent.md` 是可交付成果。给定仓库，它执行确定性配方然后智能体循环以生成绿色迁移分支，或将仓库归入分类法类别。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持 | 与基础相比的平均覆盖率差异 |
| 20 | 每个迁移仓库的成本 | 通过运行的 $/仓库 |
| 20 | 智能体/确定性工具集成 | OpenRewrite 处理 vs 智能体撰写的修复比例 |
| 15 | 失败分析撰写 | 带示例的分类法完整性 |
| **100** | | |

## 练习

1. 仅用 OpenRewrite 运行迁移管道（无智能体）。比较通过率与完整管道。识别智能体单独起作用的案例。

2. 实现"lint 清洁"检查：迁移后，运行风格 linter（Java 用 spotless，Python 用 ruff）。如果出现新的 lint 错误，PR 失败。测量覆盖率保持但风格回归率。

3. 添加"最小差异"优化器：智能体分支通过测试后，用第二次通过修剪不必要的更改。报告差异大小减少。

4. 扩展到第三次迁移：Node 18 到 Node 22。重用沙盒包装；将配方层换成自定义 codemod。

5. 测量首次绿色构建时间（TTFGB）作为用户体验指标。目标：p50 低于 10 分钟。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 确定性基底 | "配方引擎" | OpenRewrite / libcst：具有安全保证的声明式 AST 重写 |
| Codemod | "代码修改程序" | 机械更改源代码的重写规则 |
| 构建漂移 | "工具版本偏差" | 主要版本之间 Maven / Gradle / uv 行为的细微变化 |
| 失败类别 | "分类法桶" | 仓库未迁移的标记原因：依赖、语法、测试、构建工具、预算 |
| 覆盖率差异 | "覆盖率保持" | 从基础到迁移分支的测试覆盖率 % 变化 |
| 智能体轮次 | "工具调用轮次" | 智能体循环中的一个计划 -> 执行 -> 观察周期 |
| 预算耗尽 | "达到上限" | 仓库在通过前消耗了其 30 分钟 / 8 美元 / 20 轮次限制 |

## 延伸阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) —— 2026 年经典基准
- [Moderne.io OpenRewrite 平台](https://www.moderne.io) —— 确定性基底参考
- [OpenRewrite 文档](https://docs.openrewrite.org) —— 配方编写
- [Grit.io](https://www.grit.io) —— 替代 codemod DSL
- [OpenAI 沙盒化迁移 cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) —— Agents SDK 参考
- [Google App Engine Py2 到 Py3 迁移器](https://cloud.google.com/appengine) —— 替代迁移基准
- [libcst](https://github.com/Instagram/LibCST) —— Python 确定性基底
- [Daytona 沙盒](https://daytona.io) —— 参考每分支沙盒
