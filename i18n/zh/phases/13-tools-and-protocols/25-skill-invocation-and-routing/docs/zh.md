# 技能调用和路由

> 要求是当局决定后续的相关性决定.一个好的描述帮助模型选择;一个好的政策决定是否允许选择.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## 学习目标

- 区分明确的用户调用,隐含的模型调用,应用调用和技能调用.
- 作为独立政策尺寸,模拟人类可见性和符合性.
- 写出具有积极触发和近错误边界的路由描述.
- 单独的资格,选择,激活,结合参数,并在线索和测试中执行.
- 调整运行时间特定的调用字段,而不用把它们作为可移植的前置物.

## 问题

你安装一个`database-migration`技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术: 技术:

你还补充了`user-invocable: false`其他运行时间,该领域被忽视.`disable-model-invocation: true`在理解它的运行时间里,用户仍然可以明确地使用它.

应用程序可以预装它,以及它内部的工具可以执行"是单独的事实.一个单个布鲁尔式叫做`invocable`没有办法表达它们.

路由模式有第二种失败模式.如果描述不清楚,几个技能就会变得可信.如果描述充满关键词,无关任务会触发它们.目录是一个概率界面:足够紧,足够具体的路由.

## 概念

### 五个道可以启动生命周期

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

移动代理技能规范定义了包.它不标准化一个通用切片命令UI,隐含路由旗,应用 API或子代码生命周期.

### 五个调用阶段

```figure
skill-invocation-stages
```

准确使用这些词:

- **Eligible**政策允许这个演员要求技能.
- **Selected**意思是用户命名或路由器认为它有意义.
- **Activated**代表其指示进入工作环境.
- **Executing**代表根据这些指示开始模拟或工具工作.
- **Completed**产量已通过独立的成功检查.

只有记录的痕迹`skill_used=true`隐藏了失败发生的地方的边界.

### 人类和模型调用形成2x2矩阵

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

矩阵是一个政策模型,而不是标准的YAML.

一个当前的主机使用`disable-model-invocation: true`对于只使用人为排列的`user-invocable: false`默认的是两个.另一个主机使用`agents/openai.yaml`随着`allow_implicit_invocation: false`它们是运行时间适配器,未知的主机可能会忽略它们.

很难理解的细节:`user-invocable: false`它删除了定义它的主机中直接用户调用. `disable-model-invocation: true`没有意味着"技能已被禁用". 它删除了模型启动的选择,同时保持了用户的明确访问.

### 直接呼唤是身份的第一.

明确的呼叫直接提供身份:

```text
/release-readiness v2.4.0
```

或:

```text
release-readiness check v2.4.0 without publishing
```

目前的Codex界面文件 `/skills`对于选择和明确调用请求中简单技能名称.`/skill-name`精确的语法,菜单可见性,引用规则和变量扩展属于主机.

要求仍然通过政策. 命名技能不应该绕过缺失权限,工作空间限制,批准门户或运行时间隔离.

### 隐含的呼唤是描述的第一

对于隐含路由,模型最初看到的是目录元数据而不是整个体.因此,描述是技能的路由界面.

弱势:

```yaml
description: Helps with releases.
```

超宽:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

限制:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

限量版本包含:

1. **Capability:**检查已准备的候选人.
2. **Output:**准备报告.
3. **Positive boundary:**问是否准备好释放器件.
4. **Negative boundary:**其他地方的建筑和发展都不适用.

两个近距离技能共享词汇,而负面界限是有用的.

### 路由是分类,包含禁用选项

为了一个技能`s`要求`x`设想一个路由器的分数:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

精确的分数可能是LLM决策而不是算术.工程原则仍然是如此:选择应该超过一个门和竞争技能.当证据很弱时,避免.

```figure
skill-routing-abstention
```

对于高影响能力,隐含路由可能不合适,即使有强烈的描述.当假阳性的成本超过自动选择的便利时,只使用人为政策.

### 资格必须先于排名

没有得到每一个发现的技能,选择最强的比赛,然后检查一个技能的政策.一个被阻止的顶级比赛会错误地阻止一个符合条件的低分的候选人被考虑.

通过下列列列表来实现暗示路由:

1. 选器发现了要求演员和主机适配器的技能.
2. 只有合格的候选人得到分数.
3. 选择最强的符合条件的比赛,如果它清除了门和模糊性规则.
4. 如果没有候选人符合条件或没有合格得分足够强,则避免.

假设`incident-triage`评分`0.80`但它的主机扩展禁用模型调用. `incident-review`评分`0.55`路由器应该评估`incident-review`作为最好的资格候选人.`incident-triage`否认,然后停止.

根据该规则,在选择组中,有了相关性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性,可选性等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等等

### 路由评估需要接近错误

积极的案例证明召回:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

显而易见的负面结果证明了基本的精确性:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

接近错误会暴露出边界质量:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

几乎没有什么股票`package`其他`build`只有明显的积极和无关的负面的路由组将夸大质量.

### 论点有三个代表性

调用参数跨越了几个界限:

```figure
skill-argument-boundaries
```

在每一个边界,保持意图,而不是把文本作为代码.

- 接待者决定命令语法和引用.
- 根据主机规则,技能会接收绑定文本或变量.
- 指示验证所需的值和默认值.
- 工具调用将值转换为输入的方案,并重新验证它们.

不要将原始参数插入 shell 命令中. 宁愿使用参数向量或输入MCP工具调用的脚本.

### 申请调用是明确的调整

产品可以激活技能,因为其工作流程已经知道任务类型.例如,一个拉动请求审查服务可以预装`pull-request-risk-review`用户按 Review后.

这消除了路由不确定性,但会对运行时间API产生依赖.

```figure
skill-host-adapter
```

其他符合要求的客户开放时,该技能应该保持可理解性.

### 技能到技能调用是一种工具般的优势

假设`release-readiness`要求`security-change-review`在依赖文件发生变化时.

调用人应提供:

- 目标技能身份;
- 设置任务和文物路径;
- 预期应对合同;
- 要求的理由;
- 如果无法实现,则会出现倒退;
- 极度深度或周期规则.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

接待者决定如何激活它,以及它是否分享文本,运行在叉子中,或者通过工具结果返回.

### 环境生命周期是具体的

启动后,技能体可以留在对话中,在缩小过程中总结,或运行在委托文本中.工具权限可能持续一轮,而指示持续更长时间.一个子女可能没有父母的整个历史获得技能.

不要写出依赖于一个隐形的终身假设的技能. 把持久的输出输入文件或打字状态,确保重新进入安全,并说明在中断后需要重新加载什么.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## 建立它

`code/main.py`执行政策和路由作为独立的适配器.

该模型包括:

- `Actor`对于人,模型,自动操作者,应用,技能和使用者;
- `SkillMetadata`路由身份;
- `InvocationPolicy`对人/模型矩阵;
- `InvocationRequest`其他`InvocationDecision`对于可追踪的输入和结果;
- `CorePolicyAdapter`对于无主机扩展的便携式行为;
- `ExtensionPolicyAdapter`对于已认可的运行时间场所;
- `build_invocation_matrix(policy)`对于2×2视图;
- `route_request(skills, request, adapter)`在相关性排名,选择和拒绝之前进行资格过.

运行它:

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

演示程序将打印一个矩阵和决定, 显而易见的人类,隐含模型,自主代理,应用,技能组成和利用道. 扩展适配器的结果显示,在符合条件的替代品排名之前,被删除了封锁的顶级词汇匹配. 它还包括确切名称的允许名单. 没有模型API. 确定性路由器是为了使政策界限可检查,而不是说词汇匹配重复生产模型路由.

### 为什么核心和扩展适配器是分离的

如果一个解析器将每个观察到的前物质字段分配到意义,它会默默地将运行时间公约推广到一个虚假标准. 单独的适配器迫使调用者命名哪些主机语义是活跃的.

其他`CorePolicyAdapter`应用程序只使用申请提供的政策.`ExtensionPolicyAdapter`识别了明确的主机场和记录,该场改变了决定.

## 用它

在发布技能之前,请写一个招聘合同:

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

合同是适配器和测试器的设计文件.`SKILL.md`标准明确采用它以外,

## 运送它

这一课产生了`skill-invocation-router`包装.它包括一个调用模型参考,一个举例的主机政策,以及一个不执行的CLI,该CLI评估一个人,模型,自主代理,应用程序,技能组合或利用请求,并返回一个JSON决定,包括道,适配器,分数和理由.

单次请求的CLI是政策调查,而不是一个完整的触发评估. 使用27课中标记的正面和接近错误设计来计算混乱数量,精度,召回和重复运行稳定性.

## 运动

1. 创建人类/模型矩阵的四行,并为每行写出一个合法的使用情况.
2. 添加仅用于应用的激活`CorePolicyAdapter`证明人类和模特的呼叫仍然被拒绝.
3. 写出10个近错失的部署技能. 每个提示都必须与技能分享词汇,同时属于不同的工作流程.
4. 添加前两个路由分数之间的模糊差距. 返回 `ask`如果边缘太小,
5. 增加最大的组成深度技能到技能要求,检测两个技能周期.
6. 通过核心和扩展适配器运行相同的标签集.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## 进一步阅读

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)对于积极的触发因素,具体性和评估.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)对于触发和输出评估设计.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)对于目前的Codex明确和隐含的调用控制.
- [Claude Code skills](https://code.claude.com/docs/en/skills)对于一个宿主而言`user-invocable`现在`disable-model-invocation`其他问题,
