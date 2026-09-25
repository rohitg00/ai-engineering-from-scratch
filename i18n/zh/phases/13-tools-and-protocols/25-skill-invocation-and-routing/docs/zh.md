# 技能调用与路由

> 调用是一个权限决策，紧接着是一个相关性决策。好的描述帮助模型做出选择；好的策略决定该选择是否被允许。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** 阶段 13 · 24（技能发现与渐进式披露）
**Time:** 约 105 分钟

## 学习目标

- 区分显式用户调用、隐式模型调用、应用调用以及技能间调用。
- 将人类可见性与模型可选择性建模为相互独立的策略维度。
- 编写包含正向触发条件和近似误报边界的路由描述。
- 在追踪记录和测试中将资格判定、选择、激活、参数绑定与执行分离开来。
- 适配特定运行时的调用字段，而不将其呈现为可移植的 frontmatter。

## 问题所在

你安装了一个 `database-migration` 技能。用户可以按名称运行它，但模型也会看到它的描述，并在有人提出一般性数据库问题时选择它。随后该技能为一个只需要解释的任务提出了架构变更。

你添加了 `user-invocable: false`，期望阻止用户手动运行它。但在另一个运行时中，该字段被忽略了。你添加了 `disable-model-invocation: true`，期望该技能完全消失。但在理解该字段的运行时中，用户仍然可以显式调用它。

字段名没有问题。出问题的是模型。“用户可以看到它”、“模型可以选择它”、“应用可以预加载它”以及“其中的工具可以执行”是四个独立的事实。一个名为 `invocable` 的单一布尔值无法表达它们。

路由还有第二种失败模式。如果描述含糊不清，多个技能都会显得合理。如果描述堆满关键词，无关任务也会触发它们。目录是一个概率性接口：足够紧凑以便容纳，足够具体以便路由。

## 核心概念

### 五个通道可以启动生命周期

| 参与者 | 调用形式 | 典型用途 | 主要风险 |
|---|---|---|---|
| 人类用户 | 在 UI 或提示中点名某个技能 | 有意的工作流选择 | 用户期望宿主未授予的可用性或权限 |
| 模型或自主智能体 | 从任务上下文中选择目录条目 | 自动化的专家流程 | 误报路由 |
| 应用 | 通过运行时代码激活或预加载技能 | 固定的产品工作流 | 与单个宿主的隐藏耦合 |
| 另一个技能或子智能体 | 作为工作流依赖请求某个确切技能 | 组合 | 循环、缺失依赖或上下文串扰 |
| 评估框架 | 在固定场景下激活某个确切技能 | 可重复的测量 | 在测试技能的同时意外绕过了所研究的生产策略 |

可移植的 Agent Skills 规范定义了包本身。它并未标准化统一的斜杠命令 UI、隐式路由标志、应用 API 或子智能体生命周期。

### 调用的五个阶段

```figure
skill-invocation-stages
```

请精确使用以下术语：

- **有资格（Eligible）** 表示策略允许该参与者请求该技能。
- **被选中（Selected）** 表示用户点名了它，或路由器判定其相关。
- **已激活（Activated）** 表示其指令已进入工作上下文。
- **执行中（Executing）** 表示智能体在这些指令下开始了模型或工具工作。
- **已完成（Completed）** 表示输出通过了独立的成功检查。

只记录 `skill_used=true` 的追踪记录会掩盖失败发生的边界。

### 人类与模型调用构成 2x2 矩阵

| 人类可调用 | 模型可调用 | 模式 | 适用示例 |
|:---:|:---:|---|---|
| 是 | 是 | 共享 | 代码解释、测试规划、文档审查 |
| 是 | 否 | 仅人类 | 发布准备、账单导出、破坏性清理计划 |
| 否 | 是 | 仅模型 | 内部风格指南、领域参考、自动支持流程 |
| 否 | 否 | 禁用或仅应用 | 灰度发布、已弃用的包、程序化预加载 |

该矩阵是一个策略模型，而非标准 YAML。

一个当前的宿主使用 `disable-model-invocation: true` 表示“仅人类”行，使用 `user-invocable: false` 表示“仅模型”行。默认为两者皆可。另一个宿主使用 `agents/openai.yaml` 配合 `allow_implicit_invocation: false` 来保持显式调用，同时禁用隐式选择。这些是运行时适配器。未知宿主可能忽略它们。

一个容易混淆的细节很重要：`user-invocable: false` 不意味着“模型不能使用它”。它移除的是定义它的宿主中用户的直接调用。`disable-model-invocation: true` 不意味着“该技能已被禁用”。它移除的是模型发起的选择，同时保留显式的用户访问。

### 显式调用是身份优先

显式调用直接提供身份：

```text
/release-readiness v2.4.0
```

或：

```text
release-readiness check v2.4.0 without publishing
```

当前的 Codex 接口文档记载 `/skills` 用于选择，请求中使用纯技能名称进行显式调用。Claude Code 文档记载 `/skill-name` 以及宿主特定的参数展开。确切的语法、菜单可见性、引号规则和变量展开都取决于宿主。

显式请求仍然要通过策略检查。点名一个技能不应绕过缺失的权限、工作区约束、审批门禁或运行时隔离。

### 隐式调用是描述优先

对于隐式路由，模型最初看到的是目录元数据而非完整正文。因此描述就是技能的路由接口。

弱：

```yaml
description: Helps with releases.
```

过于宽泛：

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

有边界：

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

有边界的版本包含：

1. **能力：** 检查已准备好的候选发布物。
2. **输出：** 就绪报告。
3. **正向边界：** 询问发布产物是否就绪。
4. **负向边界：** 普通构建和开发不在范围内。

当两个相近的技能共享词汇时，负向边界很有用。它们不能替代近似误报评估。

### 路由是带弃权选项的分类

对于技能 `s` 和请求 `x`，设想一个路由器分数：

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

确切的打分可能是 LLM 决策而非算术运算。但工程原则依然成立：选择应当超过某个阈值并击败竞争技能。当证据不足时，弃权。

```figure
skill-routing-abstention
```

对于高影响的技能，即使描述很强，隐式路由也可能不合适。当误报的代价超过自动选择的便利时，应使用仅人类策略。

### 资格判定必须先于排名

不要对所有发现的技能打分，选出最强匹配，然后再检查该技能的策略。被阻止的最高匹配会错误地阻止有资格的低分候选者被考虑。

隐式路由应遵循以下顺序：

1. 按请求参与者和活动的宿主适配器过滤已发现的技能。
2. 只对有资格的候选者打分。
3. 如果最强有资格匹配通过阈值和歧义规则，则选择它。
4. 当没有候选者有资格或没有资格者的分数足够强时，弃权。

假设 `incident-triage` 得分 `0.80`，但其宿主扩展禁用了模型调用。`incident-review` 得分 `0.55` 且允许模型调用。路由器应将 `incident-review` 评估为最佳有资格候选者。它不应选择 `incident-triage`、拒绝它，然后停止。

这一顺序也使策略变更不会改变相关性分数的含义。资格定义选择集。相关性对该集合排序。

### 路由评估需要近似误报

正例证明召回率：

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

明确的负例证明基本精确率：

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

近似误报暴露边界质量：

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

该近似误报与发布技能共享 `package` 和 `build`，但属于其他工作流。只由明显的正例和不相关负例组成的路由评估集会夸大质量。

### 参数有三种表示

调用参数会跨越多个边界：

```figure
skill-argument-boundaries
```

在每个边界上，保留意图而不把文本当作代码。

- 宿主解析器决定命令语法和引号处理。
- 技能按宿主规则接收绑定的文本或变量。
- 指令验证必需值和默认值。
- 工具调用将值转换为类型化模式并重新验证。

不要将原始参数插入 shell 命令。优先使用以参数向量调用的脚本或类型化的 MCP 工具。

### 应用调用是显式编排

产品可以激活某个技能，因为其工作流已经知道任务类型。例如，拉取请求审查服务可以在用户按下 Review 后预加载 `pull-request-risk-review`。

这消除了路由的不确定性，但产生了对运行时 API 的依赖。请将该适配器置于可移植正文之外：

```figure
skill-host-adapter
```

该技能在被其他兼容客户端打开时仍应保持可理解。

### 技能间调用是类似工具的边

假设 `release-readiness` 在依赖文件变更时请求 `security-change-review`。

调用方应提供：

- 目标技能身份；
- 有边界的任务和产物路径；
- 预期的响应契约；
- 调用原因；
- 不可用时的回退方案；
- 最大深度或循环规则。

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

第二个技能不会被盲目地粘贴进第一个。宿主决定如何激活它，以及它是否共享上下文、在分叉中运行、还是通过工具结果返回。

### 上下文生命周期取决于宿主

激活后，技能正文可能保留在对话中、在压缩期间被摘要，或在委托的上下文中运行。工具授权可能只持续一轮，而指令持续更久。子智能体可能收到技能但没有父级的完整历史。

不要编写依赖不可见生命周期假设的技能。将持久输出写入文件或类型化状态，确保重新进入是安全的，并说明中断后必须重新加载的内容。

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## 动手构建

`code/main.py` 将策略和路由实现为相互独立的适配器。

模型包括：

- `Actor` 用于人类、模型、自主智能体、应用、技能和框架调用方；
- `SkillMetadata` 用于路由身份；
- `InvocationPolicy` 用于人类/模型矩阵；
- `InvocationRequest` 和 `InvocationDecision` 用于可追踪的输入和结果；
- `CorePolicyAdapter` 用于不带宿主扩展的可移植行为；
- `ExtensionPolicyAdapter` 用于识别的运行时字段；
- `build_invocation_matrix(policy)` 用于 2x2 视图；
- `route_request(skills, request, adapter)` 用于在相关性排名、选择和拒绝之前进行资格过滤。

运行它：

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

演示会打印一个矩阵，以及显式人类、隐式模型、自主智能体、应用、技能组合和框架通道的决策。其扩展适配器的结果显示了被阻止的最高词法匹配如何在有资格的替代方案被排名之前被移除。它还包括精确名称允许列表。无需模型 API。这个确定性路由器的存在是为了使策略边界可检查，而不是声称词法匹配可以复现生产环境的模型路由。

### 为什么核心与扩展适配器是分离的

如果一个解析器为观察到的每个 frontmatter 字段赋予含义，它会把运行时约定悄悄提升为伪标准。分离的适配器迫使调用方指明哪个宿主的语义处于活动状态。

`CorePolicyAdapter` 只使用应用提供的策略。`ExtensionPolicyAdapter` 识别一组显式的宿主字段，并记录哪个字段改变了决策。

## 使用它

在发布技能之前编写调用契约：

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

该契约是面向适配器和测试的设计文档。除非某个标准明确采纳它，否则它不是可移植的 `SKILL.md` frontmatter。

## 交付它

本课产出 `skill-invocation-router` 包。它包含一个调用模型参考、一个示例宿主策略，以及一个非执行的 CLI，可评估一条人类、模型、自主智能体、应用、技能组合或框架请求，并返回带通道、适配器、分数和原因的 JSON 决策。

单请求 CLI 是一个策略探针，不是完整的触发评估。使用第 27 课中带标注的正例与近似误报设计来计算混淆计数、精确率、召回率和重复运行的稳定性。

## 练习

1. 创建人类/模型矩阵的全部四行，并为每一行编写一个合法用例。
2. 为 `CorePolicyAdapter` 添加仅应用激活。证明人类和模型调用方仍被拒绝。
3. 为一个部署技能编写十个近似误报。每个提示必须与该技能共享词汇，同时属于不同的工作流。
4. 在前两个路由分数之间添加歧义余量。当余量过小时返回 `ask`。
5. 为技能间请求添加最大组合深度，并检测两个技能构成的循环。
6. 将同一组带标注的数据分别通过核心和扩展适配器运行。解释每一个改变的决策。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 显式调用 | "斜杠命令" | 参与者直接提供技能身份，受策略约束 |
| 隐式调用 | "模型自己选" | 路由器基于任务上下文从有资格的目录元数据中选择 |
| 用户可调用 | "人类可以用它" | 宿主特定的菜单或直接调用属性，不是核心字段 |
| 模型可调用 | "智能体可以用它" | 在宿主策略下进行隐式模型选择的资格 |
| 调用适配器 | "frontmatter 解析器" | 将宿主的字段和 API 映射到声明式策略模型的代码 |
| 近似误报 | "困难负例" | 与技能预期输入相似但不应触发请求的请求 |
| 弃权 | "未选择技能" | 当证据缺失或含糊时的一种有意的路由结果 |

## 延伸阅读

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)：正向触发条件、具体性和评估。
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)：触发条件和输出评估设计。
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)：当前 Codex 的显式和隐式调用控制。
- [Claude Code skills](https://code.claude.com/docs/en/skills)：一个宿主的 `user-invocable`、`disable-model-invocation`、参数和委托上下文。