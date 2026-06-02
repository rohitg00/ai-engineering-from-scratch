# Capstone 09 — 代码迁移 agent（仓库级语言 / 运行时升级）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Amazon 的 MigrationBench（Java 8 到 17）和 Google 的 App Engine Py2-to-Py3 迁移器，定下了 2026 年的标杆。Moderne 的 OpenRewrite 在大规模上做确定性的 AST 重写。Grit 用 codemod 风格的 DSL 切入同一个问题。生产里的范式是把两者结合：一个确定性底座负责安全重写，再加一层 agent 处理那些模糊地带；用 sandbox 跑分支级别的构建，再用一套测试 harness 在 PR 打开之前就把它跑绿。本 capstone 的目标是迁移 50 个真实仓库，公布一个 pass rate（通过率）和一份失败分类（failure taxonomy）。

**Type:** Capstone
**Languages:** Python（agent）、Java / Python（目标）、TypeScript（dashboard）
**Prerequisites:** Phase 5（NLP）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（agents）、Phase 15（自主）、Phase 17（基础设施）
**Phases exercised:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## 问题（Problem）

大规模代码迁移是 2026 年编码 agent 最干净的生产应用之一。ground truth（标准答案）很明确——迁移之后测试套件能不能跑过？回报很实在——一次 Java-8 全量舰队迁移就是个抵得上一支团队的项目；基准也是公开的（MigrationBench 的 50-repo 子集）。Moderne 的 OpenRewrite 负责确定性那部分。agent 这一层负责所有 OpenRewrite recipe 搞不定的：模糊的重写、构建系统漂移、长尾语法、传递依赖崩坏。

你要构建一个 agent，输入一个 Java 8 仓库（或 Python 2 仓库），产出一个 CI 通过（绿）的迁移分支。你要测量 pass rate、测试覆盖率保留情况、每个仓库的成本，并构建一份 failure taxonomy。和「只用确定性工具」这条 baseline 做对比，会告诉你 agent 的价值真正落在哪里。

## 概念（Concept）

整条流水线分两层。**确定性底座**（Java 用 OpenRewrite，Python 用 libcst）负责把绝大部分机械式重写安全地跑掉：import、方法签名、null 安全编辑、try-with-resources、被废弃 API 的替换。它快，而且产出的 diff 可审计。**agent 层**（OpenAI Agents SDK 或 LangGraph，跑在 Claude Opus 4.7 与 GPT-5.4-Codex 之上）负责 recipe 搞不定的：构建文件升级（Maven/Gradle/pyproject）、传递依赖冲突、test flake（测试抖动）、自定义注解。

每个仓库都跑在一个预装目标运行时的 Daytona sandbox 里。agent 循环执行：跑构建、给失败分类、打补丁、再跑。硬上限：每个仓库 30 分钟、$8、20 个 agent turn（agent 轮次）。如果所有测试通过、覆盖率 delta 不为负，分支就开 PR。如果不行，仓库就归到某个失败类目下，并附上证据。

failure taxonomy 是最终交付物。50 个仓库里，到底什么坏了？是传递依赖？是自定义注解？是构建工具版本？还是和迁移无关的 test flake？每一类都给一个计数和一段 exemplar diff（典型差异样本）。未来的 recipe 作者就可以盯着排前三的去补。

## 架构（Architecture）

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

## 技术栈（Stack）

- 确定性底座：OpenRewrite（Java）或 libcst（Python）
- agent：OpenAI Agents SDK 或 LangGraph，跑在 Claude Opus 4.7 + GPT-5.4-Codex 之上
- sandbox：Daytona devcontainers，按分支隔离，预装目标运行时（Java 17 / Python 3.12）
- 构建系统：Maven、Gradle、uv（Python）
- 基准：Amazon MigrationBench 50-repo 子集（Java 8 到 17）、Google App Engine Py2-to-Py3 仓库
- 测试 harness：并行 runner，覆盖率走 Jacoco（Java）或 coverage.py（Python）
- 可观测性：Langfuse + 每个仓库一份 trace bundle，包含每一个 diff chunk
- dashboard：failure-taxonomy dashboard，按类显示计数和 exemplar diff

## 动手实现（Build It）

1. **Recipe pass。** 先跑 OpenRewrite（Java）或 libcst（Python）recipe。把那 70-80% 机械式的迁移拿下，作为「recipe」commit 提交。

2. **Build trial（构建试跑）。** Daytona sandbox 里：装目标运行时、跑构建。绿了就直接进测试；红了就把控制权交给 agent。

3. **agent loop。** LangGraph 配工具：`run_build`、`read_file`、`edit_file`、`run_test`、`git_diff`。agent 给失败分类（dep、syntax、test、build-tool）然后施加针对性修复。再跑。

4. **预算上限。** 每个仓库 30 分钟 wall-clock、$8 成本、20 个 agent turn。任何一项越界就停下，把当前 diff 归到 `budget_exhausted` 下。

5. **测试 + 覆盖率门。** 构建跑绿之后跑测试套件。把覆盖率和基准仓库对比。如果掉了超过 2%，归到 `coverage_regression` 下。

6. **开 PR。** 成功就推分支，开 PR，附上 diff 以及一段总结：哪些 recipe 应用了、哪些 commit 是 agent 写的。

7. **failure taxonomy。** 对每个失败的仓库打类标：`dep_upgrade_required`、`build_tool_drift`、`custom_annotation`、`test_flake`、`syntax_edge_case`、`budget_exhausted`。配套做一个 dashboard。

8. **50-repo 跑批。** 在 MigrationBench 子集上跑完。报告：分类 pass rate、每仓成本、覆盖率保留、以及和「只用确定性工具」的 baseline 的对照。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-migration-agent.md` 就是交付物。给定一个仓库，它先跑确定性 recipe，再跑 agent loop，要么产出一个绿的迁移分支，要么把仓库归到 taxonomy 的某一类下。

| 权重 | 标准 | 怎么测 |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo 子集 pass@1 |
| 20 | 测试覆盖率保留 | 相对基准的覆盖率 delta 平均值 |
| 20 | 每仓迁移成本 | 通过的跑次上 $/repo |
| 20 | agent / 确定性工具集成度 | OpenRewrite 处理 vs agent 撰写的修复占比 |
| 15 | 失败分析报告 | taxonomy 完整度，含示例 |
| **100** | | |

## 练习（Exercises）

1. 只跑 OpenRewrite（不挂 agent）跑迁移流水线。把 pass rate 和完整流水线对比。找出那些「只有 agent 才能搞定」的案例。

2. 实现一个「lint-clean」检查：迁移完之后跑一个 style linter（Java 用 spotless，Python 用 ruff）。出现新的 lint 错误就让 PR 失败。测一下「覆盖率保住但风格回退」的占比。

3. 加一个「minimal-diff」优化器：在 agent 的分支测试通过之后，再来一遍把不必要的改动裁掉。汇报 diff 大小的缩减幅度。

4. 扩展到第三种迁移：Node 18 到 Node 22。复用 sandbox 那一层；recipe 层换成自定义 codemod。

5. 把 time-to-first-green-build（TTFGB，到首次绿构建的时间）作为 UX 指标来测。目标：p50 在 10 分钟以内。

## 关键术语（Key Terms）

| 术语 | 大家嘴上的说法 | 实际含义 |
|------|-----------------|------------------------|
| Deterministic substrate（确定性底座） | "Recipe engine" | OpenRewrite / libcst：声明式 AST 重写，带安全保证 |
| Codemod | "改代码的程序" | 机械修改源码的重写规则 |
| Build drift（构建漂移） | "工具版本错位" | Maven / Gradle / uv 在大版本之间细微的行为变化 |
| Failure class（失败类） | "taxonomy 桶" | 一个有标签的「这仓没迁过去」的原因：dep、syntax、test、build-tool、budget |
| Coverage delta | "覆盖率保留" | 测试覆盖率从基准到迁移分支的百分比变化 |
| Agent turn | "一轮工具调用" | agent loop 里一次 plan -> act -> observe 周期 |
| Budget exhaustion（预算耗尽） | "顶到天花板" | 仓库吃完了 30 分钟 / $8 / 20 个 turn 的额度还没通过 |

## 延伸阅读（Further Reading）

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — 2026 年的标准基准
- [Moderne.io OpenRewrite platform](https://www.moderne.io) — 确定性底座的参考实现
- [OpenRewrite documentation](https://docs.openrewrite.org) — recipe 编写
- [Grit.io](https://www.grit.io) — 另一种 codemod DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK 的参考实现
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) — 另一种迁移基准
- [libcst](https://github.com/Instagram/LibCST) — Python 的确定性底座
- [Daytona sandboxes](https://daytona.io) — 按分支隔离 sandbox 的参考方案
