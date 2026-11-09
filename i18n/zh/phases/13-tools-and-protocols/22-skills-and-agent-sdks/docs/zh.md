# 代理技能:可携带合同和运行时间限制

> 技能不是一个更好的文件名的长时间提示,而是一个可发现的指令,资源和可执行的辅助工具包,通过运行时间合同进入代理的环境.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## 学习目标

- 定义一个代理技能,而不用把它混为一谈, 提示,存储器指令,工具,,子器或插件.
- 阅读手机`SKILL.md`合同和分离其与运行时间特定的延长.
- 解释发现,选择,激活,资源加载,工具使用和验证作为生命周期的不同阶段.
- 在运行时间之前验证技能包,
- 选择一个技能,MCP工具,子,子弹或普通代码来完成具体任务.

## 十分钟的第一次成功

在长时间解释之前,你会创造一个小技能,
通过使用完整的审查器捆绑到一个真正的代理主机,
结果,然后取消它. 这证明了生命周期,

### 飞往真正的宿主实验室的前航班

实际主机检查点需要Node.js,`npx`选择一个
能使用技能的主机,并写入您选择的项目或用户范围
首先要检查本地命令:

```bash
node --version
npx --version
python3 --version
```

在安装之前,决定您将使用哪个主机和范围.
您可以在网站上阅读本课程或继续阅读
后面的手动包练习.
没有证明主机发现,调用,捆绑脚本执行,或
让这些观察留下标记.

### 1. 在空白的工作目录中启动

在任何学习工作的父母目录中运行这些命令:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

如果它打印文件,选择不同的命令.
没有任何文件,所以审查有明确的界限.

创建一个目录,以学习你的第一技能:

```bash
mkdir -p my-first-skill
```

创建`my-first-skill/SKILL.md`含有以下内容:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

检查您是否创建文件在预期目录中:

```bash
test -f my-first-skill/SKILL.md
```

没有输出和出口代码0意味着文件存在.

### 2. 安装完整的审核器包

留在里面`agent-skills-first-run`运行:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

选择您使用的代理主机和范围.安装器应该列出
`skill-contract-reviewer`它们写的目的地.`--full-depth`是
需要因为这个课程的技能是一个嵌套的集群,
剧本,一个资产.

设置`SKILL_ROOT`必须将其转移到安装器报告的绝对目录中.
包含安装的目录`SKILL.md`没有课源
目录,而不是当前的工作空间:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

如果代理会话已经开放,启动新的会话或使用主机的
不要假设每个主机都热重新加载了其目录.

### 3. 直接要求

在安装的代理中,`agent-skills-first-run`作为工作
导录,使用该主机支持的语法:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

使用打印的绝对值为 `SKILL_ROOT`其他`TARGET_ROOT`在
要求主机在执行之前扩展它们,并显示确切的
解决命令,而不是依赖进程工作目录的命令:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

解析命令应以此形式,没有留下任何位置持有符:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

成功的结果具有三个特征:

1. 宿主发现了`skill-contract-reviewer`通过名字.
2. 审查员阅读包裹合同并运行其捆绑验证器.
3. 答案包含了没有结构错误的验证报告
   样本,加上合理的原始选择.

执行证据还必须指定脚本路径,目标路径,
没有这些字段的流动报告不能
证明安装的伴侣脚本运行.

如果主机报告该技能不可用,请验证安装
目的地,重新扫描或重新启动一次,再尝试明确的请求.
改写技能描述以掩盖安装故障.

### 4. 探测器隐含选择

开始一个新的代理转换,然后进入同一个任务,

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

如果主机暴露出选定的技能,请记录是否选择
`skill-contract-reviewer`如果主机不显示路由,
显而易见的呼唤是可移植的倒退.

### 5. 清理

删除仅安装的审视器捆绑:

```bash
npx skills remove skill-contract-reviewer
```

选择安装过程中使用的相同主机和范围.
会议,一个明确的要求`skill-contract-reviewer`报告
没有任何可用.`my-first-skill`对于后期课程,或取消
在你完成了轨道后,

## 问题

假设你的团队有一个可靠的发布工作流程. 它会找到合并的变化,检查迁移说明,更新变更日志,运行一个包装命令,并生成一个审查检查列表.

通过将工作流放到一个提示中,它可以轻松粘贴并难以操作.提示没有稳定的身份,没有发现规则,没有资源界限,没有可测试的包装形状,并且没有答案:谁可以调用它?模型应该何时选择它?它可以运行哪些脚本?哪些文件是可信的?当环境被压缩时,什么存活?

对于这些问题来说,我们必须要把它们放在一个单独的位置,并把它们放在一个单独的位置.`SKILL.md`根据一个主机的无证行为,

首先要做的是分类,然后决定如何包装.

## 概念

### 技能编码程序知识

代理技能是一个目录,其入口点是`SKILL.md`输入文件包含YAML前列,然后是Markdown指令.目录也可以包含参考,脚本和资产.

```figure
skill-package-anatomy
```

文件是可部署的单元.`SKILL.md`没有引用的包装是破碎的,即使它的前面材料被解析.

### 周边的抽象

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

释放技能可以告诉代理人如何检查释放.一个MCP服务器可以暴露释放注册表.一个子可以禁止直接推.一个副官可以独立审计候选人.这些件是由因为它们保持不同的责任组成.

### 技能是两个不同的概念.

研究系统有时会称学习的程序,成功的轨迹或环境特定的政策碎片为技能. 代理人在探索过程中可以创建这些文物,根据任务相似性检索它们,执行它们,并根据反修改图书馆.

这部小轨道中的代理技能不同.它是一个由作者编制的包,包含声明的文件系统合同,目录元数据,渐进披露,运行时间调用调用和主机控制的工具.它可以由代理生成或改进,但学习不需要格式.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

两种想法都包含可重复使用的能力.

### 移动核心

代理技能规范需要两个前面材料领域:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`必须符合规范的命名规则,并与母目录相匹配. `description`需要说明技能是什么,什么时候适用.

可移植的可选字段是:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

马克唐机构拥有操作说明. 它应该定义工作流程,决策点,失败行为,以及直接通向支持资源的路径.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### 运行时间扩展是第二层

有些主机可以接受额外的前置或伴侣配置.这些字段可能是有用的,但它们不自动移植.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

处理每个扩展程序都像一个适配器. 保持核心工作流程没有它有效,记录下后退,并测试使用它的主机. 运行时间可能会忽视一个未知的字段,拒绝它,或保存它,而不实施行为.

### 前列是可执行的元数据

在技能体被读取之前,元数据改变系统行为.

- 一个形的`name`发现可能会失败.
- 的`description`能引导错误的请求.
- 只有人类的旗可以从模型的目录中删除技能.
- 工具权限可以改变主机是否要求许可.
- 文本设置可以将执行转移到单独的代理会议.

检查前面物质,如配置代码,验证它,版本它,并包括其行为在评估.

### 技能生命周期

```figure
skill-runtime-lifecycle
```

每个箭头都是一个有自己的失败模式的边界.

1. **Discovery**在配置位置找到可能的包裹.
2. **Validation**在目录发布前拒绝错误的或不安全的包装.
3. **Cataloging**揭露了一个紧的`name`其他`description`没有完整的包裹.
4. **Selection**决定技能是否相关.
5. **Activation**载体进入可见模型的环境中.
6. **Disclosure**只有分支机构要求阅读参考或资产.
7. **Execution**使用主机工具,根据主机的许可和隔离规则.
8. **Verification**检查生产的文物,不论模型的要求如何.

由于这些阶段的崩导致了不良的心理模型.一个发现的技能是不活跃的.一个活跃的技能不被授权做它描述的一切.一个允许的工具呼叫不是证明结果是正确的.

### 技能和工具是直角的

技术人员回答:"该应用程序可以要求哪些功能,以及它们的方案是什么?"一个技能回答",代理应该如何处理这个类型的任务?"

```figure
skill-tool-orthogonality
```

技能可能会命名工具,但主机拥有实际能力登记册.如果工具不存在,技能应该明确表示倒退或失败.它永远不应该意味着命名能力创造它.

### 技能和存储指令是不同的范围

库存指令描述了你已经处于的环境:命令,会议,生成的文件和边界.一个技能为许多库存中可能发生的任务提供可重复使用的程序.

当这两种应用时,活跃用户请求和存储器规则限制了技能.一个通用的重构技能不能取代禁止编辑生成文件的存储器规则.

### 技能不互相进口

一个技能可以引导代理调用另一个,但这不是语言级进口.第二个技能仍然通过运行时间发现,资格,激活,权限和文本处理.

写出跨技能依赖性作为可观察的工作流边缘:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

这使得依赖性可测试,并给主机执行政策的机会.

## 建立它

`code/main.py`它们只能使用一个标准化验证器和一个选件选件器.

验证器揭示:

- `parse_frontmatter(text)`为了将元数据与身体分开.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`检查所需的字段,命名,未知的扩展,体体存在和可移植的限制.
- `ValidationIssue`其他`SkillReport`返回结构化证据,而不是一个不透明的布鲁尔式.
- `FrontmatterSyntaxError`对于无法安全解释的输入.

选择者会发现`TaskShape`其他`select_primitives(task)`它将任务的需求映射到普通代码,存储器指令,技能,,子器或MCP工具.

运行实验室:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

这个命令区块需要一个本地克隆,必须从内部开始.
这种克隆是如此`git rev-parse --show-toplevel`它们可以解决存储库根.

演示程序将JSON打印为一个有效的便携技能,一个扩展的主机技能,一个不有效的包,以及几个任务形状决策.检查问题代码.一个包验证器应该解释如何修复一个文物,而不代表作者猜测.

### 验证命令的问题

在更深入的内容规则之前验证廉价结构性事实:

```figure
skill-validation-order
```

由于此次测试的结果,

## 用它

在写出技能之前,填写下面的决定卡:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

许多生产工作流程使用多行,卡片阻止一个文物假装提供所有属性.

## 运送它

这一课产生了`skill-contract-reviewer`包装下面`outputs/`它包含:

- 一个便携式`SKILL.md`审查拟议的技能包;
- 移动合同和原始选择的参考检查列表;
- 确定性验证脚本;
- 任务形状装置,包括提示,技能,工具,,普通代码和副标.

装备全部包,不仅仅是其输入文件:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

课程安装器报告了每一个复制的13期技能,并写
`/tmp/aiefs-skills/manifest.json`. 这种清洁目的地检查包装形状;
在上面的首次成功循环检查了实在的主机中发现和调用.

下面的课程深化了生命周期的每个阶段.第24课程建立了发现和逐步披露.第25课程建立了调用政策和路由.第26课程将权限与沙盒分开.第27课程将整个包装变成了一个评估的释放文物.

## 运动

1. 通过使用 `TaskShape`捍卫每一个你选择多个原始的案件.
2. 添加一个500字符的边界测试证明`compatibility`值通过,501字符值失败为规格错误.
3. 添加一个运行时间扩展到允许列表. 写一个测试证明相同的文件仍然可以区分于只可移植的技能.
4. 分成400行提示`SKILL.md`让每个文件都负责一个类型的信息.
5. 设计一个不存在的MCP工具的技能失败响应. 不要默默地用更广泛的权限替代工具.
6. 检查现有技能,并将每个句子标记为路由,程序,政策,参考指针或输出合同.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## 进一步阅读

- [Agent Skills specification](https://agentskills.io/specification)对于可移植目录和前置材料合同.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)对于范围,指令和资源组织.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)对于目前的Codex发现和呼唤行为.
- [Claude Code skills](https://code.claude.com/docs/en/skills)对于一个运行时间的调用,参数,工具和委托文本扩展.
