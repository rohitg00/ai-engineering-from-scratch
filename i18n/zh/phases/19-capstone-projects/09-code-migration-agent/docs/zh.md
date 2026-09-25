# 毕业项目 09 — 代码迁移智能体（仓库级语言 / 运行时升级）

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2-to-Py3 迁移工具树立了 2026 年的标准。Moderne 的 OpenRewrite 可以在大规模范围内执行确定性的 AST 重写。Grit 则以 codemod 风格的 DSL 针对同一问题。生产级模式结合了两者：用于安全重写的确定性基底，加上处理模糊情况的智能体层、用于每分支构建的沙箱，以及在 PR 开启前测试通过（绿灯）的测试工具。毕业项目是迁移 50 个真实仓库，并发布通过率及故障分类法。

**Type:** 毕业项目
**Languages:** Python（智能体）、Java / Python（目标代码）、TypeScript（仪表盘）
**Prerequisites:** 阶段 5（NLP）、阶段 7（transformers）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 15（自主智能体）、阶段 17（基础设施）
**Phases exercised:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 小时

## 问题

大规模代码迁移是 2026 年编码智能体最清晰的生产级应用之一。其真实标准显而易见（迁移后测试套件是否通过？），收益巨大（Java-8 仓库群的迁移是一个相当于人员编制规模的项目），基准测试也是公开的（MigrationBench 50 仓库子集）。Moderne 的 OpenRewrite 处理确定性部分。智能体层则处理 OpenRewrite 配方无法涵盖的一切：模糊重写、构建系统漂移、长尾语法、传递依赖破坏。

你将构建一个智能体，接收一个 Java 8 仓库（或 Python 2 仓库），并产出一个 CI 全绿的已迁移分支。你将测量通过率、测试覆盖率保持率、每个仓库的成本，并构建一个故障分类法。与纯确定性基线的对比能告诉你智能体的价值究竟体现在哪里。

## 概念

该流水线分为两层。**确定性基底**（Java 用 OpenRewrite，Python 用 libcst）安全地执行大部分机械性重写：导入、方法签名、空安全编辑、try-with-resources、弃用 API 替换。它速度快且产生可审计的差异。**智能体层**（基于 Claude Opus 4.7 和 GPT-5.4-Codex 的 OpenAI Agents SDK 或 LangGraph）处理配方无法处理的情况：构建文件升级（Maven/Gradle/pyproject）、传递依赖冲突、测试偶发失败、自定义注解。

每个仓库分配一个预装目标运行时的 Daytona 沙箱。智能体进行迭代：运行构建、分类故障、应用修复、重新运行。硬性限制：每个仓库 30 分钟、每个仓库 8 美元、20 个智能体回合。如果所有测试通过且覆盖率差异不为负，则该分支开启 PR。否则，该仓库被归入某个故障类别并附带证据。

故障分类法是核心交付物。在 50 个仓库中，什么出了问题？传递依赖？自定义注解？构建工具版本？与迁移无关的测试偶发失败？每个类别都有一个计数和一个示例差异。未来的配方作者可以针对前三名进行优化。

## 架构

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## 技术栈

- 确定性基底：OpenRewrite（Java）或 libcst（Python）
- 智能体：基于 Claude Opus 4.7 + GPT-5.4-Codex 的 OpenAI Agents SDK 或 LangGraph
- 沙箱：每分支一个 Daytona devcontainer，预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv (Python)
- 基准测试：Amazon MigrationBench 50 仓库子集（Java 8 到 17），Google App Engine Py2-to-Py3 仓库
- 测试工具：并行运行器，覆盖率通过 Jacoco (Java) 或 coverage.py (Python) 实现
- 可观测性：Langfuse + 每个仓库的跟踪捆绑包，包含每个差异块
- 仪表盘：故障分类仪表盘，显示各类计数和示例差异

```figure
ce-migration-funnel
```

## 构建它

1. **配方执行。** 首先运行 OpenRewrite (Java) 或 libcst (Python) 配方。捕获其中 70-80% 机械性的迁移。作为“配方”提交进行提交。

2. **构建试验。** Daytona 沙箱：安装目标运行时，运行构建。如果通过，跳转至测试。如果失败，转交给智能体。

3. **智能体循环。** 带工具的 LangGraph：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。智能体对故障进行分类（依赖、语法、测试、构建工具）并应用针对性修复。重新运行。

4. **预算上限。** 每个仓库 30 分钟壁钟时间、8 美元成本、20 个智能体回合。任何违规则停止并归入“budget_exhausted”并附上当前差异。

5. **测试 + 覆盖率门禁。** 构建通过后，运行测试套件。将覆盖率与基准仓库进行比较。如果覆盖率下降超过 2%，则归入“coverage_regression”。

6. **PR 开启。** 成功后，推送分支，开启 PR，附上差异以及哪些配方已应用、哪些提交由智能体编写的摘要。

7. **故障分类法。** 对于每个失败的仓库，按类别标记：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。构建一个仪表盘。

8. **50 仓库运行。** 在 MigrationBench 子集上执行。报告每个类别的通过率、每个仓库的成本、覆盖率保持情况，以及与纯确定性基线的对比。

## 使用它

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## 交付它

`outputs/skill-migration-agent.md` 是交付物。给定一个仓库，它执行确定性配方，然后运行智能体循环以产出一个迁移后全绿的分支，或者将仓库归入某个分类类别。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | MigrationBench 通过率 | 50 仓库子集 pass@1 |
| 20 | 测试覆盖率保持 | 相对基准的平均覆盖率差异 |
| 20 | 每个已迁移仓库的成本 | 成功运行的 $/repo |
| 20 | 智能体 / 确定性工具集成 | OpenRewrite 处理的修复与智能体编写的修复比例 |
| 15 | 故障分析报告 | 包含示例的分类法完整性 |
| **100** | | |

## 练习

1. 仅使用 OpenRewrite（无智能体）运行迁移流水线。将通过率与完整流水线进行对比。找出仅凭智能体才能产生差异的场景。

2. 实现“Lint 清洁”检查：迁移后，运行样式 Linter（Java 用 spotless，Python 用 ruff）。如果出现新的 Lint 错误，则导致 PR 失败。测量“覆盖率保持但样式退化”的比率。

3. 添加一个“最小差异”优化器：在智能体分支通过测试后，通过第二轮遍历删减不必要的更改。报告差异大小的缩减情况。

4. 扩展到第三种迁移：Node 18 到 Node 22。重用沙箱包装；将配方层替换为自定义的 codemod。

5. 测量“首次绿灯构建时间”（TTFGB）作为 UX 指标。目标：p50 低于 10 分钟。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 确定性基底 | “配方引擎” | OpenRewrite / libcst：具有安全保障的声明式 AST 重写 |
| Codemod | “代码修改程序” | 机械性更改源代码的重写规则 |
| 构建漂移 | “工具版本偏差” | Maven / Gradle / uv 在主版本之间的细微行为差异 |
| 故障类别 | “分类桶” | 仓库未能迁移的标记原因：依赖、语法、测试、构建工具、预算 |
| 覆盖率差异 | “覆盖率保持” | 从基准到迁移分支的测试覆盖率百分比变化 |
| 智能体回合 | “工具调用轮次” | 智能体循环中的一个“规划 -> 执行 -> 观察”周期 |
| 预算耗尽 | “触顶” | 仓库在未通过的情况下耗尽了 30 分钟 / 8 美元 / 20 回合的限制 |

## 延伸阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年的权威基准
- [Moderne.io OpenRewrite 平台](https://www.moderne.io) — 确定性基底参考
- [OpenRewrite 文档](https://docs.openrewrite.org) — 配方编写
- [Grit.io](https://www.grit.io) — 替代性 codemod DSL
- [OpenAI 沙箱迁移食谱](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK 参考
- [Google App Engine Py2 到 Py3 迁移工具](https://cloud.google.com/appengine) — 替代性迁移基准
- [libcst](https://github.com/Instagram/LibCST) — Python 确定性基底
- [Daytona 沙箱](https://daytona.io) — 各分支沙箱参考