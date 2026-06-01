# 09 · 毕业项目 09 — 代码迁移智能体（仓库级语言 / 运行时升级）

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2 到 Py3 迁移工具定义了 2026 年的行业基准。Moderne 的 OpenRewrite 以规模化方式执行确定性 AST（抽象语法树）重写。Grit 用 codemod 风格的 DSL（领域特定语言）解决同类问题。生产级模式将两者结合：确定性基座（deterministic substrate）处理安全重写，智能体（agent）层处理模糊场景，沙箱（sandbox）用于逐分支构建，测试套件在 PR（拉取请求）打开前保证绿灯。本毕业项目的目标是迁移 50 个真实仓库，并发布通过率与失败分类体系（failure taxonomy）。

**类型：** 毕业项目
**语言：** Python（智能体），Java / Python（迁移对象），TypeScript（仪表盘）
**前置：** 阶段 5（NLP）、阶段 7（Transformers）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 15（自主运行）、阶段 17（基础设施）
**涉及阶段：** P5 · P7 · P11 · P13 · P14 · P15 · P17
**时长：** 30 小时

## 问题

大规模代码迁移是 2026 年编程智能体最清晰的生产应用之一。基本事实显而易见（迁移后测试套件是否通过？），回报真实可感（一个 Java 8 机群的迁移是人力规模级的项目），基准公开透明（MigrationBench 的 50 仓库子集）。Moderne 的 OpenRewrite 处理确定性方面。智能体层处理 OpenRewrite 配方（recipe）无法覆盖的一切：模糊重写、构建系统漂移（build-system drift）、长尾语法、传递依赖断裂。

你将构建一个智能体，接收一个 Java 8 仓库（或 Python 2 仓库），产出一个 CI（持续集成）绿灯的迁移分支。你需要衡量通过率、测试覆盖率保持度、单仓库成本，并构建失败分类体系。与纯确定性基线的对比将告诉你智能体的真正价值所在。

## 概念

流水线分为两层。**确定性基座**（Java 用 OpenRewrite，Python 用 libcst）安全地执行大部分机械性重写：import 语句、方法签名、空安全编辑、try-with-resources、废弃 API 替换。它速度快，产出可审计的 diff。**智能体层**（OpenAI Agents SDK 或基于 Claude Opus 4.7 和 GPT-5.4-Codex 的 LangGraph）处理配方无法覆盖的情况：构建文件升级（Maven / Gradle / pyproject）、传递依赖冲突、测试不稳定（test flakes）、自定义注解。

每个仓库获得一个预装目标运行时的 Daytona 沙箱。智能体循环迭代：运行构建、分类失败、应用修复、重新运行。硬限制：每仓库 30 分钟、8 美元、20 个智能体回合（agent turn）。如果所有测试通过且覆盖率差值为非负，则分支发起 PR。否则，该仓库按失败类别归档并附证据。

失败分类体系是本项目的交付物。在 50 个仓库中，出了什么问题？传递依赖？自定义注解？构建工具版本？与迁移无关的测试不稳定？每个类别分配计数并附带典型案例的 diff。未来的配方作者可以针对前三类进行攻关。

## 架构

```
目标仓库
      |
      v
OpenRewrite / libcst 确定性配方
   （安全、快速、可审计，覆盖约 70-80% 的修复）
      |
      v
逐分支 Daytona 沙箱
      |
      v
智能体循环（Claude Opus 4.7 / GPT-5.4-Codex）：
   - 运行构建 → 捕获失败
   - 分类失败（构建、测试、代码风格检查）
   - 应用修复（补丁或重试配方）
   - 重新运行
   - 预算：30 分钟、8 美元、20 回合
      |
      v
测试 + 覆盖率差值关卡
      |
      v（通过）
发起 PR
      |
      v（失败）
按失败类别归档 + 附复现材料
```

## 技术栈

- 确定性基座：OpenRewrite（Java）或 libcst（Python）
- 智能体：OpenAI Agents SDK 或基于 Claude Opus 4.7 + GPT-5.4-Codex 的 LangGraph
- 沙箱：逐分支 Daytona 开发容器（devcontainer），预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv（Python）
- 基准：Amazon MigrationBench 50 仓库子集（Java 8 到 17）、Google App Engine Py2 到 Py3 仓库
- 测试套件：并行运行器，覆盖率通过 Jacoco（Java）或 coverage.py（Python）采集
- 可观测性：Langfuse + 每仓库的 trace bundle，包含每次 diff 片段
- 仪表盘：失败分类仪表盘，含各类计数与典型案例 diff

## 构建过程

1. **配方扫描。** 首先运行 OpenRewrite（Java）或 libcst（Python）配方。捕获 70-80% 可机械迁移的部分。提交为"recipe"提交。

2. **构建试运行。** Daytona 沙箱：安装目标运行时，运行构建。若绿灯，跳到测试。若红灯，交给智能体。

3. **智能体循环。** LangGraph 配合工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。智能体对失败进行分类（依赖、语法、测试、构建工具）并应用针对性修复。重新运行。

4. **预算上限。** 每仓库 30 分钟挂钟时间、8 美元成本、20 个智能体回合。任何超限即停止，将当前 diff 归档到"budget_exhausted"类别。

5. **测试 + 覆盖率关卡。** 构建变绿后，运行测试套件。与基准仓库对比覆盖率。若覆盖率下降超过 2%，归档到"coverage_regression"类别。

6. **发起 PR。** 成功后，推送分支，发起 PR 并附带 diff 以及配方应用和智能体提交的摘要。

7. **失败分类体系。** 对每个失败的仓库，标记类别：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。构建仪表盘。

8. **50 仓库运行。** 在 MigrationBench 子集上执行。报告各类通过率、单仓成本、覆盖率保持度，以及与纯确定性基线的对比。

## 使用方式

```
$ migrate legacy-java-service --target java17
[recipe]   27 处重写已应用（JUnit 4→5、HashMap 初始化器、try-with-resources）
[build]    失败：找不到符号 sun.misc.BASE64Encoder
[agent]    回合 1 分类：removed_jdk_api
[agent]    回合 2 应用：sun.misc.BASE64Encoder → java.util.Base64
[build]    通过
[tests]    412/412 通过；覆盖率 84.1% → 84.3%
[pr]       已发起 #1841  成本=$3.20  回合=4
```

## 交付标准

`outputs/skill-migration-agent.md` 是本项目的交付物。给定一个仓库，它先执行确定性配方，再通过智能体循环产出迁移后的绿灯分支，或将仓库归档到分类体系中的某个类别。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持度 | 与基准的平均覆盖率差值 |
| 20 | 每迁移仓库成本 | 通过运行的美元/仓库 |
| 20 | 智能体 / 确定性工具集成 | OpenRewrite 处理 vs 智能体撰写的修复比例 |
| 15 | 失败分析报告 | 分类体系完整性及典型案例 |
| **100** | | |

## 练习

1. 仅使用 OpenRewrite 运行迁移流水线（无智能体）。对比与完整流水线的通过率。找出智能体单独决定成败的场景。

2. 实现"代码风格检查"关卡：迁移后运行风格检查器（Java 用 spotless，Python 用 ruff）。若出现新的代码风格错误，PR 不通过。衡量"覆盖率保持但风格退化"的比例。

3. 添加"最小 diff"优化器：智能体分支通过测试后，用第二遍扫描裁掉不必要的改动。报告 diff 大小缩减量。

4. 扩展到第三种迁移：Node 18 到 Node 22。复用沙箱封装层；将配方层替换为自定义 codemod。

5. 衡量"首次绿灯构建时间"（TTFGB）作为用户体验指标。目标：p50 低于 10 分钟。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 确定性基座（Deterministic substrate） | "配方引擎" | OpenRewrite / libcst：带安全保证的声明式 AST 重写 |
| Codemod | "代码修改程序" | 以机械方式修改源代码的重写规则 |
| 构建漂移（Build drift） | "工具版本偏差" | 主版本之间 Maven / Gradle / uv 行为的细微变化 |
| 失败类别（Failure class） | "分类桶" | 仓库迁移失败的标记原因：依赖、语法、测试、构建工具、预算 |
| 覆盖率差值（Coverage delta） | "覆盖率保持" | 从基准到迁移分支的测试覆盖率变化百分比 |
| 智能体回合（Agent turn） | "工具调用轮次" | 智能体循环中的一次 计划 → 行动 → 感知 周期 |
| 预算耗尽（Budget exhaustion） | "触顶" | 仓库用尽 30 分钟 / 8 美元 / 20 回合限制而未通过 |

## 延伸阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年权威基准
- [Moderne.io OpenRewrite 平台](https://www.moderne.io) — 确定性基座参考实现
- [OpenRewrite 文档](https://docs.openrewrite.org) — 配方编写
- [Grit.io](https://www.grit.io) — 替代性 codemod DSL
- [OpenAI 沙箱化迁移 Cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK 参考
- [Google App Engine Py2 到 Py3 迁移工具](https://cloud.google.com/appengine) — 替代迁移基准
- [libcst](https://github.com/Instagram/LibCST) — Python 确定性基座
- [Daytona 沙箱](https://daytona.io) — 逐分支沙箱参考
