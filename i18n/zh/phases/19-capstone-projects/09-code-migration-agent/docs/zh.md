# 代码迁移代理 (重级语言/运行时间升级)

> 亚马逊的迁移 (Java 8至17),谷歌的应用引擎Py2至Py3迁移器设定了2026年. 现代的OpenRewrite在尺度上进行了确定性AST重写. 格里特对代码模式式DSL的解决方案也是如此. 生产模式结合了两种:安全重写的确定性基板,以及模糊的案例的代理层,每分支构建的沙盒,以及在公交开幕前变绿的测试带. 终点是迁移50个真实存储器,并发布一个失败类别的通过率.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

扩大代码迁移是2026年编码剂生产的最清洁应用之一. 实地真相是显而易见的 (测试套件在迁移之后是否通过?),奖励是真实的 (Java-8舰队迁移是人数规模项目),基准是公开的 (MigrationBench 50-repo子集). 现代的OpenRewrite处理了确定性方面. 代理层处理了OpenRewrite的食谱不能处理的一切:模糊的重写,构建系统漂移,长尾语法,过渡的依赖性破裂.

您将构建一个使用Java 8 repo (或Python 2 repo) 的代理,并产生一个绿色CI迁移分支.您将测量通过率,测试覆盖保护,每次 repo 的成本,并构建一个失败类别.对决于只确定性基线的对方告诉您代理的价值实际居住在哪里.

## 概念

管道有两个层.**deterministic substrate**通过使用"Java" (OpenRewrite for Java,Python) 运行了大部分机械重写的安全性:进口,方法签名,零安全性修改,尝试资源,过时的API替代. 它是快速的,产生可审核的差异.**agent layer**(OpenAI Agents SDK或LangGraph over Claude Opus 4.7和GPT-5.4-Codex) 处理配方不能的情况:构建文件升级 (Maven/Gradle/pyproject),过渡性依赖冲突,测试片,定制注释.

每个回复都得到一个戴托纳沙箱,预装目标运行时间.代理反复执行:运行构建,分类故障,应用修复,重启. 硬限制:每次回复30分钟,每次回复8美元,每次回复20个代理.如果所有测试通过,覆盖率下降不超过2个百分点,分支将打开一个 PR.如果没有,则回复将在失败类下提交,有证据.

失败类别是可交付的. 在50个复制中,什么是破产的? 过渡式代码? 定制注释? 构建工具版本? 测试片段与迁移无关? 每个类别都得到了数量和示例差异. 未来的食谱作者可以针对前三.

## 建筑

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

## 堆

- 确定性基板:OpenRewrite (Java) 或libcst (Python)
- 代理:OpenAI代理SDK或LangGraph 通过Claude Opus 4.7 +GPT-5.4代码
- 沙箱:每分支的Daytona开发容器,预装目标运行时间 (Java 17 / Python 3.12)
- 构建系统:马文,格拉德,UV (字thon)
- 标准:亚马逊迁移Bench50回复子集 (Java 8至17),谷歌应用程序引擎Py2-to-Py3回复
- 测试:平行运行器,通过Jacoco (Java) 或coverage.py (Python) 覆盖
- 可观察性:每次复制的长+跟踪捆绑
- 仪表板:每个类数和示例差异的故障类别仪表板

```figure
ce-migration-funnel
```

## 建立它

1. **Recipe pass.**首先运行OpenRewrite (Java) 或libcst (Python) 配方.捕捉到机械迁移的70-80%. 作为"配方"承诺.

2. **Build trial.**戴顿沙箱:安装目标运行时间,运行构建.如果绿色,跳转测试.如果红色,交给代理.

3. **Agent loop.**工具的LangGraph: `run_build`现在`read_file`现在`edit_file`现在`run_test`现在`git_diff`代理将故障分类 (深度,语法,测试,构建工具) 并应用针对性的修复. 复制.

4. **Budget caps.**任何违规行为都会停止,并且在"预算_耗尽"下,

5. **Test + coverage gate.**构建绿色后,运行测试套件. 进行覆盖与基 repo 的比较. 如果覆盖率下降超过2个百分点,请在"覆盖_回归"下文件.

6. **PR open.**通过不同和简要的做法, 执行该经纪人的承诺.

7. **Failure taxonomy.**对于每一个失败的回复, 标签一个类别:`dep_upgrade_required`现在`build_tool_drift`现在`custom_annotation`现在`test_flake`现在`syntax_edge_case`现在`budget_exhausted`建立一个仪表板.

8. **50-repo run.**执行在移动银行子集中. 报告每类通过率,每次报价,覆盖性-保存,以及仅对比与确定性的基线.

## 用它

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

## 运送它

`outputs/skill-migration-agent.md`给出一个 repo,它执行确定性食谱,然后执行代理循环来产生绿色迁移分支,或者在一个类别下文件 repo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## 运动

1. 运行迁移管道只使用OpenRewrite (没有代理).将通过率与整个管道进行比较. 确定只有代理才是区别的情况.

2. 执行" lint-clean"检查:迁移后,运行一个风格linter (Java无点,Python无).如果出现新的 lint 错误,则失败 PR.测量覆盖性保存但风格重回率.

3. 添加"最小差异"优化器:经过经验后,经验者分支通过第二次通过,切除不必要的变化.报告差异大小的减少.

4. 扩展到第三次迁移:节点18至节点22. 再利用沙盒包装;换取配方层进行定制代码模式.

5. 测量时间到第一绿色构建 (TTFGB) 作为UX指标.目标:p50在10分钟以下.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## 进一步阅读

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/)2026年法典基准
- [Moderne.io OpenRewrite platform](https://www.moderne.io)确定性基板参考
- [OpenRewrite documentation](https://docs.openrewrite.org) 制订食谱
- [Grit.io](https://www.grit.io)替代代代码模式DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) 代理人 SDK参考
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine)替代迁移基准
- [libcst](https://github.com/Instagram/LibCST) Python 确定性基板
- [Daytona sandboxes](https://daytona.io)每分支的参考沙盒
